import * as crypto from 'crypto';


/**
 * 对请求参数进行签名
 *
 * 签名算法：
 * 1. 将所有请求参数按 key 升序排列
 * 2. 拼接为 key=value&key=value... 的形式
 * 3. 末尾追加 appsec
 * 4. 对整个字符串计算 MD5
 *
 * @param params - 请求参数（不含 sign 本身）
 * @param appsec - APP 密钥
 * @returns 32 位小写 MD5 签名
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
