import { BaseEntity } from './BaseEntity.js';
import type { PlayUrlData } from '../api/video.js';

/**
 * 视频播放地址实体（清晰度、分段 durl 与 DASH 流信息）
 *
 * 原始数据类型见 {@link PlayUrlData}。
 */
export class PlayUrlEntity extends BaseEntity<PlayUrlData> {
  get quality(): number { return this.rawData.quality; }
  get format(): string { return this.rawData.format; }
  get timelength(): number { return this.rawData.timelength; }
  get acceptFormat(): string { return this.rawData.accept_format; }
  get acceptDescription(): string[] { return this.rawData.accept_description; }
  get acceptQuality(): number[] { return this.rawData.accept_quality; }
  get durl(): PlayUrlData['durl'] { return this.rawData.durl; }
  get dash(): PlayUrlData['dash'] { return this.rawData.dash; }
  get supportFormats(): PlayUrlData['support_formats'] { return this.rawData.support_formats; }
  get lastPlayTime(): number | undefined { return this.rawData.last_play_time; }
  get lastPlayCid(): number | undefined { return this.rawData.last_play_cid; }
}
