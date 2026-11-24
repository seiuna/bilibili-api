import * as fs from 'fs/promises';
import * as path from 'path';
import type { BiliClient } from '../core/client.js';
import { assertOk } from '../core/client.js';
import { BaseEntity } from './BaseEntity.js';
import {
  CreativeAPI,
  COPYRIGHT,
  CREATION_STATEMENT,
  SPACE_HIDDEN,
  extractUposFilename,
  type AddArchivePayload,
  type AddArchiveResult,
  type ArchiveRichTextNode,
  type ArchiveStaff,
  type PreuploadResult,
  type UploadProgress,
  type UploadedPart,
} from '../api/creative.js';

/** 创建上传会话的选项。 */
export interface CreateVideoUploadOptions {
  /** 自定义上传文件名（含扩展名）；默认取 `path.basename(filePath)`。 */
  name?: string;
  /** 分片并发数；默认使用服务端建议的 `threads`。 */
  concurrency?: number;
  /** 每个分片的最大重试次数；默认使用服务端建议的 `chunk_retry`。 */
  retry?: number;
  /** 上传进度回调。 */
  onProgress?: (progress: UploadProgress) => void;
  /** 是否在上传后回读校验字节数（默认 `true`）。 */
  verify?: boolean;
}

/** 稿件可见性。 */
export type VideoVisibility = 'public' | 'self';

/** 字幕条目。 */
export interface SubtitleEntry {
  /** 本地 `.srt` 路径。 */
  filePath: string;
  /** 语言代码，如 `zh-CN`；留空表示不指定。 */
  lan: string;
}

/** 单个视频（分 P 时会有多个）。 */
export interface VideoPartOptions {
  /** 分 P 标题；不填则与稿件标题一致。 */
  title?: string;
  /** 分 P 简介。 */
  desc?: string;
  /** 自定义上传文件名（含扩展名）。 */
  name?: string;
}

interface VideoPartState {
  filePath: string;
  filename: string;
  size: number;
  title: string;
  desc: string;
  ticket: PreuploadResult | null;
  uploadId: string | null;
  uploaded: boolean;
}

function getWebOsCode(): 1 | 2 | 3 {
  if (process.platform === 'win32') return 1;
  if (process.platform === 'darwin') return 2;
  return 3;
}

function collectEndpoints(ticket: PreuploadResult): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const ep of [ticket.endpoint, ...(ticket.endpoints ?? [])]) {
    if (ep && !seen.has(ep)) {
      seen.add(ep);
      list.push(ep);
    }
  }
  return list.length > 0 ? list : [ticket.endpoint];
}

async function readExactSlice(
  fh: fs.FileHandle,
  start: number,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const buf = new Uint8Array(new ArrayBuffer(length));
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await fh.read(buf, offset, length - offset, start + offset);
    if (bytesRead <= 0) {
      throw new Error(`读取本地视频分片时遇到意外 EOF（期望 ${length} 字节，实际仅读到 ${offset} 字节）`);
    }
    offset += bytesRead;
  }
  return buf;
}

/**
 * 视频上传会话。
 *
 * 一次会话对应一个稿件（可以是分 P）。先 {@link upload}（或直接 {@link submit}）把文件传到 upos，
 * 再在会话上设置「发布视频」页面的各项配置并投递。
 *
 * 字段与线上投稿页 `getBasicParams` / `getSubmitParams` 一一对应。
 *
 * @example
 * ```ts
 * const session = await client.createVideoUpload('./video.mp4');
 * const { bvid } = await session
 *   .setTitle('我的视频')
 *   .setPartition(208, 1012)          // 或 await session.autoPartition()
 *   .setTags(['编程', '教程'])
 *   .setDescription('简介')
 *   .setCover('./cover.jpg')
 *   .setScheduleAt(new Date('2026-12-01T20:00:00+08:00'))
 *   .submit();
 * ```
 *
 * @example 分 P
 * ```ts
 * const session = await client.createVideoUpload('./p1.mp4');
 * await session.addPart('./p2.mp4', { title: '第二P' });
 * await session.setTitle('两P视频').autoPartition();
 * await session.setTags('a,b').submit();
 * ```
 */
export class VideoUploadSession extends BaseEntity<PreuploadResult | null> {
  /** 本地第一个视频路径。 */
  public readonly filePath: string;

  private readonly parts: VideoPartState[] = [];
  private readonly concurrency: number;
  private readonly retry: number;
  private readonly shouldVerify: boolean;
  private progressHandler?: (progress: UploadProgress) => void;
  private activeUpload: Promise<this> | null = null;

  // ---- 基本设置 ----
  private _title = '';
  private _creationStatementId: number | null = null;
  private _copyright: 1 | 2 | 3 | null = null;
  private _source = '';
  private _tid: number | null = null;
  private _humanType2: number | null = null;
  private _tags: string[] = [];
  private _desc = '';
  private _descFormatId = 0;
  private _descV2: ArchiveRichTextNode[] | null = null;
  private _dynamic = '';
  private _dynamicV2: ArchiveRichTextNode[] | null = null;
  private _cover: string | null = null;
  private _cover43: string | null = null;
  private _aiCover = false;
  private _dtime = 0;
  private _seasonId: number | null = null;
  private _sectionId: number | null = null;
  private _adorderId: number | null = null;
  private _adorderType: number | null = null;
  private _topicId: number | null = null;
  private _topicSource = '';

  // ---- 更多设置 ----
  private _watermark = false;
  private _visibility: VideoVisibility = 'public';
  private _spaceHidden: 1 | 2 = SPACE_HIDDEN.SHOW;
  private _allowRecreate = true;
  private _is360: -1 | 1 = -1;

  // ---- 视频元素 ----
  private _hasChapter = false;
  private _subtitleEnabled = true;
  private _subtitleLan = '';
  private readonly _subtitles: SubtitleEntry[] = [];
  private _preSubtitle = false;
  private _dolby = false;
  private _losslessMusic = false;

  // ---- 互动管理 ----
  private _closeDanmaku = false;
  private _closeReply = false;
  private _selectionReply = false;

  // ---- 其他 ----
  private _missionId: number | null = null;
  private _staffs: ArchiveStaff[] = [];
  private _premiere = false;
  private _actReserveCreate = false;
  private _actReserveCreateTitle = '';
  private _actReserveSid: number | null = null;
  private _pushToDynamic = true;

  constructor(
    client: BiliClient<any>,
    ticket: PreuploadResult | null,
    filePath: string,
    filename: string,
    fileSize: number,
    options: CreateVideoUploadOptions = {},
  ) {
    super(client, ticket);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error(`${filePath} 文件为空或大小无效（${fileSize}）`);
    }
    this.filePath = filePath;
    this.concurrency = Math.max(1, options.concurrency ?? ticket?.threads ?? 3);
    this.retry = Math.max(0, options.retry ?? ticket?.chunk_retry ?? 0);
    this.shouldVerify = options.verify ?? true;
    this.progressHandler = options.onProgress;
    this.parts.push({
      filePath,
      filename,
      size: fileSize,
      title: '',
      desc: '',
      ticket,
      uploadId: null,
      uploaded: false,
    });
  }

  // ==========================================
  // 只读视图
  // ==========================================

  /** 视频总字节数（所有分 P 之和）。 */
  get fileSize(): number {
    return this.parts.reduce((sum, p) => sum + p.size, 0);
  }

  /** 第一个视频的上传凭证。 */
  get ticket(): PreuploadResult | null {
    return this.parts[0]?.ticket ?? null;
  }

  /** 上传文件名（含扩展名）。 */
  get filename(): string {
    return this.parts[0]!.filename;
  }

  /** 第一个分 P 由服务端 `upos_uri` 分配的文件名（不含扩展名），投递时作为 `videos[0].filename`。 */
  get biliFilename(): string | null {
    const uri = this.parts[0]?.ticket?.upos_uri;
    return uri ? extractUposFilename(uri) : null;
  }

  /** 投递使用的文件名标识：优先取服务端 `upos_uri` 提取的 `biliFilename`，无凭证时回退本地文件名（不含扩展名）。 */
  get stem(): string {
    return this.biliFilename ?? path.parse(this.parts[0]!.filename).name;
  }

  /** 分 P 数量。 */
  get partCount(): number {
    return this.parts.length;
  }

  /** 是否所有分 P 都已上传完成。 */
  get uploaded(): boolean {
    return this.parts.length > 0 && this.parts.every((p) => p.uploaded);
  }

  /** 当前已配置的元数据快照（只读）。 */
  get meta(): Readonly<Record<string, unknown>> {
    return {
      title: this._title,
      creationStatementId: this._creationStatementId,
      copyright: this.copyright,
      tid: this._tid,
      humanType2: this._humanType2,
      tags: [...this._tags],
      desc: this._desc,
      descFormatId: this._descFormatId,
      dtime: this._dtime,
      seasonId: this._seasonId,
      sectionId: this._sectionId,
      cover: this._cover,
      cover43: this._cover43,
      visibility: this._visibility,
      spaceHidden: this._spaceHidden,
      allowRecreate: this._allowRecreate,
      pushToDynamic: this._pushToDynamic,
      watermark: this._watermark,
      subtitle: { enabled: this._subtitleEnabled, lan: this._subtitleLan, files: this._subtitles.length },
      dolby: this._dolby,
      losslessMusic: this._losslessMusic,
      closeDanmaku: this._closeDanmaku,
      closeReply: this._closeReply,
      selectionReply: this._selectionReply,
      parts: this.parts.length,
    };
  }

  // ==========================================
  // 基本设置
  // ==========================================

  /** 标题（≤ 80 字）。 */
  setTitle(title: string): this {
    const value = title.trim();
    if (!value) throw new Error('标题不能为空');
    if (value.length > 80) throw new Error('标题最多 80 字');
    this._title = value;
    return this;
  }

  /**
   * 创作声明（投稿页必填下拉框）。
   *
   * 新版投稿页把「自制 / 转载」合并进了创作声明，`copyright` 由它推导：
   * 转载声明 → `copyright=2`；其余 → `copyright=1`。
   *
   * 可用 ID 见 {@link CreativeAPI.creationStatements}；
   * 内置：`-1` 无声明、`-2` 转载。
   */
  setCreationStatement(id: number): this {
    if (!Number.isInteger(id)) throw new TypeError('创作声明 ID 必须是整数');
    this._creationStatementId = id;
    this._copyright = id === CREATION_STATEMENT.REPRINT ? COPYRIGHT.REPRINT : COPYRIGHT.ORIGINAL;
    return this;
  }

  /** 直接指定版权类型（1 自制 / 2 转载 / 3 未选择），会覆盖创作声明推导值。 */
  setCopyright(copyright: 1 | 2 | 3): this {
    this._copyright = copyright;
    return this;
  }

  /** 转载来源说明（`copyright === 2` 时填写）。 */
  setSource(source: string): this {
    this._source = source;
    return this;
  }

  /**
   * 分区。
   *
   * Web 端不接受任意 `tid`，推荐先用 {@link autoPartition} 由服务端预测。
   */
  setPartition(tid: number, humanType2?: number): this {
    if (!Number.isSafeInteger(tid) || tid <= 0) throw new TypeError('tid 必须是正整数');
    if (humanType2 !== undefined && (!Number.isSafeInteger(humanType2) || humanType2 <= 0)) {
      throw new TypeError('humanType2 必须是正整数');
    }
    this._tid = tid;
    this._humanType2 = humanType2 ?? null;
    return this;
  }

  /** 新版分区 ID。 */
  setHumanType2(humanType2: number): this {
    if (!Number.isSafeInteger(humanType2) || humanType2 <= 0) {
      throw new TypeError('humanType2 必须是正整数');
    }
    this._humanType2 = humanType2;
    return this;
  }

  /** 标签，支持 `'a,b'` 或 `['a','b']`，最多 10 个。 */
  setTags(tags: string | string[]): this {
    const list = (Array.isArray(tags) ? tags : tags.split(','))
      .map((t) => t.trim())
      .filter(Boolean);
    if (list.length > 10) throw new Error('标签最多 10 个');
    this._tags = list;
    return this;
  }

  /** 简介（≤ 2000 字，会清除此前设置的富文本节点）。 */
  setDescription(desc: string): this {
    if (desc.length > 2000) throw new Error('简介最多 2000 字');
    this._desc = desc;
    this._descV2 = null;
    return this;
  }

  /** 简介格式 ID（线上默认 `0`）。 */
  setDescFormatId(formatId: number): this {
    if (!Number.isInteger(formatId) || formatId < 0) {
      throw new TypeError('descFormatId 必须是非负整数');
    }
    this._descFormatId = formatId;
    return this;
  }

  /** 简介富文本（含 @ 用户 / 话题时使用；会同步生成纯文本 `desc`）。 */
  setDescriptionRich(nodes: ArchiveRichTextNode[]): this {
    this._descV2 = nodes;
    this._desc = nodes.map((n) => n.raw_text).join('');
    if (this._desc.length > 2000) throw new Error('简介最多 2000 字');
    return this;
  }

  /** 粉丝动态文案（≤ 233 字，会清除此前设置的富文本节点）。 */
  setDynamic(text: string): this {
    if (text.length > 233) throw new Error('粉丝动态最多 233 字');
    this._dynamic = text;
    this._dynamicV2 = null;
    return this;
  }

  /** 粉丝动态富文本（≤ 233 字）。 */
  setDynamicRich(nodes: ArchiveRichTextNode[]): this {
    const plain = nodes.map((n) => n.raw_text).join('');
    if (plain.length > 233) throw new Error('粉丝动态最多 233 字');
    this._dynamicV2 = nodes;
    this._dynamic = plain;
    return this;
  }

  /**
   * 封面。
   *
   * - 本地路径：投递前自动上传（`/x/vu/web/cover/up`）
   * - `http(s)://` 或 `//` 开头的 URL：直接使用
   */
  setCover(source: string, cover43?: string): this {
    this._cover = source;
    if (cover43) this._cover43 = cover43;
    return this;
  }

  /** 4:3 封面（支持本地路径或 URL）。 */
  setCover43(source: string): this {
    this._cover43 = source;
    return this;
  }

  /** 使用智能（AI）封面。需先在投稿页生成，此处只置标记。 */
  setAiCover(enabled = true): this {
    this._aiCover = enabled;
    return this;
  }

  /**
   * 定时发布。
   *
   * 约束（投稿页）：距当前最早 5 分钟、最晚 15 天。传 `null` 取消定时、立即发布。
   */
  setScheduleAt(when: Date | number | null): this {
    if (when === null) {
      this._dtime = 0;
      return this;
    }
    const seconds = when instanceof Date ? Math.floor(when.getTime() / 1000) : Math.floor(when);
    const now = Math.floor(Date.now() / 1000);
    if (seconds - now < 5 * 60) throw new Error('定时发布最早需距离当前 5 分钟');
    if (seconds - now > 15 * 24 * 3600) throw new Error('定时发布最晚不超过 15 天');
    this._dtime = seconds;
    return this;
  }

  /** 加入合集（投稿成功后自动调用合集接口；未传 `sectionId` 时自动取合集默认小节）。 */
  setSeason(seasonId: number, sectionId?: number): this {
    if (!Number.isSafeInteger(seasonId) || seasonId <= 0) throw new TypeError('seasonId 必须是正整数');
    if (sectionId !== undefined && (!Number.isSafeInteger(sectionId) || sectionId <= 0)) {
      throw new TypeError('sectionId 必须是正整数');
    }
    this._seasonId = seasonId;
    this._sectionId = sectionId ?? null;
    return this;
  }

  /** 商业推广（花火订单 / 商单）。 */
  setAdOrder(adorderId: number, adorderType?: number): this {
    this._adorderId = adorderId;
    this._adorderType = adorderType ?? null;
    return this;
  }

  /** 参与话题。 */
  setTopic(topicId: number, fromSource = 'search'): this {
    if (!Number.isSafeInteger(topicId) || topicId <= 0) throw new TypeError('topicId 必须是正整数');
    this._topicId = topicId;
    this._topicSource = fromSource;
    return this;
  }

  // ==========================================
  // 更多设置
  // ==========================================

  /** 添加水印（仅对此次上传的视频生效）。 */
  setWatermark(enabled: boolean): this {
    this._watermark = enabled;
    return this;
  }

  /** 可见范围：`public` 公开 / `self` 仅自己可见。 */
  setVisibility(visibility: VideoVisibility): this {
    this._visibility = visibility;
    return this;
  }

  /** 在个人空间-投稿中隐藏。 */
  setSpaceHidden(hidden: boolean): this {
    this._spaceHidden = hidden ? SPACE_HIDDEN.HIDE : SPACE_HIDDEN.SHOW;
    return this;
  }

  /** 是否允许二创。默认允许（`recreate = 1`；不允许为 `-1`）。 */
  setAllowRecreate(allowed: boolean): this {
    this._allowRecreate = allowed;
    return this;
  }

  /** 是否全景视频。 */
  setIs360(enabled: boolean): this {
    this._is360 = enabled ? 1 : -1;
    return this;
  }

  // ==========================================
  // 视频元素
  // ==========================================

  /** 是否已配置章节（章节内容本身需在投稿页「章节管理」中编辑）。 */
  setHasChapter(has: boolean): this {
    this._hasChapter = has;
    return this;
  }

  /**
   * 字幕设置。
   *
   * @param enabled 是否允许字幕投稿
   * @param lan 默认语言，可为空
   */
  setSubtitle(enabled = true, lan = ''): this {
    this._subtitleEnabled = enabled;
    this._subtitleLan = lan;
    return this;
  }

  /** 追加字幕文件（`.srt`），投递前会上传到 BFS 并预保存字幕草稿。 */
  addSubtitle(filePath: string, lan = ''): this {
    if (!/\.srt$/i.test(filePath)) throw new Error('字幕仅支持 .srt 文件');
    this._subtitles.push({ filePath, lan });
    return this;
  }

  /** 杜比音效。 */
  setDolby(enabled: boolean): this {
    this._dolby = enabled;
    return this;
  }

  /** Hi-Res 无损音质。 */
  setLosslessMusic(enabled: boolean): this {
    this._losslessMusic = enabled;
    return this;
  }

  // ==========================================
  // 互动管理
  // ==========================================

  /** 是否关闭弹幕。 */
  setCloseDanmaku(close: boolean): this {
    this._closeDanmaku = close;
    return this;
  }

  /** 是否关闭评论。 */
  setCloseReply(close: boolean): this {
    this._closeReply = close;
    return this;
  }

  /** 是否开启精选评论。 */
  setSelectionReply(on: boolean): this {
    this._selectionReply = on;
    return this;
  }

  // ==========================================
  // 其他
  // ==========================================

  /** 活动 / 任务 ID。 */
  setMission(missionId: number): this {
    this._missionId = missionId;
    return this;
  }

  /** 联合投稿成员。 */
  setStaffs(staffs: ArchiveStaff[]): this {
    this._staffs = staffs;
    return this;
  }

  /** 首映。 */
  setPremiere(enabled: boolean): this {
    this._premiere = enabled;
    return this;
  }

  /** 预约稿件（配合定时发布）。 */
  setActReserveCreate(enabled: boolean, title = ''): this {
    this._actReserveCreate = enabled;
    this._actReserveCreateTitle = title;
    return this;
  }

  /** 绑定已有预约活动。 */
  setActReserve(sid: number): this {
    this._actReserveSid = sid;
    return this;
  }

  /** 是否推送到粉丝动态（默认 `true`，对应 `no_disturbance = 0`；设为 `false` 表示不推动态 / 免打扰 `no_disturbance = 1`）。 */
  setPushToDynamic(push: boolean): this {
    this._pushToDynamic = push;
    return this;
  }

  /** 注册上传进度回调。 */
  onProgress(handler: (progress: UploadProgress) => void): this {
    this.progressHandler = handler;
    return this;
  }

  // ==========================================
  // 分 P
  // ==========================================

  /** 追加一个分 P。 */
  async addPart(filePath: string, options: VideoPartOptions = {}): Promise<this> {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error(`${filePath} 不是文件`);
    if (stat.size <= 0) throw new Error(`${filePath} 文件为空（0 字节），无法上传`);
    const filename = options.name ?? path.basename(filePath);
    this.parts.push({
      filePath,
      filename,
      size: stat.size,
      title: options.title ?? '',
      desc: options.desc ?? '',
      ticket: null,
      uploadId: null,
      uploaded: false,
    });
    return this;
  }

  /** 设置某个分 P 的标题（0 起）。 */
  setPartTitle(index: number, title: string): this {
    const part = this.parts[index];
    if (!part) throw new RangeError(`分 P ${index} 不存在`);
    part.title = title;
    return this;
  }

  // ==========================================
  // 服务端辅助
  // ==========================================

  /** 由服务端预测分区并自动填入 `tid` / `humanType2`。 */
  async autoPartition(): Promise<{ id: number; name: string; parent_name: string } | null> {
    const res = await CreativeAPI.predictTypes(this.client, {
      filename: this.biliFilename ?? this.filename,
      title: this._title,
      uploadId: this.parts[0]?.uploadId ?? undefined,
    });
    const first = (assertOk(res).data ?? [])[0];
    if (!first) return null;
    this.setPartition(first.id, first.human_type?.id);
    return { id: first.id, name: first.name, parent_name: first.parent_name };
  }

  /** 由服务端推荐标签（不自动写入）。 */
  async suggestTags(): Promise<string[]> {
    const res = await CreativeAPI.recommendTags(this.client, {
      subtypeId: this._tid ?? undefined,
      title: this._title,
      filename: this.biliFilename ?? this.filename,
      description: this._desc,
      uploadId: this.parts[0]?.uploadId ?? undefined,
    });
    return (assertOk(res).data ?? []).map((t) => t.tag);
  }

  /** 当前 `copyright`（由创作声明推导，或显式设置）。 */
  get copyright(): 1 | 2 | 3 {
    return this._copyright ?? COPYRIGHT.ORIGINAL;
  }

  // ==========================================
  // 上传
  // ==========================================

  /**
   * 上传所有分 P（并发 + 重试 + 备选节点切换 + 回读校验）。
   *
   * 重复调用会跳过已上传的分 P；不允许同一会话并发执行多次 `upload()`。
   */
  async upload(): Promise<this> {
    if (this.activeUpload) {
      throw new Error('该上传会话正在上传中，请勿并发重复调用 upload()');
    }
    const run = (async () => {
      for (let i = 0; i < this.parts.length; i++) {
        const part = this.parts[i]!;
        if (part.uploaded) continue;
        await this.uploadOne(part, i);
      }
      return this;
    })();
    this.activeUpload = run;
    try {
      return await run;
    } finally {
      this.activeUpload = null;
    }
  }

  private async withRetry<R>(
    ticket: PreuploadResult,
    fn: (endpoint: string) => Promise<R>,
  ): Promise<R> {
    const endpoints = collectEndpoints(ticket);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retry; attempt++) {
      const endpoint = endpoints[attempt % endpoints.length]!;
      try {
        return await fn(endpoint);
      } catch (err) {
        lastError = err;
        if (attempt < this.retry) {
          await new Promise((r) => setTimeout(r, (ticket.chunk_retry_delay ?? 1) * 1000));
        }
      }
    }
    throw lastError;
  }

  private async uploadOne(part: VideoPartState, videoIndex: number): Promise<void> {
    if (part.size <= 0) {
      throw new Error(`${part.filePath} 文件为空（0 字节），无法上传`);
    }
    const ticket = part.ticket ?? (await CreativeAPI.preupload(this.client, part.filename, part.size));
    part.ticket = ticket;

    const chunkSize = ticket.chunk_size;
    if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
      throw new Error(`服务端返回无效分片大小 chunk_size=${chunkSize}`);
    }

    const init = await this.withRetry(ticket, (endpoint) =>
      CreativeAPI.initUpload(this.client, ticket, part.size, { endpoint }),
    );
    part.uploadId = init.upload_id;

    const chunks = Math.ceil(part.size / chunkSize);
    const queue: number[] = Array.from({ length: chunks }, (_, i) => i);
    const uploaded: UploadedPart[] = new Array(chunks);
    let doneBytes = 0;
    let doneParts = 0;

    const fh = await fs.open(part.filePath, 'r');
    try {
      const worker = async (): Promise<void> => {
        for (;;) {
          const index = queue.shift();
          if (index === undefined) break;
          const start = index * chunkSize;
          const end = Math.min(start + chunkSize, part.size);
          const buf = await readExactSlice(fh, start, end - start);

          uploaded[index] = await this.withRetry(ticket, (endpoint) =>
            CreativeAPI.putPart(
              this.client,
              ticket,
              init.upload_id,
              buf,
              index,
              chunks,
              part.size,
              { endpoint },
            ),
          );

          doneBytes += buf.length;
          doneParts += 1;
          this.progressHandler?.({
            uploaded: doneBytes,
            total: part.size,
            percent: doneBytes / part.size,
            part: doneParts,
            parts: chunks,
            videoIndex,
          });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(this.concurrency, chunks) }, () => worker()),
      );
    } finally {
      await fh.close();
    }

    await this.withRetry(ticket, (endpoint) =>
      CreativeAPI.finishUpload(this.client, ticket, init.upload_id, uploaded, part.filename, { endpoint }),
    );

    if (this.shouldVerify) {
      const size = await this.withRetry(ticket, (endpoint) =>
        CreativeAPI.verifyUpload(this.client, ticket, { endpoint }),
      );
      if (size !== null && size !== part.size) {
        throw new Error(`上传校验失败：服务端 ${size} 字节，本地 ${part.size} 字节`);
      }
    }

    part.uploaded = true;
  }

  // ==========================================
  // 投递
  // ==========================================

  /** 构造投递请求体（不发送）。 */
  async buildArchivePayload(): Promise<AddArchivePayload> {
    if (!this._title) throw new Error('请先 setTitle()');
    if (this._tags.length === 0) throw new Error('请先 setTags()');
    const copyright = this.copyright;
    if (copyright === COPYRIGHT.REPRINT && !this._source.trim()) {
      throw new Error('转载稿件必须先调用 setSource() 填写转载来源');
    }
    if (this._tid === null) {
      const predicted = await this.autoPartition();
      if (!predicted) throw new Error('无法自动预测分区，请手动 setPartition(tid)');
    }
    if (this._visibility === 'self' && this._dtime > 0) {
      throw new Error('定时发布与「仅自己可见」互斥');
    }

    const videos = this.parts.map((p, index) => {
      if (!p.ticket) {
        throw new Error(`第 ${index + 1} 个分 P 尚未预上传，请先调用 upload()`);
      }
      return {
        filename: extractUposFilename(p.ticket.upos_uri),
        title: p.title || this._title,
        desc: p.desc,
        cid: p.ticket.biz_id,
        ...(index === 0 && this._preSubtitle ? { pre_subtitle: true } : {}),
      };
    });

    const cover = this._cover ? await this.resolveCover(this._cover) : undefined;
    const cover43 = this._cover43 ? await this.resolveCover(this._cover43) : undefined;

    const payload: AddArchivePayload = {
      videos,

      title: this._title,
      copyright,
      ...(copyright === COPYRIGHT.REPRINT && this._source ? { source: this._source } : {}),
      ...(this._creationStatementId !== null
        ? { creation_statement: { id: this._creationStatementId } }
        : {}),
      tid: this._tid as number,
      ...(this._humanType2 !== null ? { human_type2: this._humanType2 } : {}),
      tag: this._tags.join(','),
      desc: this._desc,
      desc_format_id: this._descFormatId,
      ...(this._descV2 ? { desc_v2: this._descV2 } : {}),
      ...(this._dtime > 0 ? { dtime: this._dtime } : {}),
      dynamic: this._dynamic,
      ...(this._dynamicV2 ? { dynamic_v2: this._dynamicV2 } : {}),
      ...(cover ? { cover } : {}),
      ...(cover43 ? { cover43 } : {}),
      ...(this._aiCover ? { ai_cover: true } : {}),
      ...(this._topicId !== null
        ? {
            topic_id: this._topicId,
            topic_detail: {
              from_topic_id: this._topicId,
              from_source: this._topicSource ? `arc.web.${this._topicSource}` : 'arc.web.',
            },
          }
        : {}),
      ...(this._missionId !== null ? { mission_id: this._missionId } : {}),

      is_only_self: this._visibility === 'self' ? 1 : 0,
      space_hidden: this._spaceHidden,
      watermark: { state: this._watermark ? 1 : 0 },
      recreate: this._allowRecreate ? 1 : -1,
      ...(this._is360 === 1 ? { is_360: 1 } : {}),

      ...(this._hasChapter ? { has_chapter: true } : {}),
      subtitle: { open: this._subtitleEnabled ? 0 : 1, lan: this._subtitleLan },
      dolby: this._dolby ? 1 : 0,
      lossless_music: this._losslessMusic ? 1 : 0,

      up_close_danmu: this._closeDanmaku,
      up_close_reply: this._closeReply,
      up_selection_reply: this._selectionReply,

      interactive: 0,
      act_reserve_create: this._actReserveCreate ? 1 : 0,
      ...(this._actReserveCreate && this._actReserveCreateTitle
        ? { act_reserve_create_title: this._actReserveCreateTitle }
        : {}),
      ...(this._actReserveSid !== null ? { act_reserve: { sid: this._actReserveSid } } : {}),
      ...(this._premiere ? { premiere: 1 as const } : {}),
      no_disturbance: this._pushToDynamic ? 0 : 1,
      no_reprint: copyright === COPYRIGHT.ORIGINAL ? 1 : 0,

      ...(this._staffs.length > 0
        ? { staffs: this._staffs, handle_staff: true }
        : {}),
      ...(this._adorderId !== null ? { adorder_id: this._adorderId } : {}),
      ...(this._adorderType !== null ? { adorder_type: this._adorderType } : {}),
      web_os: getWebOsCode(),
    };

    return payload;
  }

  /** 在 `add/v3` 前上传字幕并预保存字幕草稿（仅对第一个分 P 生效）。 */
  private async prepareSubtitles(): Promise<void> {
    if (this._subtitles.length === 0) {
      this._preSubtitle = false;
      return;
    }
    const oid = this.parts[0]?.ticket?.biz_id;
    if (!oid) throw new Error('缺少视频 cid，无法上传字幕');

    const files: { url: string; lan: string; subtitle_id: number }[] = [];
    for (const entry of this._subtitles) {
      const buf = await fs.readFile(entry.filePath);
      const url = await CreativeAPI.uploadSubtitle(this.client, buf, path.basename(entry.filePath));
      files.push({ url, lan: entry.lan, subtitle_id: 0 });
    }
    const res = await CreativeAPI.preSaveSubtitle(this.client, { oid, aid: 0, type: 1, files });
    assertOk(res);
    this._preSubtitle = true;
  }

  private async resolveSectionId(): Promise<number> {
    if (this._sectionId !== null) return this._sectionId;
    if (this._seasonId === null) throw new Error('未设置 seasonId 或 sectionId');

    const res = await CreativeAPI.listSeasons(this.client, 1, 100);
    const seasons = assertOk(res).data?.seasons ?? [];
    const target = seasons.find((s) => s.season?.id === this._seasonId);
    const sections = target?.sections?.sections;
    const sectionId = sections && sections.length > 0 ? sections[sections.length - 1]!.id : undefined;
    if (!sectionId) {
      throw new Error(`未找到合集 ${this._seasonId} 下的可用小节，请在 setSeason(seasonId, sectionId) 中显式指定 sectionId`);
    }
    return sectionId;
  }

  /** 投递稿件（需先 {@link upload}）。设过字幕时会在投稿前预保存；设过合集时会在投稿后加入合集。 */
  async publish(): Promise<AddArchiveResult> {
    if (!this.uploaded) throw new Error('请先 upload() 上传文件');
    await this.prepareSubtitles();
    const payload = await this.buildArchivePayload();
    const res = await CreativeAPI.addArchive(this.client, payload);
    const result = assertOk(res).data;

    if (this._seasonId !== null || this._sectionId !== null) {
      const firstCid = this.parts[0]?.ticket?.biz_id;
      if (!firstCid) {
        throw new Error(`稿件已投递成功（bvid=${result.bvid}, aid=${result.aid}），但缺少 cid 无法加入合集`);
      }
      try {
        const sectionId = await this.resolveSectionId();
        const seasonRes = await CreativeAPI.addEpisodesToSeason(this.client, {
          sectionId,
          episodes: [{ title: this._title, cid: firstCid, aid: result.aid }],
        });
        assertOk(seasonRes);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`稿件已投递成功（bvid=${result.bvid}, aid=${result.aid}），但加入合集失败: ${msg}`);
      }
    }

    return result;
  }

  /** 上传 + 投递，一步完成。 */
  async submit(): Promise<AddArchiveResult> {
    await this.upload();
    return this.publish();
  }

  private async resolveCover(source: string): Promise<string> {
    if (/^(https?:)?\/\//.test(source)) return source;
    if (/^data:/i.test(source)) return CreativeAPI.uploadCover(this.client, source);
    const buf = await fs.readFile(source);
    const ext = path.extname(source).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return CreativeAPI.uploadCover(this.client, buf, mime, path.basename(source));
  }
}
