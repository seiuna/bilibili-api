import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

// ---- 枚举 ----

export enum SessionType {
  USER = 1,
  GROUP = 2,
}

export enum SessionQueryType {
  USER_AND_SYSTEM = 1,
  UNFOLLOW = 2,
  GROUP = 3,
  ALL = 4,
  INTERCEPTED = 5,
  BUSINESS = 6,
  ALL_SYSTEM = 7,
  STRANGER = 8,
  FOLLOWED_AND_SYSTEM = 9,
}

export enum DndSetting {
  OFF = 0,
  ON = 1,
}

export enum PushSetting {
  RECEIVE = 0,
  BLOCK = 1,
}

export enum InterceptStatus {
  OFF = 0,
  ON = 1,
}

export enum TopOpType {
  TOP = 0,
  UNTOP = 1,
}

// ---- 类型定义 ----

export interface UnreadCount {
  at: number;
  chat: number;
  coin: number;
  danmu: number;
  favorite: number;
  like: number;
  recv_like: number;
  recv_reply: number;
  reply: number;
  sys_msg: number;
  sys_msg_style: number;
  up: number;
}

export interface ReplyUser {
  mid: number;
  fans: number;
  nickname: string;
  avatar: string;
  mid_link: string;
  follow: boolean;
}

export interface ReplyItemDetail {
  subject_id: number;
  root_id: number;
  source_id: number;
  target_id: number;
  type: string;
  business_id: number;
  business: string;
  title: string;
  desc: string;
  image: string;
  uri: string;
  native_uri: string;
  detail_title: string;
  root_reply_content: string;
  source_content: string;
  target_reply_content: string;
  like_state: number;
  message: string;
}

export interface ReplyNotification {
  id: number;
  user: ReplyUser;
  item: ReplyItemDetail;
  counts: number;
  is_multi: number;
  reply_time: number;
}

export interface ReplyFeedData {
  cursor: { is_end: boolean; id: number; time: number };
  items: ReplyNotification[];
  last_view_at: number;
}

export interface AtItemDetail {
  type: string;
  business: string;
  business_id: number;
  title: string;
  image: string;
  uri: string;
  subject_id: number;
  root_id: number;
  target_id: number;
  source_id: number;
  source_content: string;
  native_uri: string;
  at_details: { mid: number; nickname: string; avatar: string }[];
  topic_details: unknown[];
  hide_reply_button: boolean;
}

export interface AtNotification {
  id: number;
  user: ReplyUser;
  item: AtItemDetail;
  at_time: number;
}

export interface AtFeedData {
  cursor: { is_end: boolean; id: number; time: number };
  items: AtNotification[];
}

export interface ChatMessage {
  sender_uid: number;
  receiver_type: number;
  receiver_id: number;
  msg_type: number;
  content: string;
  msg_seqno: number;
  timestamp: number;
  at_uids: number[] | null;
  msg_key: number;
  msg_status: number;
  sys_cancel?: boolean;
  notify_code: string;
  new_face_version: number;
  msg_source: unknown;
}

export interface ChatSession {
  talker_id: number;
  session_type: number;
  top_ts: number;
  group_name: string;
  group_cover: string;
  is_follow: number;
  is_dnd: number;
  ack_seqno: number;
  ack_ts: number;
  session_ts: number;
  unread_count: number;
  last_msg: ChatMessage | null;
  group_type: number;
  can_fold: number;
  status: number;
  max_seqno: number;
  new_push_msg: number;
  setting: number;
  is_guardian: number;
  is_intercept: number;
  is_trust: number;
  system_msg_type: number;
  account_info?: { name: string; pic_url: string };
  live_status: number;
  biz_msg_unread_count: number;
}

export interface SessionListData {
  session_list: ChatSession[] | null;
  has_more: number;
  show_level: boolean;
}

export interface SingleUnreadData {
  unfollow_unread: number;
  follow_unread: number;
  unfollow_push_msg: number;
  dustbin_push_msg: number;
  dustbin_unread: number;
  biz_msg_unfollow_unread: number;
  biz_msg_follow_unread: number;
  custom_unread: number;
}

export interface MessageSettings {
  show_unfollowed_msg: number;
  msg_notify: number;
  set_like: number;
  set_comment: number;
  set_at: number;
  is_group_fold: number;
  should_receive_group: number;
  receive_unfollow_msg: number;
  followed_reply: number;
  keys_reply: number;
  recv_reply: number;
  voyage_reply: number;
  recommend_followed_reply: number;
  ai_intercept: number;
  set_recv_reply: number;
  set_recv_like: number;
  set_new_follow: number;
}

// ---- API 方法 ----

export class MessageAPI {
  /** 获取未读消息�?*/
  static async unreadCount(client: BiliClient<any>): Promise<BiliApiResponse<UnreadCount>> {
    return client.request('https://api.vc.bilibili.com/x/im/web/msgfeed/unread');
  }

  /** 获取"回复我的"信息 �?async generator 翻页 */
  static async *replyFeed(client: BiliClient<any>): AsyncGenerator<ReplyNotification> {
    let cursorId = 0;
    let cursorTime = 0;
    let isEnd = false;

    while (!isEnd) {
      const params = new URLSearchParams();
      if (cursorId > 0) params.set('id', String(cursorId));
      if (cursorTime > 0) params.set('reply_time', String(cursorTime));

      const data = await client.request<BiliApiResponse<ReplyFeedData>>(
        `https://api.bilibili.com/x/msgfeed/reply?${params}`,
      );

      if (data.code !== 0) break;

      for (const item of data.data.items) yield item;

      isEnd = data.data.cursor.is_end;
      cursorId = data.data.cursor.id;
      cursorTime = data.data.cursor.time;

      if (data.data.items.length === 0) break;
    }
  }

  /** 获取"@我的"信息 �?async generator 翻页 */
  static async *atFeed(client: BiliClient<any>): AsyncGenerator<AtNotification> {
    let cursorId = 0;
    let cursorTime = 0;
    let isEnd = false;

    while (!isEnd) {
      const params = new URLSearchParams({ platform: 'web', build: '0', mobi_app: 'web' });
      if (cursorId > 0) params.set('id', String(cursorId));
      if (cursorTime > 0) params.set('reply_time', String(cursorTime));

      const data = await client.request<BiliApiResponse<AtFeedData>>(
        `https://api.bilibili.com/x/msgfeed/at?${params}`,
      );

      if (data.code !== 0) break;

      for (const item of data.data.items) yield item;

      isEnd = data.data.cursor.is_end;
      cursorId = data.data.cursor.id;
      cursorTime = data.data.cursor.time;

      if (data.data.items.length === 0) break;
    }
  }

  /** 获取未读私信�?*/
  static async singleUnread(
    client: BiliClient<any>,
    unreadType: 0 | 1 | 2 | 3 = 0,
    showUnfollowList: 0 | 1 = 1,
    showDustbin: 0 | 1 = 1,
  ): Promise<BiliApiResponse<SingleUnreadData>> {
    const params = new URLSearchParams({
      unread_type: String(unreadType),
      show_unfollow_list: String(showUnfollowList),
      show_dustbin: String(showDustbin),
      build: '0',
      mobi_app: 'web',
    });
    return client.request(`https://api.vc.bilibili.com/session_svr/v1/session_svr/single_unread?${params}`);
  }

  /** 获取未读粉丝团私信数 */
  static async groupUnread(client: BiliClient<any>): Promise<BiliApiResponse<{ unread_count: number }>> {
    return client.request('https://api.vc.bilibili.com/session_svr/v1/session_svr/my_group_unread?build=0&mobi_app=web');
  }

  /** 获取指定类型会话列表 �?async generator */
  static async *sessions(
    client: BiliClient<any>,
    sessionType: SessionQueryType = SessionQueryType.ALL,
    size = 20,
    sortRule?: number,
  ): AsyncGenerator<{ sessions: ChatSession[]; hasMore: boolean }> {
    let beginTs = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        session_type: String(sessionType),
        size: String(Math.min(size, 100)),
        build: '0',
        mobi_app: 'web',
      });
      if (beginTs > 0) params.set('begin_ts', String(beginTs));
      if (sortRule !== undefined) params.set('sort_rule', String(sortRule));

      const data = await client.request<BiliApiResponse<SessionListData>>(
        `https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions?${params}`,
      );

      if (data.code !== 0 || !data.data.session_list?.length) break;

      yield { sessions: data.data.session_list, hasMore: data.data.has_more === 1 };

      hasMore = data.data.has_more === 1;
      if (hasMore && data.data.session_list.length > 0) {
        beginTs = data.data.session_list[data.data.session_list.length - 1].session_ts;
      }
    }
  }

  /** 获取新会话列�?*/
  static async *newSessions(
    client: BiliClient<any>,
    beginTs: number,
    size = 20,
  ): AsyncGenerator<{ sessions: ChatSession[]; hasMore: boolean }> {
    let currentTs = beginTs;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        begin_ts: String(currentTs),
        size: String(Math.min(size, 100)),
        build: '0',
        mobi_app: 'web',
      });

      const data = await client.request<BiliApiResponse<SessionListData>>(
        `https://api.vc.bilibili.com/session_svr/v1/session_svr/new_sessions?${params}`,
      );

      if (data.code !== 0 || !data.data.session_list?.length) break;

      yield { sessions: data.data.session_list, hasMore: data.data.has_more === 1 };

      hasMore = data.data.has_more === 1;
      if (hasMore && data.data.session_list.length > 0) {
        currentTs = data.data.session_list[data.data.session_list.length - 1].session_ts;
      }
    }
  }

  /** 获取会话详细信息 */
  static async sessionDetail(
    client: BiliClient<any>,
    talkerId: number,
    sessionType = 1,
  ): Promise<BiliApiResponse<ChatSession>> {
    const params = new URLSearchParams({
      talker_id: String(talkerId),
      session_type: String(sessionType),
      build: '0',
      mobi_app: 'web',
    });
    return client.request(`https://api.vc.bilibili.com/session_svr/v1/session_svr/session_detail?${params}`);
  }

  /** 标记已读 */
  static async markRead(
    client: BiliClient<any>,
    talkerId: number,
    sessionType = 1,
    ackSeqno?: number,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      talker_id: String(talkerId),
      session_type: String(sessionType),
      csrf,
      csrf_token: csrf,
      build: '0',
      mobi_app: 'web',
    });
    if (ackSeqno !== undefined) body.set('ack_seqno', String(ackSeqno));
    return client.request('https://api.vc.bilibili.com/session_svr/v1/session_svr/update_ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 移除会话 */
  static async removeSession(
    client: BiliClient<any>,
    talkerId: number,
    sessionType = 1,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return MessageAPI.postWithCsrf(client, 'https://api.vc.bilibili.com/session_svr/v1/session_svr/remove_session', {
      talker_id: talkerId, session_type: sessionType,
    });
  }

  /** 修改会话置顶状�?*/
  static async setTop(
    client: BiliClient<any>,
    talkerId: number,
    sessionType = 1,
    opType: TopOpType = TopOpType.TOP,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return MessageAPI.postWithCsrf(client, 'https://api.vc.bilibili.com/session_svr/v1/session_svr/set_top', {
      talker_id: talkerId, session_type: sessionType, op_type: opType,
    });
  }

  /** 修改会话免打扰状�?*/
  static async setDnd(
    client: BiliClient<any>,
    ownUid: number,
    setting: DndSetting,
    dndUid?: number,
    dndGroupId?: number,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      setting: String(setting), csrf, csrf_token: csrf,
      build: '0', mobi_app: 'web',
    });
    body.set('uid', String(ownUid));
    if (dndUid !== undefined) body.set('dnd_uid', String(dndUid));
    if (dndGroupId !== undefined) body.set('dnd_group_id', String(dndGroupId));
    return client.request('https://api.vc.bilibili.com/link_setting/v1/link_setting/set_msg_dnd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 修改会话推送设�?*/
  static async setPush(
    client: BiliClient<any>,
    talkerUid: number,
    setting: PushSetting,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return MessageAPI.postWithCsrf(client, 'https://api.vc.bilibili.com/link_setting/v1/link_setting/set_push_ss', {
      talker_uid: talkerUid, setting,
    });
  }

  /** 修改会话拦截状�?*/
  static async setIntercept(
    client: BiliClient<any>,
    talkerId: number,
    status: InterceptStatus,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return MessageAPI.postWithCsrf(client, 'https://api.vc.bilibili.com/session_svr/v1/session_svr/update_intercept', {
      talker_id: talkerId, status,
    });
  }

  /** 获取消息中心设置 */
  static async getSettings(client: BiliClient<any>): Promise<BiliApiResponse<MessageSettings>> {
    return client.request('https://api.vc.bilibili.com/link_setting/v1/link_setting/get?build=0&mobi_app=web');
  }

  /** 修改消息中心设置 */
  static async updateSettings(
    client: BiliClient<any>,
    settings: Partial<MessageSettings>,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({ csrf, csrf_token: csrf, build: '0', mobi_app: 'web' });
    for (const [k, v] of Object.entries(settings)) {
      body.set(k, String(v));
    }
    return client.request('https://api.vc.bilibili.com/link_setting/v1/link_setting/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  private static async postWithCsrf(
    client: BiliClient<any>,
    url: string,
    extra: Record<string, string | number>,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
      csrf, csrf_token: csrf, build: '0', mobi_app: 'web',
    });
    return client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
