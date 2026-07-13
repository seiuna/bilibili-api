import type { BiliClient } from '../client.js';
import type { RequestContext, BiliApiResponse } from '../types.js';
import { UserResult } from './results.js';

export interface UserCard {
  mid: string;
  name: string;
  approve: boolean;
  sex: string;
  rank: string;
  face: string;
  face_nft: number;
  face_nft_type: number;
  DisplayRank: string;
  regtime: number;
  spacesta: number;
  birthday: string;
  place: string;
  description: string;
  article: number;
  attentions: number[];
  fans: number;
  friend: number;
  attention: number;
  sign: string;
  level_info: {
    current_level: number;
    current_min: number;
    current_exp: number;
    next_exp: number;
  };
  pendant: {
    pid: number;
    name: string;
    image: string;
    expire: number;
    image_enhance: string;
    image_enhance_frame: string;
    n_pid: number;
  };
  nameplate: {
    nid: number;
    name: string;
    image: string;
    image_small: string;
    level: string;
    condition: string;
  };
  Official: {
    role: number;
    title: string;
    desc: string;
    type: number;
  };
  official_verify: {
    type: number;
    desc: string;
  };
  vip: {
    type: number;
    status: number;
    due_date: number;
    vip_pay_type: number;
    theme_type: number;
    label: {
      path: string;
      text: string;
      label_theme: string;
      text_color: string;
      bg_style: number;
      bg_color: string;
      border_color: string;
      use_img_label: boolean;
      img_label_uri_hans: string;
      img_label_uri_hant: string;
      img_label_uri_hans_static: string;
      img_label_uri_hant_static: string;
    };
    avatar_subscript: number;
    nickname_color: string;
    role: number;
    avatar_subscript_url: string;
    tv_vip_status: number;
    tv_vip_pay_type: number;
    tv_due_date: number;
    vipType: number;
    vipStatus: number;
  };
  is_senior_member: number;
  name_render: null;
}

export class UserQuery {
  constructor(
    private client: BiliClient,
    private ctx: RequestContext,
  ) {}

  /**
   * 发起请求，返回二次封装的 UserResult
   *
   * 注意：Bilibili card API 返回结构为
   *   { code:0, data: { card: {...用户字段...}, following, archive_count, ... } }
   * 此处自动提取 data.card 进行二次封装。
   */
  async fetch(): Promise<UserResult> {
    const mid = this.ctx.mid;
    if (!mid) {
      throw new Error('UserQuery.fetch(): 缺少 mid');
    }
    const raw = await this.client.request<
      BiliApiResponse<{ card: UserCard }>
    >(`https://api.bilibili.com/x/web-interface/card?mid=${mid}`);
    return new UserResult(this.client, raw);
  }
}
