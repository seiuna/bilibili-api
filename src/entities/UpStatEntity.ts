import { BaseEntity } from './BaseEntity.js';
import type { UpStat } from '../api/user.js';

/**
 * UP 主状态数实体
 *
 * 原始数据类型见 {@link UpStat}。
 */
export class UpStatEntity extends BaseEntity<UpStat> {
  get archive(): UpStat['archive'] { return this.rawData.archive; }
  get article(): UpStat['article'] { return this.rawData.article; }
  get likes(): number { return this.rawData.likes; }
}
