import { BaseEntity } from './BaseEntity.js';
import { assertOk } from '../core/client.js';
import type { ArticleInfo } from '../api/article.js';
import { ArticleAPI } from '../api/article.js';
import { UserAPI } from '../api/user.js';
import { User } from './User.js';
import { ArticleViewEntity } from './ArticleViewEntity.js';

/**
 * 专栏文章实体
 *
 * 原始数据类型见 {@link ArticleInfo}。
 */
export class Article extends BaseEntity<ArticleInfo> {
  /** 专栏 cvid（从 rawData 中提取） */
  get cvid(): number { return (this.rawData as any)._cvid ?? 0; }

  /** 文章标识 —— 与 cvid 一致 */
  get id(): number { return this.cvid; }

  get title(): string { return this.rawData.title; }
  get bannerUrl(): string { return this.rawData.banner_url; }
  get authorMid(): number { return this.rawData.mid; }
  get authorName(): string { return this.rawData.author_name; }
  get likeCount(): number { return this.rawData.like; }
  get attention(): boolean { return this.rawData.attention; }
  get isFavorited(): boolean { return this.rawData.favorite; }
  get coinCount(): number { return this.rawData.coin; }
  get stats(): ArticleInfo['stats'] { return this.rawData.stats; }
  get imageUrls(): string[] { return this.rawData.image_urls; }
  get type(): number { return this.rawData.type; }

  /** 获取专栏作者 */
  async getAuthor(): Promise<User> {
    const res = await UserAPI.getInfo(this.client, this.authorMid);
    return new User(this.client, res.data);
  }

  /** 获取专栏正文内容 */
  async getView(): Promise<ArticleViewEntity> {
    const res = await ArticleAPI.getView(this.client, this.cvid);
    return new ArticleViewEntity(this.client, res.data);
  }

  /** 点赞专栏 */
  async like(): Promise<void> {
    const res = await ArticleAPI.like(this.client, this.cvid, 1);
    assertOk(res);
  }

  /** 取消点赞 */
  async unlike(): Promise<void> {
    const res = await ArticleAPI.like(this.client, this.cvid, 2);
    assertOk(res);
  }

  /** 投币专栏 */
  async coin(multiply = 1): Promise<void> {
    const res = await ArticleAPI.coin(this.client, this.cvid, this.authorMid, multiply);
    assertOk(res);
  }

  /** 收藏专栏 */
  async favorite(): Promise<void> {
    const res = await ArticleAPI.favorite(this.client, this.cvid);
    assertOk(res);
  }
}
