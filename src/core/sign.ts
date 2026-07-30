import * as crypto from 'crypto';

/**
 * APP 签名算法：
 * 1. 参数中添加 appkey
 * 2. 按 key 升序排列
 * 3. URL query 序列化后拼接 appsec
 * 4. MD5 取 32 位小写
 */
export function signParams(
  params: Record<string, string | number>,
  appsec: string,
): string {
  const sortedKeys = Object.keys(params).sort();

  const query = sortedKeys
    .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`)
    .join('&');

  const signStr = query + appsec;
  return crypto.createHash('md5').update(signStr).digest('hex');
}

/**
 * 构建带 APP 签名的查询字符串
 */
export function buildSignedQuery(
  params: Record<string, string | number>,
  appkey: string,
  appsec: string,
): string {
  const withAppkey = { ...params, appkey };
  const sign = signParams(withAppkey, appsec);
  const allParams = { ...withAppkey, sign };

  return Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
}

// ---- WBI 签名 ----

/** WBI 重排映射表 */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

/** 打乱重排 imgKey + subKey 得到 mixinKey */
function getMixinKey(rawWbiKey: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => rawWbiKey[n]).join('').slice(0, 32);
}

/**
 * WBI 签名
 * @param params - 请求参数
 * @param imgKey - 从 nav 接口获取的 img_key
 * @param subKey - 从 nav 接口获取的 sub_key
 * @returns 添加了 w_rid 和 wts 的参数对象
 */
export function wbiSign(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
): Record<string, string> {
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = Math.floor(Date.now() / 1000);

  // 添加 wts，按键名升序排序
  const sortedParams: Record<string, string> = {};
  const allParams: Record<string, string | number> = { ...params, wts };
  for (const key of Object.keys(allParams).sort()) {
    // 过滤 value 中的 "!'()*" 字符
    const val = String(allParams[key]).replace(/[!'()*]/g, '');
    sortedParams[key] = val;
  }

  // 百分号编码（大写），空格编码为 %20
  const query = Object.entries(sortedParams)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, '%20')}`,
    )
    .join('&');

  const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');

  return { ...sortedParams, w_rid: wRid };
}

/**
 * 构建带 WBI 签名的查询字符串
 */
export function buildWbiSignedQuery(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
): string {
  const signed = wbiSign(params, imgKey, subKey);
  return Object.entries(signed)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
    )
    .join('&');
}