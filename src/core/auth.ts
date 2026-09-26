import QRCode from 'qrcode';
import { constants, createPublicKey, publicEncrypt } from 'node:crypto';

/** Raw auth transport; must not persist response cookies or retry login requests. */
export type AuthTransport = (url: string, init?: globalThis.RequestInit) => Promise<Response>;

async function authRequest(transport: AuthTransport, url: string, init?: globalThis.RequestInit): Promise<Response> {
  const response = await transport(url, init);
  if (!response.ok) throw new Error(`认证请求失败: HTTP ${response.status}`);
  return response;
}
import type {
  BiliApiResponse,
  QrcodeGenerateData,
  QrcodePollData,
  TvQrcodeGenerateData,
  TvQrcodePollData,
} from './types.js';
import { QrcodeStatus, KNOWN_APPKEYS } from './types.js';
import { buildSignedQuery } from './sign.js';
import type { ConfigManager } from './config.js';

// ==========================================
// 登录模块 — 二维码 / 短信 / 密码
// ==========================================

/** QR 码登录结果 */
export interface QrcodeLoginResult {
  success: boolean;
  cookie?: string;
  refreshToken?: string;
  accessToken?: string;
  mid?: number;
  expiresIn?: number;
  message: string;
}

/** 状态变化回调 */
export type QrcodeStatusCallback = (
  status: QrcodeStatus,
  message: string,
  qrcodeBase64?: string,
  qrcodeTerminal?: string,
) => void;

/** Web 端二维码登录配置 */
export interface WebQrcodeLoginOptions {
  pollInterval?: number;
  timeout?: number;
  onStatusChange?: QrcodeStatusCallback;
}

/** TV 端二维码登录配置 */
export interface TvQrcodeLoginOptions extends WebQrcodeLoginOptions {
  appKeyPair?: { appkey: string; appsec: string };
  localId?: number;
}

// ---- 内部工具 ----

async function urlToQrcode(url: string): Promise<{ base64?: string; terminal?: string }> {
  const [base64, terminal] = await Promise.allSettled([
    QRCode.toDataURL(url, {
      width: 400,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }),
    QRCode.toString(url, { type: 'terminal', small: true }),
  ]);
  return {
    base64: base64.status === 'fulfilled' ? base64.value : undefined,
    terminal: terminal.status === 'fulfilled' ? terminal.value : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractSetCookies(headers: Headers): string | string[] {
  if (typeof headers.getSetCookie === 'function') {
    const list = headers.getSetCookie();
    if (list.length > 0) return list;
  }
  return headers.get('set-cookie') ?? '';
}

// Handles combined headers without splitting the comma inside Expires.
function cookiePairs(input: string | string[]): string[] {
  return (Array.isArray(input) ? input : [input]).flatMap(line =>
    line.split(/,(?=\s*[^=;,\s]+=)/).map(cookie => cookie.split(';', 1)[0].trim()).filter(Boolean),
  );
}

// ---- Web 端二维码登录 ----

export async function loginByWebQrcode(
  config: ConfigManager,
  options: WebQrcodeLoginOptions = {},
  transport: AuthTransport = fetch,
): Promise<QrcodeLoginResult> {
  const { pollInterval = 2000, timeout = 180_000, onStatusChange } = options;

  // 1. 申请二维码
  const genRes = await authRequest(transport,
    'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
    { method: 'GET' },
  );

  if (!genRes.ok) {
    return { success: false, message: `申请二维码失败: HTTP ${genRes.status}` };
  }

  // Generation cookies are session-local until authentication succeeds.
  const genSetCookie = extractSetCookies(genRes.headers);
  const sessionCookies = cookiePairs(genSetCookie);
  const pollCookie = [config.data.cookie, ...sessionCookies].filter(Boolean).join('; ');

  const genJson: BiliApiResponse<QrcodeGenerateData> = await genRes.json();
  if (genJson.code !== 0) {
    return { success: false, message: `申请二维码失败: ${genJson.message}` };
  }

  const { qrcode_key, url } = genJson.data;

  let qrcodeBase64: string | undefined;
  let qrcodeTerminal: string | undefined;
  try {
    const qr = await urlToQrcode(url);
    qrcodeBase64 = qr.base64;
    qrcodeTerminal = qr.terminal;
  } catch { /* ignore */ }

  onStatusChange?.(QrcodeStatus.NOT_SCANNED, `二维码已生成，请扫码: ${url}`, qrcodeBase64, qrcodeTerminal);

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await sleep(pollInterval);

    const pollUrl = `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`;
    const pollRes = await authRequest(transport, pollUrl, {
      method: 'GET',
      headers: { Cookie: pollCookie },
      redirect: 'manual',
    });

    const pollJson: BiliApiResponse<QrcodePollData | null> = await pollRes.json();
    if (pollJson.code !== 0) {
      return { success: false, message: `二维码轮询失败: ${pollJson.message} (code=${pollJson.code})` };
    }
    const dataCode = pollJson.data?.code;

    switch (dataCode) {
      case QrcodeStatus.NOT_SCANNED:
        break;

      case QrcodeStatus.NOT_CONFIRMED:
        onStatusChange?.(QrcodeStatus.NOT_CONFIRMED, '已扫码，请在手机上确认登录');
        break;

      case QrcodeStatus.EXPIRED:
        return { success: false, message: '二维码已失效，请重新生成' };

      case QrcodeStatus.SUCCESS: {
        const setCookie = extractSetCookies(pollRes.headers);
        if (cookiePairs(setCookie).length === 0) {
          return { success: false, message: '登录响应缺少 Cookie' };
        }
        await config.setAuthCookies([...sessionCookies, ...cookiePairs(setCookie)]);

        const refreshToken = pollJson.data?.refresh_token ?? '';
        if (refreshToken) await config.updateRefreshToken(refreshToken);

        const timestamp = pollJson.data?.timestamp ?? 0;
        onStatusChange?.(QrcodeStatus.SUCCESS, `登录成功 (${new Date(timestamp).toISOString()})`);

        return {
          success: true,
          cookie: config.data.cookie,
          refreshToken,
          message: '登录成功',
        };
      }

      default:
        return { success: false, message: `未知轮询状态: code=${dataCode}` };
    }
  }

  return { success: false, message: '扫码登录超时' };
}

// ---- TV 端二维码登录 ----

export async function loginByTvQrcode(
  config: ConfigManager,
  options: TvQrcodeLoginOptions = {},
  transport: AuthTransport = fetch,
): Promise<QrcodeLoginResult> {
  const {
    pollInterval = 2000,
    timeout = 180_000,
    onStatusChange,
    appKeyPair = KNOWN_APPKEYS.tv,
    localId = 0,
  } = options;

  const { appkey, appsec } = appKeyPair;
  const ts = Math.floor(Date.now() / 1000);

  const genBody = buildSignedQuery({ local_id: localId, ts }, appkey, appsec);
  const genRes = await authRequest(transport,
    'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: genBody,
    },
  );

  const genJson: BiliApiResponse<TvQrcodeGenerateData> = await genRes.json();
  if (genJson.code !== 0) {
    return { success: false, message: `[TV] 申请二维码失败: ${genJson.message} (code=${genJson.code})` };
  }

  const { auth_code, url } = genJson.data;

  let qrcodeBase64: string | undefined;
  let qrcodeTerminal: string | undefined;
  try {
    const qr = await urlToQrcode(url);
    qrcodeBase64 = qr.base64;
    qrcodeTerminal = qr.terminal;
  } catch { /* ignore */ }

  onStatusChange?.(QrcodeStatus.NOT_SCANNED, `[TV] 二维码已生成，请扫码: ${url}`, qrcodeBase64, qrcodeTerminal);

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await sleep(pollInterval);

    const pollTs = Math.floor(Date.now() / 1000);
    const pollBody = buildSignedQuery({ auth_code, local_id: localId, ts: pollTs }, appkey, appsec);

    const pollRes = await authRequest(transport,
      'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: pollBody,
      },
    );

    const pollJson: BiliApiResponse<TvQrcodePollData | null> = await pollRes.json();

    switch (pollJson.code) {
      case QrcodeStatus.NOT_SCANNED:
        break;

      case QrcodeStatus.NOT_CONFIRMED:
      case QrcodeStatus.TV_NOT_CONFIRMED:
        onStatusChange?.(QrcodeStatus.NOT_CONFIRMED, '[TV] 已扫码，请在手机上确认登录');
        break;

      case QrcodeStatus.EXPIRED:
        return { success: false, message: '[TV] 二维码已失效，请重新生成' };

      case QrcodeStatus.SUCCESS: {
        const data = pollJson.data;
        if (!data?.access_token || !data.refresh_token) return { success: false, message: '[TV] 登录返回凭证为空' };

        await config.updateTvTokens(data.access_token, data.refresh_token);
        if (data.mid) await config.updateMid(data.mid);

        onStatusChange?.(QrcodeStatus.SUCCESS, `[TV] 登录成功 (mid=${data.mid})`);

        return {
          success: true,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          mid: data.mid,
          expiresIn: data.expires_in,
          message: '登录成功',
        };
      }

      case -3:
        return { success: false, message: '[TV] API 校验密钥错误 (code=-3)' };
      case -400:
        return { success: false, message: '[TV] 请求错误 (code=-400)' };
      case -404:
        return { success: false, message: '[TV] 啥都木有 (code=-404)' };

      default:
        return { success: false, message: `[TV] 未知轮询状态: code=${pollJson.code}, msg=${pollJson.message}` };
    }
  }

  return { success: false, message: '[TV] 扫码登录超时' };
}

// ---- 密码登录 ----

export interface PasswordLoginResult {
  success: boolean;
  cookie?: string;
  refreshToken?: string;
  /** Raw server status; only 0 is accepted as completed login. */
  status?: number;
  /** Server-provided verification URL; never followed automatically. */
  url?: string;
  message: string;
}

/**
 * 密码登录流程
 * 1. 获取 RSA 公钥和 salt
 * 2. 用公钥加密 password（salt 前缀）
 * 3. 提交登录
 */
export async function loginByPassword(
  config: ConfigManager,
  username: string,
  password: string,
  options?: {
    /** @deprecated Modern Web endpoint documents keep=0 only; this flag is ignored. */
    keep?: boolean;
    captcha?: { token?: string; challenge: string; validate: string; seccode: string };
  },
  transport: AuthTransport = fetch,
): Promise<PasswordLoginResult> {
  const captcha = options?.captcha;
  if (!captcha?.token || !captcha.challenge || !captcha.validate || !captcha.seccode) {
    return { success: false, message: '密码登录需要完整 captcha: token/challenge/validate/seccode' };
  }
  // 1. 获取公钥
  const keyRes = await authRequest(transport, 'https://passport.bilibili.com/x/passport-login/web/key');
  const keyJson: BiliApiResponse<{ hash: string; key: string }> = await keyRes.json();

  if (keyJson.code !== 0) {
    return { success: false, message: `获取公钥失败: ${keyJson.message}` };
  }

  const { hash, key } = keyJson.data;

  // 2. RSA 加密密码 (hash + password)
  const encrypted = cryptoPublicEncrypt(key, hash + password);

  // 3. 提交登录
  const body = new URLSearchParams({
    username,
    password: encrypted,
    keep: '0',
    token: captcha.token,
  });

  if (options?.captcha) {
    body.set('challenge', options.captcha.challenge);
    body.set('validate', options.captcha.validate);
    body.set('seccode', options.captcha.seccode);
  }

  const loginRes = await authRequest(transport, 'https://passport.bilibili.com/x/passport-login/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const loginJson: BiliApiResponse<{
    status: number;
    message: string;
    url: string;
    refresh_token: string;
    timestamp: number;
  }> = await loginRes.json();

  if (loginJson.code !== 0) {
    return { success: false, message: `登录失败: ${loginJson.message} (code=${loginJson.code})` };
  }

  if (loginJson.data?.status !== 0) {
    return { success: false, status: loginJson.data?.status, url: loginJson.data?.url,
      message: loginJson.data?.message || '登录未完成，需要额外验证或返回状态未知' };
  }
  const setCookie = extractSetCookies(loginRes.headers);
  if (cookiePairs(setCookie).length === 0) return { success: false, message: '登录响应缺少 Cookie' };
  await config.setAuthCookies(cookiePairs(setCookie));

  const refreshToken = loginJson.data?.refresh_token ?? '';
  if (refreshToken) await config.updateRefreshToken(refreshToken);

  return {
    success: true,
    cookie: config.data.cookie,
    refreshToken,
    message: '登录成功',
  };
}

/** Node ESM RSA encryption with the Web endpoint's PKCS#1 v1.5 padding. */
function cryptoPublicEncrypt(publicKeyPem: string, data: string): string {
  const pem = publicKeyPem.includes('-----BEGIN') ? publicKeyPem
    : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem.replace(/\s/g, '').match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  return publicEncrypt(
    { key: createPublicKey(pem), padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(data, 'utf-8'),
  ).toString('base64');
}

// ---- 短信登录 ----

export interface SmsLoginResult {
  success: boolean;
  cookie?: string;
  refreshToken?: string;
  /** Raw server status; only 0 is accepted as completed login. */
  status?: number;
  /** Server-provided verification URL; never followed automatically. */
  url?: string;
  message: string;
}

/**
 * 发送短信验证码（Web 端）
 */
export async function sendSmsCode(
  config: ConfigManager,
  cid: number,
  tel: number,
  loginSessionId: string,
  recaptchaToken: string,
  geeChallenge: string,
  geeValidate: string,
  geeSeccode: string,
  transport: AuthTransport = fetch,
): Promise<BiliApiResponse<{ captcha_key: string }>> {
  const body = new URLSearchParams({
    cid: String(cid),
    tel: String(tel),
    // loginSessionId remains positional for compatibility; it is APP-only.
    source: 'main_web',
    token: recaptchaToken,
    challenge: geeChallenge,
    validate: geeValidate,
    seccode: geeSeccode,
  });

  const res = await authRequest(transport, 'https://passport.bilibili.com/x/passport-login/web/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  return res.json();
}

/**
 * 短信验证码登录（Web 端）
 */
export async function loginBySms(
  config: ConfigManager,
  captchaKey: string,
  tel: number,
  code: number,
  cid: number,
  transport: AuthTransport = fetch,
): Promise<SmsLoginResult> {
  const body = new URLSearchParams({
    captcha_key: captchaKey,
    tel: String(tel),
    code: String(code),
    cid: String(cid),
    source: 'main_web',
  });

  const res = await authRequest(transport, 'https://passport.bilibili.com/x/passport-login/web/login/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json: BiliApiResponse<{
    status: number;
    message: string;
    url?: string;
    refresh_token: string;
  }> = await res.json();

  if (json.code !== 0) {
    return { success: false, message: `短信登录失败: ${json.message} (code=${json.code})` };
  }

  if (json.data?.status !== 0) {
    return { success: false, status: json.data?.status, url: json.data?.url,
      message: json.data?.message || '短信登录未完成或返回状态未知' };
  }
  const setCookie = extractSetCookies(res.headers);
  if (cookiePairs(setCookie).length === 0) return { success: false, message: '登录响应缺少 Cookie' };
  await config.setAuthCookies(cookiePairs(setCookie));

  const refreshToken = json.data?.refresh_token ?? '';
  if (refreshToken) await config.updateRefreshToken(refreshToken);

  return {
    success: true,
    cookie: config.data.cookie,
    refreshToken,
    message: '登录成功',
  };
}

// ---- 退出登录 ----

export async function logout(config: ConfigManager, transport: AuthTransport = fetch): Promise<BiliApiResponse<{ redirectUrl: string }>> {
  const csrf = config.getCsrf();
  const res = await authRequest(transport, 'https://passport.bilibili.com/login/exit/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: config.data.cookie,
    },
    body: new URLSearchParams({ biliCSRF: csrf }).toString(),
  });

  const json: BiliApiResponse<{ redirectUrl: string }> = await res.json();

  if (json.code === 0) {
    // 清除本地凭证
    config.data.cookie = '';
    config.data.refreshToken = '';
    await config.save();
  }

  return json;
}