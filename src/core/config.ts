import * as fs from 'fs/promises';
import * as path from 'path';
import type { BiliConfig } from './types.js';

const DEFAULT_CONFIG: BiliConfig = {
  cookie: '',
  refreshToken: '',
  accessToken: '',
  tvRefreshToken: '',
  mid: undefined,
  wbiImgKey: undefined,
  wbiSubKey: undefined,
  wbiExpireAt: undefined,
};

export class ConfigManager {
  public data: BiliConfig = { ...DEFAULT_CONFIG };

  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? path.resolve('./bili-config.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.data = { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      await this.save();
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.data, null, 2),
      'utf-8',
    );
  }

  /** 更新 Cookie */
  async updateCookie(cookie: string): Promise<void> {
    this.data.cookie = cookie;
    await this.save();
  }

  /** 合并 Set-Cookie 头 */
  async mergeCookie(setCookieHeader: string): Promise<void> {
    const existing = this.parseCookiePairs(this.data.cookie);
    const incoming = this.parseSetCookiePairs(setCookieHeader);

    const merged = { ...existing, ...incoming };
    this.data.cookie = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    await this.save();
  }

  /** 仅合并重要鉴权 Cookie */
  async setAuthCookies(setCookieHeader: string): Promise<void> {
    const importantKeys = [
      'DedeUserID',
      'DedeUserID__ckMd5',
      'SESSDATA',
      'bili_jct',
      'sid',
    ];

    const allCookies = this.parseSetCookiePairs(setCookieHeader);
    const existing = this.parseCookiePairs(this.data.cookie);
    const merged = { ...existing };

    for (const key of importantKeys) {
      if (allCookies[key]) {
        merged[key] = allCookies[key];
      }
    }

    this.data.cookie = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    await this.save();
  }

  async updateRefreshToken(token: string): Promise<void> {
    this.data.refreshToken = token;
    await this.save();
  }

  async updateTvTokens(
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    this.data.accessToken = accessToken;
    this.data.tvRefreshToken = refreshToken;
    await this.save();
  }

  async updateMid(mid: number): Promise<void> {
    this.data.mid = mid;
    await this.save();
  }

  /** 更新 WBI 签名密钥 */
  async updateWbiKeys(imgKey: string, subKey: string): Promise<void> {
    this.data.wbiImgKey = imgKey;
    this.data.wbiSubKey = subKey;
    // 缓存 24 小时
    this.data.wbiExpireAt = Date.now() + 24 * 60 * 60 * 1000;
    await this.save();
  }

  /** 获取 WBI 密钥（若过期返回 null） */
  getWbiKeys(): { imgKey: string; subKey: string } | null {
    if (
      this.data.wbiImgKey &&
      this.data.wbiSubKey &&
      this.data.wbiExpireAt &&
      Date.now() < this.data.wbiExpireAt
    ) {
      return { imgKey: this.data.wbiImgKey, subKey: this.data.wbiSubKey };
    }
    return null;
  }

  /** 提取 CSRF Token (bili_jct) */
  getCsrf(): string {
    const match = this.data.cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!match) throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    return match[1];
  }

  private parseCookiePairs(cookieStr: string): Record<string, string> {
    const pairs: Record<string, string> = {};
    if (!cookieStr) return pairs;

    for (const part of cookieStr.split(';')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = part.substring(0, eqIdx).trim();
      const value = part.substring(eqIdx + 1).trim();
      if (key) pairs[key] = value;
    }
    return pairs;
  }

  /** Extract cookie name/value pairs without treating Expires commas as separators. */
  private parseSetCookiePairs(header: string): Record<string, string> {
    const pairs: Record<string, string> = {};
    if (!header) return pairs;

    // A Set-Cookie value starts with name=value. Attributes are ignored. When
    // several cookies are folded into one header, a comma followed by a token
    // and '=' marks the next cookie; commas inside Expires remain part of the
    // current attribute and are never parsed as cookie values.
    const starts = /(?:^|,)\s*([^=;,\s]+)=/g;
    let match: RegExpExecArray | null;
    while ((match = starts.exec(header))) {
      const start = match.index + (header[match.index] === ',' ? 1 : 0);
      const segment = header.slice(start).trimStart();
      const eqIdx = segment.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = segment.slice(0, eqIdx).trim();
      const remainder = segment.slice(eqIdx + 1);
      const end = remainder.search(/;|,\s*[^=;,\s]+=/);
      pairs[key] = (end >= 0 ? remainder.slice(0, end) : remainder).trim();
    }
    return pairs;
  }
}