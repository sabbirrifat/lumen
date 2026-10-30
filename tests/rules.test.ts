import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanRules } from '~engine/cleaner';
import { RULES } from '~engine/rules';
import { parseDockerSize } from '~engine/rules/developer';
import { compareVersions } from '~engine/rules/helpers';
import { scanRule } from '~engine/scanner';
import { makeHome, MB } from './fixture';

const rule = (id: string) => {
  const found = RULES.find((r) => r.id === id);
  if (!found) throw new Error(`no rule ${id}`);
  return found;
};

describe('cleanup rules', () => {
  it('empties the npm cache but keeps the folder', async () => {
    const h = await makeHome();
    await h.file('.npm/_cacache/content-v2/a', 2 * MB);
    const ctx = await h.context();
    const { size, plan } = await scanRule(rule('npm'), ctx);
    expect(size).toBeGreaterThanOrEqual(2 * MB);
    expect(plan.targets).toEqual([h.at('.npm/_cacache/content-v2')]);
    const [outcome] = await cleanRules(ctx, [rule('npm')]);
    expect(outcome.freed).toBeGreaterThanOrEqual(2 * MB);
    expect(existsSync(h.at('.npm/_cacache'))).toBe(true);
    expect(existsSync(h.at('.npm/_cacache/content-v2'))).toBe(false);
  });

  it('keeps uv archives and links that a running tool uses', async () => {
    const h = await makeHome();
    await h.file('.cache/uv/archive-v0/inUse/lib.so');
    await h.file('.cache/uv/archive-v0/old/lib.so');
    await h.file('.cache/uv/wheels-v6/w.whl');
    await h.file('.cache/uv/CACHEDIR.TAG', 10);
    await h.link('.cache/uv/environments-v2/h/keep', '../../archive-v0/inUse');
    await h.link('.cache/uv/environments-v2/h/drop', '../../archive-v0/old');
    const ctx = await h.context({ commands: [`${h.home}/.cache/uv/archive-v0/inUse/bin/python server`] });
    const [outcome] = await cleanRules(ctx, [rule('uv')]);
    expect(outcome.error).toBeUndefined();
    expect(existsSync(h.at('.cache/uv/archive-v0/inUse/lib.so'))).toBe(true);
    expect(existsSync(h.at('.cache/uv/environments-v2/h/keep'))).toBe(true);
    expect(existsSync(h.at('.cache/uv/CACHEDIR.TAG'))).toBe(true);
    expect(existsSync(h.at('.cache/uv/archive-v0/old'))).toBe(false);
    expect(existsSync(h.at('.cache/uv/wheels-v6'))).toBe(false);
    expect(existsSync(h.at('.cache/uv/environments-v2/h/drop'))).toBe(false);
  });

  it('keeps the newest Puppeteer browser of each kind', async () => {
    const h = await makeHome();
    for (const v of ['chrome/mac-1045629', 'chrome/mac_arm-140.0.7339.82', 'chrome/mac_arm-149.0.7827.22', 'chrome-headless-shell/mac_arm-131.0.1', 'chrome-headless-shell/mac_arm-149.0.7827.22']) {
      await h.file(`.cache/puppeteer/${v}/bin`);
    }
    const ctx = await h.context();
    await cleanRules(ctx, [rule('puppeteer')]);
    expect(existsSync(h.at('.cache/puppeteer/chrome/mac_arm-149.0.7827.22'))).toBe(true);
    expect(existsSync(h.at('.cache/puppeteer/chrome-headless-shell/mac_arm-149.0.7827.22'))).toBe(true);
    expect(existsSync(h.at('.cache/puppeteer/chrome/mac-1045629'))).toBe(false);
    expect(existsSync(h.at('.cache/puppeteer/chrome/mac_arm-140.0.7339.82'))).toBe(false);
    expect(existsSync(h.at('.cache/puppeteer/chrome-headless-shell/mac_arm-131.0.1'))).toBe(false);
  });

  it('keeps the highest Playwright revision of each browser', async () => {
    const h = await makeHome();
    for (const v of ['chromium-1100', 'chromium-1140', 'firefox-1400', 'chromium_headless_shell-1140']) {
      await h.file(`Library/Caches/ms-playwright/${v}/bin`);
    }
    const ctx = await h.context();
    const { plan } = await scanRule(rule('playwright'), ctx);
    expect(plan.targets).toEqual([h.at('Library/Caches/ms-playwright/chromium-1100')]);
  });

  it('empties the MongoDB log in place and deletes rotated copies', async () => {
    const h = await makeHome();
    const log = await h.file(`${h.brew}/var/log/mongodb/mongo.log`, 3 * MB);
    const rotated = await h.file(`${h.brew}/var/log/mongodb/mongo.log.2026-10-28T07-49-14.gz`);
    const ctx = await h.context();
    const [outcome] = await cleanRules(ctx, [rule('mongodb-log')]);
    expect(outcome.freed).toBeGreaterThanOrEqual(3 * MB);
    expect(statSync(log).size).toBe(0);
    expect(existsSync(rotated)).toBe(false);
  });

  it('keeps the Hugging Face login token', async () => {
    const h = await makeHome();
    await h.file('.cache/huggingface/hub/models--x/blob', 2 * MB);
    await h.file('.cache/huggingface/token', 10, 'hf_secret');
    const ctx = await h.context();
    await cleanRules(ctx, [rule('huggingface')]);
    expect(existsSync(h.at('.cache/huggingface/hub'))).toBe(false);
    expect(existsSync(h.at('.cache/huggingface/token'))).toBe(true);
  });

  it('only removes Antigravity folders from ~/.gemini, and not while it runs', async () => {
    const h = await makeHome();
    await h.file('.gemini/antigravity/brain/x');
    await h.file('.gemini/oauth_creds.json', 10, '{}');
    const running = await h.context({ commands: ['/Applications/Antigravity IDE.app/Contents/MacOS/Antigravity'] });
    const [blocked] = await cleanRules(running, [rule('antigravity')]);
    expect(blocked.error).toMatch(/Quit Antigravity/);
    expect(existsSync(h.at('.gemini/antigravity'))).toBe(true);
    await cleanRules(await h.context(), [rule('antigravity')]);
    expect(existsSync(h.at('.gemini/antigravity'))).toBe(false);
    expect(existsSync(h.at('.gemini/oauth_creds.json'))).toBe(true);
  });

  it('leaves Chrome alone while it runs and never touches profile data', async () => {
    const h = await makeHome();
    await h.file('Library/Application Support/Google/Chrome/Default/Code Cache/js/a');
    await h.file('Library/Application Support/Google/Chrome/Default/History', MB);
    await h.file('Library/Caches/Google/Chrome/Default/Cache/data_1');
    const running = await h.context({ commands: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] });
    const [blocked] = await cleanRules(running, [rule('chrome')]);
    expect(blocked.error).toBe('Quit Google Chrome to clean');
    await cleanRules(await h.context(), [rule('chrome')]);
    expect(existsSync(h.at('Library/Application Support/Google/Chrome/Default/Code Cache'))).toBe(false);
    expect(existsSync(h.at('Library/Caches/Google/Chrome/Default/Cache'))).toBe(false);
    expect(existsSync(h.at('Library/Application Support/Google/Chrome/Default/History'))).toBe(true);
  });

  it('application caches skip claimed folders, Apple caches and running apps', async () => {
    const h = await makeHome();
    await h.file('Library/Caches/Yarn/v6/pkg');
    await h.file('Library/Caches/com.apple.Safari/x');
    await h.file('Library/Caches/com.spotify.client/data');
    await h.file('Library/Caches/ru.keepcoder.Telegram/media');
    const ctx = await h.context({ bundleIds: new Set(['ru.keepcoder.Telegram']) });
    const { plan } = await scanRule(rule('app-caches'), ctx);
    expect(plan.targets).toEqual([h.at('Library/Caches/com.spotify.client')]);
    expect(plan.detail).toMatch(/skips 1 running app/);
  });

  it('keeps the newest Node of each major plus the nvm default', async () => {
    const h = await makeHome();
    for (const v of ['v18.20.0', 'v20.10.0', 'v20.12.2', 'v22.1.0', 'v22.3.0']) await h.file(`.nvm/versions/node/${v}/bin/node`, 10);
    await h.file('.nvm/alias/default', 10, '22.1');
    const { plan } = await scanRule(rule('nvm'), await h.context());
    expect(plan.targets.map((t) => t.split('/').pop()).sort()).toEqual(['v20.10.0']);
  });

  it('finds node_modules only in projects untouched for 60 days', async () => {
    const h = await makeHome();
    await h.file('Documents/Projects/old/node_modules/pkg/index.js');
    await h.file('Documents/Projects/old/package.json', 10, '{}');
    await h.age('Documents/Projects/old/package.json', 120);
    await h.age('Documents/Projects/old', 120);
    await h.file('Documents/Projects/fresh/node_modules/pkg/index.js');
    await h.file('Documents/Projects/fresh/package.json', 10, '{}');
    const ctx = await h.context();
    const { plan } = await scanRule(rule('node-modules'), ctx);
    expect(plan.targets).toEqual([h.at('Documents/Projects/old/node_modules')]);
    await cleanRules(ctx, [rule('node-modules')]);
    expect(existsSync(h.at('Documents/Projects/old/node_modules'))).toBe(false);
    expect(existsSync(h.at('Documents/Projects/old/package.json'))).toBe(true);
    expect(existsSync(h.at('Documents/Projects/fresh/node_modules'))).toBe(true);
  });

  it('skips anything inside an excluded folder', async () => {
    const h = await makeHome();
    await h.file('.npm/_cacache/content-v2/a');
    await h.file('.npm/_cacache/index-v5/b');
    const ctx = await h.context({}, { excluded: [h.at('.npm/_cacache/index-v5')] });
    await cleanRules(ctx, [rule('npm')]);
    expect(existsSync(h.at('.npm/_cacache/index-v5/b'))).toBe(true);
    expect(existsSync(h.at('.npm/_cacache/content-v2'))).toBe(false);
  });

  it('every rule cleans a full fixture without touching personal files', async () => {
    const h = await makeHome();
    const keep = [
      await h.file('Documents/thesis.pdf'),
      await h.file('Desktop/photo.jpg'),
      await h.file('Library/Application Support/Google/Chrome/Default/Bookmarks'),
      await h.file('.cache/huggingface/token', 10, 'tok'),
    ];
    await h.file('.npm/_cacache/x', 2 * MB);
    await h.file('Library/Caches/com.example.app/x', 2 * MB);
    await h.file('Library/Logs/app.log', 2 * MB);
    await h.file('Library/Developer/Xcode/DerivedData/Proj-abc/x', 2 * MB);
    const ctx = await h.context();
    const outcomes = await cleanRules(ctx, RULES);
    expect(outcomes.reduce((t, o) => t + o.freed, 0)).toBeGreaterThanOrEqual(8 * MB);
    for (const file of keep) expect(existsSync(file)).toBe(true);
  });
});

describe('helpers', () => {
  it('orders versions oldest first, bare revisions before dotted versions', () => {
    expect(['mac_arm-149.0.1', 'mac-1045629', 'mac_arm-140.0.9'].sort(compareVersions)).toEqual([
      'mac-1045629',
      'mac_arm-140.0.9',
      'mac_arm-149.0.1',
    ]);
  });

  it('parses Docker sizes in powers of 1000', () => {
    expect(parseDockerSize('2.09GB')).toBe(2_090_000_000);
    expect(parseDockerSize('58.7MB (99%)')).toBe(58_700_000);
    expect(parseDockerSize('0B')).toBe(0);
  });
});
