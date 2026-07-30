import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface ChargeListItem {
  uname: string;
  avatar: string;
  mid: number;
  pay_mid: number;
  rank: number;
  trend_type: number;
  vip_info: unknown;
  message: string;
  msg_hidden: boolean;
}

export interface ChargeListData {
  count: number;
  list: ChargeListItem[];
  total_count: number;
  total: number;
  special_day: string;
}

export interface ChargeShowData {
  show_info: {
    show: boolean;
    state: number;
    title: string;
    jump_url: string;
    icon: string;
    high_level: boolean;
    with_qa_id: number;
  };
  av_count: number;
  count: number;
  total_count: number;
  special_day: string;
  display_num: string;
  cnt_priv_type: number;
}

export interface ChargeRemarkItem {
  aid: number;
  bvid: string;
  id: number;
  mid: number;
  reply_mid: number;
  elec_num: number;
  state: number;
  msg: string;
  ctime: number;
  reply_time: number;
}

export class ElectricAPI {
  /** 获取用户月度充电列表 */
  static async getMonthlyChargeList(
    client: BiliClient<any>,
    upMid: number,
  ): Promise<BiliApiResponse<ChargeListData>> {
    return client.request(`https://api.bilibili.com/x/ugcpay-rank/elec/month/up?up_mid=${upMid}`);
  }

  /** 获取视频充电鸣谢列表 */
  static async getVideoChargeShow(
    client: BiliClient<any>,
    mid: number,
    aid?: number,
    bvid?: string,
  ): Promise<BiliApiResponse<ChargeShowData>> {
    const params = new URLSearchParams({ mid: String(mid) });
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    return client.request(`https://api.bilibili.com/x/web-interface/elec-show?${params}`);
  }

  /** 发送充电留言 */
  static async sendChargeMessage(
    client: BiliClient<any>,
    orderId: string,
    message: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/ugcpay/trade/elec/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ order_id: orderId, message, csrf }).toString(),
    });
  }

  /** 查询收到的充电留言列表 */
  static async getChargeRemarks(
    client: BiliClient<any>,
    pn = 1,
    ps = 10,
  ): Promise<BiliApiResponse<{ list: ChargeRemarkItem[]; pager: { current: number; size: number; total: number } }>> {
    return client.request(
      `https://member.bilibili.com/x/web/elec/remark/list?pn=${pn}&ps=${ps}`,
    );
  }

  /** 查询充电留言详情 */
  static async getChargeRemarkDetail(
    client: BiliClient<any>,
    id: number,
  ): Promise<BiliApiResponse<ChargeRemarkItem>> {
    return client.request(`https://member.bilibili.com/x/web/elec/remark/detail?id=${id}`);
  }
}
