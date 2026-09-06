import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let loadedLog4js: any = null;
try {
  loadedLog4js = require('log4js');
} catch {
  loadedLog4js = null;
}

/** 统一通用 Logger 接口 */
export interface ILogger {
  level?: string;
  category?: string;
  trace?(message: any, ...args: any[]): void;
  debug(message: any, ...args: any[]): void;
  info(message: any, ...args: any[]): void;
  warn(message: any, ...args: any[]): void;
  error(message: any, ...args: any[]): void;
  fatal?(message: any, ...args: any[]): void;
}

export type Logger = ILogger;

export type Log4jsConfiguration = any;

const LEVEL_WEIGHTS: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const LEVEL_COLORS: Record<string, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
};
const RESET = '\x1b[0m';

/** 内置零依赖轻量彩色控制台 Logger */
class LightweightConsoleLogger implements ILogger {
  public level: string;
  public category: string;

  constructor(category = 'bilibili-api', level?: string) {
    this.category = category;
    this.level = level || process.env.LOG_LEVEL || process.env.BILI_LOG_LEVEL || 'info';
  }

  private shouldLog(targetLevel: string): boolean {
    const currentWeight = LEVEL_WEIGHTS[this.level.toLowerCase()] ?? 2;
    const targetWeight = LEVEL_WEIGHTS[targetLevel.toLowerCase()] ?? 2;
    return targetWeight >= currentWeight;
  }

  private format(level: string, message: any, ...args: any[]): void {
    if (!this.shouldLog(level)) return;
    const now = new Date();
    const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ` +
                 `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const color = LEVEL_COLORS[level] || '';
    const prefix = `${color}[${time}] [${level.toUpperCase()}] [${this.category}]${RESET}`;
    if (level === 'error' || level === 'fatal') {
      console.error(prefix, message, ...args);
    } else if (level === 'warn') {
      console.warn(prefix, message, ...args);
    } else {
      console.log(prefix, message, ...args);
    }
  }

  trace(message: any, ...args: any[]): void { this.format('trace', message, ...args); }
  debug(message: any, ...args: any[]): void { this.format('debug', message, ...args); }
  info(message: any, ...args: any[]): void { this.format('info', message, ...args); }
  warn(message: any, ...args: any[]): void { this.format('warn', message, ...args); }
  error(message: any, ...args: any[]): void { this.format('error', message, ...args); }
  fatal(message: any, ...args: any[]): void { this.format('fatal', message, ...args); }
}

const customLoggers = new Map<string, ILogger>();
let hasConfigured = false;

/**
 * 允许用户注入自定义 Logger 实现（如 Winston、Pino 或外部 log4js 实例）
 */
export function setLogger(customLogger: ILogger, category = 'default'): void {
  customLoggers.set(category, customLogger);
}

/**
 * 配置日志系统：
 * - 若环境装有 log4js，将直接透传配置到 log4js
 * - 若无 log4js，支持同步设置全局默认日志等级
 */
export function configureLogger(config?: any): void {
  hasConfigured = true;
  if (loadedLog4js && config) {
    try {
      loadedLog4js.configure(config);
      return;
    } catch {
      // ignore
    }
  }

  if (config?.categories?.default?.level) {
    process.env.LOG_LEVEL = config.categories.default.level;
  }
}

/**
 * 获取指定分类的 Logger 实例
 */
export function getLogger(category = 'bilibili-api'): ILogger {
  if (customLoggers.has(category)) {
    return customLoggers.get(category)!;
  }
  if (customLoggers.has('default')) {
    return customLoggers.get('default')!;
  }

  if (loadedLog4js) {
    try {
      if (!hasConfigured) {
        configureLogger();
      }
      return loadedLog4js.getLogger(category);
    } catch {
      // fallback to lightweight
    }
  }

  const fallback = new LightweightConsoleLogger(category);
  customLoggers.set(category, fallback);
  return fallback;
}

/** 默认的 Logger 实例 */
export const logger: ILogger = getLogger();

export const log4js: any = loadedLog4js;
