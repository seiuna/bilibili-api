import { describe, expect, expectTypeOf, it } from 'vitest';
import type { BiliClient } from '../../core/client.js';
import { formatImageUrl } from '../../api/common.js';
import { SearchAPI, type HotSearchData } from '../../api/search.js';
import { NoteAPI, type NoteListItem } from '../../api/note.js';

// Offline regression fixtures transcribed from api-doc/docs/search/hot.md
// and api-doc/docs/note/list.md; these tests do not claim live validation.
describe('documented raw response contracts (offline)', () => {
  it('returns the hot search trending wrapper without flattening', async () => {
    const data: HotSearchData = {
      trending: {
        title: 'bilibili热搜', trackid: '8079760748892487175', top_list: [],
        list: [{ keyword: '马克龙祝贺中国世界前两名', show_name: '马克龙祝贺中国世界前两名', icon: 'http://i0.hdslb.com/bfs/activity-plat/static/20221213/eaf2dd702d7cc14d8d9511190245d057/lrx9rnKo24.png', uri: '', goto: '' }],
      },
    };
    let requested = '';
    let signed = false;
    const client = { request: async (url: string, options: { wbi?: boolean }) => {
      requested = url;
      signed = options.wbi === true;
      return { code: 0, message: '0', data };
    } } as unknown as BiliClient<any>;
    const result = await SearchAPI.getHotSearch(client, 4);
    expect(result.data).toBe(data);
    expect(result.data.trending.list[0].keyword).toBe('马克龙祝贺中国世界前两名');
    expect(result.data).not.toHaveProperty('list');
    expect(new URL(requested).searchParams.get('limit')).toBe('4');
    expect(signed).toBe(true);
    expectTypeOf<HotSearchData['trending']['list'][number]['keyword']>().toEqualTypeOf<string>();
  });

  it('preserves the authoritative string note ID when requesting details', async () => {
    const note: NoteListItem = {
      title: '2022哔哩哔哩拜年纪', summary: ' ...', mtime: '2022-02-16 16:46',
      arc: { oid: 338677252, bvid: 'BV1fR4y1T7aV' },
      note_id: 24508729145690110, note_id_str: '24508729145690112', audit_status: 0,
      web_url: 'https://www.bilibili.com/h5/note-app?oid=338677252&oid_type=0&pagefrom=fullpage&navhide=1&-Bct.statusbar.mode=0',
      message: '更新于 2022-02-16 16:46', forbid_note_entrance: false, likes: 0, has_like: false,
    };
    const urls: URL[] = [];
    const client = {
      config: { getCsrf: () => 'offline-only' },
      request: async (url: string) => {
        urls.push(new URL(url));
        return { code: 0, message: '0', data: { list: [note], page: { total: 1, size: 10, num: 1 } } };
      },
    } as unknown as BiliClient<any>;
    const result = await NoteAPI.getUserNotes(client);
    expect(result.data.list[0]).toBe(note);
    await NoteAPI.getInfo(client, 338677252, result.data.list[0].note_id_str);
    expect(urls[1].searchParams.get('note_id')).toBe('24508729145690112');
    expectTypeOf<NoteListItem['note_id']>().toEqualTypeOf<number>();
    expectTypeOf<NoteListItem['note_id_str']>().toEqualTypeOf<string>();
    expectTypeOf<NoteListItem['mtime']>().toEqualTypeOf<string>();
    expectTypeOf<Awaited<ReturnType<typeof NoteAPI.save>>['data']['note_id']>().toEqualTypeOf<number>();
  });
});

describe('formatImageUrl (offline)', () => {
  const url = 'https://i1.hdslb.com/bfs/archive/e5fff1472bad1c0c6bcb3004205f9be23b58ffc0.jpg';
  it.each(['png', 'jpeg', 'webp', 'avif'] as const)('starts format-only %s conversion with @', format => {
    expect(formatImageUrl(url, { format })).toBe(`${url}@.${format}`);
  });
  it('preserves URLs without transformations', () => {
    expect(formatImageUrl(url)).toBe(url);
  });
  it('preserves dimension, quality and zero crop parameters', () => {
    expect(formatImageUrl(url, { width: 200, height: 100, quality: 80, crop: 0, format: 'webp' }))
      .toBe(`${url}@200w_100h_80q_0c.webp`);
    expect(formatImageUrl(url, { height: 100 })).toBe(`${url}@100h`);
  });
});
