import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { CommonAPI } from '../../api/common.js';

const IMAGE_URL = 'http://i0.hdslb.com/bfs/new_dyn/6693f9f72aab5ccff71ed442258f476d390794259.jpg';
const client = new BiliClient<void>();

describe('Common Unlogin Test', () => {
  it('CommonAPI.getServerTimestamp 应从 B 站服务器获取秒级时间戳', async () => {
    const serverTimestamp = await CommonAPI.getServerTimestamp(client);
    const localTimestamp = Math.floor(Date.now() / 1000);

    expect(Number.isSafeInteger(serverTimestamp)).toBe(true);
    expect(Math.abs(serverTimestamp - localTimestamp)).toBeLessThan(300);
  });

  it('CommonAPI.getCurrentTimestamp 应返回本地秒级时间戳', () => {
    const before = Math.floor(Date.now() / 1000);
    const timestamp = CommonAPI.getCurrentTimestamp();
    const after = Math.floor(Date.now() / 1000);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('CommonAPI.av2bv 与 bv2av 算法应双向精确转换', () => {
    expect(CommonAPI.av2bv(80433022)).toBe('BV1GJ411x7h7');
    expect(CommonAPI.bv2av('BV1GJ411x7h7')).toBe(80433022);

    expect(CommonAPI.av2bv(170001)).toBe('BV17x411w7KC');
    expect(CommonAPI.bv2av('BV17x411w7KC')).toBe(170001);
  });

  it('CommonAPI.formatImageUrl 应正确拼接 CDN 缩放格式化参数', () => {
    const formatted = CommonAPI.formatImageUrl(IMAGE_URL, {
      width: 100,
      height: 80,
      quality: 90,
      crop: 2,
      format: 'webp',
    });

    expect(formatted).toBe(`${IMAGE_URL}@100w_80h_90q_2c.webp`);
  });

  it('CommonAPI.getImageAvgColor 应从 B 站 CDN 获取图片主色', async () => {
    const color = await CommonAPI.getImageAvgColor(client, IMAGE_URL);

    expect(color).toBe('#1f1b1d');
  });
});
