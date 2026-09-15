import { BaseEntity } from './BaseEntity.js';
import type { MyInfo } from '../api/user.js';

/**
 * 登录用户空间详细信息实体
 *
 * 原始数据类型见 {@link MyInfo}。
 */
export class MyInfoEntity extends BaseEntity<MyInfo> {
  get mid(): number { return this.rawData.mid; }
  get name(): string { return this.rawData.name; }
  get sex(): string { return this.rawData.sex; }
  get face(): string { return this.rawData.face; }
  get sign(): string { return this.rawData.sign; }
  get rank(): number { return this.rawData.rank; }
  get level(): number { return this.rawData.level; }
  get jointime(): number { return this.rawData.jointime; }
  get moral(): number { return this.rawData.moral; }
  get silence(): number { return this.rawData.silence; }
  get emailStatus(): number { return this.rawData.email_status; }
  get telStatus(): number { return this.rawData.tel_status; }
  get identification(): number { return this.rawData.identification; }
  get vip(): MyInfo['vip'] { return this.rawData.vip; }
  get birthday(): number { return this.rawData.birthday; }
  get isTourist(): number { return this.rawData.is_tourist; }
  get isFakeAccount(): number { return this.rawData.is_fake_account; }
  get pinPrompting(): number { return this.rawData.pin_prompting; }
  get isDeleted(): number { return this.rawData.is_deleted; }
  get coins(): number { return this.rawData.coins; }
  get following(): number { return this.rawData.following; }
  get follower(): number { return this.rawData.follower; }
  get pendant(): MyInfo['pendant'] { return this.rawData.pendant; }
  get nameplate(): MyInfo['nameplate'] { return this.rawData.nameplate; }
  get official(): MyInfo['official'] { return this.rawData.official; }
  get levelExp(): MyInfo['level_exp'] { return this.rawData.level_exp; }
  get profession(): MyInfo['profession'] { return this.rawData.profession; }
  get inRegAudit(): number | undefined { return this.rawData.in_reg_audit; }
  get isRipUser(): boolean | undefined { return this.rawData.is_rip_user; }
}
