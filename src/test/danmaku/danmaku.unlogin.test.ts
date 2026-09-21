import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { DanmakuAPI } from '../../api/danmaku.js';

const CID = 137649199;
const client = new BiliClient<void>();

describe('Danmaku Unlogin Test', () => {
  it('DanmakuAPI.getXmlDanmaku 应下载并返回指定 CID 的公开 XML 实时弹幕流', async () => {
    const xml = await DanmakuAPI.getXmlDanmaku(client, CID);

    expect(typeof xml).toBe('string');
    expect(xml.length).toBeGreaterThan(1000);
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml.includes('<i>')).toBe(true);
    expect(xml.includes('<d p=')).toBe(true);
  });
});
