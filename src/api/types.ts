// ==========================================
// 消息通知 & 评论区 API 类型定义
// ==========================================

// ---- 评论区类型代码 ----
export enum ReplyType {
  VIDEO = 1,
  /** 动态 */
  DYNAMIC = 11,
  /** 专栏 */
  ARTICLE = 12,
  /** 音频 */
  AUDIO = 14,
  /** 相簿 */
  ALBUM = 16,
}

// ---- 评论排序 ----
export enum ReplySort {
  TIME = 0,
  LIKE = 1,
  REPLY_COUNT = 2,
}

/** 懒加载排序 */
export enum ReplyMode {
  HEAT = 2,   // 仅按时间
  TIME = 3,   // 仅按热度
  BOTH = 4,   // 热度+时间
}

// ---- 评论操作 ----
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

/** 举报类型 */
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

// ---- 未读消息数 ----
export interface UnreadCount {
  /** 未读 at 数（旧） */
  at: number;
  chat: number;
  /** 未读投币数 */
  coin: number;
  /** 未读弹幕数 */
  danmu: number;
  /** 未读收藏数 */
  favorite: number;
  /** 未读点赞数（旧） */
  like: number;
  /** 未读收到喜欢数（新） */
  recv_like: number;
  /** 未读回复与@数（新） */
  recv_reply: number;
  /** 未读回复数（旧） */
  reply: number;
  /** 未读系统通知数 */
  sys_msg: number;
  sys_msg_style: number;
  /** 未读UP主助手信息数 */
  up: number;
}

// ---- "回复我的" 通知 ----
export interface ReplyUser {
  mid: number;
  fans: number;
  nickname: string;
  avatar: string;
  mid_link: string;
  follow: boolean;
}

export interface ReplyAtDetail {
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
  at_details: ReplyAtDetail[];
  topic_details: unknown[];
  hide_reply_button: boolean;
  hide_like_button: boolean;
  like_state: number;
  danmu: null;
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

export interface ReplyFeedCursor {
  is_end: boolean;
  id: number;
  time: number;
}

export interface ReplyFeedData {
  cursor: ReplyFeedCursor;
  items: ReplyNotification[];
  last_view_at: number;
}

// ---- "@我的" 通知 ----

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
  at_details: ReplyAtDetail[];
  topic_details: unknown[];
  hide_reply_button: boolean;
}

export interface AtNotification {
  id: number;
  user: ReplyUser;
  item: AtItemDetail;
  at_time: number;
}

export interface AtFeedCursor {
  is_end: boolean;
  id: number;
  time: number;
}

export interface AtFeedData {
  cursor: AtFeedCursor;
  items: AtNotification[];
}

/** 评论用户（精简版） */
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

/** 评论内容 */
export interface ReplyContent {
  message: string;
  emote?: Record<string, { id: number; text: string; url: string }>;
  jump_url?: Record<string, unknown>;
  max_line?: number;
}

/** 单条评论 */
export interface ReplyEntry {
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
  member: ReplyMember;
  content: ReplyContent;
  replies: ReplyEntry[] | null;
  action: number;
  state: number;
  assist: number;
  /** UP 主点赞 */
  up_action: { like: boolean; reply: boolean };
  invisible: boolean;
  card_label?: { rpid: number; text_content: string }[];
  reply_control: {
    time_desc: string;
    location: string;
    sub_reply_entry_text: string;
  };
  folder: { has_folded: boolean; is_folded: boolean; rule: string };
  dynamic_id_str?: string;
}

/** 评论区配置 */
export interface ReplyConfig {
  showadmin: number;
  showentry: number;
  showfloor: number;
  showtopic: number;
  show_up_flag: boolean;
  read_only: boolean;
  show_del_log: boolean;
}

/** 评论区控制 */
export interface ReplyControl {
  input_disable: boolean;
  root_input_text: string;
  child_input_text: string;
  bg_text: string;
  web_selection: boolean;
  answer_guide_text: string;
  answer_guide_icon_url: string;
  answer_guide_ios_url: string;
  answer_guide_android_url: string;
}

/** 翻页加载 data */
export interface ReplyMainData {
  page: { num: number; size: number; count: number; acount: number };
  config: ReplyConfig;
  replies: ReplyEntry[] | null;
  hots: ReplyEntry[] | null;
  upper: { mid: number; top: ReplyEntry | null } | null;
  top: null;
  notice: { content: string; id: number; link: string; title: string } | null;
  control: ReplyControl;
  folder: { has_folded: boolean; is_folded: boolean; rule: string };
  show_bvid: boolean;
}

/** 懒加载 cursor */
export interface ReplyCursor {
  all_count: number;
  is_begin: boolean;
  prev: number;
  next: number;
  is_end: boolean;
  mode: number;
  support_mode: number[];
  name: string;
  pagination_reply: {
    next_offset: string;
    prev_offset: string;
  };
  session_id: string;
}

/** 懒加载 data */
export interface ReplyWbiMainData {
  cursor: ReplyCursor;
  replies: ReplyEntry[] | null;
  hots: ReplyEntry[] | null;
  top: { admin: ReplyEntry | null; upper: ReplyEntry | null; vote: ReplyEntry | null };
  top_replies: ReplyEntry[];
  notice: { content: string; id: number; link: string; title: string } | null;
  config: ReplyConfig;
  control: ReplyControl;
  folder: { has_folded: boolean; is_folded: boolean; rule: string };
  upper: { mid: number };
  show_bvid: boolean;
}

/** 发表评论返回 */
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
