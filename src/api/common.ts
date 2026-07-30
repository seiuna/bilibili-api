import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

/** 获取当前时间戳（秒级�?*/
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

// ---- BVID �?AID 转换 ----

const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 2n ** 51n;
const BASE = 58n;

const ALPHABET = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';

/** AV 号转 BV �?*/
export function av2bv(aid: number): string {
  const aidBigInt = BigInt(aid);
  const bytes = [11, 10, 3, 8, 2, 1, 7, 4, 6, 5, 9, 0];
  const tmpArr: string[] = ['B', 'V', '1', '', '', '4', '', '1', '', '7', '', ''];

  let x = (aidBigInt ^ XOR_CODE) | MAX_AID;
  for (let i = 0; i < 6; i++) {
    const idx = Number(x % BASE);
    tmpArr[bytes[i]] = ALPHABET[idx];
    x = x / BASE;
  }

  // 交换 [3,9] �?[4,7]
  [tmpArr[3], tmpArr[9]] = [tmpArr[9], tmpArr[3]];
  [tmpArr[4], tmpArr[7]] = [tmpArr[7], tmpArr[4]];

  return tmpArr.join('');
}

/** BV 号转 AV �?*/
export function bv2av(bvid: string): number {
  const bytes = [11, 10, 3, 8, 2, 1, 7, 4, 6, 5, 9, 0];
  const tmpArr = bvid.split('');

  // 交换回来
  [tmpArr[3], tmpArr[9]] = [tmpArr[9], tmpArr[3]];
  [tmpArr[4], tmpArr[7]] = [tmpArr[7], tmpArr[4]];

  let x = 0n;
  for (let i = 0; i < 6; i++) {
    const idx = ALPHABET.indexOf(tmpArr[bytes[i]]);
    x = x * BASE + BigInt(idx);
  }

  const aid = (x & MASK_CODE) ^ XOR_CODE;
  return Number(aid);
}

// ---- 图片格式化工�?----

/**
 * 格式�?B 站图�?URL（添�?CDN 参数�?
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
 * 获取图片主色�?
 */
export async function getImageAvgColor(
  client: BiliClient<any>,
  imageUrl: string,
): Promise<string> {
  const url = `${imageUrl}@.avg_color`;
  const data = await client.request<{ RGB: string }>(url);
  return data.RGB;
}

// ---- 基于 IP 的地理位置查�?----

export interface IpLocationInfo {
  addr: string;
  country: string;
  province: string;
  city: string;
}

/**
 * 基于 IP 的地理位置查�?
 */
export async function getIpLocation(
  client: BiliClient<any>,
  ip: string,
): Promise<BiliApiResponse<IpLocationInfo>> {
  return client.request(`https://api.bilibili.com/x/web-interface/zone?ip=${ip}`);
}

// ---- CommonAPI 汇�?----

export class CommonAPI {
  static getCurrentTimestamp = getCurrentTimestamp;
  static getServerTimestamp = getServerTimestamp;
  static av2bv = av2bv;
  static bv2av = bv2av;
  static formatImageUrl = formatImageUrl;
  static getImageAvgColor = getImageAvgColor;
  static getIpLocation = getIpLocation;
}
