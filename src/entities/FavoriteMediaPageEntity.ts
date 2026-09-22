import { BaseEntity } from './BaseEntity.js';
import type { FavoriteMedia } from '../api/favorite.js';
import { FavoriteMediaEntity } from './FavoriteMediaEntity.js';

/**
 * 收藏夹内容分页数据
 *
 * 实体包装见 {@link FavoriteMediaPageEntity}。
 */
export interface FavoriteMediaPageData {
  medias: FavoriteMedia[] | null;
  hasMore: boolean;
}

/**
 * 收藏夹内容分页实体
 *
 * 原始数据类型见 {@link FavoriteMediaPageData}。
 */
export class FavoriteMediaPageEntity extends BaseEntity<FavoriteMediaPageData> {
  get hasMore(): boolean { return this.rawData.hasMore; }

  get medias(): FavoriteMediaEntity[] | null {
    if (this.rawData.medias === null) return null;
    return this.rawData.medias.map((media) => new FavoriteMediaEntity(this.client, media));
  }
}
