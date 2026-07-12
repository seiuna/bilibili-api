import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import type { ReplyAddResult, ReplyEntry, ReplyType } from './types.js';
import type { UploadAPI, UploadImageResult } from './upload.js';
import type { ReplyPage } from './comment.js';
import {
  ReplySort,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
} from './types.js';

// ==========================================
// CommentArea — 绑定到具体评论区（oid + replyType）的高层封装
// 翻页/操作默认委托给 {@link CommentAPI}，发评额外支持图片
// ==========================================

export class CommentArea {
  /**
   * @param client - BiliClient 实例
   * @param oid - 评论区对象 ID（视频 aid、动态 id 等），对应 {@link ReplyEntry.oid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   */
  constructor(
    private client: BiliClient,
    private oid: number,
    private replyType: number,
  ) {}

  /**
   * 评论区翻页 — async generator
   * @param sort - 排序方式
   * @param pageSize - 每页条数，最大 20
   * @param nohot - 是否不包含热评
   */
  async *list(
    sort: ReplySort = ReplySort.TIME,
    pageSize: number = 20,
    nohot: 0 | 1 = 0,
  ): AsyncGenerator<ReplyPage> {
    yield* this.client.comment.replies(this.oid, this.replyType, sort, nohot, pageSize);
  }

  /**
   * 发表评论（支持图片）
   * @param message - 评论内容
   * @param root - 一级评论 ID（回复时必填），{@link ReplyEntry.rpid}
   * @param parent - 被回复评论 ID，{@link ReplyEntry.rpid}
   * @param pictures - 图片列表（先通过 {@link UploadAPI.image} 上传获取）
   */
  async add(
    message: string,
    root = 0,
    parent = 0,
    pictures?: UploadImageResult[],
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = this.csrf();
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
      // 上传接口返回 image_url，评论接口需要 img_src
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
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() },
    );
  }

  /**
   * 点赞 / 取消
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param unlike - 是否取消点赞
   */
  async like(rpid: number, unlike = false): Promise<BiliApiResponse<null>> {
    return this.client.comment.like(
      this.oid,
      rpid,
      unlike ? ReplyAction.UNLIKE : ReplyAction.LIKE,
      this.replyType,
    );
  }

  /**
   * 点踩 / 取消
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param unhate - 是否取消点踩
   */
  async hate(rpid: number, unhate = false): Promise<BiliApiResponse<null>> {
    return this.client.comment.hate(
      this.oid,
      rpid,
      unhate ? ReplyHateAction.UNHATE : ReplyHateAction.HATE,
      this.replyType,
    );
  }

  /**
   * 删除评论
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   */
  async delete(rpid: number): Promise<BiliApiResponse<null>> {
    return this.client.comment.delete(this.oid, rpid, this.replyType);
  }

  /**
   * 置顶 / 取消（仅一级评论）
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param untop - 是否取消置顶
   */
  async top(rpid: number, untop = false): Promise<BiliApiResponse<null>> {
    return this.client.comment.top(
      this.oid,
      rpid,
      untop ? ReplyTopAction.UNTOP : ReplyTopAction.TOP,
      this.replyType,
    );
  }

  /**
   * 举报
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param reason - 举报原因
   * @param content - 补充说明
   */
  async report(
    rpid: number,
    reason: ReplyReportReason = ReplyReportReason.SPAM,
    content?: string,
  ): Promise<BiliApiResponse<null>> {
    return this.client.comment.report(this.oid, rpid, reason, this.replyType, content);
  }

  /** 评论总数 */
  async count(): Promise<BiliApiResponse<{ count: number }>> {
    return this.client.comment.replyCount(this.oid, this.replyType);
  }

  private csrf(): string {
    const c = this.client.config.data.cookie;
    const m = c.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!m) throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    return m[1];
  }
}
