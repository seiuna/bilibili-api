import { BaseEntity } from './BaseEntity.js';
import { assertOk } from '../core/client.js';
import type { FavoriteFolderData } from '../api/favorite.js';
import { FavoriteAPI } from '../api/favorite.js';
import { FavoriteMediaPageEntity } from './FavoriteMediaPageEntity.js';
import { FavoriteMediaEntity } from './FavoriteMediaEntity.js';

/**
 * 收藏夹实体
 *
 * 原始数据类型见 {@link FavoriteFolderData}。
 */
export class FavoriteFolder extends BaseEntity<FavoriteFolderData> {
  get id(): number { return this.rawData.id; }
  get fid(): number { return this.rawData.fid; }
  get mid(): number { return this.rawData.mid; }
  get title(): string { return this.rawData.title; }
  get cover(): string { return this.rawData.cover; }
  get intro(): string { return this.rawData.intro; }
  get mediaCount(): number { return this.rawData.media_count; }
  get cntInfo(): FavoriteFolderData['cnt_info'] { return this.rawData.cnt_info; }
  get upper(): FavoriteFolderData['upper'] { return this.rawData.upper; }

  /** 获取收藏夹内容列表（单页） */
  async getMedias(ps = 20, pn = 1): Promise<FavoriteMediaPageEntity> {
    const res = await FavoriteAPI.getFolderList(this.client, this.id, ps, pn);
    return new FavoriteMediaPageEntity(this.client, {
      medias: res.data.medias,
      hasMore: res.data.has_more,
    });
  }

  /** 收藏夹内容翻页 — async generator */
  async *medias(ps = 20): AsyncGenerator<FavoriteMediaEntity> {
    for await (const item of FavoriteAPI.folderList(this.client, this.id, ps)) {
      yield new FavoriteMediaEntity(this.client, item);
    }
  }

  /** 修改收藏夹 */
  async edit(title: string, intro = '', privacy: 0 | 1 = 0, cover = ''): Promise<void> {
    const res = await FavoriteAPI.editFolder(this.client, this.id, title, intro, privacy, cover);
    assertOk(res);
  }

  /** 删除收藏夹 */
  async delete(): Promise<void> {
    const res = await FavoriteAPI.deleteFolder(this.client, [this.id]);
    assertOk(res);
  }

  /** 批量删除内容 */
  async deleteResources(resources: string): Promise<void> {
    const res = await FavoriteAPI.deleteResources(this.client, this.id, resources);
    assertOk(res);
  }

  /** 清空失效内容 */
  async cleanInvalid(): Promise<void> {
    const res = await FavoriteAPI.cleanInvalidResources(this.client, this.id);
    assertOk(res);
  }
}
