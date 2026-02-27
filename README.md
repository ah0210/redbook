# redbook — 小红书命令行工具

小红书 CLI 工具：搜索笔记、阅读内容、分析博主、发布图文。使用浏览器 Cookie 认证，无需 API Key。

[English](#english) | 中文

## 安装

```bash
npm install -g @lucasygu/redbook
```

需要 Node.js >= 22。使用 Chrome 浏览器的 Cookie —— 请先在 Chrome 中登录 xiaohongshu.com。

## 快速开始

```bash
# 检查连接
redbook whoami

# 搜索笔记
redbook search "AI编程" --sort popular

# 阅读笔记
redbook read https://www.xiaohongshu.com/explore/abc123

# 获取评论
redbook comments https://www.xiaohongshu.com/explore/abc123 --all

# 浏览推荐页
redbook feed

# 查看博主信息
redbook user <userId>
redbook user-posts <userId>

# 搜索话题标签
redbook topics "Claude Code"

# 发布图文笔记
redbook post --title "标题" --body "正文内容" --images cover.png
redbook post --title "测试" --body "..." --images img.png --private
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `whoami` | 查看当前登录账号 |
| `search <关键词>` | 搜索笔记 |
| `read <url>` | 阅读单篇笔记 |
| `comments <url>` | 获取笔记评论 |
| `user <userId>` | 查看用户资料 |
| `user-posts <userId>` | 列出用户所有笔记 |
| `feed` | 获取推荐页内容 |
| `post` | 发布图文笔记 |
| `topics <关键词>` | 搜索话题/标签 |

### 通用选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--cookie-source <浏览器>` | Cookie 来源浏览器 | `chrome` |
| `--json` | JSON 格式输出 | `false` |

### 搜索选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--sort <类型>` | `general`（综合）、`popular`（热门）、`latest`（最新） | `general` |
| `--type <类型>` | `all`（全部）、`video`（视频）、`image`（图文） | `all` |
| `--page <页码>` | 页码 | `1` |

### 发布选项

| 选项 | 说明 |
|------|------|
| `--title <标题>` | 笔记标题（必填） |
| `--body <正文>` | 笔记正文（必填） |
| `--images <路径...>` | 图片文件路径（必填） |
| `--topic <关键词>` | 附加话题标签 |
| `--private` | 发布为私密笔记 |

## 工作原理

`redbook` 从 Chrome 读取小红书的登录 Cookie（通过 [@steipete/sweet-cookie](https://github.com/nicklockwood/sweet-cookie)），然后用 TypeScript 实现的签名算法对 API 请求签名。无需浏览器自动化，无需 headless Chrome —— 纯 HTTP 请求。

**两套签名系统：**
- **主 API**（`edith.xiaohongshu.com`）—— 读取：搜索、推荐页、笔记、评论、用户资料。使用 144 字节 x-s 签名（v4.3.1）
- **创作者 API**（`creator.xiaohongshu.com`）—— 写入：上传图片、发布笔记。使用 AES-128-CBC 签名

## Claude Code 集成

安装后自动注册为 Claude Code 技能。在 Claude Code 中使用 `/redbook` 命令：

```
/redbook search "AI编程"              # 搜索笔记
/redbook read <url>                   # 阅读笔记
/redbook user <userId>                # 查看博主
/redbook analyze <userId>             # 完整博主分析
```

Claude 会自动调用 CLI 命令，解析结果，完成竞品分析、话题研究等复杂任务。

## 编程接口

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## 致谢

签名算法移植自以下开源项目（MIT 协议）：

- [Cloxl/xhshow](https://github.com/Cloxl/xhshow) — 主 API 签名（x-s, x-s-common）
- [Spider_XHS](https://github.com/JoeanAmier/XHS-Downloader) — 创作者 API 签名
- [ReaJason/xhs](https://github.com/ReaJason/xhs) — API 端点参考

Cookie 提取使用 [@steipete/sweet-cookie](https://github.com/nicklockwood/sweet-cookie)。

## 免责声明

本工具使用非官方 API。小红书可能随时更改或封锁这些接口。请合理使用，风险自负。本项目与小红书无任何关联。

---

<a id="english"></a>

# English

A fast CLI tool for [Xiaohongshu (小红书 / RED)](https://www.xiaohongshu.com) — search notes, read content, analyze creators, and publish posts. Uses browser cookie auth (no API key needed).

## Install

```bash
npm install -g @lucasygu/redbook
```

Requires Node.js >= 22. Uses cookies from your Chrome browser session — you must be logged into xiaohongshu.com in Chrome.

## Quick Start

```bash
# Check connection
redbook whoami

# Search notes
redbook search "AI编程" --sort popular

# Read a note
redbook read https://www.xiaohongshu.com/explore/abc123

# Get comments
redbook comments https://www.xiaohongshu.com/explore/abc123 --all

# Browse your feed
redbook feed

# Look up a creator
redbook user <userId>
redbook user-posts <userId>

# Search hashtags
redbook topics "Claude Code"

# Publish (requires image)
redbook post --title "标题" --body "正文" --images cover.png
redbook post --title "测试" --body "..." --images img.png --private
```

## Commands

| Command | Description |
|---------|-------------|
| `whoami` | Check connection and show current user info |
| `search <keyword>` | Search notes by keyword |
| `read <url>` | Read a note by URL |
| `comments <url>` | Get comments on a note |
| `user <userId>` | Get user profile info |
| `user-posts <userId>` | List a user's posted notes |
| `feed` | Get homepage feed |
| `post` | Publish an image note |
| `topics <keyword>` | Search for topics/hashtags |

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--cookie-source <browser>` | Browser to read cookies from | `chrome` |
| `--json` | Output as JSON | `false` |

### Search Options

| Option | Description | Default |
|--------|-------------|---------|
| `--sort <type>` | `general`, `popular`, `latest` | `general` |
| `--type <type>` | `all`, `video`, `image` | `all` |
| `--page <n>` | Page number | `1` |

### Post Options

| Option | Description |
|--------|-------------|
| `--title <title>` | Note title (required) |
| `--body <body>` | Note body text (required) |
| `--images <paths...>` | Image file paths (required) |
| `--topic <keyword>` | Topic/hashtag to search and attach |
| `--private` | Publish as private note |

## How It Works

`redbook` reads your XHS session cookies from Chrome (via [@steipete/sweet-cookie](https://github.com/nicklockwood/sweet-cookie)) and signs API requests using a TypeScript port of the XHS signing algorithm. No browser automation, no headless Chrome — just HTTP requests.

**Two signing systems:**
- **Main API** (`edith.xiaohongshu.com`) — for reading: search, feed, notes, comments, user profiles. Uses x-s signature with 144-byte payload (v4.3.1).
- **Creator API** (`creator.xiaohongshu.com`) — for writing: upload images, publish notes. Uses simpler AES-128-CBC signing.

## Claude Code Integration

Installs automatically as a Claude Code skill. Use `/redbook` in Claude Code:

```
/redbook search "AI编程"              # Search notes
/redbook read <url>                   # Read a note
/redbook user <userId>                # Creator profile
/redbook analyze <userId>             # Full creator analysis
```

Claude will call CLI commands, parse results, and handle complex workflows like competitive analysis and topic research.

## Programmatic Usage

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## Acknowledgments

Signing algorithms ported from these open-source projects (MIT licensed):

- [Cloxl/xhshow](https://github.com/Cloxl/xhshow) — Main API signing (x-s, x-s-common)
- [Spider_XHS](https://github.com/JoeanAmier/XHS-Downloader) — Creator API signing
- [ReaJason/xhs](https://github.com/ReaJason/xhs) — API endpoint reference

Cookie extraction via [@steipete/sweet-cookie](https://github.com/nicklockwood/sweet-cookie).

## Disclaimer

This tool uses unofficial/private APIs. Xiaohongshu may change or block these APIs at any time. Use responsibly and at your own risk. This project is not affiliated with Xiaohongshu.

## License

MIT
