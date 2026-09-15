import { BaseEntity } from './BaseEntity.js';
import type { OnlineCount } from '../api/video.js';

/**
 * 视频在线观看人数实体
 *
 * 原始数据类型见 {@link OnlineCount}。
 */
export class OnlineCountEntity extends BaseEntity<OnlineCount> {
  get total(): string { return this.rawData.total; }
  get count(): string { return this.rawData.count; }
  get showSwitch(): OnlineCount['show_switch'] { return this.rawData.show_switch; }
}
