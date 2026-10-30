import { readFile, readlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { envPath, type EngineContext } from '../context';
import { exec } from '../exec';
import { exists, joinAll, list, symlinksIn, tilde } from '../fsutil';
import { uvArchivesInUse } from '../processes';
import { compareVersions, contentsRule, homePath, libPath } from './helpers';
import type { CleanupRule } from './types';

const npmCache = (ctx: EngineContext) =>
  path.join(envPath(ctx, 'npm_config_cache') ?? homePath(ctx, '.npm'), '_cacache');
const uvCache = (ctx: EngineContext) => envPath(ctx, 'UV_CACHE_DIR') ?? homePath(ctx, '.cache', 'uv');
const puppeteerCache = (ctx: EngineContext) => envPath(ctx, 'PUPPETEER_CACHE_DIR') ?? homePath(ctx, '.cache', 'puppeteer');
const playwrightCache = (ctx: EngineContext) => libPath(ctx, 'Caches', 'ms-playwright');
const brewLogs = (ctx: EngineContext) => path.join(ctx.brewPrefix, 'var', 'log');
const nvmVersions = (ctx: EngineContext) => homePath(ctx, '.nvm', 'versions', 'node');

const uv: CleanupRule = {
  id: 'uv',
  name: 'Python uv cache',
  category: 'developer',
  safety: 'safe',
  explain: 'Packages and tool environments uv has downloaded. Anything a running tool uses right now is kept.',
  roots: (ctx) => [uvCache(ctx)],
  async scan(ctx) {
    const dir = uvCache(ctx);
    const inUse = uvArchivesInUse(ctx.processes);
    const keptLink = async (link: string) => {
      const target = await readlink(link).catch(() => '');
      return [...inUse].some((id) => target.endsWith(id));
    };
    const targets: string[] = [];
    for (const entry of await list(dir)) {
      if (['CACHEDIR.TAG', '.gitignore', '.lock'].includes(entry)) continue;
      const p = path.join(dir, entry);
      if (entry === 'archive-v0') {
        targets.push(...joinAll(p, (await list(p)).filter((id) => !inUse.has(id))));
      } else if (entry.startsWith('environments-v') && inUse.size) {
        for (const link of await symlinksIn(p)) if (!(await keptLink(link))) targets.push(link);
      } else {
        targets.push(p);
      }
    }
    const kept = (await list(path.join(dir, 'archive-v0'))).filter((id) => inUse.has(id)).length;
    return { targets, detail: tilde(ctx.home, dir) + (kept ? ` · keeps ${kept} in use by running tools` : '') };
  },
};

/** Keeps the newest version in each browser folder, e.g. chrome/mac_arm-149.0.7827.22. */
const puppeteer: CleanupRule = {
  id: 'puppeteer',
  name: 'Old Puppeteer browsers',
  category: 'developer',
  safety: 'safe',
  explain: 'Older Chrome builds Puppeteer downloaded over time. The newest of each is kept.',
  roots: (ctx) => [puppeteerCache(ctx)],
  async scan(ctx) {
    const dir = puppeteerCache(ctx);
    const targets: string[] = [];
    const kept = new Set<string>();
    for (const browser of await list(dir)) {
      const versions = (await list(path.join(dir, browser))).filter((v) => !v.startsWith('.')).sort(compareVersions);
      const newest = versions.pop();
      if (!newest) continue;
      kept.add(newest.slice(newest.indexOf('-') + 1));
      targets.push(...joinAll(path.join(dir, browser), versions));
    }
    return { targets, detail: tilde(ctx.home, dir) + (kept.size ? ` · keeps ${[...kept].join(', ')}` : '') };
  },
};

/** Folders look like chromium-1140, firefox-1466: keeps the highest revision of each browser. */
const playwright: CleanupRule = {
  id: 'playwright',
  name: 'Old Playwright browsers',
  category: 'developer',
  safety: 'safe',
  explain: 'Browser builds Playwright downloaded for older versions. The newest of each browser is kept.',
  roots: (ctx) => [playwrightCache(ctx)],
  async scan(ctx) {
    const dir = playwrightCache(ctx);
    const byBrowser = new Map<string, string[]>();
    for (const name of await list(dir)) {
      if (name.startsWith('.') || name.startsWith('__') || !name.includes('-')) continue;
      const browser = name.slice(0, name.lastIndexOf('-'));
      byBrowser.set(browser, [...(byBrowser.get(browser) ?? []), name]);
    }
    const targets = [...byBrowser.values()].flatMap((names) => names.sort(compareVersions).slice(0, -1));
    return { targets: joinAll(dir, targets), detail: tilde(ctx.home, dir) };
  },
};

const mongoLog: CleanupRule = {
  id: 'mongodb-log',
  name: 'MongoDB log',
  category: 'developer',
  safety: 'safe',
  explain: 'The MongoDB server log. It’s emptied in place, so a running MongoDB keeps working.',
  roots: (ctx) => [path.join(brewLogs(ctx), 'mongodb')],
  async scan(ctx) {
    const dir = path.join(brewLogs(ctx), 'mongodb');
    const log = path.join(dir, 'mongo.log');
    const rotated = (await list(dir)).filter((f) => f.startsWith('mongo.log.'));
    return { truncate: (await exists(log)) ? [log] : [], targets: joinAll(dir, rotated), detail: tilde(ctx.home, dir) };
  },
};

/** *.log files of Homebrew services (Postgres, Redis…) are emptied; rotated copies deleted. */
const serviceLogs: CleanupRule = {
  id: 'service-logs',
  name: 'Homebrew service logs',
  category: 'developer',
  safety: 'safe',
  explain: 'Logs written by databases and services you run with Homebrew. Active logs are emptied in place.',
  roots: (ctx) => [brewLogs(ctx)],
  async scan(ctx) {
    const root = brewLogs(ctx);
    const truncate: string[] = [];
    const targets: string[] = [];
    const sort = (file: string) => {
      if (file.endsWith('.log')) truncate.push(file);
      else if (/\.log\.\d+(\.gz)?$|\.log\.gz$/.test(file)) targets.push(file);
    };
    for (const entry of await list(root)) {
      if (entry === 'mongodb') continue;
      const p = path.join(root, entry);
      const info = await stat(p).catch(() => null);
      if (info?.isDirectory()) for (const file of await list(p)) sort(path.join(p, file));
      else if (info?.isFile()) sort(p);
    }
    return { truncate, targets, detail: root };
  },
};

/** Keeps the newest version of each major plus the default alias; globals go with a removed version. */
const nvm: CleanupRule = {
  id: 'nvm',
  name: 'Old Node.js versions',
  category: 'developer',
  safety: 'review',
  explain:
    'Older Node.js versions installed with nvm. The newest of each major version and your default are kept. Global packages installed under a removed version go with it.',
  roots: (ctx) => [nvmVersions(ctx)],
  async scan(ctx) {
    const dir = nvmVersions(ctx);
    const versions = (await list(dir)).filter((v) => /^v\d+\.\d+\.\d+$/.test(v)).sort(compareVersions);
    const keep = new Set<string>();
    const byMajor = new Map<string, string>();
    for (const v of versions) byMajor.set(v.split('.')[0], v);
    byMajor.forEach((v) => keep.add(v));
    const alias = (await readFile(homePath(ctx, '.nvm', 'alias', 'default'), 'utf8').catch(() => '')).trim();
    const prefix = alias.startsWith('v') ? alias : `v${alias}`;
    const defaultVersion = [...versions].reverse().find((v) => v === prefix || v.startsWith(`${prefix}.`));
    if (defaultVersion) keep.add(defaultVersion);
    const targets = joinAll(dir, versions.filter((v) => !keep.has(v)));
    return { targets, detail: `${tilde(ctx.home, dir)} · keeps ${[...keep].sort(compareVersions).join(', ') || 'all'}` };
  },
};

const PROJECT_FOLDERS = ['Documents', 'Desktop', 'Developer', 'Projects', 'code', 'dev', 'src', 'repos', 'workspace', 'GitHub'];
const STALE_DAYS = 60;

async function lastActive(project: string): Promise<number> {
  const probes = ['', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.git/index'];
  const times = await Promise.all(probes.map((p) => stat(path.join(project, p)).then((s) => s.mtimeMs, () => 0)));
  return Math.max(...times);
}

const staleNodeModules: CleanupRule = {
  id: 'node-modules',
  name: 'node_modules in old projects',
  category: 'developer',
  safety: 'review',
  explain: `Dependencies of projects you haven’t touched in ${STALE_DAYS} days. Run npm install in a project to bring them back.`,
  allowNodeModules: true,
  roots: (ctx) => PROJECT_FOLDERS.map((f) => homePath(ctx, f)),
  async scan(ctx) {
    // macOS folders are case-insensitive, so "Projects" and "projects" can be the same place.
    const roots = new Map<string, string>();
    for (const root of PROJECT_FOLDERS.map((f) => homePath(ctx, f))) {
      if (await exists(root)) roots.set(root.toLowerCase(), root);
    }
    const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    const targets: string[] = [];
    for (const root of roots.values()) {
      const found = await exec('find', [
        root, '-maxdepth', '6',
        '(', '-name', '.git', '-o', '-name', 'Library', '-o', '-name', '.Trash', ')', '-prune',
        '-o', '-type', 'd', '-name', 'node_modules', '-prune', '-print',
      ]);
      for (const dir of found.stdout.split('\n').filter(Boolean)) {
        if ((await lastActive(path.dirname(dir))) < cutoff) targets.push(dir);
      }
    }
    return { targets, detail: `${targets.length} project${targets.length === 1 ? '' : 's'} untouched for ${STALE_DAYS}+ days` };
  },
};

/** Docker reports sizes like "2.09GB" in powers of 1000. */
export function parseDockerSize(text: string): number {
  const match = /^([\d.]+)\s*([kKMGT]?B)/.exec(text.trim());
  if (!match) return 0;
  const power = { B: 0, kB: 1, KB: 1, MB: 2, GB: 3, TB: 4 }[match[2]] ?? 0;
  return Math.round(parseFloat(match[1]) * 1000 ** power);
}

const docker: CleanupRule = {
  id: 'docker',
  name: 'Docker build cache & dangling images',
  category: 'developer',
  safety: 'review',
  explain:
    'Untagged images and build cache. Images used by containers and all volumes are never touched. Docker’s virtual disk may give the space back gradually.',
  roots: () => [],
  async scan(ctx) {
    if (!ctx.external) return { targets: [], size: 0, detail: 'Docker' };
    const df = await exec('docker', ['system', 'df', '--format', '{{json .}}'], 15_000);
    if (!df.ok) return { targets: [], size: 0, detail: 'Docker isn’t running' };
    const rows = df.stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line) as { Type: string; Reclaimable: string });
    const buildCache = parseDockerSize(rows.find((r) => r.Type === 'Build Cache')?.Reclaimable ?? '');
    const dangling = await exec('docker', ['images', '-f', 'dangling=true', '--format', '{{.Size}}'], 15_000);
    const images = dangling.stdout.split('\n').filter(Boolean).reduce((total, s) => total + parseDockerSize(s), 0);
    return { targets: [], size: buildCache + images, detail: 'docker image prune · docker builder prune' };
  },
  async clean() {
    await exec('docker', ['image', 'prune', '-f'], 120_000);
    await exec('docker', ['builder', 'prune', '-f'], 120_000);
    // Colima's disk only shrinks on the Mac once the VM trims freed blocks.
    await exec('colima', ['ssh', '--', 'sudo', 'fstrim', '-a'], 60_000);
  },
};

export const developerRules: CleanupRule[] = [
  contentsRule({
    id: 'npm',
    name: 'npm download cache',
    category: 'developer',
    explain: 'Packages npm has downloaded before. npm fetches them again when a project needs them.',
    dirs: (ctx) => [npmCache(ctx)],
  }),
  contentsRule({
    id: 'pnpm',
    name: 'pnpm store',
    category: 'developer',
    explain: 'pnpm’s shared package store. Installed projects keep working; the next install downloads what it needs.',
    dirs: (ctx) => [libPath(ctx, 'pnpm', 'store'), homePath(ctx, '.local', 'share', 'pnpm', 'store')],
  }),
  contentsRule({
    id: 'yarn',
    name: 'Yarn cache',
    category: 'developer',
    explain: 'Packages Yarn has downloaded, for both Yarn 1 and Yarn 2+.',
    dirs: (ctx) => [libPath(ctx, 'Caches', 'Yarn'), homePath(ctx, '.yarn', 'berry', 'cache'), homePath(ctx, '.yarn', 'berry', 'metadata')],
  }),
  uv,
  contentsRule({
    id: 'pip',
    name: 'pip cache',
    category: 'developer',
    explain: 'Python packages pip has downloaded before.',
    dirs: (ctx) => [libPath(ctx, 'Caches', 'pip')],
  }),
  puppeteer,
  playwright,
  contentsRule({
    id: 'node-gyp',
    name: 'node-gyp headers',
    category: 'developer',
    explain: 'Node.js headers used to compile native modules. Downloaded again when needed.',
    dirs: (ctx) => [libPath(ctx, 'Caches', 'node-gyp')],
  }),
  contentsRule({
    id: 'typescript',
    name: 'TypeScript type cache',
    category: 'developer',
    explain: 'Type definitions your editor downloaded automatically for JavaScript projects.',
    dirs: (ctx) => [libPath(ctx, 'Caches', 'typescript')],
  }),
  contentsRule({
    id: 'cocoapods',
    name: 'CocoaPods cache',
    category: 'developer',
    explain: 'Pods CocoaPods has downloaded before.',
    dirs: (ctx) => [libPath(ctx, 'Caches', 'CocoaPods')],
  }),
  contentsRule({
    id: 'gradle',
    name: 'Gradle cache',
    category: 'developer',
    explain: 'Dependencies and build outputs Gradle cached. The next build downloads what it needs.',
    dirs: (ctx) => [homePath(ctx, '.gradle', 'caches')],
  }),
  contentsRule({
    id: 'homebrew',
    name: 'Homebrew downloads',
    category: 'developer',
    explain: 'Installers Homebrew downloaded. Installed packages aren’t affected.',
    dirs: (ctx) => [libPath(ctx, 'Caches', 'Homebrew')],
  }),
  mongoLog,
  serviceLogs,
  nvm,
  staleNodeModules,
  docker,
];
