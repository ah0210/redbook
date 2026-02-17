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
  });

  const cookieMap: Record<string, string> = {};
  for (const cookie of result.cookies) {
    cookieMap[cookie.name] = cookie.value;
  }

  if (!cookieMap.a1) {
    throw new Error(
      `No 'a1' cookie found for xiaohongshu.com in ${source}. Are you logged into xiaohongshu.com?`
    );
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
