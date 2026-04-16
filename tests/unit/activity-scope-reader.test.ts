import { describe, expect, it } from 'vitest';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';
import type { TaskEpisode } from '../../src/core/task-episode/index.js';
import type { AgentUsageRecord, Trace } from '../../src/types/index.js';
import {
  buildActivityScopeDetailFromData,
  buildActivityScopeSummariesFromData,
} from '../../src/dashboard/activity-scope-reader.js';

function makeEpisode(overrides: Partial<TaskEpisode> = {}): TaskEpisode {
  return {
    episodeId: 'episode-1',
    projectPath: '/tmp/ornn-project',
    runtime: 'codex',
    sessionIds: ['sess-1'],
    startedAt: '2026-04-16T00:00:00.000Z',
    lastActivityAt: '2026-04-16T00:01:00.000Z',
    state: 'collecting',
    traceRefs: ['trace-1', 'trace-2'],
    turnIds: ['turn-1', 'turn-2'],
    skillSegments: [
      {
        segmentId: 'segment-1',
        skillId: 'test-driven-development',
        shadowId: 'codex::test-driven-development@/tmp/ornn-project',
        runtime: 'codex',
        firstMappedTraceId: 'trace-1',
        lastRelatedTraceId: 'trace-2',
        mappedTraceIds: ['trace-1'],
        relatedTraceIds: ['trace-1', 'trace-2'],
        startedAt: '2026-04-16T00:00:00.000Z',
        lastActivityAt: '2026-04-16T00:01:00.000Z',
        status: 'active',
      },
    ],
    stats: {
      totalTraceCount: 2,
      totalTurnCount: 2,
      mappedTraceCount: 1,
      tracesSinceLastProbe: 2,
      turnsSinceLastProbe: 2,
    },
    probeState: {
      probeCount: 0,
      lastProbeTraceIndex: 0,
      lastProbeTurnIndex: 0,
      nextProbeTraceDelta: 20,
      nextProbeTurnDelta: 3,
      waitForEventTypes: [],
      mode: 'count_driven',
      consecutiveNeedMoreCount: 0,
      consecutiveReadyCount: 0,
    },
    analysisStatus: 'collecting',
    ...overrides,
  };
}

function makeDecisionEvent(overrides: Partial<DecisionEventRecord> = {}): DecisionEventRecord {
  return {
    id: 'event-1',
    timestamp: '2026-04-16T00:01:10.000Z',
    tag: 'analysis_requested',
    skillId: 'test-driven-development',
    runtime: 'codex',
    windowId: 'sess-1::test-driven-development',
    traceId: 'trace-2',
    sessionId: 'sess-1',
    status: 'window_ready',
    detail: '当前窗口已积累到初始观察量，提交首次窗口分析。',
    confidence: null,
    changeType: null,
    reason: null,
    strategy: null,
    traceCount: 2,
    sessionCount: 1,
    ruleName: null,
    linesAdded: null,
    linesRemoved: null,
    runtimeDrift: null,
    evidence: null,
    ...overrides,
  };
}

function makeTrace(traceId: string, timestamp: string, overrides: Partial<Trace> = {}): Trace {
  return {
    trace_id: traceId,
    runtime: 'codex',
    session_id: 'sess-1',
    turn_id: traceId.replace('trace', 'turn'),
    event_type: 'assistant_output',
    timestamp,
    assistant_output: `assistant output for ${traceId}`,
    status: 'success',
    skill_refs: ['test-driven-development'],
    metadata: {},
    ...overrides,
  };
}

describe('activity scope reader', () => {
  it('builds an observing summary for an open episode', () => {
    const summaries = buildActivityScopeSummariesFromData({
      projectName: 'ornn-project',
      episodes: [makeEpisode()],
      decisionEvents: [],
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        scopeId: 'episode-1',
        createdAt: '2026-04-16T00:00:00.000Z',
        skillId: 'test-driven-development',
        runtime: 'codex',
        projectName: 'ornn-project',
        status: 'observing',
      }),
    ]);
  });

  it('builds a terminal no-optimization summary from a completed episode', () => {
    const summaries = buildActivityScopeSummariesFromData({
      projectName: 'ornn-project',
      episodes: [makeEpisode({
        state: 'closed',
        analysisStatus: 'completed',
        lastActivityAt: '2026-04-16T00:02:00.000Z',
      })],
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-eval',
          episodeId: 'episode-1',
          tag: 'evaluation_result',
          status: 'no_patch_needed',
          timestamp: '2026-04-16T00:02:00.000Z',
          detail: '窗口分析结论：当前无需修改。',
        }),
      ],
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        scopeId: 'episode-1',
        status: 'no_optimization',
        updatedAt: '2026-04-16T00:02:00.000Z',
      }),
    ]);
  });

  it('keeps a failed episode visible as an observing scope', () => {
    const summaries = buildActivityScopeSummariesFromData({
      projectName: 'ornn-project',
      episodes: [makeEpisode({
        state: 'closed',
        analysisStatus: 'failed',
        lastActivityAt: '2026-04-16T00:02:00.000Z',
      })],
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-submit',
          episodeId: 'episode-1',
          timestamp: '2026-04-16T00:01:10.000Z',
        }),
        makeDecisionEvent({
          id: 'event-failed',
          episodeId: 'episode-1',
          tag: 'analysis_failed',
          status: 'failed',
          timestamp: '2026-04-16T00:01:40.000Z',
          detail: '当前项目没有可用的模型服务配置，所以这轮分析没有开始。',
          reason: 'provider_not_configured',
        }),
      ],
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        scopeId: 'episode-1',
        status: 'observing',
        updatedAt: '2026-04-16T00:01:40.000Z',
      }),
    ]);
  });

  it('builds timeline detail for an observing scope with analysis submission and continue-collecting result', () => {
    const detail = buildActivityScopeDetailFromData({
      lang: 'zh',
      projectName: 'ornn-project',
      episode: makeEpisode(),
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-submit',
          episodeId: 'episode-1',
          traceCount: 2,
          timestamp: '2026-04-16T00:01:10.000Z',
        }),
        makeDecisionEvent({
          id: 'event-result',
          episodeId: 'episode-1',
          tag: 'evaluation_result',
          status: 'continue_collecting',
          timestamp: '2026-04-16T00:01:40.000Z',
          detail: '当前窗口证据仍不足，继续扩大观察范围。',
          reason: '当前窗口证据仍不足，继续扩大观察范围。',
        }),
      ],
      agentUsageRecords: [
        {
          id: 'usage-1',
          timestamp: '2026-04-16T00:01:39.000Z',
          scope: 'skill_call_analyzer',
          eventId: 'sess-1::test-driven-development',
          skillId: 'test-driven-development',
          model: 'deepseek/deepseek-reasoner',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          durationMs: 3000,
          episodeId: 'episode-1',
          triggerTraceId: 'trace-2',
          windowId: 'sess-1::test-driven-development',
        } as AgentUsageRecord,
      ],
      traces: [
        makeTrace('trace-1', '2026-04-16T00:00:00.000Z'),
        makeTrace('trace-2', '2026-04-16T00:01:00.000Z', {
          event_type: 'tool_call',
          tool_name: 'exec_command',
          tool_args: { cmd: 'npm test' },
        }),
      ],
    });

    expect(detail?.status).toBe('observing');
    expect(detail?.timeline.map((node) => node.type)).toEqual([
      'skill_called',
      'analysis_submitted',
      'analysis_result',
    ]);
    expect(detail?.timeline[1]).toMatchObject({
      model: 'deepseek/deepseek-reasoner',
      traceCount: 2,
    });
    expect(detail?.timeline[1]?.charCount).toBeGreaterThan(0);
    expect(detail?.timeline[1]?.traceText).toContain('assistant output for trace-1');
    expect(detail?.timeline[2]).toMatchObject({
      summary: '当前窗口证据仍不足，继续扩大观察范围。',
      outcome: 'need_more_context',
    });
  });

  it('compacts submitted traces to high-signal summaries', () => {
    const noisyAssistantOutput = `先说明修复方案。${'无意义噪声 '.repeat(120)}不要把这个尾巴完整带进分析。`;
    const detail = buildActivityScopeDetailFromData({
      lang: 'zh',
      projectName: 'ornn-project',
      episode: makeEpisode({
        traceRefs: ['trace-1', 'trace-2', 'trace-3'],
        stats: {
          totalTraceCount: 3,
          totalTurnCount: 3,
          mappedTraceCount: 1,
          tracesSinceLastProbe: 3,
          turnsSinceLastProbe: 3,
        },
      }),
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-submit',
          episodeId: 'episode-1',
          traceCount: 3,
          timestamp: '2026-04-16T00:01:10.000Z',
        }),
      ],
      agentUsageRecords: [],
      traces: [
        makeTrace('trace-1', '2026-04-16T00:00:00.000Z', {
          assistant_output: noisyAssistantOutput,
        }),
        makeTrace('trace-2', '2026-04-16T00:00:30.000Z', {
          event_type: 'tool_call',
          tool_name: 'exec_command',
          tool_args: {
            cmd: 'npm test',
            workdir: '/tmp/ornn-project',
            max_output_tokens: 16000,
            yield_time_ms: 1000,
            login: true,
            extra_blob: 'X'.repeat(600),
          },
        }),
        makeTrace('trace-3', '2026-04-16T00:00:50.000Z', {
          event_type: 'tool_result',
          tool_name: 'exec_command',
          tool_result: {
            exit_code: 0,
            stdout: `PASS${' output'.repeat(80)}`,
            stderr: '',
            max_output_tokens: 16000,
          },
        }),
      ],
    });

    const submitted = detail?.timeline.find((node) => node.type === 'analysis_submitted');
    expect(submitted?.traceText).toContain('助手输出: 先说明修复方案。');
    expect(submitted?.traceText).toContain('工具调用: exec_command cmd=npm test; workdir=/tmp/ornn-project');
    expect(submitted?.traceText).toContain('工具结果: exec_command exit_code=0; stdout=PASS');
    expect(submitted?.traceText).not.toContain('max_output_tokens');
    expect(submitted?.traceText).not.toContain('yield_time_ms');
    expect(submitted?.traceText).not.toContain('XXXXX');
    expect(submitted?.traceText).not.toContain('不要把这个尾巴完整带进分析。');
  });

  it('builds timeline detail for an optimized scope with explicit analysis result and close node', () => {
    const detail = buildActivityScopeDetailFromData({
      lang: 'zh',
      projectName: 'ornn-project',
      episode: makeEpisode({
        state: 'closed',
        analysisStatus: 'completed',
        lastActivityAt: '2026-04-16T00:02:20.000Z',
      }),
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-submit',
          episodeId: 'episode-1',
          timestamp: '2026-04-16T00:01:10.000Z',
          traceCount: 2,
        }),
        makeDecisionEvent({
          id: 'event-patch',
          episodeId: 'episode-1',
          tag: 'patch_applied',
          status: 'success',
          timestamp: '2026-04-16T00:02:20.000Z',
          detail: '已完成本轮优化并写回 shadow skill。revision=3',
          reason: '需要收紧触发条件，减少无效工具调用。',
          changeType: 'tighten_trigger',
          linesAdded: 4,
          linesRemoved: 1,
        }),
      ],
      agentUsageRecords: [
        {
          id: 'usage-1',
          timestamp: '2026-04-16T00:02:19.000Z',
          scope: 'skill_call_analyzer',
          eventId: 'sess-1::test-driven-development',
          skillId: 'test-driven-development',
          model: 'deepseek/deepseek-reasoner',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          durationMs: 3000,
          episodeId: 'episode-1',
          triggerTraceId: 'trace-2',
          windowId: 'sess-1::test-driven-development',
        } as AgentUsageRecord,
      ],
      traces: [
        makeTrace('trace-1', '2026-04-16T00:00:00.000Z'),
        makeTrace('trace-2', '2026-04-16T00:01:00.000Z'),
      ],
    });

    expect(detail?.status).toBe('optimized');
    expect(detail?.timeline.map((node) => node.type)).toEqual([
      'skill_called',
      'analysis_submitted',
      'analysis_result',
      'optimization_completed',
    ]);
    expect(detail?.timeline[2]).toMatchObject({
      summary: '需要收紧触发条件，减少无效工具调用。',
      outcome: 'apply_optimization',
    });
    expect(detail?.timeline[3]).toMatchObject({
      summary: '本轮优化已执行完成，当前 scope 已关闭。',
    });
  });

  it('does not duplicate the analysis conclusion inside the no-optimization close node', () => {
    const detail = buildActivityScopeDetailFromData({
      lang: 'zh',
      projectName: 'ornn-project',
      episode: makeEpisode({
        state: 'closed',
        analysisStatus: 'completed',
        lastActivityAt: '2026-04-16T00:02:20.000Z',
      }),
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-submit',
          episodeId: 'episode-1',
          timestamp: '2026-04-16T00:01:10.000Z',
          traceCount: 2,
        }),
        makeDecisionEvent({
          id: 'event-eval',
          episodeId: 'episode-1',
          tag: 'evaluation_result',
          status: 'no_patch_needed',
          timestamp: '2026-04-16T00:02:20.000Z',
          detail: '窗口分析结论：当前窗口内技能调用正确，无需优化。',
          reason: '窗口分析结论：当前窗口内技能调用正确，无需优化。',
        }),
      ],
      agentUsageRecords: [
        {
          id: 'usage-1',
          timestamp: '2026-04-16T00:02:19.000Z',
          scope: 'skill_call_analyzer',
          eventId: 'sess-1::test-driven-development',
          skillId: 'test-driven-development',
          model: 'deepseek/deepseek-reasoner',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          durationMs: 3000,
          episodeId: 'episode-1',
          triggerTraceId: 'trace-2',
          windowId: 'sess-1::test-driven-development',
        } as AgentUsageRecord,
      ],
      traces: [
        makeTrace('trace-1', '2026-04-16T00:00:00.000Z'),
        makeTrace('trace-2', '2026-04-16T00:01:00.000Z'),
      ],
    });

    expect(detail?.timeline.map((node) => node.type)).toEqual([
      'skill_called',
      'analysis_submitted',
      'analysis_result',
      'no_optimization',
    ]);
    expect(detail?.timeline[2]?.summary).toBe('窗口分析结论：当前窗口内技能调用正确，无需优化。');
    expect(detail?.timeline[3]?.summary).not.toBe(detail?.timeline[2]?.summary);
    expect(detail?.timeline[3]?.summary).toContain('本轮');
    expect(detail?.timeline[3]?.summary).toContain('关闭');
  });

  it('keeps failed analysis detail visible inside the observing scope timeline', () => {
    const detail = buildActivityScopeDetailFromData({
      lang: 'zh',
      projectName: 'ornn-project',
      episode: makeEpisode({
        state: 'closed',
        analysisStatus: 'failed',
        lastActivityAt: '2026-04-16T00:01:40.000Z',
      }),
      decisionEvents: [
        makeDecisionEvent({
          id: 'event-submit',
          episodeId: 'episode-1',
          traceCount: 2,
          timestamp: '2026-04-16T00:01:10.000Z',
        }),
        makeDecisionEvent({
          id: 'event-failed',
          episodeId: 'episode-1',
          tag: 'analysis_failed',
          status: 'failed',
          timestamp: '2026-04-16T00:01:40.000Z',
          detail: '当前项目没有可用的模型服务配置，所以这轮分析没有开始。',
          reason: 'provider_not_configured',
        }),
      ],
      agentUsageRecords: [],
      traces: [
        makeTrace('trace-1', '2026-04-16T00:00:00.000Z'),
        makeTrace('trace-2', '2026-04-16T00:01:00.000Z', {
          event_type: 'tool_call',
          tool_name: 'exec_command',
          tool_args: { cmd: 'npm test' },
        }),
      ],
    });

    expect(detail?.status).toBe('observing');
    expect(detail?.timeline.map((node) => node.type)).toEqual([
      'skill_called',
      'analysis_submitted',
      'analysis_result',
    ]);
    expect(detail?.timeline[2]).toMatchObject({
      summary: '当前项目没有可用的模型服务配置，所以这轮分析没有开始。',
      outcome: null,
    });
  });
});
