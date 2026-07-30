import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface LiveRoomInfo {
  uid: number;
  room_id: number;
  short_id: number;
  attention: number;
  online: number;
  live_status: number;
  title: string;
  description: string;
  area_id: number;
  parent_area_id: number;
  parent_area_name: string;
  area_name: string;
  user_cover: string;
  keyframe: string;
  live_time: string;
  tags: string;
  room_silent_type: string;
  room_silent_level: number;
  room_silent_second: number;
  hot_words: string[];
  new_pendants: { frame: unknown; badge: unknown; mobile_frame: unknown; mobile_badge: unknown };
  pk_status: number;
  studio_info: unknown;
}

export interface MutedUserItem {
  tuid: number;
  tname: string;
  uid: number;
  name: string;
  ctime: number;
  id: number;
  is_anchor: number;
  face: string;
  admin_level: number;
}

export class LiveAPI {
  /** 获取直播间信�?*/
  static async getRoomInfo(
    client: BiliClient<any>,
    roomId: number,
  ): Promise<BiliApiResponse<LiveRoomInfo>> {
    return client.request(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`);
  }

  /** 创建直播�?*/
  static async createRoom(client: BiliClient<any>): Promise<BiliApiResponse<{ roomID: number }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.live.bilibili.com/xlive/app-blink/v1/preLive/CreateRoom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ platform: 'web', csrf }).toString(),
    });
  }

  /** 更新直播�?*/
  static async updateRoom(
    client: BiliClient<any>,
    roomId: number,
    options: { title?: string; areaId?: number; addTag?: string; delTag?: string } = {},
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({ room_id: String(roomId), csrf });
    if (options.title) body.set('title', options.title);
    if (options.areaId !== undefined) body.set('area_id', String(options.areaId));
    if (options.addTag) body.set('add_tag', options.addTag);
    if (options.delTag) body.set('del_tag', options.delTag);
    return client.request('https://api.live.bilibili.com/room/v1/Room/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 禁言用户 */
  static async banUser(
    client: BiliClient<any>,
    roomId: number,
    tuid: number,
    hour: number = -1,
    msg?: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      room_id: String(roomId),
      tuid: String(tuid),
      mobile_app: 'web',
      hour: String(hour),
      csrf_token: csrf,
      csrf,
    });
    if (msg) body.set('msg', msg);
    return client.request('https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/AddSilentUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 获取禁言用户列表 */
  static async getMutedList(
    client: BiliClient<any>,
    roomId: number,
    ps = 1,
  ): Promise<BiliApiResponse<{ data: MutedUserItem[]; total: number; total_page: number }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/GetSilentUserList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        room_id: String(roomId), ps: String(ps), csrf_token: csrf, csrf,
      }).toString(),
    });
  }

  /** 解禁用户 */
  static async unbanUser(
    client: BiliClient<any>,
    roomId: number,
    id: number,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.live.bilibili.com/banned_service/v1/Silent/del_room_block_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        roomid: String(roomId), id: String(id), csrf_token: csrf, csrf,
      }).toString(),
    });
  }
}
