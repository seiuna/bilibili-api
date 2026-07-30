import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface FavoriteFolder {
  id: number;
  fid: number;
  mid: number;
  attr: number;
  title: string;
  cover: string;
  upper: { mid: number; name: string; face: string; followed: boolean; vip_type: number; vip_statue: number };
  cover_type: number;
  cnt_info: { collect: number; play: number; thumb_up: number; share: number };
  type: number;
  intro: string;
  ctime: number;
  mtime: number;
  state: number;
  fav_state: number;
  like_state: number;
  media_count: number;
}

export interface FavoriteFolderListItem {
  id: number;
  fid: number;
  mid: number;
  attr: number;
  title: string;
  fav_state: number;
  media_count: number;
}

export interface FavoriteMedia {
  id: number;
  type: number;
  title: string;
  cover: string;
  intro: string;
  page: number;
  duration: number;
  upper: { mid: number; name: string; face: string };
  attr: number;
  cnt_info: { collect: number; play: number; danmaku: number };
  link: string;
  ctime: number;
  pubtime: number;
  fav_time: number;
  bvid: string;
  season: unknown;
}

export interface FavoriteListData {
  info: FavoriteFolder;
  medias: FavoriteMedia[] | null;
  has_more: boolean;
}

export class FavoriteAPI {
  /** 获取收藏夹元数据 */
  static async getFolderInfo(
    client: BiliClient<any>,
    mediaId: number,
  ): Promise<BiliApiResponse<FavoriteFolder>> {
    return client.request(`https://api.bilibili.com/x/v3/fav/folder/info?media_id=${mediaId}`);
  }

  /** 获取指定用户创建的所有收藏夹 */
  static async getCreatedFolders(
    client: BiliClient<any>,
    upMid: number,
    type: 0 | 2 = 0,
    rid?: number,
  ): Promise<BiliApiResponse<{ count: number; list: FavoriteFolderListItem[] }>> {
    const params = new URLSearchParams({ up_mid: String(upMid), type: String(type) });
    if (rid) params.set('rid', String(rid));
    return client.request(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?${params}`);
  }

  /** 获取收藏夹内容列�?*/
  static async getFolderList(
    client: BiliClient<any>,
    mediaId: number,
    ps = 20,
    pn = 1,
  ): Promise<BiliApiResponse<FavoriteListData>> {
    return client.request(
      `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&ps=${ps}&pn=${pn}`,
    );
  }

  /** 新建收藏�?*/
  static async createFolder(
    client: BiliClient<any>,
    title: string,
    intro = '',
    privacy: 0 | 1 = 0,
    cover = '',
  ): Promise<BiliApiResponse<FavoriteFolder>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/folder/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title, intro, privacy: String(privacy), cover, csrf }).toString(),
    });
  }

  /** 修改收藏�?*/
  static async editFolder(
    client: BiliClient<any>,
    mediaId: number,
    title: string,
    intro = '',
    privacy: 0 | 1 = 0,
    cover = '',
  ): Promise<BiliApiResponse<FavoriteFolder>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/folder/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_id: String(mediaId), title, intro, privacy: String(privacy), cover, csrf,
      }).toString(),
    });
  }

  /** 删除收藏�?*/
  static async deleteFolder(
    client: BiliClient<any>,
    mediaIds: number[],
  ): Promise<BiliApiResponse<number>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/folder/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ media_ids: mediaIds.join(','), csrf }).toString(),
    });
  }

  /** 批量复制内容 */
  static async copyResources(
    client: BiliClient<any>,
    srcMediaId: number,
    tarMediaId: number,
    mid: number,
    resources: string,
  ): Promise<BiliApiResponse<number>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/resource/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        src_media_id: String(srcMediaId), tar_media_id: String(tarMediaId),
        mid: String(mid), resources, platform: 'web', csrf,
      }).toString(),
    });
  }

  /** 批量移动内容 */
  static async moveResources(
    client: BiliClient<any>,
    srcMediaId: number,
    tarMediaId: number,
    mid: number,
    resources: string,
  ): Promise<BiliApiResponse<number>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/resource/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        src_media_id: String(srcMediaId), tar_media_id: String(tarMediaId),
        mid: String(mid), resources, platform: 'web', csrf,
      }).toString(),
    });
  }

  /** 批量删除内容 */
  static async deleteResources(
    client: BiliClient<any>,
    mediaId: number,
    resources: string,
  ): Promise<BiliApiResponse<number>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/resource/batch-del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ resources, media_id: String(mediaId), platform: 'web', csrf }).toString(),
    });
  }

  /** 清空失效内容 */
  static async cleanInvalidResources(
    client: BiliClient<any>,
    mediaId: number,
  ): Promise<BiliApiResponse<number>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v3/fav/resource/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ media_id: String(mediaId), csrf }).toString(),
    });
  }
}
