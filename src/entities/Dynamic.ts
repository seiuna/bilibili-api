import { BaseEntity } from './BaseEntity.js';
import type { DynamicDetail } from '../api/dynamic.js';
import { DynamicAPI } from '../api/dynamic.js';
import { CommentArea } from './CommentArea.js';

export class Dynamic extends BaseEntity<DynamicDetail['item']> {
  get id(): string { return this.rawData.id_str; }
  get type(): string { return this.rawData.type; }
  get visible(): boolean { return this.rawData.visible; }

  get basic(): DynamicDetail['item']['basic'] { return this.rawData.basic; }
  get modules(): unknown[] { return this.rawData.modules; }

  /** 获取该动态的评论区 */
  commentArea(): CommentArea {
    return new CommentArea(
      this.client,
      Number(this.basic.rid_str),
      this.basic.comment_type,
    );
  }

  /** 点赞动态 */
  async like(): Promise<void> {
    await DynamicAPI.like(this.client, this.id, 1);
  }

  /** 取消点赞 */
  async unlike(): Promise<void> {
    await DynamicAPI.like(this.client, this.id, 2);
  }

  /** 删除动态 */
  async delete(): Promise<void> {
    await DynamicAPI.delete(this.client, Number(this.id));
  }

  /** 设置置顶 */
  async setTop(): Promise<void> {
    await DynamicAPI.setTop(this.client, this.id);
  }

  /** 取消置顶 */
  async removeTop(): Promise<void> {
    await DynamicAPI.removeTop(this.client, this.id);
  }
}