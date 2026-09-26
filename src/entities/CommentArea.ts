import { normalizeCommentId, type BiliApiResponse } from '../core/types.js';
import type {
  ReplyEntry,
  ReplyAddResult,
  ReplyPage,
  ReplyMainData,
  ReplyWbiMainData,
} from '../api/comment.js';
import {
  ReplySort,
  ReplyMode,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
  CommentAPI,
} from '../api/comment.js';
import type { UploadImageResult } from '../api/upload.js';
import { assertOk, type BiliClient } from '../core/client.js';

/**
 * 绑定到具体评论区 (oid + replyType) 的高层封装
 */
export class CommentArea {
  constructor(
    private client: BiliClient<any>,
    private oid: number | string,
    private replyType: number,
  ) { normalizeCommentId(oid, 'oid'); }

  get getOid(): number | string { return this.oid; }
  get getReplyType(): number { return this.replyType; }

  /** 获取单页评论 */
  async getPage(
    pn = 1,
    sort: ReplySort = ReplySort.TIME,
    pageSize = 20,
    nohot: 0 | 1 = 0,
  ): Promise<BiliApiResponse<ReplyMainData>> {
    return CommentAPI.getReplies(this.client, this.oid, this.replyType, sort, nohot, pn, pageSize);
  }

  /** 获取单页评论（WBI 接口） */
  async getPageWbi(
    mode: ReplyMode = ReplyMode.HEAT,
    paginationStr?: string,
  ): Promise<BiliApiResponse<ReplyWbiMainData>> {
    return CommentAPI.getRepliesWbi(this.client, this.oid, this.replyType, mode, paginationStr);
  }

  /** 评论区翻页 — async generator */
  async *list(
    sort: ReplySort = ReplySort.TIME,
    pageSize = 20,
    nohot: 0 | 1 = 0,
  ): AsyncGenerator<ReplyPage> {
    yield* CommentAPI.replies(this.client, this.oid, this.replyType, sort, nohot, pageSize);
  }

  /** 懒加载翻页（WBI 接口） */
  async *listWbi(
    mode: ReplyMode = ReplyMode.HEAT,
  ): AsyncGenerator<{ cursor: number; comments: ReplyEntry[]; hots: ReplyEntry[] | null }> {
    yield* CommentAPI.repliesWbi(this.client, this.oid, this.replyType, mode);
  }

  /** 获取单条评论实体 */
  async getReply(rpid: number | string): Promise<import('./Comment.js').Comment | null> {
    const res = await CommentAPI.getReply(this.client, this.oid, this.replyType, rpid);
    assertOk(res);
    if (!res.data) return null;
    const { Comment } = await import('./Comment.js');
    return new Comment(this.client, res.data, this.oid);
  }

  /** 发表评论（支持图片） */
  async add(
    message: string,
    root: number | string = 0,
    parent: number | string = 0,
    pictures?: UploadImageResult[],
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = this.client.config.getCsrf();
    const body = new URLSearchParams({
      type: String(this.replyType),
      oid: normalizeCommentId(this.oid, 'oid'),
      message,
      plat: '1',
      csrf,
    });
    const rootId = normalizeCommentId(root, 'root', true);
    const parentId = normalizeCommentId(parent, 'parent', true);
    if (rootId !== '0') body.set('root', rootId);
    if (parentId !== '0') body.set('parent', parentId);
    if (pictures && pictures.length > 0) {
      const mapped = pictures.map(p => ({
        img_src: p.image_url,
        img_width: p.image_width,
        img_height: p.image_height,
        img_size: p.img_size,
        ai_gen_pic: p.ai_gen_pic,
      }));
      body.set('pictures', JSON.stringify(mapped));
    }

    return this.client.checkedRequest<BiliApiResponse<ReplyAddResult>>(
      'https://api.bilibili.com/x/v2/reply/add',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
  }

  /** 点赞 / 取消 */
  async like(rpid: number | string, unlike = false): Promise<BiliApiResponse<null>> {
    const res = await CommentAPI.like(
      this.client, this.oid, rpid, this.replyType,
      unlike ? ReplyAction.UNLIKE : ReplyAction.LIKE,
    );
    return assertOk(res);
  }

  /** 点踩 / 取消 */
  async hate(rpid: number | string, unhate = false): Promise<BiliApiResponse<null>> {
    const res = await CommentAPI.hate(
      this.client, this.oid, rpid, this.replyType,
      unhate ? ReplyHateAction.UNHATE : ReplyHateAction.HATE,
    );
    return assertOk(res);
  }

  /** 删除评论 */
  async delete(rpid: number | string): Promise<BiliApiResponse<null>> {
    const res = await CommentAPI.delete(this.client, this.oid, rpid, this.replyType);
    return assertOk(res);
  }

  /** 置顶 / 取消 */
  async top(rpid: number | string, untop = false): Promise<BiliApiResponse<null>> {
    const res = await CommentAPI.top(
      this.client, this.oid, rpid, this.replyType,
      untop ? ReplyTopAction.UNTOP : ReplyTopAction.TOP,
    );
    return assertOk(res);
  }

  /** 举报 */
  async report(
    rpid: number | string,
    reason: ReplyReportReason = ReplyReportReason.SPAM,
    content?: string,
  ): Promise<BiliApiResponse<null>> {
    const res = await CommentAPI.report(this.client, this.oid, rpid, this.replyType, reason, content);
    return assertOk(res);
  }

  /** 评论总数 */
  async count(): Promise<BiliApiResponse<{ count: number }>> {
    return CommentAPI.replyCount(this.client, this.oid, this.replyType);
  }
}