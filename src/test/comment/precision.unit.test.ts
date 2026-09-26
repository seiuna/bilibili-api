import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { CommentAPI, type ReplyEntry } from '../../api/comment.js';
import { Comment } from '../../entities/Comment.js';
import { CommentArea } from '../../entities/CommentArea.js';
import { Dynamic } from '../../entities/Dynamic.js';
import { Opus } from '../../entities/Opus.js';

// Isolated synthetic boundary regressions, NOT real-network contract tests.
const ID = '1245247779461136407';
const ROOT = '1245247779461136409';
function setup(data: unknown | ((url: URL) => unknown), code = 0) {
  const calls: { url: URL; body: URLSearchParams }[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, body: new URLSearchParams(String(init?.body ?? '')) });
    return new Response(JSON.stringify({ code, message: 'test', ttl: 1,
      data: typeof data === 'function' ? data(url) : data }));
  };
  const client = new BiliClient(undefined, transport);
  client.config.data.cookie = 'bili_jct=synthetic-unit-test';
  return { client, calls };
}
const entry = { rpid: Number(ID), rpid_str: ID, oid: Number(ROOT), oid_str: ROOT,
  type: 17, root: 0, root_str: '0', parent: 0, parent_str: '0', replies: null } as ReplyEntry;

describe('comment string identifiers (isolated)', () => {
  it('preserves exact list and dialog identifiers and page bounds', async () => {
    const { client, calls } = setup(null);
    await CommentAPI.getReplies(client, ID, 17);
    await CommentAPI.getReplyDialog(client, ID, ROOT, 17, 2, 99);
    expect(calls[0].url.searchParams.get('oid')).toBe(ID);
    expect(Object.fromEntries(calls[1].url.searchParams)).toMatchObject({ oid: ID, root: ROOT, pn: '2', ps: '49' });
  });
  it.each([Number(ID), NaN, Infinity, 1.5])('rejects unsafe numeric inputs %s before transport', async bad => {
    const { client, calls } = setup(null);
    await expect(CommentAPI.getReplies(client, bad, 17)).rejects.toThrow(RangeError);
    await expect(CommentAPI.getReplyDialog(client, ID, bad, 17)).rejects.toThrow(RangeError);
    await expect(CommentAPI.resolveReply(client, bad)).rejects.toThrow(RangeError);
    expect(calls).toHaveLength(0);
  });
  it('rejects invalid pagination before transport', async () => {
    const { client, calls } = setup(null);
    await expect(CommentAPI.getReplyDialog(client, ID, ROOT, 17, 0)).rejects.toThrow(RangeError);
    await expect(CommentAPI.getReplies(client, ID, 17, 0, 0, 1, 0)).rejects.toThrow(RangeError);
    expect(calls).toHaveLength(0);
  });
  it('keeps dialog root separate and paginates using count (no acount)', async () => {
    const { client, calls } = setup((url: URL) => ({ root: entry,
      replies: [{ ...entry, rpid_str: url.searchParams.get('pn') }],
      page: { num: Number(url.searchParams.get('pn')), size: 1, count: 2 } }));
    const pages = [];
    for await (const page of CommentAPI.replyDialog(client, ID, ROOT, 17, 1)) pages.push(page);
    expect(pages.map(p => p.comments.map(r => r.rpid_str))).toEqual([['1'], ['2']]);
    expect(calls).toHaveLength(2);
    expect((await CommentAPI.getReplyDialog(client, ID, ROOT, 17)).data.root).toEqual(entry);
  });
  it('uses root/hot counts rather than total nested reply counts', async () => {
    const { client, calls } = setup({ replies: [entry], hots: null,
      page: { num: 1, size: 1, count: 1, acount: 100 } });
    for await (const _page of CommentAPI.replies(client, ID, 17)) { /* consume */ }
    for await (const _page of CommentAPI.hotReplies(client, ID, 17)) { /* consume */ }
    expect(calls).toHaveLength(2);
  });
  it('does not interpret pagination or entity lookup errors as empty results', async () => {
    const { client } = setup(null, -403);
    await expect(CommentAPI.replyDialog(client, ID, ROOT, 17).next()).rejects.toThrow();
    await expect(CommentAPI.replies(client, ID, 17).next()).rejects.toThrow();
    await expect(CommentAPI.repliesWbi(client, ID, 17).next()).rejects.toThrow();
    await expect(CommentAPI.hotReplies(client, ID, 17).next()).rejects.toThrow();
    await expect(new CommentArea(client, ID, 17).getReply(ROOT)).rejects.toThrow();
  });
  it('resolves a reply using authoritative rpid_str even when number is rounded', async () => {
    const { client } = setup({ replies: [entry] });
    expect((await CommentAPI.resolveReply(client, ID, [{ oid: ROOT, replyType: 17 }]))?.reply).toEqual(entry);
  });
  it('routes entity writes with exact IDs through isolated transport only', async () => {
    const { client, calls } = setup(null);
    const comment = new Comment(client, { ...entry, root_str: ID }, 1);
    expect(comment.oidStr).toBe(ROOT);
    expect(comment.rpidStr).toBe(ID);
    await comment.reply('unit-test');
    await comment.like();
    await comment.delete();
    expect(Object.fromEntries(calls[0].body)).toMatchObject({ oid: ROOT, root: ID, parent: ID });
    for (const call of calls.slice(1)) expect(Object.fromEntries(call.body)).toMatchObject({ oid: ROOT, rpid: ID });
  });
  it('refuses a rounded entity ID without authoritative string data', async () => {
    const { client, calls } = setup(null);
    const comment = new Comment(client, { ...entry, rpid_str: undefined }, ROOT);
    await expect(comment.like()).rejects.toThrow(RangeError);
    expect(calls).toHaveLength(0);
  });
  it('uses Dynamic/Opus comment_id_str, not a distinct rid_str or entity ID', async () => {
    const { client, calls } = setup(null);
    const raw = { id_str: '7', basic: { comment_id_str: ID, rid_str: ROOT, comment_type: 17 } };
    const dynamic = new Dynamic(client, raw as never);
    const opus = new Opus(client, raw as never);
    expect(dynamic.commentArea().getOid).toBe(ID);
    expect(opus.commentArea().getOid).toBe(ID);
    await dynamic.commentArea().getPage();
    await opus.commentArea().getPage();
    expect(calls.map(call => call.url.searchParams.get('oid'))).toEqual([ID, ID]);
  });
});
