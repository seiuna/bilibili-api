import { ConfigManager } from './config.js';
import { VideoQuery } from './queries/video.js';
import type { VideoInfo } from './queries/video.js';
import { VideoResult } from './queries/results.js';
import { loginByWebQrcode, loginByTvQrcode } from './qrcode.js';
import type {
  WebQrcodeLoginOptions,
  TvQrcodeLoginOptions,
  QrcodeLoginResult,
} from './qrcode.js';
import type { BiliApiResponse } from './types.js';
import { NotifyAPI } from './api/notify.js';
import { CommentAPI } from './api/comment.js';
import { ChatAPI } from './api/chat.js';
import { SpaceAPI } from './api/space.js';
import { UploadAPI } from './api/upload.js';
import type { DynamicDetail } from './api/dynamic-types.js';

// ==========================================
// BiliClient — 全局客户端 & 拦截器
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

export class BiliClient {
  public config: ConfigManager;

  /** 防止并发的凭证刷新 */
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  private customFetch: typeof fetch | null;

  constructor(configPath?: string, customFetch?: typeof fetch) {
    this.config = new ConfigManager(configPath);
    this.customFetch = customFetch ?? null;
  }


  static async create(
    configPath?: string,
    customFetch?: typeof fetch,
  ): Promise<BiliClient> {
    const client = new BiliClient(configPath, customFetch);
    await client.config.load();
    return client;
  }

  video(bvid: string): VideoQuery {
    return new VideoQuery(this, { vid: bvid });
  }

  /**
   * 通过 aid 获取视频详情
   * @param aid - 视频 AV 号
   * @returns {@link VideoResult}
   */
  async videoByAid(aid: number): Promise<VideoResult> {
    const raw = await this.request<BiliApiResponse<VideoInfo>>(
      `https://api.bilibili.com/x/web-interface/view?aid=${aid}`,
    );
    return new VideoResult(this, raw);
  }

  /**
   * 通过动态 ID 获取动态详情
   * @param dynamicId - 动态 ID
   * @returns BiliApiResponse<DynamicDetail>
   */
  async dynamicDetail(dynamicId: number): Promise<BiliApiResponse<DynamicDetail>> {
    return this.request<BiliApiResponse<DynamicDetail>>(
      `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${dynamicId}`,
    );
  }

  private _notify: NotifyAPI | null = null;

  get notify(): NotifyAPI {
    if (!this._notify) this._notify = new NotifyAPI(this);
    return this._notify;
  }

  private _comment: CommentAPI | null = null;
  /** 评论区 API */
  get comment(): CommentAPI {
    if (!this._comment) this._comment = new CommentAPI(this);
    return this._comment;
  }

  private _chat: ChatAPI | null = null;
  /** 私信 API */
  get chat(): ChatAPI {
    if (!this._chat) this._chat = new ChatAPI(this);
    return this._chat;
  }

  private _space: SpaceAPI | null = null;
  /** 用户空间 API */
  get space(): SpaceAPI {
    if (!this._space) this._space = new SpaceAPI(this);
    return this._space;
  }

  private _upload: UploadAPI | null = null;
  /** 上传 API */
  get upload(): UploadAPI {
    if (!this._upload) this._upload = new UploadAPI(this);
    return this._upload;
  }


  async isLoggedIn(): Promise<{ loggedIn: boolean; mid?: number }> {
    if (!this.config.data.cookie) {
      return { loggedIn: false };
    }
    try {
      const data = await this.request<{
        code: number; data: { mid: number; isLogin: boolean };
      }>('https://api.bilibili.com/x/web-interface/nav');
      return {
        loggedIn: data.code === 0 && (data.data?.isLogin ?? false),
        mid: data.data?.mid,
      };
    } catch {
      return { loggedIn: false };
    }
  }

  /**
   * 自动登录：尝试顺序
   *   1. 已有有效 cookie → 直接返回
   *   2. cookie 失效但有 refresh_token → 静默刷新
   *   3. 都失败 → 弹出二维码登录
   *
   * @returns 登录结果，success=true 表示已就绪
   */
  async ensureLogin(
    qrcodeOptions?: WebQrcodeLoginOptions,
  ): Promise<QrcodeLoginResult> {
    // 1. 已有有效 cookie
    const { loggedIn, mid } = await this.isLoggedIn();
    if (loggedIn) {
      if (mid) await this.config.updateMid(mid);
      return {
        success: true,
        cookie: this.config.data.cookie,
        refreshToken: this.config.data.refreshToken,
        mid,
        message: '已登录，无需重新扫码',
      };
    }

    // 2. 尝试用 refresh_token 静默刷新
    if (this.config.data.refreshToken) {
      try {
        const fetcher = this.customFetch ?? fetch;
        await this.performRefresh(fetcher);
        const recheck = await this.isLoggedIn();
        if (recheck.loggedIn) {
          return {
            success: true,
            cookie: this.config.data.cookie,
            refreshToken: this.config.data.refreshToken,
            mid: recheck.mid,
            message: '凭证已自动刷新',
          };
        }
      } catch {
      }
    }

    const result = await loginByWebQrcode(this.config, qrcodeOptions);
    if (result.success && this.config.data.mid) {
      result.mid = this.config.data.mid;
    }
    return result;
  }


  async loginByQrcode(
    options?: WebQrcodeLoginOptions,
  ): Promise<QrcodeLoginResult> {
    return loginByWebQrcode(this.config, options);
  }


  async loginByTvQrcode(
    options?: TvQrcodeLoginOptions,
  ): Promise<QrcodeLoginResult> {
    return loginByTvQrcode(this.config, options);
  }



  async request<T = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const fetcher = this.customFetch ?? fetch;

    const res = await this.doRequest(fetcher, url, options);
    const data = (await res.json().catch(() => ({}))) as T & {
      code?: number;
    };

    // -101：未登录 / 失效
    if (data.code === -101) {
      return this.handleCredentialRefresh(fetcher, url, options);
    }

    return data;
  }


  async checkedRequest<T extends { code?: number; message?: string }>(
    url: string,
    options?: RequestInit,
  ): Promise<T> {
    const data = await this.request<T>(url, options);
    if (data.code !== 0) {
      throw new BiliApiError(data.message ?? '未知错误', data.code ?? -1);
    }
    return data;
  }


  private async doRequest(
    fetcher: typeof fetch,
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    // 注入 Cookie
    const headers = new Headers(options.headers);
    if (this.config.data.cookie) {
      headers.set('Cookie', this.config.data.cookie);
    }
    if (this.config.data.accessToken && !headers.has('Authorization')) {
    }

    options.headers = headers;

    const res = await fetcher(url, options);

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
      if (this.refreshPromise) {
        await this.refreshPromise;
      }
      const retryRes = await this.doRequest(fetcher, url, options);
      const retryData = await retryRes.json();
      if (retryData.code === -101) {
        throw new AuthRequiredError(
          '凭证刷新后重试仍返回 -101，需重新登录',
        );
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
      throw new AuthRequiredError(
        '凭证刷新后重试仍返回 -101，可能账号被风控，请重新登录',
      );
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      },
    );

    const data = await res.json();

    if (data.code !== 0) {
      throw new CredentialRefreshError(
        `Token 刷新被拒绝: ${data.message}`,
        data.code,
      );
    }

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      await this.config.updateCookie(setCookie);
    }

    if (data.data?.refresh_token) {
      await this.config.updateRefreshToken(data.data.refresh_token);
    }
  }
}
