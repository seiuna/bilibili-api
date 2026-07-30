import { BaseEntity } from './BaseEntity.js';
import type { ArticleInfo, ArticleView } from '../api/article.js';
import { ArticleAPI } from '../api/article.js';
import { User } from './User.js';

export class Article extends BaseEntity<ArticleInfo> {
  get id(): number { return this.rawData.type === 0 ? (this.rawData as any).pre + 1 : this.rawData.title.length > 0 ? 0 : 0; }

  /** 获取专栏 cvid（从 rawData 中提取） */
  get cvid(): number { return (this.rawData as any)._cvid ?? 0; }

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

  /** 获取专栏作者（返回 User 实体） */
  async getAuthor(): Promise<User> {
    const res = await import('../api/user.js').then(m => m.UserAPI.getInfo(this.client, this.authorMid));
    return new User(this.client, res.data);
  }

  /** 获取专栏内容 */
  async getView(): Promise<ArticleView> {
    const res = await ArticleAPI.getView(this.client, this.cvid);
    return res.data;
  }

  /** 点赞专栏 */
  async like(): Promise<void> {
    await ArticleAPI.like(this.client, this.cvid, 1);
  }

  /** 取消点赞 */
  async unlike(): Promise<void> {
    await ArticleAPI.like(this.client, this.cvid, 2);
  }

  /** 投币专栏 */
  async coin(multiply = 1): Promise<void> {
    await ArticleAPI.coin(this.client, this.cvid, this.authorMid, multiply);
  }

  /** 收藏专栏 */
  async favorite(): Promise<void> {
    await ArticleAPI.favorite(this.client, this.cvid);
  }
}