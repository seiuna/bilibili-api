import log4js from 'log4js';
import type { Logger, Configuration } from 'log4js';

let isConfigured = false;

/**
 * 配置 log4js 日志系统
 * 如果不手动调用，首次获取 logger 时会自动初始化默认配置
 */
export function configureLogger(config?: Configuration): void {
  if (config) {
    log4js.configure(config);
    isConfigured = true;
    return;
  }

  if (isConfigured) return;

  const defaultLevel = process.env.LOG_LEVEL || process.env.BILI_LOG_LEVEL || 'info';

  log4js.configure({
    appenders: {
      out: {
        type: 'stdout',
        layout: {
          type: 'pattern',
          pattern: '%[[%d{yyyy-MM-dd hh:mm:ss.SSS}] [%p] [%c]%] %m',
        },
      },
    },
    categories: {
      default: {
        appenders: ['out'],
        level: defaultLevel,
      },
    },
  });

  isConfigured = true;
}

/**
 * 获取指定分类的 Logger 实例
 */
export function getLogger(category = 'bilibili-api'): Logger {
  if (!isConfigured) {
    configureLogger();
  }
  return log4js.getLogger(category);
}

/** 默认的 Logger 实例 */
export const logger: Logger = getLogger();

export { log4js };
export type { Logger, Configuration as Log4jsConfiguration };
