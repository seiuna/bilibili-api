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

// ==========================================
// 评论区 API
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
   */
  async *replies(
    oid: number,
    type: number = 1,
    sort: ReplySort = ReplySort.TIME,
    nohot: 0 | 1 = 0,
    pageSize: number = 20,
  ): AsyncGenerator<ReplyPage> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(type),
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


  /** 懒加载，逐页 yield CommentResult */
  async *repliesWbi(
    oid: number,
    type: number = 1,
    mode: ReplyMode = ReplyMode.HEAT,
  ): AsyncGenerator<{ cursor: number; comments: CommentResult[]; hots: CommentResult[] | null }> {
    let nextOffset = '';
    let isEnd = false;

    while (!isEnd) {
      const params = new URLSearchParams({
        type: String(type),
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


  /** 指定评论的回复，逐页 yield CommentResult */
  async *replyDialog(
    oid: number,
    rootRpid: number,
    type: number = 1,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: CommentResult[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(type),
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

  /** 热评，逐页 yield CommentResult */
  async *hotReplies(
    oid: number,
    type: number = 1,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: CommentResult[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const params = new URLSearchParams({
        type: String(type),
        oid: String(oid),
        ps: String(Math.min(pageSize, 49)),
        pn: String(pn),
      });

      const url = `https://api.bilibili.com/x/v2/reply/hot?${params.toString()}`;
      const data = await this.client.request<BiliApiResponse<ReplyMainData>>(url);

      if (data.code !== 0) break;

      const page = data.data.page;
      if (totalPages === null && page) {
        totalPages = Math.ceil(page.acount / page.size);
      }

      const comments = (data.data.replies ?? []).map(
        r => new CommentResult(this.client, r, oid),
      );

      if (comments.length) yield { page: pn, comments };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  // ---- 获取评论总数 ----

  async replyCount(
    oid: number,
    type: number = 1,
  ): Promise<BiliApiResponse<{ count: number }>> {
    const params = new URLSearchParams({ type: String(type), oid: String(oid) });
    return this.client.request(
      `https://api.bilibili.com/x/v2/reply/count?${params.toString()}`,
    );
  }

  // ---- 发表评论 ----

  async add(
    oid: number,
    message: string,
    type: number = 1,
    root: number = 0,
    parent: number = 0,
    plat: number = 1,
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      type: String(type),
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

  // ---- 点赞 / 点踩 / 删除 / 置顶 / 举报 ----

  async like(oid: number, rpid: number, action: ReplyAction = ReplyAction.LIKE, type: number = 1) {
    return this.actionRequest('https://api.bilibili.com/x/v2/reply/action', { type, oid, rpid, action });
  }
  async hate(oid: number, rpid: number, action: ReplyHateAction = ReplyHateAction.HATE, type: number = 1) {
    return this.actionRequest('https://api.bilibili.com/x/v2/reply/hate', { type, oid, rpid, action });
  }
  async delete(oid: number, rpid: number, type: number = 1) {
    const csrf = this.extractCsrf();
    return this.client.request<BiliApiResponse<null>>('https://api.bilibili.com/x/v2/reply/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ type: String(type), oid: String(oid), rpid: String(rpid), csrf }).toString(),
    });
  }
  async top(oid: number, rpid: number, action: ReplyTopAction = ReplyTopAction.TOP, type: number = 1) {
    return this.actionRequest('https://api.bilibili.com/x/v2/reply/top', { type, oid, rpid, action });
  }
  async report(
    oid: number, rpid: number, reason: ReplyReportReason = ReplyReportReason.SPAM, type: number = 1, content?: string,
  ) {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({ type: String(type), oid: String(oid), rpid: String(rpid), reason: String(reason), csrf });
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
    params: { type: number; oid: number; rpid: number; action: number },
  ): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      type: String(params.type), oid: String(params.oid),
      rpid: String(params.rpid), action: String(params.action), csrf,
    });
    return this.client.request<BiliApiResponse<null>>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
