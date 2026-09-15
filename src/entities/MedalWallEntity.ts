import { BaseEntity } from './BaseEntity.js';
import type { MedalWallData } from '../api/user.js';
import { MedalWallItemEntity } from './MedalWallItemEntity.js';

/**
 * 粉丝勋章墙实体
 *
 * 原始数据类型见 {@link MedalWallData}。
 */
export class MedalWallEntity extends BaseEntity<MedalWallData> {
  get list(): MedalWallItemEntity[] {
    return (this.rawData.list ?? []).map(
      (item) => new MedalWallItemEntity(this.client, item),
    );
  }
  get count(): number { return this.rawData.count; }
  get closeSpaceMedal(): boolean { return this.rawData.close_space_medal; }
  get onlyShowWearing(): boolean { return this.rawData.only_show_wearing; }
  get name(): string { return this.rawData.name; }
  get icon(): string { return this.rawData.icon; }
  get uid(): number { return this.rawData.uid; }
  get level(): number { return this.rawData.level; }
}
