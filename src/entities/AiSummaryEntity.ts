import { BaseEntity } from './BaseEntity.js';
import type { AiSummary } from '../api/video.js';

/**
 * 视频 AI 摘要实体（总结大纲与字幕分段）
 *
 * 原始数据类型见 {@link AiSummary}。
 */
export class AiSummaryEntity extends BaseEntity<AiSummary> {
  get code(): number { return this.rawData.code; }
  get stid(): string { return this.rawData.stid; }
  get likeNum(): number { return this.rawData.like_num; }
  get dislikeNum(): number { return this.rawData.dislike_num; }
  get modelResult(): AiSummary['model_result'] { return this.rawData.model_result; }
}
