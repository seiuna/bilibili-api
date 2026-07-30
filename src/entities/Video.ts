import { BaseEntity } from './BaseEntity.js';
import type { VideoInfo, VideoStat, PlayUrlData, OnlineCount, AiSummary, VideoSnapshot, PbpData, VideoTag, RecommendVideo } from '../api/video.js';
import { VideoAPI } from '../api/video.js';
import { UserAPI } from '../api/user.js';
import { User } from './User.js';
import { CommentArea } from './CommentArea.js';

export class Video extends BaseEntity<VideoInfo> {
  get bvid(): string { return this.rawData.bvid; }
  get aid(): number { return this.rawData.aid; }
  get title(): string { return this.rawData.title; }
  get desc(): string { return this.rawData.desc; }
  get pic(): string { return this.rawData.pic; }
  get pubdate(): number { return this.rawData.pubdate; }
  get ctime(): number { return this.rawData.ctime; }
  get duration(): number { return this.rawData.duration; }
  get cid(): number { return this.rawData.cid; }
  get tid(): number { return this.rawData.tid; }
  get tname(): string { return this.rawData.tname; }
  get copyright(): number { return this.rawData.copyright; }
  get videos(): number { return this.rawData.videos; }
  get dynamic(): string { return this.rawData.dynamic; }

  get owner(): VideoInfo['owner'] { return this.rawData.owner; }
  get stat(): VideoInfo['stat'] { return this.rawData.stat; }
  get rights(): VideoInfo['rights'] { return this.rawData.rights; }
  get pages(): VideoInfo['pages'] { return this.rawData.pages; }
  get dimension(): VideoInfo['dimension'] { return this.rawData.dimension; }
  get subtitle(): VideoInfo['subtitle'] { return this.rawData.subtitle; }
  get argueInfo(): VideoInfo['argue_info'] { return this.rawData.argue_info; }

  /** 获取 UP 主信息（返回 User 实体） */
  async getAuthor(): Promise<User> {
    const res = await UserAPI.getInfo(this.client, this.owner.mid);
    return new User(this.client, res.data);
  }

  /** 获取视频评论区 */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.aid, 1);
  }

  /** 获取视频状态数 */
  async getStat(): Promise<VideoStat> {
    const res = await VideoAPI.getStat(this.client, this.bvid, this.aid);
    return res.data;
  }

  /** 获取视频流播放 & 下载地址 */
  async getPlayUrl(options: {
    qn?: number;
    fnval?: number;
    fnver?: number;
    fourk?: 0 | 1;
    platform?: string;
  } = {}): Promise<PlayUrlData> {
    const res = await VideoAPI.getPlayUrl(this.client, this.cid, {
      avid: this.aid,
      bvid: this.bvid,
      ...options,
    });
    return res.data;
  }

  /** 获取视频在线人数 */
  async getOnlineCount(): Promise<OnlineCount> {
    const res = await VideoAPI.getOnlineCount(this.client, this.cid, this.aid, this.bvid);
    return res.data;
  }

  /** 获取视频 AI 摘要 */
  async getAiSummary(): Promise<AiSummary> {
    const res = await VideoAPI.getAiSummary(this.client, this.cid, this.aid, this.bvid, this.owner.mid);
    return res.data;
  }

  /** 获取视频快照 */
  async getSnapshot(index = 0): Promise<VideoSnapshot> {
    const res = await VideoAPI.getSnapshot(this.client, this.cid, this.aid, this.bvid, index);
    return res.data;
  }

  /** 获取高能进度条数据 */
  async getPbp(): Promise<PbpData> {
    return VideoAPI.getPbp(this.client, this.cid, this.aid, this.bvid);
  }

  /** 获取视频推荐列表 */
  async getRecommend(): Promise<RecommendVideo[]> {
    const res = await VideoAPI.getRecommend(this.client, this.aid, this.bvid);
    return res.data;
  }

  /** 获取视频 TAG */
  async getTags(): Promise<VideoTag[]> {
    const res = await VideoAPI.getTags(this.client, this.aid, this.bvid, this.cid);
    return res.data;
  }

  // ---- 互动操作 ----

  /** 点赞视频 */
  async like(): Promise<void> {
    await VideoAPI.like(this.client, this.aid, 1);
  }

  /** 取消点赞 */
  async unlike(): Promise<void> {
    await VideoAPI.like(this.client, this.aid, 2);
  }

  /** 判断是否已点赞 */
  async hasLiked(): Promise<boolean> {
    const res = await VideoAPI.hasLiked(this.client, this.aid);
    return res.data === 1;
  }

  /** 投币视频 */
  async coin(multiply = 1, selectLike = false): Promise<void> {
    await VideoAPI.coin(this.client, this.aid, multiply, selectLike ? 1 : 0);
  }

  /** 判断是否已投币 */
  async hasCoined(): Promise<number> {
    const res = await VideoAPI.hasCoined(this.client, this.aid);
    return res.data.multiply;
  }

  /** 收藏视频 */
  async favorite(addMediaIds: string): Promise<void> {
    await VideoAPI.favorite(this.client, this.aid, addMediaIds);
  }

  /** 判断是否已收藏 */
  async hasFavorited(): Promise<boolean> {
    const res = await VideoAPI.hasFavorited(this.client, this.aid);
    return res.data.favoured;
  }

  /** 一键三连 */
  async triple(): Promise<{ like: boolean; coin: boolean; fav: boolean; multiply: number }> {
    const res = await VideoAPI.triple(this.client, this.aid);
    return res.data;
  }

  /** 分享视频 */
  async share(): Promise<number> {
    const res = await VideoAPI.share(this.client, this.aid);
    return res.data;
  }

  // ---- 评论快捷操作 ----

  /** 发表一级评论 */
  async postComment(message: string): Promise<unknown> {
    return this.commentArea().add(message);
  }

  /** 回复某条评论 */
  async replyToComment(parentRpid: number, message: string, rootRpid?: number): Promise<unknown> {
    return this.commentArea().add(message, rootRpid ?? parentRpid, parentRpid);
  }
}