import { BaseEntity } from './BaseEntity.js';
import type { FavoriteMedia } from '../api/favorite.js';

/**
 * 收藏夹内容条目实体
 *
 * 原始数据类型见 {@link FavoriteMedia}。
 */
export class FavoriteMediaEntity extends BaseEntity<FavoriteMedia> {
  get id(): number { return this.rawData.id; }
  get type(): number { return this.rawData.type; }
  get title(): string { return this.rawData.title; }
  get cover(): string { return this.rawData.cover; }
  get intro(): string { return this.rawData.intro; }
  get page(): number { return this.rawData.page; }
  get duration(): number { return this.rawData.duration; }
  get attr(): number { return this.rawData.attr; }
  get link(): string { return this.rawData.link; }
  get ctime(): number { return this.rawData.ctime; }
  get pubtime(): number { return this.rawData.pubtime; }
  get favTime(): number { return this.rawData.fav_time; }
  get bvid(): string { return this.rawData.bvid; }

  get upper(): FavoriteMedia['upper'] { return this.rawData.upper; }
  get cntInfo(): FavoriteMedia['cnt_info'] { return this.rawData.cnt_info; }
  get season(): FavoriteMedia['season'] { return this.rawData.season; }
}
