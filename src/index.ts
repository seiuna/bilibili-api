// Client
export { BiliClient, CredentialRefreshError, AuthRequiredError, BiliApiError, assertOk } from './client.js';

// Config
export { ConfigManager } from './config.js';

// Types
export type {
  BiliConfig,
  BiliApiResponse,
  RequestContext,
  QrcodeGenerateData,
  QrcodePollData,
  TvQrcodeGenerateData,
  TvQrcodePollData,
  AppKeyPair,
} from './types.js';
export { QrcodeStatus, KNOWN_APPKEYS, ANDROID_ALT_KEY } from './types.js';

// QR Code Login
export { loginByWebQrcode, loginByTvQrcode } from './qrcode.js';
export type {
  QrcodeLoginResult,
  QrcodeStatusCallback,
  WebQrcodeLoginOptions,
  TvQrcodeLoginOptions,
} from './qrcode.js';

// Sign
export { signParams, buildSignedQuery } from './sign.js';

// Chain Queries
export { VideoQuery } from './queries/video.js';
export type { VideoInfo } from './queries/video.js';
export { CommentQuery } from './queries/comment.js';
export type { CommentReply, ReplyData } from './queries/comment.js';
export { UserQuery } from './queries/user.js';
export type { UserCard } from './queries/user.js';

// Result wrappers
export { VideoResult, UserResult, CommentResult } from './queries/results.js';

// Notification API
export { NotifyAPI } from './api/notify.js';
export { ReplyFeedItem, AtFeedItem } from './api/notify-results.js';

// Comment API
export { CommentAPI } from './api/comment.js';
export { CommentArea } from './api/comment-area.js';
export type { ReplyPage } from './api/comment-area.js';
export {
  ReplyType,
  ReplySort,
  ReplyMode,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
} from './api/types.js';
export type {
  UnreadCount,
  ReplyUser,
  ReplyAtDetail,
  ReplyItemDetail,
  ReplyNotification,
  ReplyFeedCursor,
  ReplyFeedData,
  AtItemDetail,
  AtNotification,
  AtFeedCursor,
  AtFeedData,
  ReplyMember,
  ReplyContent,
  ReplyEntry,
  ReplyConfig,
  ReplyControl,
  ReplyMainData,
  ReplyCursor,
  ReplyWbiMainData,
  ReplyAddResult,
} from './api/types.js';

export { SpaceAPI } from './api/space.js';
export type {
  TopArc,
  MasterpieceList,
  UserTags,
  SpaceNotice,
  SpaceSettings,
  SpacePrivacy,
  SpaceToutu,
  TopPhotoItem,
  LastPlayGame,
} from './api/space-types.js';

export { UploadAPI } from './api/upload.js';
export type { UploadImageResult } from './api/upload.js';

export { ChatAPI } from './api/chat.js';
export {
  SessionType,
  SessionQueryType,
  SystemMsgType,
  MsgSource,
  MsgStatus,
  DndSetting,
  PushSetting,
  InterceptStatus,
  TopOpType,
} from './api/chat-types.js';
export type {
  SessionLimit,
  DndStatusItem,
  PushSettings,
  SessionAccountInfo,
  ChatMessage,
  ChatSession,
  SingleUnreadData,
  GroupUnreadData,
  SessionListData,
} from './api/chat-types.js';
