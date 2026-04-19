import { afterEach, describe, expect, it, vi } from 'vitest';

describe('logger', () => {
  const originalDisableFileLogging = process.env.ORNN_DISABLE_FILE_LOGGING;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalDisableFileLogging === undefined) {
      delete process.env.ORNN_DISABLE_FILE_LOGGING;
    } else {
      process.env.ORNN_DISABLE_FILE_LOGGING = originalDisableFileLogging;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    vi.resetModules();
  });

  it('does not attach file transports when file logging is disabled', async () => {
    process.env.ORNN_DISABLE_FILE_LOGGING = '1';
    process.env.NODE_ENV = 'test';
    vi.resetModules();

    const { logger } = await import('../../src/utils/logger.js');
    const fileTransports = logger.transports.filter((transport) =>
      transport.constructor.name.toLowerCase().includes('file')
    );

    expect(fileTransports).toHaveLength(0);
  });
});
