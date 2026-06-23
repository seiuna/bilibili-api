import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
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
  constructor(private client: BiliClient) {}

  /**
   * 上传本地图片文件
   * @param filePath — 文件路径
   */
  async image(filePath: string): Promise<BiliApiResponse<UploadImageResult>> {
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    return this.uploadBuffer(buffer, filename);
  }

  /**
   * 上传 base64 图片
   * @param base64 — data:image/png;base64,xxxx 或纯 base64
   * @param filename — 指定文件名（可选，默认 upload.png）
   */
  async uploadFromBase64(
    base64: string,
    filename?: string,
  ): Promise<BiliApiResponse<UploadImageResult>> {
    let mime = 'image/png';
    let data = base64;

    // 解析 data URL: data:image/png;base64,xxxx
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      mime = match[1];
      data = match[2];
    }

    const buffer = Buffer.from(data, 'base64');
    const ext = mime.split('/')[1] || 'png';
    const name = filename ?? `upload.${ext}`;

    return this.uploadBuffer(buffer, name);
  }

  /**
   * 从 URL 下载图片并上传到 B 站图床
   * @param url — 图片 URL
   * @param filename — 指定文件名（可选，默认从 URL 提取）
   */
  async uploadFromUrl(
    url: string,
    filename?: string,
  ): Promise<BiliApiResponse<UploadImageResult>> {
    const fetcher = (this.client as any).customFetch ?? fetch;
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const urlPath = new URL(url).pathname;
    const name = filename ?? (path.basename(urlPath) || 'download.png');

    return this.uploadBuffer(buffer, name);
  }

  /**
   * 上传 Buffer 到 B 站图床（底层方法）
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
  ): Promise<BiliApiResponse<UploadImageResult>> {
    const csrf = this.extractCsrf();
    const fetcher = (this.client as any).customFetch ?? fetch;

    const boundary = `----BiliUpload${Date.now()}${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png'
      : ext === '.gif' ? 'image/gif'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';

    const parts: Buffer[] = [];
    const crlf = Buffer.from('\r\n');

    // file_up 字段（二进制）
    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file_up"; filename="${filename}"${crlf}`));
    parts.push(Buffer.from(`Content-Type: ${mime}${crlf}${crlf}`));
    parts.push(buffer);
    parts.push(Buffer.from(crlf));

    // biz 字段
    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="biz"${crlf}${crlf}`));
    parts.push(Buffer.from('new_dyn'));
    parts.push(Buffer.from(crlf));

    // category 字段
    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="category"${crlf}${crlf}`));
    parts.push(Buffer.from('daily'));
    parts.push(Buffer.from(crlf));

    // csrf 字段
    parts.push(Buffer.from(`--${boundary}${crlf}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="csrf"${crlf}${crlf}`));
    parts.push(Buffer.from(csrf));
    parts.push(Buffer.from(crlf));

    parts.push(Buffer.from(`--${boundary}--${crlf}`));

    const body = Buffer.concat(parts);
    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (this.client.config.data.cookie) {
      headers['Cookie'] = this.client.config.data.cookie;
    }

    const res = await fetcher(
      'https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs',
      { method: 'POST', headers, body },
    );
    return res.json();
  }

  private extractCsrf(): string {
    const c = this.client.config.data.cookie;
    const m = c.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    if (!m) throw new Error('缺少 CSRF Token（bili_jct），请先登录');
    return m[1];
  }
}
