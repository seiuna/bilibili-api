import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UploadImageResult {
  image_url: string;
  image_width: number;
  image_height: number;
  img_size: number;
  ai_gen_pic: number;
}

export class UploadAPI {
  /** 上传本地图片文件 */
  static async image(client: BiliClient<any>, filePath: string): Promise<BiliApiResponse<UploadImageResult>> {
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    return UploadAPI.uploadBuffer(client, buffer, filename);
  }

  /** 上传 base64 图片 */
  static async uploadFromBase64(
    client: BiliClient<any>,
    base64: string,
    filename?: string,
  ): Promise<BiliApiResponse<UploadImageResult>> {
    let mime = 'image/png';
    let data = base64;

    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      mime = match[1];
      data = match[2];
    }

    const buffer = Buffer.from(data, 'base64');
    const ext = mime.split('/')[1] || 'png';
    const name = filename ?? `upload.${ext}`;

    return UploadAPI.uploadBuffer(client, buffer, name);
  }

  /** �?URL 下载图片并上�?*/
  static async uploadFromUrl(
    client: BiliClient<any>,
    url: string,
    filename?: string,
  ): Promise<BiliApiResponse<UploadImageResult>> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const urlPath = new URL(url).pathname;
    const name = filename ?? (path.basename(urlPath) || 'download.png');

    return UploadAPI.uploadBuffer(client, buffer, name);
  }

  /** 上传 Buffer �?B 站图�?*/
  static async uploadBuffer(
    client: BiliClient<any>,
    buffer: Buffer,
    filename: string,
  ): Promise<BiliApiResponse<UploadImageResult>> {
    const csrf = client.config.getCsrf();

    const boundary = `----BiliUpload${Date.now()}${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png'
      : ext === '.gif' ? 'image/gif'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';

    const parts: Buffer[] = [];
    const crlf = Buffer.from('\r\n');

    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file_up"; filename="${filename}"${crlf}`));
    parts.push(Buffer.from(`Content-Type: ${mime}${crlf}${crlf}`));
    parts.push(buffer);
    parts.push(Buffer.from(crlf));

    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="biz"${crlf}${crlf}`));
    parts.push(Buffer.from('new_dyn'));
    parts.push(Buffer.from(crlf));

    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="category"${crlf}${crlf}`));
    parts.push(Buffer.from('daily'));
    parts.push(Buffer.from(crlf));

    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="csrf"${crlf}${crlf}`));
    parts.push(Buffer.from(csrf));
    parts.push(Buffer.from(crlf));

    parts.push(Buffer.from(`--${boundary}--${crlf}`));

    const body = Buffer.concat(parts);
    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (client.config.data.cookie) {
      headers['Cookie'] = client.config.data.cookie;
    }

    const res = await fetch(
      'https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs',
      { method: 'POST', headers, body },
    );
    return res.json();
  }
}
