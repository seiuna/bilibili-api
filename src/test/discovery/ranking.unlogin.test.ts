import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { RankingAPI } from '../../api/ranking.js';
import { SearchAPI } from '../../api/search.js';

const client = new BiliClient<void>();

describe('Ranking & Discovery Unlogin Test', () => {
  it('RankingAPI.getPopular 应返回公开热门视频列表', async () => {
    const res = await RankingAPI.getPopular(client, 1, 5);

    expect(res.code).toBe(0);
    expect(Array.isArray(res.data.list)).toBe(true);
    expect(res.data.list).toHaveLength(5);
    expect(res.data.list[0].bvid).toMatch(/^BV/);
    expect(typeof res.data.list[0].title).toBe('string');
  });

  it('RankingAPI.popular 生成器应按页返回热门视频', async () => {
    const items = [];
    for await (const item of RankingAPI.popular(client, 3, 1)) {
      items.push(item);
    }

    expect(items).toHaveLength(3);
    expect(items[0].bvid).toMatch(/^BV/);
    expect(typeof items[0].title).toBe('string');
  });

  it('RankingAPI.getPreciousVideos 应返回入站必刷视频列表', async () => {
    const res = await RankingAPI.getPreciousVideos(client);

    expect(res.code).toBe(0);
    expect(res.data.title).toBe('入站必刷');
    expect(Array.isArray(res.data.list)).toBe(true);
    expect(res.data.list.length).toBeGreaterThan(50);
    expect(res.data.list[0].bvid).toMatch(/^BV/);
  });

  it('SearchAPI.getSuggest 应返回公开搜索建议列表', async () => {
    const res = await SearchAPI.getSuggest(client, 'Rick Astley');

    expect(res.code).toBe(0);
    expect(Array.isArray(res.result.tag)).toBe(true);
    expect(res.result.tag.length).toBeGreaterThan(0);
    expect(typeof res.result.tag[0].value).toBe('string');
  });
});
