import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { EngineContext } from './context';

export class GuardError extends Error {
  constructor(
    readonly target: string,
    reason: string,
  ) {
    super(`${target}: ${reason}`);
  }
}

/** Personal data that cleanup rules never delete from (relative to home). */
const DENIED = [
  'Documents',
  'Desktop',
  'Pictures',
  'Movies',
  'Music',
  'Library/Mobile Documents',
  'Library/CloudStorage',
  'Library/Keychains',
  'Library/Mail',
  'Library/Messages',
  'Library/Photos',
];

/** Top-level folders macOS owns; they can't be trashed themselves. */
const STANDARD_FOLDERS = ['Applications', 'Desktop', 'Documents', 'Downloads', 'Library', 'Movies', 'Music', 'Pictures', 'Public'];

const isInside = (child: string, parent: string) => child.startsWith(parent + path.sep);
const isInsideOrSame = (child: string, parent: string) => child === parent || isInside(child, parent);

function assertCleanPath(target: string, ctx: EngineContext) {
  if (!path.isAbsolute(target) || path.normalize(target) !== target || target.endsWith(path.sep)) {
    throw new GuardError(target, 'not a clean absolute path');
  }
  if (isInsideOrSame(ctx.home, target)) throw new GuardError(target, 'is your home folder or above it');
  if (ctx.excluded.some((dir) => isInsideOrSame(target, dir))) throw new GuardError(target, 'excluded in Settings');
}

/** A symlinked parent could point anywhere, so the real parent must still be inside the real root. */
async function assertRealParentInside(target: string, root: string) {
  let realParent: string;
  let realRoot: string;
  try {
    [realParent, realRoot] = await Promise.all([realpath(path.dirname(target)), realpath(root)]);
  } catch {
    throw new GuardError(target, 'its folder no longer exists');
  }
  if (!isInsideOrSame(realParent, realRoot)) throw new GuardError(target, 'is reached through a symlink');
}

export interface DeleteOptions {
  /** Folders the rule declared; targets must sit strictly inside one of them. */
  roots: string[];
  /** Lets the stale node_modules rule reach into ~/Documents and ~/Desktop, for node_modules only. */
  allowNodeModules?: boolean;
}

/** Throws unless a cleanup rule may permanently delete `target`. */
export async function assertDeletable(target: string, ctx: EngineContext, opts: DeleteOptions): Promise<void> {
  assertCleanPath(target, ctx);
  const root = opts.roots.find((r) => isInside(target, r) && r !== '/' && !isInsideOrSame(ctx.home, r));
  if (!root) throw new GuardError(target, 'is outside the folders this rule may clean');
  const denied = DENIED.some((d) => isInsideOrSame(target, path.join(ctx.home, d)));
  if (denied && !(opts.allowNodeModules && path.basename(target) === 'node_modules')) {
    throw new GuardError(target, 'is inside a protected personal folder');
  }
  await assertRealParentInside(target, root);
}

/**
 * Throws unless a user-chosen item may go to the Trash. It must sit inside one of `roots`
 * (by default the home folder, outside ~/Library), and can't be a standard macOS folder.
 */
export async function assertTrashable(target: string, ctx: EngineContext, roots?: string[]): Promise<void> {
  assertCleanPath(target, ctx);
  const allowed = roots ?? [ctx.home];
  const root = allowed.find((r) => isInside(target, r));
  if (!root) throw new GuardError(target, 'is outside the folders Lumen may move to the Trash');
  if (!roots && isInsideOrSame(target, path.join(ctx.home, 'Library'))) {
    throw new GuardError(target, 'is inside ~/Library; use Cleanup or the Uninstaller for app files');
  }
  if (STANDARD_FOLDERS.some((name) => target === path.join(ctx.home, name))) {
    throw new GuardError(target, 'is a standard macOS folder');
  }
  await assertRealParentInside(target, root);
}
