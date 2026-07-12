import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import {
  ReplySort,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
  ReplyMode,
} from './types.js';
import type {
  ReplyAddResult,
  ReplyEntry,
  ReplyMainData,
  ReplyWbiMainData,
} from './types.js';
import { CommentResult } from '../queries/results.js';
import type { CommentArea } from './comment-area.js';

// ==========================================
// 底层评论区 API 封装
// 需要显式传入 oid / replyType / rpid，返回原始 BiliApiResponse
// 高层操作请使用 CommentArea
// ==========================================

/** 翻页结果 */
export interface ReplyPage {
  page: number;
  comments: CommentResult[];
  hots: CommentResult[] | null;
}

export class CommentAPI {
  constructor(private client: BiliClient) {}

  /**
   * 获取评论区明细 — async generator 逐页 yield CommentResult
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   * @param sort - 排序方式
   * @param nohot - 是否不包含热评
   * @param pageSize - 每页条数，最大 20
   */
  async *replies(
    oid: number,
    replyType: number = 1,
    sort: ReplySort = ReplySort.TIME,
    nohot: 0 | 1 = 0,
    pageSize: number = 20,
  ): AsyncGenerator<ReplyPage> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(replyType),
        oid: String(oid),
        sort: String(sort),
        nohot: String(nohot),
        ps: String(Math.min(pageSize, 20)),
        pn: String(pn),
      });

      const url = `https://api.bilibili.com/x/v2/reply?${params.toString()}`;
      const data = await this.client.request<BiliApiResponse<ReplyMainData>>(url);

      if (data.code !== 0) break;

      const page = data.data.page;
      if (totalPages === null) {
        totalPages = Math.ceil(page.acount / page.size);
      }

      const comments = (data.data.replies ?? []).map(
        r => new CommentResult(this.client, r, oid),
      );
      const hots = data.data.hots
        ? data.data.hots.map(r => new CommentResult(this.client, r, oid))
        : null;

      if (comments.length) yield { page: pn, comments, hots };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /**
   * 懒加载翻页（WBI 接口）
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   * @param mode - 排序模式
   */
  async *repliesWbi(
    oid: number,
    replyType: number = 1,
    mode: ReplyMode = ReplyMode.HEAT,
  ): AsyncGenerator<{ cursor: number; comments: CommentResult[]; hots: CommentResult[] | null }> {
    let nextOffset = '';
    let isEnd = false;

    while (!isEnd) {
      const params = new URLSearchParams({
        type: String(replyType),
        oid: String(oid),
        mode: String(mode),
      });
      if (nextOffset) {
        params.set('pagination_str', JSON.stringify({ offset: nextOffset }));
      }

      const url = `https://api.bilibili.com/x/v2/reply/main?${params.toString()}`;
      const data = await this.client.request<BiliApiResponse<ReplyWbiMainData>>(url);

      if (data.code !== 0) break;

      const { cursor, replies } = data.data;
      const comments = (replies ?? []).map(
        r => new CommentResult(this.client, r, oid),
      );
      const hots = data.data.hots
        ? data.data.hots.map(r => new CommentResult(this.client, r, oid))
        : null;

      if (comments.length) yield { cursor: cursor.next, comments, hots };

      isEnd = cursor.is_end;
      nextOffset = cursor.pagination_reply.next_offset;
    }
  }

  /**
   * 获取指定评论的回复列表
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param rootRpid - 一级评论 ID，{@link ReplyEntry.rpid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   * @param pageSize - 每页条数，最大 49
   */
  async *replyDialog(
    oid: number,
    rootRpid: number,
    replyType: number = 1,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: CommentResult[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(replyType),
        oid: String(oid),
        root: String(rootRpid),
        ps: String(Math.min(pageSize, 49)),
        pn: String(pn),
      });

      const url = `https://api.bilibili.com/x/v2/reply/reply?${params.toString()}`;
      const data = await this.client.request<BiliApiResponse<ReplyMainData>>(url);

      if (data.code !== 0) break;

      const page = data.data.page;
      if (totalPages === null && page) {
        totalPages = Math.ceil(page.count / page.size);
      }

      const comments = (data.data.replies ?? []).map(
        r => new CommentResult(this.client, r, oid),
      );

      if (comments.length) yield { page: pn, comments };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /**
   * 获取热评列表
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   * @param pageSize - 每页条数，最大 49
   */
  async *hotReplies(
    oid: number,
    replyType: number = 1,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: CommentResult[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(replyType),
        oid: String(oid),
        ps: String(Math.min(pageSize, 49)),
        pn: String(pn),
      });

      const url = `https://api.bilibili.com/x/v2/reply/hot?${params.toString()}`;
      const data = await this.client.request<BiliApiResponse<ReplyMainData>>(url);

      if (data.code !== 0 || !data.data) break;

      const page = data.data.page;
      if (totalPages === null) {
        totalPages = page ? Math.ceil(page.acount / page.size) : 1;
      }

      const comments = (data.data.replies ?? []).map(
        r => new CommentResult(this.client, r, oid),
      );

      if (comments.length) yield { page: pn, comments };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /**
   * 获取评论总数
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   */
  async replyCount(
    oid: number,
    replyType: number = 1,
  ): Promise<BiliApiResponse<{ count: number }>> {
    const params = new URLSearchParams({ type: String(replyType), oid: String(oid) });
    return this.client.request(
      `https://api.bilibili.com/x/v2/reply/count?${params.toString()}`,
    );
  }

  /**
   * 发表评论（底层，不支持图片；需要图片请用 {@link CommentArea.add}）
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param message - 评论内容
   * @param replyType - 评论区类型，见 {@link ReplyType}
   * @param root - 一级评论 ID（回复时必填），{@link ReplyEntry.rpid}
   * @param parent - 被回复评论 ID，{@link ReplyEntry.rpid}
   * @param plat - 平台标识
   */
  async add(
    oid: number,
    message: string,
    replyType: number = 1,
    root: number = 0,
    parent: number = 0,
    plat: number = 1,
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      type: String(replyType),
      oid: String(oid),
      message,
      plat: String(plat),
      csrf,
    });
    if (root > 0) body.set('root', String(root));
    if (parent > 0) body.set('parent', String(parent));

    return this.client.request<BiliApiResponse<ReplyAddResult>>(
      'https://api.bilibili.com/x/v2/reply/add',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
  }

  /**
   * 点赞 / 取消点赞
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param action - 操作类型
   * @param replyType - 评论区类型，见 {@link ReplyType}
   */
  async like(oid: number, rpid: number, action: ReplyAction = ReplyAction.LIKE, replyType: number = 1) {
    return this.actionRequest('https://api.bilibili.com/x/v2/reply/action', { replyType, oid, rpid, action });
  }

  /**
   * 点踩 / 取消点踩
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param action - 操作类型
   * @param replyType - 评论区类型，见 {@link ReplyType}
   */
  async hate(oid: number, rpid: number, action: ReplyHateAction = ReplyHateAction.HATE, replyType: number = 1) {
    return this.actionRequest('https://api.bilibili.com/x/v2/reply/hate', { replyType, oid, rpid, action });
  }

  /**
   * 删除评论
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param replyType - 评论区类型，见 {@link ReplyType}
   */
  async delete(oid: number, rpid: number, replyType: number = 1) {
    const csrf = this.extractCsrf();
    return this.client.request<BiliApiResponse<null>>('https://api.bilibili.com/x/v2/reply/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ type: String(replyType), oid: String(oid), rpid: String(rpid), csrf }).toString(),
    });
  }

  /**
   * 置顶 / 取消置顶
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param action - 操作类型
   * @param replyType - 评论区类型，见 {@link ReplyType}
   */
  async top(oid: number, rpid: number, action: ReplyTopAction = ReplyTopAction.TOP, replyType: number = 1) {
    return this.actionRequest('https://api.bilibili.com/x/v2/reply/top', { replyType, oid, rpid, action });
  }

  /**
   * 举报评论
   * @param oid - 评论区对象 ID，对应 {@link ReplyEntry.oid}
   * @param rpid - 评论 ID，{@link ReplyEntry.rpid}
   * @param reason - 举报原因
   * @param replyType - 评论区类型，见 {@link ReplyType}
   * @param content - 补充说明
   */
  async report(
    oid: number, rpid: number, reason: ReplyReportReason = ReplyReportReason.SPAM, replyType: number = 1, content?: string,
  ) {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({ type: String(replyType), oid: String(oid), rpid: String(rpid), reason: String(reason), csrf });
    if (content) body.set('content', content);
    return this.client.request<BiliApiResponse<null>>('https://api.bilibili.com/x/v2/reply/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  // ---- 内部 ----

  private extractCsrf(): string {
    const cookie = this.client.config.data.cookie;
    const match = cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!match) throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    return match[1];
  }

  private async actionRequest(
    url: string,
    params: { replyType: number; oid: number; rpid: number; action: number },
  ): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      type: String(params.replyType), oid: String(params.oid),
      rpid: String(params.rpid), action: String(params.action), csrf,
    });
    return this.client.request<BiliApiResponse<null>>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
