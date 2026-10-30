<p align="center">
  <img src="build/icon.png" width="128" height="128" alt="Lumen icon" />
</p>

<h1 align="center">Lumen</h1>

<p align="center">
  <strong>A calm, thorough, open-source cleaner for your Mac, built with developers in mind.</strong><br />
  Finds the gigabytes other cleaners miss: package caches, old browser builds, simulators, model downloads and runaway logs.
</p>

<p align="center">
  <a href="https://github.com/sabbirrifat/lumen/actions/workflows/ci.yml"><img src="https://github.com/sabbirrifat/lumen/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/sabbirrifat/lumen/releases/latest"><img src="https://img.shields.io/github/v/release/sabbirrifat/lumen?color=8b7bff" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-4fe3c1" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20(Apple%20silicon)-lightgrey" alt="macOS" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-ff7ab6" alt="PRs welcome" /></a>
</p>

<p align="center">
  <img src="docs/screenshots/smart-scan.jpg" width="820" alt="Lumen's Smart Scan screen with a glowing 3D orb" />
</p>

## Why Lumen

Most Mac cleaners look at browser caches and system logs, then stop. If you write code, that's the small stuff. The big wins hide in places like these:

- 30 GB of npm downloads you'll never need again
- 10 GB of Python wheels and `uvx` tool environments
- Ten old Chrome builds that Puppeteer downloaded over the years
- A MongoDB log that has been growing for a year with no rotation
- Simulators from an Xcode you uninstalled long ago

Lumen knows where these live, measures them, explains each one in plain language, and only pre-selects what's safe. It is free, MIT-licensed, makes no network requests, and needs no account.

## Features

| | |
|---|---|
| **Smart Scan** | One click checks 37 known locations in seconds, with live progress and a 3D orb that reacts as it works. |
| **Cleanup** | Every finding is grouped, sized and explained. Safe items are ticked; anything that needs judgment is marked **Review**. |
| **Space Lens** | An interactive sunburst of your home folder. Click a ring to go inside, the center to go back up. |
| **Large & Old Files** | Big files you haven't opened in months, filtered by size, age and kind, with Quick Look. They go to the Trash, never straight to deletion. |
| **Uninstaller** | Removes an app along with the caches, preferences and support files it leaves in `~/Library`. |
| **History** | A record of everything Lumen cleaned and how much space it freed. |

<p align="center">
  <img src="docs/screenshots/cleanup.jpg" width="49%" alt="Cleanup page grouping findings by category" />
  <img src="docs/screenshots/space-lens.jpg" width="49%" alt="Space Lens sunburst of the home folder" />
  <img src="docs/screenshots/large-files.jpg" width="49%" alt="Large and Old Files list" />
  <img src="docs/screenshots/uninstaller.jpg" width="49%" alt="Uninstaller with leftover files" />
</p>

## What Lumen cleans

Items marked ✓ are pre-selected after a scan. **Review** items are listed but left for you to decide.

| Category | What | Default |
|---|---|---|
| **Developer tools** | npm cache · pnpm store · Yarn 1 + Berry caches · pip cache · uv cache (keeps environments a running tool uses) | ✓ |
| | Old Puppeteer and Playwright browsers (keeps the newest of each) | ✓ |
| | node-gyp headers · TypeScript type cache · CocoaPods · Gradle · Homebrew downloads | ✓ |
| | MongoDB log (emptied in place, safe while it runs) · Homebrew service logs | ✓ |
| | Old Node.js versions from nvm (keeps the newest of each major and your default) | Review |
| | `node_modules` in projects untouched for 60+ days | Review |
| | Docker dangling images and build cache (volumes are never touched) | Review |
| **Xcode & simulators** | DerivedData · simulator caches | ✓ |
| | Device support files · archives · simulator devices | Review |
| **App caches** | Chrome, Edge and Brave caches (never cookies, history or passwords) | ✓ |
| | VS Code, Cursor, Windsurf, Slack and Discord caches | ✓ |
| **System junk** | Application caches in `~/Library/Caches` · app logs · crash reports | ✓ |
| | Trash | Review |
| **AI tools** | Hugging Face models (keeps your login token) · Ollama models · Antigravity data | Review |

Every rule lives in [`src/main/engine/rules`](src/main/engine/rules). Adding one is a great first contribution: see [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-cleanup-rule).

## Safety first

Deleting files is the one thing a cleaner must never get wrong, so Lumen is built defensively and the rules below are covered by tests:

- **Every deletion is checked by a guard.** A path must sit strictly inside the folders its rule declared. It can never be your home folder or anything above it, never inside Documents, Desktop, Pictures, Movies, Music, iCloud Drive, Mail, Messages or Keychains, and never reached through a symlink that points elsewhere.
- **Apps are left alone while they run.** If Chrome is open, Lumen tells you to quit it instead of pulling its cache out from under it.
- **Files you choose go to the Trash.** Large files, Space Lens items and uninstalled apps are moved to the Trash, so you can put them back.
- **Each rule is re-checked right before cleaning**, in case something changed since the scan.
- **Nothing leaves your Mac.** Lumen makes no network requests and collects no data.

Lumen is provided as-is, without warranty (see [LICENSE](LICENSE)). Review what you clean, especially items marked Review.

## Install

1. Download the latest `Lumen-x.y.z-arm64.dmg` from [Releases](https://github.com/sabbirrifat/lumen/releases/latest).
2. Open it and drag **Lumen** into **Applications**.
3. The first time you open it, macOS will block it because Lumen isn't notarized (that needs a paid Apple Developer account). Go to **System Settings → Privacy & Security** and click **Open Anyway**. Or run:

   ```bash
   xattr -dr com.apple.quarantine /Applications/Lumen.app
   ```

4. Optional: give Lumen **Full Disk Access** (System Settings → Privacy & Security → Full Disk Access) so it can also measure the Trash and app containers. The first launch walks you through it.

Requires macOS 13 Ventura or later on Apple silicon. Intel Macs can [build from source](#build-from-source) for now; an Intel/universal build is a welcome contribution.

## Build from source

You need [Node.js](https://nodejs.org) 24 and npm.

```bash
git clone https://github.com/sabbirrifat/lumen.git
cd lumen
npm ci
npm run dev        # run with hot reload
npm run build:mac  # build dist/mac-arm64/Lumen.app and a DMG
```

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Run the app with hot reload |
| `npm test` | Engine tests (Vitest) on generated fake home folders. Never touches your real files |
| `npm run test:e2e` | Builds the app, launches it against a fixture home, scans, cleans and screenshots every page |
| `npm run dry-run` | Scans your real home folder and prints what each rule would free. Read-only |
| `npm run typecheck` / `npm run lint` | Both must pass before a PR |
| `npm run build:mac` | Unsigned arm64 `.app` and DMG in `dist/` |

**Stack:** Electron, React 19, TypeScript, electron-vite, Zustand, Motion, React Three Fiber with a custom GLSL shader, and the Web Audio API for sounds (synthesized, no audio files).

```
src/
├── shared/types.ts      IPC contract shared by every process
├── main/
│   ├── engine/          Pure Node: rules, scanner, cleaner, guard, Space Lens, uninstaller
│   └── ipc.ts           Where the engine meets Electron
├── preload/             Exposes a typed window.lumen API
└── renderer/src/        React UI: pages, components, 3D orb, sounds
```

## Contributing

Contributions of every size are welcome: a new cleanup rule, a bug report, a design idea, or a typo fix. Start with [CONTRIBUTING.md](CONTRIBUTING.md), then look at the [good first issues](https://github.com/sabbirrifat/lumen/labels/good%20first%20issue). Questions and ideas go in [Discussions](https://github.com/sabbirrifat/lumen/discussions).

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Acknowledgements

- 3D simplex noise by Ian McEwan and Ashima Arts ([webgl-noise](https://github.com/ashima/webgl-noise), MIT)
- [Inter](https://fonts.google.com/specimen/Inter) and [Sora](https://fonts.google.com/specimen/Sora) typefaces (SIL Open Font License)

## License

[MIT](LICENSE) © 2026 Sabbir Rifat and Lumen contributors. Free to use, modify and share.
