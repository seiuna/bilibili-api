import { describe, it, expect } from 'vitest';
import { logger, getLogger, configureLogger, setLogger } from './logger.js';

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

  it('should support injecting custom logger implementation via setLogger', () => {
    const logs: string[] = [];
    const mockCustomLogger = {
      debug: (msg: string) => logs.push(`debug:${msg}`),
      info: (msg: string) => logs.push(`info:${msg}`),
      warn: (msg: string) => logs.push(`warn:${msg}`),
      error: (msg: string) => logs.push(`error:${msg}`),
    };

    setLogger(mockCustomLogger, 'injected-cat');
    const injected = getLogger('injected-cat');
    injected.info('test-custom-message');

    expect(logs).toContain('info:test-custom-message');
  });
});
