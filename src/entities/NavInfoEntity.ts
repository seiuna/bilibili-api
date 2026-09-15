import { BaseEntity } from './BaseEntity.js';
import type { NavInfo } from '../api/user.js';

/**
 * 登录基本信息（导航栏用户信息）实体
 *
 * 原始数据类型见 {@link NavInfo}。
 */
export class NavInfoEntity extends BaseEntity<NavInfo> {
  get isLogin(): boolean { return this.rawData.isLogin; }
  get emailVerified(): number { return this.rawData.email_verified; }
  get face(): string { return this.rawData.face; }
  get faceNft(): number | undefined { return this.rawData.face_nft; }
  get faceNftType(): number | undefined { return this.rawData.face_nft_type; }
  get levelInfo(): NavInfo['level_info'] { return this.rawData.level_info; }
  get mid(): number { return this.rawData.mid; }
  get mobileVerified(): number { return this.rawData.mobile_verified; }
  get money(): number { return this.rawData.money; }
  get moral(): number { return this.rawData.moral; }
  get official(): NavInfo['official'] { return this.rawData.official; }
  get officialVerify(): NavInfo['officialVerify'] { return this.rawData.officialVerify; }
  get pendant(): NavInfo['pendant'] { return this.rawData.pendant; }
  get scores(): number { return this.rawData.scores; }
  get uname(): string { return this.rawData.uname; }
  get vipDueDate(): number { return this.rawData.vipDueDate; }
  get vipStatus(): number { return this.rawData.vipStatus; }
  get vipType(): number { return this.rawData.vipType; }
  get vipPayType(): number { return this.rawData.vip_pay_type; }
  get vipThemeType(): number { return this.rawData.vip_theme_type; }
  get vipLabel(): NavInfo['vip_label'] { return this.rawData.vip_label; }
  get vipAvatarSubscript(): number { return this.rawData.vip_avatar_subscript; }
  get vipNicknameColor(): string { return this.rawData.vip_nickname_color; }
  get wallet(): NavInfo['wallet'] { return this.rawData.wallet; }
  get hasShop(): boolean | undefined { return this.rawData.has_shop; }
  get shopUrl(): string | undefined { return this.rawData.shop_url; }
  get allowanceCount(): number | undefined { return this.rawData.allowance_count; }
  get answerStatus(): number | undefined { return this.rawData.answer_status; }
  get isSeniorMember(): number { return this.rawData.is_senior_member; }
  get wbiImg(): NavInfo['wbi_img'] { return this.rawData.wbi_img; }
  get isJury(): boolean | undefined { return this.rawData.is_jury; }
}
