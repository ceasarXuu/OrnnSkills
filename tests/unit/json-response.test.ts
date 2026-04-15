import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '../../src/utils/json-response.js';

describe('json response extraction', () => {
  it('extracts the valid json object even when malformed braces appear earlier in the response', () => {
    const raw = [
      '先说明一下：{bad json}',
      '最终输出如下：',
      '{"decision":"no_optimization","reason":"当前无需修改","confidence":0.92,"evidence":[]}',
    ].join('\n');

    expect(extractJsonObject(raw)).toBe(
      '{"decision":"no_optimization","reason":"当前无需修改","confidence":0.92,"evidence":[]}',
    );
  });

  it('extracts json from fenced blocks', () => {
    const raw = '```json\n{"decision":"need_more_context","reason":"继续观察","confidence":0.3,"evidence":[]}\n```';

    expect(extractJsonObject(raw)).toBe(
      '{"decision":"need_more_context","reason":"继续观察","confidence":0.3,"evidence":[]}',
    );
  });
});
