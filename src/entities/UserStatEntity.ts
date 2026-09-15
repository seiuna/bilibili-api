import { BaseEntity } from './BaseEntity.js';
import type { UserStat } from '../api/user.js';

/**
 * 用户状态数实体
 *
 * 原始数据类型见 {@link UserStat}。
 */
export class UserStatEntity extends BaseEntity<UserStat> {
  get mid(): number { return this.rawData.mid; }
  get following(): number { return this.rawData.following; }
  get whisper(): number { return this.rawData.whisper; }
  get black(): number { return this.rawData.black; }
  get follower(): number { return this.rawData.follower; }
}
