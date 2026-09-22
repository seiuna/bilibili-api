import { BaseEntity } from './BaseEntity.js';
import type { ToViewVideo } from '../api/history.js';

/**
 * 稍后再看视频实体
 *
 * 原始数据类型见 {@link ToViewVideo}。
 */
export class ToViewVideoEntity extends BaseEntity<ToViewVideo> {
  get aid(): number { return this.rawData.aid; }
  get bvid(): string { return this.rawData.bvid; }
  get videos(): number { return this.rawData.videos; }
  get tid(): number { return this.rawData.tid; }
  get tname(): string { return this.rawData.tname; }
  get copyright(): number { return this.rawData.copyright; }
  get pic(): string { return this.rawData.pic; }
  get title(): string { return this.rawData.title; }
  get pubdate(): number { return this.rawData.pubdate; }
  get ctime(): number { return this.rawData.ctime; }
  get desc(): string { return this.rawData.desc; }
  get duration(): number { return this.rawData.duration; }
  get cid(): number { return this.rawData.cid; }
  get progress(): number { return this.rawData.progress; }
  get addAt(): number { return this.rawData.add_at; }

  get rights(): ToViewVideo['rights'] { return this.rawData.rights; }
  get owner(): ToViewVideo['owner'] { return this.rawData.owner; }
  get stat(): ToViewVideo['stat'] { return this.rawData.stat; }
}
