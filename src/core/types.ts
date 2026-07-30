export interface BiliApiResponse<T = unknown> {
  code: number;
  message: string;
  ttl: number;
  data: T;
}

export interface BiliConfig {
  cookie: string;
  refreshToken: string;
  accessToken?: string;
  tvRefreshToken?: string;
  mid?: number;
  /** WBI 签名密钥缓存 */
  wbiImgKey?: string;
  wbiSubKey?: string;
  /** WBI 密钥过期时间（毫秒） */
  wbiExpireAt?: number;
}

/** APP 密钥对 */
export interface AppKeyPair {
  appkey: string;
  appsec: string;
}

/** 已知 APPKEY */
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

/** 二维码状态码 */
export enum QrcodeStatus {
  SUCCESS = 0,
  EXPIRED = 86038,
  NOT_CONFIRMED = 86090,
  NOT_SCANNED = 86101,
  TV_NOT_CONFIRMED = 86039,
}

/** 二维码生成数据 */
export interface QrcodeGenerateData {
  url: string;
  qrcode_key: string;
}

/** 二维码轮询数据 */
export interface QrcodePollData {
  url: string;
  refresh_token: string;
  timestamp: number;
  code: number;
  message: string;
}

/** TV 二维码生成数据 */
export interface TvQrcodeGenerateData {
  url: string;
  auth_code: string;
}

/** TV 二维码轮询数据 */
export interface TvQrcodePollData {
  mid: number;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** 请求选项 */
export interface RequestOptions {
  /** 是否需要 WBI 签名 */
  wbi?: boolean;
  /** 是否需要 APP 签名 */
  appSign?: {
    appkey: string;
    appsec: string;
  };
  /** 是否自动检查 code（非 0 抛异常） */
  checked?: boolean;
  /** 额外 headers */
  headers?: Record<string, string>;
  /** 请求方法 */
  method?: string;
  /** 请求体 */
  body?: string;
}

/** 公共错误码 */
export const ERROR_CODES: Record<number, string> = {
  [-1]: '应用程序不存在或已被封禁',
  [-2]: 'Access Key 错误',
  [-3]: 'API 校验密匙错误',
  [-4]: '调用方对该 Method 没有权限',
  [-101]: '账号未登录',
  [-102]: '账号被封停',
  [-103]: '积分不足',
  [-104]: '硬币不足',
  [-105]: '验证码错误',
  [-106]: '账号非正式会员或在适应期',
  [-107]: '应用不存在或者被封禁',
  [-108]: '未绑定手机',
  [-110]: '未绑定手机',
  [-111]: 'csrf 校验失败',
  [-112]: '系统升级中',
  [-113]: '账号尚未实名认证',
  [-114]: '请先绑定手机',
  [-115]: '请先完成实名认证',
  [-304]: '木有改动',
  [-352]: '风控校验失败',
  [-400]: '请求错误',
  [-401]: '未认证',
  [-403]: '访问权限不足',
  [-404]: '啥都木有',
  [-405]: '不支持该方法',
  [-409]: '冲突',
  [-412]: '请求被拦截',
  [-500]: '服务器错误',
  [-503]: '过载保护,服务暂不可用',
  [-504]: '服务调用超时',
  [-509]: '超出限制',
  [-629]: '用户名或密码错误',
  [-799]: '请求过于频繁，请稍后再试',
};