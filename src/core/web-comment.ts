import { randomInt } from 'node:crypto';
import type { BiliClient } from './client.js';

/** Opt-in request metadata observed in bilibili-api-python 17.4.2 (GPL-3.0+).
 * These fields are not an official API contract or a visibility guarantee.
 */
export interface WebCommentOptions {
  webCompatibility?: boolean;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  Referer: 'https://www.bilibili.com',
};

function pair(): string {
  const letters = 'ABCDEFGHIJK'.split('');
  return letters.splice(randomInt(letters.length), 1)[0] + letters[randomInt(letters.length)];
}

/** All traffic uses the caller's customFetch, cookie persistence and auth policy. */
export async function webCommentHeaders(client: BiliClient<any>): Promise<Record<string, string>> {
  const cookie = client.config.data.cookie;
  const has = (name: string) => new RegExp(`(?:^|;\\s*)${name}=[^;]+`).test(cookie);
  if (!has('buvid3') || !has('buvid4')) {
    const result = await client.checkedRequest<{ code: number; message: string; data: { b_3: string; b_4: string } }>(
      'https://api.bilibili.com/x/frontend/finger/spi',
      { anonymous: true, headers: HEADERS },
    );
    if (!result.data?.b_3 || !result.data?.b_4) throw new Error('Missing device cookies; comment not sent');
    const additions = [];
    if (!has('buvid3')) additions.push(`buvid3=${result.data.b_3}; Path=/; Secure`);
    if (!has('buvid4')) additions.push(`buvid4=${result.data.b_4}; Path=/; Secure`);
    await client.config.mergeCookie(additions);
  }
  return { ...HEADERS };
}

export function webCommentQuery(): URLSearchParams {
  return new URLSearchParams({
    dm_img_list: '[]', dm_img_str: pair(), dm_cover_img_str: pair(),
    dm_img_inter: '{"ds":[],"wh":[0,0,0],"of":[0,0,0]}', web_location: '1550101',
  });
}

export function addWebCommentFields(body: URLSearchParams, csrf: string): void {
  body.set('csrf_token', csrf);
  body.set('gaia_source', 'main_web');
  // Mirror the observed aiohttp encoding of that version's statistics dictionary.
  // This is a compatibility observation, not a documented Bilibili requirement.
  body.append('statistics', 'appId');
  body.append('statistics', 'platform');
}
