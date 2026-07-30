import { BaseEntity } from './BaseEntity.js';
import type { FavoriteFolder as FavoriteFolderData, FavoriteMedia } from '../api/favorite.js';
import { FavoriteAPI } from '../api/favorite.js';

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

  /** 获取收藏夹内容列表 */
  async getMedias(ps = 20, pn = 1): Promise<{ medias: FavoriteMedia[] | null; hasMore: boolean }> {
    const res = await FavoriteAPI.getFolderList(this.client, this.id, ps, pn);
    return { medias: res.data.medias, hasMore: res.data.has_more };
  }

  /** 修改收藏夹 */
  async edit(title: string, intro = '', privacy: 0 | 1 = 0, cover = ''): Promise<void> {
    await FavoriteAPI.editFolder(this.client, this.id, title, intro, privacy, cover);
  }

  /** 删除收藏夹 */
  async delete(): Promise<void> {
    await FavoriteAPI.deleteFolder(this.client, [this.id]);
  }

  /** 批量删除内容 */
  async deleteResources(resources: string): Promise<void> {
    await FavoriteAPI.deleteResources(this.client, this.id, resources);
  }

  /** 清空失效内容 */
  async cleanInvalid(): Promise<void> {
    await FavoriteAPI.cleanInvalidResources(this.client, this.id);
  }
}