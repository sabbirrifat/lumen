# Contributing to Lumen

Thanks for helping make Lumen better! Bug reports, cleanup-rule ideas, code, design and docs are all welcome. This guide explains how to get set up and what a good pull request looks like.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug.** Open a [bug report](https://github.com/sabbirrifat/lumen/issues/new?template=bug_report.yml) with your macOS version and steps to reproduce.
- **Suggest a cleanup rule.** Know a tool that leaves gigabytes behind? Use the [cleanup rule template](https://github.com/sabbirrifat/lumen/issues/new?template=cleanup_rule.yml).
- **Pick up an issue.** [Good first issues](https://github.com/sabbirrifat/lumen/labels/good%20first%20issue) are small and well described. Comment on one so others know you're on it.
- **Ask or share ideas** in [Discussions](https://github.com/sabbirrifat/lumen/discussions).

## Getting set up

You need macOS, [Node.js](https://nodejs.org) 24 (see `.nvmrc`) and npm.

```bash
git clone https://github.com/<you>/lumen.git
cd lumen
npm ci
npm run dev
```

Everything you need day to day:

| Command | What it does |
|---|---|
| `npm run dev` | Run the app with hot reload |
| `npm test` | Engine tests on generated fake home folders. Safe to run anytime |
| `npm run test:e2e` | Build and drive the real app against a fixture home, saving screenshots to `test-results/screens/` |
| `npm run dry-run` | Scan your real home and print what each rule would free. Read-only |
| `npm run typecheck` | TypeScript for the main process, preload and renderer |
| `npm run lint` | ESLint |

## How the code is organised

- `src/shared/types.ts`: the IPC contract. Main, preload and renderer all import it, so change it first when adding an API.
- `src/main/engine/`: pure Node with no Electron imports, which is what lets Vitest test it directly.
  - `rules/`: one `CleanupRule` per thing to clean, grouped by category.
  - `scanner.ts` measures rules; `cleaner.ts` re-scans each one and sends every path through `guard.ts` before deleting.
  - `spaceLens.ts`, `largeFiles.ts`, `uninstaller.ts`: the other features.
- `src/main/ipc.ts`: the only place the engine meets Electron (Trash, dialogs, icons).
- `src/renderer/src/`: the React app. State lives in `store/`, sounds in `lib/sound.ts`, the 3D orb in `components/three/Orb`.

## Adding a cleanup rule

Most rules take a few lines. Say a tool keeps a cache in `~/.cache/example` that is safe to delete:

1. Add the rule to the file for its category in `src/main/engine/rules/`: `system.ts`, `apps.ts` (browsers and apps), `files.ts` (Downloads and Trash), `devices.ts` (iPhone and iPad), `developer.ts`, `xcode.ts` or `ai.ts`:

   ```ts
   contentsRule({
     id: 'example',
     name: 'Example cache',
     category: 'developer',
     explain: 'Packages Example downloaded before. It fetches them again when needed.',
     dirs: (ctx) => [homePath(ctx, '.cache', 'example')],
   }),
   ```

   - `contentsRule` deletes everything inside the folders and keeps the folders. `pathsRule` deletes specific sub-folders. For anything smarter (keep the newest version, skip files in use), write a full `CleanupRule`; `puppeteer` and `uv` in `developer.ts` are good examples.
   - Set `safety: 'review'` if deleting it costs the user something: a slow re-download, lost history, or a choice only they can make.
   - Set `app: 'App Name'` when the files belong to an app, so the rule is blocked while that app runs.
   - Set `toTrash: true` when the targets are the user's own files rather than a cache (installers, backups, documents). They'll always be moved to the Trash, never deleted.
   - Write `explain` for a non-developer: what it is, and what happens after it's gone.

2. Add a test in `tests/rules.test.ts` (developer rules) or `tests/everyday.test.ts` (everything else) that builds a fake home, cleans the rule, and checks that the right files are gone **and** that anything that should survive still exists. For `toTrash` rules, pass a fake `moveToTrash` and check the files arrived there.
3. Run `npm run dry-run` to see what your rule finds on your own Mac.
4. Add it to the table in the README.

## Safety rules

Lumen deletes files, so these rules are non-negotiable. A PR that loosens one needs a very good reason and a test that proves it's still safe.

- Every deletion goes through `assertDeletable` (cache rules) or `assertTrashable` (files the user picked) in `guard.ts`. Never call `rm`, `fs.rm` or `shell.trashItem` on a path that skipped the guard.
- A rule's `roots` must be as narrow as possible. Targets must sit strictly inside them.
- Never touch personal data: Documents, Desktop, Photos, Mail, Messages, iCloud Drive, Keychains, cookies, browser history or passwords.
- Files the user chooses, and rules over the user's own files (`toTrash`), go to the Trash. Only regenerable caches are deleted outright.
- Don't clean files an app is using: set `app`, or detect in-use files like the `uv` rule does.
- Tests must only ever touch generated fixtures. With `LUMEN_HOME` set, `ctx.external` is false and rules must not call tools that change real state, such as `docker` or `simctl`.

## Code style

- TypeScript in strict mode; no `any` without a comment explaining why.
- Cross-folder imports use the aliases (`~shared`, `~engine`, `~components`, `~pages`, `~lib`, `~hooks`, `~styles`, `~store`), never `../`.
- One folder per component or page: `index.tsx` plus `Name.module.css`. Colours, radii and fonts come from `styles/theme.css`.
- Sizes are shown in powers of 1000, like Finder.
- Comments explain *why*, not *what*.
- Prefer the platform and existing dependencies over adding new ones.

## Pull requests

1. Fork the repo and create a branch from `main` (for example `rule/bun-cache` or `fix/space-lens-scroll`).
2. Keep the PR focused on one change.
3. Make sure `npm run typecheck`, `npm run lint` and `npm test` pass. For UI changes, also run `npm run test:e2e` and attach a screenshot.
4. Write commit messages in the imperative: "Add Bun cache rule", not "Added…".
5. Fill in the pull request template. CI runs the same checks on macOS.

A maintainer will review as soon as they can. Thanks for contributing!
