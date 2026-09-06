import { describe, it, expect } from 'vitest';
import { logger, getLogger, configureLogger } from './logger.js';

describe('Logger', () => {
  it('should get default logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should get logger with custom category', () => {
    const customLogger = getLogger('custom-category');
    expect(customLogger).toBeDefined();
    expect(customLogger.category).toBe('custom-category');
  });

  it('should support re-configuration', () => {
    expect(() => {
      configureLogger({
        appenders: {
          out: { type: 'stdout' },
        },
        categories: {
          default: { appenders: ['out'], level: 'debug' },
        },
      });
    }).not.toThrow();
  });
});
