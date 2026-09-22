import { BaseEntity } from './BaseEntity.js';
import type { MedalWallItem } from '../api/user.js';

/**
 * 粉丝勋章墙单条实体
 *
 * 原始数据类型见 {@link MedalWallItem}。
 */
export class MedalWallItemEntity extends BaseEntity<MedalWallItem> {
  get medalInfo(): MedalWallItem['medal_info'] { return this.rawData.medal_info; }
  get targetName(): string { return this.rawData.target_name; }
  get targetIcon(): string { return this.rawData.target_icon; }
  get link(): string { return this.rawData.link; }
  get liveStatus(): number { return this.rawData.live_status; }
}
