import path from 'node:path';
import type { EngineContext } from '../context';
import { list } from '../fsutil';
import { libPath, pathsRule } from './helpers';
import type { CleanupRule } from './types';

const PROFILE = /^(Default|Profile \d+|Guest Profile|System Profile)$/;
const PROFILE_CACHES = ['Code Cache', 'GPUCache', 'Service Worker/CacheStorage', 'Service Worker/ScriptCache', 'DawnGraphiteCache', 'DawnWebGPUCache'];
const BROWSER_CACHES = ['GrShaderCache', 'ShaderCache', 'GraphiteDawnCache', 'component_crx_cache'];

/** Chromium browsers: only cache folders per profile, never cookies, history or passwords. */
function chromiumBrowser(id: string, app: string, dataDir: string): CleanupRule {
  const support = (ctx: EngineContext) => libPath(ctx, 'Application Support', dataDir);
  const caches = (ctx: EngineContext) => libPath(ctx, 'Caches', dataDir);
  return pathsRule({
    id,
    name: `${app} cache`,
    category: 'apps',
    app,
    explain: `Web page caches for every ${app} profile. Cookies, history, passwords and tabs stay.`,
    roots: (ctx) => [support(ctx), caches(ctx)],
    async paths(ctx) {
      const profiles = (await list(support(ctx))).filter((name) => PROFILE.test(name));
      const cacheProfiles = (await list(caches(ctx))).filter((name) => PROFILE.test(name));
      return [
        ...BROWSER_CACHES.map((name) => path.join(support(ctx), name)),
        ...profiles.flatMap((p) => PROFILE_CACHES.map((name) => path.join(support(ctx), p, name))),
        ...cacheProfiles.flatMap((p) => ['Cache', 'Code Cache'].map((name) => path.join(caches(ctx), p, name))),
      ];
    },
  });
}

const ELECTRON_CACHES = ['Cache', 'CachedData', 'CachedExtensionVSIXs', 'Code Cache', 'GPUCache', 'logs', 'Service Worker/CacheStorage', 'DawnGraphiteCache', 'DawnWebGPUCache'];

/** Electron apps keep Chromium-style caches next to their data. */
function electronApp(id: string, name: string, app: string, dataDirs: string[]): CleanupRule {
  const dirs = (ctx: EngineContext) => dataDirs.map((d) => libPath(ctx, d));
  return pathsRule({
    id,
    name: `${name} cache`,
    category: 'apps',
    app,
    explain: `Caches and logs ${name} rebuilds on its own. Settings, sign-ins and workspaces stay.`,
    roots: dirs,
    paths: async (ctx) => dirs(ctx).flatMap((dir) => ELECTRON_CACHES.map((c) => path.join(dir, c))),
  });
}

export const appRules: CleanupRule[] = [
  chromiumBrowser('chrome', 'Google Chrome', 'Google/Chrome'),
  chromiumBrowser('edge', 'Microsoft Edge', 'Microsoft Edge'),
  chromiumBrowser('brave', 'Brave Browser', 'BraveSoftware/Brave-Browser'),
  electronApp('vscode', 'VS Code', 'Visual Studio Code', ['Application Support/Code']),
  electronApp('cursor', 'Cursor', 'Cursor', ['Application Support/Cursor']),
  electronApp('windsurf', 'Windsurf', 'Windsurf', ['Application Support/Windsurf']),
  electronApp('slack', 'Slack', 'Slack', [
    'Application Support/Slack',
    'Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack',
  ]),
  electronApp('discord', 'Discord', 'Discord', ['Application Support/discord']),
];
