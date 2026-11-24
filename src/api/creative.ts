import { assertOk, type BiliClient } from '../core/client.js';
import type { BiliApiResponse } from '../core/types.js';

/**
 * 创作中心（投稿）底层 API。
 *
 * 字段与端点取自投稿页线上前端（`creator-monorepo/videoup` 的 `getBasicParams` /
 * `getSubmitParams`），因此与「发布视频」页面上的实际控件一一对应。
 *
 * 文件上传是 upos 分片协议（{@link CreativeAPI.preupload} 起 5 步），
 * 稿件投递是 {@link CreativeAPI.addArchive}。高层封装见 {@link VideoUploadSession}。
 */

const MEMBER_BASE = 'https://member.bilibili.com';
const MEMBER_REFERER = 'https://member.bilibili.com/platform/upload/video/frame';

/** 普通视频上传的 profile 标识。 */
export const UPLOAD_PROFILE = 'ugcfx/bup';

/**
 * 版权类型。线上前端常量：`{ORIGINAL:1, REPRINT:2, UNSELECTED:3}`。
 *
 * 新版投稿页把「自制/转载」合并进了 **创作声明**（`creation_statement`），
 * `copyright` 由所选声明推导：声明为转载 → 2；否则勾选了授权 → 1；否则 → 3。
 */
export const COPYRIGHT = { ORIGINAL: 1, REPRINT: 2, UNSELECTED: 3 } as const;

/**
 * 内置创作声明 ID（线上前端常量 `{NO_MARK:-1, REPRINT:-2}`）。
 *
 * 其余声明 ID 由 `GET /x/vupre/web/archive/pre` 的 `neutral_mark.mark_list` 下发。
 */
export const CREATION_STATEMENT = { NO_MARK: -1, REPRINT: -2 } as const;

/** 稿件可见性 / 空间可见性常量。 */
export const SPACE_HIDDEN = { HIDE: 1, SHOW: 2 } as const;

// ==========================================
// 预上传
// ==========================================

/** `GET /preupload` 返回的上传凭证。 */
export interface PreuploadResult {
  OK: number;
  /** 上传凭证，作为后续请求的 `X-Upos-Auth` 头；**有效期 5 天**。 */
  auth: string;
  /** 业务 ID，投递稿件时作为 `videos[].cid`。 */
  biz_id: number;
  /** 分片大小，实测恒为 10 MB。 */
  chunk_size: number;
  chunk_retry: number;
  chunk_retry_delay: number;
  /** 上传节点，如 `//upos-cs-upcdnbda2.bilivideo.com`。 */
  endpoint: string;
  endpoints: string[];
  put_query?: string;
  /** 服务端建议的并发数（实测 3）。 */
  threads: number;
  timeout: number;
  /** 上传地址，如 `upos://ugcfxever/n261121....mp4`。bucket 段会变，不可硬编码。 */
  upos_uri: string;
  [key: string]: unknown;
}

/** 初始化分片上传的返回。 */
export interface InitUploadResult {
  OK: number;
  bucket: string;
  key: string;
  /** 后续 PUT / 结束上传都需要它。 */
  upload_id: string;
}

/** 结束上传的返回。 */
export interface FinishUploadResult {
  OK: number;
  location?: string;
  bucket?: string;
  key?: string;
}

/** 一个已上传的分片。 */
export interface UploadedPart {
  partNumber: number;
  eTag: string;
}

/** upos 请求可选参数。 */
export interface UposRequestOptions {
  /** 覆盖使用的上传节点（默认取 `pre.endpoint`）。 */
  endpoint?: string;
  /** 外部中止/超时信号；未传时按 `pre.timeout` 生成超时信号。 */
  signal?: AbortSignal;
}

// ==========================================
// 投稿页辅助数据
// ==========================================

/** 创作声明条目。 */
export interface CreationStatementItem {
  id: number;
  content: string;
}

/** `GET /x/vupre/web/archive/pre` 的返回（节选）。 */
export interface ArchivePreData {
  /** 创作声明列表（投稿页「创作声明」下拉框）。 */
  neutral_mark?: { mark_list?: CreationStatementItem[] };
  /** 特殊投稿模式（如课程/活动投稿）时，分区固定为 21 且不传 desc_format_id。 */
  type_mode?: boolean;
  /** 当前用户可用的能力开关。 */
  white?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 预测稿件类型（分区）的候选。 */
export interface PredictedArchiveType {
  /** 子分区 ID，投递时作为 `tid`。 */
  id: number;
  parent: number;
  parent_name: string;
  name: string;
  description: string;
  rank: number;
  max_video_count: number;
  /** 新版分区 ID，投递时作为 `human_type2`。 */
  human_type: { id: number; name: string } | null;
  [key: string]: unknown;
}

/** 合集小节条目。 */
export interface SeasonSectionItem {
  id: number;
  title?: string;
  [key: string]: unknown;
}

/** 合集（合集管理）条目，结构对应 `/x2/creative/web/seasons`。 */
export interface SeasonItem {
  season: {
    id: number;
    title: string;
    is_pay?: boolean | number;
    has_charging_pay?: boolean | number;
    [key: string]: unknown;
  };
  sections?: {
    sections?: SeasonSectionItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** 话题搜索结果条目。 */
export interface TopicItem {
  id: number;
  name: string;
  description?: string;
  mission_id?: number;
  [key: string]: unknown;
}

/** `GET /x/vupre/web/topic/search` 返回结构。 */
export interface TopicSearchData {
  result?: {
    topics?: TopicItem[];
    tips?: unknown;
    has_create_jurisdiction?: boolean;
    is_new_topic?: boolean;
    [key: string]: unknown;
  };
  tags?: unknown;
  [key: string]: unknown;
}

/** 富文本节点（简介 / 粉丝动态里的 @ 和话题）。 */
export interface ArchiveRichTextNode {
  raw_text: string;
  /** 1 纯文本，2 @用户，4 投票，话题等。 */
  type?: number;
  biz_id?: string;
}

// ==========================================
// 稿件投递
// ==========================================

/** 稿件列表中的单个稿件。 */
export interface ArchiveListItem {
  Archive: {
    aid: number;
    bvid: string;
    title: string;
    desc: string;
    cover: string;
    state: number;
    state_desc?: string;
    reject_reason?: string;
  };
  [key: string]: unknown;
}

export interface ArchiveListData {
  arc_audits: ArchiveListItem[];
  page: { pn: number; ps: number; count: number };
  [key: string]: unknown;
}

/** 联合投稿成员。 */
export interface ArchiveStaff {
  title: string;
  mid: number;
}

/** `add/v3` 的单个视频（分 P 时数组有多项）。 */
export interface ArchiveVideoItem {
  /** 服务端预上传 `upos_uri` 中的文件名（**不含扩展名**），非本地文件名。 */
  filename: string;
  /** 分 P 标题（单 P 时与稿件标题一致即可）。 */
  title: string;
  desc: string;
  /** 上传接口返回的 `biz_id`。 */
  cid: number;
  /** 是否已在提交前预保存字幕草稿。 */
  pre_subtitle?: boolean;
  /** 是否已在提交前预保存播放器卡片/章节。 */
  pre_command?: boolean;
}

/** 投递稿件请求体。字段名与线上投稿页 `getBasicParams` + `getSubmitParams` 对齐。 */
export interface AddArchivePayload {
  videos: ArchiveVideoItem[];

  // ---- 基本设置 ----
  title: string;
  copyright: 1 | 2 | 3;
  /** 转载来源，`copyright === 2` 时必填。 */
  source?: string;
  /** 创作声明。 */
  creation_statement?: { id: number };
  tid: number;
  human_type2?: number;
  tag: string;
  desc: string;
  desc_format_id: number;
  desc_v2?: ArchiveRichTextNode[];
  /** 定时发布，Unix 秒；0 / 不传为立即发布。 */
  dtime?: number;
  dynamic: string;
  dynamic_v2?: ArchiveRichTextNode[];
  cover?: string;
  cover43?: string;
  /** 智能封面标记。 */
  ai_cover?: boolean;
  ai_cover_param?: { task_id: number; source: number };
  is_ab_cover?: boolean;
  ab_cover_info?: unknown;
  hidden_ab_cover_info?: unknown;
  /** 话题。 */
  topic_id?: number;
  topic_detail?: { from_topic_id: number; from_source: string };
  /** 活动 / 任务。 */
  mission_id?: number;

  // ---- 更多设置 ----
  /** 1 仅自己可见，0 公开。 */
  is_only_self?: 0 | 1;
  /** 空间投稿列表可见性：1 隐藏，2 显示（默认）。 */
  space_hidden?: 1 | 2;
  /** 添加水印。 */
  watermark?: { state: 0 | 1 };
  /** 商业水印（花火 / 必火等场景）。 */
  business_watermark?: { biz_code: string; state: 0 | 1 };
  /** 1 允许二创，-1 不允许（编辑模式默认 0）。 */
  recreate: -1 | 0 | 1;
  /** 是否全景视频：-1 否，1 是。 */
  is_360?: -1 | 1;

  // ---- 视频元素 ----
  /** 是否有章节配置。 */
  has_chapter?: boolean;
  /** 字幕投稿开关。 */
  subtitle?: { open: 0 | 1; lan: string };
  /** 杜比音效。 */
  dolby?: 0 | 1;
  /** Hi-Res 无损音质。 */
  lossless_music?: 0 | 1;

  // ---- 互动管理 ----
  up_close_danmu: boolean;
  up_close_reply: boolean;
  up_selection_reply: boolean;

  // ---- 分 P / 联合投稿 / 其他 ----
  interactive: 0 | 1;
  act_reserve_create: 0 | 1;
  act_reserve_create_title?: string;
  /** 预约活动。 */
  act_reserve?: { sid: number };
  /** 首映。 */
  premiere?: 1;
  /** 是否不推送到粉丝动态：1 不推送（免打扰），0 推送。 */
  no_disturbance: 0 | 1;
  /** 禁止转载：由 `copyright` 推导（自制 → 1）。 */
  no_reprint: 0 | 1;
  staffs?: ArchiveStaff[];
  handle_staff?: boolean;
  /** 商业推广（花火订单）。 */
  adorder_id?: number;
  adorder_type?: number;
  /** 商业推广 / 活动订单详情。 */
  porder?: unknown;
  /** 充电专属等付费配置。 */
  charging_pay?: number;
  coupon_id?: string;
  /** 投稿入口标识，线上系统类型：1 Windows / 2 macOS / 3 其他。 */
  web_os?: number;
  new_web_edit?: number;
  aid?: number;
  history_id?: number;
  [key: string]: unknown;
}

/** 投递结果。 */
export interface AddArchiveResult {
  aid: number;
  bvid: string;
}

/** 分片上传进度。 */
export interface UploadProgress {
  /** 已上传字节数。 */
  uploaded: number;
  /** 文件总字节数。 */
  total: number;
  /** 0–1。 */
  percent: number;
  /** 已完成的分片数。 */
  part: number;
  /** 分片总数。 */
  parts: number;
  /** 当前分片属于第几个视频（0 起）。 */
  videoIndex?: number;
}

// ==========================================
// 工具
// ==========================================

/** 从 `upos_uri` 提取服务端分配的文件名（不含扩展名），作为投递时 `videos[].filename`。 */
export function extractUposFilename(uposUri: string): string {
  const clean = uposUri.trim().replace(/^upos:\/\//i, '');
  const last = clean.split(/[\\/]/).pop() ?? '';
  if (!last) {
    throw new Error(`无效的 upos_uri，无法提取服务端文件名: ${uposUri}`);
  }
  const dot = last.lastIndexOf('.');
  return dot > 0 ? last.slice(0, dot) : last;
}

function toFormData(
  fields: Record<string, string>,
  file?: { field: string; data: Uint8Array; filename: string; type: string },
): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) {
    fd.append(file.field, new Blob([file.data as BlobPart], { type: file.type }), file.filename);
  }
  return fd;
}

function parseJsonResponse<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label}响应非合法 JSON: ${text.slice(0, 200)}`);
  }
}

function resolveUposSignal(pre: PreuploadResult, options?: UposRequestOptions): AbortSignal | undefined {
  if (options?.signal) return options.signal;
  if (typeof pre.timeout === 'number' && Number.isFinite(pre.timeout) && pre.timeout > 0) {
    return AbortSignal.timeout(pre.timeout * 1000);
  }
  return undefined;
}

export class CreativeAPI {
  // ------------------------------------------
  // 上传阶段
  // ------------------------------------------

  /**
   * 第 1 步：预上传，拿到凭证与目标地址。
   *
   * @param name 文件名，**含扩展名**（会影响返回的 upos_uri）
   * @param size 文件字节数
   */
  static async preupload(client: BiliClient<any>, name: string, size: number): Promise<PreuploadResult> {
    const params = new URLSearchParams({
      name,
      size: String(size),
      r: 'upos',
      profile: UPLOAD_PROFILE,
      ssl: '0',
      version: '2.14.0.0',
      build: '2140000',
      webVersion: '2.13.0',
    });
    const res = await client.request<PreuploadResult>(`${MEMBER_BASE}/preupload?${params}`, {
      headers: { Referer: MEMBER_REFERER },
    });
    if (res.OK !== 1) throw new Error(`预上传失败: ${JSON.stringify(res).slice(0, 300)}`);
    return res;
  }

  /** 由 `endpoint` + `upos_uri` 拼出真实上传地址。 */
  static uploadBaseUrl(pre: PreuploadResult, endpoint = pre.endpoint): string {
    const base = endpoint.startsWith('//')
      ? `https:${endpoint}`
      : /^https?:\/\//i.test(endpoint)
        ? endpoint
        : `https://${endpoint}`;
    const cleanBase = base.replace(/\/+$/, '');
    const cleanUri = pre.upos_uri.replace(/^upos:\/\//i, '').replace(/^\/+/, '');
    return `${cleanBase}/${cleanUri}`;
  }

  /** 第 2 步：初始化分片上传，拿 `upload_id`。 */
  static async initUpload(
    client: BiliClient<any>,
    pre: PreuploadResult,
    size: number,
    options?: UposRequestOptions,
  ): Promise<InitUploadResult> {
    const url = new URL(CreativeAPI.uploadBaseUrl(pre, options?.endpoint));
    url.searchParams.set('uploads', '');
    url.searchParams.set('output', 'json');
    url.searchParams.set('profile', UPLOAD_PROFILE);
    url.searchParams.set('filesize', String(size));
    url.searchParams.set('partsize', String(pre.chunk_size));
    url.searchParams.set('biz_id', String(pre.biz_id));

    const res = await client.rawRequest(url.toString(), {
      method: 'POST',
      headers: { 'X-Upos-Auth': pre.auth },
      signal: resolveUposSignal(pre, options),
      anonymous: true,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`初始化分片上传失败: HTTP ${res.status} ${text.slice(0, 200)}`.trim());
    const json = parseJsonResponse<InitUploadResult>(text, '初始化分片上传');
    if (json.OK !== 1 || !json.upload_id) {
      throw new Error(`初始化分片上传失败: ${text.slice(0, 300)}`);
    }
    return json;
  }

  /**
   * 第 3 步：上传单个分片。
   *
   * 实测 upos 的响应**不返回 ETag 头**，因此 `eTag` 取不到值；
   * 结束上传时传空字符串即可（官方 Demo 也硬编码了一个占位值）。
   */
  static async putPart(
    client: BiliClient<any>,
    pre: PreuploadResult,
    uploadId: string,
    buf: Uint8Array,
    index: number,
    chunks: number,
    total: number,
    options?: UposRequestOptions,
  ): Promise<UploadedPart> {
    const url = new URL(CreativeAPI.uploadBaseUrl(pre, options?.endpoint));
    url.searchParams.set('partNumber', String(index + 1));
    url.searchParams.set('uploadId', uploadId);
    url.searchParams.set('chunk', String(index));
    url.searchParams.set('chunks', String(chunks));
    url.searchParams.set('size', String(buf.length));
    url.searchParams.set('start', String(index * pre.chunk_size));
    url.searchParams.set('end', String(index * pre.chunk_size + buf.length));
    url.searchParams.set('total', String(total));

    const res = await client.rawRequest(url.toString(), {
      method: 'PUT',
      headers: { 'X-Upos-Auth': pre.auth, 'Content-Type': 'application/octet-stream' },
      body: buf,
      signal: resolveUposSignal(pre, options),
      anonymous: true,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`分片 ${index + 1} 上传失败: HTTP ${res.status} ${text.slice(0, 200)}`.trim());
    if (!text.includes('MULTIPART_PUT_SUCCESS')) {
      throw new Error(`分片 ${index + 1} 返回异常: ${text.slice(0, 200)}`);
    }
    return { partNumber: index + 1, eTag: (res.headers.get('etag') ?? '').replace(/"/g, '') };
  }

  /** 第 4 步：结束上传，合并分片。 */
  static async finishUpload(
    client: BiliClient<any>,
    pre: PreuploadResult,
    uploadId: string,
    parts: UploadedPart[],
    filename: string,
    options?: UposRequestOptions,
  ): Promise<FinishUploadResult> {
    const url = new URL(CreativeAPI.uploadBaseUrl(pre, options?.endpoint));
    url.searchParams.set('output', 'json');
    url.searchParams.set('name', filename);
    url.searchParams.set('profile', UPLOAD_PROFILE);
    url.searchParams.set('uploadId', uploadId);
    url.searchParams.set('biz_id', String(pre.biz_id));

    const res = await client.rawRequest(url.toString(), {
      method: 'POST',
      headers: { 'X-Upos-Auth': pre.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts }),
      signal: resolveUposSignal(pre, options),
      anonymous: true,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`结束上传失败: HTTP ${res.status} ${text.slice(0, 200)}`.trim());
    const json = parseJsonResponse<FinishUploadResult>(text, '结束上传');
    if (json.OK !== 1) throw new Error(`结束上传失败: ${text.slice(0, 300)}`);
    return json;
  }

  /** 第 5 步（可选）：回读校验，返回服务端记录的字节数。 */
  static async verifyUpload(
    client: BiliClient<any>,
    pre: PreuploadResult,
    options?: UposRequestOptions,
  ): Promise<number | null> {
    const res = await client.rawRequest(CreativeAPI.uploadBaseUrl(pre, options?.endpoint), {
      method: 'GET',
      headers: { 'X-Upos-Auth': pre.auth },
      signal: resolveUposSignal(pre, options),
      anonymous: true,
    });
    const len = res.headers.get('content-length');
    await res.body?.cancel().catch(() => undefined);
    if (!res.ok) throw new Error(`回读校验失败: HTTP ${res.status}`);
    if (len === null) return null;
    const num = Number(len);
    return Number.isFinite(num) ? num : null;
  }

  // ------------------------------------------
  // 投稿页初始化数据
  // ------------------------------------------

  /** 投稿页初始化数据：创作声明列表、能力位等。 */
  static async getArchivePre(client: BiliClient<any>): Promise<BiliApiResponse<ArchivePreData>> {
    return client.request(`${MEMBER_BASE}/x/vupre/web/archive/pre`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }

  /** 创作声明列表。 */
  static async creationStatements(client: BiliClient<any>): Promise<CreationStatementItem[]> {
    const res = await CreativeAPI.getArchivePre(client);
    return assertOk(res).data?.neutral_mark?.mark_list ?? [];
  }

  /** 预测稿件分区（Web 端不接受任意 tid，须以本接口第一个候选为准）。 */
  static async predictTypes(
    client: BiliClient<any>,
    options: { filename?: string; title?: string; uploadId?: string } = {},
  ): Promise<BiliApiResponse<PredictedArchiveType[]>> {
    const csrf = client.config.getCsrf();
    const body = toFormData({
      filename: options.filename ?? '',
      ...(options.title ? { title: options.title } : {}),
      ...(options.uploadId ? { upload_id: options.uploadId } : {}),
      csrf,
    });
    return client.request(`${MEMBER_BASE}/x/vupre/web/archive/types/predict?ts=${Date.now()}&csrf=${csrf}`, {
      method: 'POST',
      headers: { Referer: MEMBER_REFERER },
      body,
    });
  }

  /** 推荐标签。 */
  static async recommendTags(
    client: BiliClient<any>,
    options: {
      subtypeId?: number;
      title?: string;
      filename?: string;
      description?: string;
      coverUrl?: string;
      uploadId?: string;
    } = {},
  ): Promise<BiliApiResponse<{ tag: string; checked: number }[]>> {
    const params = new URLSearchParams({ t: String(Date.now()) });
    if (options.subtypeId !== undefined) params.set('subtype_id', String(options.subtypeId));
    if (options.title) params.set('title', options.title);
    if (options.filename) params.set('filename', options.filename);
    if (options.description) params.set('description', options.description);
    if (options.coverUrl) params.set('cover_url', options.coverUrl);
    if (options.uploadId) params.set('upload_id', options.uploadId);
    return client.request(`${MEMBER_BASE}/x/vupre/web/tag/recommend?${params}`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }

  /** 新版分区 ID 列表（`human_type2` 的来源）。 */
  static async newTypeList(
    client: BiliClient<any>,
  ): Promise<BiliApiResponse<{ type_list: { id: number; name: string }[] }>> {
    return client.request(`${MEMBER_BASE}/x/vupre/web/archive/human/type2/list?t=${Date.now()}`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }

  /** 话题搜索（投稿页「参与话题」）。 */
  static async searchTopics(
    client: BiliClient<any>,
    keyword: string,
    pageSize = 20,
    offset = 0,
  ): Promise<BiliApiResponse<TopicSearchData>> {
    const params = new URLSearchParams({
      keywords: keyword,
      page_size: String(pageSize),
      offset: String(offset),
      t: String(Date.now()),
    });
    return client.request(`${MEMBER_BASE}/x/vupre/web/topic/search?${params}`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }

  /** 合集列表（投稿页「加入合集」）。 */
  static async listSeasons(
    client: BiliClient<any>,
    pn = 1,
    ps = 30,
  ): Promise<BiliApiResponse<{ seasons?: SeasonItem[]; total?: number }>> {
    const params = new URLSearchParams({
      pn: String(pn),
      ps: String(ps),
      order: 'desc',
      sort: 'mtime',
      filter: '1',
      t: String(Date.now()),
    });
    return client.request(`${MEMBER_BASE}/x2/creative/web/seasons?${params}`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }

  /** 把新投递的稿件加入合集小节（线上新稿件投稿后使用）。 */
  static async addEpisodesToSeason(
    client: BiliClient<any>,
    options: {
      sectionId: number;
      episodes: { title: string; cid: number; aid: number; charging_pay?: number }[];
    },
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`${MEMBER_BASE}/x2/creative/web/season/section/episodes/add?t=${Date.now()}&csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Referer: MEMBER_REFERER },
      body: JSON.stringify({
        sectionId: options.sectionId,
        episodes: options.episodes,
        csrf,
      }),
    });
  }

  /** 把已投递的稿件切换 / 移出合集（编辑稿件时使用）。 */
  static async switchSeason(
    client: BiliClient<any>,
    options: { aid: number; title: string; seasonId?: number; sectionId?: number },
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`${MEMBER_BASE}/x2/creative/web/season/switch?t=${Date.now()}&csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Referer: MEMBER_REFERER },
      body: JSON.stringify({
        season_id: options.seasonId,
        section_id: options.sectionId,
        title: options.title,
        aid: options.aid,
        csrf,
      }),
    });
  }

  // ------------------------------------------
  // 封面 / 字幕
  // ------------------------------------------

  /**
   * 上传封面。
   *
   * 线上 `/x/vu/web/cover/up` 接收 `multipart/form-data` 中的 `cover` 文本字段，
   * 值为 `data:image/...;base64,...` Data URL 字符串。
   *
   * @returns 封面 URL
   */
  static async uploadCover(
    client: BiliClient<any>,
    image: Uint8Array | string,
    mime = 'image/jpeg',
    _filename?: string,
  ): Promise<string> {
    const csrf = client.config.getCsrf();
    const coverDataUrl = typeof image === 'string'
      ? (/^data:/i.test(image) ? image : `data:${mime};base64,${image}`)
      : `data:${mime};base64,${Buffer.from(image).toString('base64')}`;
    const body = toFormData({ cover: coverDataUrl, csrf });
    const res = await client.request<BiliApiResponse<{ url?: string }>>(
      `${MEMBER_BASE}/x/vu/web/cover/up?t=${Date.now()}`,
      { method: 'POST', headers: { Referer: MEMBER_REFERER }, body },
    );
    const url = assertOk(res).data?.url;
    if (!url) throw new Error('封面上传成功但未返回封面 URL');
    return url;
  }

  /**
   * 上传字幕文件（仅 `.srt`）。
   *
   * @returns 字幕 URL
   */
  static async uploadSubtitle(
    client: BiliClient<any>,
    srt: Uint8Array,
    filename: string,
  ): Promise<string> {
    if (!/\.srt$/i.test(filename)) throw new Error('字幕仅支持 .srt 文件');
    if (srt.byteLength <= 0) throw new Error('字幕文件不能为空');
    const csrf = client.config.getCsrf();
    const body = toFormData(
      { bucket: 'subtitle', csrf, content_type: 'application/x-subrip' },
      { field: 'file', data: srt, filename, type: 'application/x-subrip' },
    );
    const res = await client.request<BiliApiResponse<{ location?: string }>>(
      `https://api.bilibili.com/x/upload/web/image?t=${Date.now()}&csrf=${csrf}`,
      { method: 'POST', headers: { Referer: MEMBER_REFERER }, body },
    );
    const location = assertOk(res).data?.location;
    if (!location) throw new Error('字幕上传成功但未返回 location URL');
    return location.replace(/https?:/, 'http:');
  }

  /**
   * 把已上传的字幕挂到稿件草稿（投稿页在 `add/v3` 前调用，并置 `videos[0].pre_subtitle = true`）。
   *
   * @param oid 分 P 的 `cid`（即上传返回的 `biz_id`）
   * @param aid 稿件 aid，新投稿传 0
   */
  static async preSaveSubtitle(
    client: BiliClient<any>,
    options: {
      oid: number;
      aid?: number;
      type?: number;
      files: { url: string; lan: string; subtitle_id?: number; title?: string }[];
    },
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const normalizedFiles = options.files.map((f) => ({
      url: f.url,
      lan: f.lan,
      subtitle_id: f.subtitle_id ?? 0,
    }));
    const body = toFormData({
      oid: String(options.oid),
      type: String(options.type ?? 1),
      files: JSON.stringify(normalizedFiles),
      aid: String(options.aid ?? 0),
      csrf,
    });
    return client.request(`https://api.bilibili.com/x/v2/dm/subtitle/draft/preSave?t=${Date.now()}&csrf=${csrf}`, {
      method: 'POST',
      headers: { Referer: MEMBER_REFERER },
      body,
    });
  }

  // ------------------------------------------
  // 投递与稿件管理
  // ------------------------------------------

  /**
   * 提交前文本预检（标题、分 P 标题等）。
   *
   * @param content 待检查文本
   * @param checkItem 检查项：`1` 分 P 标题 / `2` 稿件标题
   */
  static async precheck(
    client: BiliClient<any>,
    content: string,
    checkItem: 1 | 2 | number = 2,
  ): Promise<BiliApiResponse<unknown>> {
    const params = new URLSearchParams({
      content,
      check_item: String(checkItem),
      t: String(Date.now()),
    });
    return client.request(`${MEMBER_BASE}/x/vupre/web/archive/precheck?${params}`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }

  /** 投递稿件，产生真正的稿件（会进入审核）。 */
  static async addArchive(
    client: BiliClient<any>,
    payload: AddArchivePayload,
  ): Promise<BiliApiResponse<AddArchiveResult>> {
    const csrf = client.config.getCsrf();
    return client.request(
      `${MEMBER_BASE}/x/vu/web/add/v3?web_location=333.1024&t=${Date.now()}&csrf=${csrf}`,
      {
        method: 'POST',
        wbi: true,
        headers: { 'Content-Type': 'application/json; charset=utf-8', Referer: MEMBER_REFERER },
        body: JSON.stringify({ ...payload, csrf }),
      },
    );
  }

  /** 编辑已投递的稿件。 */
  static async editArchive(
    client: BiliClient<any>,
    payload: AddArchivePayload & { aid: number },
  ): Promise<BiliApiResponse<AddArchiveResult>> {
    const csrf = client.config.getCsrf();
    return client.request(`${MEMBER_BASE}/x/vu/web/edit?t=${Date.now()}&csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Referer: MEMBER_REFERER },
      body: JSON.stringify({ ...payload, new_web_edit: payload.new_web_edit ?? 1, csrf }),
    });
  }

  /** 保存草稿（自动剔除线上草稿接口不接收的字段）。 */
  static async saveDraft(
    client: BiliClient<any>,
    payload: AddArchivePayload,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const {
      desc_format_id: _descFormatId,
      ai_cover_param: _aiCoverParam,
      interactive: _interactive,
      adorder_good_info_list: _adorderGoodInfoList,
      live_to_arc: _liveToArc,
      videos,
      ...rest
    } = payload;
    const cleanVideos = videos.map(({ pre_command: _preCommand, ...v }) => v);
    return client.request(`${MEMBER_BASE}/x/vupre/web/draft/add?t=${Date.now()}&csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Referer: MEMBER_REFERER },
      body: JSON.stringify({ ...rest, videos: cleanVideos, csrf }),
    });
  }

  /** 稿件列表（投稿后确认状态）。 */
  static async listArchives(
    client: BiliClient<any>,
    pn = 1,
    ps = 10,
  ): Promise<BiliApiResponse<ArchiveListData>> {
    const params = new URLSearchParams({ pn: String(pn), ps: String(ps) });
    return client.request(`${MEMBER_BASE}/x2/creative/web/archives/sp?${params}`, {
      headers: { Referer: MEMBER_REFERER },
    });
  }
}
