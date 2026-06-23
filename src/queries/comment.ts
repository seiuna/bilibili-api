import type { BiliClient } from '../client.js';
import type { RequestContext, BiliApiResponse } from '../types.js';
import { UserQuery } from './user.js';

// ==========================================
// CommentQuery — 评论查询
// ==========================================

/** 评论回复对象 */
export interface CommentReply {
  rpid: number;
  oid: number;
  type: number;
  mid: number;
  root: number;
  parent: number;
  count: number;
  rcount: number;
  like: number;
  ctime: number;
  member: {
    mid: string;
    uname: string;
    avatar: string;
    level_info: { current_level: number };
  };
  content: {
    message: string;
  };
}

/** 评论列表 data */
export interface ReplyData {
  page: { num: number; size: number; count: number; acount: number };
  replies: CommentReply[];
}

export class CommentQuery {
  constructor(
    private client: BiliClient,
    private ctx: RequestContext,
  ) {}

  /** 获取评论的用户 */
  getUser(): UserQuery {
    return new UserQuery(this.client, this.ctx);
  }

  /** 发起请求，获取评论列表 */
  async fetch(): Promise<BiliApiResponse<ReplyData>> {
    const oid = this.ctx.oid ?? this.ctx.vid;
    if (!oid) {
      throw new Error('CommentQuery.fetch(): 缺少 oid 或 vid');
    }
    return this.client.request(
      `https://api.bilibili.com/x/v2/reply?type=1&oid=${oid}`,
    );
  }
}
