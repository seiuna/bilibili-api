import { ConfigManager } from './config.js';
import { wbiSign } from './sign.js';
import {
  loginByWebQrcode,
  loginByTvQrcode,
  loginByPassword,
  logout,
} from './auth.js';
import type {
  QrcodeLoginResult,
  WebQrcodeLoginOptions,
  TvQrcodeLoginOptions,
  PasswordLoginResult,
} from './auth.js';
import type { BiliApiResponse, BiliConfig } from './types.js';

// API 层导入
import { VideoAPI } from '../api/video.js';
import { UserAPI } from '../api/user.js';
import { ArticleAPI } from '../api/article.js';
import { DynamicAPI } from '../api/dynamic.js';
import { CommentAPI } from '../api/comment.js';
import { MessageAPI } from '../api/message.js';
import { SearchAPI } from '../api/search.js';
import { HistoryAPI } from '../api/history.js';
import { FavoriteAPI } from '../api/favorite.js';
import { DanmakuAPI } from '../api/danmaku.js';
import { EmojiAPI } from '../api/emoji.js';
import { NoteAPI } from '../api/note.js';
import { ElectricAPI } from '../api/electric.js';
import { RankingAPI } from '../api/ranking.js';
import { LiveAPI } from '../api/live.js';
import { UploadAPI } from '../api/upload.js';
import { OpusAPI } from '../api/opus.js';

// Entity 层导入
import { Video } from '../entities/Video.js';
import { User } from '../entities/User.js';
import { Article } from '../entities/Article.js';
import { Dynamic } from '../entities/Dynamic.js';
import { LiveRoom } from '../entities/LiveRoom.js';
import { FavoriteFolder } from '../entities/FavoriteFolder.js';
import { Opus } from '../entities/Opus.js';
import { Comment } from '../entities/Comment.js';
import { MyInfoEntity } from '../entities/MyInfoEntity.js';
import { NavInfoEntity } from '../entities/NavInfoEntity.js';
import { HistoryDataEntity } from '../entities/HistoryDataEntity.js';
import { HistoryItemEntity } from '../entities/HistoryItemEntity.js';
import { ToViewListEntity } from '../entities/ToViewListEntity.js';
import { AtFeedEntity } from '../entities/AtFeedEntity.js';
import { ReplyFeedEntity } from '../entities/ReplyFeedEntity.js';
import { AtNotifyItem, ReplyNotifyItem } from '../entities/NotifyItem.js';

// ==========================================
// 认证状态标记类型
// ==========================================

/** 已认证状态标记 */
export interface HasToken {
  readonly __authenticated: true;
}

/** 条件类型辅助：仅当 T 为 HasToken 时允许访问，否则返回 never */
type RequireAuth<T> = T extends HasToken ? unknown : never;

// ==========================================
// BiliClient — 纯粹的网络/鉴权客户端
// 泛型 T 用于在编译期区分已认证 / 未认证状态
// T = void  → 未认证（匿名）
// T = HasToken → 已认证
// ==========================================

/** 凭证刷新失败错误 */
export class CredentialRefreshError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'CredentialRefreshError';
  }
}

/** 请求被拦截（需要重新登录） */
export class AuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/** Bilibili API 业务错误 */
export class BiliApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'BiliApiError';
  }
}

/** 检查响应 code，非 0 时抛出 BiliApiError，否则返回原数据 */
export function assertOk<T extends { code: number; message: string }>(data: T): T {
  if (data.code !== 0) throw new BiliApiError(data.message, data.code);
  return data;
}

/** 请求选项 */
export interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** 是否需要 WBI 签名 */
  wbi?: boolean;
  /** 是否自动检查 code（非 0 抛异常） */
  checked?: boolean;
  /**
   * 是否匿名请求（禁止附带 Cookie/Authorization 凭证，且不合并响应中的 Set-Cookie 到本地配置）
   * 对非 B 站域名的外部下载/请求默认自动启用匿名模式，防止向第三方凭据泄露或配置被污染
   */
  anonymous?: boolean;
}

function isBilibiliHost(urlStr: string): boolean {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    return (
      hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com') ||
      hostname === 'hdslb.com' || hostname.endsWith('.hdslb.com') ||
      hostname === 'bilibili.tv' || hostname.endsWith('.bilibili.tv') ||
      hostname === 'biliapi.net' || hostname.endsWith('.biliapi.net') ||
      hostname === 'biliapi.com' || hostname.endsWith('.biliapi.com') ||
      hostname === 'acg.tv' || hostname.endsWith('.acg.tv')
    );
  } catch {
    return false;
  }
}

export class BiliClient<T = void> {
  public config: ConfigManager;

  /** 防止并发的凭证刷新 */
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  private customFetch: typeof fetch | null;

  /** Internal transport for APIs that need raw Response access. */
  async rawRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const fetcher = this.customFetch ?? fetch;
    return this.doRequest(fetcher, url, options);
  }

  /** 获取当前登录用户 ID（若未登录或未识别则返回 null） */
  get userId(): string | null {
    return this.config.extractUserId();
  }

  constructor(configPathOrUserId?: string | number, customFetch?: typeof fetch) {
    this.config = new ConfigManager(configPathOrUserId);
    this.customFetch = customFetch ?? null;
  }

  /** 创建并加载客户端（未认证状态） */
  static async create(
    configPathOrUserId?: string | number,
    customFetch?: typeof fetch,
  ): Promise<BiliClient<void>> {
    const client = new BiliClient<void>(configPathOrUserId, customFetch);
    await client.config.load();
    return client;
  }

  /**
   * 从 profiles 目录下批量创建客户端列表（函数式接口）
   * @param predicate 过滤谓词函数
   * @param options 批量创建选项
   */
  static async fromProfiles(
    predicate?: import('./config.js').ProfileFilter,
    options?: import('./config.js').FromProfilesOptions,
  ): Promise<BiliClient<any>[]> {
    return ConfigManager.fromProfiles<BiliClient<any>>(predicate, options);
  }

  // ==========================================
  // 鉴权与登录
  // ==========================================

  /** 检查登录状态 */
  async isLoggedIn(): Promise<{ loggedIn: boolean; mid?: number }> {
    if (!this.config.data.cookie) return { loggedIn: false };
    const data = await this.request<{
      code: number;
      message?: string;
      data: { mid: number; isLogin: boolean; wbi_img?: { img_url: string; sub_url: string } };
    }>('https://api.bilibili.com/x/web-interface/nav');
    if (data.code === -101) return { loggedIn: false };
    if (data.code !== 0) throw new BiliApiError(data.message ?? '登录状态检查失败', data.code);
    if (typeof data.data?.isLogin !== 'boolean') throw new Error('登录状态响应缺少 isLogin');
    if (data.data.wbi_img) {
      const imgKey = data.data.wbi_img.img_url.split('/').pop()?.split('.')[0] ?? '';
      const subKey = data.data.wbi_img.sub_url.split('/').pop()?.split('.')[0] ?? '';
      if (imgKey && subKey) await this.config.updateWbiKeys(imgKey, subKey);
    }
    return { loggedIn: data.data.isLogin, mid: data.data.mid };
  }

  /**
   * 自动登录：cookie → refresh → 扫码
   * 成功后返回已认证类型的客户端
   */
  async ensureLogin(
    qrcodeOptions?: WebQrcodeLoginOptions,
  ): Promise<BiliClient<HasToken>> {
    let status: { loggedIn: boolean; mid?: number };
    let refreshRejected = false;
    try {
      status = await this.isLoggedIn();
    } catch (error) {
      if (!(error instanceof CredentialRefreshError) || error.code !== -101) throw error;
      status = { loggedIn: false };
      refreshRejected = true;
    }
    const { loggedIn, mid } = status;
    if (loggedIn) {
      if (mid) await this.config.updateMid(mid);
    } else if (this.config.data.refreshToken && !refreshRejected) {
      try {
        const fetcher = this.customFetch ?? fetch;
        await this.performRefresh(fetcher);
        const recheck = await this.isLoggedIn();
        if (!recheck.loggedIn) {
          const result = await loginByWebQrcode(this.config, qrcodeOptions, this.customFetch ?? fetch);
          if (!result.success) throw new AuthRequiredError(result.message);
        }
      } catch (error) {
        if (!(error instanceof CredentialRefreshError) || error.code !== -101) throw error;
        const result = await loginByWebQrcode(this.config, qrcodeOptions, this.customFetch ?? fetch);
        if (!result.success) throw new AuthRequiredError(result.message);
      }
    } else {
      const result = await loginByWebQrcode(this.config, qrcodeOptions, this.customFetch ?? fetch);
      if (!result.success) throw new AuthRequiredError(result.message);
    }
    await this.ensureProfileCreated();
    return this as unknown as BiliClient<HasToken>;
  }

  /** Web 端二维码登录 — 成功后返回已认证客户端 */
  async loginByQrcode(
    options?: WebQrcodeLoginOptions,
  ): Promise<BiliClient<HasToken>> {
    const result = await loginByWebQrcode(this.config, options, this.customFetch ?? fetch);
    if (!result.success) throw new AuthRequiredError(result.message);
    await this.ensureProfileCreated();
    return this as unknown as BiliClient<HasToken>;
  }

  /** TV 端二维码登录 — 成功后返回已认证客户端 */
  async loginByTvQrcode(
    options?: TvQrcodeLoginOptions,
  ): Promise<BiliClient<HasToken>> {
    const result = await loginByTvQrcode(this.config, options, this.customFetch ?? fetch);
    if (!result.success) throw new AuthRequiredError(result.message);
    await this.ensureProfileCreated();
    return this as unknown as BiliClient<HasToken>;
  }

  /** 密码登录 — 成功后返回已认证客户端 */
  async loginByPassword(
    username: string,
    password: string,
    options?: {
      keep?: boolean;
      captcha?: { token?: string; challenge: string; validate: string; seccode: string };
    },
  ): Promise<BiliClient<HasToken>> {
    const result = await loginByPassword(this.config, username, password, options, this.customFetch ?? fetch);
    if (!result.success) throw new AuthRequiredError(result.message);
    await this.ensureProfileCreated();
    return this as unknown as BiliClient<HasToken>;
  }

  private async ensureProfileCreated(): Promise<void> {
    const userId = this.config.extractUserId();
    if (userId) {
      await this.config.createProfileForUser(userId);
    }
  }

  /** 退出登录 — 返回未认证客户端 */
  async logout(): Promise<BiliClient<void>> {
    assertOk(await logout(this.config, this.customFetch ?? fetch));
    return this as unknown as BiliClient<void>;
  }

  // ==========================================
  // 统一请求
  // ==========================================

  /**
   * 基础请求（自动注入 Cookie、自动刷新凭证）
   * 不检查 code，返回原始 JSON
   */
  async request<TData = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<TData> {
    const fetcher = this.customFetch ?? fetch;

    const finalUrl = options.wbi ? await this.injectWbiSign(url, options.anonymous ?? !isBilibiliHost(url)) : url;
    const res = await this.doRequest(fetcher, finalUrl, options);
    const data = (await this.readJson(res)) as TData & { code?: number };

    if (data?.code === -101 && isBilibiliHost(finalUrl) && options.anonymous !== true && this.config.data.refreshToken) {
      return this.handleCredentialRefresh(fetcher, finalUrl, options);
    }

    return data;
  }

  /**
   * 请求 + 自动检查 code（非 0 抛 BiliApiError）
   */
  async checkedRequest<TData extends { code?: number; message?: string }>(
    url: string,
    options: RequestInit = {},
  ): Promise<TData> {
    const data = await this.request<TData>(url, options);
    if (data.code !== 0) {
      throw new BiliApiError(data.message ?? '未知错误', data.code ?? -1);
    }
    return data;
  }

  // ==========================================
  // 内部方法
  // ==========================================

  private async injectWbiSign(url: string, anonymous: boolean): Promise<string> {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    let wbiKeys = this.config.getWbiKeys();
    if (!wbiKeys) {
      const navData = await this.request<{
        code: number;
        data: { wbi_img: { img_url: string; sub_url: string } };
      }>('https://api.bilibili.com/x/web-interface/nav', { anonymous });

      if (navData.code === 0 && navData.data?.wbi_img) {
        const imgKey = navData.data.wbi_img.img_url.split('/').pop()?.split('.')[0] ?? '';
        const subKey = navData.data.wbi_img.sub_url.split('/').pop()?.split('.')[0] ?? '';
        if (imgKey && subKey) {
          await this.config.updateWbiKeys(imgKey, subKey);
          wbiKeys = this.config.getWbiKeys();
        }
      }
    }

    if (!wbiKeys) return url;

    const signed = wbiSign(params, wbiKeys.imgKey, wbiKeys.subKey);
    urlObj.search = signed.toString();
    return urlObj.toString();
  }

  private async doRequest(
    fetcher: typeof fetch,
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const isAnonymous = options.anonymous ?? (!isBilibiliHost(url));
    const headers = new Headers(options.headers);
    if (!headers.has('User-Agent')) {
      headers.set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
    }
    if (!headers.has('Referer')) {
      // headers.set('Referer', 'https://www.bilibili.com');
    }
    if (isAnonymous) {
      headers.delete('Cookie');
      headers.delete('Authorization');
    } else {
      if (this.config.data.cookie) {
        headers.set('Cookie', this.config.data.cookie);
      }
      if (this.config.data.accessToken) {
        headers.set('Authorization', `Bearer ${this.config.data.accessToken}`);
      }
    }

    const res = await fetcher(url, {
      method: options.method ?? 'GET',
      headers: headers as any,
      body: options.body as BodyInit | undefined,
    });

    if (!isAnonymous) {
      const setCookies = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ?? '');
      if (Array.isArray(setCookies) ? setCookies.length > 0 : Boolean(setCookies)) {
        await this.config.mergeCookie(setCookies);
      }
    }

    return res;
  }

  private async handleCredentialRefresh(
    fetcher: typeof fetch,
    url: string,
    options: RequestInit,
  ): Promise<any> {
    if (this.isRefreshing) {
      if (this.refreshPromise) await this.refreshPromise;
      this.assertRefreshReplaySafe(options);
      const retryRes = await this.doRequest(fetcher, url, options);
      const retryData = await this.readJson(retryRes);
      if (retryData.code === -101) {
        throw new AuthRequiredError('凭证刷新后重试仍返回 -101，需重新登录');
      }
      return retryData;
    }

    this.isRefreshing = true;

    try {
      this.refreshPromise = this.performRefresh(fetcher);
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }

    this.assertRefreshReplaySafe(options);
    const retryRes = await this.doRequest(fetcher, url, options);
    const retryData = await this.readJson(retryRes);

    if (retryData.code === -101) {
      throw new AuthRequiredError('凭证刷新后重试仍返回 -101，可能账号被风控，请重新登录');
    }

    return retryData;
  }

  private assertRefreshReplaySafe(options: RequestInit): void {
    const method = (options.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      throw new AuthRequiredError('凭证已刷新，但未自动重放非 GET/HEAD 请求；请重新构造请求（包括 CSRF）后显式重试');
    }
  }

  private async readJson(res: Response): Promise<any> {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
    return res.json();
  }

  private async performRefresh(fetcher: typeof fetch): Promise<void> {
    const refreshToken = this.config.data.refreshToken;

    if (!refreshToken) {
      throw new CredentialRefreshError('缺少 refresh_token，无法自动刷新');
    }

    const res = await fetcher(
      'https://passport.bilibili.com/x/passport-login/web/cookie/refresh',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    const data = await this.readJson(res);

    if (data.code !== 0) {
      throw new CredentialRefreshError(`Token 刷新被拒绝: ${data.message}`, data.code);
    }

    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ?? '');
    // Stage the rotated token before mergeCookie's save: never persist new cookies
    // paired with the old token. This is one save, not a filesystem transaction.
    if (data.data?.refresh_token) this.config.data.refreshToken = data.data.refresh_token;
    if (Array.isArray(setCookies) ? setCookies.length > 0 : Boolean(setCookies)) {
      await this.config.mergeCookie(setCookies);
    } else if (data.data?.refresh_token) {
      await this.config.save();
    }
  }

  // ==========================================
  // 门面方法 (Facade) — 公开（无需登录）
  // ==========================================

  /** 获取视频实体 */
  async getVideo(bvid: string): Promise<Video> {
    const rawData = await VideoAPI.getInfo(this, bvid);
    return new Video(this, assertOk(rawData).data);
  }

  /** 通过 aid 获取视频实体 */
  async getVideoByAid(aid: number): Promise<Video> {
    const rawData = await VideoAPI.getInfoByAid(this, aid);
    return new Video(this, assertOk(rawData).data);
  }

  /** 获取用户实体 */
  async getUser(mid: number): Promise<User> {
    const rawData = await UserAPI.getInfo(this, mid);
    return new User(this, assertOk(rawData).data);
  }

  /** 获取专栏实体 */
  async getArticle(cvid: number): Promise<Article> {
    const rawData = await ArticleAPI.getInfo(this, cvid);
    assertOk(rawData);
    return new Article(this, rawData.data, cvid);
  }

  /** 获取动态实体 */
  async getDynamic(id: string): Promise<Dynamic> {
    const rawData = await DynamicAPI.getDetail(this, id);
    return new Dynamic(this, assertOk(rawData).data.item);
  }

  /** 获取直播间实体 */
  async getLiveRoom(roomId: number): Promise<LiveRoom> {
    const rawData = await LiveAPI.getRoomInfo(this, roomId);
    return new LiveRoom(this, assertOk(rawData).data);
  }

  /** 获取收藏夹实体（公开收藏夹无需登录） */
  async getFavoriteFolder(mediaId: number): Promise<FavoriteFolder> {
    const rawData = await FavoriteAPI.getFolderInfo(this, mediaId);
    return new FavoriteFolder(this, assertOk(rawData).data);
  }

  /** 获取图文实体 */
  async getOpus(id: number | string): Promise<Opus> {
    const rawData = await OpusAPI.getDetail(this, id);
    return new Opus(this, assertOk(rawData).data.item);
  }

  /**
   * 获取单条评论实体
   * @param oid 评论区主体 ID (如视频 avid、相簿 id)
   * @param replyType 评论区业务类型代码 (1: 视频, 11: 动态/相簿, 12: 专栏, ...)
   * @param rpid 评论 ID
   */
  async getComment(
    oid: number | string,
    replyType: number,
    rpid: number | string,
  ): Promise<Comment> {
    const res = await CommentAPI.getReply(this, oid, replyType, rpid);
    assertOk(res);
    if (!res.data) {
      throw new BiliApiError(`评论 ${rpid} 不存在或未找到`, res.code || -404);
    }
    return new Comment(this, res.data, oid);
  }

  /**
   * @deprecated 这个可以用 但是不要用这个!
   * 
   * 
   * 根据评论 rpid 自动探测并获取评论实体
   * 若未提供 oid 和 replyType，会自动从候选评论区及账号最近通知中反查定位
   */
  async resolveComment(
    rpid: number | string,
    hint?: { oid?: number | string; replyType?: number },
  ): Promise<Comment> {
    if (hint?.oid !== undefined && hint?.replyType !== undefined) {
      return this.getComment(hint.oid, hint.replyType, rpid);
    }
    const resolved = await CommentAPI.resolveReply(
      this,
      rpid,
      hint?.oid && hint?.replyType ? [{ oid: hint.oid, replyType: hint.replyType }] : undefined,
    );
    if (!resolved) {
      throw new BiliApiError(`无法自动定位评论 ${rpid} 的上游评论区`, -404);
    }
    return new Comment(this, resolved.reply, resolved.oid);
  }

  // ==========================================
  // 门面方法 (Facade) — 需要认证（HasToken）
  // ==========================================

  /** 获取当前登录用户空间详细信息 — 需要登录 */
  async getMyInfo(
    this: RequireAuth<T> extends never ? never : this,
  ): Promise<MyInfoEntity> {
    const res = await UserAPI.getMyInfo(this);
    return new MyInfoEntity(this, assertOk(res).data);
  }

  /** 获取登录基本信息（导航栏用户信息） — 需要登录 */
  async getNavInfo(
    this: RequireAuth<T> extends never ? never : this,
  ): Promise<NavInfoEntity> {
    const res = await UserAPI.getNavInfo(this);
    return new NavInfoEntity(this, assertOk(res).data);
  }

  /**
   * 获取当前登录用户的 User 实体 — 需要登录
   * 
   * 💡 **选型与网络开销建议**：
   * - 若仅用于展示当前登录用户自身的基础属性（UID、昵称、等级、硬币、大会员等），推荐优先使用单次请求的 {@link getMyInfo}；
   * - 若需要执行实体业务操作（如关注 `follow()`、拉黑 `block()`、获取状态数 `getStat()` 等），建议选用本方法；
   * - 本方法优先利用本地缓存的 mid / Cookie DedeUserID 调用 `getUser(mid)`；若本地完全未识别 mid 则会额外请求一次 `getMyInfo()`。
   */
  async getCurrentUser(
    this: RequireAuth<T> extends never ? never : this,
  ): Promise<User> {
    const self = this as BiliClient<HasToken>;
    let mid = self.config.data.mid;
    if (!mid) {
      const extracted = self.config.extractUserId();
      if (extracted) {
        mid = Number(extracted);
      }
    }
    if (!mid) {
      const myInfo = await self.getMyInfo();
      mid = myInfo.mid;
    }
    return self.getUser(mid);
  }

  /** 获取历史记录 — 需要登录 (async generator 翻页，逐项返回实体) */
  async *getHistory(
    this: RequireAuth<T> extends never ? never : this,
    ps = 20,
    type: 'all' | 'archive' | 'live' | 'article' = 'all',
  ): AsyncGenerator<HistoryItemEntity> {
    const client = this as BiliClient<any>;
    for await (const item of HistoryAPI.history(client, ps, type)) {
      yield new HistoryItemEntity(client, item);
    }
  }

  /** 获取单页历史记录 — 需要登录（游标分页） */
  async getHistoryPage(
    this: RequireAuth<T> extends never ? never : this,
    ps = 20,
    type: 'all' | 'archive' | 'live' | 'article' = 'all',
    max?: number,
    viewAt?: number,
    business?: string,
  ): Promise<HistoryDataEntity> {
    const res = await HistoryAPI.getHistory(this, ps, type, max, viewAt, business);
    return new HistoryDataEntity(this, assertOk(res).data);
  }

  /** 获取稍后再看列表 — 需要登录 */
  async getToViewList(
    this: RequireAuth<T> extends never ? never : this,
  ): Promise<ToViewListEntity> {
    const res = await HistoryAPI.getToViewList(this);
    return new ToViewListEntity(this, assertOk(res).data);
  }

  // ------------------------------------------
  // 通知（@我的 / 回复我的）门面 — 需要登录
  // ------------------------------------------

  /** 获取单页 "@我的" 通知 — 需要登录 */
  async getAtFeedPage(
    this: RequireAuth<T> extends never ? never : this,
    cursorId?: number,
    cursorTime?: number,
  ): Promise<AtFeedEntity> {
    const res = await MessageAPI.getAtFeed(this as BiliClient<any>, cursorId, cursorTime);
    return new AtFeedEntity(this, assertOk(res).data);
  }

  /** 获取单页 "回复我的" 通知 — 需要登录 */
  async getReplyFeedPage(
    this: RequireAuth<T> extends never ? never : this,
    cursorId?: number,
    cursorTime?: number,
  ): Promise<ReplyFeedEntity> {
    const res = await MessageAPI.getReplyFeed(this as BiliClient<any>, cursorId, cursorTime);
    return new ReplyFeedEntity(this, assertOk(res).data);
  }

  /** "@我的" 通知翻页 — 需要登录，逐项返回 AtNotifyItem 实体 */
  async *atFeed(
    this: RequireAuth<T> extends never ? never : this,
  ): AsyncGenerator<AtNotifyItem> {
    const client = this as BiliClient<any>;
    for await (const item of MessageAPI.atFeed(client)) {
      yield new AtNotifyItem(client, item);
    }
  }

  /** "回复我的" 通知翻页 — 需要登录，逐项返回 ReplyNotifyItem 实体 */
  async *replyFeed(
    this: RequireAuth<T> extends never ? never : this,
  ): AsyncGenerator<ReplyNotifyItem> {
    const client = this as BiliClient<any>;
    for await (const item of MessageAPI.replyFeed(client)) {
      yield new ReplyNotifyItem(client, item);
    }
  }

  /**
   * 发布动态 — 需要登录
   * 支持纯文本、富文本、@ 用户、图片（自动上传本地文件/二进制数据）、发起投票
   */
  async createDynamic(
    this: RequireAuth<T> extends never ? never : this,
    contentOrOptions: string | import('../api/dynamic.js').CreateDynamicOptions,
  ): Promise<BiliApiResponse<import('../api/dynamic.js').CreateDynamicResult>> {
    return DynamicAPI.create(this, contentOrOptions);
  }

  /**
   * 发布动态并返回 Dynamic 实体 — 需要登录
   */
  async publishDynamic(
    this: RequireAuth<T> extends never ? never : this,
    contentOrOptions: string | import('../api/dynamic.js').CreateDynamicOptions,
  ): Promise<Dynamic> {
    const res = await DynamicAPI.create(this, contentOrOptions);
    if (res.code !== 0) {
      throw new BiliApiError(res.message || '发布动态失败', res.code);
    }
    return this.getDynamic(res.data.dyn_id_str);
  }

  /**
   * 发起/创建投票 — 需要登录
   */
  async createVote(
    this: RequireAuth<T> extends never ? never : this,
    options: import('../api/dynamic.js').CreateVoteOptions,
  ): Promise<BiliApiResponse<import('../api/dynamic.js').CreateVoteResult>> {
    return DynamicAPI.createVote(this, options);
  }

  // ==========================================
  // 子 API 懒加载 — 公开（无需登录）
  // ==========================================

  private _comment: typeof CommentAPI | null = null;
  /** 评论 API（读取无需登录，写操作需要登录） */
  get comment(): typeof CommentAPI { return this._comment ?? (this._comment = CommentAPI); }

  private _search: typeof SearchAPI | null = null;
  /** 搜索 API */
  get search(): typeof SearchAPI { return this._search ?? (this._search = SearchAPI); }

  private _ranking: typeof RankingAPI | null = null;
  /** 排行 API */
  get ranking(): typeof RankingAPI { return this._ranking ?? (this._ranking = RankingAPI); }

  private _emoji: typeof EmojiAPI | null = null;
  /** 表情 API */
  get emoji(): typeof EmojiAPI { return this._emoji ?? (this._emoji = EmojiAPI); }

  private _live: typeof LiveAPI | null = null;
  /** 直播 API（读取无需登录，管理操作需要登录） */
  get live(): typeof LiveAPI { return this._live ?? (this._live = LiveAPI); }

  private _dynamic: typeof DynamicAPI | null = null;
  /** 动态 API（读取无需登录，操作需要登录） */
  get dynamic(): typeof DynamicAPI { return this._dynamic ?? (this._dynamic = DynamicAPI); }

  private _article: typeof ArticleAPI | null = null;
  /** 专栏 API（读取无需登录，互动需要登录） */
  get article(): typeof ArticleAPI { return this._article ?? (this._article = ArticleAPI); }

  private _video: typeof VideoAPI | null = null;
  /** 视频 API（读取无需登录，互动需要登录） */
  get video(): typeof VideoAPI { return this._video ?? (this._video = VideoAPI); }

  private _user: typeof UserAPI | null = null;
  /** 用户 API（读取无需登录，关系操作需要登录） */
  get user(): typeof UserAPI { return this._user ?? (this._user = UserAPI); }

  private _opus: typeof OpusAPI | null = null;
  /** 图文 API */
  get opus(): typeof OpusAPI { return this._opus ?? (this._opus = OpusAPI); }

  private _favorite: typeof FavoriteAPI | null = null;
  /** 收藏夹 API（读取无需登录，管理需要登录） */
  get favorite(): typeof FavoriteAPI { return this._favorite ?? (this._favorite = FavoriteAPI); }

  private _danmaku: typeof DanmakuAPI | null = null;
  /** 弹幕 API（读取无需登录，发送/配置需要登录） */
  get danmaku(): typeof DanmakuAPI { return this._danmaku ?? (this._danmaku = DanmakuAPI); }

  // ==========================================
  // 子 API 懒加载 — 需要认证（HasToken）
  // ==========================================

  private _message: typeof MessageAPI | null = null;
  /** 消息 API — 需要登录 */
  get message(): T extends HasToken ? typeof MessageAPI : never {
    return (this._message ?? (this._message = MessageAPI)) as unknown as T extends HasToken ? typeof MessageAPI : never;
  }

  private _history: typeof HistoryAPI | null = null;
  /** 历史 API — 需要登录 */
  get history(): T extends HasToken ? typeof HistoryAPI : never {
    return (this._history ?? (this._history = HistoryAPI)) as unknown as T extends HasToken ? typeof HistoryAPI : never;
  }

  private _note: typeof NoteAPI | null = null;
  /** 笔记 API — 需要登录 */
  get note(): T extends HasToken ? typeof NoteAPI : never {
    return (this._note ?? (this._note = NoteAPI)) as unknown as T extends HasToken ? typeof NoteAPI : never;
  }

  private _electric: typeof ElectricAPI | null = null;
  /** 充电 API — 需要登录 */
  get electric(): T extends HasToken ? typeof ElectricAPI : never {
    return (this._electric ?? (this._electric = ElectricAPI)) as unknown as T extends HasToken ? typeof ElectricAPI : never;
  }

  private _upload: typeof UploadAPI | null = null;
  /** 上传 API — 需要登录 */
  get upload(): T extends HasToken ? typeof UploadAPI : never {
    return (this._upload ?? (this._upload = UploadAPI)) as unknown as T extends HasToken ? typeof UploadAPI : never;
  }
}
