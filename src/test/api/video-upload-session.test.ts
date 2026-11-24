import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BiliClient, type HasToken } from '../../core/client.js';
import {
  COPYRIGHT,
  CREATION_STATEMENT,
  CreativeAPI,
  SPACE_HIDDEN,
  extractUposFilename,
  type PreuploadResult,
} from '../../api/creative.js';
import { VideoUploadSession } from '../../entities/VideoUploadSession.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bili-upload-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function makeTicket(overrides: Partial<PreuploadResult> = {}): PreuploadResult {
  return {
    OK: 1,
    auth: 'offline-auth',
    biz_id: 43854333250,
    chunk_size: 10485760,
    chunk_retry: 2,
    chunk_retry_delay: 0,
    endpoint: '//upos-cs-offline.bilivideo.com',
    endpoints: ['//upos-cs-offline.bilivideo.com', '//upos-cs-backup.bilivideo.com'],
    threads: 3,
    timeout: 1200,
    upos_uri: 'upos://ugcfxever/n261121offline.mp4',
    ...overrides,
  };
}

const offlineClient = {
  config: { getCsrf: () => 'offline-csrf' },
  request: async () => {
    throw new Error('offline test must not hit the network');
  },
  rawRequest: async () => {
    throw new Error('offline test must not hit the network');
  },
} as unknown as BiliClient<any>;

function makeSession(filename = 'my-video.mp4', ticketOverrides: Partial<PreuploadResult> = {}): VideoUploadSession {
  return new VideoUploadSession(
    offlineClient,
    makeTicket(ticketOverrides),
    `/tmp/${filename}`,
    filename,
    12_582_912,
  );
}

function makeFakeClient(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): BiliClient<HasToken> {
  const client = new BiliClient<HasToken>('offline-upload-test', handler as unknown as typeof fetch);
  client.config.data.cookie = 'SESSDATA=fake-sess; bili_jct=fake-csrf; DedeUserID=12345';
  client.config.data.wbiImgKey = '7cd084941338484aae1ad9425b84077c';
  client.config.data.wbiSubKey = '4932caff0ff746eab6f01bf08b70ac45';
  client.config.data.wbiExpireAt = Date.now() + 60_000;
  return client;
}

describe('CreativeAPI helpers (offline)', () => {
  it('extracts the server-assigned stem from upos_uri', () => {
    expect(extractUposFilename('upos://ugcfxever/n261121a2103f7vfwl9so5v57l4altsd.mp4')).toBe(
      'n261121a2103f7vfwl9so5v57l4altsd',
    );
    expect(() => extractUposFilename('upos://')).toThrow('无效的 upos_uri');
  });

  it('normalizes endpoint schemes in uploadBaseUrl', () => {
    const ticket = makeTicket();
    expect(CreativeAPI.uploadBaseUrl(ticket)).toBe(
      'https://upos-cs-offline.bilivideo.com/ugcfxever/n261121offline.mp4',
    );
    expect(CreativeAPI.uploadBaseUrl(ticket, 'https://upos-alt.bilivideo.com/')).toBe(
      'https://upos-alt.bilivideo.com/ugcfxever/n261121offline.mp4',
    );
  });
});

describe('VideoUploadSession metadata (offline)', () => {
  it('uses server upos_uri filename stem instead of local filename stem', () => {
    const s = makeSession('我的本地视频.v2.mp4', {
      upos_uri: 'upos://ugcfxever/n261121srv999.mp4',
    });
    expect(s.biliFilename).toBe('n261121srv999');
    expect(s.stem).toBe('n261121srv999');
  });

  it('updates fileSize dynamically when parts are added and rejects 0-byte files', async () => {
    const dir = await makeTempDir();
    const p1 = path.join(dir, 'p1.mp4');
    const p2 = path.join(dir, 'p2.mp4');
    const empty = path.join(dir, 'empty.mp4');
    await fs.writeFile(p1, Buffer.alloc(100));
    await fs.writeFile(p2, Buffer.alloc(250));
    await fs.writeFile(empty, Buffer.alloc(0));

    expect(() => new VideoUploadSession(offlineClient, makeTicket(), empty, 'empty.mp4', 0)).toThrow(
      '文件为空',
    );

    const s = new VideoUploadSession(offlineClient, makeTicket(), p1, 'p1.mp4', 100);
    expect(s.fileSize).toBe(100);
    await s.addPart(p2, { title: '第二P' });
    expect(s.fileSize).toBe(350);
    await expect(s.addPart(empty)).rejects.toThrow('文件为空');
  });

  it('validates title length and emptiness', () => {
    const s = makeSession();
    expect(() => s.setTitle('')).toThrow('标题不能为空');
    expect(() => s.setTitle('   ')).toThrow('标题不能为空');
    expect(() => s.setTitle('x'.repeat(81))).toThrow('最多 80 字');
    expect(s.setTitle('  合法标题  ').meta.title).toBe('合法标题');
  });

  it('accepts comma-separated or array tags and caps at 10', () => {
    const s = makeSession();
    expect(s.setTags('a, b ,,c').meta.tags).toEqual(['a', 'b', 'c']);
    expect(s.setTags(['x', ' y ']).meta.tags).toEqual(['x', 'y']);
    expect(() => s.setTags(Array.from({ length: 11 }, (_, i) => `t${i}`))).toThrow('最多 10 个');
  });

  it('rejects invalid partition ids', () => {
    const s = makeSession();
    expect(() => s.setPartition(0)).toThrow('tid 必须是正整数');
    expect(() => s.setPartition(-1)).toThrow('tid 必须是正整数');
    expect(() => s.setPartition(1.5)).toThrow('tid 必须是正整数');
    expect(s.setPartition(208, 1012).meta).toMatchObject({ tid: 208, humanType2: 1012 });
  });

  it('derives copyright from the creation statement', () => {
    const s = makeSession();
    expect(s.setCreationStatement(CREATION_STATEMENT.REPRINT).copyright).toBe(COPYRIGHT.REPRINT);
    expect(s.setCreationStatement(12).copyright).toBe(COPYRIGHT.ORIGINAL);
    expect(s.setCopyright(COPYRIGHT.UNSELECTED).copyright).toBe(COPYRIGHT.UNSELECTED);
  });

  it('enforces the 5-minute / 15-day scheduling window', () => {
    const s = makeSession();
    expect(() => s.setScheduleAt(new Date(Date.now() + 60_000))).toThrow('最早需距离当前 5 分钟');
    expect(() => s.setScheduleAt(new Date(Date.now() + 20 * 24 * 3600_000))).toThrow('不超过 15 天');
    expect(s.setScheduleAt(new Date(Date.now() + 3600_000)).meta.dtime).toBeGreaterThan(0);
    expect(s.setScheduleAt(null).meta.dtime).toBe(0);
  });

  it('clears rich-text nodes when plain description or dynamic overwrites them', async () => {
    const s = makeSession()
      .setTitle('t')
      .setTags('a')
      .setPartition(208)
      .setDescriptionRich([{ raw_text: '@某人 ', type: 2, biz_id: '123' }])
      .setDescription('纯文本简介')
      .setDynamicRich([{ raw_text: '#话题#', type: 1 }])
      .setDynamic('纯文本动态');

    const payload = await s.buildArchivePayload();
    expect(payload.desc).toBe('纯文本简介');
    expect(payload).not.toHaveProperty('desc_v2');
    expect(payload.dynamic).toBe('纯文本动态');
    expect(payload).not.toHaveProperty('dynamic_v2');
  });

  it('rejects descriptions and dynamics over their limits', () => {
    const s = makeSession();
    expect(() => s.setDescription('x'.repeat(2001))).toThrow('最多 2000 字');
    expect(() => s.setDynamic('x'.repeat(234))).toThrow('最多 233 字');
    expect(() => s.setDynamicRich([{ raw_text: 'x'.repeat(234) }])).toThrow('最多 233 字');
  });

  it('only accepts .srt subtitles', () => {
    expect(() => makeSession().addSubtitle('/tmp/sub.vtt')).toThrow('.srt');
  });
});

describe('VideoUploadSession payload mapping (offline)', () => {
  it('requires title, tags, and reprint source before building payload', async () => {
    await expect(makeSession().buildArchivePayload()).rejects.toThrow('请先 setTitle()');
    await expect(makeSession().setTitle('t').buildArchivePayload()).rejects.toThrow('请先 setTags()');
    await expect(
      makeSession()
        .setTitle('t')
        .setTags('a')
        .setPartition(122)
        .setCreationStatement(CREATION_STATEMENT.REPRINT)
        .buildArchivePayload(),
    ).rejects.toThrow('setSource()');
  });

  it('refuses to publish before the file is uploaded', async () => {
    await expect(makeSession().setTitle('t').setTags('a').publish()).rejects.toThrow('请先 upload()');
  });

  it('rejects scheduling combined with self-only visibility', async () => {
    const s = makeSession()
      .setTitle('t')
      .setTags('a')
      .setPartition(208)
      .setVisibility('self')
      .setScheduleAt(new Date(Date.now() + 3600_000));
    await expect(s.buildArchivePayload()).rejects.toThrow('互斥');
  });

  it('maps every 发布视频 setting accurately onto the add/v3 payload', async () => {
    const s = makeSession('我的本地视频.mp4')
      .setTitle('标题')
      .setTags(['标签1', '标签2'])
      .setPartition(208, 1012)
      .setCreationStatement(12)
      .setDescription('简介')
      .setDynamic('动态文案')
      .setVisibility('public')
      .setSpaceHidden(true)
      .setWatermark(true)
      .setAllowRecreate(false)
      .setPushToDynamic(false)
      .setCloseDanmaku(true)
      .setCloseReply(true)
      .setSelectionReply(true)
      .setDolby(true)
      .setLosslessMusic(true)
      .setHasChapter(true)
      .setSubtitle(false, 'zh-CN')
      .setIs360(true)
      .setStaffs([{ title: '联合投稿', mid: 2 }]);

    const payload = await s.buildArchivePayload();

    expect(payload.videos).toEqual([
      { filename: 'n261121offline', title: '标题', desc: '', cid: 43854333250 },
    ]);
    expect(payload).toMatchObject({
      title: '标题',
      tid: 208,
      human_type2: 1012,
      tag: '标签1,标签2',
      desc: '简介',
      dynamic: '动态文案',
      creation_statement: { id: 12 },
      copyright: COPYRIGHT.ORIGINAL,
      desc_format_id: 0,
      is_only_self: 0,
      space_hidden: SPACE_HIDDEN.HIDE,
      watermark: { state: 1 },
      // 自制 → 禁止转载
      no_reprint: 1,
      // 不允许二创 → -1
      recreate: -1,
      // 不推送到动态（免打扰） → 1
      no_disturbance: 1,
      is_360: 1,
      has_chapter: true,
      subtitle: { open: 1, lan: 'zh-CN' },
      dolby: 1,
      lossless_music: 1,
      up_close_danmu: true,
      up_close_reply: true,
      up_selection_reply: true,
      staffs: [{ title: '联合投稿', mid: 2 }],
      handle_staff: true,
    });
    expect(payload).not.toHaveProperty('cover');
    expect(payload).not.toHaveProperty('dtime');
  });

  it('derives no_reprint and source from a reprint statement', async () => {
    const payload = await makeSession()
      .setTitle('t')
      .setTags('a')
      .setPartition(122)
      .setCreationStatement(CREATION_STATEMENT.REPRINT)
      .setSource('https://example.com/source')
      .buildArchivePayload();

    expect(payload.copyright).toBe(COPYRIGHT.REPRINT);
    expect(payload.no_reprint).toBe(0);
    expect(payload.source).toBe('https://example.com/source');
    expect(payload.creation_statement).toEqual({ id: CREATION_STATEMENT.REPRINT });
  });

  it('defaults to public, visible in space, no watermark, recreate=1, pushToDynamic(no_disturbance=0)', async () => {
    const payload = await makeSession()
      .setTitle('t')
      .setTags('a')
      .setPartition(122)
      .buildArchivePayload();

    expect(payload.is_only_self).toBe(0);
    expect(payload.space_hidden).toBe(SPACE_HIDDEN.SHOW);
    expect(payload.watermark).toEqual({ state: 0 });
    expect(payload.no_reprint).toBe(1);
    expect(payload.recreate).toBe(1);
    expect(payload.no_disturbance).toBe(0);
    expect(payload.desc_format_id).toBe(0);
    expect(payload).not.toHaveProperty('human_type2');
  });
});

describe('CreativeAPI & VideoUploadSession transport contracts (offline)', () => {
  it('uploads chunks via upos anonymously, rotates backup endpoint on retry, and rejects concurrent upload()', async () => {
    const dir = await makeTempDir();
    const videoFile = path.join(dir, 'local-video.mp4');
    // 1024 bytes with chunk_size=400 -> 3 chunks (400, 400, 224)
    const content = Buffer.alloc(1024, 0xab);
    await fs.writeFile(videoFile, content);

    const calls: { url: string; method: string; headers: Headers; body?: unknown }[] = [];
    let part2Attempts = 0;

    const client = makeFakeClient(async (url, init) => {
      const headers = new Headers(init?.headers);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, headers, body: init?.body });

      const u = new URL(url);
      if (u.pathname === '/preupload') {
        return new Response(
          JSON.stringify(
            makeTicket({
              biz_id: 987654321,
              chunk_size: 400,
              chunk_retry: 1,
              chunk_retry_delay: 0,
              endpoint: '//upos-primary.bilivideo.com',
              endpoints: ['//upos-primary.bilivideo.com', '//upos-backup.bilivideo.com'],
              upos_uri: 'upos://ugcfxever/n261123uploaded.mp4',
            }),
          ),
          { status: 200 },
        );
      }
      if (u.hostname.includes('bilivideo.com')) {
        // Never leak SESSDATA to CDN
        expect(headers.get('cookie')).toBeNull();
        expect(headers.get('x-upos-auth')).toBe('offline-auth');
      }
      if (method === 'POST' && u.searchParams.has('uploads')) {
        return new Response(
          JSON.stringify({ OK: 1, bucket: 'ugcfxever', key: '/n261123uploaded.mp4', upload_id: 'uid-1' }),
          { status: 200 },
        );
      }
      if (method === 'PUT') {
        const partNum = u.searchParams.get('partNumber');
        if (partNum === '2') {
          part2Attempts += 1;
          if (part2Attempts === 1) {
            expect(u.hostname).toBe('upos-primary.bilivideo.com');
            return new Response('transient error', { status: 502 });
          }
          expect(u.hostname).toBe('upos-backup.bilivideo.com');
        }
        return new Response('MULTIPART_PUT_SUCCESS', { status: 200 });
      }
      if (method === 'POST' && u.searchParams.get('uploadId') === 'uid-1') {
        const body = JSON.parse(String(init?.body));
        expect(body.parts).toEqual([
          { partNumber: 1, eTag: '' },
          { partNumber: 2, eTag: '' },
          { partNumber: 3, eTag: '' },
        ]);
        return new Response(
          JSON.stringify({ OK: 1, location: 'ugcfxever/n261123uploaded.mp4' }),
          { status: 200 },
        );
      }
      if (method === 'GET' && u.pathname.endsWith('n261123uploaded.mp4')) {
        return new Response(null, { status: 200, headers: { 'content-length': '1024' } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const session = await client.createVideoUpload(videoFile, { concurrency: 1 });
    expect(session.biliFilename).toBe('n261123uploaded');

    const p1 = session.upload();
    await expect(session.upload()).rejects.toThrow('请勿并发重复调用 upload()');
    await p1;

    expect(session.uploaded).toBe(true);
    expect(part2Attempts).toBe(2);
    expect(calls.some((c) => c.method === 'GET' && c.url.endsWith('n261123uploaded.mp4'))).toBe(true);
  });

  it('publishes cover (as base64 data URL), cover43, pre-saved subtitles, WBI-signed add/v3, and season episodes', async () => {
    const dir = await makeTempDir();
    const videoFile = path.join(dir, 'local.mp4');
    const coverFile = path.join(dir, 'cover16x9.png');
    const cover43File = path.join(dir, 'cover4x3.webp');
    const srtFile = path.join(dir, 'zh.srt');
    await fs.writeFile(videoFile, Buffer.from('video-bytes'));
    await fs.writeFile(coverFile, Buffer.from('png-bytes'));
    await fs.writeFile(cover43File, Buffer.from('webp-bytes'));
    await fs.writeFile(srtFile, '1\n00:00:00,000 --> 00:00:01,000\nhi\n', 'utf8');

    const sequence: string[] = [];
    const captured: { addPayload?: Record<string, any>; addUrl: string } = { addUrl: '' };
    const coverFields: string[] = [];

    const client = makeFakeClient(async (url, init) => {
      const u = new URL(url);
      const method = init?.method ?? 'GET';
      sequence.push(`${method} ${u.pathname}`);

      if (u.pathname === '/preupload') {
        return new Response(
          JSON.stringify(makeTicket({ biz_id: 777888, chunk_size: 1024, upos_uri: 'upos://ugcfxever/n261123pub.mp4' })),
          { status: 200 },
        );
      }
      if (method === 'POST' && u.searchParams.has('uploads')) {
        return new Response(JSON.stringify({ OK: 1, bucket: 'ugcfxever', key: '/n261123pub.mp4', upload_id: 'u1' }));
      }
      if (method === 'PUT') return new Response('MULTIPART_PUT_SUCCESS');
      if (method === 'POST' && u.searchParams.get('uploadId') === 'u1') {
        return new Response(JSON.stringify({ OK: 1 }));
      }
      if (method === 'GET' && u.pathname.endsWith('n261123pub.mp4')) {
        return new Response(null, { status: 200, headers: { 'content-length': String(Buffer.byteLength('video-bytes')) } });
      }
      if (u.pathname === '/x/upload/web/image') {
        return new Response(
          JSON.stringify({ code: 0, message: '0', ttl: 1, data: { location: 'https://i0.hdslb.com/bfs/subtitle/sub.srt' } }),
        );
      }
      if (u.pathname === '/x/v2/dm/subtitle/draft/preSave') {
        const fd = init?.body as FormData;
        expect(fd.get('type')).toBe('1');
        expect(fd.get('aid')).toBe('0');
        expect(fd.get('oid')).toBe('777888');
        expect(JSON.parse(String(fd.get('files')))).toEqual([
          { url: 'http://i0.hdslb.com/bfs/subtitle/sub.srt', lan: 'zh-CN', subtitle_id: 0 },
        ]);
        return new Response(JSON.stringify({ code: 0, message: '0', ttl: 1, data: {} }));
      }
      if (u.pathname === '/x/vu/web/cover/up') {
        const fd = init?.body as FormData;
        const coverVal = fd.get('cover');
        expect(typeof coverVal).toBe('string');
        expect(String(coverVal)).toMatch(/^data:image\/(png|webp);base64,/);
        coverFields.push(String(coverVal));
        return new Response(
          JSON.stringify({
            code: 0,
            message: '0',
            ttl: 1,
            data: { url: `https://i0.hdslb.com/bfs/archive/${coverFields.length}.jpg` },
          }),
        );
      }
      if (u.pathname === '/x/vu/web/add/v3') {
        captured.addUrl = url;
        captured.addPayload = JSON.parse(String(init?.body));
        expect(u.searchParams.get('w_rid')).toMatch(/^[a-f0-9]{32}$/);
        expect(u.searchParams.get('wts')).toMatch(/^\d+$/);
        expect(u.searchParams.get('csrf')).toBe('fake-csrf');
        return new Response(JSON.stringify({ code: 0, message: '0', ttl: 1, data: { aid: 10001, bvid: 'BV1test' } }));
      }
      if (u.pathname === '/x2/creative/web/seasons') {
        return new Response(
          JSON.stringify({
            code: 0,
            message: '0',
            ttl: 1,
            data: {
              seasons: [
                {
                  season: { id: 55, title: '合集A' },
                  sections: { sections: [{ id: 6601, title: '正片' }] },
                },
              ],
            },
          }),
        );
      }
      if (u.pathname === '/x2/creative/web/season/section/episodes/add') {
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({
          sectionId: 6601,
          episodes: [{ title: '投稿标题', cid: 777888, aid: 10001 }],
          csrf: 'fake-csrf',
        });
        return new Response(JSON.stringify({ code: 0, message: '0', ttl: 1, data: {} }));
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const session = await client.createVideoUpload(videoFile);
    const result = await session
      .setTitle('投稿标题')
      .setPartition(208, 1012)
      .setTags(['编程'])
      .setCover(coverFile, cover43File)
      .addSubtitle(srtFile, 'zh-CN')
      .setSeason(55)
      .submit();

    expect(result).toEqual({ aid: 10001, bvid: 'BV1test' });
    expect(captured.addUrl).toContain('web_location=333.1024');
    expect(captured.addPayload?.videos).toEqual([
      {
        filename: 'n261123pub',
        title: '投稿标题',
        desc: '',
        cid: 777888,
        pre_subtitle: true,
      },
    ]);
    expect(captured.addPayload?.cover).toBe('https://i0.hdslb.com/bfs/archive/1.jpg');
    expect(captured.addPayload?.cover43).toBe('https://i0.hdslb.com/bfs/archive/2.jpg');

    // Subtitle preSave runs BEFORE add/v3, season episode addition runs AFTER add/v3
    const preSaveIdx = sequence.indexOf('POST /x/v2/dm/subtitle/draft/preSave');
    const addIdx = sequence.indexOf('POST /x/vu/web/add/v3');
    const seasonIdx = sequence.indexOf('POST /x2/creative/web/season/section/episodes/add');
    expect(preSaveIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(preSaveIdx);
    expect(seasonIdx).toBeGreaterThan(addIdx);
  });

  it('propagates subtitle and season errors instead of swallowing them silently', async () => {
    const dir = await makeTempDir();
    const videoFile = path.join(dir, 'v.mp4');
    const srtFile = path.join(dir, 's.srt');
    await fs.writeFile(videoFile, Buffer.from('abc'));
    await fs.writeFile(srtFile, '1\n00:00:00,000 --> 00:00:01,000\nhi\n');

    let failMode: 'subtitle' | 'season' = 'subtitle';
    const client = makeFakeClient(async (url, init) => {
      const u = new URL(url);
      const method = init?.method ?? 'GET';
      if (u.pathname === '/preupload') {
        return new Response(JSON.stringify(makeTicket({ biz_id: 111, chunk_size: 100 })));
      }
      if (method === 'POST' && u.searchParams.has('uploads')) {
        return new Response(JSON.stringify({ OK: 1, bucket: 'b', key: '/k', upload_id: 'u' }));
      }
      if (method === 'PUT') return new Response('MULTIPART_PUT_SUCCESS');
      if (method === 'POST' && u.searchParams.get('uploadId') === 'u') {
        return new Response(JSON.stringify({ OK: 1 }));
      }
      if (method === 'GET' && u.pathname.endsWith('n261121offline.mp4')) {
        return new Response(null, { status: 200, headers: { 'content-length': '3' } });
      }
      if (u.pathname === '/x/upload/web/image') {
        return new Response(
          JSON.stringify({ code: 0, message: '0', ttl: 1, data: { location: 'https://i0.hdslb.com/s.srt' } }),
        );
      }
      if (u.pathname === '/x/v2/dm/subtitle/draft/preSave') {
        if (failMode === 'subtitle') {
          return new Response(JSON.stringify({ code: -400, message: '字幕格式非法', ttl: 1, data: null }));
        }
        return new Response(JSON.stringify({ code: 0, message: '0', ttl: 1, data: {} }));
      }
      if (u.pathname === '/x/vu/web/add/v3') {
        return new Response(JSON.stringify({ code: 0, message: '0', ttl: 1, data: { aid: 88, bvid: 'BV88' } }));
      }
      if (u.pathname === '/x2/creative/web/season/section/episodes/add') {
        return new Response(JSON.stringify({ code: 20001, message: '合集已满', ttl: 1, data: null }));
      }
      throw new Error(`Unexpected: ${method} ${url}`);
    });

    const s1 = await client.createVideoUpload(videoFile);
    s1.setTitle('t').setPartition(208).setTags('a').addSubtitle(srtFile, 'zh-CN');
    await expect(s1.submit()).rejects.toThrow('字幕格式非法');

    failMode = 'season';
    const s2 = await client.createVideoUpload(videoFile);
    s2.setTitle('t').setPartition(208).setTags('a').setSeason(55, 66);
    await expect(s2.submit()).rejects.toThrow('BV88');
  });

  it('uses GET query for precheck and omits draft-incompatible fields in saveDraft', async () => {
    const seen: { precheckMethod?: string; precheckUrl?: string; draftBody?: Record<string, any> } = {};
    const client = makeFakeClient(async (url, init) => {
      const u = new URL(url);
      if (u.pathname === '/x/vupre/web/archive/precheck') {
        seen.precheckMethod = init?.method ?? 'GET';
        seen.precheckUrl = url;
        return new Response(JSON.stringify({ code: 0, message: 'OK', ttl: 1, data: {} }));
      }
      if (u.pathname === '/x/vupre/web/draft/add') {
        seen.draftBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ code: 0, message: 'OK', ttl: 1, data: { draft_id: 1 } }));
      }
      throw new Error(`Unexpected: ${url}`);
    });

    await CreativeAPI.precheck(client, '测试标题', 2);
    expect(seen.precheckMethod).toBe('GET');
    expect(new URL(seen.precheckUrl!).searchParams.get('content')).toBe('测试标题');
    expect(new URL(seen.precheckUrl!).searchParams.get('check_item')).toBe('2');

    const payload = await makeSession().setTitle('草稿').setTags('a').setPartition(208).buildArchivePayload();
    payload.videos[0]!.pre_command = true;
    await CreativeAPI.saveDraft(client, payload);
    expect(seen.draftBody).not.toHaveProperty('desc_format_id');
    expect(seen.draftBody).not.toHaveProperty('interactive');
    expect(seen.draftBody?.videos[0]).not.toHaveProperty('pre_command');
  });
});
