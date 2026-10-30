import { exec } from '../exec';
import { joinAll, list, removePaths, tilde } from '../fsutil';
import { contentsRule, libPath } from './helpers';
import type { CleanupRule } from './types';

const simulators: CleanupRule = {
  id: 'simulators',
  name: 'iOS simulator devices',
  category: 'developer',
  safety: 'review',
  explain: 'Every simulator device and the apps and data inside it. Xcode creates fresh ones when you need them.',
  roots: (ctx) => [libPath(ctx, 'Developer', 'CoreSimulator', 'Devices')],
  async scan(ctx) {
    const dir = libPath(ctx, 'Developer', 'CoreSimulator', 'Devices');
    const targets = joinAll(dir, (await list(dir)).filter((f) => f !== 'device_set.plist'));
    return { targets, detail: tilde(ctx.home, dir) + (ctx.simctl ? '' : ' · Xcode not installed') };
  },
  async clean(plan, ctx) {
    // With Xcode installed, simctl keeps its device list consistent.
    if (!ctx.simctl) return removePaths(plan.targets);
    await exec('xcrun', ['simctl', 'shutdown', 'all'], 60_000);
    await exec('xcrun', ['simctl', 'delete', 'all'], 120_000);
  },
};

export const xcodeRules: CleanupRule[] = [
  contentsRule({
    id: 'derived-data',
    name: 'Xcode DerivedData',
    category: 'developer',
    app: 'Xcode',
    explain: 'Build products and indexes. Xcode rebuilds them the next time you open a project.',
    dirs: (ctx) => [libPath(ctx, 'Developer', 'Xcode', 'DerivedData')],
  }),
  contentsRule({
    id: 'device-support',
    name: 'Device support files',
    category: 'developer',
    safety: 'review',
    app: 'Xcode',
    explain: 'Debug symbols copied from devices you’ve connected. Xcode copies them again (slowly) next time.',
    dirs: (ctx) =>
      ['iOS', 'watchOS', 'tvOS', 'visionOS'].map((os) => libPath(ctx, 'Developer', 'Xcode', `${os} DeviceSupport`)),
  }),
  contentsRule({
    id: 'xcode-archives',
    name: 'Xcode archives',
    category: 'developer',
    safety: 'review',
    app: 'Xcode',
    explain: 'Builds you archived for release. Keep the ones you need to symbolicate crash reports.',
    dirs: (ctx) => [libPath(ctx, 'Developer', 'Xcode', 'Archives')],
  }),
  simulators,
  contentsRule({
    id: 'simulator-caches',
    name: 'Simulator caches',
    category: 'developer',
    explain: 'Caches the simulator runtime builds up. Rebuilt automatically.',
    dirs: (ctx) => [libPath(ctx, 'Developer', 'CoreSimulator', 'Caches')],
  }),
];
