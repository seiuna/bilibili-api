import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface DanmakuConfig {
  dm_switch: boolean;
  blockscroll: boolean;
  blocktop: boolean;
  blockbottom: boolean;
  blockcolor: boolean;
  blockspecial: boolean;
  ai_switch: boolean;
  ai_level: number;
  preventshade: boolean;
  dmask: boolean;
  opacity: number;
  dmarea: number;
  speedplus: number;
  fontsize: number;
  screensync: boolean;
  speedsync: boolean;
  fontfamily: string;
  bold: boolean;
  fontborder: number;
  drawType: number;
}

export class DanmakuAPI {
  /** 获取 XML 实时弹幕 */
  static async getXmlDanmaku(client: BiliClient<any>, cid: number): Promise<string> {
    const res = await client.request<string>(`https://comment.bilibili.com/${cid}.xml`);
    return res;
  }

  /** 获取历史弹幕日期列表 */
  static async getHistoryDates(
    client: BiliClient<any>,
    cid: number,
    month: string,
  ): Promise<BiliApiResponse<string[] | null>> {
    return client.request(
      `https://api.bilibili.com/x/v2/dm/history/index?type=1&oid=${cid}&month=${month}`,
    );
  }

  /** 弹幕个人配置修改 */
  static async updateConfig(
    client: BiliClient<any>,
    config: Partial<DanmakuConfig>,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({ csrf });
    for (const [k, v] of Object.entries(config)) {
      body.set(k, typeof v === 'boolean' ? String(v ? 1 : 0) : String(v));
    }
    return client.request('https://api.bilibili.com/x/v2/dm/web/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 发送弹�?*/
  static async postDanmaku(
    client: BiliClient<any>,
    oid: number,
    msg: string,
    options: {
      aid?: number;
      bvid?: string;
      progress?: number;
      color?: number;
      fontsize?: number;
      pool?: number;
      mode?: number;
    } = {},
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      type: '1',
      oid: String(oid),
      msg,
      csrf,
      rnd: String(Math.floor(Date.now() / 1000)),
    });
    if (options.aid) body.set('aid', String(options.aid));
    if (options.bvid) body.set('bvid', options.bvid);
    if (options.progress !== undefined) body.set('progress', String(options.progress));
    if (options.color !== undefined) body.set('color', String(options.color));
    if (options.fontsize !== undefined) body.set('fontsize', String(options.fontsize));
    if (options.pool !== undefined) body.set('pool', String(options.pool));
    if (options.mode !== undefined) body.set('mode', String(options.mode));
    return client.request('https://api.bilibili.com/x/v2/dm/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      wbi: true,
    });
  }
}
