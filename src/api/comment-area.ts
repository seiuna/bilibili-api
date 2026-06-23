import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import type { ReplyEntry, ReplyMainData, ReplyAddResult } from './types.js';
import type { UploadImageResult } from './upload.js';
import {
  ReplySort,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
} from './types.js';
import { CommentResult } from '../queries/results.js';

// ==========================================
// CommentArea — 评论区对象
// 绑定 oid + type，提供 .list() 翻页 + 全部 CRUD
// ==========================================

export interface ReplyPage {
  page: number;
  comments: CommentResult[];
  hots: CommentResult[] | null;
}

export class CommentArea {
  constructor(
    private client: BiliClient,
    private oid: number,
    private replyType: number = 11,
  ) {}

  /** 评论区翻页 — async generator */
  async *list(
    sort: ReplySort = ReplySort.TIME,
    pageSize: number = 20,
    nohot: 0 | 1 = 0,
  ): AsyncGenerator<ReplyPage> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(this.replyType),
        oid: String(this.oid),
        sort: String(sort),
        nohot: String(nohot),
        ps: String(Math.min(pageSize, 20)),
        pn: String(pn),
      });

      const url = `https://api.bilibili.com/x/v2/reply?${params.toString()}`;
      const data = await this.client.request<BiliApiResponse<ReplyMainData>>(url);

      if (data.code !== 0) break;

      const page = data.data.page;
      if (totalPages === null) totalPages = Math.ceil(page.acount / page.size);

      const comments = (data.data.replies ?? []).map(
        r => new CommentResult(this.client, r, this.oid),
      );
      const hots = data.data.hots
        ? data.data.hots.map(r => new CommentResult(this.client, r, this.oid))
        : null;

      if (comments.length) yield { page: pn, comments, hots };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /**
   * 发表评论
   * @param pictures — 图片列表（先通过 client.upload.image() 上传获取）
   */
  async add(
    message: string,
    root = 0,
    parent = 0,
    pictures?: UploadImageResult[],
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = this.csrf();
    const body = new URLSearchParams({
      type: String(11), oid: String(this.oid), message, plat: '1', csrf,
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

    return this.  client.checkedRequest<BiliApiResponse<ReplyAddResult>>(
      'https://api.bilibili.com/x/v2/reply/add',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() },
    );
  }

  /** 点赞 / 取消 */
  async like(rpid: number, unlike = false): Promise<BiliApiResponse<null>> {
    return this.action('https://api.bilibili.com/x/v2/reply/action', rpid, unlike ? ReplyAction.UNLIKE : ReplyAction.LIKE);
  }

  /** 点踩 / 取消 */
  async hate(rpid: number, unhate = false): Promise<BiliApiResponse<null>> {
    return this.action('https://api.bilibili.com/x/v2/reply/hate', rpid, unhate ? ReplyHateAction.UNHATE : ReplyHateAction.HATE);
  }

  /** 删除评论 */
  async delete(rpid: number): Promise<BiliApiResponse<null>> {
    const csrf = this.csrf();
    return this.client.checkedRequest<BiliApiResponse<null>>('https://api.bilibili.com/x/v2/reply/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ type: String(this.replyType), oid: String(this.oid), rpid: String(rpid), csrf }).toString(),
    });
  }

  /** 置顶 / 取消（仅一级评论） */
  async top(rpid: number, untop = false): Promise<BiliApiResponse<null>> {
    return this.action('https://api.bilibili.com/x/v2/reply/top', rpid, untop ? ReplyTopAction.UNTOP : ReplyTopAction.TOP);
  }

  /** 举报 */
  async report(rpid: number, reason: ReplyReportReason = ReplyReportReason.SPAM, content?: string): Promise<BiliApiResponse<null>> {
    const csrf = this.csrf();
    const body = new URLSearchParams({ type: String(this.replyType), oid: String(this.oid), rpid: String(rpid), reason: String(reason), csrf });
    if (content) body.set('content', content);
    return this.client.checkedRequest<BiliApiResponse<null>>('https://api.bilibili.com/x/v2/reply/report', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
    });
  }

  /** 评论总数 */
  async count(): Promise<BiliApiResponse<{ count: number }>> {
    return this.client.request(
      `https://api.bilibili.com/x/v2/reply/count?type=${this.replyType}&oid=${this.oid}`,
    );
  }

  private csrf(): string {
    const c = this.client.config.data.cookie;
    const m = c.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!m) throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    return m[1];
  }

  private async action(url: string, rpid: number, action: number): Promise<BiliApiResponse<null>> {
    const csrf = this.csrf();
    return this.client.checkedRequest<BiliApiResponse<null>>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(this.replyType), oid: String(this.oid), rpid: String(rpid), action: String(action), csrf,
      }).toString(),
    });
  }
}
