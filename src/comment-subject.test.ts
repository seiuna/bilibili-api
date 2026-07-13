import { describe, test, expect } from 'vitest';
import { BiliClient } from './client.js';
import { CommentResult } from './queries/results.js';
import type { ReplyEntry } from './api/types.js';

function createMockClient() {
  const client = new BiliClient(undefined, async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/x/web-interface/view?aid=')) {
      return new Response(
        JSON.stringify({
          code: 0,
          message: '0',
          ttl: 1,
          data: {
            bvid: 'BV1test',
            aid: 123,
            title: '测试视频',
            owner: { mid: 1, name: 'tester', face: '' },
            stat: { view: 0, danmaku: 0, reply: 0, favorite: 0, coin: 0, share: 0, like: 0 },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ) as unknown as Response;
    }

    if (url.includes('/dynamic_svr/v1/dynamic_svr/get_dynamic_detail')) {
      return new Response(
        JSON.stringify({
          code: 0,
          message: '0',
          ttl: 1,
          data: {
            card: {
              desc: {
                dynamic_id: 789,
                type: 2,
                uid: 111,
                timestamp: 1234567890,
              },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ) as unknown as Response;
    }

    return new Response(
      JSON.stringify({ code: -404, message: '啥都木有', ttl: 1 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ) as unknown as Response;
  });

  client.config.data.cookie = 'bili_jct=test';
  return client;
}

function makeEntry(type: number, oid: number): ReplyEntry {
  return {
    rpid: 1,
    oid,
    type,
    mid: 2,
    root: 0,
    parent: 0,
    count: 0,
    rcount: 0,
    like: 0,
    ctime: 0,
    member: {
      mid: '2',
      uname: 'tester',
      avatar: '',
      sex: '保密',
      sign: '',
      rank: 0,
      level_info: { current_level: 1 },
    },
    content: { message: '测试评论' },
    replies: null,
    state: 0,
    up_action: { like: false, reply: false },
    invisible: false,
    folder: { has_folded: false, is_folded: false, rule: '' },
    reply_control: { time_desc: '', location: '', sub_reply_entry_text: '' },
  } as ReplyEntry;
}

describe('CommentResult subject lookup', () => {
  test('getVideo() 通过 aid 返回视频', async () => {
    const client = createMockClient();
    const comment = new CommentResult(client, makeEntry(1, 123), 123);

    const video = await comment.getVideo();
    expect(video.bvid).toBe('BV1test');
    expect(video.aid).toBe(123);
    expect(video.title).toBe('测试视频');
  });

  test('getDynamic() 通过动态 ID 返回动态', async () => {
    const client = createMockClient();
    const comment = new CommentResult(client, makeEntry(11, 789), 789);

    const dynamic = await comment.getDynamic();
    expect(dynamic.code).toBe(0);
    expect(dynamic.data.card.desc.dynamic_id).toBe(789);
  });

  test('getSubject() 根据 type 自动选择视频或动态', async () => {
    const client = createMockClient();

    const videoComment = new CommentResult(client, makeEntry(1, 123), 123);
    const subjectVideo = await videoComment.getSubject();
    expect('bvid' in subjectVideo ? subjectVideo.bvid : null).toBe('BV1test');

    const dynamicComment = new CommentResult(client, makeEntry(11, 789), 789);
    const subjectDynamic = await dynamicComment.getSubject();
    expect('data' in subjectDynamic && 'card' in subjectDynamic.data ? subjectDynamic.data.card.desc.dynamic_id : null).toBe(789);
  });

  test('类型不匹配时抛出明确错误', async () => {
    const client = createMockClient();
    const videoComment = new CommentResult(client, makeEntry(1, 123), 123);

    await expect(videoComment.getDynamic()).rejects.toThrow('type=1');

    const dynamicComment = new CommentResult(client, makeEntry(11, 789), 789);
    await expect(dynamicComment.getVideo()).rejects.toThrow('type=11');
  });
});
