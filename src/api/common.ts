import type { BiliClient } from '../core/client.js';
import type { BiliApiResponse } from '../core/types.js';

/** 获取当前时间戳（秒级） */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/** 获取服务器时间戳 */
export async function getServerTimestamp(client: BiliClient<any>): Promise<number> {
  const data = await client.request<BiliApiResponse<{ now: number }>>(
    'https://api.bilibili.com/x/report/click/now',
  );
  return data.data.now;
}

// ---- BVID 与 AID 转换 ----

const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 1n << 51n;
const BASE = 58n;

const ALPHABET = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';

/** AV 号转 BV 号 */
export function av2bv(aid: number): string {
  const bytes = ['B', 'V', '1', '0', '0', '0', '0', '0', '0', '0', '0', '0'];
  let bvIndex = bytes.length - 1;
  let tmp = (MAX_AID | BigInt(aid)) ^ XOR_CODE;
  while (tmp > 0) {
    bytes[bvIndex] = ALPHABET[Number(tmp % BASE)];
    tmp = tmp / BASE;
    bvIndex -= 1;
  }
  [bytes[3], bytes[9]] = [bytes[9], bytes[3]];
  [bytes[4], bytes[7]] = [bytes[7], bytes[4]];
  return bytes.join('');
}

/** BV 号转 AV 号 */
export function bv2av(bvid: string): number {
  const bvidArr = Array.from(bvid);
  [bvidArr[3], bvidArr[9]] = [bvidArr[9], bvidArr[3]];
  [bvidArr[4], bvidArr[7]] = [bvidArr[7], bvidArr[4]];
  bvidArr.splice(0, 3);
  const tmp = bvidArr.reduce((pre, bvidChar) => pre * BASE + BigInt(ALPHABET.indexOf(bvidChar)), 0n);
  return Number((tmp & MASK_CODE) ^ XOR_CODE);
}

// ---- 图片格式化工具 ----

/**
 * 格式化 B 站图片 URL（添加 CDN 参数）
 * @param url - 原始图片 URL
 * @param options - 格式化选项
 */
export function formatImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'png' | 'jpeg' | 'webp' | 'avif';
    crop?: 0 | 1 | 2 | 3;
  } = {},
): string {
  const parts: string[] = [];
  if (options.width) parts.push(`${options.width}w`);
  if (options.height) parts.push(`${options.height}h`);
  if (options.quality) parts.push(`${options.quality}q`);
  if (options.crop !== undefined) parts.push(`${options.crop}c`);

  const suffix = parts.length > 0 ? `@${parts.join('_')}` : '';
  const format = options.format ? `.${options.format}` : '';

  return `${url}${suffix}${format}`;
}

/**
 * 获取图片主色
 */
export async function getImageAvgColor(
  client: BiliClient<any>,
  imageUrl: string,
): Promise<string> {
  const url = `${imageUrl}@.avg_color`;
  const data = await client.request<{ RGB: string }>(url);
  return data.RGB;
}

// ---- 基于 IP 的地理位置查询 ----

export interface IpLocationInfo {
  addr: string;
  country: string;
  province: string;
  city: string;
}

/**
 * 基于 IP 的地理位置查询
 */
export async function getIpLocation(
  client: BiliClient<any>,
  ip: string,
): Promise<BiliApiResponse<IpLocationInfo>> {
  return client.request(`https://api.bilibili.com/x/web-interface/zone?ip=${ip}`);
}

// ---- CommonAPI 汇聚 ----

export class CommonAPI {
  static getCurrentTimestamp = getCurrentTimestamp;
  static getServerTimestamp = getServerTimestamp;
  static av2bv = av2bv;
  static bv2av = bv2av;
  static formatImageUrl = formatImageUrl;
  static getImageAvgColor = getImageAvgColor;
  static getIpLocation = getIpLocation;
}
