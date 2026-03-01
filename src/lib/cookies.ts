/**
 * Cookie extraction module — wraps @steipete/sweet-cookie
 * Same pattern as bird.fast for Chrome/Safari/Firefox cookie extraction
 */

import { getCookies } from "@steipete/sweet-cookie";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import kleur from "kleur";

export interface XhsCookies {
  a1: string;
  web_session: string;
  webId: string;
  [key: string]: string;
}

export type CookieSource = "chrome" | "safari" | "firefox";

interface ChromeProfileInfo {
  dirName: string;
  displayName: string;
}

/**
 * Discover Chrome profiles from Local State file.
 * Returns profiles sorted with "Default" first.
 */
function discoverChromeProfiles(): ChromeProfileInfo[] {
  if (process.platform !== "darwin") return [];

  const localStatePath = join(
    homedir(),
    "Library",
    "Application Support",
    "Google",
    "Chrome",
    "Local State"
  );

  if (!existsSync(localStatePath)) return [];

  try {
    const raw = readFileSync(localStatePath, "utf-8");
    const state = JSON.parse(raw);
    const infoCache = state?.profile?.info_cache;
    if (!infoCache || typeof infoCache !== "object") return [];

    const profiles: ChromeProfileInfo[] = [];
    for (const [dirName, meta] of Object.entries(infoCache)) {
      const m = meta as Record<string, unknown>;
      const displayName = String(m.name || m.gaia_name || dirName);
      profiles.push({ dirName, displayName });
    }

    profiles.sort((a, b) => {
      if (a.dirName === "Default") return -1;
      if (b.dirName === "Default") return 1;
      return a.dirName.localeCompare(b.dirName);
    });

    return profiles;
  } catch {
    return [];
  }
}

function toCookieMap(cookies: Array<{ name: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cookie of cookies) {
    map[cookie.name] = cookie.value;
  }
  return map;
}

function buildNoCookieError(
  source: CookieSource,
  warnings: string[],
  checkedProfiles?: ChromeProfileInfo[]
): Error {
  const lines: string[] = [
    `No 'a1' cookie found for xiaohongshu.com in ${source}.`,
    "",
  ];

  if (checkedProfiles && checkedProfiles.length > 0) {
    lines.push(
      `Checked ${checkedProfiles.length} Chrome profile(s): ` +
        checkedProfiles.map((p) => `"${p.dirName}" (${p.displayName})`).join(", ")
    );
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("Warnings from cookie extraction:");
    for (const w of warnings) {
      lines.push(`  - ${w}`);
    }
    lines.push("");
  }

  lines.push(
    `Debug info:`,
    `  - Platform: ${process.platform}`,
    `  - Node: ${process.version}`,
    `  - Cookie source: ${source}`,
    "",
    "Troubleshooting:",
    "  1. Keychain access: when macOS prompts for your password, click 'Always Allow'",
    "     to avoid being asked again. If you clicked 'Deny', re-run the command.",
    "  2. Login: open Chrome and visit https://www.xiaohongshu.com/ — make sure you",
    "     are logged in and can see your feed.",
    "  3. Cookie expired: even if Chrome shows you as logged in, the 'a1' cookie may",
    "     have expired. Try logging out and back in on xiaohongshu.com.",
    "  4. Non-standard browser: if you use Brave, Arc, or another Chromium browser,",
    "     cookies are stored in a different location. Try --cookie-source safari instead.",
  );

  return new Error(lines.join("\n"));
}

/**
 * Extract XHS cookies from browser cookie store.
 * For Chrome on macOS, auto-discovers all profiles and finds the one with the 'a1' cookie.
 */
export async function extractCookies(
  source: CookieSource = "chrome",
  chromeProfile?: string
): Promise<XhsCookies> {
  const log = (msg: string) => console.error(kleur.dim(msg));

  // Explicit profile or non-Chrome browser: single try
  if (chromeProfile || source !== "chrome") {
    log(`Reading cookies from ${source}${chromeProfile ? ` (profile: ${chromeProfile})` : ""}...`);
    const result = await getCookies({
      url: "https://www.xiaohongshu.com/",
      browsers: [source],
      timeoutMs: 30_000,
      ...(chromeProfile ? { chromeProfile } : {}),
    });
    const cookieMap = toCookieMap(result.cookies);

    if (!cookieMap.a1) {
      throw buildNoCookieError(source, result.warnings);
    }
    log(`Authenticated via ${source}${chromeProfile ? ` profile "${chromeProfile}"` : ""}.`);
    return cookieMap as XhsCookies;
  }

  // Auto-discover Chrome profiles
  const profiles = discoverChromeProfiles();

  if (profiles.length === 0) {
    log("Reading cookies from Chrome (default profile)...");
    const result = await getCookies({
      url: "https://www.xiaohongshu.com/",
      browsers: [source],
      timeoutMs: 30_000,
    });
    const cookieMap = toCookieMap(result.cookies);
    if (!cookieMap.a1) {
      throw buildNoCookieError(source, result.warnings);
    }
    log("Authenticated via Chrome.");
    return cookieMap as XhsCookies;
  }

  log(`Found ${profiles.length} Chrome profile(s): ${profiles.map((p) => `${p.dirName} (${p.displayName})`).join(", ")}`);

  // Try each profile, collect those that have the 'a1' cookie
  const found: Array<{ profile: ChromeProfileInfo; cookies: Record<string, string> }> = [];
  let lastWarnings: string[] = [];

  for (const profile of profiles) {
    log(`  Checking "${profile.dirName}" (${profile.displayName})...`);
    const result = await getCookies({
      url: "https://www.xiaohongshu.com/",
      browsers: ["chrome"],
      chromeProfile: profile.dirName,
      timeoutMs: 30_000,
    });
    lastWarnings = result.warnings;

    const cookieMap = toCookieMap(result.cookies);
    if (cookieMap.a1) {
      log(`  -> Found XHS session in "${profile.dirName}"`);
      found.push({ profile, cookies: cookieMap });
    } else {
      log(`  -> No XHS session`);
    }
  }

  if (found.length === 0) {
    throw buildNoCookieError(source, lastWarnings, profiles);
  }

  if (found.length === 1) {
    log(`Authenticated via Chrome profile "${found[0].profile.dirName}" (${found[0].profile.displayName}).`);
  } else {
    const names = found.map((f) => `"${f.profile.dirName}" (${f.profile.displayName})`);
    log(
      `Found XHS sessions in ${found.length} profiles: ${names.join(", ")}. ` +
        `Using "${found[0].profile.dirName}". ` +
        `To choose a specific one: --chrome-profile "${found[found.length - 1].profile.dirName}"`
    );
  }

  return found[0].cookies as XhsCookies;
}

/**
 * Format cookies as a cookie header string: "a1=xxx; web_session=yyy; ..."
 */
export function cookiesToString(cookies: XhsCookies): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
