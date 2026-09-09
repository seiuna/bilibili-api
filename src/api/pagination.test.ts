import { describe, it, expect, vi } from 'vitest';
import { BiliClient } from '../core/client.js';
import type { HasToken } from '../core/client.js';
import { CommentAPI, ReplySort, ReplyMode } from './comment.js';
import { CommentArea } from '../entities/CommentArea.js';
import { HistoryAPI } from './history.js';
import { MessageAPI } from './message.js';
import { RankingAPI } from './ranking.js';
import { UserAPI } from './user.js';
import { User } from '../entities/User.js';
import { FavoriteAPI } from './favorite.js';
import { FavoriteFolder } from '../entities/FavoriteFolder.js';
import { DynamicAPI } from './dynamic.js';
import { NoteAPI } from './note.js';
import { ElectricAPI } from './electric.js';

describe('Dual Pagination (Single-Page & AsyncGenerator)', () => {
  describe('Comment Pagination', () => {
    it('CommentAPI supports both getReplies (single page) and replies (generator)', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const pn = Number(u.searchParams.get('pn') ?? '1');
        return new Response(
          JSON.stringify({
            code: 0,
            message: '0',
            data: {
              page: { acount: 4, count: 4, num: pn, size: 2 },
              replies: pn === 1
                ? [{ rpid: 101, message: 'c1' }, { rpid: 102, message: 'c2' }]
                : pn === 2
                ? [{ rpid: 103, message: 'c3' }]
                : [],
              hots: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const client = new BiliClient(undefined, mockFetch as unknown as typeof fetch);

      // 1. 单页请求
      const page1 = await CommentAPI.getReplies(client, 12345, 1, ReplySort.TIME, 0, 1, 2);
      expect(page1.code).toBe(0);
      expect(page1.data.replies?.length).toBe(2);
      expect(page1.data.replies?.[0].rpid).toBe(101);

      // 2. Generator 翻页
      const collected: number[] = [];
      for await (const page of CommentAPI.replies(client, 12345, 1, ReplySort.TIME, 0, 2)) {
        for (const c of page.comments) collected.push(c.rpid);
      }
      expect(collected).toEqual([101, 102, 103]);

      // 3. CommentArea 实体单页与 Generator
      const area = new CommentArea(client, 12345, 1);
      const areaPage = await area.getPage(1, ReplySort.TIME, 2);
      expect(areaPage.data.replies?.length).toBe(2);

      const areaCollected: number[] = [];
      for await (const page of area.list(ReplySort.TIME, 2)) {
        for (const c of page.comments) areaCollected.push(c.rpid);
      }
      expect(areaCollected).toEqual([101, 102, 103]);
    });

    it('CommentAPI supports both getRepliesWbi (single page) and repliesWbi (generator)', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const pagination = u.searchParams.get('pagination_str');
        const offset = pagination ? JSON.parse(pagination).offset : '';

        if (!offset) {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                cursor: { is_end: false, next: 2, pagination_reply: { next_offset: 'offset-2' } },
                replies: [{ rpid: 201 }],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        } else {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                cursor: { is_end: true, next: 3, pagination_reply: { next_offset: '' } },
                replies: [{ rpid: 202 }],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
      });

      const client = new BiliClient(undefined, mockFetch as unknown as typeof fetch);

      // 1. 单页测试
      const singleRes = await CommentAPI.getRepliesWbi(client, 999, 1, ReplyMode.HEAT);
      expect(singleRes.data.replies?.[0].rpid).toBe(201);

      // 2. Generator 测试
      const rpids: number[] = [];
      for await (const p of CommentAPI.repliesWbi(client, 999, 1, ReplyMode.HEAT)) {
        for (const c of p.comments) rpids.push(c.rpid);
      }
      expect(rpids).toEqual([201, 202]);
    });
  });

  describe('History Pagination', () => {
    it('supports getHistory (single page) and history (generator)', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const max = u.searchParams.get('max');
        if (!max) {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                cursor: { max: 100, view_at: 1000, business: 'archive', ps: 1 },
                list: [{ title: 'h1', cid: 1, history: { oid: 1, bvid: 'BV1' } }],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        } else {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                cursor: { max: 0, view_at: 0, business: 'archive', ps: 1 },
                list: [{ title: 'h2', cid: 2, history: { oid: 2, bvid: 'BV2' } }],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
      });

      const client = new BiliClient<HasToken>(undefined, mockFetch as unknown as typeof fetch);

      // 单页
      const page = await client.getHistoryPage(1);
      expect(page.list[0].title).toBe('h1');

      // 生成器
      const titles: string[] = [];
      const gen = await client.getHistory(1);
      for await (const item of gen) {
        titles.push(item.title);
      }
      expect(titles).toEqual(['h1', 'h2']);
    });
  });

  describe('Ranking Pagination', () => {
    it('supports getPopular (single page) and popular (generator)', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const pn = Number(u.searchParams.get('pn') ?? '1');
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              list: [{ bvid: `BV_${pn}`, title: `pop_${pn}` }],
              no_more: pn >= 2,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const client = new BiliClient(undefined, mockFetch as unknown as typeof fetch);

      const single = await RankingAPI.getPopular(client, 1, 10);
      expect(single.data.list[0].bvid).toBe('BV_1');

      const all: string[] = [];
      for await (const v of RankingAPI.popular(client, 10)) {
        all.push(v.bvid);
      }
      expect(all).toEqual(['BV_1', 'BV_2']);
    });
  });

  describe('User Fans & Dynamics Pagination', () => {
    it('supports getFans and fans generator on UserAPI and User entity', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        if (u.pathname.includes('/relation/fans')) {
          const pn = Number(u.searchParams.get('pn') ?? '1');
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                list: pn === 1 ? [{ mid: 10, uname: 'u1' }] : pn === 2 ? [{ mid: 20, uname: 'u2' }] : [],
                total: 2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 404 });
      });

      const client = new BiliClient(undefined, mockFetch as unknown as typeof fetch);

      // 单页
      const single = await UserAPI.getFans(client, 999, 1, 1);
      expect(single.data.list[0].mid).toBe(10);

      // 生成器
      const uids: number[] = [];
      for await (const f of UserAPI.fans(client, 999, 1)) {
        uids.push(f.mid);
      }
      expect(uids).toEqual([10, 20]);

      // Entity
      const user = new User(client, { mid: 999 } as any);
      const entityFans: number[] = [];
      for await (const f of user.fans(1)) {
        entityFans.push(f.mid);
      }
      expect(entityFans).toEqual([10, 20]);
    });
  });

  describe('FavoriteFolder Pagination', () => {
    it('supports getFolderList and folderList generator', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const pn = Number(u.searchParams.get('pn') ?? '1');
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              medias: [{ id: pn * 100, title: `fav_${pn}` }],
              has_more: pn < 2,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const client = new BiliClient(undefined, mockFetch as unknown as typeof fetch);

      const folder = new FavoriteFolder(client, { id: 888 } as any);
      const single = await folder.getMedias(10, 1);
      expect(single.medias?.[0].id).toBe(100);

      const items: number[] = [];
      for await (const m of folder.medias(10)) {
        items.push(m.id);
      }
      expect(items).toEqual([100, 200]);
    });
  });
});
