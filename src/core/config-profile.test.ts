import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from './config.js';
import { BiliClient } from './client.js';

describe('Config Profile & Functional fromProfiles', () => {
  let tempDir: string;
  let profilesDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bili-test-'));
    profilesDir = path.join(tempDir, 'profiles');
    await fs.mkdir(profilesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Path Resolution', () => {
    it('should resolve numeric userId to profiles/<id>.json', () => {
      const config = new ConfigManager(123456);
      expect(config.getConfigPath()).toContain(path.join('profiles', '123456.json'));
    });

    it('should resolve string userId/name to profiles/<name>.json', () => {
      const config = new ConfigManager('account_sub');
      expect(config.getConfigPath()).toContain(path.join('profiles', 'account_sub.json'));
    });

    it('should resolve plain filename with .json to profiles/<name>.json', () => {
      const config = new ConfigManager('my-custom.json');
      expect(config.getConfigPath()).toContain(path.join('profiles', 'my-custom.json'));
    });

    it('should resolve custom json path when explicit path separator provided', () => {
      const config = new ConfigManager('./my-custom.json');
      expect(config.getConfigPath()).toBe(path.resolve('./my-custom.json'));
    });

    it('should default to profiles/default.json when not provided', () => {
      const config = new ConfigManager();
      expect(config.getConfigPath()).toContain(path.join('profiles', 'default.json'));
    });
  });

  describe('Auto-create Profile on Login/AuthCookies', () => {
    it('should auto-create profiles/<userid>.json when auth cookies are received', async () => {
      // 临时替换 PROFILES_DIR 进行隔离测试
      const customProfileDefault = path.join(profilesDir, 'default.json');
      const config = new ConfigManager(customProfileDefault);
      // 将其标记为非显式外部路径
      (config as any).isExplicitPath = false;

      // 模拟接收登录 Cookie (标准 Set-Cookie 格式，多个 cookie 以逗号分隔)
      await config.setAuthCookies('DedeUserID=888999; Path=/, SESSDATA=test-sess; Path=/, bili_jct=test-csrf; Path=/');

      // 检查当前路径是否自动切换为 888999.json
      const currentPath = config.getConfigPath();
      expect(path.basename(currentPath)).toBe('888999.json');
      expect(config.extractUserId()).toBe('888999');

      // 验证文件已写入磁盘
      const content = await fs.readFile(currentPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.cookie).toContain('DedeUserID=888999');
      expect(parsed.cookie).toContain('bili_jct=test-csrf');
    });

    it('should keep custom profile name (e.g. default-test.json) when explicitly specified', async () => {
      // 显式指定 profile 名称 "default-test"
      const customProfile = path.join(profilesDir, 'default-test.json');
      const config = new ConfigManager(customProfile);

      // 模拟接收登录 Cookie
      await config.setAuthCookies('DedeUserID=123456; Path=/, SESSDATA=test-sess; Path=/, bili_jct=test-csrf; Path=/');

      // 验证仍然保存为 default-test.json，而不是 123456.json
      const currentPath = config.getConfigPath();
      expect(path.basename(currentPath)).toBe('default-test.json');

      const content = await fs.readFile(currentPath, 'utf-8');
      expect(JSON.parse(content).cookie).toContain('DedeUserID=123456');

      // 验证没有生成 123456.json
      const existsUserJson = await fs.access(path.join(profilesDir, '123456.json')).then(() => true).catch(() => false);
      expect(existsUserJson).toBe(false);
    });

    it('should extract userId correctly from mid or cookie', async () => {
      const config = new ConfigManager(path.join(profilesDir, 'test.json'));
      expect(config.extractUserId()).toBeNull();

      config.data.mid = 556677;
      expect(config.extractUserId()).toBe('556677');

      config.data.cookie = 'DedeUserID=112233; other=abc';
      expect(config.extractUserId()).toBe('112233');
    });
  });

  describe('listProfiles & loadAllProfiles', () => {
    it('should list all profiles and skip default.json', async () => {
      await fs.writeFile(path.join(profilesDir, '111.json'), JSON.stringify({ cookie: 'SESSDATA=1' }));
      await fs.writeFile(path.join(profilesDir, '222.json'), JSON.stringify({ cookie: 'SESSDATA=2' }));
      await fs.writeFile(path.join(profilesDir, 'default.json'), JSON.stringify({}));
      await fs.writeFile(path.join(profilesDir, 'not-json.txt'), 'text');

      const list = await ConfigManager.listProfiles(profilesDir);
      expect(list.sort()).toEqual(['111', '222']);

      const all = await ConfigManager.loadAllProfiles(profilesDir);
      expect(all.length).toBe(2);
      expect(all.find((u) => u.userId === '111')?.hasCredentials).toBe(true);
    });
  });

  describe('fromProfiles Functional Creation', () => {
    beforeEach(async () => {
      // 准备两个账号配置，一个有凭证，一个无凭证
      await fs.writeFile(
        path.join(profilesDir, 'user_authed.json'),
        JSON.stringify({
          cookie: 'DedeUserID=10001; SESSDATA=valid_token',
          mid: 10001,
        }),
      );
      await fs.writeFile(
        path.join(profilesDir, 'user_anon.json'),
        JSON.stringify({
          cookie: '',
          mid: 10002,
        }),
      );
    });

    it('should create all clients when no filter predicate is provided', async () => {
      const clients = await ConfigManager.fromProfiles(undefined, { profilesDir });
      expect(clients.length).toBe(2);
    });

    it('should filter clients using predicate (isRequestLogin)', async () => {
      // 仅加载有登录凭证的客户端
      const authedClients = await ConfigManager.fromProfiles(
        (_user, isRequestLogin) => isRequestLogin,
        { profilesDir },
      );
      expect(authedClients.length).toBe(1);
      expect(authedClients[0].userId).toBe('10001');
    });

    it('should filter clients by user ID', async () => {
      const clients = await ConfigManager.fromProfiles(
        (user) => user.userId === 'user_anon',
        { profilesDir },
      );
      expect(clients.length).toBe(1);
      expect(clients[0].userId).toBe('10002');
    });

    it('should work via BiliClient.fromProfiles alias', async () => {
      const clients = await BiliClient.fromProfiles(
        (user) => user.userId === 'user_authed',
        { profilesDir },
      );
      expect(clients.length).toBe(1);
      expect(clients[0].userId).toBe('10001');
    });
  });

  describe('Legacy Config Migration', () => {
    it('should auto-detect and migrate legacy config if present', async () => {
      const legacyPath = path.join(tempDir, 'bili-config.json');
      await fs.writeFile(
        legacyPath,
        JSON.stringify({
          cookie: 'DedeUserID=778899; SESSDATA=sess',
          mid: 778899,
        }),
      );

      // 覆盖静态路径测试迁移
      const originalLegacy = ConfigManager.LEGACY_CONFIG_PATH;
      const originalProfiles = ConfigManager.DEFAULT_PROFILES_DIR;
      (ConfigManager as any).LEGACY_CONFIG_PATH = legacyPath;
      (ConfigManager as any).DEFAULT_PROFILES_DIR = profilesDir;

      try {
        const config = new ConfigManager();
        await config.load();

        // 验证已自动迁移到 profiles/778899.json
        expect(config.getConfigPath()).toBe(path.resolve(profilesDir, '778899.json'));
        expect(config.data.mid).toBe(778899);

        // 验证磁盘上的文件存在
        const migratedContent = await fs.readFile(path.resolve(profilesDir, '778899.json'), 'utf-8');
        expect(migratedContent).toContain('778899');
      } finally {
        (ConfigManager as any).LEGACY_CONFIG_PATH = originalLegacy;
        (ConfigManager as any).DEFAULT_PROFILES_DIR = originalProfiles;
      }
    });
  });
});
