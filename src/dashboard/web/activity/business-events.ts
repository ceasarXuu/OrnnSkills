const DASHBOARD_ACTIVITY_BUSINESS_SOURCE = String.raw`function businessEventLabel(tag) {
  const map = {
    all: t('activityTagAll'),
    core_flow: t('activityTagCoreFlow'),
    stability_feedback: t('activityTagStabilityFeedback'),
    skill_observed: t('activityTagSkillObserved'),
    analysis_started: t('activityTagAnalysisStarted'),
    analysis_interrupted: t('activityTagAnalysisInterrupted'),
    analysis_waiting_more_context: t('activityTagAnalysisWaiting'),
    analysis_concluded: t('activityTagAnalysisConcluded'),
    optimization_skipped: t('activityTagOptimizationSkipped'),
    optimization_applied: t('activityTagOptimizationApplied'),
    skill_called: t('activityTagSkillCalled'),
    skill_monitoring_started: t('activityTagSkillAdded'),
    skill_removed: t('activityTagSkillRemoved'),
    skill_edited: t('activityTagSkillEdited'),
    skill_version_iterated: t('activityTagSkillVersion'),
    daemon_state: t('activityTagDaemon'),
    optimization_state: t('activityTagOptimization'),
    evaluation_result: t('activityTagEvaluationResult'),
    skill_feedback: t('activityTagSkillFeedback'),
    patch_applied: t('activityTagPatchApplied'),
    analysis_failed: t('activityTagAnalysisFailed'),
    analysis_requested: t('activityTagAnalysisSubmitted'),
    episode_probe_result: t('activityTagProbeResult'),
    episode_probe_requested: t('activityTagProbeSubmitted'),
  };
  return map[tag] || tag;
}

function businessCategoryForTag(tag) {
  if (tag === 'analysis_failed') return 'stability_feedback';
  return 'core_flow';
}

function formatPatchSummary(e) {
  const parts = [];
  if (e.changeType) parts.push(String(e.changeType));
  const linesAdded = Number(e.linesAdded || 0);
  const linesRemoved = Number(e.linesRemoved || 0);
  if (linesAdded || linesRemoved) parts.push('+' + linesAdded + '/-' + linesRemoved);
  return parts.join(' · ');
}

function formatBusinessEvent(e) {
  switch (e.tag) {
    case 'analysis_started':
      return normalizeActivityNarrative('analysis_started', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisStarted');
    case 'analysis_interrupted':
      return normalizeActivityNarrative('analysis_interrupted', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisInterrupted');
    case 'analysis_waiting_more_context':
      return normalizeActivityNarrative('analysis_waiting_more_context', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisWaiting');
    case 'analysis_concluded':
      return normalizeActivityNarrative('analysis_concluded', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisConcluded');
    case 'optimization_skipped':
      return normalizeActivityNarrative('optimization_skipped', e.rawStatus || e.status, e.detail)
        || t('activitySummaryOptimizationSkipped');
    case 'optimization_applied': {
      const patchSummary = formatPatchSummary(e);
      return patchSummary
        ? t('activitySummaryOptimizationApplied') + ': ' + patchSummary
        : t('activitySummaryOptimizationApplied');
    }
    case 'skill_called':
      return t('activitySummarySkillCalled') + ': ' + (e.skillId || 'unknown');
    case 'skill_monitoring_started':
      return t('activitySummarySkillAdded') + ': ' + (e.skillId || 'unknown');
    case 'skill_removed':
      return t('activitySummarySkillRemoved') + ': ' + (e.skillId || 'unknown');
    case 'skill_edited':
      return t('activitySummarySkillEdited') + ': ' + (e.skillId || 'unknown');
    case 'skill_version_iterated':
      return t('activitySummarySkillVersion') + (e.skillId ? ': ' + e.skillId : '');
    case 'daemon_state':
      return e.status === 'started'
        ? t('activitySummaryDaemonStarted')
        : t('activitySummaryDaemonStopped');
    case 'optimization_state':
      return t('activitySummaryOptimizationChanged') + ': ' + (e.status || 'idle');
    case 'evaluation_result':
      return t('activitySummaryEvaluationResult') + ': ' + normalizeActivityNarrative(
        normalizeDecisionTag(e) || e.tag,
        e.rawStatus || e.status,
        e.detail || e.reason || ''
      );
    case 'skill_feedback':
      return t('activitySummarySkillFeedback') + ': ' + normalizeActivityNarrative(
        normalizeDecisionTag(e) || e.tag,
        e.rawStatus || e.status,
        e.detail || e.reason || ''
      );
    case 'patch_applied':
      return formatPatchSummary(e)
        ? t('activitySummaryPatchApplied') + ': ' + formatPatchSummary(e)
        : t('activitySummaryPatchApplied');
    case 'analysis_failed':
      return t('activitySummaryAnalysisFailed') + ': ' + normalizeActivityNarrative(
        'analysis_failed',
        e.rawStatus || e.status,
        e.detail || e.reason || ''
      );
    case 'analysis_requested':
      return t('activitySummaryAnalysisSubmitted');
    case 'episode_probe_result':
      return t('activitySummaryProbeResult') + ': ' + (e.status || '');
    case 'episode_probe_requested':
      return t('activitySummaryProbeSubmitted');
    default:
      return e.tag;
  }
}

function formatActivityNode(row) {
  if (!row) return t('activityDetailFallback');
  const eventLabel = businessEventLabel(row.tag);
  const statusLabel = row.status || '';
  return statusLabel && statusLabel !== t('activityStatusFallback')
    ? (eventLabel + ' / ' + statusLabel)
    : eventLabel;
}

function renderActivityNodeCell(row) {
  if (!row) return '—';
  const eventLabel = businessEventLabel(row.tag);
  const statusLabel = row.status || '';
  return '<div class="activity-node-cell">' +
    '<div class="activity-node-title">' + escHtml(eventLabel) + '</div>' +
    (
      statusLabel && statusLabel !== t('activityStatusFallback')
        ? '<div class="activity-node-status">' + escHtml(statusLabel) + '</div>'
        : ''
    ) +
  '</div>';
}

function normalizeDecisionTag(event) {
  if (event?.businessTag) return event.businessTag;
  const tag = event?.tag;
  const status = event?.status;
  if (!tag) return null;
  if (
    tag === 'skill_mapping' ||
    tag === 'skill_mapped' ||
    tag === 'skill_mapping_result' ||
    tag === 'skill_monitoring_started' ||
    tag === 'skill_removed' ||
    tag === 'skill_edited' ||
    tag === 'skill_version_iterated' ||
    tag === 'episode_probe_result' ||
    tag === 'episode_probe_requested' ||
    tag === 'skill_feedback'
  ) {
    return null;
  }
  if (tag === 'analysis_requested') return 'analysis_started';
  if (tag === 'patch_applied') return 'optimization_applied';
  if (tag === 'analysis_failed') return 'analysis_failed';
  if (tag === 'evaluation_result' || tag === 'skill_evaluation') {
    if (status === 'continue_collecting') return 'analysis_waiting_more_context';
    if (
      status === 'cooldown' ||
      status === 'daily_limit_reached' ||
      status === 'frozen' ||
      status === 'confidence_too_low'
    ) {
      return 'optimization_skipped';
    }
    return 'analysis_concluded';
  }
  return tag;
}

function getActivityRelationKeys(event) {
  if (!event) return [];
  const keys = [];
  const scopeId = event.windowId || event.scopeId || (event.evidence && typeof event.evidence === 'object' ? event.evidence.windowId : null);
  if (scopeId) keys.push('scope:' + scopeId);
  const traceId = event.traceId || event.trace_id || null;
  if (traceId) keys.push('trace:' + traceId);
  const sessionId = event.sessionId || event.session_id || null;
  const skillId = event.skillId || event.skill_id || null;
  if (sessionId && skillId) keys.push('session-skill:' + sessionId + '::' + skillId);
  return [...new Set(keys)];
}

function collectUniqueText(values) {
  return [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];
}

const ACTIVITY_CJK_CHAR_RE = /[\u3400-\u9fff]/u;
const ACTIVITY_LATIN_CHAR_RE = /[A-Za-z]/;
const ACTIVITY_LATIN_WORD_RE = /[A-Za-z]{2,}/g;

function countActivityLatinWords(text) {
  return String(text || '').match(ACTIVITY_LATIN_WORD_RE)?.length || 0;
}

function needsActivityNarrativeFallback(text) {
  const normalized = String(text || '').trim();
  if (!normalized || currentLang !== 'zh') return false;
  if (!ACTIVITY_LATIN_CHAR_RE.test(normalized)) return false;
  if (!ACTIVITY_CJK_CHAR_RE.test(normalized)) return true;
  return countActivityLatinWords(normalized) >= 5;
}

function fallbackActivityNarrative(tag, rawStatus) {
  switch (tag) {
    case 'analysis_started':
      return currentLang === 'zh'
        ? '时机探测已通过，开始深度分析本次调用窗口。'
        : 'The readiness probe passed, and the system started deep analysis for this call window.';
    case 'analysis_waiting_more_context':
      return currentLang === 'zh'
        ? '当前窗口证据仍不够完整，系统会继续扩展观察范围后再分析。'
        : 'The current window still lacks enough evidence, so the system will widen the observation scope before analyzing again.';
    case 'analysis_concluded':
      return currentLang === 'zh'
        ? '窗口分析认为当前技能调用符合预期，暂时无需修改。'
        : 'Window analysis concluded that the current skill call is behaving as expected and does not need changes right now.';
    case 'optimization_skipped':
      return currentLang === 'zh'
        ? '这轮分析决定暂不执行优化，当前保持现状。'
        : 'This round decided to skip optimization and keep the current skill unchanged.';
    case 'optimization_applied':
      return currentLang === 'zh'
        ? '系统已经将本轮优化补丁写回技能，并会继续观察后续效果。'
        : 'The system has written the optimization patch back to the skill and will continue validating the outcome.';
    case 'analysis_interrupted':
      return currentLang === 'zh'
        ? '这轮分析在形成业务结论前被中断，需要先恢复分析链路。'
        : 'This analysis round was interrupted before it could reach a business conclusion and the analysis path needs attention first.';
    case 'analysis_failed':
      return currentLang === 'zh'
        ? '分析链路执行失败，本轮没有生成可用结论。'
        : 'The analysis pipeline failed and did not produce a usable conclusion.';
    case 'skill_called':
      return currentLang === 'zh'
        ? '系统记录到一次技能调用。'
        : 'The system recorded a skill invocation.';
    default:
      if (rawStatus === 'continue_collecting') {
        return currentLang === 'zh'
          ? '当前窗口证据仍不够完整，系统会继续扩展观察范围后再分析。'
          : 'The current window still lacks enough evidence, so the system will widen the observation scope before analyzing again.';
      }
      if (
        rawStatus === 'cooldown' ||
        rawStatus === 'daily_limit_reached' ||
        rawStatus === 'frozen' ||
        rawStatus === 'confidence_too_low'
      ) {
        return currentLang === 'zh'
          ? '当前判断是暂不执行优化，先继续保持现状。'
          : 'The current decision is to skip optimization for now and keep the skill unchanged.';
      }
      if (rawStatus === 'no_patch_needed') {
        return currentLang === 'zh'
          ? '窗口分析认为当前技能调用符合预期，暂时无需修改。'
          : 'Window analysis concluded that the current skill call is behaving as expected and does not need changes right now.';
      }
      return '';
  }
}

function normalizeActivityNarrative(tag, rawStatus, value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const fallback = fallbackActivityNarrative(tag, rawStatus);
  if (!candidate) return fallback;
  return needsActivityNarrativeFallback(candidate) ? (fallback || candidate) : candidate;
}

function normalizeBusinessDetailForCompare(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return '';
  return candidate
    .replace(/^(窗口分析结论|分析结论|Window Analysis Conclusion|Analysis Conclusion)[:：]\\s*/iu, '')
    .replace(/\\s+/g, ' ')
    .trim();
}

function mergeBusinessDetail(primary, supportingValues) {
  const parts = [];
  const seen = new Set();
  for (const value of [primary].concat(Array.isArray(supportingValues) ? supportingValues : [supportingValues])) {
    const candidate = typeof value === 'string' ? value.trim() : '';
    if (!candidate) continue;
    const dedupeKey = normalizeBusinessDetailForCompare(candidate) || candidate;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    parts.push(candidate);
  }
  return parts.join('\\n');
}

function shouldMergeSupportingDetailIntoRow(tag, category) {
  if (category === 'stability_feedback') return false;
  return (
    tag === 'analysis_concluded' ||
    tag === 'analysis_waiting_more_context' ||
    tag === 'optimization_skipped' ||
    tag === 'optimization_applied'
  );
}

function getActivityScopeId(event) {
  if (!event) return null;
  if (event.windowId) return event.windowId;
  if (event.evidence && typeof event.evidence === 'object' && event.evidence.windowId) return event.evidence.windowId;
  return null;
}

function describeAnalysisFailure(row) {
  const technical = [
    row && (row.rawReason || row.reason),
    row && (row.rawDetail || row.detail),
    row && row.evidence && typeof row.evidence === 'object' ? row.evidence.rawEvidence : null,
  ]
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .join(' | ');
  const haystack = technical.toLowerCase();
  const isZh = currentLang === 'zh';

  if (haystack.includes('provider_not_configured')) {
    return {
      summary: isZh
        ? '当前项目没有可用的模型服务配置，所以这轮分析没有开始。'
        : 'This analysis did not start because no model provider is configured for the project.',
      impact: isZh
        ? '这属于配置缺失，不代表 skill 本身已经确认有问题。'
        : 'This is a configuration gap, not confirmed evidence that the skill itself is wrong.',
      action: isZh
        ? '请先在 Config 页面补充 provider、API Key，并完成连通性检查。'
        : 'Configure a provider, add an API key, and verify connectivity in Config first.',
      technical,
    };
  }

  if (haystack.includes('invalid_analysis_json')) {
    return {
      summary: isZh
        ? '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。'
        : 'The model replied, but the response did not match the required format, so the analysis result could not be parsed.',
      impact: isZh
        ? '这更像是分析链路的输出格式异常，不代表 skill 本身已经确认有问题。'
        : 'This points to an analysis pipeline formatting issue, not confirmed evidence that the skill is faulty.',
      action: isZh
        ? '建议保留这次原始返回并继续观察；如果连续出现，优先检查结构化输出协议。'
        : 'Keep the raw response for inspection and monitor recurrence; if it repeats, check the structured output protocol first.',
      technical,
    };
  }

  if (haystack.includes('empty content in llm response') || haystack.includes('empty_llm_response')) {
    return {
      summary: isZh
        ? '模型接口返回了空内容，所以这轮分析没有拿到可用结果。'
        : 'The model API returned empty content, so this analysis produced no usable result.',
      impact: isZh
        ? '这通常是模型服务瞬时异常或响应被截断，不代表 skill 本身已经确认有问题。'
        : 'This usually indicates a transient provider issue or truncated response, not confirmed evidence against the skill.',
      action: isZh
        ? '建议优先观察 provider 稳定性，并检查是否存在超时、重试或响应截断。'
        : 'Check provider stability first, including timeout, retry, and truncation behavior.',
      technical,
    };
  }

  if (haystack.includes('llm api error:')) {
    return {
      summary: isZh
        ? '模型服务调用失败，所以这轮分析没有完成。'
        : 'The model provider request failed, so this analysis did not complete.',
      impact: isZh
        ? '这属于外部服务异常，不代表 skill 本身已经确认有问题。'
        : 'This is an external service failure, not confirmed evidence that the skill is faulty.',
      action: isZh
        ? '建议先检查 provider 连通性、鉴权和限流状态。'
        : 'Check provider connectivity, authentication, and rate limits first.',
      technical,
    };
  }

  if (haystack.includes('timeout')) {
    return {
      summary: isZh
        ? '分析请求超时了，所以这轮分析没有完成。'
        : 'The analysis request timed out before a usable result was returned.',
      impact: isZh
        ? '这更像是时延问题，不代表 skill 本身已经确认有问题。'
        : 'This looks like a latency problem, not confirmed evidence that the skill is faulty.',
      action: isZh
        ? '建议检查模型超时配置、分析窗口大小以及 provider 响应速度。'
        : 'Check model timeout settings, analysis window size, and provider latency.',
      technical,
    };
  }

  return {
    summary: isZh
      ? '分析链路在执行过程中发生异常，所以这轮分析没有产出可用结论。'
      : 'The analysis pipeline hit an unexpected error before it could produce a usable conclusion.',
    impact: isZh
      ? '当前只能确认分析没有完成，不能据此直接判定 skill 已有问题。'
      : 'At this point we only know the analysis did not complete; this alone does not prove the skill is faulty.',
    action: isZh
      ? '建议结合原始技术信息继续排查分析链路，而不是直接修改 skill。'
      : 'Investigate the analysis pipeline using the technical detail before changing the skill itself.',
    technical,
  };
}

function describeAnalysisInterruption(row) {
  const failure = describeAnalysisFailure(row);
  const isZh = currentLang === 'zh';
  return {
    summary: isZh
      ? ('本轮分析已中断：' + failure.summary)
      : ('This analysis round was interrupted: ' + failure.summary),
    nextAction: failure.action,
  };
}

function localizeActivityStatus(tag, rawStatus) {
  switch (tag) {
    case 'analysis_started':
      return t('activityStatusAnalyzing');
    case 'analysis_interrupted':
      return t('activityStatusInterrupted');
    case 'analysis_waiting_more_context':
      return t('activityStatusWaiting');
    case 'analysis_concluded':
      return t('activityStatusNoOptimization');
    case 'optimization_skipped':
      return t('activityStatusSkipped');
    case 'optimization_applied':
      return t('activityStatusApplied');
    case 'analysis_failed':
      return t('activityStatusFailed');
    default:
      if (rawStatus === 'failed') return t('activityStatusFailed');
      return rawStatus || t('activityStatusFallback');
  }
}

function formatActivityPreview(row) {
  if (!row) return t('activityDetailFallback');
  if (row.tag === 'analysis_failed') {
    return describeAnalysisFailure(row).summary;
  }
  return row.detail || formatBusinessEvent(row) || t('activityDetailFallback');
}

function buildActivityInputText(row) {
  const inputParts = [];
  if (row?.inputSummary) inputParts.push(row.inputSummary);
  if (row?.sourceLabel) inputParts.push(t('activitySourceLabel') + ': ' + row.sourceLabel);
  if (row?.traceId) inputParts.push(t('traceId') + ': ' + row.traceId);
  if (row?.sessionId) inputParts.push(t('activitySessionIdLabel') + ': ' + row.sessionId);
  if (row?.scopeId) inputParts.push(t('traceScope') + ': ' + row.scopeId);
  return inputParts.join(' | ') || t('activityDetailFallback');
}`;

export function renderDashboardActivityBusinessSource(): string {
  return DASHBOARD_ACTIVITY_BUSINESS_SOURCE.trim();
}
