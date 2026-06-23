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
import { ConfigManager } from './config.js';

// ==========================================
// 二维码登录（Web 端 + TV 端）
// ==========================================

/** QR 码登录结果 */
export interface QrcodeLoginResult {
  success: boolean;
  /** 登录后返回的 cookie 字符串 */
  cookie?: string;
  /** refresh_token (Web 端) */
  refreshToken?: string;
  /** access_token (TV 端) */
  accessToken?: string;
  /** 用户 mid */
  mid?: number;
  /** 过期时间（秒），TV 端有效 */
  expiresIn?: number;
  /** 状态消息 */
  message: string;
}

/** 状态变化回调 */
export type QrcodeStatusCallback = (
  status: QrcodeStatus,
  message: string,
  /** 二维码 base64（仅 NOT_SCANNED 首次通知时携带） */
  qrcodeBase64?: string,
  /** 终端二维码字符串（仅 NOT_SCANNED 首次通知时携带） */
  qrcodeTerminal?: string,
) => void;

/** Web 端二维码登录配置 */
export interface WebQrcodeLoginOptions {
  /** 轮询间隔（毫秒），默认 2000 */
  pollInterval?: number;
  /** 最大等待时间（毫秒），默认 180000（3 分钟） */
  timeout?: number;
  /** 状态变化回调 */
  onStatusChange?: QrcodeStatusCallback;
}

/** TV 端二维码登录配置 */
export interface TvQrcodeLoginOptions extends WebQrcodeLoginOptions {
  /** APPKEY 密钥对，默认使用 tv 云视听小电视 */
  appKeyPair?: { appkey: string; appsec: string };
  /** TV 端 local_id，默认 0 */
  localId?: number;
}

// ==========================================
// 内部工具
// ==========================================

/**
 * 将 URL 同时生成为 base64 图片和终端可打印的二维码字符串
 * @returns base64 data URL 和 ANSI 终端二维码
 */
async function urlToQrcode(url: string): Promise<{ base64?: string; terminal?: string }> {
  // 分别调用，避免 toDataURL 在无 canvas 的 Node 环境中失败导致 terminal 也丢失
  const [base64, terminal] = await Promise.allSettled([
    QRCode.toDataURL(url, {
      width: 400,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }),
    QRCode.toString(url, {
      type: 'terminal',
      small: true,
    }),
  ]);
  return {
    base64: base64.status === 'fulfilled' ? base64.value : undefined,
    terminal: terminal.status === 'fulfilled' ? terminal.value : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Web 端二维码登录流程
 *
 * 1. 调用 generate 获取 qrcode_key 和二维码 url
 * 2. 将 url 转换为二维码 base64 + 终端字符（可在终端/UI 中渲染）
 * 3. 轮询 poll 接口直到扫码成功或超时
 * 4. 成功后从响应头提取 cookie
 */
export async function loginByWebQrcode(
  config: ConfigManager,
  options: WebQrcodeLoginOptions = {},
): Promise<QrcodeLoginResult> {
  const {
    pollInterval = 2000,
    timeout = 180_000,
    onStatusChange,
  } = options;

  // 1. 申请二维码
  const genRes = await fetch(
    'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
    { method: 'GET' },
  );

  if (!genRes.ok) {
    return {
      success: false,
      message: `申请二维码失败: HTTP ${genRes.status}`,
    };
  }

  const genSetCookie = genRes.headers.get('set-cookie');
  if (genSetCookie) {
    await config.mergeCookie(genSetCookie);
  }

  const genJson: BiliApiResponse<QrcodeGenerateData> = await genRes.json();

  if (genJson.code !== 0) {
    return {
      success: false,
      message: `申请二维码失败: ${genJson.message}`,
    };
  }

  const { qrcode_key, url } = genJson.data;

  let qrcodeBase64: string | undefined;
  let qrcodeTerminal: string | undefined;
  try {
    const qr = await urlToQrcode(url);
    qrcodeBase64 = qr.base64;
    qrcodeTerminal = qr.terminal;
  } catch {
  }

  onStatusChange?.(
    QrcodeStatus.NOT_SCANNED,
    `二维码已生成，请扫码: ${url}`,
    qrcodeBase64,
    qrcodeTerminal
  );

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await sleep(pollInterval);

    const pollUrl = `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`;

    const pollRes = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        Cookie: config.data.cookie,
      },
      redirect: 'manual',
    });

    const pollJson: BiliApiResponse<QrcodePollData | null> =
      await pollRes.json();

    const dataCode = pollJson.data?.code ?? pollJson.code;

    switch (dataCode) {
      case QrcodeStatus.NOT_SCANNED:
        break;

      case QrcodeStatus.NOT_CONFIRMED:
        onStatusChange?.(
          QrcodeStatus.NOT_CONFIRMED,
          '已扫码，请在手机上确认登录',
        );
        break;

      case QrcodeStatus.EXPIRED:
        return {
          success: false,
          message: '二维码已失效，请重新生成',
        };

      case QrcodeStatus.SUCCESS: {
        const setCookie = pollRes.headers.get('set-cookie');
        if (setCookie) {
          await config.setAuthCookies(setCookie);
        }

        const refreshToken = pollJson.data?.refresh_token ?? '';
        if (refreshToken) {
          await config.updateRefreshToken(refreshToken);
        }

        const timestamp = pollJson.data?.timestamp ?? 0;
        onStatusChange?.(
          QrcodeStatus.SUCCESS,
          `登录成功 (${new Date(timestamp).toISOString()})`,
        );

        return {
          success: true,
          cookie: config.data.cookie,
          refreshToken,
          message: '登录成功',
        };
      }

      default:
        return {
          success: false,
          message: `未知轮询状态: code=${dataCode}`,
        };
    }
  }

  return {
    success: false,
    message: '扫码登录超时',
  };
}



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

  const genBody = buildSignedQuery(
    { local_id: localId, ts },
    appkey,
    appsec,
  );

  const genRes = await fetch(
    'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: genBody,
    },
  );

  const genJson: BiliApiResponse<TvQrcodeGenerateData> = await genRes.json();

  if (genJson.code !== 0) {
    return {
      success: false,
      message: `[TV] 申请二维码失败: ${genJson.message} (code=${genJson.code})`,
    };
  }

  const { auth_code, url } = genJson.data;

  let qrcodeBase64: string | undefined;
  let qrcodeTerminal: string | undefined;
  try {
    const qr = await urlToQrcode(url);
    qrcodeBase64 = qr.base64;
    qrcodeTerminal = qr.terminal;
  } catch {
  }

  onStatusChange?.(
    QrcodeStatus.NOT_SCANNED,
    `[TV] 二维码已生成，请扫码: ${url}`,
    qrcodeBase64,
    qrcodeTerminal,
  );

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await sleep(pollInterval);

    const pollTs = Math.floor(Date.now() / 1000);
    const pollBody = buildSignedQuery(
      {
        auth_code,
        local_id: localId,
        ts: pollTs,
      },
      appkey,
      appsec,
    );

    const pollRes = await fetch(
      'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: pollBody,
      },
    );

    const pollJson: BiliApiResponse<TvQrcodePollData | null> =
      await pollRes.json();

    switch (pollJson.code) {
      case QrcodeStatus.NOT_SCANNED:
        break;

      case QrcodeStatus.NOT_CONFIRMED:
      case QrcodeStatus.TV_NOT_CONFIRMED:
        onStatusChange?.(
          QrcodeStatus.NOT_CONFIRMED,
          '[TV] 已扫码，请在手机上确认登录',
        );
        break;

      case QrcodeStatus.EXPIRED:
        return {
          success: false,
          message: '[TV] 二维码已失效，请重新生成',
        };

      case QrcodeStatus.SUCCESS: {
        const data = pollJson.data;
        if (!data) {
          return {
            success: false,
            message: '[TV] 登录返回数据为空',
          };
        }

        await config.updateTvTokens(data.access_token, data.refresh_token);
        if (data.mid) {
          await config.updateMid(data.mid);
        }

        onStatusChange?.(
          QrcodeStatus.SUCCESS,
          `[TV] 登录成功 (mid=${data.mid})`,
        );

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
        return {
          success: false,
          message: '[TV] API 校验密钥错误 (code=-3)',
        };
      case -400:
        return {
          success: false,
          message: '[TV] 请求错误 (code=-400)',
        };
      case -404:
        return {
          success: false,
          message: '[TV] 啥都木有 (code=-404)',
        };

      default:
        return {
          success: false,
          message: `[TV] 未知轮询状态: code=${pollJson.code}, msg=${pollJson.message}`,
        };
    }
  }

  return {
    success: false,
    message: '[TV] 扫码登录超时',
  };
}
