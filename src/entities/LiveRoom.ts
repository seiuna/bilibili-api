import { BaseEntity } from './BaseEntity.js';
import { assertOk } from '../core/client.js';
import type { LiveRoomInfo } from '../api/live.js';
import { LiveAPI } from '../api/live.js';
import { MutedListEntity } from './MutedListEntity.js';

/**
 * 直播间实体
 *
 * 原始数据类型见 {@link LiveRoomInfo}。
 */
export class LiveRoom extends BaseEntity<LiveRoomInfo> {
  get roomId(): number { return this.rawData.room_id; }
  get shortId(): number { return this.rawData.short_id; }
  get uid(): number { return this.rawData.uid; }
  get title(): string { return this.rawData.title; }
  get description(): string { return this.rawData.description; }
  get online(): number { return this.rawData.online; }
  get attention(): number { return this.rawData.attention; }
  get liveStatus(): number { return this.rawData.live_status; }
  get areaId(): number { return this.rawData.area_id; }
  get areaName(): string { return this.rawData.area_name; }
  get parentAreaId(): number { return this.rawData.parent_area_id; }
  get parentAreaName(): string { return this.rawData.parent_area_name; }
  get userCover(): string { return this.rawData.user_cover; }
  get keyframe(): string { return this.rawData.keyframe; }
  get liveTime(): string { return this.rawData.live_time; }
  get tags(): string { return this.rawData.tags; }

  /** 更新直播间信息 */
  async update(options: { title?: string; areaId?: number; addTag?: string; delTag?: string }): Promise<void> {
    const res = await LiveAPI.updateRoom(this.client, this.roomId, options);
    assertOk(res);
  }

  /** 禁言用户 */
  async banUser(tuid: number, hour = -1, msg?: string): Promise<void> {
    const res = await LiveAPI.banUser(this.client, this.roomId, tuid, hour, msg);
    assertOk(res);
  }

  /** 获取禁言用户列表 */
  async getMutedList(ps = 1): Promise<MutedListEntity> {
    const res = await LiveAPI.getMutedList(this.client, this.roomId, ps);
    return new MutedListEntity(this.client, res.data);
  }

  /** 解禁用户 */
  async unbanUser(id: number): Promise<void> {
    const res = await LiveAPI.unbanUser(this.client, this.roomId, id);
    assertOk(res);
  }
}
