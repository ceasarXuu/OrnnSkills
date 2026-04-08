import { describe, it, expect } from 'vitest';
import { CodexObserver } from '../../src/core/observer/codex-observer.js';

describe('CodexObserver', () => {
  it('should attach skill refs for exec_command reading a skill file', () => {
    const observer = new CodexObserver('/tmp/codex-sessions');

    const preprocessed = (observer as any).preprocessResponseItem('session-1', 'turn-1', {
      timestamp: '2026-04-08T10:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'functions.exec_command',
        arguments: JSON.stringify({
          cmd: 'cat /Users/xuzhang/.agents/skills/show-my-repo/SKILL.md',
        }),
      },
    });

    expect(preprocessed).toMatchObject({
      eventType: 'tool_call',
      skillRefs: ['show-my-repo'],
    });
  });
});
