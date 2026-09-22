import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { LiveAPI } from '../../api/live.js';
import { LiveRoom } from '../../entities/LiveRoom.js';

const SHORT_ROOM_ID = 6;
const LONG_ROOM_ID = 7734200;
const ANCHOR_UID = 50329118;

const client = new BiliClient<void>();

describe('Live Unlogin Test', () => {
  it('LiveAPI.getRoomInfo 应解析公开直播间短号并返回房间信息', async () => {
    const res = await LiveAPI.getRoomInfo(client, SHORT_ROOM_ID);

    expect(res.code).toBe(0);
    expect(res.data.short_id).toBe(SHORT_ROOM_ID);
    expect(res.data.room_id).toBe(LONG_ROOM_ID);
    expect(res.data.uid).toBe(ANCHOR_UID);
    expect(typeof res.data.title).toBe('string');
    expect(typeof res.data.live_status).toBe('number');
  });

  it('client.getLiveRoom 应返回 LiveRoom 实体并映射房间属性', async () => {
    const room = await client.getLiveRoom(SHORT_ROOM_ID);

    expect(room).toBeInstanceOf(LiveRoom);
    expect(room.shortId).toBe(SHORT_ROOM_ID);
    expect(room.roomId).toBe(LONG_ROOM_ID);
    expect(room.uid).toBe(ANCHOR_UID);
    expect(typeof room.title).toBe('string');
    expect(typeof room.liveStatus).toBe('number');
  });
});
