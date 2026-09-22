import { BaseEntity } from './BaseEntity.js';
import type { VideoStat } from '../api/video.js';

/**
 * 视频状态数实体（播放、弹幕、点赞、投币、收藏等统计）
 *
 * 原始数据类型见 {@link VideoStat}。
 */
export class VideoStatEntity extends BaseEntity<VideoStat> {
  get aid(): number { return this.rawData.aid; }
  get bvid(): string { return this.rawData.bvid; }
  get view(): number { return this.rawData.view; }
  get danmaku(): number { return this.rawData.danmaku; }
  get reply(): number { return this.rawData.reply; }
  get favorite(): number { return this.rawData.favorite; }
  get coin(): number { return this.rawData.coin; }
  get share(): number { return this.rawData.share; }
  get nowRank(): number { return this.rawData.now_rank; }
  get hisRank(): number { return this.rawData.his_rank; }
  get like(): number { return this.rawData.like; }
  get dislike(): number { return this.rawData.dislike; }
  get noReprint(): number { return this.rawData.no_reprint; }
  get copyright(): number { return this.rawData.copyright; }
  get argueMsg(): string { return this.rawData.argue_msg; }
  get evaluation(): string { return this.rawData.evaluation; }
}
