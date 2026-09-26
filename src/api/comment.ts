import type { BiliClient } from '../core/client.js';
import { normalizeCommentId, type BiliApiResponse } from '../core/types.js';
import { assertOk } from '../core/client.js';
import type { Comment } from '../entities/Comment.js';

export enum ReplyType {
  VIDEO = 1,
  DYNAMIC = 11,
  ARTICLE = 12,
  AUDIO = 14,
  ALBUM = 16,
  /**
   * @deprecated Use DYNAMIC instead.
   */
  WORD_DYNAMIC = 17,
  COMIC = 22,
  COURSE = 33,
}

/**
 * 业务类型（即评论区与消息通知中的 business_id / replyType）
 * 对应各个业务分区的代码
 */
export enum BusinessType {
  /** 视频稿件 (type = 1, oid = aid) */
  Video = 1,
  /** 图文动态 / 相簿 / Opus (type = 11, oid = doc_id) */
  Dynamic = 11,
  /** 专栏文章 (type = 12, oid = cvid) */
  Article = 12,
  /** 音频音乐 (type = 14, oid = auid) */
  Audio = 14,
  /** 相册 (type = 16) */
  Album = 16,
  /** 纯文字动态 (type = 17, oid = dynamic_id) */
  WordDynamic = 17,
  /** 漫画 (type = 22) */
  Comic = 22,
  /** 课程 (type = 33) */
  Course = 33,
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

export interface ReplyPicture {
  img_src: string;
  img_width: number;
  img_height: number;
  img_size: number;
}

export interface ReplyContent {
  message: string;
  emote?: Record<string, { id: number; text: string; url: string }>;
  jump_url?: Record<string, unknown>;
  max_line?: number;
  members?: unknown[];
  pictures?: ReplyPicture[];
}

/**
 * 无法通过 oid: 反向查询出对应的视频/动态
 *
 * 实体包装见 {@link Comment}。
 */
export interface ReplyEntry {
  /**
   * 评论 ID（Reply ID）
   * 用于唯一标识一条评论
   */
  rpid: number;
  /** 精确的评论 ID；优先用于匹配，避免数值 ID 丢失精度。 */
  rpid_str?: string;

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
  /** Authoritative comment-area ID when supplied by the server. */
  oid_str?: string;

  /**
   * 评论区业务类型
   *
   * 常见值：
   * - BusinessType.Video (1)：视频
   * - BusinessType.Dynamic (11)：图文动态
   * - BusinessType.Article (12)：专栏
   * - BusinessType.Audio (14)：音频
   * - BusinessType.WordDynamic (17)：动态 / 转发动态
   * - BusinessType.Comic (22)：漫画
   * - BusinessType.Course (33)：课程
   */
  type: BusinessType | number;
  mid: number;
  root: number;
  root_str?: string;
  parent: number;
  parent_str?: string;
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

/** /x/v2/reply/reply: root is separate from the paginated child replies. */
export interface ReplyDialogData {
  root: ReplyEntry | null;
  replies: ReplyEntry[] | null;
  page: { num: number; size: number; count: number };
  config?: unknown;
  control?: unknown;
  upper?: { mid: number } | null;
  show_bvid?: boolean;
  show_text?: string;
  show_type?: number;
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

function pageNumber(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} 必须是正的安全整数`);
  return value;
}

// ---- API 方法 ----

export class CommentAPI {
  /** 获取评论区单页明细 */
  static async getReplies(
    client: BiliClient<any>,
    oid: number | string,
    replyType: BusinessType | number,
    sort: ReplySort = ReplySort.TIME,
    nohot: 0 | 1 = 0,
    pn: number = 1,
    pageSize: number = 20,
  ): Promise<BiliApiResponse<ReplyMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: normalizeCommentId(oid, 'oid'),
      sort: String(sort),
      nohot: String(nohot),
      ps: String(Math.min(pageNumber(pageSize, 'pageSize'), 20)),
      pn: String(pageNumber(pn, 'pn')),
    });
    return client.request<BiliApiResponse<ReplyMainData>>(
      `https://api.bilibili.com/x/v2/reply?${params}`,
    );
  }

  /** 获取评论区明细 — async generator 逐页 yield */
  static async *replies(
    client: BiliClient<any>,
    oid: number | string,
    replyType: BusinessType | number,
    sort: ReplySort = ReplySort.TIME,
    nohot: 0 | 1 = 0,
    pageSize: number = 20,
  ): AsyncGenerator<ReplyPage> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const data = await this.getReplies(client, oid, replyType, sort, nohot, pn, pageSize);
      assertOk(data);
      if (!data.data) throw new Error('评论分页响应缺少 data');

      const page = data.data.page;
      if (totalPages === null && page) {
        totalPages = Math.ceil(page.count / page.size);
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
    oid: number | string,
    replyType: BusinessType | number,
    mode: ReplyMode = ReplyMode.HEAT,
    paginationStr?: string,
  ): Promise<BiliApiResponse<ReplyWbiMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: normalizeCommentId(oid, 'oid'),
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
    oid: number | string,
    replyType: BusinessType | number,
    mode: ReplyMode = ReplyMode.HEAT,
  ): AsyncGenerator<{ cursor: number; comments: ReplyEntry[]; hots: ReplyEntry[] | null }> {
    let nextOffset = '';
    let isEnd = false;

    while (!isEnd) {
      const paginationStr = nextOffset ? JSON.stringify({ offset: nextOffset }) : undefined;
      const data = await this.getRepliesWbi(client, oid, replyType, mode, paginationStr);
      assertOk(data);
      if (!data.data) throw new Error('评论分页响应缺少 data');

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
    oid: number | string,
    rootRpid: number | string,
    replyType: BusinessType | number,
    pn: number = 1,
    pageSize: number = 20,
  ): Promise<BiliApiResponse<ReplyDialogData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: normalizeCommentId(oid, 'oid'),
      root: normalizeCommentId(rootRpid, 'rootRpid'),
      ps: String(Math.min(pageNumber(pageSize, 'pageSize'), 49)),
      pn: String(pageNumber(pn, 'pn')),
    });
    return client.request<BiliApiResponse<ReplyDialogData>>(
      `https://api.bilibili.com/x/v2/reply/reply?${params}`,
    );
  }

  /** 获取指定评论的回复列表（楼中楼） — async generator */
  static async *replyDialog(
    client: BiliClient<any>,
    oid: number | string,
    rootRpid: number | string,
    replyType: BusinessType | number,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: ReplyEntry[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const data = await this.getReplyDialog(client, oid, rootRpid, replyType, pn, pageSize);
      assertOk(data);
      if (!data.data) throw new Error('评论分页响应缺少 data');

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
    oid: number | string,
    replyType: BusinessType | number,
    pn: number = 1,
    pageSize: number = 20,
  ): Promise<BiliApiResponse<ReplyMainData>> {
    const params = new URLSearchParams({
      type: String(replyType),
      oid: normalizeCommentId(oid, 'oid'),
      ps: String(Math.min(pageNumber(pageSize, 'pageSize'), 49)),
      pn: String(pageNumber(pn, 'pn')),
    });
    return client.request<BiliApiResponse<ReplyMainData>>(
      `https://api.bilibili.com/x/v2/reply/hot?${params}`,
    );
  }

  /** 获取热评列表 — async generator */
  static async *hotReplies(
    client: BiliClient<any>,
    oid: number | string,
    replyType: number,
    pageSize: number = 20,
  ): AsyncGenerator<{ page: number; comments: ReplyEntry[] }> {
    let pn = 1;
    let totalPages: number | null = null;

    while (true) {
      const data = await this.getHotReplies(client, oid, replyType, pn, pageSize);
      assertOk(data);
      if (!data.data) throw new Error('评论分页响应缺少 data');

      const page = data.data.page;
      if (totalPages === null) {
        totalPages = page ? Math.ceil(page.count / page.size) : 1;
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
    oid: number | string,
    replyType: number,
  ): Promise<BiliApiResponse<{ count: number }>> {
    const params = new URLSearchParams({ type: String(replyType), oid: normalizeCommentId(oid, 'oid') });
    return client.request(`https://api.bilibili.com/x/v2/reply/count?${params}`);
  }

  /**
   * 在 jump 响应中定位指定评论，不会把其他评论当作目标返回。
   * @param client 请求客户端
   * @param oid 评论区主体 ID，例如通知的 subject_id
   * @param replyType 评论区业务类型，例如通知的 business_id
   * @param rpid 要查询的评论 ID（不固定对应通知的 target_id）
   * @returns 保留上游状态；请求失败或响应中未找到目标时 data 为 null。
   */
  static async getReply(
    client: BiliClient<any>,
    oid: number | string,
    replyType: number,
    rpid: number | string,
  ): Promise<BiliApiResponse<ReplyEntry | null>> {
    const rpidStr = normalizeCommentId(rpid, 'rpid').trim();
    const params = new URLSearchParams({
      oid: normalizeCommentId(oid, 'oid').trim(),
      type: String(replyType),
      rpid: rpidStr,
    });
    const res = await client.request<BiliApiResponse<{
      replies?: ReplyEntry[] | null;
      root?: ReplyEntry | null;
    } | null>>(`https://api.bilibili.com/x/v2/reply/jump?${params}`);

    let target: ReplyEntry | null = null;
    if (res.code === 0 && res.data) {
      const stack = [...(res.data.replies ?? [])];
      if (res.data.root) stack.push(res.data.root);
      while (stack.length > 0) {
        const reply = stack.pop()!;
        const id = reply.rpid_str ?? (
          Number.isSafeInteger(reply.rpid) ? String(reply.rpid) : undefined
        );
        if (id === rpidStr) {
          target = reply;
          break;
        }
        if (Array.isArray(reply.replies)) stack.push(...reply.replies);
      }
    }

    return { code: res.code, message: res.message, ttl: res.ttl, data: target };
  }

  /**
   * 尝试解析未知评论区归属的评论 rpid
   * 可传入已知的 candidateSubjects，或自动从最近的消息通知 (@我的 / 回复我的) 中探测
   */
  static async resolveReply(
    client: BiliClient<any>,
    rpid: number | string,
    candidateSubjects?: { oid: number | string; replyType: number }[],
  ): Promise<{ reply: ReplyEntry; oid: number | string; replyType: number } | null> {
    const rpidStr = normalizeCommentId(rpid, 'rpid').trim();
    const subjects: { oid: number | string; replyType: number }[] = candidateSubjects ? [...candidateSubjects] : [];
    for (const subject of subjects) normalizeCommentId(subject.oid, 'oid');

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

    const unique: { oid: number | string; replyType: number }[] = [];
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
        if (res.code === 0 && res.data) {
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
    oid: number | string,
    message: string,
    replyType: number,
    root: string | number = 0,
    parent: string | number = 0,
    plat = 1,
  ): Promise<BiliApiResponse<ReplyAddResult>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      type: String(replyType),
      oid: normalizeCommentId(oid, 'oid'),
      message,
      plat: String(plat),
      csrf,
    });
    const rootId = normalizeCommentId(root, 'root', true);
    const parentId = normalizeCommentId(parent, 'parent', true);
    if (rootId !== '0') body.set('root', rootId);
    if (parentId !== '0') body.set('parent', parentId);

    return client.request('https://api.bilibili.com/x/v2/reply/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 点赞 / 取消点赞 */
  static async like(
    client: BiliClient<any>,
    oid: number | string,
    rpid: number | string,
    replyType: number,
    action: ReplyAction = ReplyAction.LIKE,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: normalizeCommentId(oid, 'oid'),
        rpid: normalizeCommentId(rpid, 'rpid'), action: String(action), csrf,
      }).toString(),
    });
  }

  /** 点踩 / 取消点踩 */
  static async hate(
    client: BiliClient<any>,
    oid: number | string,
    rpid: number | string,
    replyType: number,
    action: ReplyHateAction = ReplyHateAction.HATE,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/hate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: normalizeCommentId(oid, 'oid'),
        rpid: normalizeCommentId(rpid, 'rpid'), action: String(action), csrf,
      }).toString(),
    });
  }

  /** 删除评论 */
  static async delete(
    client: BiliClient<any>,
    oid: number | string,
    rpid: number | string,
    replyType: number,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: normalizeCommentId(oid, 'oid'),
        rpid: normalizeCommentId(rpid, 'rpid'), csrf,
      }).toString(),
    });
  }

  /** 置顶 / 取消置顶 */
  static async top(
    client: BiliClient<any>,
    oid: number | string,
    rpid: number | string,
    replyType: number,
    action: ReplyTopAction = ReplyTopAction.TOP,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/reply/top', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        type: String(replyType), oid: normalizeCommentId(oid, 'oid'),
        rpid: normalizeCommentId(rpid, 'rpid'), action: String(action), csrf,
      }).toString(),
    });
  }

  /** 举报评论 */
  static async report(
    client: BiliClient<any>,
    oid: number | string,
    rpid: number | string,
    replyType: number,
    reason: ReplyReportReason = ReplyReportReason.SPAM,
    content?: string,
  ): Promise<BiliApiResponse<null>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      type: String(replyType), oid: normalizeCommentId(oid, 'oid'),
      rpid: normalizeCommentId(rpid, 'rpid'), reason: String(reason), csrf,
    });
    if (content) body.set('content', content);
    return client.request('https://api.bilibili.com/x/v2/reply/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
