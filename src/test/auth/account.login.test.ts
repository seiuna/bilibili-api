import { access } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { BiliClient, assertOk, type HasToken } from '../../core/client.js';
import { UserAPI } from '../../api/user.js';
import { MyInfoEntity } from '../../entities/MyInfoEntity.js';
import { NavInfoEntity } from '../../entities/NavInfoEntity.js';

// Real authenticated reads only. Never call ensureLogin, QR login or write APIs.
describe('Authenticated account (real network)', () => {
  let client: BiliClient<HasToken>;
  let expectedMid: string;
  let expectedName: string;

  beforeAll(async () => {
    const profile = process.env.BILI_TEST_PROFILE?.trim();
    if (!profile) {
      throw new Error('登录测试需要 BILI_TEST_PROFILE（已有 Profile 别名、UID 或配置文件路径）；不会自动扫码登录。');
    }
    const loaded = new BiliClient(profile);
    // Check existence first: ConfigManager.load otherwise creates an empty file.
    await access(loaded.config.getConfigPath());
    await loaded.config.load();
    if (!/(?:^|;\s*)SESSDATA=[^;]+/.test(loaded.config.data.cookie)) {
      throw new Error('指定 Profile 缺少 SESSDATA，请先在测试之外完成登录。');
    }
    const mid = loaded.userId;
    if (!mid || !/^[1-9]\d*$/.test(mid)) {
      throw new Error('指定 Profile 缺少有效的 DedeUserID / mid，无法验证账号身份。');
    }
    expectedMid = mid;
    // Use the production request path, including normal cookie/credential refresh.
    const nav = assertOk(await UserAPI.getNavInfo(loaded));
    expect(nav.data.isLogin).toBe(true);
    expect(String(nav.data.mid)).toBe(expectedMid);
    expect(nav.data.uname.length).toBeGreaterThan(0);
    expectedName = nav.data.uname;
    // Promote only after a real authenticated response has verified the account.
    client = loaded as unknown as BiliClient<HasToken>;
  });

  it('raw nav response identifies the selected account', async () => {
    const res = await UserAPI.getNavInfo(client);
    expect(res.code).toBe(0);
    expect(res.data.isLogin).toBe(true);
    expect(String(res.data.mid)).toBe(expectedMid);
    expect(res.data.uname).toBe(expectedName);
    expect(res.data.face).toMatch(/^https?:\/\//);
    expect(res.data.money).toBeGreaterThanOrEqual(0);
  });

  it('raw account info agrees with the authenticated nav identity', async () => {
    const res = await UserAPI.getMyInfo(client);
    expect(res.code).toBe(0);
    expect(String(res.data.mid)).toBe(expectedMid);
    expect(res.data.name).toBe(expectedName);
    expect(res.data.face).toMatch(/^https?:\/\//);
    expect(Number.isInteger(res.data.level)).toBe(true);
    expect(res.data.level).toBeGreaterThanOrEqual(0);
  });

  it('getNavInfo maps the authenticated account to NavInfoEntity', async () => {
    const nav = await client.getNavInfo();
    expect(nav).toBeInstanceOf(NavInfoEntity);
    expect(nav.isLogin).toBe(true);
    expect(String(nav.mid)).toBe(expectedMid);
    expect(nav.uname).toBe(expectedName);
    expect(nav.face).toMatch(/^https?:\/\//);
  });

  it('getMyInfo maps the authenticated account to MyInfoEntity', async () => {
    const info = await client.getMyInfo();
    expect(info).toBeInstanceOf(MyInfoEntity);
    expect(String(info.mid)).toBe(expectedMid);
    expect(info.name).toBe(expectedName);
    expect(info.face).toMatch(/^https?:\/\//);
  });
});
