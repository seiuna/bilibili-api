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

/** Profile 用户简要信息 */
export interface ProfileUser {
  /** 配置文件对应的用户 ID（如 "390794259"） */
  userId: string;
  /** 提取到的数字 UID */
  mid?: number;
  /** 配置文件绝对路径 */
  configPath: string;
  /** 配置详情数据 */
  config: BiliConfig;
  /** 是否具备基础登录凭证（含有 SESSDATA） */
  hasCredentials: boolean;
}

/**
 * 过滤谓词函数
 * @param user 当前 Profile 的用户与凭证信息
 * @param isRequestLogin 该 profile 是否已具备登录凭证
 * @returns 是否为该 profile 创建客户端
 */
export type ProfileFilter = (
  user: ProfileUser,
  isRequestLogin: boolean,
) => boolean | Promise<boolean>;

export interface FromProfilesOptions {
  /** 自定义 profiles 目录路径，默认 './profiles' */
  profilesDir?: string;
  /** 是否自动对筛选出的客户端执行 ensureLogin() 校验登录状态，默认 false */
  autoEnsureLogin?: boolean;
}

export class ConfigManager {
  public static readonly DEFAULT_PROFILES_DIR = path.resolve('./profiles');
  public static readonly LEGACY_CONFIG_PATH = path.resolve('./bili-config.json');

  public data: BiliConfig = { ...DEFAULT_CONFIG };

  private configPath: string;
  private isExplicitPath: boolean;

  /**
   * @param configPathOrUserId 可传具体用户 UID、Profile 名称（存入 profiles/ 目录），或完整配置文件路径；未传时自动按默认策略加载
   */
  constructor(configPathOrUserId?: string | number) {
    if (configPathOrUserId !== undefined) {
      const str = String(configPathOrUserId).trim();
      // 如果包含路径分隔符，视为显式外部路径
      if (str.includes('/') || str.includes('\\')) {
        this.configPath = path.resolve(str);
        this.isExplicitPath = true;
      } else {
        // 用户名、UID 或任意文件名统一收敛写入 profiles 目录
        const fileName = str.endsWith('.json') ? str : `${str}.json`;
        this.configPath = path.resolve(ConfigManager.DEFAULT_PROFILES_DIR, fileName);
        this.isExplicitPath = true;
      }
    } else {
      this.isExplicitPath = false;
      this.configPath = path.resolve(ConfigManager.DEFAULT_PROFILES_DIR, 'default.json');
    }
  }

  /** 获取当前配置文件路径 */
  getConfigPath(): string {
    return this.configPath;
  }

  /** 从当前配置中提取用户 ID（DedeUserID 或 mid） */
  extractUserId(): string | null {
    if (this.data.cookie) {
      const match = this.data.cookie.match(/(?:^|;\s*)DedeUserID=([0-9]+)/);
      if (match) return match[1];
    }
    if (this.data.mid !== undefined && this.data.mid !== null) {
      return String(this.data.mid);
    }
    return null;
  }

  /**
   * 为指定用户创建/绑定 profile 文件：
   * 1. 若用户未显式指定 profile（isExplicitPath === false）或当前为 default.json，
   *    登录成功后自动升级创建为 profiles/<userId>.json，并清理临时文件。
   * 2. 若用户显式指定了 profile 名称（如 "default-test"），则严格保存到指定的 profiles/<name>.json，不篡改文件名。
   */
  async createProfileForUser(userId: string | number): Promise<string> {
    const idStr = String(userId).trim();

    // 仅在未显式指定 profile，或当前处于 default.json 时，才自动按 userId 改名
    if (!this.isExplicitPath || path.basename(this.configPath) === 'default.json') {
      if (idStr) {
        const targetPath = path.resolve(ConfigManager.DEFAULT_PROFILES_DIR, `${idStr}.json`);
        const oldPath = this.configPath;

        this.configPath = targetPath;
        this.isExplicitPath = true;

        await this.save();

        if (oldPath !== targetPath) {
          try {
            await fs.unlink(oldPath);
          } catch {
            // 忽略清理异常
          }
        }
        return targetPath;
      }
    }

    // 显式指定 profile 名称时，直接保存到当前指定的文件
    await this.save();
    return this.configPath;
  }

  async load(): Promise<void> {
    // 若未显式指定路径，尝试智能探测：已有 profiles > 旧 bili-config.json > 初始 default
    if (!this.isExplicitPath) {
      const detected = await this.detectDefaultConfig();
      if (detected) {
        this.configPath = detected;
      }
    }

    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.data = { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      if (this.isExplicitPath) {
        await this.save();
      }
    }
  }

  /**
   * 自动探测默认配置：
   * 1. 扫描 profiles/ 目录，若有 profile 则选最新修改的
   * 2. 若 profiles/ 无内容，探测根目录是否存在 bili-config.json 并迁移
   */
  private async detectDefaultConfig(): Promise<string | null> {
    try {
      const entries = await fs.readdir(ConfigManager.DEFAULT_PROFILES_DIR, { withFileTypes: true });
      const jsonFiles = entries.filter(
        (e) => e.isFile() && e.name.endsWith('.json') && e.name !== 'default.json',
      );
      if (jsonFiles.length > 0) {
        let latestFile = jsonFiles[0].name;
        let latestMtime = 0;
        for (const file of jsonFiles) {
          const fullPath = path.resolve(ConfigManager.DEFAULT_PROFILES_DIR, file.name);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.mtimeMs > latestMtime) {
              latestMtime = stat.mtimeMs;
              latestFile = file.name;
            }
          } catch {
            // ignore
          }
        }
        return path.resolve(ConfigManager.DEFAULT_PROFILES_DIR, latestFile);
      }
    } catch {
      // profiles 目录可能尚不存在
    }

    // 检查根目录是否有 legacy 配置
    try {
      const legacyRaw = await fs.readFile(ConfigManager.LEGACY_CONFIG_PATH, 'utf-8');
      const parsed: BiliConfig = JSON.parse(legacyRaw);
      let userId: string | null = null;
      if (parsed.cookie) {
        const match = parsed.cookie.match(/(?:^|;\s*)DedeUserID=([0-9]+)/);
        if (match) userId = match[1];
      }
      if (!userId && parsed.mid) {
        userId = String(parsed.mid);
      }

      if (userId) {
        const targetPath = path.resolve(ConfigManager.DEFAULT_PROFILES_DIR, `${userId}.json`);
        await fs.mkdir(ConfigManager.DEFAULT_PROFILES_DIR, { recursive: true });
        await fs.writeFile(targetPath, JSON.stringify(parsed, null, 2), 'utf-8');
        try {
          await fs.unlink(ConfigManager.LEGACY_CONFIG_PATH);
        } catch {
          // ignore
        }
        return targetPath;
      }
    } catch {
      // 无 legacy 配置
    }

    return null;
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
    const userId = this.extractUserId();
    if (userId && (!this.isExplicitPath || path.basename(this.configPath) === 'default.json')) {
      await this.createProfileForUser(userId);
    } else {
      await this.save();
    }
  }

  /** 合并 Set-Cookie 头 */
  async mergeCookie(setCookieHeader: string): Promise<void> {
    const existing = this.parseCookiePairs(this.data.cookie);
    const incoming = this.parseSetCookiePairs(setCookieHeader);

    const merged = { ...existing, ...incoming };
    this.data.cookie = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    const userId = this.extractUserId();
    if (userId && (!this.isExplicitPath || path.basename(this.configPath) === 'default.json')) {
      await this.createProfileForUser(userId);
    } else {
      await this.save();
    }
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

    const userId = this.extractUserId();
    if (userId && (!this.isExplicitPath || path.basename(this.configPath) === 'default.json')) {
      await this.createProfileForUser(userId);
    } else {
      await this.save();
    }
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
    if (!this.isExplicitPath || path.basename(this.configPath) === 'default.json') {
      await this.createProfileForUser(mid);
    } else {
      await this.save();
    }
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

  /** 列出 profiles 目录下的所有用户 Profile 名称（即 UID 列表） */
  static async listProfiles(profilesDir = ConfigManager.DEFAULT_PROFILES_DIR): Promise<string[]> {
    try {
      const entries = await fs.readdir(profilesDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith('.json') && e.name !== 'default.json')
        .map((e) => e.name.slice(0, -5));
    } catch {
      return [];
    }
  }

  /** 加载 profiles 目录下的所有 Profile 详细信息 */
  static async loadAllProfiles(profilesDir = ConfigManager.DEFAULT_PROFILES_DIR): Promise<ProfileUser[]> {
    const ids = await ConfigManager.listProfiles(profilesDir);
    const users: ProfileUser[] = [];

    for (const id of ids) {
      const filePath = path.resolve(profilesDir, `${id}.json`);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed: BiliConfig = JSON.parse(content);
        const hasCredentials = Boolean(parsed.cookie && parsed.cookie.includes('SESSDATA'));
        users.push({
          userId: id,
          mid: parsed.mid,
          configPath: filePath,
          config: parsed,
          hasCredentials,
        });
      } catch {
        // 跳过损坏的配置文件
      }
    }

    return users;
  }

  /**
   * 从默认或指定的 profiles 目录下自动创建客户端列表（函数式接口）
   * @param predicate 过滤谓词，决定是否为该 profile 创建客户端
   * @param options 批量创建选项
   */
  static async fromProfiles<C = any>(
    predicate?: ProfileFilter,
    options?: FromProfilesOptions,
  ): Promise<C[]> {
    const profiles = await ConfigManager.loadAllProfiles(options?.profilesDir);
    const clients: C[] = [];
    const { BiliClient } = await import('./client.js');

    for (const profile of profiles) {
      const isRequestLogin = profile.hasCredentials;
      if (predicate) {
        const matched = await predicate(profile, isRequestLogin);
        if (!matched) continue;
      }

      const client = await BiliClient.create(profile.configPath);
      if (options?.autoEnsureLogin && isRequestLogin) {
        try {
          await client.ensureLogin();
        } catch {
          // ignore login error in batch
        }
      }
      clients.push(client as unknown as C);
    }

    return clients;
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
