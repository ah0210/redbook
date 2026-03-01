/**
 * Cookie extraction module — wraps @steipete/sweet-cookie
 * Same pattern as bird.fast for Chrome/Safari/Firefox cookie extraction
 */

import { getCookies } from "@steipete/sweet-cookie";

export interface XhsCookies {
  a1: string;
  web_session: string;
  webId: string;
  [key: string]: string;
}

export type CookieSource = "chrome" | "safari" | "firefox";

/**
 * Extract XHS cookies from browser cookie store.
 * Requires user to be logged into xiaohongshu.com in the specified browser.
 */
export async function extractCookies(
  source: CookieSource = "chrome"
): Promise<XhsCookies> {
  const result = await getCookies({
    url: "https://www.xiaohongshu.com/",
    browsers: [source],
    timeoutMs: 30_000,
  });

  const cookieMap: Record<string, string> = {};
  for (const cookie of result.cookies) {
    cookieMap[cookie.name] = cookie.value;
  }

  if (!cookieMap.a1) {
    const lines: string[] = [
      `No 'a1' cookie found for xiaohongshu.com in ${source}.`,
      "",
    ];

    // Surface all warnings from sweet-cookie — these contain the actual failure reason
    if (result.warnings.length > 0) {
      lines.push("Warnings from cookie extraction:");
      for (const w of result.warnings) {
        lines.push(`  - ${w}`);
      }
      lines.push("");
    }

    // Debug info to help users report issues
    lines.push(
      `Debug info:`,
      `  - Platform: ${process.platform}`,
      `  - Node: ${process.version}`,
      `  - Cookie source: ${source}`,
      `  - Cookies found: ${result.cookies.length} (names: ${result.cookies.map((c) => c.name).join(", ") || "none"})`,
      "",
    );

    lines.push(
      "Troubleshooting:",
      "  1. Keychain access: when macOS prompts for your password, click 'Always Allow'",
      "     to avoid being asked again. If you clicked 'Deny', re-run the command.",
      "  2. Chrome profile: if you use multiple Chrome profiles, set the env variable",
      "     SWEET_COOKIE_CHROME_PROFILE=<profile> (e.g. 'Profile 1', 'Profile 2').",
      "     Check ~/Library/Application Support/Google/Chrome/ for available profiles.",
      "  3. Login: open Chrome and visit https://www.xiaohongshu.com/ — make sure you",
      "     are logged in and can see your feed.",
      "  4. Cookie expired: even if Chrome shows you as logged in, the 'a1' cookie may",
      "     have expired. Try logging out and back in on xiaohongshu.com.",
      "  5. Non-standard browser: if you use Brave, Arc, or another Chromium browser,",
      "     cookies are stored in a different location. Try --cookie-source safari instead.",
    );

    throw new Error(lines.join("\n"));
  }

  return cookieMap as XhsCookies;
}

/**
 * Format cookies as a cookie header string: "a1=xxx; web_session=yyy; ..."
 */
export function cookiesToString(cookies: XhsCookies): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
