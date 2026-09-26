import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { HistoryAPI } from '../../api/history.js';

describe('history deletion safety (offline transport)', () => {
  function setup() {
    const calls: { url: string; body: URLSearchParams }[] = [];
    const client = new BiliClient('offline-history', async (url, init) => {
      calls.push({ url: String(url), body: new URLSearchParams(String(init?.body)) });
      return Response.json({ code: 0, message: '0' });
    });
    client.config.data = { cookie: 'bili_jct=synthetic-csrf', refreshToken: '' };
    return { client, calls };
  }

  it('preserves the complete cursor and exposes later page errors', async () => {
    const urls: URL[] = [];
    const client = new BiliClient('offline-history', async url => {
      urls.push(new URL(String(url)));
      return Response.json(urls.length === 1
        ? { code: 0, message: '0', data: {
          list: [{ title: 'synthetic cursor fixture' }],
          cursor: { max: 42, view_at: 100, business: 'live', ps: 20 },
        } }
        : { code: -400, message: 'cursor rejected' });
    });
    const pages = HistoryAPI.history(client);
    expect((await pages.next()).value).toEqual({ title: 'synthetic cursor fixture' });
    await expect(pages.next()).rejects.toThrow('cursor rejected');
    expect(urls[1].searchParams.get('max')).toBe('42');
    expect(urls[1].searchParams.get('view_at')).toBe('100');
    expect(urls[1].searchParams.get('business')).toBe('live');
  });

  it('rejects legacy scoped clear rather than clearing all history', async () => {
    const { client, calls } = setup();
    // @ts-expect-error Old numeric argument is intentionally no longer supported.
    await expect(HistoryAPI.clearHistory(client, 42)).rejects.toThrow('ALL history');
    expect(calls).toHaveLength(0);
  });

  it('clears everything only with no entry argument', async () => {
    const { client, calls } = setup();
    await HistoryAPI.clearHistory(client);
    expect(calls[0].url).toBe('https://api.bilibili.com/x/v2/history/clear');
    expect([...calls[0].body]).toEqual([['csrf', 'synthetic-csrf']]);
  });

  it('deletes only the explicitly identified record preserving string IDs', async () => {
    const { client, calls } = setup();
    await HistoryAPI.deleteHistory(client, 'archive_90071992547409931234');
    expect(calls[0].url).toBe('https://api.bilibili.com/x/v2/history/delete');
    expect(calls[0].body.get('kid')).toBe('archive_90071992547409931234');
    expect(calls[0].body.get('csrf')).toBe('synthetic-csrf');
  });

  it.each(['42', '', 'archive_0', 'unknown_12'])('rejects invalid target %s without requests', async kid => {
    const { client, calls } = setup();
    await expect(HistoryAPI.deleteHistory(client, kid)).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });
});
