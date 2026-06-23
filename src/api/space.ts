import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import type {
  TopArc,
  MasterpieceList,
  UserTags,
  SpaceNotice,
  SpaceSettings,
  TopPhotoItem,
  LastPlayGame,
} from './space-types.js';

interface AjaxResponse<T> {
  status: boolean;
  data: T | string;
}

export class SpaceAPI {
  constructor(private client: BiliClient) {}

  /** 查询用户置顶视频 */
  async topArc(vmid: number): Promise<BiliApiResponse<TopArc>> {
    return this.client.request(
      `https://api.bilibili.com/x/space/top/arc?vmid=${vmid}`,
    );
  }

  /** 设置置顶视频 */
  async setTopArc(
    id: string | number,
    reason?: string,
  ): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({ csrf });
    if (typeof id === 'string' && id.startsWith('BV')) {
      body.set('bvid', id);
    } else {
      body.set('aid', String(id));
    }
    if (reason) body.set('reason', reason);

    return this.client.request('https://api.bilibili.com/x/space/top/arc/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 取消置顶视频 */
  async cancelTopArc(): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    return this.client.request(
      'https://api.bilibili.com/x/space/top/arc/cancel',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf }).toString(),
      },
    );
  }

  // ---- 代表作视频 ----

  /** 查询用户代表作视频列表 */
  async masterpieces(vmid: number): Promise<BiliApiResponse<MasterpieceList>> {
    return this.client.request(
      `https://api.bilibili.com/x/space/masterpiece?vmid=${vmid}`,
    );
  }

  /** 添加代表作视频 */
  async addMasterpiece(
    id: string | number,
    reason?: string,
  ): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({ csrf });
    if (typeof id === 'string' && id.startsWith('BV')) {
      body.set('bvid', id);
    } else {
      body.set('aid', String(id));
    }
    if (reason) body.set('reason', reason);

    return this.client.request(
      'https://api.bilibili.com/x/space/masterpiece/add',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
  }

  /** 删除代表作视频 */
  async cancelMasterpiece(
    id: string | number,
  ): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({ csrf });
    if (typeof id === 'string' && id.startsWith('BV')) {
      body.set('bvid', id);
    } else {
      body.set('aid', String(id));
    }

    return this.client.request(
      'https://api.bilibili.com/x/space/masterpiece/cancel',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
  }

  // ---- 个人 TAG ----

  /** 查看用户个人 TAG */
  async tags(mid: number): Promise<BiliApiResponse<UserTags[]>> {
    return this.client.request(
      `https://api.bilibili.com/x/space/acc/tags?mid=${mid}`,
    );
  }

  /** 修改个人 TAG（各 TAG 用逗号分隔，最多 5 个，每个 < 10 字符） */
  async setTags(tags: string): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    return this.client.request(
      'https://api.bilibili.com/x/space/acc/tags/set',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tags, csrf }).toString(),
      },
    );
  }

  // ---- 空间公告 ----

  /** 查看用户空间公告 */
  async notice(mid: number): Promise<BiliApiResponse<SpaceNotice>> {
    return this.client.request(
      `https://api.bilibili.com/x/space/notice?mid=${mid}`,
    );
  }

  /** 修改空间公告（< 150 字符） */
  async setNotice(notice: string): Promise<BiliApiResponse<null>> {
    const csrf = this.extractCsrf();
    return this.client.request(
      'https://api.bilibili.com/x/space/notice/set',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ notice, csrf }).toString(),
      },
    );
  }

  // ---- 空间设置 ----

  /** 查询空间设置（隐私、布局、头图） */
  async getSettings(mid: number): Promise<AjaxResponse<SpaceSettings>> {
    return this.client.request(
      `https://space.bilibili.com/ajax/settings/getSettings?mid=${mid}`,
    );
  }

  /** 查询可用头图列表 */
  async topPhotos(mid: number): Promise<AjaxResponse<TopPhotoItem[]>> {
    return this.client.request(
      `https://space.bilibili.com/ajax/topphoto/getlist?mid=${mid}`,
    );
  }

  /** 设置空间头图 */
  async setToutu(id: number): Promise<AjaxResponse<string>> {
    const csrf = this.extractCsrf();
    return this.client.request(
      'https://space.bilibili.com/ajax/settings/setToutu',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://space.bilibili.com/',
        },
        body: new URLSearchParams({ id: String(id), csrf }).toString(),
      },
    );
  }

  /** 修改空间隐私权限 */
  async setPrivacy(
    settings: Partial<Record<
      'fav_video' | 'bangumi' | 'tags' | 'coins_video' | 'user_info' | 'played_game',
      0 | 1
    >>,
  ): Promise<AjaxResponse<string>> {
    const csrf = this.extractCsrf();
    const body = new URLSearchParams({ csrf });
    for (const [k, v] of Object.entries(settings)) {
      body.set(k, String(v));
    }
    return this.client.request(
      'https://space.bilibili.com/ajax/settings/setPrivacy',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://www.bilibili.com',
        },
        body: body.toString(),
      },
    );
  }

  // ---- 最近玩过的游戏 ----

  /** 查询用户最近玩过的游戏 */
  async lastPlayGames(mid: number): Promise<BiliApiResponse<LastPlayGame[]>> {
    return this.client.request(
      `https://api.bilibili.com/x/space/lastplaygame?mid=${mid}`,
    );
  }

  // ---- 最近投币视频 ----

  /**
   * 查询用户最近投币视频
   * 返回与 video API 相同的 TopArc 列表
   */
  async coinVideos(vmid: number): Promise<BiliApiResponse<TopArc[]>> {
    return this.client.request(
      `https://api.bilibili.com/x/space/coin/video?vmid=${vmid}`,
    );
  }

  // ---- 内部工具 ----

  private extractCsrf(): string {
    const cookie = this.client.config.data.cookie;
    const match = cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!match) throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    return match[1];
  }
}
