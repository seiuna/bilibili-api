import { BaseEntity } from './BaseEntity.js';
import type { BiliApiResponse } from '../core/types.js';
import type { ReplyEntry, ReplyAddResult } from '../api/comment.js';
import { ReplyType, ReplyReportReason } from '../api/comment.js';
import { CommentArea } from './CommentArea.js';
import { Video } from './Video.js';
import type { UploadImageResult } from '../api/upload.js';
import type { DynamicDetail } from '../api/dynamic.js';
import { DynamicAPI } from '../api/dynamic.js';
import { BiliClient } from '../index.js';

export class Comment extends BaseEntity<ReplyEntry> {
  private _oid: number;

  constructor(client: BiliClient<any>, entry: ReplyEntry, oid: number) {
    super(client, entry);
    this._oid = oid;
  }

  get rpid(): number { return this.rawData.rpid; }
  get oid(): number { return this.rawData.oid; }
  get type(): number { return this.rawData.type; }
  get mid(): number { return this.rawData.mid; }
  get root(): number { return this.rawData.root; }
  get parent(): number { return this.rawData.parent; }
  get count(): number { return this.rawData.count; }
  get rcount(): number { return this.rawData.rcount; }
  get likeCount(): number { return this.rawData.like; }
  get ctime(): number { return this.rawData.ctime; }
  get member(): ReplyEntry['member'] { return this.rawData.member; }
  get content(): ReplyEntry['content'] { return this.rawData.content; }
  get replies(): ReplyEntry['replies'] { return this.rawData.replies; }
  get upAction(): ReplyEntry['up_action'] { return this.rawData.up_action; }

  /** 该评论所属评论区，使用原始 type */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this._oid, this.type);
  }

  /** 获取该评论所属视频（仅 type=1） */
  async getVideo(): Promise<Video> {
    if (this.type !== ReplyType.VIDEO) {
      throw new Error(`Comment.getVideo() 只支持视频评论（type=1），当前 type=${this.type}`);
    }
    const { VideoAPI } = await import('../api/video.js');
    const res = await VideoAPI.getInfoByAid(this.client, this.oid);
    return new Video(this.client, res.data);
  }

  /** 获取该评论所属动态（仅 type=11） */
  async getDynamic(): Promise<BiliApiResponse<DynamicDetail>> {
    if (this.type !== ReplyType.DYNAMIC) {
      throw new Error(`Comment.getDynamic() 只支持动态评论（type=11），当前 type=${this.type}`);
    }
    return DynamicAPI.getDetail(this.client, String(this.oid));
  }

  /** 根据评论类型自动返回所属视频或动态 */
  async getSubject(): Promise<Video | BiliApiResponse<DynamicDetail>> {
    if (this.type === ReplyType.VIDEO) return this.getVideo();
    if (this.type === ReplyType.DYNAMIC) return this.getDynamic();
    throw new Error(`Comment.getSubject() 暂不支持 type=${this.type}`);
  }

  private get _c(): CommentArea { return this.commentArea(); }

  /** 回复这条评论 */
  async reply(message: string, pictures?: UploadImageResult[]): Promise<BiliApiResponse<ReplyAddResult>> {
    const root = this.root === 0 ? this.rpid : this.root;
    return this._c.add(message, root, this.rpid, pictures);
  }

  /** 点赞 / 取消 */
  async like(unlike = false) { return this._c.like(this.rpid, unlike); }

  /** 点踩 / 取消 */
  async hate(unhate = false) { return this._c.hate(this.rpid, unhate); }

  /** 删除 */
  async delete() { return this._c.delete(this.rpid); }

  /** 置顶 / 取消 */
  async top(untop = false) { return this._c.top(this.rpid, untop); }

  /** 举报 */
  async report(reason = ReplyReportReason.SPAM, content?: string) {
    return this._c.report(this.rpid, reason, content);
  }
}