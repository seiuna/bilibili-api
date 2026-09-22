import { BaseEntity } from './BaseEntity.js';
import type { RelationListData } from '../api/user.js';
import { RelationInfoEntity } from './RelationInfoEntity.js';

/**
 * 用户关系列表实体
 *
 * 原始数据类型见 {@link RelationListData}。
 */
export class RelationListEntity extends BaseEntity<RelationListData> {
  get list(): RelationInfoEntity[] {
    return (this.rawData.list ?? []).map(
      (item) => new RelationInfoEntity(this.client, item),
    );
  }
  get offset(): number { return this.rawData.offset; }
  get reVersion(): number { return this.rawData.re_version; }
  get total(): number { return this.rawData.total; }
}
