---
description: Search, read, and analyze Xiaohongshu (小红书) content via CLI
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Redbook — Xiaohongshu CLI

Use the `redbook` CLI to search notes, read content, analyze creators, and research topics on Xiaohongshu (小红书/RED).

## Usage

```
/redbook search "AI编程"              # Search notes
/redbook read <url>                   # Read a note
/redbook user <userId>                # Creator profile
/redbook analyze <userId>             # Full creator analysis (profile + posts)
```

## Instructions

When this command is invoked, determine the user's intent and run the appropriate CLI command(s).

### Quick Reference

| Intent | Command |
|--------|---------|
| Search notes | `redbook search "keyword" --json` |
| Read a note | `redbook read <url> --json` |
| Get comments | `redbook comments <url> --json --all` |
| Creator profile | `redbook user <userId> --json` |
| Creator's posts | `redbook user-posts <userId> --json` |
| Browse feed | `redbook feed --json` |
| Search hashtags | `redbook topics "keyword" --json` |
| Analyze viral note | `redbook analyze-viral <url> --json` |
| Check connection | `redbook whoami` |

### Always Use `--json`

Always add `--json` to commands when you need to parse the output programmatically. The JSON output is structured and reliable. Without `--json`, output is human-formatted text.

### Command Details

#### `redbook search <keyword>`

Search for notes by keyword. Returns note titles, URLs, likes, author info.

```bash
redbook search "Claude Code教程" --json
redbook search "AI编程" --sort popular --json        # Sort: general, popular, latest
redbook search "Cursor" --type image --json           # Type: all, video, image
redbook search "MCP Server" --page 2 --json           # Pagination
```

**Options:**
- `--sort <type>`: `general` (default), `popular`, `latest`
- `--type <type>`: `all` (default), `video`, `image`
- `--page <n>`: Page number (default: 1)

#### `redbook read <url>`

Read a note's full content — title, body text, images, likes, comments count.

```bash
redbook read "https://www.xiaohongshu.com/explore/abc123" --json
```

Accepts full URLs or short note IDs. If the API returns a captcha, it falls back to HTML scraping automatically.

#### `redbook comments <url>`

Get comments on a note. Use `--all` to fetch all pages.

```bash
redbook comments "https://www.xiaohongshu.com/explore/abc123" --json
redbook comments "https://www.xiaohongshu.com/explore/abc123" --all --json
```

**Options:**
- `--all`: Fetch all comment pages (default: first page only)

#### `redbook user <userId>`

Get a creator's profile — nickname, bio, follower count, note count, likes received.

```bash
redbook user "5a1234567890abcdef012345" --json
```

The userId is the hex string from the creator's profile URL.

#### `redbook user-posts <userId>`

List all notes posted by a creator. Returns titles, URLs, likes, timestamps.

```bash
redbook user-posts "5a1234567890abcdef012345" --json
```

#### `redbook feed`

Browse the recommendation feed. Returns a batch of recommended notes.

```bash
redbook feed --json
```

#### `redbook topics <keyword>`

Search for topic hashtags. Useful for finding trending topics to attach to posts.

```bash
redbook topics "Claude Code" --json
```

#### `redbook analyze-viral <url>`

Analyze why a viral XHS note works — hook patterns, engagement metrics, content structure, and performance relative to the author's baseline. Returns a deterministic viral score (0-100).

```bash
redbook analyze-viral "https://www.xiaohongshu.com/explore/abc123" --json
redbook analyze-viral "https://www.xiaohongshu.com/explore/abc123" --comment-pages 5
```

**Options:**
- `--comment-pages <n>`: Comment pages to fetch (default: 3, max: 10)

**JSON output structure:**
Returns `{ note, score, hook, content, visual, engagement, comments, relative, fetchedAt }`.

- `score.overall` (0-100) — composite of hook/engagement/relative/content/comments
- `hook.hookPatterns[]` — detected title patterns (Identity Hook, Emotion Word, etc.)
- `engagement` — likes, comments, collects, shares + ratios
- `relative.viralMultiplier` — performance vs author's median
- `comments.themes[]` — top recurring phrases from comments

Use `--json` when consuming from Claude Code skills for further synthesis.

#### `redbook whoami`

Check connection status. Verifies cookies are valid and shows the logged-in user.

```bash
redbook whoami
```

If this fails, the user needs to log into xiaohongshu.com in Chrome.

#### `redbook post` (Limited)

Publish an image note. **Note: This command frequently triggers captcha (type=124) on the creator API.** Image upload works, but the publish step is unreliable. For posting, use Chrome browser automation instead.

```bash
redbook post --title "标题" --body "正文" --images cover.png --json
redbook post --title "测试" --body "..." --images img.png --private --json
```

**Options:**
- `--title <title>`: Note title (required)
- `--body <body>`: Note body text (required)
- `--images <paths...>`: Image file paths (required, at least one)
- `--topic <keyword>`: Search and attach a topic hashtag
- `--private`: Publish as private note

### Global Options

All commands accept:
- `--cookie-source <browser>`: `chrome` (default), `safari`, `firefox`
- `--chrome-profile <name>`: Chrome profile directory name (e.g., "Profile 1"). Auto-discovered if omitted.
- `--json`: Output as JSON

## Research Workflows

### Competitive Analysis

Research competitors in a niche:

```bash
# 1. Search for content in the niche
redbook search "Claude Code" --sort popular --json

# 2. Identify top creators from search results (extract user IDs)

# 3. Deep-dive on each creator
redbook user <userId> --json           # Profile + follower stats
redbook user-posts <userId> --json     # All their content + engagement

# 4. Read their top-performing notes
redbook read <noteUrl> --json          # Full content
redbook comments <noteUrl> --all --json  # What resonates with audience
```

### Topic Research

Find trending topics and hashtags:

```bash
# Search for topics
redbook topics "AI编程" --json

# Search notes using different sort orders to understand the landscape
redbook search "keyword" --sort popular --json   # What's proven
redbook search "keyword" --sort latest --json    # What's new
```

### Viral Note Research

Analyze what makes top-performing notes work:

```bash
# 1. Find viral notes in a niche
redbook search "Claude Code" --sort popular --json

# 2. Analyze the top-performing note
redbook analyze-viral "<noteUrl>" --json

# 3. Compare multiple viral notes to find common patterns
# Run analyze-viral on 3-5 top notes, then synthesize:
# - Which hook patterns appear most often?
# - What engagement ratios are typical for this niche?
# - What content structure drives saves vs shares?
```

### Creator Deep-Dive

Analyze a specific creator's strategy:

```bash
# Get profile overview
redbook user <userId> --json

# Get all their posts to analyze content patterns
redbook user-posts <userId> --json

# Read their top posts for content structure analysis
redbook read <topPostUrl> --json
redbook comments <topPostUrl> --all --json
```

## Programmatic API

The package also exports a TypeScript client for scripting:

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## xsec_token — CRITICAL for Reading Notes

The XHS API requires a valid `xsec_token` to fetch note content. Without it, `read`, `comments`, and `analyze-viral` return `{}`.

**Key rules:**

1. **Tokens expire.** A URL with `?xsec_token=...` from a previous session will return `{}`. Never cache or reuse old URLs.
2. **`search` always returns fresh tokens.** Every item in search results includes a valid `xsec_token` for that note.
3. **noteId alone returns `{}`.** Running `redbook read <noteId>` without a token almost always fails.

**The correct workflow — always search first:**

```bash
# WRONG — stale URL or bare noteId, will likely return {}
redbook read "689da7b0000000001b0372c6" --json
redbook read "https://www.xiaohongshu.com/explore/689da7b0?xsec_token=OLD_TOKEN" --json

# RIGHT — search first, then use the fresh URL with token
redbook search "AI编程" --sort popular --json
# Extract the noteId + xsec_token from search results, then:
redbook read "https://www.xiaohongshu.com/explore/<noteId>?xsec_token=<freshToken>" --json
redbook analyze-viral "https://www.xiaohongshu.com/explore/<noteId>?xsec_token=<freshToken>" --json
```

**For Claude Code agents:** When the user gives you a bare XHS note URL (no `xsec_token` param), extract the noteId from the URL path, search for the note title or noteId to get a fresh token, then use the full URL with the fresh token for `read`/`comments`/`analyze-viral`.

**How to extract fresh URLs from search results (JSON):**

```bash
# Each search result item has: { id: "noteId", xsec_token: "...", note_card: { ... } }
# Build the URL: https://www.xiaohongshu.com/explore/{id}?xsec_token={xsec_token}
```

**Commands that need xsec_token:** `read`, `comments`, `analyze-viral`
**Commands that do NOT need xsec_token:** `search`, `user`, `user-posts`, `feed`, `whoami`, `topics`

## Chinese Number Formats in API Responses

The XHS API returns abbreviated numbers with Chinese unit suffixes:

| API value | Actual number |
|-----------|---------------|
| `"1.5万"` | 15,000 |
| `"2.4万"` | 24,000 |
| `"1.2亿"` | 120,000,000 |
| `"115"` | 115 |

`万` = ×10,000. `亿` = ×100,000,000. Numbers under 10,000 are plain integers as strings.

The `analyze-viral` command handles this automatically. When parsing `--json` output manually, watch for these suffixes in `interact_info` fields (`liked_count`, `collected_count`, etc.).

## Error Handling

| Error | Meaning | Fix |
|-------|---------|-----|
| `{}` empty response | Missing or expired xsec_token | Search first to get a fresh token (see above) |
| "No 'a1' cookie" | Not logged into XHS in browser | Log into xiaohongshu.com in Chrome |
| "Session expired" | Cookie too old | Re-login in Chrome |
| "NeedVerify" / captcha | Anti-bot triggered | Wait and retry, or reduce request frequency |
| "IP blocked" (300012) | Rate limited | Wait or switch network |

## Requirements

- Node.js >= 22
- Logged into xiaohongshu.com in Chrome (or Safari/Firefox with `--cookie-source`)
- macOS (cookie extraction uses native keychain access)
