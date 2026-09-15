import { BaseEntity } from './BaseEntity.js';
import type { RecommendVideo } from '../api/video.js';

/**
 * 相关推荐视频实体
 *
 * 原始数据类型见 {@link RecommendVideo}。
 */
export class RecommendVideoEntity extends BaseEntity<RecommendVideo> {
  get aid(): number { return this.rawData.aid; }
  get bvid(): string { return this.rawData.bvid; }
  get title(): string { return this.rawData.title; }
  get pic(): string { return this.rawData.pic; }
  get tid(): number { return this.rawData.tid; }
  get tname(): string { return this.rawData.tname; }
  get copyright(): number { return this.rawData.copyright; }
  get duration(): number { return this.rawData.duration; }
  get owner(): RecommendVideo['owner'] { return this.rawData.owner; }
  get stat(): RecommendVideo['stat'] { return this.rawData.stat; }
  get cid(): number { return this.rawData.cid; }
  get dimension(): RecommendVideo['dimension'] { return this.rawData.dimension; }
}
