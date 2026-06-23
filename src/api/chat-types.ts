/** 会话类型 */
export enum SessionType {
  USER = 1,
  GROUP = 2,
}

/** 获取会话列表的查询类型 */
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

/** 系统会话类型 */
export enum SystemMsgType {
  NONE = 0,
  /** 主播小助手 */
  LIVE_HELPER = 1,
  /** 系统通知 */
  SYSTEM_NOTICE = 5,
  /** UP主小助手 */
  UP_HELPER = 7,
  /** 客服消息 */
  CUSTOMER_SERVICE = 8,
  /** 支付小助手 */
  PAYMENT_HELPER = 9,
}

/** 消息来源 */
export enum MsgSource {
  UNKNOWN = 0,
  IOS = 1,
  ANDROID = 2,
  H5 = 3,
  PC = 4,
  OFFICIAL_PUSH = 5,
  NOTIFY_PUSH = 6,
  WEB = 7,
  AUTO_REPLY_FOLLOW = 8,
  AUTO_REPLY_RECEIVE = 9,
  AUTO_REPLY_KEYWORD = 10,
  AUTO_REPLY_SAILING = 11,
  AUTO_PUSH_UP_GIFT = 12,
  GROUP_SYSTEM = 13,
  SYSTEM = 16,
  MUTUAL_FOLLOW = 17,
  SYSTEM_TIP = 18,
  AI = 19,
}

/** 消息状态 */
export enum MsgStatus {
  NORMAL = 0,
  RECALLED = 1,
  SYSTEM_RECALLED = 2,
  IMAGE_EXPIRED = 50,
}

/** 会话免打扰设置 */
export enum DndSetting {
  OFF = 0,
  ON = 1,
}

/** 推送设置 */
export enum PushSetting {
  RECEIVE = 0,
  BLOCK = 1,
}

/** 拦截状态 */
export enum InterceptStatus {
  OFF = 0,
  ON = 1,
}

/** 置顶操作 */
export enum TopOpType {
  TOP = 0,
  UNTOP = 1,
}

/** 会话限制状态 */
export interface SessionLimit {
  is_limit: number;
  report_limit: number;
}

/** 免打扰状态项 */
export interface DndStatusItem {
  id: number;
  setting: number;
}

/** 推送设置详情 */
export interface PushSettings {
  follow_status: number;
  special: number;
  push_setting: number;
  show_push_setting: number;
}

/** 会话 account_info */
export interface SessionAccountInfo {
  name: string;
  pic_url: string;
}


/** 私信主体对象（last_msg） */
export interface ChatMessage {
  sender_uid: number;
  receiver_type: number;
  receiver_id: number;
  msg_type: number;
  /** JSON 序列化后的消息内容字符串 */
  content: string;
  msg_seqno: number;
  /** 秒级时间戳 */
  timestamp: number;
  at_uids: number[] | null;
  msg_key: number;
  msg_status: MsgStatus;
  /** 是否为系统撤回 */
  sys_cancel?: boolean;
  notify_code: string;
  new_face_version: number;
  msg_source: MsgSource;
}

export interface ChatSession {
  talker_id: number;
  session_type: SessionType;
  at_seqno: number;
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
  system_msg_type: SystemMsgType;
  account_info?: SessionAccountInfo;
  live_status: number;
  biz_msg_unread_count: number;
  user_label: null;
}

// ---- 未读私信数 ----

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

export interface GroupUnreadData {
  unread_count: number;
}


export interface SessionListData {
  session_list: ChatSession[] | null;
  has_more: number;
  anti_disturb_cleaning: boolean;
  is_address_list_empty: number;
  system_msg?: Record<string, number>;
  show_level: boolean;
}
