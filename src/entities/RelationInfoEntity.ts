import { BaseEntity } from './BaseEntity.js';
import type { RelationInfo } from '../api/user.js';

/**
 * 用户关系明细单条实体
 *
 * 原始数据类型见 {@link RelationInfo}。
 */
export class RelationInfoEntity extends BaseEntity<RelationInfo> {
  get mid(): number { return this.rawData.mid; }
  get attribute(): number { return this.rawData.attribute; }
  get mtime(): number { return this.rawData.mtime; }
  get tag(): unknown { return this.rawData.tag; }
  get special(): number { return this.rawData.special; }
  get contractInfo(): RelationInfo['contract_info'] { return this.rawData.contract_info; }
  get uname(): string { return this.rawData.uname; }
  get face(): string { return this.rawData.face; }
  get sign(): string { return this.rawData.sign; }
  get faceNft(): number { return this.rawData.face_nft; }
  get officialVerify(): RelationInfo['official_verify'] { return this.rawData.official_verify; }
  get vip(): RelationInfo['vip'] { return this.rawData.vip; }
  get nameRender(): unknown { return this.rawData.name_render; }
  get nftIcon(): unknown { return this.rawData.nft_icon; }
  get recReason(): string { return this.rawData.rec_reason; }
  get trackId(): string { return this.rawData.track_id; }
  get followTime(): number { return this.rawData.follow_time; }
}
