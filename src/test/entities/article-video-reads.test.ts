import { describe, expect, it } from 'vitest';
import { BiliApiError, BiliClient } from '../../core/client.js';
import { Article } from '../../entities/Article.js';
import { Video } from '../../entities/Video.js';
import type { ArticleInfo } from '../../api/article.js';
import type { VideoInfo } from '../../api/video.js';

// Offline transport regressions; synthetic fixtures are not real network evidence.
function transport(response: unknown) {
  const urls: URL[] = [];
  const fetcher: typeof fetch = async input => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify(response));
  };
  const client = new BiliClient('offline-entity-reads.json', fetcher);
  Object.assign(client.config.data, {
    cookie: '', refreshToken: '',
    wbiImgKey: '7cd084941338484aae1ad9425b84077c',
    wbiSubKey: '4932caff0ff746eab6f01bf08b70ac45',
    wbiExpireAt: Date.now() + 60_000,
  });
  return { client, urls };
}
const articleData = { mid: 42, pre: 999, next: 1001 } as ArticleInfo;
const videoData = { aid: 123, bvid: 'BV1offline', cid: 456, owner: { mid: 42 } } as VideoInfo;

describe('Article identity (offline unit tests)', () => {
  it('uses explicit CVID over adjacent IDs or legacy metadata, without mutating raw data', () => {
    const { client } = transport(null);
    const raw = { ...articleData, _cvid: 777 };
    const article = new Article(client, raw, 1234);
    expect(article.id).toBe(1234);
    expect(article.cvid).toBe(1234);
    expect(raw._cvid).toBe(777);
    raw._cvid = 888;
    expect(article.id).toBe(1234);
  });

  it('retains a validated legacy _cvid fallback', () => {
    const { client } = transport(null);
    expect(new Article(client, { ...articleData, _cvid: 4321 } as ArticleInfo).id).toBe(4321);
  });

  it.each([undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects missing/invalid CVID %s rather than inferring pre+1', id => {
    const { client, urls } = transport(null);
    expect(() => new Article(client, articleData, id)).toThrow(RangeError);
    expect(urls).toHaveLength(0);
  });

  it('rejects invalid explicit CVID even when a valid legacy fallback exists', () => {
    const { client } = transport(null);
    expect(() => new Article(client, { ...articleData, _cvid: 4321 } as ArticleInfo, 0)).toThrow(RangeError);
  });

  it('uses the authoritative ID in read requests', async () => {
    const { client, urls } = transport({ code: 0, message: '0', ttl: 1, data: { id: 1234 } });
    const article = new Article(client, articleData, 1234);
    const view = await article.getView();
    expect(view.rawData.id).toBe(1234);
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get('id')).toBe('1234');
  });
});

describe('Article and Video read errors (offline transport)', () => {
  it.each(['getAuthor', 'getView'] as const)('Article.%s exposes business errors', async method => {
    const { client } = transport({ code: -400, message: 'offline error', ttl: 1, data: null });
    await expect(new Article(client, articleData, 1234)[method]()).rejects.toMatchObject({
      name: 'BiliApiError', code: -400,
    });
  });

  it.each(['getAuthor', 'getStat', 'getPlayUrl', 'getOnlineCount', 'getAiSummary', 'getSnapshot', 'getRecommend', 'getTags'] as const)('Video.%s exposes business errors before data extraction', async method => {
    const { client } = transport({ code: -400, message: 'offline error', ttl: 1, data: null });
    await expect(new Video(client, videoData)[method]()).rejects.toBeInstanceOf(BiliApiError);
  });

  it.each(['getRecommend', 'getTags'] as const)('Video.%s preserves a legitimate empty success', async method => {
    const { client } = transport({ code: 0, message: '0', ttl: 1, data: [] });
    await expect(new Video(client, videoData)[method]()).resolves.toEqual([]);
  });

  it.each(['getRecommend', 'getTags'] as const)('Video.%s does not turn malformed success data into an empty list', async method => {
    const { client } = transport({ code: 0, message: '0', ttl: 1, data: null });
    await expect(new Video(client, videoData)[method]()).rejects.toBeInstanceOf(TypeError);
  });
});
