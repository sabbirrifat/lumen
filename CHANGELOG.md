# Changelog

All notable changes to Lumen are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Lumen now covers everyday Macs, not just developer machines: 14 new rules, 51 in all.

### Added

- **Browsers & apps:** Safari, Firefox, Arc and Vivaldi caches; Microsoft Teams, Notion, Figma and Obsidian caches; copies of Mail attachments.
- **Downloads & Trash:** installers in Downloads older than a week, and downloads that stopped partway.
- **iPhone & iPad:** device backups, labelled with the device name and backup date, and downloaded software updates.
- **Leftovers from deleted apps:** containers, saved state and web data of apps that are no longer installed. Anything from a developer with an app still installed, and anything of Apple's, is kept.
- Rules for your own files (installers, backups, leftovers) always move them to the Trash. The finished screen shows how much went to the Trash separately from what was freed.
- A notice explaining that Safari, Mail, iPhone backups and the Trash need Full Disk Access.

### Changed

- Findings are grouped into six categories, everyday ones first: System junk, Browsers & apps, Downloads & Trash, iPhone & iPad, Developer tools (now including Xcode) and AI tools.

### Fixed

- Apps whose `Info.plist` contains dates or binary data are no longer skipped by the Uninstaller.

## [0.1.0] - 2026-10-30

The first public release.

### Added

- **Smart Scan** with 37 cleanup rules across developer tools, Xcode, app caches, system junk and AI tools, and a 3D orb that reacts to scanning and cleaning.
- **Cleanup** page grouping findings by category, with plain-language explanations, safe items pre-selected and Review items left for you.
- **Space Lens**, an interactive sunburst of the home folder.
- **Large & Old Files**, filtered by size, age and kind, with Quick Look; chosen files move to the Trash.
- **Uninstaller** that removes apps along with their `~/Library` leftovers.
- **History** of every cleanup and **Settings** for sounds, Trash-instead-of-delete, excluded folders and Full Disk Access.
- Synthesized ambient sounds and chimes (no audio files).
- A deletion guard, engine tests on fake home folders, an end-to-end test of the real app, and a read-only `dry-run` script.

[Unreleased]: https://github.com/sabbirrifat/lumen/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sabbirrifat/lumen/releases/tag/v0.1.0
