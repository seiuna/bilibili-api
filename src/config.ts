import * as fs from 'fs/promises';
import * as path from 'path';
import type { BiliConfig } from './types.js';

// ==========================================
// 持久化配置管理器
// ==========================================

const DEFAULT_CONFIG: BiliConfig = {
  cookie: '',
  refreshToken: '',
  accessToken: '',
  tvRefreshToken: '',
  mid: undefined,
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

  /** 更新 Web Cookie */
  async updateCookie(cookie: string): Promise<void> {
    this.data.cookie = cookie;
    await this.save();
  }

  async mergeCookie(setCookieHeader: string): Promise<void> {
    const existing = this.parseCookiePairs(this.data.cookie);
    const incoming = this.parseCookiePairs(setCookieHeader);

    const merged = { ...existing, ...incoming };
    this.data.cookie = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    await this.save();
  }

  async setAuthCookies(setCookieHeader: string): Promise<void> {
    const importantKeys = [
      'DedeUserID',
      'DedeUserID__ckMd5',
      'SESSDATA',
      'bili_jct',
      'sid',
    ];

    const allCookies = this.parseCookiePairs(setCookieHeader);
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

  private parseCookiePairs(
    cookieStr: string,
  ): Record<string, string> {
    const pairs: Record<string, string> = {};
    if (!cookieStr) return pairs;

    const parts = cookieStr.split(/[,;]\s*/);
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        const key = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        if (
          key &&
          !['path', 'domain', 'expires', 'max-age', 'httponly', 'secure', 'samesite'].includes(
            key.toLowerCase(),
          )
        ) {
          pairs[key] = value;
        }
      }
    }
    return pairs;
  }
}
