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

  constructor(configPath?: string, customFetch?: typeof fetch) {
    this.config = new ConfigManager(configPath);
    this.customFetch = customFetch ?? null;
  }

  /** 创建并加载客户端（未认证状态） */
  static async create(
    configPath?: string,
    customFetch?: typeof fetch,
  ): Promise<BiliClient<void>> {
    const client = new BiliClient<void>(configPath, customFetch);
    await client.config.load();
    return client;
  }

  // ==========================================
  // 鉴权与登录
  // ==========================================

  /** 检查登录状态 */
  async isLoggedIn(): Promise<{ loggedIn: boolean; mid?: number }> {
    if (!this.config.data.cookie) return { loggedIn: false };
    try {
      const data = await this.request<{
        code: number;
        data: { mid: number; isLogin: boolean; wbi_img?: { img_url: string; sub_url: string } };
      }>('https://api.bilibili.com/x/web-interface/nav');
      if (data.code === 0 && data.data?.wbi_img) {
        const imgKey = data.data.wbi_img.img_url.split('/').pop()?.split('.')[0] ?? '';
        const subKey = data.data.wbi_img.sub_url.split('/').pop()?.split('.')[0] ?? '';
        if (imgKey && subKey) {
          await this.config.updateWbiKeys(imgKey, subKey);
        }
      }
      return {
        loggedIn: data.code === 0 && (data.data?.isLogin ?? false),
        mid: data.data?.mid,
      };
    } catch {
      return { loggedIn: false };
    }
  }

  /**
   * 自动登录：cookie → refresh → 扫码
   * 成功后返回已认证类型的客户端
   */
  async ensureLogin(
    qrcodeOptions?: WebQrcodeLoginOptions,
  ): Promise<BiliClient<HasToken>> {
    const { loggedIn, mid } = await this.isLoggedIn();
    if (loggedIn) {
      if (mid) await this.config.updateMid(mid);
    } else if (this.config.data.refreshToken) {
      try {
        const fetcher = this.customFetch ?? fetch;
        await this.performRefresh(fetcher);
        const recheck = await this.isLoggedIn();
        if (!recheck.loggedIn) {
          const result = await loginByWebQrcode(this.config, qrcodeOptions);
          if (!result.success) throw new AuthRequiredError(result.message);
        }
      } catch (error) {
        if (!(error instanceof CredentialRefreshError)) throw error;
        const result = await loginByWebQrcode(this.config, qrcodeOptions);
        if (!result.success) throw new AuthRequiredError(result.message);
      }
    } else {
      const result = await loginByWebQrcode(this.config, qrcodeOptions);
      if (!result.success) throw new AuthRequiredError(result.message);
    }
    return this as unknown as BiliClient<HasToken>;
  }

  /** Web 端二维码登录 — 成功后返回已认证客户端 */
  async loginByQrcode(
    options?: WebQrcodeLoginOptions,
  ): Promise<BiliClient<HasToken>> {
    const result = await loginByWebQrcode(this.config, options);
    if (!result.success) throw new AuthRequiredError(result.message);
    return this as unknown as BiliClient<HasToken>;
  }

  /** TV 端二维码登录 — 成功后返回已认证客户端 */
  async loginByTvQrcode(
    options?: TvQrcodeLoginOptions,
  ): Promise<BiliClient<HasToken>> {
    const result = await loginByTvQrcode(this.config, options);
    if (!result.success) throw new AuthRequiredError(result.message);
    return this as unknown as BiliClient<HasToken>;
  }

  /** 密码登录 — 成功后返回已认证客户端 */
  async loginByPassword(
    username: string,
    password: string,
    options?: {
      keep?: boolean;
      captcha?: { challenge: string; validate: string; seccode: string };
    },
  ): Promise<BiliClient<HasToken>> {
    const result = await loginByPassword(this.config, username, password, options);
    if (!result.success) throw new AuthRequiredError(result.message);
    return this as unknown as BiliClient<HasToken>;
  }

  /** 退出登录 — 返回未认证客户端 */
  async logout(): Promise<BiliClient<void>> {
    await logout(this.config);
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

    const finalUrl = options.wbi ? await this.injectWbiSign(url) : url;
    const res = await this.doRequest(fetcher, finalUrl, options);
    const data = (await res.json().catch(() => ({}))) as TData & { code?: number };

    if (data.code === -101) {
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

  private async injectWbiSign(url: string): Promise<string> {
    const urlObj = new URL(url);
    const params: Record<string, string | number> = {};

    for (const [k, v] of urlObj.searchParams) {
      params[k] = v;
    }

    let wbiKeys = this.config.getWbiKeys();
    if (!wbiKeys) {
      const navData = await this.request<{
        code: number;
        data: { wbi_img: { img_url: string; sub_url: string } };
      }>('https://api.bilibili.com/x/web-interface/nav');

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
    const newParams = new URLSearchParams();
    for (const [k, v] of Object.entries(signed)) {
      newParams.set(k, v);
    }
    urlObj.search = newParams.toString();
    return urlObj.toString();
  }

  private async doRequest(
    fetcher: typeof fetch,
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    if (this.config.data.cookie) {
      headers.set('Cookie', this.config.data.cookie);
    }
    if (this.config.data.accessToken) {
      headers.set('Authorization', `Bearer ${this.config.data.accessToken}`);
    }

    const res = await fetcher(url, {
      method: options.method ?? 'GET',
      headers: headers as any,
      body: options.body as BodyInit | undefined,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      await this.config.mergeCookie(setCookie);
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
      const retryRes = await this.doRequest(fetcher, url, options);
      const retryData = await retryRes.json();
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

    const retryRes = await this.doRequest(fetcher, url, options);
    const retryData = await retryRes.json();

    if (retryData.code === -101) {
      throw new AuthRequiredError('凭证刷新后重试仍返回 -101，可能账号被风控，请重新登录');
    }

    return retryData;
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

    const data = await res.json();

    if (data.code !== 0) {
      throw new CredentialRefreshError(`Token 刷新被拒绝: ${data.message}`, data.code);
    }

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      await this.config.updateCookie(setCookie);
    }

    if (data.data?.refresh_token) {
      await this.config.updateRefreshToken(data.data.refresh_token);
    }
  }

  // ==========================================
  // 门面方法 (Facade) — 公开（无需登录）
  // ==========================================

  /** 获取视频实体 */
  async getVideo(bvid: string): Promise<Video> {
    const rawData = await VideoAPI.getInfo(this, bvid);
    return new Video(this, rawData.data);
  }

  /** 通过 aid 获取视频实体 */
  async getVideoByAid(aid: number): Promise<Video> {
    const rawData = await VideoAPI.getInfoByAid(this, aid);
    return new Video(this, rawData.data);
  }

  /** 获取用户实体 */
  async getUser(mid: number): Promise<User> {
    const rawData = await UserAPI.getInfo(this, mid);
    return new User(this, rawData.data);
  }

  /** 获取专栏实体 */
  async getArticle(cvid: number): Promise<Article> {
    const rawData = await ArticleAPI.getInfo(this, cvid);
    (rawData.data as any)._cvid = cvid;
    return new Article(this, rawData.data);
  }

  /** 获取动态实体 */
  async getDynamic(id: string): Promise<Dynamic> {
    const rawData = await DynamicAPI.getDetail(this, id);
    return new Dynamic(this, rawData.data.item);
  }

  /** 获取直播间实体 */
  async getLiveRoom(roomId: number): Promise<LiveRoom> {
    const rawData = await LiveAPI.getRoomInfo(this, roomId);
    return new LiveRoom(this, rawData.data);
  }

  /** 获取收藏夹实体（公开收藏夹无需登录） */
  async getFavoriteFolder(mediaId: number): Promise<FavoriteFolder> {
    const rawData = await FavoriteAPI.getFolderInfo(this, mediaId);
    return new FavoriteFolder(this, rawData.data);
  }

  /** 获取图文实体 */
  async getOpus(id: number | string): Promise<Opus> {
    const rawData = await OpusAPI.getDetail(this, id);
    return new Opus(this, rawData.data.item);
  }

  // ==========================================
  // 门面方法 (Facade) — 需要认证（HasToken）
  // ==========================================

  /** 获取历史记录 — 需要登录 */
  async getHistory(
    this: RequireAuth<T> extends never ? never : this,
    ps = 20,
  ): Promise<AsyncGenerator<import('../api/history.js').HistoryItem>> {
    return HistoryAPI.history(this, ps);
  }

  /** 获取稍后再看列表 — 需要登录 */
  async getToViewList(
    this: RequireAuth<T> extends never ? never : this,
  ): Promise<{ count: number; list: import('../api/history.js').ToViewVideo[] }> {
    const res = await HistoryAPI.getToViewList(this);
    return res.data;
  }

  // ==========================================
  // 子 API 懒加载 — 公开（无需登录）
  // ==========================================

  private _comment: CommentAPI | null = null;
  /** 评论 API（读取无需登录，写操作需要登录） */
  get comment(): CommentAPI { return this._comment ?? (this._comment = CommentAPI); }

  private _search: SearchAPI | null = null;
  /** 搜索 API */
  get search(): SearchAPI { return this._search ?? (this._search = SearchAPI); }

  private _ranking: RankingAPI | null = null;
  /** 排行 API */
  get ranking(): RankingAPI { return this._ranking ?? (this._ranking = RankingAPI); }

  private _emoji: EmojiAPI | null = null;
  /** 表情 API */
  get emoji(): EmojiAPI { return this._emoji ?? (this._emoji = EmojiAPI); }

  private _live: LiveAPI | null = null;
  /** 直播 API（读取无需登录，管理操作需要登录） */
  get live(): LiveAPI { return this._live ?? (this._live = LiveAPI); }

  private _dynamic: DynamicAPI | null = null;
  /** 动态 API（读取无需登录，操作需要登录） */
  get dynamic(): DynamicAPI { return this._dynamic ?? (this._dynamic = DynamicAPI); }

  private _article: ArticleAPI | null = null;
  /** 专栏 API（读取无需登录，互动需要登录） */
  get article(): ArticleAPI { return this._article ?? (this._article = ArticleAPI); }

  private _video: VideoAPI | null = null;
  /** 视频 API（读取无需登录，互动需要登录） */
  get video(): VideoAPI { return this._video ?? (this._video = VideoAPI); }

  private _user: UserAPI | null = null;
  /** 用户 API（读取无需登录，关系操作需要登录） */
  get user(): UserAPI { return this._user ?? (this._user = UserAPI); }

  private _opus: OpusAPI | null = null;
  /** 图文 API */
  get opus(): OpusAPI { return this._opus ?? (this._opus = OpusAPI); }

  private _favorite: FavoriteAPI | null = null;
  /** 收藏夹 API（读取无需登录，管理需要登录） */
  get favorite(): FavoriteAPI { return this._favorite ?? (this._favorite = FavoriteAPI); }

  private _danmaku: DanmakuAPI | null = null;
  /** 弹幕 API（读取无需登录，发送/配置需要登录） */
  get danmaku(): DanmakuAPI { return this._danmaku ?? (this._danmaku = DanmakuAPI); }

  // ==========================================
  // 子 API 懒加载 — 需要认证（HasToken）
  // ==========================================

  private _message: MessageAPI | null = null;
  /** 消息 API — 需要登录 */
  get message(): T extends HasToken ? MessageAPI : never {
    return (this._message ?? (this._message = MessageAPI)) as unknown as T extends HasToken ? MessageAPI : never;
  }

  private _history: HistoryAPI | null = null;
  /** 历史 API — 需要登录 */
  get history(): T extends HasToken ? HistoryAPI : never {
    return (this._history ?? (this._history = HistoryAPI)) as unknown as T extends HasToken ? HistoryAPI : never;
  }

  private _note: NoteAPI | null = null;
  /** 笔记 API — 需要登录 */
  get note(): T extends HasToken ? NoteAPI : never {
    return (this._note ?? (this._note = NoteAPI)) as unknown as T extends HasToken ? NoteAPI : never;
  }

  private _electric: ElectricAPI | null = null;
  /** 充电 API — 需要登录 */
  get electric(): T extends HasToken ? ElectricAPI : never {
    return (this._electric ?? (this._electric = ElectricAPI)) as unknown as T extends HasToken ? ElectricAPI : never;
  }

  private _upload: UploadAPI | null = null;
  /** 上传 API — 需要登录 */
  get upload(): T extends HasToken ? UploadAPI : never {
    return (this._upload ?? (this._upload = UploadAPI)) as unknown as T extends HasToken ? UploadAPI : never;
  }
}
