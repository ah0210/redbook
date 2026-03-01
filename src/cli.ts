#!/usr/bin/env node

/**
 * redbook CLI — Xiaohongshu (Red Note) from the command line
 *
 * Usage:
 *   redbook whoami --cookie-source chrome
 *   redbook search "Claude Code" --cookie-source chrome --json
 *   redbook read <url> --cookie-source chrome --json
 *   redbook comments <url> --cookie-source chrome --json
 *   redbook user <user-id> --cookie-source chrome --json
 *   redbook user-posts <user-id> --cookie-source chrome --json
 *   redbook feed --cookie-source chrome --json
 *   redbook post --title "..." --body "..." --images img1.jpg --cookie-source chrome
 *   redbook topics "keyword" --cookie-source chrome
 */

import { Command } from "commander";
import kleur from "kleur";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractCookies, type CookieSource } from "./lib/cookies.js";
import { XhsClient, XhsApiError } from "./lib/client.js";
import { analyzeViral, formatViralAnalysis } from "./lib/analyze.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program
  .name("redbook")
  .description("CLI tool for Xiaohongshu (Red Note)")
  .version(pkg.version);

// Global option for cookie source
function addCookieOption(cmd: Command): Command {
  return cmd
    .option(
      "--cookie-source <browser>",
      "Browser to read cookies from (chrome, safari, firefox)",
      "chrome"
    )
    .option(
      "--chrome-profile <name>",
      'Chrome profile directory name (e.g., "Profile 1")'
    );
}

function addJsonOption(cmd: Command): Command {
  return cmd.option("--json", "Output as JSON");
}

async function getClient(cookieSource: string, chromeProfile?: string): Promise<XhsClient> {
  const cookies = await extractCookies(cookieSource as CookieSource, chromeProfile);
  return new XhsClient(cookies);
}

function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function handleError(err: unknown): never {
  if (err instanceof XhsApiError) {
    console.error(kleur.red(`Error: ${err.message}`));
    if (err.code) console.error(kleur.dim(`Code: ${err.code}`));
  } else if (err instanceof Error) {
    console.error(kleur.red(`Error: ${err.message}`));
  } else {
    console.error(kleur.red("Unknown error"));
  }
  process.exit(1);
}

// ─── whoami ─────────────────────────────────────────────────────────────────

const whoamiCmd = program.command("whoami").description("Check connection and show current user info");
addCookieOption(whoamiCmd);
addJsonOption(whoamiCmd);

whoamiCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const info = await client.getSelfInfo();
    if (opts.json) {
      output(info, true);
    } else {
      const user = info as Record<string, unknown>;
      console.log(kleur.green("Connected to Xiaohongshu"));
      console.log(`  User: ${kleur.bold(String(user.nickname ?? user.nick_name ?? "unknown"))}`);
      console.log(`  ID:   ${user.user_id ?? "unknown"}`);
      if (user.red_id) console.log(`  RedID: ${user.red_id}`);
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── search ─────────────────────────────────────────────────────────────────

const searchCmd = program
  .command("search <keyword>")
  .description("Search notes by keyword")
  .option("--page <n>", "Page number", "1")
  .option("--sort <type>", "Sort: general, popular, latest", "general")
  .option("--type <type>", "Note type: all, video, image", "all");
addCookieOption(searchCmd);
addJsonOption(searchCmd);

searchCmd.action(async (keyword, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const sortMap: Record<string, "general" | "popularity_descending" | "time_descending"> = {
      general: "general",
      popular: "popularity_descending",
      latest: "time_descending",
    };
    const typeMap: Record<string, 0 | 1 | 2> = { all: 0, video: 1, image: 2 };

    const result = await client.searchNotes(
      keyword,
      parseInt(opts.page),
      20,
      sortMap[opts.sort] ?? "general",
      typeMap[opts.type] ?? 0
    );

    if (opts.json) {
      output(result, true);
    } else {
      const data = result as { items?: Array<{ note_card?: { title?: string; user?: { nickname?: string }; note_id?: string; interact_info?: Record<string, string> } }> };
      if (data.items) {
        for (const item of data.items) {
          const card = item.note_card;
          if (!card) continue;
          console.log(
            `${kleur.bold(card.title ?? "(no title)")} — ${kleur.dim(`@${card.user?.nickname ?? "?"}`)}` +
            `  ${kleur.cyan(card.note_id ?? "")}`
          );
          if (card.interact_info) {
            const info = card.interact_info;
            console.log(
              `  ${kleur.dim(`♥ ${info.liked_count ?? 0}  💬 ${info.comment_count ?? 0}  ⭐ ${info.collected_count ?? 0}`)}`
            );
          }
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── read ───────────────────────────────────────────────────────────────────

const readCmd = program
  .command("read <url>")
  .description("Read a note by URL (tries HTML fallback first)")
  .option("--api", "Force API mode (requires xsec_token in URL)");
addCookieOption(readCmd);
addJsonOption(readCmd);

readCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const { noteId, xsecToken } = parseNoteUrl(url);

    let result: unknown;
    if (opts.api || xsecToken) {
      try {
        const feedResult = (await client.getNoteById(
          noteId,
          xsecToken ?? ""
        )) as { items?: Array<{ note_card?: unknown }> };
        result = feedResult?.items?.[0]?.note_card ?? feedResult;
      } catch {
        // Fall back to HTML
        result = await client.getNoteFromHtml(noteId, xsecToken ?? "");
      }
    } else {
      result = await client.getNoteFromHtml(noteId, xsecToken ?? "");
    }

    if (opts.json) {
      output(result, true);
    } else {
      const note = result as Record<string, unknown>;
      console.log(kleur.bold(String(note.title ?? "(no title)")));
      console.log(kleur.dim(`by @${(note.user as Record<string, unknown>)?.nickname ?? "unknown"}`));
      console.log();
      console.log(String(note.desc ?? ""));
      if (note.interact_info) {
        const info = note.interact_info as Record<string, string>;
        console.log();
        console.log(
          `♥ ${info.liked_count ?? 0}  💬 ${info.comment_count ?? 0}  ⭐ ${info.collected_count ?? 0}  📤 ${info.share_count ?? 0}`
        );
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── comments ───────────────────────────────────────────────────────────────

const commentsCmd = program
  .command("comments <url>")
  .description("Get comments on a note")
  .option("--all", "Fetch all pages of comments");
addCookieOption(commentsCmd);
addJsonOption(commentsCmd);

commentsCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const { noteId, xsecToken } = parseNoteUrl(url);

    const allComments: unknown[] = [];
    let cursor = "";
    let hasMore = true;

    while (hasMore) {
      const res = (await client.getComments(noteId, cursor, xsecToken ?? "")) as {
        comments?: unknown[];
        has_more?: boolean;
        cursor?: string;
      };

      if (res.comments) allComments.push(...res.comments);
      hasMore = opts.all ? (res.has_more ?? false) : false;
      cursor = res.cursor ?? "";
    }

    if (opts.json) {
      output(allComments, true);
    } else {
      for (const comment of allComments) {
        const c = comment as Record<string, unknown>;
        const user = c.user_info as Record<string, unknown> | undefined;
        console.log(
          `${kleur.bold(`@${user?.nickname ?? "?"}`)} — ${String(c.content ?? "")}`
        );
        if (c.like_count) console.log(kleur.dim(`  ♥ ${c.like_count}`));
      }
      console.log(kleur.dim(`\n${allComments.length} comments`));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── user ───────────────────────────────────────────────────────────────────

const userCmd = program
  .command("user <userId>")
  .description("Get user profile info");
addCookieOption(userCmd);
addJsonOption(userCmd);

userCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const info = await client.getUserInfo(userId);
    output(info, opts.json ?? false);
  } catch (err) {
    handleError(err);
  }
});

// ─── user-posts ─────────────────────────────────────────────────────────────

const userPostsCmd = program
  .command("user-posts <userId>")
  .description("List a user's posted notes");
addCookieOption(userPostsCmd);
addJsonOption(userPostsCmd);

userPostsCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const result = await client.getUserNotes(userId);
    if (opts.json) {
      output(result, true);
    } else {
      const data = result as { notes?: Array<{ display_title?: string; note_id?: string; type?: string }> };
      if (data.notes) {
        for (const note of data.notes) {
          console.log(
            `${kleur.bold(note.display_title ?? "(no title)")}  ${kleur.dim(note.note_id ?? "")}  [${note.type ?? "?"}]`
          );
        }
        console.log(kleur.dim(`\n${data.notes.length} notes`));
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── feed ───────────────────────────────────────────────────────────────────

const feedCmd = program
  .command("feed")
  .description("Get homepage feed")
  .option("--category <cat>", "Feed category", "homefeed_recommend");
addCookieOption(feedCmd);
addJsonOption(feedCmd);

feedCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const result = await client.getHomeFeed(opts.category);
    output(result, opts.json ?? false);
  } catch (err) {
    handleError(err);
  }
});

// ─── post ───────────────────────────────────────────────────────────────────

const postCmd = program
  .command("post")
  .description("Publish an image note")
  .requiredOption("--title <title>", "Note title")
  .requiredOption("--body <body>", "Note body text")
  .option("--images <paths...>", "Image file paths")
  .option("--topic <keyword>", "Topic/hashtag keyword to search and attach")
  .option("--private", "Publish as private note");
addCookieOption(postCmd);
addJsonOption(postCmd);

postCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const imageFiles: string[] = opts.images ?? [];

    if (imageFiles.length === 0) {
      console.error(kleur.red("At least one image is required. Use --images <path>"));
      process.exit(1);
    }

    // Upload images
    console.log(kleur.dim("Uploading images..."));
    const fileIds: string[] = [];
    for (const filePath of imageFiles) {
      const { fileId, token } = await client.getUploadPermit("image");
      const ext = filePath.toLowerCase().split(".").pop();
      const contentType =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      await client.uploadFile(fileId, token, filePath, contentType);
      fileIds.push(fileId);
      console.log(kleur.dim(`  Uploaded: ${filePath} → ${fileId}`));
    }

    // Search for topic if specified
    let topics: Array<{ id: string; name: string; type: string }> = [];
    if (opts.topic) {
      const topicResult = (await client.searchTopics(opts.topic)) as Array<{
        id: string;
        name: string;
        type: string;
      }>;
      if (topicResult.length > 0) {
        topics = [topicResult[0]];
        console.log(kleur.dim(`  Topic: #${topicResult[0].name}`));
      }
    }

    // Create the note
    console.log(kleur.dim("Publishing note..."));
    const result = await client.createImageNote(opts.title, opts.body, fileIds, {
      topics,
      isPrivate: opts.private ?? false,
    });

    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Note published!"));
      const r = result as Record<string, unknown>;
      if (r.note_id) {
        console.log(`  URL: https://www.xiaohongshu.com/explore/${r.note_id}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── topics ─────────────────────────────────────────────────────────────────

const topicsCmd = program
  .command("topics <keyword>")
  .description("Search for topics/hashtags to use in posts");
addCookieOption(topicsCmd);
addJsonOption(topicsCmd);

topicsCmd.action(async (keyword, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const result = await client.searchTopics(keyword);
    if (opts.json) {
      output(result, true);
    } else {
      const data = result as { topic_info_dtos?: Array<{ name?: string; id?: string; view_num?: number }> };
      const topics = data.topic_info_dtos ?? (Array.isArray(result) ? result as Array<{ name?: string; id?: string; view_num?: number }> : []);
      for (const topic of topics) {
        console.log(
          `#${kleur.bold(topic.name ?? "?")}  ${kleur.dim(`id:${topic.id ?? "?"}`)}  ${kleur.dim(`views:${topic.view_num ?? "?"}`)}`
        );
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── analyze-viral ──────────────────────────────────────────────────────────

const analyzeViralCmd = program
  .command("analyze-viral <url>")
  .description("Analyze why a viral note works — hooks, engagement, structure");
analyzeViralCmd.option("--comment-pages <n>", "Comment pages to fetch (max 10)", "3");
addCookieOption(analyzeViralCmd);
addJsonOption(analyzeViralCmd);

analyzeViralCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile);
    const { noteId, xsecToken } = parseNoteUrl(url);

    // 1. Fetch the note (same pattern as `read` — prefer HTML, API when xsec_token present)
    let note: Record<string, unknown>;
    if (xsecToken) {
      try {
        const feedResult = (await client.getNoteById(
          noteId,
          xsecToken
        )) as { items?: Array<{ note_card?: Record<string, unknown> }> };
        note = feedResult?.items?.[0]?.note_card ?? {};
        if (!note.user) {
          note = (await client.getNoteFromHtml(noteId, xsecToken)) as Record<string, unknown>;
        }
      } catch {
        note = (await client.getNoteFromHtml(noteId, xsecToken)) as Record<string, unknown>;
      }
    } else {
      note = (await client.getNoteFromHtml(noteId, "")) as Record<string, unknown>;
    }

    const user = (note.user as Record<string, unknown>) ?? {};
    const userId = String(user.user_id ?? "");

    if (!userId) {
      console.error(kleur.red("Could not extract author user_id from note"));
      process.exit(1);
    }

    // 2. Fetch comments, author posts, and author info in parallel
    const commentPages = Math.min(parseInt(opts.commentPages) || 3, 10);

    const fetchComments = async () => {
      const all: Record<string, unknown>[] = [];
      let cursor = "";
      for (let i = 0; i < commentPages; i++) {
        try {
          const res = (await client.getComments(noteId, cursor, xsecToken ?? "")) as {
            comments?: Record<string, unknown>[];
            has_more?: boolean;
            cursor?: string;
          };
          if (res.comments) all.push(...res.comments);
          if (!res.has_more) break;
          cursor = res.cursor ?? "";
        } catch {
          break; // Comment fetch failed, continue with what we have
        }
      }
      return all;
    };

    const fetchAuthorPosts = async () => {
      try {
        const res = (await client.getUserNotes(userId)) as {
          notes?: Record<string, unknown>[];
        };
        return res.notes ?? [];
      } catch {
        return [];
      }
    };

    const fetchAuthorInfo = async () => {
      try {
        const res = (await client.getUserInfo(userId)) as Record<string, unknown>;
        // Follower count is in interactions array: {type: "fans", count: "30510"}
        const interactions = (res.interactions ?? []) as Array<{ type?: string; count?: string }>;
        const fansEntry = interactions.find((i) => i.type === "fans");
        if (fansEntry?.count) {
          // Handle Chinese abbreviated numbers (e.g., "3.1万")
          const s = fansEntry.count.trim();
          if (s.endsWith("万")) return Math.round(parseFloat(s.slice(0, -1)) * 10000);
          if (s.endsWith("亿")) return Math.round(parseFloat(s.slice(0, -1)) * 100000000);
          return parseInt(s, 10) || 0;
        }
        return 0;
      } catch {
        return 0;
      }
    };

    console.error(kleur.dim("Fetching comments, author posts, and profile..."));
    const [comments, authorPosts, authorFollowers] = await Promise.all([
      fetchComments(),
      fetchAuthorPosts(),
      fetchAuthorInfo(),
    ]);

    // 3. Run analysis
    const analysis = analyzeViral(noteId, note, comments, authorPosts, authorFollowers);

    if (opts.json) {
      output(analysis, true);
    } else {
      console.log(formatViralAnalysis(analysis));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNoteUrl(url: string): {
  noteId: string;
  xsecToken: string | null;
} {
  // Handle full URLs like https://www.xiaohongshu.com/explore/abc123?xsec_token=xxx
  // or https://www.xiaohongshu.com/discovery/item/abc123
  // or just a note ID
  let noteId: string;
  let xsecToken: string | null = null;

  if (url.includes("xiaohongshu.com")) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    noteId = pathParts[pathParts.length - 1];
    xsecToken = urlObj.searchParams.get("xsec_token");
  } else if (url.includes("xhslink.com")) {
    // Short link — just use it as-is, would need redirect following
    noteId = url;
  } else {
    noteId = url;
  }

  return { noteId, xsecToken };
}

program.parse();
