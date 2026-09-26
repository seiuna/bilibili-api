import { afterEach, describe, expect, it, vi } from 'vitest';
import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { ConfigManager } from '../../core/config.js';
import { loginByPassword, loginBySms, loginByWebQrcode, loginByTvQrcode, sendSmsCode, logout, type AuthTransport } from '../../core/auth.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const captcha = { token: 'token', challenge: 'challenge', validate: 'validate', seccode: 'validate|jordan' };
const cookies = 'SESSDATA=new; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/, bili_jct=newcsrf; Path=/';
function response(data: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { headers });
}
function config() {
  const c = new ConfigManager('offline-only');
  c.data.cookie = 'SESSDATA=old; bili_jct=oldcsrf';
  c.data.refreshToken = 'old-refresh';
  vi.spyOn(c, 'save').mockResolvedValue();
  vi.spyOn(c, 'setAuthCookies');
  vi.spyOn(c, 'mergeCookie');
  vi.spyOn(c, 'updateRefreshToken');
  return c;
}
function queue(...responses: Response[]) {
  return vi.fn<AuthTransport>(async () => {
    const next = responses.shift();
    if (!next) throw new Error('Unexpected offline request');
    return next;
  });
}
function key() { return response({ code: 0, data: { hash: 'salt-', key: pem } }); }
function password(c: ConfigManager, transport: AuthTransport, keep?: boolean) {
  return loginByPassword(c, 'user', 'password', { captcha, keep }, transport);
}
afterEach(() => vi.unstubAllGlobals());

describe('auth offline transport regressions (no profiles or network)', () => {
  it('encrypts salt+password in ESM and encodes the documented Web form', async () => {
    const c = config();
    const transport = queue(key(), response({ code: 0, data: { status: 0, refresh_token: 'fresh' } }, { 'set-cookie': cookies }));
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
    expect((await password(c, transport, true)).success).toBe(true);
    const form = new URLSearchParams(String(transport.mock.calls[1][1]?.body));
    expect(form.get('keep')).toBe('0');
    expect(form.get('token')).toBe('token');
    expect(form.get('challenge')).toBe('challenge');
    // Raw RSA decrypt avoids Node versions disabling private PKCS1 padding.
    const padded = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.from(form.get('password')!, 'base64'));
    expect(padded[0]).toBe(0); expect(padded[1]).toBe(2);
    expect(padded.subarray(padded.indexOf(0, 2) + 1).toString()).toBe('salt-password');
    expect(c.setAuthCookies).toHaveBeenCalledOnce();
    expect(c.data.cookie).toContain('SESSDATA=new');
    expect(c.data.cookie).toContain('bili_jct=newcsrf');
    expect(c.data.refreshToken).toBe('fresh');
  });

  it('rejects missing captcha token locally without a request', async () => {
    const transport = queue();
    expect((await loginByPassword(config(), 'user', 'password', undefined, transport)).success).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    { code: -629, message: 'bad password', data: null },
    { code: 0, data: { status: 2, message: 'verify phone', url: 'https://example.invalid/verify', refresh_token: 'bad' } },
    { code: 0, data: null },
    { code: 0, data: { status: 99 } },
  ])('does not persist password failure or incomplete status: %j', async data => {
    const c = config();
    const result = await password(c, queue(key(), response(data, { 'set-cookie': cookies })));
    expect(result.success).toBe(false);
    if (data.data?.status === 2) expect(result).toMatchObject({ status: 2, url: 'https://example.invalid/verify', message: 'verify phone' });
    expect(c.save).not.toHaveBeenCalled();
    expect(c.data.refreshToken).toBe('old-refresh');
  });

  it('propagates transport, HTTP, JSON and persistence failures', async () => {
    await expect(password(config(), async () => { throw new Error('offline failure'); })).rejects.toThrow('offline failure');
    await expect(password(config(), queue(new Response('{}', { status: 503 })))).rejects.toThrow('HTTP 503');
    const c = config();
    await expect(password(c, queue(key(), new Response('bad json', { headers: { 'set-cookie': cookies } })))).rejects.toThrow();
    expect(c.save).not.toHaveBeenCalled();
    vi.mocked(c.save).mockRejectedValue(new Error('disk failure'));
    await expect(password(c, queue(key(), response({ code: 0, data: { status: 0 } }, { 'set-cookie': cookies })))).rejects.toThrow('disk failure');
  });

  it('sends WEB SMS fields only and preserves raw business errors', async () => {
    const c = config(); const transport = queue(response({ code: 1003, message: 'already sent' }));
    expect((await sendSmsCode(c, 1, 13800000000, 'legacy-session', 'token', 'challenge', 'validate', 'seccode', transport)).code).toBe(1003);
    expect(Object.fromEntries(new URLSearchParams(String(transport.mock.calls[0][1]?.body)))).toEqual({ cid: '1', tel: '13800000000', source: 'main_web', token: 'token', challenge: 'challenge', validate: 'validate', seccode: 'seccode' });
    expect(c.save).not.toHaveBeenCalled();
  });

  it.each([0, 2, undefined])('persists SMS cookies only on status 0 (%s)', async status => {
    const c = config(); const transport = queue(response({ code: 0, data: { status, refresh_token: 'fresh' } }, { 'set-cookie': cookies }));
    const result = await loginBySms(c, 'captcha-key', 13800000000, 123456, 1, transport);
    expect(result.success).toBe(status === 0);
    expect(c.setAuthCookies).toHaveBeenCalledTimes(status === 0 ? 1 : 0);
    expect(new URLSearchParams(String(transport.mock.calls[0][1]?.body)).get('source')).toBe('main_web');
  });

  it('keeps QR generation cookies transient and rejects null poll data', async () => {
    const c = config(); const transport = queue(
      response({ code: 0, data: { qrcode_key: 'key', url: 'https://example.invalid/qr' } }, { 'set-cookie': 'session=temporary; Expires=Wed, 21 Oct 2030 07:28:00 GMT' }),
      response({ code: 0, data: null }, { 'set-cookie': cookies }),
    );
    expect((await loginByWebQrcode(c, { pollInterval: 0, timeout: 1000 }, transport)).success).toBe(false);
    expect(transport.mock.calls[1][1]?.headers).toEqual({ Cookie: 'SESSDATA=old; bili_jct=oldcsrf; session=temporary' });
    expect(c.save).not.toHaveBeenCalled();
  });

  it('rejects outer QR errors even if nested code claims success', async () => {
    const c = config(); const transport = queue(response({ code: 0, data: { qrcode_key: 'key', url: 'https://example.invalid/qr' } }), response({ code: -400, data: { code: 0 } }, { 'set-cookie': cookies }));
    expect((await loginByWebQrcode(c, { pollInterval: 0, timeout: 1000 }, transport)).success).toBe(false);
    expect(c.save).not.toHaveBeenCalled();
  });

  it('persists successful QR cookies only after completion', async () => {
    const c = config(); const transport = queue(
      response({ code: 0, data: { qrcode_key: 'key', url: 'https://example.invalid/qr' } }, { 'set-cookie': 'session=temporary; Path=/' }),
      response({ code: 0, data: { code: 0, refresh_token: 'qr-refresh', timestamp: 0 } }, { 'set-cookie': cookies }),
    );
    expect((await loginByWebQrcode(c, { pollInterval: 0, timeout: 1000 }, transport)).success).toBe(true);
    expect(c.mergeCookie).not.toHaveBeenCalled();
    expect(c.setAuthCookies).toHaveBeenCalledOnce();
    expect(c.data.cookie).toContain('bili_jct=newcsrf');
    expect(c.data.refreshToken).toBe('qr-refresh');
  });

  it('rejects completed password/SMS responses without cookies', async () => {
    const c = config();
    expect((await password(c, queue(key(), response({ code: 0, data: { status: 0, refresh_token: 'bad' } })))).success).toBe(false);
    expect((await loginBySms(c, 'key', 13800000000, 123456, 1, queue(response({ code: 0, data: { status: 0 } })))).success).toBe(false);
    expect(c.save).not.toHaveBeenCalled();
  });

  it('uses injected TV transport and refuses empty TV credentials', async () => {
    const c = config(); const transport = queue(response({ code: 0, data: { auth_code: 'code', url: 'https://example.invalid/qr' } }), response({ code: 0, data: {} }));
    expect((await loginByTvQrcode(c, { pollInterval: 0, timeout: 1000 }, transport)).success).toBe(false);
    expect(c.save).not.toHaveBeenCalled();
  });

  it('clears logout credentials only on business success', async () => {
    const c = config();
    expect((await logout(c, queue(response({ code: -101, message: 'failed' })))).code).toBe(-101);
    expect(c.save).not.toHaveBeenCalled();
    await logout(c, queue(response({ code: 0, data: { redirectUrl: '' } })));
    expect(c.data.cookie).toBe(''); expect(c.data.refreshToken).toBe('');
    expect(c.save).toHaveBeenCalledOnce();
  });
});
