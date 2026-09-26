import { BaseEntity } from './BaseEntity.js';
import type { BiliClient } from '../core/client.js';
import { normalizeCommentId, type BiliApiResponse } from '../core/types.js';
import type { ReplyEntry, ReplyAddResult } from '../api/comment.js';
import { BusinessType, ReplyType, ReplyReportReason } from '../api/comment.js';
import { CommentArea } from './CommentArea.js';
import { Video } from './Video.js';
import { Dynamic } from './Dynamic.js';
import type { UploadImageResult } from '../api/upload.js';
import { DynamicAPI } from '../api/dynamic.js';

/**
 * 评论实体
 *
 * 原始数据类型见 {@link ReplyEntry}。
 */
export class Comment extends BaseEntity<ReplyEntry> {
  private _oid: number | string;

  constructor(client: BiliClient<any>, entry: ReplyEntry, oid: number | string) {
    super(client, entry);
    this._oid = oid;
  }

  /** Exact IDs: authoritative *_str fields win; unsafe numeric fallbacks throw. */
  get rpidStr(): string { return normalizeCommentId(this.rawData.rpid_str ?? this.rpid, 'rpid'); }
  get oidStr(): string { return normalizeCommentId(this.rawData.oid_str ?? this._oid, 'oid'); }
  get rootStr(): string { return normalizeCommentId(this.rawData.root_str ?? this.root, 'root', true); }
  get parentStr(): string { return normalizeCommentId(this.rawData.parent_str ?? this.parent, 'parent', true); }

  get rpid(): number { return this.rawData.rpid; }
  get oid(): number { return this.rawData.oid; }
  get type(): BusinessType | number { return this.rawData.type; }
  get mid(): number { return this.rawData.mid; }
  get root(): number { return this.rawData.root; }
  get parent(): number { return this.rawData.parent; }
  get count(): number { return this.rawData.count; }
  get rcount(): number { return this.rawData.rcount; }
  get likeCount(): number { return this.rawData.like; }
  get ctime(): number { return this.rawData.ctime; }
  /**
   * 谁发的
   */
  get member(): ReplyEntry['member'] { return this.rawData.member; }
  get content(): ReplyEntry['content'] { return this.rawData.content; }
  get message(): string { return this.rawData.content?.message ?? ''; }
  /**
   * 图片列表
   */
  get pictures(): ReplyEntry['content']['pictures'] { return this.rawData.content?.pictures; }
  get replies(): ReplyEntry['replies'] { return this.rawData.replies; }
  get upAction(): ReplyEntry['up_action'] { return this.rawData.up_action; }

  /** 获取上游业务类型代码（1: 视频, 11: 相簿/图文动态, 12: 专栏, 14: 音频, 17: 纯文字动态等） */
  get upstreamType(): BusinessType | number {
    return this.type;
  }

  /** 获取上游业务类型的文字描述 */
  get upstreamTypeName(): string {
    switch (this.type) {
      case BusinessType.Video:
        return '视频稿件 (Video)';
      case BusinessType.Dynamic:
        return '相簿/图文动态 (Opus / Dynamic)';
      case BusinessType.Article:
        return '专栏文章 (Article)';
      case BusinessType.Audio:
        return '音频 (Audio)';
      case BusinessType.Album:
        return '相簿 (Album)';
      case BusinessType.WordDynamic:
        return '纯文字动态 (Word Dynamic)';
      default:
        return `业务类型 (${this.type})`;
    }
  }

  /** 该评论所属评论区，使用原始 type */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.oidStr, this.type);
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

  /**
   * 获取该评论所属的纯文字动态（仅 type=17）。
   *
   * type=11 表示图文动态 / 相簿，其 oid 是 doc_id，不能直接作为动态 ID
   * 调用详情接口。优先使用 dynamic_id_str、oid_str 或调用方字符串 oid，
   * 最后仅在数值 oid 为正的安全整数时回退；
   * 缺少可靠 ID 时抛出错误，不发送可能已丢失精度的 ID。
   */
  async getDynamic(): Promise<Dynamic> {
    if (this.type !== ReplyType.WORD_DYNAMIC) {
      throw new Error(`Comment.getDynamic() 只支持纯文字动态评论（type=17），当前 type=${this.type}`);
    }
    const stringId = this.rawData.dynamic_id_str;
    let dynamicId: string;
    if (stringId && /^[1-9]\d*$/.test(stringId)) {
      dynamicId = stringId;
    } else if (this.rawData.oid_str !== undefined) {
      dynamicId = normalizeCommentId(this.rawData.oid_str, 'oid');
    } else if (typeof this._oid === 'string') {
      dynamicId = normalizeCommentId(this._oid, 'oid');
    } else if (Number.isSafeInteger(this.oid) && this.oid > 0) {
      dynamicId = String(this.oid);
    } else {
      throw new Error('Comment.getDynamic() 缺少可靠的字符串动态 ID，不能使用不安全的 oid');
    }
    const res = await DynamicAPI.getDetail(this.client, dynamicId);
    return new Dynamic(this.client, res.data.item);
  }

  /** 根据评论类型自动返回所属视频或纯文字动态。 */
  async getSubject(): Promise<Video | Dynamic> {
    if (this.type === ReplyType.VIDEO) return this.getVideo();
    if (this.type === ReplyType.WORD_DYNAMIC) return this.getDynamic();
    throw new Error(`Comment.getSubject() 暂不支持 type=${this.type}`);
  }

  private get _c(): CommentArea { return this.commentArea(); }

  /** 回复这条评论 */
  async reply(message: string, pictures?: UploadImageResult[]): Promise<BiliApiResponse<ReplyAddResult>> {
    const root = this.rootStr === '0' ? this.rpidStr : this.rootStr;
    return this._c.add(message, root, this.rpidStr, pictures);
  }

  /** 点赞 / 取消 */
  async like(unlike = false) { return this._c.like(this.rpidStr, unlike); }

  /** 点踩 / 取消 */
  async hate(unhate = false) { return this._c.hate(this.rpidStr, unhate); }

  /** 删除 */
  async delete() { return this._c.delete(this.rpidStr); }

  /** 置顶 / 取消 */
  async top(untop = false) { return this._c.top(this.rpidStr, untop); }

  /** 举报 */
  async report(reason = ReplyReportReason.SPAM, content?: string) {
    return this._c.report(this.rpidStr, reason, content);
  }
}
