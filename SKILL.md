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

## Quick Reference

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

**Always add `--json`** when parsing output programmatically. Without it, output is human-formatted text.

---

## XHS Platform Signals

XHS is not Twitter or Instagram. These platform-specific engagement ratios reveal content type and audience behavior.

### Collect/Like Ratio (`collected_count / liked_count`)

XHS's "collect" (收藏) is a save-for-later mechanic — users build personal reference libraries. This ratio is the strongest signal of content utility.

| Ratio | Classification | Meaning |
|-------|---------------|---------|
| >40% | 工具型 (Reference) | Tutorial, checklist, template — users bookmark for reuse |
| 20–40% | 认知型 (Insight) | Thought-provoking but not saved for later |
| <20% | 娱乐型 (Entertainment) | Consumed and forgotten — engagement is passive |

### Comment/Like Ratio (`comment_count / liked_count`)

Measures how much a note triggers conversation.

| Ratio | Classification | Meaning |
|-------|---------------|---------|
| >15% | 讨论型 (Discussion) | Debate, sharing experiences, asking questions |
| 5–15% | 正常互动 (Normal) | Typical engagement pattern |
| <5% | 围观型 (Passive) | Users like but don't engage further |

### Share/Like Ratio (`share_count / liked_count`)

Measures social currency — whether users share to signal identity or help others.

| Ratio | Meaning |
|-------|---------|
| >10% | 社交货币 — people share to signal taste, identity, or help friends |
| <10% | Content consumed individually, not forwarded |

### Search Sort Semantics

| Sort | What It Reveals |
|------|----------------|
| `--sort popular` | Proven ceiling — the best a keyword can do |
| `--sort latest` | Content velocity — how much is being posted now |
| `--sort general` | Algorithm-weighted blend (default) |

### Content Form Dynamics

| Form | Tendency |
|------|----------|
| 图文 (image-text, `type: "normal"`) | Higher collect rate — users save reference content |
| 视频 (video, `type: "video"`) | Higher like rate — easier to consume passively |

---

## Analysis Modules

Each module is a composable building block. Combine them for different analysis depths.

### Module A: Keyword Engagement Matrix

**Answers:** Which keywords have the highest engagement ceiling? Which are saturated vs. underserved?

**Commands:**
```bash
redbook search "keyword1" --sort popular --json
redbook search "keyword2" --sort popular --json
# Repeat for each keyword in your list
```

**Fields to extract** from each result's `items[]`:
- `items[].note_card.interact_info.liked_count` — likes (may use Chinese numbers: "1.5万" = 15,000)
- `items[].note_card.interact_info.collected_count` — collects
- `items[].note_card.interact_info.comment_count` — comments
- `items[].note_card.user.nickname` — author

**How to interpret:**
- **Top1 ceiling** = `items[0]` likes — the best-performing note for this keyword. This is the proven demand signal.
- **Top10 average** = mean likes across `items[0..9]` — how well an average top note does.
- A high Top1 but low Top10 avg means one outlier dominates; hard to compete.
- A high Top10 avg means consistent demand; easier to break in.

**Output:** Keyword × engagement table ranked by Top1 ceiling.

| Keyword | Top1 Likes | Top10 Avg | Top1 Collects | Collect/Like |
|---------|-----------|-----------|---------------|-------------|
| keyword1 | 12,000 | 3,200 | 5,400 | 45% |
| keyword2 | 8,500 | 4,100 | 1,200 | 14% |

---

### Module B: Cross-Topic Heatmap

**Answers:** Which topic × scene intersections have demand? Where are the content gaps?

**Commands:**
```bash
# Combine base topic with scene/angle keywords
redbook search "base topic + scene1" --sort popular --json
redbook search "base topic + scene2" --sort popular --json
redbook search "base topic + scene3" --sort popular --json
```

**Fields to extract:** Same as Module A — Top1 `liked_count` for each combination.

**How to interpret:**
- High Top1 = proven demand for this intersection
- Zero or very low results = content gap (opportunity or no demand — check if the combination makes sense)
- Compare across scenes to find which angles resonate most with the base topic

**Output:** Base × Scene heatmap.

```
             scene1    scene2    scene3    scene4
base topic   ████ 8K   ██ 2K     ████ 12K  ░░ 200
```

---

### Module C: Engagement Signal Analysis

**Answers:** What type of content is each keyword? Reference, insight, or entertainment?

**Commands:** Use search results from Module A, or for a single note:
```bash
redbook analyze-viral "<noteUrl>" --json
```

**Fields to extract:**
- From search results: compute ratios from `interact_info` fields
- From `analyze-viral`: use pre-computed `engagement.collectToLikeRatio`, `engagement.commentToLikeRatio`, `engagement.shareToLikeRatio`

**How to interpret:** Apply the ratio benchmarks from [XHS Platform Signals](#xhs-platform-signals) above.

**Output:** Per-keyword or per-note classification.

| Keyword | Collect/Like | Comment/Like | Type |
|---------|-------------|-------------|------|
| keyword1 | 45% | 8% | 工具型 + 正常互动 |
| keyword2 | 12% | 22% | 娱乐型 + 讨论型 |

---

### Module D: Creator Discovery & Profiling

**Answers:** Who are the key creators in this niche? What are their strategies?

**Commands:**
```bash
# 1. Collect unique user_ids from search results across keywords
#    Extract from items[].note_card.user.user_id

# 2. For each creator:
redbook user "<userId>" --json
redbook user-posts "<userId>" --json
```

**Fields to extract:**
- From `user`: `interactions[]` where `type === "fans"` → follower count
- From `user-posts`: `notes[].interact_info.liked_count` for all posts → compute avg, median, max
- From `user-posts`: `notes[].display_title` → content patterns, posting frequency

**How to interpret:**
- **Avg vs. Median likes:** Large gap means viral outliers inflate the average. Median is the "true" baseline.
- **Max / Median ratio:** >5× means they've had breakout hits. Study those notes specifically.
- **Post frequency:** Count notes to estimate posting cadence. Prolific creators (>3/week) vs. quality-focused (<1/week).

**Output:** Creator comparison table.

| Creator | Followers | Avg Likes | Median | Max | Posts | Style |
|---------|----------|-----------|--------|-----|-------|-------|
| @creator1 | 12万 | 3,200 | 1,800 | 45,000 | 89 | Tutorial |
| @creator2 | 5.4万 | 8,100 | 6,500 | 22,000 | 34 | Story |

---

### Module E: Content Form Breakdown

**Answers:** Do image-text or video notes perform better for this topic?

**Commands:**
```bash
redbook search "keyword" --type image --sort popular --json
redbook search "keyword" --type video --sort popular --json
```

**Fields to extract:**
- Compare Top1 and Top10 avg `liked_count` and `collected_count` between the two result sets
- Note the `type` field: `"normal"` = image-text, `"video"` = video

**Output:** Form × engagement table.

| Form | Top1 Likes | Top10 Avg | Collect/Like |
|------|-----------|-----------|-------------|
| 图文 | 8,000 | 2,400 | 42% |
| 视频 | 15,000 | 5,100 | 18% |

---

### Module F: Opportunity Scoring

**Answers:** Which keywords should I target? Where is the best effort-to-reward ratio?

**Input:** Keyword matrix from Module A.

**Scoring logic:**
- **Demand** = Top1 likes ceiling (proven audience size)
- **Competition** = density of high-engagement results (how many notes in Top10 have >1K likes)
- **Score** = Demand × (1 / Competition density)

**Tier thresholds** (based on Top1 likes):

| Tier | Top1 Likes | Meaning |
|------|-----------|---------|
| S | >100,000 (10万+) | Massive demand — hard to compete but huge upside |
| A | 20,000–100,000 | Strong demand — competitive but winnable |
| B | 5,000–20,000 | Moderate demand — good for growing accounts |
| C | <5,000 | Niche — low competition, low ceiling |

**Output:** Tiered keyword list.

| Tier | Keyword | Top1 | Competition | Opportunity |
|------|---------|------|-------------|------------|
| A | keyword1 | 45K | Medium (6/10 >1K) | High |
| B | keyword3 | 12K | Low (2/10 >1K) | Very High |
| S | keyword2 | 120K | High (10/10 >1K) | Medium |

---

### Module G: Audience Inference

**Answers:** Who is the audience for this niche? What do they want?

**Input:** Engagement ratios from Module C + comment themes from `analyze-viral` + content patterns.

**Fields to extract** from `analyze-viral` JSON:
- `comments.themes[]` — recurring phrases and keywords from comment section
- `comments.questionRate` — % of comments that are questions (learning intent)
- `engagement.collectToLikeRatio` — save behavior signals intent
- `hook.hookPatterns[]` — what title patterns attract this audience

**Inference rules:**
- High collect rate + high question rate → learning-oriented audience (students, professionals)
- High comment rate + emotional themes → community-oriented audience (sharing experiences)
- High share rate → aspiration-oriented audience (lifestyle, identity signaling)
- Comment language patterns → age/education signals (formal = older, slang = younger)

**Output:** Audience persona summary — demographics, intent, content preferences.

---

### Module H: Content Brainstorm

**Answers:** What specific content should I create, backed by data?

**Input:** Opportunity scores (Module F) + audience persona (Module G) + heatmap gaps (Module B).

**For each content idea, specify:**
- **Target keyword** — from opportunity scoring
- **Hook angle** — based on `hookPatterns` that work for this niche
- **Content type** — 工具型/认知型/娱乐型 based on what the audience wants
- **Form** — 图文 or 视频 based on Module E
- **Engagement target** — realistic based on Top10 avg for this keyword
- **Competitive reference** — specific note URL that proves this angle works

**Output:** Ranked content ideas with data backing.

| # | Keyword | Hook Angle | Type | Target Likes | Reference |
|---|---------|-----------|------|-------------|-----------|
| 1 | keyword3 | "N个方法..." (List) | 工具型 图文 | 5K+ | [top note URL] |
| 2 | keyword1 | "为什么..." (Question) | 认知型 视频 | 10K+ | [top note URL] |

---

## Composed Workflows

Combine modules for different analysis depths.

### Quick Topic Scan (~5 min)
**Modules:** A → C → F

Search 3–5 keywords, classify engagement type, rank opportunities. Good for quickly validating whether a niche is worth deeper research.

### Content Planning
**Modules:** A → B → E → F → H

Build keyword matrix, map topic × scene intersections, check content form performance, score opportunities, brainstorm specific content ideas.

### Creator Competitive Analysis
**Modules:** A → D

Find who dominates a niche and study their content strategy, posting frequency, and engagement patterns.

### Full Niche Analysis
**Modules:** A → B → C → D → E → F → G → H

The comprehensive playbook — keyword landscape, cross-topic heatmap, engagement signals, creator profiles, content form analysis, opportunity scoring, audience personas, and data-backed content ideas.

### Single Note Deep-Dive
**Command:** `redbook analyze-viral "<url>" --json`

No module composition needed — `analyze-viral` returns hook analysis, engagement ratios, comment themes, author baseline comparison, and a 0-100 viral score in one call.

### Viral Pattern Research
```bash
# 1. Find top notes
redbook search "keyword" --sort popular --json

# 2. Analyze 3-5 top notes
redbook analyze-viral "<url1>" --json
redbook analyze-viral "<url2>" --json
redbook analyze-viral "<url3>" --json

# 3. Synthesize across notes:
#    - Which hookPatterns[] appear most often?
#    - What collectToLikeRatio is typical?
#    - What content structure drives saves vs. shares?
```

---

## Command Details

### `redbook search <keyword>`

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

### `redbook read <url>`

Read a note's full content — title, body text, images, likes, comments count.

```bash
redbook read "https://www.xiaohongshu.com/explore/abc123" --json
```

Accepts full URLs or short note IDs. Falls back to HTML scraping if API returns captcha.

### `redbook comments <url>`

Get comments on a note. Use `--all` to fetch all pages.

```bash
redbook comments "https://www.xiaohongshu.com/explore/abc123" --json
redbook comments "https://www.xiaohongshu.com/explore/abc123" --all --json
```

### `redbook user <userId>`

Get a creator's profile — nickname, bio, follower count, note count, likes received.

```bash
redbook user "5a1234567890abcdef012345" --json
```

The userId is the hex string from the creator's profile URL.

### `redbook user-posts <userId>`

List all notes posted by a creator. Returns titles, URLs, likes, timestamps.

```bash
redbook user-posts "5a1234567890abcdef012345" --json
```

### `redbook feed`

Browse the recommendation feed.

```bash
redbook feed --json
```

### `redbook topics <keyword>`

Search for topic hashtags. Useful for finding trending topics to attach to posts.

```bash
redbook topics "Claude Code" --json
```

### `redbook analyze-viral <url>`

Analyze why a viral note works. Returns a deterministic viral score (0–100).

```bash
redbook analyze-viral "https://www.xiaohongshu.com/explore/abc123" --json
redbook analyze-viral "https://www.xiaohongshu.com/explore/abc123" --comment-pages 5
```

**Options:**
- `--comment-pages <n>`: Comment pages to fetch (default: 3, max: 10)

**JSON output structure:**
Returns `{ note, score, hook, content, visual, engagement, comments, relative, fetchedAt }`.

- `score.overall` (0–100) — composite of hook (20) + engagement (20) + relative (20) + content (20) + comments (20)
- `hook.hookPatterns[]` — detected title patterns (Identity Hook, Emotion Word, Number Hook, Question, etc.)
- `engagement` — likes, comments, collects, shares + ratios (collectToLikeRatio, commentToLikeRatio, shareToLikeRatio)
- `relative.viralMultiplier` — this note's likes / author's median likes
- `relative.isOutlier` — true if viralMultiplier > 3
- `comments.themes[]` — top recurring keyword phrases from comments

### `redbook whoami`

Check connection status. Verifies cookies are valid and shows the logged-in user.

```bash
redbook whoami
```

### `redbook post` (Limited)

Publish an image note. **Frequently triggers captcha (type=124) on the creator API.** Image upload works, but the publish step is unreliable. For posting, consider using browser automation instead.

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

---

## Technical Reference

### xsec_token — Required for Reading Notes

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
```

**For agents:** When the user gives a bare XHS note URL (no `xsec_token` param), extract the noteId from the URL path, search for the note title or noteId to get a fresh token, then use the full URL with the fresh token.

**How to extract fresh URLs from search results (JSON):**

```bash
# Each search result item has: { id: "noteId", xsec_token: "...", note_card: { ... } }
# Build the URL: https://www.xiaohongshu.com/explore/{id}?xsec_token={xsec_token}
```

**Commands that need xsec_token:** `read`, `comments`, `analyze-viral`
**Commands that do NOT need xsec_token:** `search`, `user`, `user-posts`, `feed`, `whoami`, `topics`

### Chinese Number Formats in API Responses

The XHS API returns abbreviated numbers with Chinese unit suffixes:

| API value | Actual number |
|-----------|---------------|
| `"1.5万"` | 15,000 |
| `"2.4万"` | 24,000 |
| `"1.2亿"` | 120,000,000 |
| `"115"` | 115 |

`万` = ×10,000. `亿` = ×100,000,000. Numbers under 10,000 are plain integers as strings.

The `analyze-viral` command handles this automatically. When parsing `--json` output manually, watch for these suffixes in `interact_info` fields (`liked_count`, `collected_count`, etc.).

### Error Handling

| Error | Meaning | Fix |
|-------|---------|-----|
| `{}` empty response | Missing or expired xsec_token | Search first to get a fresh token |
| "No 'a1' cookie" | Not logged into XHS in browser | Log into xiaohongshu.com in Chrome |
| "Session expired" | Cookie too old | Re-login in Chrome |
| "NeedVerify" / captcha | Anti-bot triggered | Wait and retry, or reduce request frequency |
| "IP blocked" (300012) | Rate limited | Wait or switch network |

---

## Output Format Guidance

When producing analysis reports, use these formats:

**Data tables:** Markdown tables with exact field mappings. Always include the metric unit.

**Heatmaps:** ASCII bar charts for cross-topic comparison:
```
             职场    生活    教育    创业
AI编程       ████ 8K  ██ 2K   ████ 12K ░░ 200
Claude Code  ██ 3K    ░░ 100  ██ 4K    █ 1K
```

**Creator comparison:** Structured table with both quantitative metrics and qualitative style assessment.

**Final reports:** Use this section order:
1. Market Overview (demand signals, content velocity)
2. Keyword Landscape (engagement matrix, opportunity tiers)
3. Cross-Topic Heatmap (topic × scene intersections)
4. Audience Persona (demographics, intent, preferences)
5. Competitive Landscape (creator profiles, strategy patterns)
6. Content Opportunities (tiered recommendations with data backing)
7. Content Ideas (specific hooks, angles, targets)

## Programmatic API

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## Requirements

- Node.js >= 22
- Logged into xiaohongshu.com in Chrome (or Safari/Firefox with `--cookie-source`)
- macOS (cookie extraction uses native keychain access)
