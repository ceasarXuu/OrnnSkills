import { afterAll, afterEach } from 'vitest';
import { resetSharedLLMRequestGuard } from '../src/llm/request-guard.js';

const originalDisableFileLogging = process.env.ORNN_DISABLE_FILE_LOGGING;
process.env.ORNN_DISABLE_FILE_LOGGING = '1';

afterAll(() => {
  if (originalDisableFileLogging === undefined) {
    delete process.env.ORNN_DISABLE_FILE_LOGGING;
  } else {
    process.env.ORNN_DISABLE_FILE_LOGGING = originalDisableFileLogging;
  }
});

afterEach(() => {
  resetSharedLLMRequestGuard();
});
