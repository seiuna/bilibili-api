import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { ReplyType, type ReplyEntry } from '../../api/comment.js';
import { Comment } from '../../entities/Comment.js';

// Isolated transport tests: no login or real network requests.
function setup(oid: number, dynamicId?: string, type = ReplyType.WORD_DYNAMIC) {
  const requestedIds: string[] = [];
  const transport: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const id = url.searchParams.get('id')!;
    requestedIds.push(id);
    return new Response(JSON.stringify({ code: 0, message: '0', data: { item: { id_str: id } } }));
  };
  const client = new BiliClient(undefined, transport);
  const entry = { oid, type, dynamic_id_str: dynamicId } as ReplyEntry;
  return { comment: new Comment(client, entry, oid), requestedIds };
}

const LARGE_ID = '1245247779461136407';

describe('Comment dynamic ID precision', () => {
  it('preserves dynamic_id_str despite a rounded numeric oid, including getSubject', async () => {
    const { oid } = JSON.parse(`{"oid":${LARGE_ID}}`);
    expect(String(oid)).not.toBe(LARGE_ID);
    const { comment, requestedIds } = setup(oid, LARGE_ID);

    expect((await comment.getDynamic()).id).toBe(LARGE_ID);
    const subject = await comment.getSubject();
    expect('id' in subject && subject.id).toBe(LARGE_ID);
    expect(requestedIds).toEqual([LARGE_ID, LARGE_ID]);
  });

  it('falls back to a positive safe integer oid when no string ID exists', async () => {
    const { comment, requestedIds } = setup(123456);
    expect((await comment.getDynamic()).id).toBe('123456');
    expect(requestedIds).toEqual(['123456']);
  });

  it.each([undefined, '', '0', 'invalid'])('rejects unsafe oid without a usable string ID (%s)', async (id) => {
    const { comment, requestedIds } = setup(Number(LARGE_ID), id);
    await expect(comment.getDynamic()).rejects.toThrow('缺少可靠的字符串动态 ID');
    await expect(comment.getSubject()).rejects.toThrow('缺少可靠的字符串动态 ID');
    expect(requestedIds).toEqual([]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid numeric oid %s', async (oid) => {
    const { comment, requestedIds } = setup(oid);
    await expect(comment.getDynamic()).rejects.toThrow('缺少可靠的字符串动态 ID');
    expect(requestedIds).toEqual([]);
  });

  it('still rejects image-dynamic doc IDs before making a request', async () => {
    const { comment, requestedIds } = setup(408396462, LARGE_ID, ReplyType.DYNAMIC);
    await expect(comment.getDynamic()).rejects.toThrow('只支持纯文字动态评论');
    expect(requestedIds).toEqual([]);
  });
});
