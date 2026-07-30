import type { BiliApiResponse } from '../core/types.js';
import type { ReplyEntry, ReplyAddResult, ReplyPage } from '../api/comment.js';
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
import { BiliClient } from '../index.js';

/**
 * 绑定到具体评论区 (oid + replyType) 的高层封装
 */
export class CommentArea {
  constructor(
    private client: BiliClient<any>,
    private oid: number,
    private replyType: number,
  ) {}

  get getOid(): number { return this.oid; }
  get getReplyType(): number { return this.replyType; }

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

  /** 发表评论（支持图片） */
  async add(
    message: string,
    root = 0,
    parent = 0,
    pictures?: UploadImageResult[],
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = this.client.config.getCsrf();
    const body = new URLSearchParams({
      type: String(this.replyType),
      oid: String(this.oid),
      message,
      plat: '1',
      csrf,
    });
    if (root > 0) body.set('root', String(root));
    if (parent > 0) body.set('parent', String(parent));
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
  async like(rpid: number, unlike = false): Promise<BiliApiResponse<null>> {
    return CommentAPI.like(
      this.client, this.oid, rpid,
      unlike ? ReplyAction.UNLIKE : ReplyAction.LIKE,
      this.replyType,
    );
  }

  /** 点踩 / 取消 */
  async hate(rpid: number, unhate = false): Promise<BiliApiResponse<null>> {
    return CommentAPI.hate(
      this.client, this.oid, rpid,
      unhate ? ReplyHateAction.UNHATE : ReplyHateAction.HATE,
      this.replyType,
    );
  }

  /** 删除评论 */
  async delete(rpid: number): Promise<BiliApiResponse<null>> {
    return CommentAPI.delete(this.client, this.oid, rpid, this.replyType);
  }

  /** 置顶 / 取消 */
  async top(rpid: number, untop = false): Promise<BiliApiResponse<null>> {
    return CommentAPI.top(
      this.client, this.oid, rpid,
      untop ? ReplyTopAction.UNTOP : ReplyTopAction.TOP,
      this.replyType,
    );
  }

  /** 举报 */
  async report(
    rpid: number,
    reason: ReplyReportReason = ReplyReportReason.SPAM,
    content?: string,
  ): Promise<BiliApiResponse<null>> {
    return CommentAPI.report(this.client, this.oid, rpid, reason, this.replyType, content);
  }

  /** 评论总数 */
  async count(): Promise<BiliApiResponse<{ count: number }>> {
    return CommentAPI.replyCount(this.client, this.oid, this.replyType);
  }
}