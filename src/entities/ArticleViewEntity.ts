import { BaseEntity } from './BaseEntity.js';
import type { ArticleView } from '../api/article.js';

/**
 * 专栏正文实体
 *
 * 原始数据类型见 {@link ArticleView}。
 */
export class ArticleViewEntity extends BaseEntity<ArticleView> {
  get id(): number { return this.rawData.id; }
  get title(): string { return this.rawData.title; }
  get content(): string { return this.rawData.content; }
  get summary(): string { return this.rawData.summary; }
  get bannerUrl(): string { return this.rawData.banner_url; }
  get imageUrls(): string[] { return this.rawData.image_urls; }
  get originImageUrls(): string[] { return this.rawData.origin_image_urls; }
  get original(): number { return this.rawData.original; }
  get reprint(): number { return this.rawData.reprint; }
  get publishTime(): number { return this.rawData.publish_time; }
  get ctime(): number { return this.rawData.ctime; }
  get mtime(): number { return this.rawData.mtime; }
  get words(): number { return this.rawData.words; }
  get type(): number { return this.rawData.type; }
  get coverAvid(): number | undefined { return this.rawData.cover_avid; }
  get dynIdStr(): string | undefined { return this.rawData.dyn_id_str; }

  get author(): ArticleView['author'] { return this.rawData.author; }
  get categories(): ArticleView['categories'] { return this.rawData.categories; }
  get category(): ArticleView['category'] { return this.rawData.category; }
  get list(): ArticleView['list'] { return this.rawData.list; }
  get stats(): ArticleView['stats'] { return this.rawData.stats; }
  get tags(): ArticleView['tags'] { return this.rawData.tags; }
  get opus(): ArticleView['opus'] { return this.rawData.opus; }
}
