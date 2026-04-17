import { appendProjectPromptOverride } from '../prompt-overrides.js';
import { getSkillCallAnalyzerBaseSystemPrompt } from '../prompt-defaults.js';
import { buildTraceTimelineText } from '../trace-summary/index.js';
import type { Language } from '../../dashboard/i18n.js';
import type { WindowAnalysisHint } from '../../types/index.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';

export function buildFallbackHint(window: SkillCallWindow): WindowAnalysisHint {
  const traceCount = Math.max(window.traces.length, 1);
  return {
    suggestedTraceDelta: Math.max(6, Math.ceil(traceCount * 0.4)),
    suggestedTurnDelta: 2,
    waitForEventTypes: [],
    mode: 'count_driven',
  };
}

function countExplicitSkillMentions(window: SkillCallWindow): number {
  const normalizedSkillId = window.skillId.toLowerCase();

  return window.traces.reduce((count, trace) => {
    const mentionedInRefs =
      trace.skill_refs?.some((ref) => {
        const normalizedRef = String(ref || '').toLowerCase();
        return (
          normalizedRef === normalizedSkillId || normalizedRef.startsWith(`${normalizedSkillId}@`)
        );
      }) ?? false;
    const mentionedInUser = trace.user_input?.toLowerCase().includes(normalizedSkillId) ?? false;
    const mentionedInAssistant =
      trace.assistant_output?.toLowerCase().includes(normalizedSkillId) ?? false;
    return count + (mentionedInRefs || mentionedInUser || mentionedInAssistant ? 1 : 0);
  }, 0);
}

function buildWindowSnapshot(window: SkillCallWindow, lang: Language): string[] {
  const failureCount = window.traces.filter((trace) => trace.status === 'failure').length;
  const toolFailureCount = window.traces.filter(
    (trace) => trace.event_type === 'tool_result' && trace.status === 'failure'
  ).length;
  const retryCount = window.traces.filter(
    (trace) => trace.event_type === 'retry' || trace.status === 'retry'
  ).length;
  const assistantOutputCount = window.traces.filter(
    (trace) =>
      typeof trace.assistant_output === 'string' && trace.assistant_output.trim().length > 0
  ).length;
  const fileChangeCount = window.traces.filter(
    (trace) => trace.event_type === 'file_change' || (trace.files_changed?.length ?? 0) > 0
  ).length;
  const explicitSkillMentions = countExplicitSkillMentions(window);

  if (lang === 'zh') {
    return [
      `- 显式 skill 提及次数: ${explicitSkillMentions}`,
      `- 失败事件数: ${failureCount}`,
      `- 工具失败数: ${toolFailureCount}`,
      `- 重试事件数: ${retryCount}`,
      `- 助手输出事件数: ${assistantOutputCount}`,
      `- 文件变更事件数: ${fileChangeCount}`,
    ];
  }

  return [
    `- Explicit skill mentions: ${explicitSkillMentions}`,
    `- Failure events: ${failureCount}`,
    `- Tool failures: ${toolFailureCount}`,
    `- Retry events: ${retryCount}`,
    `- Assistant output events: ${assistantOutputCount}`,
    `- File change events: ${fileChangeCount}`,
  ];
}

export function buildSkillCallAnalyzerPrompt(
  window: SkillCallWindow,
  skillContent: string,
  lang: Language,
  promptOverride: string
): { systemPrompt: string; userPrompt: string } {
  const isZh = lang === 'zh';
  const baseSystemPrompt = getSkillCallAnalyzerBaseSystemPrompt(lang);
  const systemPrompt = appendProjectPromptOverride(baseSystemPrompt, promptOverride, lang);
  const timeline = buildTraceTimelineText(window.traces.slice(-60), lang).split('\n');
  const snapshot = buildWindowSnapshot(window, lang);

  const userPrompt = isZh
    ? [
        `Skill ID: ${window.skillId}`,
        `宿主: ${window.runtime}`,
        `窗口 ID: ${window.windowId}`,
        `开始时间: ${window.startedAt}`,
        `最后一条 Trace 时间: ${window.lastTraceAt}`,
        `Trace 数量: ${window.traces.length}`,
        '',
        '窗口摘要:',
        ...snapshot,
        '',
        '当前 Skill 内容:',
        '```markdown',
        skillContent,
        '```',
        '',
        '窗口时间线:',
        ...timeline,
        '',
        '请严格按“skill 相关性 -> 归因 -> 可执行性”的顺序判断，不要因为单次失败就直接给出 apply_optimization。',
        '请输出唯一一个三元决策：无需优化、执行优化、或等待更多上下文。',
      ].join('\n')
    : [
        `Skill ID: ${window.skillId}`,
        `Host: ${window.runtime}`,
        `Window ID: ${window.windowId}`,
        `Started At: ${window.startedAt}`,
        `Last Trace At: ${window.lastTraceAt}`,
        `Trace Count: ${window.traces.length}`,
        '',
        'Window Snapshot:',
        ...snapshot,
        '',
        'Current Skill Content:',
        '```markdown',
        skillContent,
        '```',
        '',
        'Window Timeline:',
        ...timeline,
        '',
        'Follow the sequence skill relevance -> attribution -> executability, and do not jump to apply_optimization from a single failure.',
        'Return exactly one triage decision: no optimization, apply optimization, or wait for more context.',
      ].join('\n');

  return { systemPrompt, userPrompt };
}
