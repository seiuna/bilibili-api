import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import {
  SessionQueryType,
  DndSetting,
  PushSetting,
  InterceptStatus,
  TopOpType,
} from './chat-types.js';
import type {
  SessionLimit,
  DndStatusItem,
  PushSettings,
  ChatSession,
  SingleUnreadData,
  GroupUnreadData,
  SessionListData,
} from './chat-types.js';

export class ChatAPI {
  constructor(private client: BiliClient) {}

  /** 获取未读私信数（用户私信） */
  async singleUnread(
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
    return this.client.request(
      `https://api.vc.bilibili.com/session_svr/v1/session_svr/single_unread?${params}`,
    );
  }

  /** 获取未读粉丝团私信数 */
  async groupUnread(): Promise<BiliApiResponse<GroupUnreadData>> {
    const params = new URLSearchParams({ build: '0', mobi_app: 'web' });
    return this.client.request(
      `https://api.vc.bilibili.com/session_svr/v1/session_svr/my_group_unread?${params}`,
    );
  }


  /**
   * 获取指定类型会话列表，async generator 逐页 yield
   *
   * @param sessionType - 会话类型，默认 ALL
   * @param size - 每页数量，默认 20，最大 100
   */
  async *sessions(
    sessionType: SessionQueryType = SessionQueryType.ALL,
    size: number = 20,
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

      const url = `https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions?${params}`;
      const data = await this.client.request<BiliApiResponse<SessionListData>>(url);

      if (data.code !== 0 || !data.data.session_list?.length) break;

      yield { sessions: data.data.session_list, hasMore: data.data.has_more === 1 };

      hasMore = data.data.has_more === 1;
      if (hasMore && data.data.session_list.length > 0) {
        // 用最后一条会话的 session_ts 作为下次查询起点
        const last = data.data.session_list[data.data.session_list.length - 1];
        beginTs = last.session_ts;
      }
    }
  }

  /**
   * 获取新会话列表（在指定时间之后），async generator 逐页 yield
   */
  async *newSessions(
    beginTs: number,
    size: number = 20,
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

      const url = `https://api.vc.bilibili.com/session_svr/v1/session_svr/new_sessions?${params}`;
      const data = await this.client.request<BiliApiResponse<SessionListData>>(url);

      if (data.code !== 0 || !data.data.session_list?.length) break;

      yield { sessions: data.data.session_list, hasMore: data.data.has_more === 1 };

      hasMore = data.data.has_more === 1;
      if (hasMore && data.data.session_list.length > 0) {
        const last = data.data.session_list[data.data.session_list.length - 1];
        currentTs = last.session_ts;
      }
    }
  }


  /** 获取会话详细信息 */
  async sessionDetail(
    talkerId: number,
    sessionType: number = 1,
  ): Promise<BiliApiResponse<ChatSession>> {
    const params = new URLSearchParams({
      talker_id: String(talkerId),
      session_type: String(sessionType),
      build: '0',
      mobi_app: 'web',
    });
    return this.client.request(
      `https://api.vc.bilibili.com/session_svr/v1/session_svr/session_detail?${params}`,
    );
  }


  /** 获取会话限制状态（是否被封禁等） */
  async isLimit(uid: number): Promise<BiliApiResponse<SessionLimit>> {
    const params = new URLSearchParams({ uid: String(uid), type: '1' });
    return this.client.request(
      `https://api.vc.bilibili.com/link_setting/v1/link_setting/is_limit?${params}`,
    );
  }


  /** 获取会话免打扰状态 */
  async getDnd(
    ownUid: number,
    uids?: number,
    groupIds?: number,
  ): Promise<BiliApiResponse<{ uid_settings?: DndStatusItem[]; group_settings?: DndStatusItem[] }>> {
    const params = new URLSearchParams({
      own_uid: String(ownUid),
      build: '0',
      mobi_app: 'web',
    });
    if (uids !== undefined) params.set('uids', String(uids));
    if (groupIds !== undefined) params.set('group_ids', String(groupIds));

    return this.client.request(
      `https://api.vc.bilibili.com/link_setting/v1/link_setting/get_msg_dnd?${params}`,
    );
  }


  /** 获取会话推送设置 */
  async getPushSetting(talkerUid: number): Promise<BiliApiResponse<PushSettings>> {
    const params = new URLSearchParams({
      talker_uid: String(talkerUid),
      build: '0',
      mobi_app: 'web',
    });
    return this.client.request(
      `https://api.vc.bilibili.com/link_setting/v1/link_setting/get_session_ss?${params}`,
    );
  }

  /** 将指定消息及之前的消息设为已读 */
  async markRead(
    talkerId: number,
    sessionType: number = 1,
    ackSeqno?: number,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      talker_id: String(talkerId),
      session_type: String(sessionType),
      csrf,
      csrf_token: csrf,
      build: '0',
      mobi_app: 'web',
    });
    if (ackSeqno !== undefined) body.set('ack_seqno', String(ackSeqno));

    return this.client.request(
      'https://api.vc.bilibili.com/session_svr/v1/session_svr/update_ack',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
  }

  /** 移除指定会话（不删除聊天记录） */
  async removeSession(
    talkerId: number,
    sessionType: number = 1,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return this.postWithCsrf(
      'https://api.vc.bilibili.com/session_svr/v1/session_svr/remove_session',
      { talker_id: talkerId, session_type: sessionType },
    );
  }

  /** 修改会话置顶状态 */
  async setTop(
    talkerId: number,
    sessionType: number = 1,
    opType: TopOpType = TopOpType.TOP,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return this.postWithCsrf(
      'https://api.vc.bilibili.com/session_svr/v1/session_svr/set_top',
      { talker_id: talkerId, session_type: sessionType, op_type: opType },
    );
  }

  /** 修改会话免打扰状态 */
  async setDnd(
    ownUid: number,
    setting: DndSetting,
    dndUid?: number,
    dndGroupId?: number,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      setting: String(setting),
      csrf,
      csrf_token: csrf,
      build: '0',
      mobi_app: 'web',
    });
    body.set('uid', String(ownUid));
    if (dndUid !== undefined) body.set('dnd_uid', String(dndUid));
    if (dndGroupId !== undefined) body.set('dnd_group_id', String(dndGroupId));

    return this.client.request(
      'https://api.vc.bilibili.com/link_setting/v1/link_setting/set_msg_dnd',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
  }

  /** 修改会话推送设置 */
  async setPush(
    talkerUid: number,
    setting: PushSetting,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return this.postWithCsrf(
      'https://api.vc.bilibili.com/link_setting/v1/link_setting/set_push_ss',
      { talker_uid: talkerUid, setting },
    );
  }

  /** 修改会话拦截状态 */
  async setIntercept(
    talkerId: number,
    status: InterceptStatus,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    return this.postWithCsrf(
      'https://api.vc.bilibili.com/session_svr/v1/session_svr/update_intercept',
      { talker_id: talkerId, status },
    );
  }

  /** 设置所有拦截会话为已读 */
  async batchMarkDustbinRead(): Promise<BiliApiResponse<Record<string, never>>> {
    return this.postWithCsrf(
      'https://api.vc.bilibili.com/session_svr/v1/session_svr/batch_update_dustbin_ack',
      {},
    );
  }

  /** 移除所有拦截会话 */
  async batchRemoveDustbin(): Promise<BiliApiResponse<Record<string, never>>> {
    return this.postWithCsrf(
      'https://api.vc.bilibili.com/session_svr/v1/session_svr/batch_rm_dustbin',
      {},
    );
  }

  private extractCsrf(): string {
    const cookie = this.client.config.data.cookie;
    const match = cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!match) {
      throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    }
    return match[1];
  }

  private async postWithCsrf(
    url: string,
    extra: Record<string, string | number>,
  ): Promise<BiliApiResponse<Record<string, never>>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(extra).map(([k, v]) => [k, String(v)]),
      ),
      csrf,
      csrf_token: csrf,
      build: '0',
      mobi_app: 'web',
    });

    return this.client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
