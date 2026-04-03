import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cliInfo, cliWarn, cliError } from '../../src/utils/cli-output.js';
import { logger } from '../../src/utils/logger.js';

describe('CLI Output', () => {
  let loggerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('cliInfo should call console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    cliInfo('test message');
    expect(spy).toHaveBeenCalledWith('test message');
    spy.mockRestore();
  });

  it('cliWarn should call console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cliWarn('test warning');
    expect(spy).toHaveBeenCalledWith('test warning');
    spy.mockRestore();
  });

  it('cliError should call console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    cliError('test error');
    expect(spy).toHaveBeenCalledWith('test error');
    spy.mockRestore();
  });
});
