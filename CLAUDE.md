# Lumen

A Mac cleaner: Electron 45 + React 19 + TypeScript 6, built with electron-vite. Personal, unsigned arm64 build.

## Commands

- `npm run dev` — run the app with hot reload
- `npm test` — engine tests (Vitest) on generated fake home folders; never touches real files
- `npm run test:e2e` — builds, launches the real app against a fixture home (`LUMEN_HOME`), scans, cleans, and screenshots every page into `test-results/screens/`
- `npm run dry-run` — scans your real home and prints what each rule would free. Read-only
- `npm run typecheck`, `npm run lint` — both must pass clean
- `npm run build:mac` — `dist/mac-arm64/Lumen.app` and a DMG
- `npm run icon` — re-render `build/icon.svg` into `build/icon.icns`

## Layout

- `src/shared/types.ts` — the IPC contract (`LumenApi`, events). Main, preload and renderer all import it.
- `src/main/engine/` — pure Node, no Electron imports, so Vitest can test it directly.
  - `rules/` — one `CleanupRule` per thing to clean, grouped by category. `contentsRule` / `pathsRule` in `helpers.ts` cover most cases.
  - `scanner.ts` → `cleaner.ts`: a clean re-scans each rule first, then sends every path through `guard.ts`.
  - `spaceLens.ts`, `largeFiles.ts`, `uninstaller.ts` — the other features.
- `src/main/ipc.ts` — the only place engine meets Electron (`shell.trashItem`, dialogs, icons).
- `src/renderer/src/` — React. Zustand store in `store/`, Web Audio sounds in `lib/sound.ts`, 3D orb in `components/three/Orb`.

## Conventions

- Cross-folder imports use aliases (`~shared`, `~engine`, `~components`, `~pages`, `~lib`, `~hooks`, `~styles`, `~store`), never `../`.
- One folder per component/page: `index.tsx` + `Name.module.css`. Tokens live in `styles/theme.css`.
- Sizes are shown in powers of 1000, like Finder.

## Safety rules (don't loosen without a test)

- Every deletion goes through `assertDeletable` (cache rules) or `assertTrashable` (user files). Targets must sit strictly inside a rule's declared `roots`, never at or above home, never in a personal folder (`DENIED`), never through a symlinked parent.
- Caches are deleted; user-chosen files (Large & Old Files, Space Lens, Uninstaller) always go to the Trash.
- Rules for an app are blocked while it runs. The uv rule keeps archives that running processes use.
- With `LUMEN_HOME` set, `ctx.external` is false: rules must not call tools that act on real state (docker, simctl).

## Look

The orb canvas is opaque black and `mix-blend-mode: screen`ed onto the page, so nothing between it and the backdrop may create a stacking context (no z-index, filter, or opacity < 1 on its ancestors). The window background is opaque for the same reason.
