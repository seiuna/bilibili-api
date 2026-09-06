// ==========================================
// 统一导出 — @seiuna/bilibili-api
// ==========================================

// ---- Core 层 ----
export { BiliClient, CredentialRefreshError, AuthRequiredError, BiliApiError, assertOk } from './core/client.js';
export type { RequestInit, HasToken } from './core/client.js';
export { ConfigManager } from './core/config.js';
export type { ProfileUser, ProfileFilter, FromProfilesOptions } from './core/config.js';
export { logger, getLogger, configureLogger, log4js } from './core/logger.js';
export type { Logger, Log4jsConfiguration } from './core/logger.js';
export { signParams, buildSignedQuery, wbiSign, buildWbiSignedQuery } from './core/sign.js';
export {
  loginByWebQrcode,
  loginByTvQrcode,
  loginByPassword,
  sendSmsCode,
  loginBySms,
  logout,
} from './core/auth.js';
export type {
  QrcodeLoginResult,
  QrcodeStatusCallback,
  WebQrcodeLoginOptions,
  TvQrcodeLoginOptions,
  PasswordLoginResult,
  SmsLoginResult,
} from './core/auth.js';

// ---- 公共类型 ----
export type {
  BiliConfig,
  BiliApiResponse,
  AppKeyPair,
  QrcodeGenerateData,
  QrcodePollData,
  TvQrcodeGenerateData,
  TvQrcodePollData,
  RequestOptions,
} from './core/types.js';
export { QrcodeStatus, KNOWN_APPKEYS, ANDROID_ALT_KEY, ERROR_CODES } from './core/types.js';

// ---- API 层 ----
export { VideoAPI } from './api/video.js';
export type {
  VideoInfo,
  VideoStat,
  PlayUrlData,
  OnlineCount,
  AiSummary,
  VideoSnapshot,
  PbpData,
  VideoTag,
  RecommendVideo,
} from './api/video.js';

export { UserAPI } from './api/user.js';
export type {
  MyInfo,
  NavInfo,
  UserInfo,
  UserStat,
  UpStat,
  NavNum,
  MedalWallData,
  MedalWallItem,
  RelationInfo,
  RelationListData,
  NameToUidItem,
  LoginNoticeData,
  LoginLogItem,
  LoginLogData,
  MemberAccountInfo,
  RewardStatus,
} from './api/user.js';

export { CommentAPI } from './api/comment.js';
export type {
  ReplyEntry,
  ReplyMember,
  ReplyContent,
  ReplyMainData,
  ReplyWbiMainData,
  ReplyAddResult,
  ReplyPage,
} from './api/comment.js';
export {
  ReplyType,
  ReplySort,
  ReplyMode,
  ReplyAction,
  ReplyHateAction,
  ReplyTopAction,
  ReplyReportReason,
} from './api/comment.js';

export { ArticleAPI } from './api/article.js';
export type { ArticleInfo, ArticleView, ArticleCollection } from './api/article.js';

export { DynamicAPI } from './api/dynamic.js';
export type { DynamicDetail, DynamicSpaceData, DynamicFeedItem } from './api/dynamic.js';

export { MessageAPI } from './api/message.js';
export type {
  UnreadCount,
  ReplyNotification,
  AtNotification,
  ChatSession,
  ChatMessage,
  SessionListData,
  SingleUnreadData,
  MessageSettings,
} from './api/message.js';
export {
  SessionType,
  SessionQueryType,
  DndSetting,
  PushSetting,
  InterceptStatus,
  TopOpType,
} from './api/message.js';

export { SearchAPI } from './api/search.js';
export type { SearchAllData, HotSearchData, DefaultSearchData, SuggestItem } from './api/search.js';

export { HistoryAPI } from './api/history.js';
export type { HistoryItem, HistoryData, ToViewVideo } from './api/history.js';

export { FavoriteAPI } from './api/favorite.js';
export type { FavoriteFolder as FavoriteFolderData, FavoriteMedia, FavoriteListData } from './api/favorite.js';

export { DanmakuAPI } from './api/danmaku.js';
export type { DanmakuConfig } from './api/danmaku.js';

export { EmojiAPI } from './api/emoji.js';
export type { EmoteItem, EmotePackage } from './api/emoji.js';

export { NoteAPI } from './api/note.js';
export type { NoteInfo, NoteListItem } from './api/note.js';

export { ElectricAPI } from './api/electric.js';
export type { ChargeListItem, ChargeListData, ChargeShowData, ChargeRemarkItem } from './api/electric.js';

export { RankingAPI } from './api/ranking.js';
export type { RankingData, PreciousVideosData } from './api/ranking.js';

export { LiveAPI } from './api/live.js';
export type { LiveRoomInfo, MutedUserItem } from './api/live.js';

export { OpusAPI } from './api/opus.js';
export type { OpusDetail, OpusSpaceItem, OpusSpaceData } from './api/opus.js';

export { UploadAPI } from './api/upload.js';
export type { UploadImageResult } from './api/upload.js';

export { CommonAPI } from './api/common.js';
export type { IpLocationInfo } from './api/common.js';
export { getCurrentTimestamp, av2bv, bv2av, formatImageUrl, getImageAvgColor, getIpLocation, getServerTimestamp } from './api/common.js';

// ---- Entity 层 ----
export { BaseEntity } from './entities/BaseEntity.js';
export { Video } from './entities/Video.js';
export { User } from './entities/User.js';
export { Article } from './entities/Article.js';
export { Dynamic } from './entities/Dynamic.js';
export { CommentArea } from './entities/CommentArea.js';
export { Comment } from './entities/Comment.js';
export { LiveRoom } from './entities/LiveRoom.js';
export { FavoriteFolder } from './entities/FavoriteFolder.js';
export { Opus } from './entities/Opus.js';
export { ReplyNotifyItem, AtNotifyItem } from './entities/NotifyItem.js';