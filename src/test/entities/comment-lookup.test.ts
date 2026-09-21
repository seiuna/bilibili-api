import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { CommentAPI } from '../../api/comment.js';

// Reduced projection of the user's real jump response; isolated parser tests.
const reply = {
  rpid: 314621900497,
  rpid_str: '314621900497',
  oid: 409865874,
  type: 11,
  mid: 390794259,
  root: 0,
  parent: 0,
  content: { message: '【SDK integration test 431a9bd8-b1dc-4aa2-9eb9-a03461921c50】 自动化测试评论。' },
  replies: null,
};
function setup(data: unknown, code = 0) {
  const urls: string[] = [];
  const transport: typeof fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ code, message: code === 0 ? 'OK' : 'error', ttl: 1, data }));
  };
  return { client: new BiliClient(undefined, transport), urls };
}

describe('CommentAPI.getReply lookup', () => {
  it('matches the exact comment in the supplied real response shape', async () => {
    const { client } = setup({ replies: [reply] });
    const res = await CommentAPI.getReply(client, '409865874', 11, '314621900497');
    expect(res).toEqual({ code: 0, message: 'OK', ttl: 1, data: reply });
  });

  it('normalizes surrounding input whitespace', async () => {
    const { client, urls } = setup({ replies: [reply] });
    expect((await CommentAPI.getReply(client, ' 409865874 ', 11, ' 314621900497 ')).data).toEqual(reply);
    expect(new URL(urls[0]).searchParams.get('rpid')).toBe(reply.rpid_str);
  });

  it('searches root.replies and deeper nested replies', async () => {
    const { client } = setup({ root: { rpid: 1, replies: [{ rpid: 2, replies: [reply] }] } });
    expect((await CommentAPI.getReply(client, reply.oid, 11, reply.rpid_str)).data).toEqual(reply);
  });

  it('prefers string IDs over rounded numeric IDs', async () => {
    // Synthetic boundary case, not a claimed remote response.
    const id = '1245247779461136407';
    const { client } = setup({ replies: [{ ...reply, rpid: Number(id), rpid_str: id }] });
    expect((await CommentAPI.getReply(client, reply.oid, 11, id)).data?.rpid_str).toBe(id);
  });

  it('returns null rather than an unrelated comment when the requested ID is absent', async () => {
    const { client } = setup({ replies: [reply] });
    expect((await CommentAPI.getReply(client, reply.oid, 11, '123')).data).toBeNull();
  });

  it('preserves remote failure code and does not return a target on failure', async () => {
    const { client } = setup({ replies: [reply] }, -403);
    expect(await CommentAPI.getReply(client, reply.oid, 11, reply.rpid_str)).toEqual({
      code: -403, message: 'error', ttl: 1, data: null,
    });
  });

  it('handles a null response payload', async () => {
    const { client } = setup(null);
    expect((await CommentAPI.getReply(client, reply.oid, 11, reply.rpid_str)).data).toBeNull();
  });

  it('rejects unsafe numeric IDs without sending a request', async () => {
    const { client, urls } = setup(null);
    await expect(CommentAPI.getReply(client, reply.oid, 11, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow(RangeError);
    expect(urls).toEqual([]);
  });
});
