import { BaseEntity } from './BaseEntity.js';
import type { VideoTag } from '../api/video.js';

/**
 * 视频 TAG 实体
 *
 * 原始数据类型见 {@link VideoTag}。
 */
export class VideoTagEntity extends BaseEntity<VideoTag> {
  get tagId(): number { return this.rawData.tag_id; }
  get tagName(): string { return this.rawData.tag_name; }
  get musicId(): string | undefined { return this.rawData.music_id; }
  get tagType(): string | undefined { return this.rawData.tag_type; }
  get jumpUrl(): string | undefined { return this.rawData.jump_url; }
}
