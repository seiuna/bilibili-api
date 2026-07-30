import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface NoteInfo {
  arc: unknown;
  audit_status: number;
  cid_count: number;
  content: unknown;
  forbid_note_entrance: boolean;
  pub_reason: string;
  pub_status: number;
  pub_version: number;
  summary: string;
  tags: string[];
  title: string;
}

export interface NoteListItem {
  title: string;
  summary: string;
  mtime: number;
  arc: unknown;
  note_id: string;
  audit_status: number;
  web_url: string;
  note_id_str: string;
  message: string;
  forbid_note_entrance: boolean;
  likes: number;
  has_like: boolean;
}

export class NoteAPI {
  /** 检查视频是否禁止笔�?*/
  static async isForbid(
    client: BiliClient<any>,
    aid: number,
  ): Promise<BiliApiResponse<{ forbid_note_entrance: boolean }>> {
    return client.request(`https://api.bilibili.com/x/note/is_forbid?aid=${aid}`);
  }

  /** 获取笔记详细信息 */
  static async getInfo(
    client: BiliClient<any>,
    oid: number,
    noteId: string,
    oidType = 0,
  ): Promise<BiliApiResponse<NoteInfo>> {
    return client.request(
      `https://api.bilibili.com/x/note/info?oid=${oid}&oid_type=${oidType}&note_id=${noteId}`,
    );
  }

  /** 获取视频的笔记列�?*/
  static async getArchiveNotes(
    client: BiliClient<any>,
    oid: number,
    oidType = 0,
  ): Promise<BiliApiResponse<{ noteIds: string[] }>> {
    const csrf = client.config.getCsrf();
    return client.request(
      `https://api.bilibili.com/x/note/list/archive?oid=${oid}&oid_type=${oidType}&csrf=${csrf}`,
    );
  }

  /** 获取用户笔记列表 */
  static async getUserNotes(
    client: BiliClient<any>,
    ps = 10,
    pn = 1,
  ): Promise<BiliApiResponse<{ list: NoteListItem[]; page: { total: number; size: number; num: number } }>> {
    const csrf = client.config.getCsrf();
    return client.request(
      `https://api.bilibili.com/x/note/list?ps=${ps}&pn=${pn}&csrf=${csrf}`,
    );
  }

  /** 保存/创建笔记 */
  static async save(
    client: BiliClient<any>,
    oid: number,
    title: string,
    summary: string,
    content: string,
    options: {
      noteId?: string;
      oidType?: number;
      tags?: string;
      cls?: number;
      from?: string;
      contLen?: number;
      publish?: boolean;
      autoComment?: boolean;
    } = {},
  ): Promise<BiliApiResponse<{ note_id: string }>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({
      oid: String(oid),
      oid_type: String(options.oidType ?? 0),
      title,
      summary,
      content,
      csrf,
      platform: 'web',
    });
    if (options.noteId) body.set('note_id', options.noteId);
    if (options.tags) body.set('tags', options.tags);
    if (options.cls !== undefined) body.set('cls', String(options.cls));
    if (options.from) body.set('from', options.from);
    if (options.contLen !== undefined) body.set('cont_len', String(options.contLen));
    if (options.publish !== undefined) body.set('publish', String(options.publish ? 1 : 0));
    if (options.autoComment !== undefined) body.set('auto_comment', String(options.autoComment ? 1 : 0));
    return client.request('https://api.bilibili.com/x/note/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 删除笔记 */
  static async delete(
    client: BiliClient<any>,
    oid: number,
    noteId: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/note/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ oid: String(oid), note_id: noteId, csrf }).toString(),
    });
  }
}
