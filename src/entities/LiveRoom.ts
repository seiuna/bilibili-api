import { BaseEntity } from './BaseEntity.js';
import type { LiveRoomInfo, MutedUserItem } from '../api/live.js';
import { LiveAPI } from '../api/live.js';

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
    await LiveAPI.updateRoom(this.client, this.roomId, options);
  }

  /** 禁言用户 */
  async banUser(tuid: number, hour = -1, msg?: string): Promise<void> {
    await LiveAPI.banUser(this.client, this.roomId, tuid, hour, msg);
  }

  /** 获取禁言用户列表 */
  async getMutedList(ps = 1): Promise<{ data: MutedUserItem[]; total: number; total_page: number }> {
    const res = await LiveAPI.getMutedList(this.client, this.roomId, ps);
    return res.data;
  }

  /** 解禁用户 */
  async unbanUser(id: number): Promise<void> {
    await LiveAPI.unbanUser(this.client, this.roomId, id);
  }
}