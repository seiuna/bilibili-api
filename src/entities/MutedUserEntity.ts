import { BaseEntity } from './BaseEntity.js';
import type { MutedUserItem } from '../api/live.js';

/**
 * 直播间禁言用户实体
 *
 * 原始数据类型见 {@link MutedUserItem}。
 */
export class MutedUserEntity extends BaseEntity<MutedUserItem> {
  get tuid(): number { return this.rawData.tuid; }
  get tname(): string { return this.rawData.tname; }
  get uid(): number { return this.rawData.uid; }
  get name(): string { return this.rawData.name; }
  get ctime(): number { return this.rawData.ctime; }
  get id(): number { return this.rawData.id; }
  get isAnchor(): number { return this.rawData.is_anchor; }
  get face(): string { return this.rawData.face; }
  get adminLevel(): number { return this.rawData.admin_level; }
}
