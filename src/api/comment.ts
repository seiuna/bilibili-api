import type { BiliClient } from '../core/client.js';
import type { BiliApiResponse } from '../core/types.js';

export enum ReplyType {
  VIDEO = 1,
  DYNAMIC = 11,
  ARTICLE = 12,
  AUDIO = 14,
  ALBUM = 16,
}

export enum ReplySort {
  TIME = 0,
  LIKE = 1,
  REPLY_COUNT = 2,
}

export enum ReplyMode {
  HEAT = 2,
  TIME = 3,
  BOTH = 4,
}

export enum ReplyAction {
  UNLIKE = 0,
  LIKE = 1,
}

export enum ReplyHateAction {
  UNHATE = 0,
  HATE = 1,
}

export enum ReplyTopAction {
  UNTOP = 0,
  TOP = 1,
}

export enum ReplyReportReason {
  OTHER = 0,
  SPAM = 1,
  PORN = 2,
  FLOOD = 3,
  PROVOCATION = 4,
  SPOILER = 5,
  POLITICS = 6,
  ATTACK = 7,
  IRRELEVANT = 8,
  ILLEGAL = 9,
  VULGAR = 10,
  ILLEGAL_SITE = 11,
  GAMBLING = 12,
  MISINFO = 13,
  INCITEMENT = 14,
  PRIVACY = 15,
  FLOOR_HOG = 16,
  YOUTH_BAD = 17,
}

// ---- 类型定义 ----

export interface ReplyMember {
  mid: string;
  uname: string;
  avatar: string;
  sex: string;
  sign: string;
  rank: number;
  level_info: { current_level: number };
  official_verify?: { type: number; desc: string };
  vip?: { vipStatus: number; vipType: number };
  fans_detail?: null;
  following?: number;
  is_followed?: number;
}

export interface ReplyContent {
  message: string;
  emote?: Record<string, { id: number; text: string; url: string }>;
  jump_url?: Record<string, unknown>;
  max_line?: number;
  members?: unknown[];
}

/**
 * 无法通过 oid: 反向查询出对应的视频/动态
 */
export interface ReplyEntry {
  /**
   * 评论 ID（Reply ID）
   * 用于唯一标识一条评论
   */
  rpid: number;

  /**
   * 评论区所属资源 ID
   *
   * 不同 type 下含义不同：
   * - type = 1：视频 aid
   * - type = 11：图文动态 doc_id
   * - type = 12：专栏 cvid
   * - type = 14：音频 auid
   * - type = 17：动态 dynamic_id
   */
  oid: number;

  /**
   * 评论区类型
   *
   * 常见值：
   * - 1：视频
   * - 11：图文动态
   * - 12：专栏
   * - 14：音频
   * - 17：动态 / 转发动态
   * - 22：漫画
   * - 33：课程
   */
  type: number;
  mid: number;
  root: number;
  parent: number;
  count: number;
  rcount: number;
  like: number;
  ctime: number;
  member: ReplyMember;
  content: ReplyContent;
  replies: ReplyEntry[] | null;
  action: number;
  state: number;
  assist: number;
  up_action: { like: boolean; reply: boolean };
  invisible: boolean;
  card_label?: { rpid: number; text_content: string }[];
  reply_control: { time_desc: string; location: string; sub_reply_entry_text: string };
  folder: { has_folded: boolean; is_folded: boolean; rule: string };
  dynamic_id_str?: string;
}

export interface ReplyMainData {
  page: { num: number; size: number; count: number; acount: number };
  config: unknown;
  replies: ReplyEntry[] | null;
  hots: ReplyEntry[] | null;
  upper: { mid: number; top: ReplyEntry | null } | null;
  top: null;
  notice: { content: string; id: number; link: string; title: string } | null;
  control: unknown;
  folder: { has_folded: boolean; is_folded: boolean; rule: string };
  show_bvid: boolean;
}

export interface ReplyCursor {
  all_count: number;
  is_begin: boolean;
  prev: number;
  next: number;
  is_end: boolean;
  mode: number;
  support_mode: number[];
  name: string;
  pagination_reply: { next_offset: string; prev_offset: string };
  session_id: string;
}

export interface ReplyWbiMainData {
  cursor: ReplyCursor;
  replies: ReplyEntry[] | null;
  hots: ReplyEntry[] | null;
  top: { admin: ReplyEntry | null; upper: ReplyEntry | null; vote: ReplyEntry | null };
  top_replies: ReplyEntry[];
  notice: { content: string; id: number; link: string; title: string } | null;
  config: unknown;
  control: unknown;
  folder: { has_folded: boolean; is_folded: boolean; rule: string };
  upper: { mid: number };
  show_bvid: boolean;
}

export interface ReplyAddResult {
  success_action: number;
  success_toast: string;
  need_captcha: boolean;
  url: string;
  rpid: number;
  rpid_str: string;
  dialog: number;
  dialog_str: string;
  root: number;
  root_str: string;
  parent: number;
  parent_str: string;
}

export interface ReplyPage {
  page: number;
  comments: ReplyEntry[];
  hots: ReplyEntry[] | null;
}

// ---- API 方法 ----

export class CommentAPI {
  /** 获取评论区单页明细 */
  static async getReplies(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    sort: ReplySort = ReplySort.TIME,
    nohot: 0 | 1 = 0,
    pn: number = 1,
    pageSize: number = 20,
  ): Promise<BiliApiResponse<ReplyMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: String(oid),
      sort: String(sort),
      nohot: String(nohot),
      ps: String(Math.min(pageSize, 20)),
      pn: String(pn),
    });
    return client.request<BiliApiResponse<ReplyMainData>>(
      `https://api.bilibili.com/x/v2/reply?${params}`,
    );
  }

  /** 获取评论区明细 — async generator 逐页 yield */
  static async *replies(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    sort: ReplySort = ReplySort.TIME,
    nohot: 0 | 1 = 0,
    pageSize: number = 20,
  ): AsyncGenerator<ReplyPage> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const data = await this.getReplies(client, oid, replyType, sort, nohot, pn, pageSize);
      if (data.code !== 0 || !data.data) break;

      const page = data.data.page;
      if (totalPages === null && page) {
        totalPages = Math.ceil(page.acount / page.size);
      }

      const comments = data.data.replies ?? [];
      const hots = data.data.hots ?? null;

      if (comments.length) yield { page: pn, comments, hots };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /** 获取评论区单页明细（WBI 接口） */
  static async getRepliesWbi(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    mode: ReplyMode = ReplyMode.HEAT,
    paginationStr?: string,
  ): Promise<BiliApiResponse<ReplyWbiMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: String(oid),
      mode: String(mode),
    });
    if (paginationStr) {
      params.set('pagination_str', paginationStr);
    }
    return client.request<BiliApiResponse<ReplyWbiMainData>>(
      `https://api.bilibili.com/x/v2/reply/main?${params}`,
    );
  }

  /** 懒加载翻页（WBI 接口） — async generator */
  static async *repliesWbi(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    mode: ReplyMode = ReplyMode.HEAT,
  ): AsyncGenerator<{ cursor: number; comments: ReplyEntry[]; hots: ReplyEntry[] | null }> {
    let nextOffset = '';
    let isEnd = false;

    while (!isEnd) {
      const paginationStr = nextOffset ? JSON.stringify({ offset: nextOffset }) : undefined;
      const data = await this.getRepliesWbi(client, oid, replyType, mode, paginationStr);
      if (data.code !== 0 || !data.data) break;

      const { cursor, replies } = data.data;
      const comments = replies ?? [];
      const hots = data.data.hots ?? null;

      if (comments.length) yield { cursor: cursor.next, comments, hots };

      isEnd = cursor.is_end;
      nextOffset = cursor.pagination_reply?.next_offset ?? '';
      if (!nextOffset) break;
    }
  }

  /** 获取指定评论单页回复列表（楼中楼） */
  static async getReplyDialog(
    client: BiliClient<any>,
    oid: number,
    rootRpid: number,
    replyType: number,
    pn: number = 1,
    pageSize: number = 20,
  ): Promise<BiliApiResponse<ReplyMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: String(oid),
      root: String(rootRpid),
      ps: String(Math.min(pageSize, 49)),
      pn: String(pn),
    });
    return client.request<BiliApiResponse<ReplyMainData>>(
      `https://api.bilibili.com/x/v2/reply/reply?${params}`,
    );
  }

  /** 获取指定评论的回复列表（楼中楼） — async generator */
  static async *replyDialog(
    client: BiliClient<any>,
    oid: number,
    rootRpid: number,
    replyType: number,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: ReplyEntry[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const data = await this.getReplyDialog(client, oid, rootRpid, replyType, pn, pageSize);
      if (data.code !== 0 || !data.data) break;

      const page = data.data.page;
      if (totalPages === null && page) {
        totalPages = Math.ceil(page.count / page.size);
      }

      const comments = data.data.replies ?? [];
      if (comments.length) yield { page: pn, comments };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /** 获取热评单页列表 */
  static async getHotReplies(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    pn: number = 1,
    pageSize: number = 20,
  ): Promise<BiliApiResponse<ReplyMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: String(oid),
      ps: String(Math.min(pageSize, 49)),
      pn: String(pn),
    });
    return client.request<BiliApiResponse<ReplyMainData>>(
      `https://api.bilibili.com/x/v2/reply/hot?${params}`,
    );
  }

  /** 获取热评列表 — async generator */
  static async *hotReplies(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: ReplyEntry[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const data = await this.getHotReplies(client, oid, replyType, pn, pageSize);
      if (data.code !== 0 || !data.data) break;

      const page = data.data.page;
      if (totalPages === null) {
        totalPages = page ? Math.ceil(page.acount / page.size) : 1;
      }

      const comments = data.data.replies ?? [];
      if (comments.length) yield { page: pn, comments };

      if (pn >= (totalPages ?? 1) || !comments.length) break;
      pn++;
    }
  }

  /** 获取评论总数 */
  static async replyCount(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
  ): Promise<BiliApiResponse<{ count: number }>> {
    const params = new URLSearchParams({ type: String(replyType), oid: String(oid) });
    return client.request(`https://api.bilibili.com/x/v2/reply/count?${params}`);
  }

  /** 获取单条评论信息（通过 jump 定位接口） */
  static async getReply(
    client: BiliClient<any>,
    oid: number,
    replyType: number,
    rpid: number | string,
  ): Promise<BiliApiResponse<ReplyEntry>> {
    const params = new URLSearchParams({
      oid: String(oid),
      type: String(replyType),
      rpid: String(rpid),
    });
    const res = await client.request<BiliApiResponse<{ replies?: ReplyEntry[]; root?: ReplyEntry }>>(
      `https://api.bilibili.com/x/v2/reply/jump?${params}`,
    );

    const target =
      res.data?.replies?.find((r) => String(r.rpid) === String(rpid)) ??
      (res.data?.root && String(res.data.root.rpid) === String(rpid) ? res.data.root : null);

    return {
      code: res.code,
      message: res.message,
      ttl: res.ttl,
      data: target as ReplyEntry,
    };
  }

  /**
   * 尝试解析未知评论区归属的评论 rpid
   * 可传入已知的 candidateSubjects，或自动从最近的消息通知 (@我的 / 回复我的) 中探测
   */
  static async resolveReply(
    client: BiliClient<any>,
    rpid: number | string,
    candidateSubjects?: { oid: number; replyType: number }[],
  ): Promise<{ reply: ReplyEntry; oid: number; replyType: number } | null> {
    const rpidStr = String(rpid).trim();
    const subjects: { oid: number; replyType: number }[] = candidateSubjects ? [...candidateSubjects] : [];

    if (subjects.length === 0) {
      try {
        const { MessageAPI } = await import('./message.js');
        const [atRes, replyRes] = await Promise.allSettled([
          MessageAPI.getAtFeed(client),
          MessageAPI.getReplyFeed(client),
        ]);

        if (atRes.status === 'fulfilled' && atRes.value.data?.items) {
          for (const it of atRes.value.data.items) {
            if (it.item?.subject_id && it.item?.business_id) {
              subjects.push({ oid: it.item.subject_id, replyType: it.item.business_id });
            }
          }
        }

        if (replyRes.status === 'fulfilled' && replyRes.value.data?.items) {
          for (const it of replyRes.value.data.items) {
            if (it.item?.subject_id && it.item?.business_id) {
              subjects.push({ oid: it.item.subject_id, replyType: it.item.business_id });
            }
          }
        }
      } catch {
        // ignore feed lookup errors
      }
    }

    const unique: { oid: number; replyType: number }[] = [];
    const seen = new Set<string>();
    for (const s of subjects) {
      const key = `${s.oid}_${s.replyType}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }

    for (const s of unique) {
      try {
        const res = await this.getReply(client, s.oid, s.replyType, rpidStr);
        if (res.data && String(res.data.rpid) === rpidStr) {
          return {
            reply: res.data,
            oid: s.oid,
            replyType: s.replyType,
          };
        }
      } catch {
        // continue trying
      }
    }

    return null;
  }

  /** 发表评论 */
  static async add(
    client: BiliClient<any>,
    oid: number,
    message: string,
    replyType: number,
    root = 0,
    parent = 0,
    plat = 1,
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      type: String(replyType),
      oid: String(oid),
      message,
      plat: String(plat),
      csrf,
    });
    if (root > 0) body.set('root', String(root));
    if (parent > 0) body.set('parent', String(parent));

    return client.request('https://api.bilibili.com/x/v2/reply/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 点赞 / 取消点赞 */
  static async like(
    client: BiliClient<any>,
    oid: number,
    rpid: number,
    replyType: number,
    action: ReplyAction = ReplyAction.LIKE,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: String(oid),
        rpid: String(rpid), action: String(action), csrf,
      }).toString(),
    });
  }

  /** 点踩 / 取消点踩 */
  static async hate(
    client: BiliClient<any>,
    oid: number,
    rpid: number,
    replyType: number,
    action: ReplyHateAction = ReplyHateAction.HATE,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/hate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: String(oid),
        rpid: String(rpid), action: String(action), csrf,
      }).toString(),
    });
  }

  /** 删除评论 */
  static async delete(
    client: BiliClient<any>,
    oid: number,
    rpid: number,
    replyType: number,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: String(oid),
        rpid: String(rpid), csrf,
      }).toString(),
    });
  }

  /** 置顶 / 取消置顶 */
  static async top(
    client: BiliClient<any>,
    oid: number,
    rpid: number,
    replyType: number,
    action: ReplyTopAction = ReplyTopAction.TOP,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/top', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: String(oid),
        rpid: String(rpid), action: String(action), csrf,
      }).toString(),
    });
  }

  /** 举报评论 */
  static async report(
    client: BiliClient<any>,
    oid: number,
    rpid: number,
    replyType: number,
    reason: ReplyReportReason = ReplyReportReason.SPAM,
    content?: string,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      type: String(replyType), oid: String(oid),
      rpid: String(rpid), reason: String(reason), csrf,
    });
    if (content) body.set('content', content);
    return client.request('https://api.bilibili.com/x/v2/reply/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
