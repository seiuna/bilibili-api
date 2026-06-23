export interface RequestContext {
  vid?: string;
  mid?: number;
  commentId?: string;
  oid?: number;
}

export interface BiliApiResponse<T = unknown> {
  code: number;
  message: string;
  ttl: number;
  data: T;
}

export interface QrcodeGenerateData {
  url: string;
  qrcode_key: string;
}
export interface QrcodePollData {
  url: string;
  refresh_token: string;
  timestamp: number;
  code: number;
  message: string;
}

export interface TvQrcodeGenerateData {
  url: string;
  auth_code: string;
}

export interface TvQrcodePollData {
  mid: number;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export enum QrcodeStatus {
  SUCCESS = 0,
  EXPIRED = 86038,
  NOT_CONFIRMED = 86090,
  NOT_SCANNED = 86101,
  TV_NOT_CONFIRMED = 86039,
}

export interface BiliConfig {
  cookie: string;
  refreshToken: string;
  accessToken?: string;
  tvRefreshToken?: string;
  mid?: number;
}

export interface AppKeyPair {
  appkey: string;
  appsec: string;
}

export const KNOWN_APPKEYS: Record<string, AppKeyPair> = {
  android: {
    appkey: '783bbb7264451d82',
    appsec: '2653583c8873dea268ab9386918b1d65',
  },
  tv: {
    appkey: '4409e2ce8ffd12b8',
    appsec: '59b43e04ad6965f34319062b478f83dd',
  },
  android_hd: {
    appkey: 'dfca71928277209b',
    appsec: 'b5475a8825547a4fc26c7d518eaaa02e',
  },
  /** 登录专用 */
  login: {
    appkey: 'bca7e84c2d947ac6',
    appsec: '60698ba2f68e01ce44738920a0ffe768',
  },
  third_party: {
    appkey: '27eb53fc9058f8c3',
    appsec: 'c2ed53a74eeefe3cf99fbd01d8c9c375',
  },
} as const;

export const ANDROID_ALT_KEY: AppKeyPair = {
  appkey: '1d8b6e7d45233436',
  appsec: '560c52ccd288fed045859ed18bffd973',
};
