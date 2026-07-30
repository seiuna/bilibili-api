import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

// ---- 类型定义 ----

export interface UserInfo {
  mid: number;
  name: string;
  sex: string;
  face: string;
  sign: string;
  rank: number;
  level: number;
  jointime: number;
  moral: number;
  silence: number;
  coins: number;
  fans_badge: boolean;
  fans_medal: { show: boolean; wear: boolean; medal: unknown };
  official: { role: number; title: string; desc: string; type: number };
  vip: {
    type: number;
    status: number;
    due_date: number;
    vip_pay_type: number;
    theme_type: number;
    label: { path: string; text: string; label_theme: string; text_color: string; bg_style: number; bg_color: string; border_color: string; use_img_label: boolean; img_label_uri_hans: string; img_label_uri_hant: string; img_label_uri_hans_static: string; img_label_uri_hant_static: string };
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
  pendant: { pid: number; name: string; image: string; expire: number; image_enhance: string; image_enhance_frame: string };
  nameplate: { nid: number; name: string; image: string; image_small: string; level: string; condition: string };
  is_followed: boolean;
  top_photo: string;
  live_room: { roomStatus: number; liveStatus: number; url: string; title: string; cover: string; roomid: number; broadcast_type: number; online: number };
  birthday: string;
  school: { name: string } | null;
  profession: string;
  tags: { name: string }[];
  is_senior_member: number;
  elec: { ctime: number; total: number; show: number; list: unknown[] };
  contract: { is_contractor: boolean; contract_info: unknown } | null;
  name_render: unknown;
}

export interface UserStat {
  mid: number;
  following: number;
  whisper: number;
  black: number;
  follower: number;
}

export interface UpStat {
  archive: { view: number };
  article: { view: number };
  likes: number;
}

export interface NavNum {
  video: number;
  bangumi: number;
  cinema: number;
  channel: { master: number; guest: number };
  favourite: number;
  tag: number;
  article: number;
  playlist: number;
  album: number;
  audio: number;
  pugv: number;
}

export interface MedalWallItem {
  medal_info: {
    target_id: number;
    level: number;
    medal_name: string;
    medal_color_start: number;
    medal_color_end: number;
    medal_color_border: number;
    guard_level: number;
    wearing_status: number;
    medal_id: number;
    intimacy: number;
    next_intimacy: number;
    today_feed: number;
    day_limit: number;
    guard_icon: string;
    honor_icon: string;
  };
  target_name: string;
  target_icon: string;
  link: string;
  live_status: number;
}

export interface MedalWallData {
  list: MedalWallItem[];
  count: number;
  close_space_medal: boolean;
  only_show_wearing: boolean;
  name: string;
  icon: string;
  uid: number;
  level: number;
}

export interface RelationInfo {
  mid: number;
  attribute: number;
  mtime: number;
  tag: unknown;
  special: number;
  contract_info: { is_contract: boolean; is_contractor: boolean; ts: number; user_attr: number };
  uname: string;
  face: string;
  sign: string;
  face_nft: number;
  official_verify: { type: number; desc: string };
  vip: { vipType: number; vipDueDate: number; vipStatus: number; label: unknown };
  name_render: unknown;
  nft_icon: unknown;
  rec_reason: string;
  track_id: string;
  follow_time: number;
}

export interface RelationListData {
  list: RelationInfo[];
  offset: number;
  re_version: number;
  total: number;
}

export interface NameToUidItem {
  name: string;
  uid: string;
}

export interface LoginNoticeData {
  mid: number;
  device_name: string;
  login_type: string;
  login_time: string;
  location: string;
  ip: string;
}

export interface LoginLogItem {
  ip: string;
  time: number;
  time_at: string;
  status: boolean;
  type: number;
  geo: string;
}

export interface LoginLogData {
  count: number;
  list: LoginLogItem[];
}

export interface MemberAccountInfo {
  mid: number;
  uname: string;
  userid: string;
  sign: string;
  birthday: string;
  sex: string;
  nick_free: boolean;
  rank: number;
}

export interface RewardStatus {
  login: boolean;
  watch: boolean;
  coins: number;
  share: boolean;
  email: boolean;
  tel: boolean;
  safe_question: boolean;
  identify_card: boolean;
}

// ---- API 方法 ----

export class UserAPI {
  /** 获取用户基本信息 */
  static async getInfo(client: BiliClient<any>, mid: number): Promise<BiliApiResponse<UserInfo>> {
    return client.request(
      `https://api.bilibili.com/x/space/wbi/acc/info?mid=${mid}`,
      { wbi: true },
    );
  }

  /** 获取用户状态数（关注、粉丝等�?*/
  static async getRelationStat(client: BiliClient<any>, vmid: number): Promise<BiliApiResponse<UserStat>> {
    return client.request(`https://api.bilibili.com/x/relation/stat?vmid=${vmid}`);
  }

  /** 获取 UP 主状态数（播放、阅读、点赞） */
  static async getUpStat(client: BiliClient<any>, mid: number): Promise<BiliApiResponse<UpStat>> {
    return client.request(`https://api.bilibili.com/x/space/upstat?mid=${mid}`);
  }

  /** 获取用户导航栏状态数 */
  static async getNavNum(client: BiliClient<any>, mid: number): Promise<BiliApiResponse<NavNum>> {
    return client.request(`https://api.bilibili.com/x/space/navnum?mid=${mid}`);
  }

  /** 获取所有粉丝勋�?*/
  static async getMedalWall(client: BiliClient<any>, targetId: number): Promise<BiliApiResponse<MedalWallData>> {
    return client.request(
      `https://api.live.bilibili.com/xlive/web-ucenter/user/MedalWall?target_id=${targetId}`,
    );
  }

  /** 查询用户粉丝明细 */
  static async getFans(
    client: BiliClient<any>,
    vmid: number,
    ps = 50,
    pn = 1,
  ): Promise<BiliApiResponse<RelationListData>> {
    return client.request(
      `https://api.bilibili.com/x/relation/fans?vmid=${vmid}&ps=${ps}&pn=${pn}`,
    );
  }

  /** 用户关系操作（关�?取关等） */
  static async modifyRelation(
    client: BiliClient<any>,
    mid: number,
    act: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    reSrc: 11 | 22 = 11,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/relation/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        fid: String(mid),
        act: String(act),
        re_src: String(reSrc),
        csrf,
      }).toString(),
    });
  }

  /** 批量查询用户名转 mid */
  static async nameToUid(
    client: BiliClient<any>,
    names: string,
  ): Promise<BiliApiResponse<{ uid_list: NameToUidItem[] }>> {
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/name-to-uid?names=${encodeURIComponent(names)}`,
    );
  }

  /** 查询登录记录 */
  static async getLoginNotice(
    client: BiliClient<any>,
    mid: number,
    buvid?: string,
  ): Promise<BiliApiResponse<LoginNoticeData>> {
    const params = new URLSearchParams({ mid: String(mid) });
    if (buvid) params.set('buvid', buvid);
    return client.request(`https://api.bilibili.com/x/safecenter/login_notice?${params}`);
  }

  /** 查询最近一周登录情�?*/
  static async getLoginLog(client: BiliClient<any>): Promise<BiliApiResponse<LoginLogData>> {
    return client.request('https://api.bilibili.com/x/member/web/login/log');
  }

  /** 获取登录基本信息（导航栏用户信息�?*/
  static async getNavInfo(client: BiliClient<any>): Promise<BiliApiResponse<unknown>> {
    return client.request('https://api.bilibili.com/x/web-interface/nav');
  }

  /** 获取会员中心个人信息 */
  static async getMemberAccount(client: BiliClient<any>): Promise<BiliApiResponse<MemberAccountInfo>> {
    return client.request('https://api.bilibili.com/x/member/web/account');
  }

  /** 获取每日奖励状�?*/
  static async getRewardStatus(client: BiliClient<any>): Promise<BiliApiResponse<RewardStatus>> {
    return client.request('https://api.bilibili.com/x/member/web/exp/reward');
  }

  /** 获取今日投币经验 */
  static async getTodayCoinExp(client: BiliClient<any>): Promise<BiliApiResponse<number>> {
    return client.request('https://api.bilibili.com/x/web-interface/coin/today/exp');
  }

  /** 加入老粉计划 */
  static async addContract(
    client: BiliClient<any>,
    upMid: number,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v1/contract/add_contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        up_mid: String(upMid),
        aid: '',
        source: '4',
        scene: '105',
        platform: 'web',
        mobi_app: 'pc',
        csrf,
      }).toString(),
    });
  }

  /** 老粉计划发送留言 */
  static async addContractMessage(
    client: BiliClient<any>,
    upMid: number,
    content: string,
  ): Promise<BiliApiResponse<{ success_toast: string }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v1/contract/add_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        up_mid: String(upMid),
        content,
        aid: '',
        source: '4',
        scene: '105',
        csrf,
      }).toString(),
    });
  }
}
