import { BaseEntity } from './BaseEntity.js';
import type { ToViewVideo } from '../api/history.js';
import { ToViewVideoEntity } from './ToViewVideoEntity.js';

/**
 * 稍后再看列表数据
 *
 * 实体包装见 {@link ToViewListEntity}。
 */
export interface ToViewListData {
  count: number;
  list: ToViewVideo[];
}

/**
 * 稍后再看列表实体
 *
 * 原始数据类型见 {@link ToViewListData}。
 */
export class ToViewListEntity extends BaseEntity<ToViewListData> {
  get count(): number { return this.rawData.count; }

  get list(): ToViewVideoEntity[] {
    return this.rawData.list.map((item) => new ToViewVideoEntity(this.client, item));
  }
}
