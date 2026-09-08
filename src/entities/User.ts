import { BaseEntity } from './BaseEntity.js';
import type {
  UserInfo,
  UserStat,
  UpStat,
  NavNum,
  MedalWallData,
  RelationListData,
  RelationInfo,
} from '../api/user.js';
import { UserAPI } from '../api/user.js';
import type { DynamicSpaceData, DynamicFeedItem } from '../api/dynamic.js';
import { DynamicAPI } from '../api/dynamic.js';

export class User extends BaseEntity<UserInfo> {
  get mid(): number { return this.rawData.mid; }
  get name(): string { return this.rawData.name; }
  get sex(): string { return this.rawData.sex; }
  get face(): string { return this.rawData.face; }
  get sign(): string { return this.rawData.sign; }
  get rank(): number { return this.rawData.rank; }
  get level(): number { return this.rawData.level; }
  get birthday(): string { return this.rawData.birthday; }
  get topPhoto(): string { return this.rawData.top_photo; }
  get isFollowed(): boolean { return this.rawData.is_followed; }
  get isSeniorMember(): number { return this.rawData.is_senior_member; }

  get official(): UserInfo['official'] { return this.rawData.official; }
  get vip(): UserInfo['vip'] { return this.rawData.vip; }
  get pendant(): UserInfo['pendant'] { return this.rawData.pendant; }
  get nameplate(): UserInfo['nameplate'] { return this.rawData.nameplate; }
  get liveRoom(): UserInfo['live_room'] { return this.rawData.live_room; }
  get tags(): { name: string }[] { return this.rawData.tags; }

  /** 获取用户状态数（关注、粉丝等） */
  async getStat(): Promise<UserStat> {
    const res = await UserAPI.getRelationStat(this.client, this.mid);
    return res.data;
  }

  /** 获取 UP 主状态数（播放、阅读、点赞） */
  async getUpStat(): Promise<UpStat> {
    const res = await UserAPI.getUpStat(this.client, this.mid);
    return res.data;
  }

  /** 获取导航栏状态数 */
  async getNavNum(): Promise<NavNum> {
    const res = await UserAPI.getNavNum(this.client, this.mid);
    return res.data;
  }

  /** 获取粉丝勋章 */
  async getMedalWall(): Promise<MedalWallData> {
    const res = await UserAPI.getMedalWall(this.client, this.mid);
    return res.data;
  }

  /** 关注该用户 */
  async follow(): Promise<void> {
    await UserAPI.modifyRelation(this.client, this.mid, 1);
  }

  /** 取消关注 */
  async unfollow(): Promise<void> {
    await UserAPI.modifyRelation(this.client, this.mid, 2);
  }

  /** 拉黑该用户 */
  async block(): Promise<void> {
    await UserAPI.modifyRelation(this.client, this.mid, 5);
  }

  /** 取消拉黑 */
  async unblock(): Promise<void> {
    await UserAPI.modifyRelation(this.client, this.mid, 6);
  }

  /** 加入老粉计划 */
  async addContract(): Promise<void> {
    await UserAPI.addContract(this.client, this.mid);
  }

  /** 老粉计划发送留言 */
  async addContractMessage(content: string): Promise<void> {
    await UserAPI.addContractMessage(this.client, this.mid, content);
  }

  /** 获取单页粉丝明细 */
  async getFans(ps = 50, pn = 1): Promise<RelationListData> {
    const res = await UserAPI.getFans(this.client, this.mid, ps, pn);
    return res.data;
  }

  /** 粉丝翻页 — async generator */
  async *fans(ps = 50): AsyncGenerator<RelationInfo> {
    yield* UserAPI.fans(this.client, this.mid, ps);
  }

  /** 获取单页空间动态 */
  async getDynamics(offset?: string): Promise<DynamicSpaceData> {
    const res = await DynamicAPI.getSpace(this.client, this.mid, offset);
    return res.data;
  }

  /** 空间动态翻页 — async generator */
  async *dynamics(): AsyncGenerator<DynamicFeedItem> {
    yield* DynamicAPI.space(this.client, this.mid);
  }
}