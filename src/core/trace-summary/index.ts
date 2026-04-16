import type { Trace } from '../../types/index.js';

export type TraceSummaryLanguage = 'zh' | 'en';

interface TraceSummaryLabels {
  userInput: string;
  assistantOutput: string;
  toolCall: string;
  toolResult: string;
  fileChange: string;
  status: string;
  unknown: string;
  chars: string;
  itemsOmitted: (count: number) => string;
}

export interface TraceSummaryOptions {
  narrativeMaxLength?: number;
  structuredStringMaxLength?: number;
  maxFields?: number;
  maxArrayItems?: number;
}

const DEFAULT_OPTIONS: Required<TraceSummaryOptions> = {
  narrativeMaxLength: 240,
  structuredStringMaxLength: 96,
  maxFields: 6,
  maxArrayItems: 4,
};

const LOW_SIGNAL_KEYS = new Set([
  'login',
  'tty',
  'detail',
  'interrupt',
  'timeout',
  'timeout_ms',
  'yield_time_ms',
  'max_output_tokens',
  'response_length',
  'sandbox_permissions',
  'prefix_rule',
  'justification',
  'recency',
]);

const GLOBAL_PRIORITY_KEYS = [
  'cmd',
  'path',
  'workdir',
  'ref_id',
  'id',
  'target',
  'name',
  'message',
  'question',
  'pattern',
  'q',
  'model',
  'agent_type',
  'reasoning_effort',
  'session_id',
  'sessionId',
  'windowId',
  'status',
  'success',
  'exit_code',
  'exitCode',
  'code',
  'error',
  'stderr',
  'stdout',
  'content',
  'result',
];

const TOOL_PRIORITY_KEYS: Record<string, string[]> = {
  exec_command: ['cmd', 'workdir', 'session_id', 'status', 'success', 'exit_code', 'exitCode', 'code', 'error', 'stderr', 'stdout'],
  write_stdin: ['session_id', 'chars', 'status', 'success', 'error', 'stdout', 'stderr'],
  apply_patch: ['patch', 'status', 'success', 'error'],
  open: ['ref_id', 'lineno'],
  click: ['ref_id', 'id'],
  find: ['ref_id', 'pattern'],
  search_query: ['q', 'domains'],
  image_query: ['q'],
  weather: ['location', 'start', 'duration'],
  finance: ['ticker', 'type', 'market'],
  spawn_agent: ['agent_type', 'model', 'reasoning_effort', 'message'],
  send_input: ['target', 'message'],
  wait_agent: ['targets', 'timeout_ms'],
  automation_update: ['mode', 'name', 'kind', 'status'],
  view_image: ['path'],
};

function getLabels(lang: TraceSummaryLanguage): TraceSummaryLabels {
  if (lang === 'zh') {
    return {
      userInput: '用户输入',
      assistantOutput: '助手输出',
      toolCall: '工具调用',
      toolResult: '工具结果',
      fileChange: '文件变更',
      status: '状态',
      unknown: 'unknown',
      chars: '字符',
      itemsOmitted: (count) => `其余 ${count} 项已省略`,
    };
  }

  return {
    userInput: 'user_input',
    assistantOutput: 'assistant_output',
    toolCall: 'tool_call',
    toolResult: 'tool_result',
    fileChange: 'file_change',
    status: 'status',
    unknown: 'unknown',
    chars: 'chars',
    itemsOmitted: (count) => `${count} more fields omitted`,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateWithCount(value: string, maxLength: number, lang: TraceSummaryLanguage): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const labels = getLabels(lang);
  const suffix = lang === 'zh'
    ? `…（共${normalized.length}${labels.chars}）`
    : `... (${normalized.length} ${labels.chars})`;
  return `${normalized.slice(0, maxLength)}${suffix}`;
}

function summarizePrimitive(
  value: unknown,
  lang: TraceSummaryLanguage,
  maxLength: number,
): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    return truncateWithCount(value, maxLength, lang);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return '';
}

function shouldKeepEntry(key: string, value: unknown): boolean {
  if (typeof value === 'undefined' || value === null) return false;
  if (LOW_SIGNAL_KEYS.has(key)) return false;
  if (typeof value === 'string') return normalizeWhitespace(value).length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function isOversizedLowSignalEntry(
  key: string,
  value: unknown,
  preferredKeys: string[],
  options: Required<TraceSummaryOptions>,
): boolean {
  if (preferredKeys.includes(key)) return false;
  if (typeof value === 'string') {
    return normalizeWhitespace(value).length > options.structuredStringMaxLength * 2;
  }
  if (Array.isArray(value)) {
    return value.length > options.maxArrayItems * 2;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > options.maxFields;
  }
  return false;
}

function orderKeys(keys: string[], preferredKeys: string[]): string[] {
  const preferred = preferredKeys.filter((key, index) => keys.includes(key) && preferredKeys.indexOf(key) === index);
  const rest = keys.filter((key) => !preferred.includes(key)).sort();
  return [...preferred, ...rest];
}

function summarizeStructuredValue(
  value: unknown,
  lang: TraceSummaryLanguage,
  preferredKeys: string[],
  options: Required<TraceSummaryOptions>,
  depth = 0,
): string {
  if (Array.isArray(value)) {
    const items = value
      .slice(0, options.maxArrayItems)
      .map((item) => summarizeStructuredValue(item, lang, preferredKeys, options, depth + 1))
      .filter(Boolean);
    const hiddenCount = Math.max(0, value.length - items.length);
    const suffix = hiddenCount > 0 ? `, ${getLabels(lang).itemsOmitted(hiddenCount)}` : '';
    return `[${items.join(', ')}${suffix}]`;
  }

  if (!value || typeof value !== 'object') {
    return summarizePrimitive(value, lang, options.structuredStringMaxLength);
  }

  const record = value as Record<string, unknown>;
  const keys = orderKeys(
    Object.keys(record).filter((key) =>
      shouldKeepEntry(key, record[key]) &&
      !isOversizedLowSignalEntry(key, record[key], preferredKeys, options)
    ),
    preferredKeys,
  );
  const visibleKeys = keys.slice(0, options.maxFields);
  const hiddenCount = Math.max(0, keys.length - visibleKeys.length);
  const parts = visibleKeys.map((key) => {
    const rawValue = record[key];
    if (depth >= 1 && rawValue && typeof rawValue === 'object') {
      return `${key}=${Array.isArray(rawValue) ? `[${(rawValue as unknown[]).length}]` : '{...}'}`;
    }
    const summarized = summarizeStructuredValue(rawValue, lang, preferredKeys, options, depth + 1);
    return summarized ? `${key}=${summarized}` : key;
  });
  if (hiddenCount > 0) {
    parts.push(getLabels(lang).itemsOmitted(hiddenCount));
  }
  return parts.join('; ');
}

function summarizeNarrative(
  value: string,
  lang: TraceSummaryLanguage,
  maxLength: number,
): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const labels = getLabels(lang);
  const suffix = lang === 'zh'
    ? `…（共${normalized.length}${labels.chars}）`
    : `... (${normalized.length} ${labels.chars})`;
  return `${normalized.slice(0, maxLength)}${suffix}`;
}

function getPreferredKeys(toolName: string | undefined): string[] {
  return toolName
    ? [...(TOOL_PRIORITY_KEYS[toolName] || []), ...GLOBAL_PRIORITY_KEYS]
    : GLOBAL_PRIORITY_KEYS;
}

export function summarizeTraceForTimeline(
  trace: Trace,
  lang: TraceSummaryLanguage,
  options: TraceSummaryOptions = {},
): string {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const labels = getLabels(lang);

  if (trace.event_type === 'user_input' && trace.user_input) {
    return `${labels.userInput}: ${summarizeNarrative(trace.user_input, lang, merged.narrativeMaxLength)}`;
  }

  if (trace.event_type === 'assistant_output' && trace.assistant_output) {
    return `${labels.assistantOutput}: ${summarizeNarrative(trace.assistant_output, lang, merged.narrativeMaxLength)}`;
  }

  if (trace.event_type === 'tool_call') {
    const payload = summarizeStructuredValue(trace.tool_args || {}, lang, getPreferredKeys(trace.tool_name), merged);
    return `${labels.toolCall}: ${trace.tool_name || labels.unknown}${payload ? ` ${payload}` : ''}`;
  }

  if (trace.event_type === 'tool_result') {
    const payload = summarizeStructuredValue(trace.tool_result || {}, lang, getPreferredKeys(trace.tool_name), merged);
    return `${labels.toolResult}: ${trace.tool_name || labels.unknown}${payload ? ` ${payload}` : ''}`;
  }

  if (trace.event_type === 'file_change') {
    const files = summarizeStructuredValue(trace.files_changed || [], lang, ['0', '1', '2'], merged);
    return `${labels.fileChange}: ${files}`;
  }

  return lang === 'zh'
    ? `${trace.event_type}: ${labels.status}=${trace.status}`
    : `${trace.event_type}: ${labels.status}=${trace.status}`;
}

export function buildTraceTimelineText(
  traces: Trace[],
  lang: TraceSummaryLanguage,
  options: TraceSummaryOptions = {},
): string {
  return traces
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((trace, index) => `${index + 1}. [${trace.timestamp}] ${summarizeTraceForTimeline(trace, lang, options)}`)
    .join('\n');
}
