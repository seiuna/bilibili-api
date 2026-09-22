import { BaseEntity } from './BaseEntity.js';
import type { NavNum } from '../api/user.js';

/**
 * 用户导航栏状态数实体
 *
 * 原始数据类型见 {@link NavNum}。
 */
export class NavNumEntity extends BaseEntity<NavNum> {
  get video(): number { return this.rawData.video; }
  get bangumi(): number { return this.rawData.bangumi; }
  get cinema(): number { return this.rawData.cinema; }
  get channel(): NavNum['channel'] { return this.rawData.channel; }
  get favourite(): number { return this.rawData.favourite; }
  get tag(): number { return this.rawData.tag; }
  get article(): number { return this.rawData.article; }
  get playlist(): number { return this.rawData.playlist; }
  get album(): number { return this.rawData.album; }
  get audio(): number { return this.rawData.audio; }
  get pugv(): number { return this.rawData.pugv; }
}
