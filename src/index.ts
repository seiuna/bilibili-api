// ==========================================
// 统一导出 — @seiuna/bilibili-api
// ==========================================

// ---- Core 层 ----
export { BiliClient, CredentialRefreshError, AuthRequiredError, BiliApiError, assertOk } from './core/client.js';
export type { RequestInit, HasToken } from './core/client.js';
export { ConfigManager } from './core/config.js';
export type { ProfileUser, ProfileFilter, FromProfilesOptions } from './core/config.js';
export { logger, getLogger, configureLogger, setLogger, log4js } from './core/logger.js';
export type { Logger, ILogger, Log4jsConfiguration } from './core/logger.js';
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
  AuthTransport,
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
  UserSubmission,
  UserSubmissionsData,
  UserFollowing,
  UserFollowingsData,
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
  ReplyDialogData,
  ReplyWbiMainData,
  ReplyAddResult,
  ReplyPage,
} from './api/comment.js';
export {
  ReplyType,
  BusinessType,
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
export type {
  DynamicDetail,
  DynamicModule,
  DynamicOpusPicture,
  DynamicSpaceData,
  DynamicFeedItem,
  VoteOptionItem,
  CreateVoteOptions,
  CreateVoteResult,
  DynamicPicture,
  DynamicAtUser,
  DynamicRichTextNode,
  CreateDynamicOptions,
  CreateDynamicResult,
} from './api/dynamic.js';

export { MessageAPI } from './api/message.js';
export type {
  UnreadCount,
  ReplyUser,
  ReplyItemDetail,
  AtItemDetail,
  ReplyNotification,
  AtNotification,
  AtFeedData,
  ReplyFeedData,
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
export type { SearchResult, SearchAllData, HotSearchItem, HotSearchData, DefaultSearchData, SuggestItem } from './api/search.js';

export { HistoryAPI } from './api/history.js';
export type { HistoryItem, HistoryData, ToViewVideo } from './api/history.js';

export { FavoriteAPI } from './api/favorite.js';
export type { FavoriteFolderListItem, FavoriteFolderData, FavoriteMedia, FavoriteListData } from './api/favorite.js';

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

// 一级实体（与资源同名）
export { Video } from './entities/Video.js';
export { User } from './entities/User.js';
export { Article } from './entities/Article.js';
export { Dynamic } from './entities/Dynamic.js';
export { Opus } from './entities/Opus.js';
export { LiveRoom } from './entities/LiveRoom.js';
export { FavoriteFolder } from './entities/FavoriteFolder.js';
export { Comment } from './entities/Comment.js';
export { CommentArea } from './entities/CommentArea.js';
export { NotifyURIHelper, ReplyNotifyItem, AtNotifyItem } from './entities/NotifyItem.js';

// 附属实体（与 raw 类型区分，统一 Entity 后缀）
export { VideoStatEntity } from './entities/VideoStatEntity.js';
export { PlayUrlEntity } from './entities/PlayUrlEntity.js';
export { OnlineCountEntity } from './entities/OnlineCountEntity.js';
export { AiSummaryEntity } from './entities/AiSummaryEntity.js';
export { VideoSnapshotEntity } from './entities/VideoSnapshotEntity.js';
export { PbpEntity } from './entities/PbpEntity.js';
export { VideoTagEntity } from './entities/VideoTagEntity.js';
export { RecommendVideoEntity } from './entities/RecommendVideoEntity.js';

export { MyInfoEntity } from './entities/MyInfoEntity.js';
export { NavInfoEntity } from './entities/NavInfoEntity.js';
export { UserStatEntity } from './entities/UserStatEntity.js';
export { UpStatEntity } from './entities/UpStatEntity.js';
export { NavNumEntity } from './entities/NavNumEntity.js';
export { MedalWallEntity } from './entities/MedalWallEntity.js';
export { MedalWallItemEntity } from './entities/MedalWallItemEntity.js';
export { RelationListEntity } from './entities/RelationListEntity.js';
export { RelationInfoEntity } from './entities/RelationInfoEntity.js';

export { DynamicSpaceEntity } from './entities/DynamicSpaceEntity.js';
export { DynamicFeedItemEntity } from './entities/DynamicFeedItemEntity.js';
export { ArticleViewEntity } from './entities/ArticleViewEntity.js';
export { MutedListEntity } from './entities/MutedListEntity.js';
export type { MutedListData } from './entities/MutedListEntity.js';
export { MutedUserEntity } from './entities/MutedUserEntity.js';
export { FavoriteMediaEntity } from './entities/FavoriteMediaEntity.js';
export { FavoriteMediaPageEntity } from './entities/FavoriteMediaPageEntity.js';
export type { FavoriteMediaPageData } from './entities/FavoriteMediaPageEntity.js';
export { HistoryItemEntity } from './entities/HistoryItemEntity.js';
export { HistoryDataEntity } from './entities/HistoryDataEntity.js';
export { ToViewVideoEntity } from './entities/ToViewVideoEntity.js';
export { ToViewListEntity } from './entities/ToViewListEntity.js';
export type { ToViewListData } from './entities/ToViewListEntity.js';
export { AtFeedEntity } from './entities/AtFeedEntity.js';
export { ReplyFeedEntity } from './entities/ReplyFeedEntity.js';