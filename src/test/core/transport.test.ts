import { describe, expect, it, vi } from 'vitest';
import { BiliClient, BiliApiError } from '../../core/client.js';
import { wbiSign } from '../../core/sign.js';

const endpoint = 'https://api.bilibili.com/test';
function setup(fetcher: typeof fetch) {
  const client = new BiliClient('offline-transport', fetcher);
  client.config.data = { cookie: 'SESSDATA=old; bili_jct=oldcsrf; retained=yes', refreshToken: 'old-token' };
  const saves: object[] = [];
  vi.spyOn(client.config, 'save').mockImplementation(async () => { saves.push({ ...client.config.data }); });
  return { client, saves };
}

describe('transport regressions (offline synthetic responses, no real credentials)', () => {
  it.each([false, true])('merges refresh cookies and persists rotated token together (fallback=%s)', async fallback => {
    const sent: Headers[] = [];
    let calls = 0;
    const { client, saves } = setup(async (_url, init) => {
      sent.push(new Headers(init?.headers));
      if (++calls === 1) return Response.json({ code: -101 });
      if (calls === 2) {
        const headers = new Headers();
        headers.append('Set-Cookie', 'SESSDATA=new; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/; HttpOnly');
        headers.append('Set-Cookie', 'bili_jct=newcsrf; Path=/; Secure');
        const res = Response.json({ code: 0, data: { refresh_token: 'new-token' } }, { headers });
        if (fallback) Object.defineProperty(res.headers, 'getSetCookie', { value: undefined });
        return res;
      }
      return Response.json({ code: 0 });
    });
    await expect(client.request(endpoint)).resolves.toEqual({ code: 0 });
    expect(calls).toBe(3);
    expect(saves).toEqual([{ cookie: 'SESSDATA=new; bili_jct=newcsrf; retained=yes', refreshToken: 'new-token' }]);
    expect(sent[2].get('Cookie')).toBe('SESSDATA=new; bili_jct=newcsrf; retained=yes');
  });

  it.each(['https://third-party.example/file', endpoint])('strips caller credentials in anonymous request %s and never refreshes', async url => {
    let calls = 0;
    const { client, saves } = setup(async (_url, init) => {
      calls++;
      expect(new Headers(init?.headers).has('Cookie')).toBe(false);
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      return Response.json({ code: -101 }, { headers: { 'Set-Cookie': 'SESSDATA=poison' } });
    });
    await expect(client.request(url, { ...(url === endpoint ? { anonymous: true } : {}), headers: { cookie: 'caller-secret', AUTHORIZATION: 'caller-secret' } })).resolves.toEqual({ code: -101 });
    expect(calls).toBe(1);
    expect(saves).toEqual([]);
  });

  it('does not refresh external -101 even when caller explicitly opts into credentials', async () => {
    let calls = 0;
    const { client } = setup(async () => { calls++; return Response.json({ code: -101 }); });
    await client.request('https://external.example', { anonymous: false });
    expect(calls).toBe(1);
  });

  it('propagates malformed JSON instead of an empty success object', async () => {
    const { client } = setup(async () => new Response('not json'));
    await expect(client.request(endpoint)).rejects.toBeInstanceOf(SyntaxError);
  });

  it('rejects HTTP errors in JSON transport but preserves raw Response status/body', async () => {
    const { client } = setup(async () => new Response('upstream failed', { status: 503 }));
    await expect(client.request(endpoint)).rejects.toThrow('HTTP 503');
    const raw = await client.rawRequest(endpoint);
    expect(raw.status).toBe(503);
    expect(await raw.text()).toBe('upstream failed');
  });

  it.each(['network', 'json', 'http', 'business', 'shape'])('ensureLogin does not fall back to QR on %s failure', async kind => {
    let calls = 0;
    const { client } = setup(async () => {
      calls++;
      if (kind === 'network') throw new Error('offline');
      if (kind === 'json') return new Response('broken');
      if (kind === 'http') return new Response('failed', { status: 500 });
      if (kind === 'business') return Response.json({ code: -352, message: 'risk control' });
      return Response.json({ code: 0, data: {} });
    });
    await expect(client.ensureLogin()).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('falls back to QR exactly once when the initial nav refresh is explicitly rejected as unauthenticated', async () => {
    const urls: string[] = [];
    const { client } = setup(async url => {
      urls.push(String(url));
      if (urls.length <= 2) return Response.json({ code: -101, message: 'expired' });
      // Stop before generating/polling a QR: reaching this endpoint proves fallback.
      return Response.json({ code: -400, message: 'offline QR sentinel' });
    });
    await expect(client.ensureLogin()).rejects.toThrow('offline QR sentinel');
    expect(urls).toEqual([
      'https://api.bilibili.com/x/web-interface/nav',
      'https://passport.bilibili.com/x/passport-login/web/cookie/refresh',
      'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
    ]);
  });

  it('propagates non-auth refresh rejection without QR fallback', async () => {
    let calls = 0;
    const { client } = setup(async () => {
      calls++;
      return Response.json(calls === 1 ? { code: 0, data: { isLogin: false } } : { code: -352, message: 'risk' });
    });
    await expect(client.ensureLogin()).rejects.toThrow('Token');
    expect(calls).toBe(2);
  });

  it('never blindly replays a write with stale CSRF after refresh', async () => {
    let calls = 0;
    const { client } = setup(async () => {
      calls++;
      return calls === 1 ? Response.json({ code: -101 }) : Response.json({ code: 0, data: { refresh_token: 'new-token' } }, { headers: { 'Set-Cookie': 'bili_jct=newcsrf; Path=/' } });
    });
    await expect(client.request(endpoint, { method: 'POST', body: 'csrf=oldcsrf' })).rejects.toThrow('CSRF');
    expect(calls).toBe(2);
    expect(client.config.getCsrf()).toBe('newcsrf');
  });

  it('checks HTTP status on refresh retry', async () => {
    let calls = 0;
    const { client } = setup(async () => {
      calls++;
      if (calls === 1) return Response.json({ code: -101 });
      if (calls === 2) return Response.json({ code: 0, data: {} });
      return new Response('failed', { status: 502 });
    });
    await expect(client.request(endpoint)).rejects.toThrow('HTTP 502');
  });

  it('preserves WBI duplicate values and replaces stale signature fields', async () => {
    let target = '';
    const { client } = setup(async url => { target = String(url); return Response.json({ code: 0 }); });
    Object.assign(client.config.data, { wbiImgKey: 'a'.repeat(32), wbiSubKey: 'b'.repeat(32), wbiExpireAt: Date.now() + 60000 });
    await client.request(endpoint + '?tag=first&tag=second&empty=&w_rid=old&wts=1&wts=2', { wbi: true });
    const params = new URL(target).searchParams;
    expect(params.getAll('tag')).toEqual(['first', 'second']);
    expect(params.get('empty')).toBe('');
    expect(params.getAll('wts')).toHaveLength(1);
    expect(params.getAll('w_rid')).toHaveLength(1);
    expect(params.get('w_rid')).not.toBe('old');
    expect(wbiSign({ tag: 'single' }, 'a'.repeat(32), 'b'.repeat(32))).toHaveProperty('tag', 'single');
  });

  it('facades reject business errors before constructing entities', async () => {
    const { client } = setup(async () => Response.json({ code: -404, message: 'missing', data: null }));
    await expect(client.getVideo('BVtest')).rejects.toBeInstanceOf(BiliApiError);
    await expect(client.getComment('90071992547409931', 17, '123')).rejects.toBeInstanceOf(BiliApiError);
  });
});
