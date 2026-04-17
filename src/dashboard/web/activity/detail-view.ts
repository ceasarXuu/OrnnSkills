const DASHBOARD_ACTIVITY_DETAIL_SOURCE = String.raw`function formatScopeTimelineNodeLabel(nodeType) {
  switch (nodeType) {
  case 'skill_called':
    return t('activityScopeNodeSkillCalled');
  case 'analysis_submitted':
    return t('activityScopeNodeAnalysisSubmitted');
  case 'analysis_result':
    return t('activityScopeNodeAnalysisResult');
  case 'optimization_completed':
    return t('activityScopeNodeOptimizationCompleted');
  case 'no_optimization':
    return t('activityScopeNodeNoOptimization');
  default:
    return t('activityDetailFallback');
  }
}

function renderScopeDetailValue(value) {
  return value ? escHtml(String(value)) : escHtml(t('activityDetailFallback'));
}

function renderScopeStatusBadge(rawStatus) {
  const normalized = rawStatus === 'optimized' || rawStatus === 'no_optimization'
    ? rawStatus
    : 'observing';
  return '<span class="activity-scope-status activity-scope-status-' + normalized + '">' +
    escHtml(localizeActivityScopeStatus(normalized)) +
    '</span>';
}

function renderScopeMetric(label, value) {
  return '<span class="activity-scope-metric">' +
    '<span class="activity-scope-metric-label">' + escHtml(label) + '</span>' +
    '<span class="activity-scope-metric-value">' + escHtml(value) + '</span>' +
    '</span>';
}

function renderActivityScopeTimelineNode(node) {
  const metrics = [];
  if (node.traceCount != null) {
    metrics.push(renderScopeMetric(t('activityScopeTraceCount'), String(node.traceCount) + (currentLang === 'zh' ? ' 条 trace' : ' traces')));
  }
  if (node.charCount != null) {
    metrics.push(renderScopeMetric(t('activityScopeCharCount'), String(node.charCount) + (currentLang === 'zh' ? ' 字符' : ' chars')));
  }
  if (node.model) {
    metrics.push(renderScopeMetric(t('activityScopeModel'), String(node.model)));
  }

  return '<div class="activity-scope-node">' +
    '<div class="activity-scope-node-head">' +
      '<div class="activity-scope-node-title">' + escHtml(formatScopeTimelineNodeLabel(node.type)) + '</div>' +
      '<div class="activity-scope-node-time">' + escHtml(formatEventTimestamp(node.timestamp)) + '</div>' +
    '</div>' +
    '<div class="activity-scope-node-summary">' + escHtml(node.summary || t('activityDetailFallback')) + '</div>' +
    (metrics.length > 0 ? ('<div class="activity-scope-metrics">' + metrics.join('') + '</div>') : '') +
    (node.traceText
      ? '<details class="activity-scope-traces"><summary>' + escHtml(t('activityScopeSubmittedTraceText')) + '</summary><pre>' + escHtml(node.traceText) + '</pre></details>'
      : '') +
    '</div>';
}

function renderActivityScopeDetail(detail) {
  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
  return '<div class="activity-scope-detail">' +
    '<div class="activity-scope-summary">' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceTime')) + '</span><span class="activity-scope-summary-value">' + escHtml(formatEventTimestamp(detail.createdAt)) + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('activitySkillLabel')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.skillId || '—') + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceRuntime')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.runtime || t('activityHostFallback')) + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('activityProject')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.projectName || '—') + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceStatus')) + '</span><span class="activity-scope-summary-value">' + renderScopeStatusBadge(detail.status) + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceScope')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.scopeId || '—') + '</span></div>' +
    '</div>' +
    '<div class="activity-scope-timeline">' +
      timeline.map((node) => renderActivityScopeTimelineNode(node)).join('') +
    '</div>' +
  '</div>';
}

function buildActivityScopeDetailText(detail) {
  if (!detail) return t('activityDetailEmpty');
  const lines = [
    t('traceTime') + ': ' + formatEventTimestamp(detail.createdAt),
    t('activitySkillLabel') + ': ' + (detail.skillId || '—'),
    t('traceRuntime') + ': ' + (detail.runtime || t('activityHostFallback')),
    t('activityProject') + ': ' + (detail.projectName || '—'),
    t('traceStatus') + ': ' + localizeActivityScopeStatus(detail.status),
    t('traceScope') + ': ' + (detail.scopeId || '—'),
    '',
    t('activityScopeTimelineTitle') + ':',
  ];

  for (const node of Array.isArray(detail.timeline) ? detail.timeline : []) {
    lines.push(
      formatScopeTimelineNodeLabel(node.type) + ' | ' + formatEventTimestamp(node.timestamp),
      node.summary || t('activityDetailFallback')
    );
    if (node.traceCount != null) lines.push(t('activityScopeTraceCount') + ': ' + node.traceCount);
    if (node.charCount != null) lines.push(t('activityScopeCharCount') + ': ' + node.charCount);
    if (node.model) lines.push(t('activityScopeModel') + ': ' + node.model);
    if (node.traceText) {
      lines.push(t('activityScopeSubmittedTraceText') + ':', node.traceText);
    }
    lines.push('');
  }

  return lines.join('\\n').trim();
}

async function fetchActivityScopeDetail(projectPath, scopeId) {
  const cache = getScopeDetailCache(projectPath);
  if (cache[scopeId]) return cache[scopeId];
  const encodedProjectPath = encodeURIComponent(projectPath);
  const encodedScopeId = encodeURIComponent(scopeId);
  const response = await fetchJsonWithTimeout('/api/projects/' + encodedProjectPath + '/activity-scopes/' + encodedScopeId, 12000);
  cache[scopeId] = response.detail || null;
  return cache[scopeId];
}

function summarizeTraceEventType(trace) {
  if (!trace) return t('activityDetailFallback');
  if (trace.event_type === 'tool_call') return t('activityTraceToolCall');
  if (trace.event_type === 'tool_result') return t('activityTraceToolResult');
  if (trace.event_type === 'assistant_output') return t('activityTraceAssistantOutput');
  if (trace.event_type === 'user_input') return t('activityTraceUserInput');
  if (trace.event_type === 'file_change') return t('activityTraceFileChange');
  return trace.event_type || t('activityDetailFallback');
}

function buildActivityDetail(row) {
  if (!row) return t('activityDetailEmpty');
  if (row.rawTrace) {
    return buildRawTraceDetail(row);
  }
  if (row.tag === 'analysis_failed') {
    const failure = describeAnalysisFailure(row);
    const lines = [
      t('traceTime') + ': ' + formatEventTimestamp(row.timestamp),
      t('traceRuntime') + ': ' + (row.runtime || t('activityHostFallback')),
      t('activitySkillLabel') + ': ' + (row.skillId || '—'),
      t('activityDetailNode') + ': ' + formatActivityNode(row),
      t('activityDetailInput') + ': ' + buildActivityInputText(row),
      t('activityDetailSummary') + ': ' + failure.summary,
      (currentLang === 'zh' ? '对结果的影响' : 'Impact') + ': ' + failure.impact,
      t('activityDetailNextStep') + ': ' + failure.action,
    ];
    if (failure.technical) {
      lines.push((currentLang === 'zh' ? '原始技术信息' : 'Technical Detail') + ': ' + failure.technical);
    }
    return lines.join('\\n');
  }
  let nextStep = row.nextAction || '';
  if (!nextStep) {
    switch (row.tag) {
    case 'analysis_started':
      nextStep = currentLang === 'zh'
        ? '等待这一轮分析返回结果，再决定是继续观察、保持现状还是执行优化。'
        : 'Wait for this analysis round to return before deciding whether to keep observing, stay unchanged, or optimize.';
      break;
    case 'analysis_interrupted':
      nextStep = currentLang === 'zh'
        ? '本轮没有形成业务结论，先排查分析链路或模型服务，再决定是否重新发起分析。'
        : 'This round ended without a business conclusion; investigate the analysis path or model service before retrying.';
      break;
    case 'analysis_waiting_more_context':
      nextStep = currentLang === 'zh'
        ? '本轮不会直接改技能，系统会扩大窗口后再次分析。'
        : 'This round will not change the skill yet; the system will widen the window and analyze again.';
      break;
    case 'analysis_concluded':
    case 'optimization_skipped':
      nextStep = currentLang === 'zh'
        ? '当前保持现状，后续如果出现新的强信号，会重新开启下一轮分析。'
        : 'The current decision is to keep the skill unchanged unless stronger future evidence reopens analysis.';
      break;
    case 'optimization_applied':
      nextStep = currentLang === 'zh'
        ? '补丁已经写回，后续调用会继续验证这次优化是否有效。'
        : 'The patch has been written back, and later calls will validate whether the optimization worked.';
      break;
    default:
      nextStep = currentLang === 'zh'
        ? '继续观察同一技能后续窗口中的变化。'
        : 'Continue observing how this skill behaves in later windows.';
      break;
    }
  }
  const lines = [
    t('traceTime') + ': ' + formatEventTimestamp(row.timestamp),
    t('traceRuntime') + ': ' + (row.runtime || t('activityHostFallback')),
    t('activitySkillLabel') + ': ' + (row.skillId || '—'),
    t('activityDetailNode') + ': ' + formatActivityNode(row),
    t('activityDetailInput') + ': ' + buildActivityInputText(row),
    t('activityDetailSummary') + ': ' + (row.detail || t('activityDetailFallback')),
    t('activityDetailNextStep') + ': ' + nextStep,
  ];
  return lines.join('\\n');
}

function stringifyRawTraceValue(value) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatRawTracePreview(trace) {
  if (!trace) return t('activityDetailFallback');
  if (trace.event_type === 'tool_call') {
    const name = trace.tool_name || 'unknown_tool';
    const argsText = trace.tool_args ? stringifyRawTraceValue(trace.tool_args) : '';
    return argsText ? (name + ' ' + argsText) : name;
  }
  if (trace.event_type === 'tool_result') return stringifyRawTraceValue(trace.tool_result);
  if (trace.event_type === 'assistant_output') return trace.assistant_output || t('activityDetailFallback');
  if (trace.event_type === 'user_input') return trace.user_input || t('activityDetailFallback');
  if (trace.event_type === 'file_change') {
    return Array.isArray(trace.files_changed) && trace.files_changed.length > 0
      ? trace.files_changed.join(', ')
      : t('activityDetailFallback');
  }
  return stringifyRawTraceValue(trace.metadata || trace.event_type || t('activityDetailFallback'));
}

function buildRawTraceDetail(row) {
  const trace = row && row.rawTrace ? row.rawTrace : null;
  if (!trace) return t('activityDetailEmpty');
  const isZh = currentLang === 'zh';
  const lines = [
    t('traceTime') + ': ' + formatEventTimestamp(trace.timestamp),
    t('traceRuntime') + ': ' + (trace.runtime || t('activityHostFallback')),
    t('traceEvent') + ': ' + summarizeTraceEventType(trace),
    t('traceStatus') + ': ' + (trace.status || t('activityStatusFallback')),
    t('traceScope') + ': ' + (row.scopeId || t('activityScopeFallback')),
    t('traceSession') + ': ' + (trace.session_id || '—'),
    t('traceId') + ': ' + (trace.trace_id || '—'),
  ];
  if (trace.tool_name) lines.push((isZh ? '工具' : 'Tool') + ': ' + trace.tool_name);
  if (trace.tool_args) lines.push((isZh ? '参数' : 'Arguments') + ': ' + stringifyRawTraceValue(trace.tool_args));
  if (trace.tool_result) lines.push((isZh ? '结果' : 'Result') + ': ' + stringifyRawTraceValue(trace.tool_result));
  if (trace.user_input) lines.push((isZh ? '用户输入' : 'User Input') + ': ' + trace.user_input);
  if (trace.assistant_output) lines.push((isZh ? '助手输出' : 'Assistant Output') + ': ' + trace.assistant_output);
  if (Array.isArray(trace.files_changed) && trace.files_changed.length > 0) {
    lines.push((isZh ? '文件变更' : 'Files Changed') + ': ' + trace.files_changed.join(', '));
  }
  if (Array.isArray(trace.skill_refs) && trace.skill_refs.length > 0) {
    lines.push(t('activitySkillLabel') + ': ' + trace.skill_refs.join(', '));
  }
  return lines.join('\\n');
}

function buildActivityRows(projectPath) {
  const rows = buildScopeActivityRows(projectPath);
  console.debug('[dashboard] activity scope rows rebuilt', {
    projectPath,
    rowCount: rows.length,
  });
  return rows;
}

function getActivityRow(projectPath, rowId) {
  const rows = (state.activityRowsByProject[projectPath] || []).concat(state.rawActivityRowsByProject[projectPath] || []);
  return rows.find((row) => row.id === rowId) || null;
}

function setEventModalContentHtml(html) {
  const el = document.getElementById('eventModalContent');
  if (!el) return;
  el.innerHTML = html;
  if (typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) {
    el.textContent = String(html).replace(/<[^>]+>/g, '');
  }
}

async function copyActivityDetail(projectPath, rowId) {
  const row = getActivityRow(projectPath, rowId);
  const text = isScopeActivityRow(row)
    ? buildActivityScopeDetailText(await fetchActivityScopeDetail(projectPath, row.scopeId))
    : buildActivityDetail(row);
  state.lastCopiedActivityText = text;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

async function openActivityScopeDetail(projectPath, scopeId, fallbackSkillId = '—') {
  document.getElementById('eventModalTitle').textContent = fallbackSkillId + ' · ' + t('activityScopeTimelineTitle');
  setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(t('activityScopeDetailLoading')) + '</pre>');
  document.getElementById('eventModal').classList.add('visible');
  try {
    const detail = await fetchActivityScopeDetail(projectPath, scopeId);
    if (!detail) {
      setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(t('activityDetailEmpty')) + '</pre>');
      return;
    }
    document.getElementById('eventModalTitle').textContent = (detail.skillId || fallbackSkillId || '—') + ' · ' + t('activityScopeTimelineTitle');
    setEventModalContentHtml(renderActivityScopeDetail(detail));
  } catch (error) {
    console.warn('[dashboard] failed to load activity scope detail', {
      projectPath,
      scopeId,
      error: String(error),
    });
    setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(t('activityScopeDetailLoadFailed') + ' ' + String(error)) + '</pre>');
  }
}

async function openActivityDetail(projectPath, rowId) {
  const row = getActivityRow(projectPath, rowId);
  if (isScopeActivityRow(row)) {
    return openActivityScopeDetail(projectPath, row.scopeId, row.skillId || '—');
  }

  document.getElementById('eventModalTitle').textContent = row
    ? ((row.rawTrace ? summarizeTraceEventType(row.rawTrace) : businessEventLabel(row.tag)) + ' · ' + (row.skillId || '—'))
    : t('activityDetailTitle');
  setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(buildActivityDetail(row)) + '</pre>');
  document.getElementById('eventModal').classList.add('visible');
}

async function openVersionScopeDetail(encProject, scopeId) {
  if (!scopeId) return;
  return openActivityScopeDetail(decodeURIComponent(encProject), scopeId);
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('visible');
}`;

export function renderDashboardActivityDetailSource(): string {
  return DASHBOARD_ACTIVITY_DETAIL_SOURCE.trim();
}
