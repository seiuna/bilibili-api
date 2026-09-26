import { describe, expect, expectTypeOf, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { UserAPI, type UserFollowing, type UserFollowingsData, type UserSubmission, type UserSubmissionsData } from '../../api/user.js';
import type { BiliApiResponse } from '../../core/types.js';

// Offline transport regressions, NOT remote contract/network tests. Synthetic
// responses only exercise serialization and raw response preservation.
function transport(response: unknown, failure?: Error) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    if (failure) throw failure;
    return new Response(JSON.stringify(response));
  };
  // Constructor only: never load/save a profile or acquire real credentials.
  const client = new BiliClient('offline-user-lists.json', fetcher);
  Object.assign(client.config.data, {
    cookie: 'SESSDATA=offline-placeholder',
    refreshToken: '',
    wbiImgKey: '7cd084941338484aae1ad9425b84077c',
    wbiSubKey: '4932caff0ff746eab6f01bf08b70ac45',
    wbiExpireAt: Date.now() + 60_000,
  });
  return { client, calls };
}

const submission: UserSubmission = {
  aid: 123, bvid: 'BV1testFixture', title: 'Offline fixture',
  play: 42, created: 1700000000, length: '01:23', pic: 'https://example.invalid/cover.jpg',
};
const following: UserFollowing = {
  mid: 456, uname: 'Offline fixture', sign: 'Unit test', face: 'https://example.invalid/avatar.jpg',
};
const submissionsResponse = {
  code: 0, message: '0', ttl: 1,
  data: { list: { vlist: [submission] }, page: { pn: 1, ps: 30, count: 87 } },
} satisfies BiliApiResponse<UserSubmissionsData>;
const followingsResponse = {
  code: 0, message: '0', ttl: 1,
  data: { list: [following], total: 234, re_version: 0 },
} satisfies BiliApiResponse<UserFollowingsData>;

describe('UserAPI lists (offline transport unit tests)', () => {
  it('signs submissions with WBI, preserves nesting and exposes typed data', async () => {
    const { client, calls } = transport(submissionsResponse);
    const result = await UserAPI.getSubmissions(client, 12345);
    expectTypeOf(result).toEqualTypeOf<BiliApiResponse<UserSubmissionsData>>();
    expectTypeOf(result.data.list.vlist[0]).toEqualTypeOf<UserSubmission>();
    expect(result).toEqual(submissionsResponse);
    expect(result.data.page.count).toBe(87);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url.origin + url.pathname).toBe('https://api.bilibili.com/x/space/wbi/arc/search');
    expect(url.searchParams.get('mid')).toBe('12345');
    expect(url.searchParams.get('pn')).toBe('1');
    expect(url.searchParams.get('ps')).toBe('30');
    expect(url.searchParams.get('w_rid')).toMatch(/^[a-f0-9]{32}$/);
    expect(url.searchParams.get('wts')).toMatch(/^\d+$/);
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('Cookie')).toBe('SESSDATA=offline-placeholder');
  });

  it.each([[3, 7], [0, 0]])('preserves submission pn=%i and ps=%i without swapping/defaulting', async (pn, ps) => {
    const { client, calls } = transport(submissionsResponse);
    await UserAPI.getSubmissions(client, 12345, pn, ps);
    expect(calls[0].url.searchParams.get('pn')).toBe(String(pn));
    expect(calls[0].url.searchParams.get('ps')).toBe(String(ps));
  });

  it('returns typed followings through the shared authenticated transport without WBI', async () => {
    const { client, calls } = transport(followingsResponse);
    const result = await UserAPI.getFollowings(client, 12345);
    expectTypeOf(result).toEqualTypeOf<BiliApiResponse<UserFollowingsData>>();
    expectTypeOf(result.data.list[0]).toEqualTypeOf<UserFollowing>();
    expect(result).toEqual(followingsResponse);
    expect(result.data.list[0].face).toBe(following.face);
    expect(result.data.total).toBe(234);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url.origin + url.pathname).toBe('https://api.bilibili.com/x/relation/followings');
    expect(Object.fromEntries(url.searchParams)).toEqual({ vmid: '12345', pn: '1', ps: '50', order: 'desc' });
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('Cookie')).toBe('SESSDATA=offline-placeholder');
  });

  it.each([[2, 9], [0, 0]])('preserves followings pn=%i, ps=%i and explicit ascending order', async (pn, ps) => {
    const { client, calls } = transport(followingsResponse);
    await UserAPI.getFollowings(client, 12345, pn, ps, 'asc');
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
      vmid: '12345', pn: String(pn), ps: String(ps), order: 'asc',
    });
  });

  it.each(['submissions', 'followings'] as const)('preserves empty %s responses', async (kind) => {
    const response = kind === 'submissions'
      ? { code: 0, message: '0', ttl: 1, data: { list: { vlist: [] }, page: { pn: 1, ps: 30, count: 0 } } }
      : { code: 0, message: '0', ttl: 1, data: { list: [], total: 0 } };
    const { client } = transport(response);
    const result = kind === 'submissions'
      ? await UserAPI.getSubmissions(client, 12345)
      : await UserAPI.getFollowings(client, 12345);
    expect(result).toEqual(response);
  });

  it.each(['submissions', 'followings'] as const)('does not replace %s business errors with empty success', async (kind) => {
    const response = { code: -352, message: 'offline risk-control fixture', ttl: 1, data: null };
    const { client } = transport(response);
    const result = kind === 'submissions'
      ? await UserAPI.getSubmissions(client, 12345)
      : await UserAPI.getFollowings(client, 12345);
    expect(result).toEqual(response);
  });

  it.each(['submissions', 'followings'] as const)('propagates %s transport failures', async (kind) => {
    const failure = new Error('offline transport failure');
    const { client } = transport(null, failure);
    const result = kind === 'submissions'
      ? UserAPI.getSubmissions(client, 12345)
      : UserAPI.getFollowings(client, 12345);
    await expect(result).rejects.toBe(failure);
  });
});
