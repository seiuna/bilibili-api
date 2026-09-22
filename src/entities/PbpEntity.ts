import { BaseEntity } from './BaseEntity.js';
import type { PbpData } from '../api/video.js';

/**
 * 高能进度条数据实体
 *
 * 原始数据类型见 {@link PbpData}。
 */
export class PbpEntity extends BaseEntity<PbpData> {
  get stepSec(): number { return this.rawData.step_sec; }
  get tagstr(): string { return this.rawData.tagstr; }
  get events(): PbpData['events'] { return this.rawData.events; }
  get debug(): string { return this.rawData.debug; }
}
