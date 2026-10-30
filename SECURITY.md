# Security policy

Lumen deletes files, so we treat any way to make it delete the wrong thing as a security issue.

## Supported versions

Only the latest release gets fixes. Please update before reporting.

## Reporting a vulnerability

**Please don't open a public issue.** Report privately through GitHub instead:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the problem, how to reproduce it, and its impact.

You'll get an acknowledgement as soon as possible, and we'll keep you updated while we work on a fix. With your permission, you'll be credited in the release notes.

## What counts

Especially welcome:

- Any way to make Lumen delete, truncate or trash a file outside a rule's declared folders, or inside a protected personal folder
- Getting around the path guard (`src/main/engine/guard.ts`) with symlinks, `..` segments, unusual characters or race conditions
- Command or AppleScript injection through file names, app metadata (`Info.plist`) or other data Lumen reads
- Ways for web content or IPC messages to reach privileged APIs in the main process

Not in scope: a cache that Lumen correctly cleans but that you'd rather keep. Use the Review/untick options, or open a regular issue to discuss changing a rule's default.
