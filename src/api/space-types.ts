/** 置顶视频 / 代表作视频 对象 */
export interface TopArc {
  aid: number;
  videos: number;
  tid: number;
  tname: string;
  copyright: number;
  pic: string;
  title: string;
  pubdate: number;
  ctime: number;
  desc: string;
  state: number;
  attribute?: number;
  duration: number;
  rights: Record<string, number>;
  owner: { mid: number; name: string; face: string };
  stat: Record<string, number>;
  dynamic: string;
  cid: number;
  dimension: { width: number; height: number; rotate: number };
  bvid: string;
  reason?: string;
  inter_video?: boolean;
}

/** 代表作视频列表（data 直接是数组） */
export type MasterpieceList = TopArc[];

/** 个人 TAG */
export interface UserTags {
  mid: number;
  tags: string[];
}

/** 空间公告 */
export type SpaceNotice = string;

/** 空间隐私设置 */
export interface SpacePrivacy {
  bangumi: number;
  bbq: number;
  channel: number;
  coins_video: number;
  comic: number;
  dress_up: number;
  fav_video: number;
  groups: number;
  likes_video: number;
  played_game: number;
  tags: number;
  user_info: number;
}

/** 空间头图信息 */
export interface SpaceToutu {
  sid: number;
  expire: number;
  s_img: string;
  l_img: string;
  android_img: string;
  iphone_img: string;
  ipad_img: string;
  thumbnail_img: string;
  platform: number;
}

/** 板块布局项 */
export interface IndexOrderItem {
  id: number;
  name: string;
}

/** 空间设置 */
export interface SpaceSettings {
  privacy: SpacePrivacy;
  index_order: IndexOrderItem[];
  theme: string;
  toutu: SpaceToutu;
}

/** 可用头图 */
export interface TopPhotoItem {
  id: number;
  product_name: string;
  price: number;
  coin_type: number;
  vip_free: number;
  s_img: string;
  l_img: string;
  thumbnail_img: string;
  sort_num: number;
  is_disable: number;
  expire: number;
  had: number;
}

/** 最近玩过的游戏 */
export interface LastPlayGame {
  website: string;
  image: string;
  name: string;
}
