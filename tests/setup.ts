import { beforeAll, afterAll, afterEach } from 'vitest';
import { resetSharedLLMRequestGuard } from '../src/llm/request-guard.js';
import { logger } from '../src/utils/logger.js';

let originalSilent: boolean;

beforeAll(() => {
  originalSilent = (logger as { silent?: boolean }).silent ?? false;
  (logger as { silent: boolean }).silent = true;
});

afterAll(() => {
  (logger as { silent: boolean }).silent = originalSilent;
});

afterEach(() => {
  resetSharedLLMRequestGuard();
});
