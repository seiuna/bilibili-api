import { BaseEntity } from './BaseEntity.js';
import type { VideoSnapshot } from '../api/video.js';

/**
 * 视频快照实体（高能进度条预览图的拼图信息）
 *
 * 原始数据类型见 {@link VideoSnapshot}。
 */
export class VideoSnapshotEntity extends BaseEntity<VideoSnapshot> {
  get pvdata(): string { return this.rawData.pvdata; }
  get imgXLen(): number { return this.rawData.img_x_len; }
  get imgYLen(): number { return this.rawData.img_y_len; }
  get imgXSize(): number { return this.rawData.img_x_size; }
  get imgYSize(): number { return this.rawData.img_y_size; }
  get image(): string[] { return this.rawData.image; }
  get index(): number[] { return this.rawData.index; }
}
