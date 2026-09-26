import { describe, expect, it } from 'vitest';
import { BiliApiError, type BiliClient } from '../../core/client.js';
import { DynamicAPI } from '../../api/dynamic.js';
import { MessageAPI } from '../../api/message.js';
import { FavoriteAPI } from '../../api/favorite.js';
import { NoteAPI } from '../../api/note.js';
import { ElectricAPI } from '../../api/electric.js';
import { RankingAPI } from '../../api/ranking.js';

// Offline control-flow unit tests, not remote contract/network tests.
const item = { id: 1, session_ts: 123 };
const cases: {
  name: string;
  iterate: (client: BiliClient<any>) => AsyncGenerator<unknown>;
  first: object;
  empty: object;
  cursor: [string, string];
}[] = [
  { name: 'dynamic space', iterate: c => DynamicAPI.space(c, 1), first: { items: [item], has_more: true, offset: '9007199254740993' }, empty: { items: [] }, cursor: ['offset', '9007199254740993'] },
  { name: 'reply feed', iterate: c => MessageAPI.replyFeed(c), first: { items: [item], cursor: { is_end: false, id: 2, time: 3 } }, empty: { items: [] }, cursor: ['id', '2'] },
  { name: 'at feed', iterate: c => MessageAPI.atFeed(c), first: { items: [item], cursor: { is_end: false, id: 2, time: 3 } }, empty: { items: [] }, cursor: ['id', '2'] },
  { name: 'sessions', iterate: c => MessageAPI.sessions(c), first: { session_list: [item], has_more: 1 }, empty: { session_list: null }, cursor: ['begin_ts', '123'] },
  { name: 'new sessions', iterate: c => MessageAPI.newSessions(c, 10), first: { session_list: [item], has_more: 1 }, empty: { session_list: [] }, cursor: ['begin_ts', '123'] },
  { name: 'favorite folder', iterate: c => FavoriteAPI.folderList(c, 1), first: { medias: [item], has_more: true }, empty: { medias: null }, cursor: ['pn', '2'] },
  { name: 'user notes', iterate: c => NoteAPI.userNotes(c, 1), first: { list: [item], page: { total: 2 } }, empty: { list: [] }, cursor: ['pn', '2'] },
  { name: 'charge remarks', iterate: c => ElectricAPI.chargeRemarks(c, 1), first: { list: [item], pager: { total: 2 } }, empty: { list: [] }, cursor: ['pn', '2'] },
  { name: 'popular', iterate: c => RankingAPI.popular(c), first: { list: [item], no_more: false }, empty: { list: [] }, cursor: ['pn', '2'] },
];

function queuedClient(responses: unknown[]) {
  const urls: URL[] = [];
  const client = {
    config: { getCsrf: () => 'offline-only' },
    request: async (url: string) => {
      urls.push(new URL(url));
      if (!responses.length) throw new Error('Unexpected extra request');
      return responses.shift();
    },
  } as unknown as BiliClient<any>;
  return { client, urls };
}
const ok = (data: object) => ({ code: 0, message: '0', data });

describe.each(cases)('$name pagination (offline)', testCase => {
  it.each([null, testCase.empty])('throws on a page-two error even with empty error data %j', async data => {
    const { client, urls } = queuedClient([ok(testCase.first), { code: -101, message: 'not logged in', data }]);
    const iterator = testCase.iterate(client);
    expect((await iterator.next()).done).toBe(false);
    await expect(iterator.next()).rejects.toEqual(new BiliApiError('not logged in', -101));
    expect(urls).toHaveLength(2);
    expect(urls[1].searchParams.get(testCase.cursor[0])).toBe(testCase.cursor[1]);
  });

  it('throws on a first-page business error', async () => {
    const { client, urls } = queuedClient([{ code: -352, message: 'risk control', data: null }]);
    await expect(testCase.iterate(client).next()).rejects.toEqual(new BiliApiError('risk control', -352));
    expect(urls).toHaveLength(1);
  });

  it('finishes normally on a successful empty second page', async () => {
    const { client, urls } = queuedClient([ok(testCase.first), ok(testCase.empty)]);
    const iterator = testCase.iterate(client);
    expect((await iterator.next()).done).toBe(false);
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
    expect(urls).toHaveLength(2);
  });
});
