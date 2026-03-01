# CLAUDE.md — redbook CLI

## Publishing

**NEVER publish npm packages directly from local.** Always use the `npm-publish-cli` agent to bump version and publish via CI. The GitHub Actions workflow (`Publish to npm`) handles publishing on push to main. Publishing locally races CI and causes workflow failures.

## Build & Test

- `npm run build` — TypeScript compile + chmod
- No test suite yet — verify manually with `redbook whoami`

## Project Structure

- `src/cli.ts` — CLI entry point, all 10 commands, `getClient()` is the single cookie→client funnel
- `src/lib/cookies.ts` — Cookie extraction with Chrome profile auto-discovery
- `src/lib/client.ts` — XHS API client
- `src/lib/signing.ts` — Request signing
- `SKILL.md` — Claude Code skill documentation

## Cookie Architecture

- Uses `@steipete/sweet-cookie` to read browser cookies
- Auto-discovers Chrome profiles via `~/Library/Application Support/Google/Chrome/Local State`
- Keychain timeout patched to 30s in node_modules (upstream bug: hardcoded 3s)
- `--chrome-profile` flag available as escape hatch, but auto-discovery handles most cases
