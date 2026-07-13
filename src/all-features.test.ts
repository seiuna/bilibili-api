import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import { BiliClient } from './client.js';
import { ConfigManager } from './config.js';
import { signParams, buildSignedQuery } from './sign.js';
import { CommentArea } from './api/comment-area.js';
import { CommentAPI } from './api/comment.js';
import { UserQuery } from './queries/user.js';
import {
  ReplySort,
  ReplyMode,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
} from './api/types.js';
import { KNOWN_APPKEYS, QrcodeStatus } from './types.js';

// 取出 AsyncGenerator 每次 yield 的类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Yielded<T> = T extends AsyncGenerator<infer Y, any, any> ? Y : never;

// 一个长期存在的公开视频，用于只读测试
const TEST_BVID = 'BV1GJ411x7h7';
const TEST_CONFIG_PATH = './tmp-test-config.json';

let anonClient: BiliClient;
let authClient: BiliClient | null = null;
let loggedIn = false;

beforeAll(async () => {
  anonClient = await BiliClient.create();
  try {
    authClient = await BiliClient.create('./bili-config.json');
    const { loggedIn: ok } = await authClient.isLoggedIn();
    loggedIn = ok;
  } catch {
    // 没有凭证时跳过需要登录的测试
  }
}, 30_000);

afterAll(async () => {
  try {
    await fs.unlink(TEST_CONFIG_PATH);
  } catch {
    // ignore
  }
});

// ==========================================
// 纯工具函数
// ==========================================

describe('ConfigManager', () => {
  test('解析、合并、更新 cookie', async () => {
    const cm = new ConfigManager(TEST_CONFIG_PATH);
    await cm.load();

    await cm.mergeCookie('SESSDATA=aaa; Path=/; HttpOnly');
    expect(cm.data.cookie).toContain('SESSDATA=aaa');

    await cm.updateCookie('SESSDATA=bbb; bili_jct=xyz123');
    expect(cm.data.cookie).toContain('SESSDATA=bbb');
    expect(cm.data.cookie).toContain('bili_jct=xyz123');

    // 旧值应被覆盖
    expect(cm.data.cookie).not.toContain('SESSDATA=aaa');
  });
});

describe('Sign', () => {
  test('signParams 返回 32 位小写 MD5', () => {
    const sign = signParams({ foo: 1, bar: 'two' }, KNOWN_APPKEYS.tv.appsec);
    expect(sign).toMatch(/^[0-9a-f]{32}$/);
  });

  test('buildSignedQuery 包含 appkey 与 sign 且按键排序', () => {
    const query = buildSignedQuery({ z: 1, a: 2 }, KNOWN_APPKEYS.tv.appkey, KNOWN_APPKEYS.tv.appsec);
    expect(query).toContain('appkey=');
    expect(query).toContain('sign=');
    expect(query.indexOf('a=')).toBeLessThan(query.indexOf('z='));
  });
});

// ==========================================
// 视频与评论（无需登录）
// ==========================================

describe('Video', () => {
  test('fetch 视频详情', async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    expect(video.bvid).toBe(TEST_BVID);
    expect(video.aid).toBeGreaterThan(0);
    expect(typeof video.title).toBe('string');
    expect(video.owner.mid).toBeGreaterThan(0);
  });

  test('获取 UP 主信息', async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    const up = await video.getUser();
    expect(up.mid).toBe(String(video.owner.mid));
    expect(typeof up.name).toBe('string');
  });

  test('commentArea 绑定 aid 与 type=1', async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    const area = video.commentArea();
    expect(area).toBeInstanceOf(CommentArea);
    const count = await area.count();
    expect(count.code).toBe(0);
    expect(typeof count.data.count).toBe('number');
  });
});

describe('CommentAPI', () => {
  let aid = 0;

  beforeAll(async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    aid = video.aid;
  });

  test('replyCount', async () => {
    const res = await anonClient.comment.replyCount(aid, 1);
    expect(res.code).toBe(0);
    expect(typeof res.data.count).toBe('number');
  });

  test('replies 翻页', async () => {
    const pages: Yielded<ReturnType<CommentAPI['replies']>>[] = [];
    for await (const page of anonClient.comment.replies(aid, 1, ReplySort.TIME, 1, 5)) {
      pages.push(page);
      if (pages.length >= 1) break;
    }
    expect(pages.length).toBeGreaterThan(0);
    expect(Array.isArray(pages[0].comments)).toBe(true);
  });

  test('repliesWbi 懒加载翻页', async () => {
    const pages: Yielded<ReturnType<CommentAPI['repliesWbi']>>[] = [];
    for await (const page of anonClient.comment.repliesWbi(aid, 1, ReplyMode.HEAT)) {
      pages.push(page);
      if (pages.length >= 1) break;
    }
    expect(pages.length).toBeGreaterThan(0);
    expect(Array.isArray(pages[0].comments)).toBe(true);
  });

  test('hotReplies', async () => {
    const pages: Yielded<ReturnType<CommentAPI['hotReplies']>>[] = [];
    for await (const page of anonClient.comment.hotReplies(aid, 1, 5)) {
      pages.push(page);
      if (pages.length >= 1) break;
    }
    // 视频不一定有热评；能正常遍历即可
    if (pages.length > 0) {
      expect(Array.isArray(pages[0].comments)).toBe(true);
    }
  });
});

describe('CommentArea', () => {
  let aid = 0;

  beforeAll(async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    aid = video.aid;
  });

  test('list 翻页', async () => {
    const area = new CommentArea(anonClient, aid, 1);
    const pages: Yielded<ReturnType<CommentArea['list']>>[] = [];
    for await (const page of area.list(ReplySort.TIME, 5)) {
      pages.push(page);
      if (pages.length >= 1) break;
    }
    expect(pages.length).toBeGreaterThan(0);
    expect(Array.isArray(pages[0].comments)).toBe(true);
  });

  test('count', async () => {
    const area = new CommentArea(anonClient, aid, 1);
    const res = await area.count();
    expect(res.code).toBe(0);
    expect(typeof res.data.count).toBe('number');
  });
});

describe('CommentResult', () => {
  test('从评论列表取出后属性正确，commentArea 使用原始 type', async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    const area = new CommentArea(anonClient, video.aid, 1);
    for await (const page of area.list(ReplySort.TIME, 5)) {
      const first = page.comments[0];
      if (!first) break;

      expect(first.rpid).toBeGreaterThan(0);
      expect(first.oid).toBe(video.aid);
      expect(first.type).toBe(1);
      expect(typeof first.content.message).toBe('string');
      expect(typeof first.member.uname).toBe('string');

      const back = first.commentArea();
      expect(back).toBeInstanceOf(CommentArea);
      const count = await back.count();
      expect(count.code).toBe(0);
      break;
    }
  });

  test('getVideo / getSubject 返回所属视频', async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    const area = new CommentArea(anonClient, video.aid, 1);
    for await (const page of area.list(ReplySort.TIME, 1)) {
      const first = page.comments[0];
      if (!first) break;

      const byVideo = await first.getVideo();
      expect(byVideo.aid).toBe(video.aid);
      expect(byVideo.bvid).toBe(video.bvid);

      const bySubject = await first.getSubject();
      expect('aid' in bySubject ? bySubject.aid : null).toBe(video.aid);
      break;
    }
  });
});

// ==========================================
// 用户 / 空间（ mostly 公开）
// ==========================================

describe('User & Space', () => {
  let mid = 0;

  beforeAll(async () => {
    const video = await anonClient.video(TEST_BVID).fetch();
    mid = video.owner.mid;
  });

  test('UserQuery.fetch', async () => {
    const user = await new UserQuery(anonClient, { mid }).fetch();
    expect(user.mid).toBe(String(mid));
    expect(typeof user.name).toBe('string');
  });

  test('space.topArc / masterpieces / coinVideos', async () => {
    const top = await anonClient.space.topArc(mid);
    expect(typeof top.code).toBe('number');

    const masterpieces = await anonClient.space.masterpieces(mid);
    expect(typeof masterpieces.code).toBe('number');

    const coins = await anonClient.space.coinVideos(mid);
    expect(typeof coins.code).toBe('number');
  });
});

// ==========================================
// 需要登录的 API
// ==========================================

describe('Auth required APIs', () => {
  test.skipIf(!loggedIn)('isLoggedIn 返回 true', async () => {
    const res = await authClient!.isLoggedIn();
    expect(res.loggedIn).toBe(true);
    expect(res.mid).toBeGreaterThan(0);
  });

  test.skipIf(!loggedIn)('notify.unreadCount', async () => {
    const res = await authClient!.notify.unreadCount();
    expect(res.code).toBe(0);
    expect(typeof res.data.recv_reply).toBe('number');
  });

  test.skipIf(!loggedIn)('notify.replyFeed / atFeed 可翻页', async () => {
    const replyItems: unknown[] = [];
    for await (const item of authClient!.notify.replyFeed()) {
      replyItems.push(item);
      if (replyItems.length >= 1) break;
    }
    expect(Array.isArray(replyItems)).toBe(true);

    const atItems: unknown[] = [];
    for await (const item of authClient!.notify.atFeed()) {
      atItems.push(item);
      if (atItems.length >= 1) break;
    }
    expect(Array.isArray(atItems)).toBe(true);
  });

  test.skipIf(!loggedIn)('chat.singleUnread', async () => {
    const res = await authClient!.chat.singleUnread();
    expect(res.code).toBe(0);
    expect(typeof res.data.follow_unread).toBe('number');
  });

  test.skipIf(!loggedIn)('chat.sessions 可翻页', async () => {
    const pages: unknown[] = [];
    for await (const page of authClient!.chat.sessions()) {
      pages.push(page);
      if (pages.length >= 1) break;
    }
    expect(pages.length).toBeGreaterThan(0);
    expect(Array.isArray((pages[0] as any).sessions)).toBe(true);
  });

  test.skipIf(!loggedIn)('space.getSettings', async () => {
    const { mid } = await authClient!.isLoggedIn();
    const res = await authClient!.space.getSettings(mid!);
    expect(res.status).toBe(true);
  });
});

// ==========================================
// 写操作（默认跳过，需 ENABLE_WRITE_TESTS=1）
// ==========================================

const enableWrite = process.env.ENABLE_WRITE_TESTS === '1';

describe('Write operations', () => {
  test.skipIf(!loggedIn || !enableWrite)(
    '发表评论后删除',
    async () => {
      const video = await authClient!.video(TEST_BVID).fetch();
      const area = new CommentArea(authClient!, video.aid, 1);
      const added = await area.add('自动化测试评论');
      expect(added.code).toBe(0);
      expect(added.data.rpid).toBeGreaterThan(0);

      const deleted = await area.delete(added.data.rpid);
      expect(deleted.code).toBe(0);
    },
    60_000,
  );

  test.skipIf(!loggedIn || !enableWrite)(
    '点赞后取消点赞',
    async () => {
      const video = await authClient!.video(TEST_BVID).fetch();
      const area = new CommentArea(authClient!, video.aid, 1);
      let rpid = 0;
      for await (const page of area.list(ReplySort.TIME, 1)) {
        rpid = page.comments[0]?.rpid ?? 0;
        if (rpid) break;
      }
      expect(rpid).toBeGreaterThan(0);

      const liked = await authClient!.comment.like(video.aid, rpid, ReplyAction.LIKE, 1);
      expect(liked.code).toBe(0);

      const unliked = await authClient!.comment.like(video.aid, rpid, ReplyAction.UNLIKE, 1);
      expect(unliked.code).toBe(0);
    },
    60_000,
  );
});

// ==========================================
// 类型导出检查（编译期即可验证）
// ==========================================

describe('Type exports', () => {
  test('关键枚举可用', () => {
    expect(ReplySort.TIME).toBe(0);
    expect(ReplyMode.HEAT).toBe(2);
    expect(ReplyAction.LIKE).toBe(1);
    expect(ReplyHateAction.HATE).toBe(1);
    expect(ReplyTopAction.TOP).toBe(1);
    expect(ReplyReportReason.SPAM).toBe(1);
    expect(QrcodeStatus.SUCCESS).toBe(0);
    expect(KNOWN_APPKEYS.tv.appkey).toBeDefined();
  });
});
