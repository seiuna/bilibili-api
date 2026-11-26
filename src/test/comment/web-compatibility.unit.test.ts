import { describe, expect, it, vi } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { CommentArea } from '../../entities/CommentArea.js';
import { UploadAPI } from '../../api/upload.js';

// Synthetic wire-level tests; never use real credentials or public writes.
const csrf = 'synthetic-csrf';
const picture = { image_url: 'https://i0.hdslb.com/fixture.png', image_width: 12,
  image_height: 24, img_size: 1, ai_gen_pic: 1 };
function setup(devices = true, addCode = 0) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const data = url.pathname.endsWith('/spi') ? { b_3: 'fixture-3', b_4: 'fixture-4' }
      : url.pathname.endsWith('/nav') ? { wbi_img: {
        img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
        sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
      } } : { rpid_str: '9007199254740993' };
    return new Response(JSON.stringify({ code: url.pathname.endsWith('/add') ? addCode : 0, message: 'fixture', data }));
  };
  const client = new BiliClient('/synthetic-test/profile.json', transport);
  client.config.data.cookie = `SESSDATA=synthetic-session; bili_jct=${csrf}; DedeUserID=42` + (devices ? '; buvid3=existing-3; buvid4=existing-4' : '');
  vi.spyOn(client.config, 'save').mockResolvedValue();
  return { client, calls, area: new CommentArea(client, '117371171768689', 1) };
}

describe('opt-in image comment web compatibility', () => {
  it('leaves existing requests and picture metadata unchanged by default', async () => {
    const { area, calls } = setup();
    await area.add('fixture', 0, 0, [picture]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.search).toBe('');
    const body = new URLSearchParams(String(calls[0].init?.body));
    expect(body.has('csrf_token')).toBe(false);
    expect(JSON.parse(body.get('pictures')!)[0].ai_gen_pic).toBe(1);
  });

  it('signs web metadata and preserves exact reply IDs, text and AI flag', async () => {
    const { area, calls } = setup();
    await area.add('中文 & emoji 🎮', '9007199254740993', '9007199254740995', [picture], { webCompatibility: true });
    const posted = calls.find(call => call.url.pathname.endsWith('/add'))!;
    expect(calls.map(c => c.url.pathname)).toEqual(['/x/web-interface/nav', '/x/v2/reply/add']);
    const query = posted.url.searchParams;
    expect(query.get('w_rid')).toMatch(/^[a-f0-9]{32}$/);
    expect(query.get('wts')).toMatch(/^\d+$/);
    expect(query.get('web_location')).toBe('1550101');
    expect(query.get('dm_img_list')).toBe('[]');
    expect(query.get('dm_img_inter')).toBe('{"ds":[],"wh":[0,0,0],"of":[0,0,0]}');
    for (const key of ['dm_img_str', 'dm_cover_img_str']) {
      const value = query.get(key)!;
      expect(value).toMatch(/^[A-K]{2}$/);
      expect(value[0]).not.toBe(value[1]);
    }
    const body = new URLSearchParams(String(posted.init?.body));
    expect(Object.fromEntries(body)).toMatchObject({ csrf_token: csrf, csrf,
      gaia_source: 'main_web', oid: '117371171768689', root: '9007199254740993',
      parent: '9007199254740995', message: '中文 & emoji 🎮' });
    expect(body.getAll('statistics')).toEqual(['appId', 'platform']);
    expect(JSON.parse(body.get('pictures')!)[0].ai_gen_pic).toBe(1);
    expect(new Headers(posted.init?.headers).get('Referer')).toBe('https://www.bilibili.com');
  });

  it('fetches only missing device cookies via customFetch, preserves login and reuses them', async () => {
    const { client, area, calls } = setup(false);
    await area.add('fixture', 0, 0, [picture], { webCompatibility: true });
    await area.add('second synthetic call', 0, 0, [picture], { webCompatibility: true });
    expect(calls.filter(c => c.url.pathname.endsWith('/spi'))).toHaveLength(1);
    const spi = calls.find(c => c.url.pathname.endsWith('/spi'))!;
    expect(new Headers(spi.init?.headers).has('Cookie')).toBe(false);
    expect(client.config.data.cookie).toContain('SESSDATA=synthetic-session');
    expect(client.config.data.cookie).toContain('buvid3=fixture-3');
    expect(client.config.data.cookie).toContain('buvid4=fixture-4');
    expect(client.config.save).toHaveBeenCalled();
  });

  it('does not submit a comment if device cookie persistence fails', async () => {
    const { client, area, calls } = setup(false);
    vi.mocked(client.config.save).mockRejectedValue(new Error('synthetic storage failure'));
    await expect(area.add('fixture', 0, 0, [picture], { webCompatibility: true })).rejects.toThrow('storage failure');
    expect(calls.some(c => c.url.pathname.endsWith('/add'))).toBe(false);
  });

  it('preserves multipart bytes and adds matching csrf_token only when enabled', async () => {
    const { client, calls } = setup();
    const bytes = Buffer.from([137, 80, 78, 71, 0, 255, 13, 10, 128]);
    await UploadAPI.uploadBuffer(client, bytes, 'fixture.png', { webCompatibility: true });
    const call = calls[0];
    const form = await new Request(call.url, call.init).formData();
    expect(form.get('csrf')).toBe(csrf);
    expect(form.get('csrf_token')).toBe(csrf);
    expect(Buffer.from(await (form.get('file_up') as File).arrayBuffer())).toEqual(bytes);
    await UploadAPI.uploadBuffer(client, bytes, 'fixture.png');
    const legacy = await new Request(calls[1].url, calls[1].init).formData();
    expect(legacy.has('csrf_token')).toBe(false);
  });

  it('retains checked API errors and does not retry a rejected business write', async () => {
    const { area, calls } = setup(true, -403);
    await expect(area.add('fixture', 0, 0, [picture], { webCompatibility: true })).rejects.toThrow();
    expect(calls.filter(c => c.url.pathname.endsWith('/add'))).toHaveLength(1);
  });
});
