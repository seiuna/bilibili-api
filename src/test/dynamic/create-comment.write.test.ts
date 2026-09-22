import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BiliClient, assertOk } from '../../core/client.js';
import { UserAPI } from '../../api/user.js';
import { DynamicAPI } from '../../api/dynamic.js';
import { CommentAPI, ReplyType } from '../../api/comment.js';
import { setTimeout as sleep } from 'node:timers/promises'

// REAL PUBLIC WRITES. Never included in default/login tests. No mocks or test-level retries.
// The SDK may still refresh credentials and replay a request after a -101 response.
describe('Create a dynamic and comment on it (real writes)', () => {
  let client: BiliClient;
  let ownerMid: string;
  let createdId: string | undefined;

  beforeAll(async () => {
    if (process.env.ENABLE_WRITE_TESTS !== '1') {
      throw new Error('真实写操作测试需要 ENABLE_WRITE_TESTS=1；将发布动态、评论并尝试删除测试动态。');
    }
    const profile = process.env.BILI_TEST_PROFILE;
    if (!profile) throw new Error('必须显式指定 BILI_TEST_PROFILE；不会自动探测账号或扫码登录。');
    client = new BiliClient(profile);
    await access(client.config.getConfigPath());
    await client.config.load();
    if (!/(?:^|;\s*)SESSDATA=[^;]+/.test(client.config.data.cookie)) {
      throw new Error('指定 Profile 缺少 SESSDATA。');
    }
    const mid = client.userId;
    if (!mid || !/^[1-9]\d*$/.test(mid)) throw new Error('指定 Profile 缺少可靠的账号 UID。');
    ownerMid = mid;
    expect(client.config.getCsrf().length).toBeGreaterThan(0);
    const nav = assertOk(await UserAPI.getNavInfo(client));
    expect(nav.data.isLogin).toBe(true);
    expect(String(nav.data.mid)).toBe(ownerMid);
  });

  afterAll(async () => {
    // Only delete the exact ID returned by this test's create request.
    // Cleanup also runs when a later assertion or comment request fails.
    if (!createdId) return;
    try {
      assertOk(await DynamicAPI.delete(client, createdId));
    } catch (cause) {
      throw new Error(`测试动态清理失败，请手动删除：https://t.bilibili.com/${createdId}`, { cause });
    }
  });

  it('creates a text dynamic, posts a root comment, and reads the exact comment back', async () => {
    const marker = randomUUID();
    const content = `SDK integration test ${marker} 自动化测试动态，将在测试结束后删除。`;
    const message = `SDK integration test ${marker} 自动化测试评论。`;

    const created = assertOk(await DynamicAPI.create(client, {
      content,
      closeComment: false,
      upChooseComment: false,
    }));
    // Capture before later assertions so teardown can still clean up.
    if (typeof created.data?.dyn_id_str === 'string' && /^[1-9]\d*$/.test(created.data.dyn_id_str)) {
      createdId = created.data.dyn_id_str;
      console.info(`本次测试创建的动态：https://t.bilibili.com/opus/${createdId}`);
    }
    expect(createdId, '创建响应必须提供精确的 dyn_id_str；缺失时请检查账号并手动清理').toBeDefined();
    const dynamicId = createdId!;
    await sleep(1000)
    const detail = assertOk(await DynamicAPI.getDetail(client, dynamicId));
    expect(detail.data.item.id_str).toBe(dynamicId);
    expect(detail.data.item.basic.comment_type).toBe(ReplyType.DYNAMIC);
    expect(detail.data.item.id_str).toBe(dynamicId);
    await sleep(1000)
    const added = assertOk(await CommentAPI.add(client, detail.data.item.basic.comment_id_str, message, ReplyType.DYNAMIC));
    expect(added.data.need_captcha).toBe(false);
    expect(added.data.rpid_str).toMatch(/^[1-9]\d*$/);
    await sleep(2000)
    const reply = assertOk(await CommentAPI.getReply(client, detail.data.item.basic.comment_id_str, ReplyType.DYNAMIC, added.data.rpid_str));
    if (!reply.data) throw new Error(`jump 响应未找到目标评论 ${added.data.rpid_str}`);
    expect(reply.data.content.message.trim()).toBe(message.trim());
    expect(String(reply.data.mid)).toBe(ownerMid);
    expect(reply.data.type).toBe(ReplyType.DYNAMIC);
    expect(reply.data.root).toBe(0);
    expect(reply.data.parent).toBe(0);
    // Do not convert the server's string dynamic/comment IDs to Number.
  });
});
