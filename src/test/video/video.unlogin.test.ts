import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { VideoAPI } from '../../api/video.js';
import { Video } from '../../entities/Video.js';

const BVID = 'BV1GJ411x7h7';
const AID = 80433022;
const CID = 137649199;
const TITLE = '【官方 MV】Never Gonna Give You Up - Rick Astley';
const OWNER_MID = 486906719;
const OWNER_NAME = '索尼音乐中国';

const client = new BiliClient<void>();

describe('Video Unlogin Test', () => {
  it('VideoAPI.getInfo 应返回目标视频信息', async () => {
    const info = await VideoAPI.getInfo(client, BVID);

    expect(info.code).toBe(0);
    expect(info.data.bvid).toBe(BVID);
    expect(info.data.aid).toBe(AID);
    expect(info.data.cid).toBe(CID);
    expect(info.data.title).toBe(TITLE);
    expect(info.data.owner.mid).toBe(OWNER_MID);
    expect(info.data.owner.name).toBe(OWNER_NAME);
  });

  it('VideoAPI.getInfoByAid 应通过 AID 获取相同视频信息', async () => {
    const byAid = await VideoAPI.getInfoByAid(client, AID);

    expect(byAid.code).toBe(0);
    expect(byAid.data.bvid).toBe(BVID);
    expect(byAid.data.aid).toBe(AID);
    expect(byAid.data.title).toBe(TITLE);
  });

  it('VideoAPI.getRecommend 应返回相关推荐视频列表', async () => {
    const recommend = await VideoAPI.getRecommend(client, AID, BVID);

    expect(recommend.code).toBe(0);
    expect(Array.isArray(recommend.data)).toBe(true);
    expect(recommend.data.length).toBeGreaterThan(0);
    expect(recommend.data[0].bvid).toMatch(/^BV/);
  });

  it('VideoAPI.getTags 应返回包含目标标签的视频 TAG 列表', async () => {
    const tags = await VideoAPI.getTags(client, AID, BVID);

    expect(tags.code).toBe(0);
    expect(Array.isArray(tags.data)).toBe(true);
    expect(tags.data.some((t) => t.tag_name === 'Never Gonna Give You Up')).toBe(true);
  });

  it('client.getVideo 应返回包装后的 Video 实体并正确绑定评论区', async () => {
    const video = await client.getVideo(BVID);

    expect(video).toBeInstanceOf(Video);
    expect(video.bvid).toBe(BVID);
    expect(video.aid).toBe(AID);
    expect(video.cid).toBe(CID);
    expect(video.title).toBe(TITLE);
    expect(video.owner.name).toBe(OWNER_NAME);

    const commentArea = video.commentArea();
    expect(commentArea.getOid).toBe(AID);
    expect(commentArea.getReplyType).toBe(1);
  });
});
