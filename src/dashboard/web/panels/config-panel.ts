type DashboardConfigPanelDeps = {
  escHtml: (value: unknown) => string;
  t: (key: string) => string;
};

declare const currentLang: string;
declare const DEFAULT_DASHBOARD_SYSTEM_PROMPTS: Record<string, DashboardSystemPromptDefaults>;

type DashboardSystemPromptDefaults = {
  skillCallAnalyzer: string;
  decisionExplainer: string;
  readinessProbe: string;
};

type DashboardConfigPanelInput = {
  deps: DashboardConfigPanelDeps;
  connectivityHtml: string;
  llmSafety: {
    enabled: boolean;
    windowMs: number;
    maxRequestsPerWindow: number;
    maxConcurrentRequests: number;
    maxEstimatedTokensPerWindow: number;
  };
  loading: boolean;
  loadError: string;
  promptDefaults?: {
    skillCallAnalyzer: string;
    decisionExplainer: string;
    readinessProbe: string;
  };
  promptOverrides: {
    skillCallAnalyzer: string;
    decisionExplainer: string;
    readinessProbe: string;
  };
  promptSources: {
    skillCallAnalyzer: 'built_in' | 'custom';
    decisionExplainer: 'built_in' | 'custom';
    readinessProbe: 'built_in' | 'custom';
  };
  providerCatalogError: string;
  providerCatalogLoading: boolean;
  rowsHtml: string;
  saveHint: string;
};

function getRuntimePromptDefaults(): DashboardSystemPromptDefaults {
  const lang = typeof currentLang !== 'undefined' && currentLang === 'zh' ? 'zh' : 'en';
  const defaultsByLang =
    typeof DEFAULT_DASHBOARD_SYSTEM_PROMPTS !== 'undefined' ? DEFAULT_DASHBOARD_SYSTEM_PROMPTS : {};

  return (
    defaultsByLang[lang] ||
    defaultsByLang.en || {
      skillCallAnalyzer: '',
      decisionExplainer: '',
      readinessProbe: '',
    }
  );
}

function renderPromptEditor(
  input: DashboardConfigPanelInput,
  options: {
    label: string;
    fieldId: string;
    rows: number;
    placeholder: string;
    defaultPrompt: string;
    overrideValue: string;
    source: 'built_in' | 'custom';
  }
): string {
  const { deps } = input;
  const sourceFieldId = `${options.fieldId}_source`;
  const builtInId = `${sourceFieldId}_built_in`;
  const customId = `${sourceFieldId}_custom`;
  const isBuiltIn = options.source !== 'custom';

  return `
    <div class="config-prompt-editor">
      <div class="config-label">${options.label}</div>
      <div class="config-prompt-grid">
        <label class="config-prompt-column">
          <div class="config-prompt-heading">
            <span class="config-check">
              <input id="${builtInId}" type="radio" name="${sourceFieldId}" value="built_in" ${isBuiltIn ? 'checked' : ''} onchange="scheduleProjectConfigSave(150)" />
              <span>${deps.t('configPromptBuiltInLabel')}</span>
            </span>
          </div>
          <pre class="config-prompt-preview">${deps.escHtml(options.defaultPrompt)}</pre>
        </label>
        <label class="config-prompt-column">
          <div class="config-prompt-heading">
            <span class="config-check">
              <input id="${customId}" type="radio" name="${sourceFieldId}" value="custom" ${!isBuiltIn ? 'checked' : ''} onchange="scheduleProjectConfigSave(150)" />
              <span>${deps.t('configPromptCustomLabel')}</span>
            </span>
          </div>
          <textarea id="${options.fieldId}" class="config-textarea" rows="${options.rows}" placeholder="${deps.escHtml(options.placeholder)}" oninput="scheduleProjectConfigSave(500)">${deps.escHtml(options.overrideValue)}</textarea>
        </label>
      </div>
    </div>
  `;
}

export function renderDashboardConfigPanel(input: DashboardConfigPanelInput): string {
  const { deps } = input;
  const promptDefaults = input.promptDefaults || getRuntimePromptDefaults();
  const runtimeLang = typeof currentLang !== 'undefined' ? currentLang || 'en' : 'en';

  console.debug('[dashboard] config prompt defaults ready', {
    lang: runtimeLang,
    skillCallAnalyzerChars: promptDefaults.skillCallAnalyzer.length,
    decisionExplainerChars: promptDefaults.decisionExplainer.length,
    readinessProbeChars: promptDefaults.readinessProbe.length,
  });

  return `
    ${input.providerCatalogLoading ? `<div class="config-help" style="margin-bottom:8px">${deps.t('configCatalogLoading')}</div>` : ''}
    ${input.providerCatalogError ? `<div class="config-help" style="margin-bottom:8px;color:var(--red)">${deps.t('configCatalogErrorPrefix')} ${deps.escHtml(input.providerCatalogError)} <button class="btn-secondary" type="button" onclick="reloadProviderCatalog()">${deps.t('configRetry')}</button></div>` : ''}
    ${input.loading ? `<div class="config-help" style="margin-bottom:8px">${deps.t('configLoading')}</div>` : ''}
    ${input.loadError ? `<div class="config-help" style="margin-bottom:8px;color:var(--red)">${deps.t('configLoadErrorPrefix')} ${deps.escHtml(input.loadError)}</div>` : ''}
    <div class="config-field" style="margin-top:10px">
      <label class="config-label">${deps.t('configProvidersLabel')}</label>
      <div class="providers-editor" id="cfg_providers_rows">${input.rowsHtml}</div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn-secondary" type="button" onclick="addProviderRow()">${deps.t('configAddProvider')}</button>
      </div>
      <div class="config-help">${deps.t('configProvidersHelp')}</div>
      <div class="config-connectivity" id="cfg_connectivity">
        ${input.connectivityHtml}
      </div>
    </div>
    <div class="config-field" style="margin-top:14px">
      <label class="config-label">${deps.t('configLlmSafetyLabel')}</label>
      <div class="config-help">${deps.t('configLlmSafetyHelp')}</div>
      <div class="providers-editor" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:8px">
        <label class="config-check" style="align-items:flex-start;gap:10px">
          <input id="cfg_llm_safety_enabled" type="checkbox" ${input.llmSafety.enabled ? 'checked' : ''} onchange="scheduleProjectConfigSave(150)" />
          <span>${deps.t('configLlmSafetyEnabledLabel')}</span>
        </label>
        <label>
          <div class="config-label">${deps.t('configLlmSafetyWindowLabel')}</div>
          <input id="cfg_llm_safety_window_ms" class="config-input" type="number" min="1" step="1000" value="${deps.escHtml(String(input.llmSafety.windowMs))}" oninput="scheduleProjectConfigSave(500)" />
        </label>
        <label>
          <div class="config-label">${deps.t('configLlmSafetyRequestsLabel')}</div>
          <input id="cfg_llm_safety_max_requests" class="config-input" type="number" min="1" step="1" value="${deps.escHtml(String(input.llmSafety.maxRequestsPerWindow))}" oninput="scheduleProjectConfigSave(500)" />
        </label>
        <label>
          <div class="config-label">${deps.t('configLlmSafetyConcurrentLabel')}</div>
          <input id="cfg_llm_safety_max_concurrent" class="config-input" type="number" min="1" step="1" value="${deps.escHtml(String(input.llmSafety.maxConcurrentRequests))}" oninput="scheduleProjectConfigSave(500)" />
        </label>
        <label>
          <div class="config-label">${deps.t('configLlmSafetyTokensLabel')}</div>
          <input id="cfg_llm_safety_max_tokens" class="config-input" type="number" min="1" step="1000" value="${deps.escHtml(String(input.llmSafety.maxEstimatedTokensPerWindow))}" oninput="scheduleProjectConfigSave(500)" />
        </label>
      </div>
    </div>
    <div class="config-field" style="margin-top:14px">
      <label class="config-label">${deps.t('configPromptOverridesLabel')}</label>
      <div class="config-help">${deps.t('configPromptOverridesHelp')}</div>
      <div style="display:grid;gap:10px;margin-top:8px">
        ${renderPromptEditor(input, {
          label: deps.t('configPromptSkillCallAnalyzerLabel'),
          fieldId: 'cfg_prompt_skill_call_analyzer',
          rows: 5,
          placeholder: deps.t('configPromptSkillCallAnalyzerPlaceholder'),
          defaultPrompt: promptDefaults.skillCallAnalyzer,
          overrideValue: input.promptOverrides.skillCallAnalyzer,
          source: input.promptSources.skillCallAnalyzer,
        })}
        ${renderPromptEditor(input, {
          label: deps.t('configPromptDecisionExplainerLabel'),
          fieldId: 'cfg_prompt_decision_explainer',
          rows: 4,
          placeholder: deps.t('configPromptDecisionExplainerPlaceholder'),
          defaultPrompt: promptDefaults.decisionExplainer,
          overrideValue: input.promptOverrides.decisionExplainer,
          source: input.promptSources.decisionExplainer,
        })}
        ${renderPromptEditor(input, {
          label: deps.t('configPromptReadinessProbeLabel'),
          fieldId: 'cfg_prompt_readiness_probe',
          rows: 4,
          placeholder: deps.t('configPromptReadinessProbePlaceholder'),
          defaultPrompt: promptDefaults.readinessProbe,
          overrideValue: input.promptOverrides.readinessProbe,
          source: input.promptSources.readinessProbe,
        })}
      </div>
    </div>
    <div class="config-actions">
      <span id="cfg_save_hint" class="config-label">${deps.escHtml(input.saveHint || '')}</span>
    </div>
  `;
}

export function renderDashboardConfigPanelSource(): string {
  return [
    getRuntimePromptDefaults.toString(),
    renderPromptEditor.toString(),
    renderDashboardConfigPanel.toString(),
  ].join('\n\n');
}
