import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { DanmakuAPI } from '../../api/danmaku.js';

// Offline transport unit tests: these do not assert live endpoint availability.
describe('Danmaku XML HTTP failures (#12)', () => {
  it('returns successful XML unchanged', async () => {
    const xml = '<?xml version="1.0"?><i><d p="1,1,25,1">hello</d></i>';
    const client = new BiliClient('offline-xml', async () => new Response(xml, {
      headers: { 'content-type': 'application/xml' },
    }));
    expect(await DanmakuAPI.getXmlDanmaku(client, 30)).toBe(xml);
  });

  it.each([
    [403, '<html>forbidden</html>', 'text/html'],
    [500, 'server failed', 'text/plain'],
    [503, '<i></i>', 'application/xml'],
  ])('rejects HTTP %i regardless of body format', async (status, body, contentType) => {
    const client = new BiliClient('offline-xml', async () => new Response(body, {
      status, headers: { 'content-type': contentType },
    }));
    await expect(DanmakuAPI.getXmlDanmaku(client, 30)).rejects.toThrow(`HTTP ${status}`);
  });

  it('propagates network rejection', async () => {
    const failure = new TypeError('network unavailable');
    const client = new BiliClient('offline-xml', async () => { throw failure; });
    await expect(DanmakuAPI.getXmlDanmaku(client, 30)).rejects.toBe(failure);
  });
});
