import { BaseEntity } from './BaseEntity.js';
import { assertOk } from '../core/client.js';
import type { DynamicDetail, DynamicModule, DynamicOpusPicture } from '../api/dynamic.js';
import { DynamicAPI } from '../api/dynamic.js';
import { CommentArea } from './CommentArea.js';

/**
 * 动态实体
 *
 * 原始数据类型见 {@link DynamicDetail}。
 */
export class Dynamic extends BaseEntity<DynamicDetail['item']> {
  get id(): string { return this.rawData.id_str; }
  get type(): string { return this.rawData.type; }
  get visible(): boolean { return this.rawData.visible; }

  get basic(): DynamicDetail['item']['basic'] { return this.rawData.basic; }
  get modules(): DynamicModule | DynamicModule[] { return this.rawData.modules; }

  /** 将接口可能返回的对象或数组形式统一为模块数组。 */
  get moduleList(): DynamicModule[] {
    return Array.isArray(this.rawData.modules)
      ? this.rawData.modules
      : [this.rawData.modules];
  }

  /** 动态正文；没有 Opus 摘要时返回空字符串。 */
  get content(): string {
    return this.moduleList
      .map((module) => module.module_dynamic?.major?.opus?.summary?.text ?? '')
      .join('');
  }

  /** 动态附带的所有图片。 */
  get pictures(): DynamicOpusPicture[] {
    return this.moduleList.flatMap(
      (module) => module.module_dynamic?.major?.opus?.pics ?? [],
    );
  }

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
    const res = await DynamicAPI.like(this.client, this.id, 1);
    assertOk(res);
  }

  /** 取消点赞 */
  async unlike(): Promise<void> {
    const res = await DynamicAPI.like(this.client, this.id, 2);
    assertOk(res);
  }

  /** 删除动态 */
  async delete(): Promise<void> {
    const res = await DynamicAPI.delete(this.client, this.id);
    assertOk(res);
  }

  /** 设置置顶 */
  async setTop(): Promise<void> {
    const res = await DynamicAPI.setTop(this.client, this.id);
    assertOk(res);
  }

  /** 取消置顶 */
  async removeTop(): Promise<void> {
    const res = await DynamicAPI.removeTop(this.client, this.id);
    assertOk(res);
  }
}