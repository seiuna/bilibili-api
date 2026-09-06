import QRCode from 'qrcode';
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

// ---- Web 端二维码登录 ----

export async function loginByWebQrcode(
  config: ConfigManager,
  options: WebQrcodeLoginOptions = {},
): Promise<QrcodeLoginResult> {
  const { pollInterval = 2000, timeout = 180_000, onStatusChange } = options;

  // 1. 申请二维码
  const genRes = await fetch(
    'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
    { method: 'GET' },
  );

  if (!genRes.ok) {
    return { success: false, message: `申请二维码失败: HTTP ${genRes.status}` };
  }

  const genSetCookie = extractSetCookies(genRes.headers);
  if (Array.isArray(genSetCookie) ? genSetCookie.length > 0 : Boolean(genSetCookie)) {
    await config.mergeCookie(genSetCookie);
  }

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
    const pollRes = await fetch(pollUrl, {
      method: 'GET',
      headers: { Cookie: config.data.cookie },
      redirect: 'manual',
    });

    const pollJson: BiliApiResponse<QrcodePollData | null> = await pollRes.json();
    const dataCode = pollJson.data?.code ?? pollJson.code;

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
        if (Array.isArray(setCookie) ? setCookie.length > 0 : Boolean(setCookie)) {
          await config.setAuthCookies(setCookie);
        }

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
  const genRes = await fetch(
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

    const pollRes = await fetch(
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
        if (!data) return { success: false, message: '[TV] 登录返回数据为空' };

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
    keep?: boolean;
    captcha?: { challenge: string; validate: string; seccode: string };
  },
): Promise<PasswordLoginResult> {
  // 1. 获取公钥
  const keyRes = await fetch('https://passport.bilibili.com/x/passport-login/web/key');
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
    keep: String(options?.keep ?? true),
  });

  if (options?.captcha) {
    body.set('challenge', options.captcha.challenge);
    body.set('validate', options.captcha.validate);
    body.set('seccode', options.captcha.seccode);
  }

  const loginRes = await fetch('https://passport.bilibili.com/x/passport-login/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const setCookie = extractSetCookies(loginRes.headers);
  if (Array.isArray(setCookie) ? setCookie.length > 0 : Boolean(setCookie)) {
    await config.setAuthCookies(setCookie);
  }

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

  const refreshToken = loginJson.data?.refresh_token ?? '';
  if (refreshToken) await config.updateRefreshToken(refreshToken);

  return {
    success: true,
    cookie: config.data.cookie,
    refreshToken,
    message: '登录成功',
  };
}

/** RSA 公钥加密（使用 Web Crypto API 或 Node crypto） */
function cryptoPublicEncrypt(publicKeyPem: string, data: string): string {
  // Node.js 环境
  const { publicEncrypt, createPublicKey } = require('crypto') as typeof import('crypto');
  try {
    const pubKey = createPublicKey(
      `-----BEGIN PUBLIC KEY-----\n${publicKeyPem.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`,
    );
    const encrypted = publicEncrypt(
      { key: pubKey, padding: 1 /* RSA_PKCS1_PADDING */ },
      Buffer.from(data, 'utf-8'),
    );
    return encrypted.toString('base64');
  } catch {
    // 降级：直接用 PEM 字符串
    const encrypted = publicEncrypt(
      { key: publicKeyPem, padding: 1 },
      Buffer.from(data, 'utf-8'),
    );
    return encrypted.toString('base64');
  }
}

// ---- 短信登录 ----

export interface SmsLoginResult {
  success: boolean;
  cookie?: string;
  refreshToken?: string;
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
): Promise<BiliApiResponse<{ captcha_key: string }>> {
  const body = new URLSearchParams({
    cid: String(cid),
    tel: String(tel),
    login_session_id: loginSessionId,
    recaptcha_token: recaptchaToken,
    gee_challenge: geeChallenge,
    gee_validate: geeValidate,
    gee_seccode: geeSeccode,
  });

  const res = await fetch('https://passport.bilibili.com/x/passport-login/web/sms/send', {
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
): Promise<SmsLoginResult> {
  const body = new URLSearchParams({
    captcha_key: captchaKey,
    tel: String(tel),
    code: String(code),
    cid: String(cid),
  });

  const res = await fetch('https://passport.bilibili.com/x/passport-login/web/login/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const setCookie = extractSetCookies(res.headers);
  if (Array.isArray(setCookie) ? setCookie.length > 0 : Boolean(setCookie)) {
    await config.setAuthCookies(setCookie);
  }

  const json: BiliApiResponse<{
    status: number;
    message: string;
    refresh_token: string;
  }> = await res.json();

  if (json.code !== 0) {
    return { success: false, message: `短信登录失败: ${json.message} (code=${json.code})` };
  }

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

export async function logout(config: ConfigManager): Promise<BiliApiResponse<{ redirectUrl: string }>> {
  const csrf = config.getCsrf();
  const res = await fetch('https://passport.bilibili.com/login/exit/v2', {
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