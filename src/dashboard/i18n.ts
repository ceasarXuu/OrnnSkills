/**
 * Dashboard i18n
 *
 * 多语言字典，支持中英文切换。
 * 默认语言：英文
 */

export type Language = 'en' | 'zh';

export interface I18nStrings {
  // Header
  headerTitle: string;
  headerVersion: string;
  headerConnecting: string;
  headerConnected: string;
  headerDisconnected: string;
  headerRetrying: string;

  // Sidebar
  sidebarProjects: string;
  sidebarAddProject: string;
  sidebarAddPlaceholder: string;
  sidebarAddHint: string;
  sidebarNoProjects: string;
  sidebarRunning: string;
  sidebarPaused: string;
  sidebarStopped: string;
  sidebarSkills: string;
  sidebarPause: string;
  sidebarResume: string;

  // Main Panel
  mainSelectProject: string;
  mainLoading: string;
  mainNoData: string;
  mainTabOverview: string;
  mainTabSkills: string;
  mainTabActivity: string;
  mainTabCost: string;
  mainTabLogs: string;
  mainTabConfig: string;
  activityEmpty: string;
  logsEmpty: string;
  configTitle: string;
  configSave: string;
  configSaved: string;
  configSaving: string;
  configAutoSaved: string;
  configSaveFailed: string;
  configLoading: string;
  configIntro: string;
  configLogLevelLabel: string;
  configLogLevelHelp: string;
  configDefaultProviderLabel: string;
  configDefaultProviderHelp: string;
  configAutoOptimizeHelp: string;
  configUserConfirmHelp: string;
  configRuntimeSyncHelp: string;
  configProvidersLabel: string;
  configProvidersHelp: string;
  configLlmSafetyLabel: string;
  configLlmSafetyHelp: string;
  configLlmSafetyEnabledLabel: string;
  configLlmSafetyWindowLabel: string;
  configLlmSafetyRequestsLabel: string;
  configLlmSafetyConcurrentLabel: string;
  configLlmSafetyTokensLabel: string;
  configPromptOverridesLabel: string;
  configPromptOverridesHelp: string;
  configPromptSkillCallAnalyzerLabel: string;
  configPromptSkillCallAnalyzerPlaceholder: string;
  configPromptDecisionExplainerLabel: string;
  configPromptDecisionExplainerPlaceholder: string;
  configPromptReadinessProbeLabel: string;
  configPromptReadinessProbePlaceholder: string;
  configProvidersExample: string;
  configCheckConnectivity: string;
  configConnectivityChecking: string;
  configConnectivityTitle: string;
  configConnectivityEmpty: string;
  configAddProvider: string;
  configNoProviders: string;
  configCatalogLoading: string;
  configCatalogErrorPrefix: string;
  configLoadErrorPrefix: string;
  configRetry: string;
  configConnectivityCheckingHint: string;
  configConnectivityDone: string;
  configConnectivityFailed: string;
  configCustomProviderPlaceholder: string;
  configCustomModelPlaceholder: string;
  configApiKeyStoredPlaceholder: string;
  configApiKeyPastePlaceholder: string;
  configApiKeyShow: string;
  configApiKeyHide: string;
  configRemoveProvider: string;
  configCatalogCustomOnly: string;
  configCustomOption: string;
  configProviderAlertNotConfigured: string;
  configProviderAlertConnectivityFailed: string;
  configProviderAlertWarning: string;
  configProviderAlertNotConfiguredMessage: string;
  configProviderAlertConnectivityFailedPrefix: string;
  configProviderAlertHint: string;
  configProviderActiveLabel: string;

  // Stats
  statShadowSkills: string;
  statShadowSkillsSub: string;
  statTraces: string;
  statTracesSub: string;
  statUptime: string;
  statUptimeSub: string;
  statQueue: string;
  statQueueSub: string;
  overviewMapped: string;
  overviewMappedSub: string;
  overviewSkipped: string;
  overviewSkippedSub: string;
  overviewPatchDelta: string;
  overviewPatchDeltaSub: string;
  overviewHostDrift: string;
  overviewHostDriftSub: string;
  overviewMappingStrategy: string;
  overviewEvaluationRules: string;
  overviewSkipReasons: string;
  overviewPatchTypes: string;
  overviewNoMappingData: string;
  overviewNoEvaluationData: string;
  overviewNoSkipData: string;
  overviewNoPatchData: string;
  overviewAgentScopes: string;
  overviewNoAgentScopes: string;
  overviewAgentUsageSub: string;

  // Daemon Status
  daemonStatus: string;
  daemonState: string;
  daemonCurrentSkill: string;
  daemonRetryQueue: string;
  daemonLastCheckpoint: string;
  daemonLastOptimization: string;
  daemonLastError: string;
  daemonRunning: string;
  daemonPaused: string;
  daemonStopped: string;

  // States
  stateIdle: string;
  stateAnalyzing: string;
  stateOptimizing: string;
  stateError: string;

  // Skills
  skillsTitle: string;
  skillsCount: string;
  skillsEmpty: string;
  skillView: string;
  skillHistory: string;
  skillTraces: string;
  skillConfidence: string;
  skillsRuntimeAll: string;
  skillsSearchPlaceholder: string;
  skillsSortLabel: string;
  skillsSortName: string;
  skillsSortUpdated: string;
  skillsSearchEmptyPrefix: string;

  // Trace Activity
  traceTitle: string;
  traceTotal: string;
  traceRuntime: string;
  traceScope: string;
  traceDetail: string;
  traceAction: string;
  traceStatus: string;
  traceTime: string;
  traceEvent: string;
  activityNode: string;
  traceSession: string;
  traceId: string;
  activityLayerBusiness: string;
  activityLayerRaw: string;
  activityTagAll: string;
  activityTagCoreFlow: string;
  activityTagStabilityFeedback: string;
  activityTagSkillObserved: string;
  activityTagAnalysisStarted: string;
  activityTagAnalysisInterrupted: string;
  activityTagAnalysisWaiting: string;
  activityTagAnalysisConcluded: string;
  activityTagOptimizationSkipped: string;
  activityTagOptimizationApplied: string;
  activityTagSkillCalled: string;
  activityTagSkillAdded: string;
  activityTagSkillRemoved: string;
  activityTagSkillEdited: string;
  activityTagSkillVersion: string;
  activityTagDaemon: string;
  activityTagOptimization: string;
  activityTagEvaluationResult: string;
  activityTagSkillFeedback: string;
  activityTagPatchApplied: string;
  activityTagAnalysisFailed: string;
  activityTagAnalysisSubmitted: string;
  activityTagProbeResult: string;
  activityTagProbeSubmitted: string;
  activityViewDetails: string;
  activityCopy: string;
  activityDetailTitle: string;
  activityDetailEmpty: string;
  activityHostFallback: string;
  activityScopeFallback: string;
  activityStatusFallback: string;
  activityStatusObserved: string;
  activityStatusAnalyzing: string;
  activityStatusWaiting: string;
  activityStatusNoOptimization: string;
  activityStatusSkipped: string;
  activityStatusApplied: string;
  activityStatusInterrupted: string;
  activityStatusFailed: string;
  activityDetailFallback: string;
  activitySourceDecision: string;
  activitySourceTrace: string;
  activitySummarySkillCalled: string;
  activitySummarySkillObserved: string;
  activitySummaryAnalysisStarted: string;
  activitySummaryAnalysisInterrupted: string;
  activitySummaryAnalysisWaiting: string;
  activitySummaryAnalysisConcluded: string;
  activitySummaryOptimizationSkipped: string;
  activitySummaryOptimizationApplied: string;
  activitySummarySkillAdded: string;
  activitySummarySkillRemoved: string;
  activitySummarySkillEdited: string;
  activitySummarySkillVersion: string;
  activitySummarySkillMapped: string;
  activitySummaryDaemonStarted: string;
  activitySummaryDaemonStopped: string;
  activitySummaryOptimizationChanged: string;
  activitySummaryEvaluationResult: string;
  activitySummarySkillFeedback: string;
  activitySummaryPatchApplied: string;
  activitySummaryAnalysisFailed: string;
  activitySummaryAnalysisSubmitted: string;
  activitySummaryProbeResult: string;
  activitySummaryProbeSubmitted: string;
  activityTraceToolCall: string;
  activityTraceToolResult: string;
  activityTraceAssistantOutput: string;
  activityTraceUserInput: string;
  activityTraceFileChange: string;
  activitySourceLabel: string;
  activitySkillLabel: string;
  activitySessionIdLabel: string;
  activityDetailNode: string;
  activityDetailInput: string;
  activityDetailSummary: string;
  activityDetailNextStep: string;
  activityProject: string;
  activityScopeStatusObserving: string;
  activityScopeStatusOptimized: string;
  activityScopeStatusNoOptimization: string;
  activityScopeTimelineTitle: string;
  activityScopeNodeSkillCalled: string;
  activityScopeNodeAnalysisSubmitted: string;
  activityScopeNodeAnalysisResult: string;
  activityScopeNodeOptimizationCompleted: string;
  activityScopeNodeNoOptimization: string;
  activityScopeTraceCount: string;
  activityScopeCharCount: string;
  activityScopeModel: string;
  activityScopeSubmittedTraceText: string;
  activityScopeDetailLoading: string;
  activityScopeDetailLoadFailed: string;

  // Cost Panel
  costEmpty: string;
  costEstimated: string;
  costEstimatedSub: string;
  costCalls: string;
  costCallsSub: string;
  costInputTokens: string;
  costInputTokensSub: string;
  costOutputTokens: string;
  costOutputTokensSub: string;
  costTotalTokens: string;
  costTotalTokensSub: string;
  costModel: string;
  costScope: string;
  costCapabilities: string;
  costMaxInput: string;
  costMaxOutput: string;
  costEstimatedSpend: string;
  costUnknownPricing: string;
  costByScope: string;
  costAvgLatency: string;
  costAvgLatencySub: string;
  costAvgTokensPerCall: string;
  costAvgTokensPerCallSub: string;
  costLastCall: string;
  costLastCallSub: string;
  costModelSpend: string;
  costModelCount: string;
  costScopeBreakdown: string;
  costScopeEmpty: string;
  costSkillBreakdown: string;
  costSkillEmpty: string;
  costSignalsTitle: string;
  costSignalsSourceLabel: string;
  costSignalsSourceBody: string;
  costSignalsVisibleLabel: string;
  costSignalsVisibleBody: string;
  costSignalsContextReady: string;
  costSignalsContextPending: string;
  costSignalsReasoningDetected: string;
  costSignalsInputOutputOnly: string;
  costTableModel: string;
  costTableUsage: string;
  costTableLatency: string;
  costTableContextWindow: string;
  costTablePricing: string;
  costTableCapabilities: string;
  costTableCallsSuffix: string;
  costTableTokensSuffix: string;
  costTableInOut: string;
  costTableLastSeen: string;
  costPricingReasoningSurcharge: string;
  costPricingSource: string;
  costCapabilityReasoning: string;
  costCapabilityFunctionCalling: string;
  costCapabilityPromptCaching: string;
  costCapabilityStructuredOutput: string;
  costCapabilityVision: string;
  costCapabilityWebSearch: string;
  costCapabilityNone: string;

  // Log Panel
  logTitle: string;
  logFilterAll: string;
  initProjectsLoadFailed: string;
  initRecoveryWaiting: string;
  projectRenderFailed: string;
  projectRenderHint: string;
  runtimeBuildMismatchPrefix: string;
  runtimeHostUnavailable: string;

  // Modal
  modalClose: string;
  modalLoading: string;
  modalNoContent: string;
  modalVersionHistory: string;
  modalNoVersions: string;
  modalCurrent: string;
  modalEffective: string;
  modalInvalid: string;
  modalInvalidate: string;
  modalRestore: string;
  modalClickToLoad: string;
  modalLoadError: string;
  modalSave: string;
  modalSaving: string;
  modalNoChanges: string;
  modalSavedVersionPrefix: string;
  modalManualEditReason: string;
  modalSaveFailed: string;
  modalVersionActionFailed: string;
  modalApplyAllButton: string;
  modalApplyAllTitle: string;
  modalApplyAllCancel: string;
  modalApplyAllConfirm: string;
  modalApplyAllSavingLine: string;
  modalApplyAllTargetsLine: string;
  modalApplyAllOneOffLine: string;
  modalApplyAllRunning: string;
  modalApplyAllFailed: string;
  modalApplyAllSummaryPrefix: string;
  modalApplyAllSummaryUpdated: string;
  modalApplyAllSummarySkipped: string;
  modalApplyAllSummaryFailed: string;

  // Time
  timeAgo: string;
  timeJustNow: string;
  timeDays: string;
  timeHours: string;
  timeMinutes: string;
  timeSeconds: string;
  uptimeDays: string;
  uptimeHours: string;
  uptimeMinutes: string;
  uptimeSeconds: string;
}

const en: I18nStrings = {
  // Header
  headerTitle: 'OrnnSkills',
  headerVersion: 'Dashboard',
  headerConnecting: 'Connecting...',
  headerConnected: 'Connected',
  headerDisconnected: 'Disconnected',
  headerRetrying: 'retrying',

  // Sidebar
  sidebarProjects: 'Projects',
  sidebarAddProject: 'Add Project',
  sidebarAddPlaceholder: '/path/to/project',
  sidebarAddHint: 'Press Enter to add',
  sidebarNoProjects: 'No projects registered',
  sidebarRunning: 'RUNNING',
  sidebarPaused: 'PAUSED',
  sidebarStopped: 'STOPPED',
  sidebarSkills: 'skills',
  sidebarPause: 'Pause',
  sidebarResume: 'Resume',

  // Main Panel
  mainSelectProject: '← Select a project',
  mainLoading: 'Loading...',
  mainNoData: 'No data',
  mainTabOverview: 'Overview',
  mainTabSkills: 'Skills',
  mainTabActivity: 'Activity',
  mainTabCost: 'Cost',
  mainTabLogs: 'Logs',
  mainTabConfig: 'Config',
  activityEmpty: 'No trace activity yet.',
  logsEmpty: 'No logs yet.',
  configTitle: 'Ornn Config',
  configSave: 'Save Config',
  configSaved: 'Config saved',
  configSaving: 'Saving...',
  configAutoSaved: 'Auto-saved',
  configSaveFailed: 'Failed to save config',
  configLoading: 'Loading config...',
  configIntro:
    'These settings are written to ~/.ornn/config/settings.toml and apply globally across all registered projects.',
  configLogLevelLabel: 'Log Level',
  configLogLevelHelp:
    'Controls Ornn host-side log verbosity written into settings.toml.',
  configDefaultProviderLabel: 'Default Provider',
  configDefaultProviderHelp:
    'Sets llm.default_provider. New analyzer calls use this provider first unless a task overrides it.',
  configAutoOptimizeHelp:
    'When enabled, Ornn automatically analyzes traces and proposes or applies skill optimization.',
  configUserConfirmHelp:
    'When enabled, optimization changes require manual confirmation before write-back; disable for fully automatic flow.',
  configRuntimeSyncHelp:
    'When enabled, latest skill content is synced back to project skills so all hosts share the same optimized version.',
  configProvidersLabel: 'Providers',
  configProvidersHelp:
    'Configure providers with dropdown + inputs. Pick provider, choose or type model, paste API Key, and mark exactly one provider as active.',
  configLlmSafetyLabel: 'LLM Safety Guard',
  configLlmSafetyHelp: 'Blocks bursty or runaway model calls before they reach the provider.',
  configLlmSafetyEnabledLabel: 'Enable safety guard',
  configLlmSafetyWindowLabel: 'Rolling Window (ms)',
  configLlmSafetyRequestsLabel: 'Max Requests / Window',
  configLlmSafetyConcurrentLabel: 'Max Concurrent Requests',
  configLlmSafetyTokensLabel: 'Max Estimated Tokens / Window',
  configPromptOverridesLabel: 'Prompt Overrides',
  configPromptOverridesHelp:
    'Append project-specific instructions to Ornn internal system prompts. Leave blank to keep the built-in defaults.',
  configPromptSkillCallAnalyzerLabel: 'Skill Call Analyzer',
  configPromptSkillCallAnalyzerPlaceholder:
    'Extra decision policy for window triage, attribution, and apply_optimization thresholds.',
  configPromptDecisionExplainerLabel: 'Decision Explainer',
  configPromptDecisionExplainerPlaceholder:
    'Extra writing style or explanation constraints for dashboard-facing summaries.',
  configPromptReadinessProbeLabel: 'Readiness Probe',
  configPromptReadinessProbePlaceholder:
    'Extra readiness rules for deciding when to wait, split, or start deep analysis.',
  configProvidersExample:
    '',
  configCheckConnectivity: 'Check Connectivity',
  configConnectivityChecking: 'Checking...',
  configConnectivityTitle: 'Provider Connectivity',
  configConnectivityEmpty: 'No providers',
  configAddProvider: 'Add Provider',
  configNoProviders: 'No provider yet. Use the button below to add one.',
  configCatalogLoading: 'Loading LiteLLM catalog...',
  configCatalogErrorPrefix: 'LiteLLM catalog error:',
  configLoadErrorPrefix: 'Failed to load remote config:',
  configRetry: 'Retry',
  configConnectivityCheckingHint: 'Checking connectivity...',
  configConnectivityDone: 'Connectivity check completed',
  configConnectivityFailed: 'Connectivity check failed',
  configCustomProviderPlaceholder: 'Custom provider id (e.g. xai)',
  configCustomModelPlaceholder: 'Custom model (e.g. grok-3)',
  configApiKeyStoredPlaceholder: 'API key stored; leave blank to keep',
  configApiKeyPastePlaceholder: 'Paste API key',
  configApiKeyShow: 'Show',
  configApiKeyHide: 'Hide',
  configRemoveProvider: 'Remove',
  configCatalogCustomOnly: 'LiteLLM catalog not ready (custom only)',
  configCustomOption: 'Custom...',
  configProviderAlertNotConfigured: 'Provider Not Configured',
  configProviderAlertConnectivityFailed: 'Provider Connectivity Failed',
  configProviderAlertWarning: 'Provider Health Warning',
  configProviderAlertNotConfiguredMessage: 'No provider is configured for this project.',
  configProviderAlertConnectivityFailedPrefix: 'Failed provider connectivity:',
  configProviderAlertHint: 'Open the Config tab to set provider and re-run connectivity check.',
  configProviderActiveLabel: 'Use',

  // Stats
  statShadowSkills: 'Shadow Skills',
  statShadowSkillsSub: 'in maintenance',
  statTraces: 'Traces',
  statTracesSub: 'processed',
  statUptime: 'Uptime',
  statUptimeSub: 'running',
  statQueue: 'Queue',
  statQueueSub: 'pending optimization',
  overviewMapped: 'Mapped',
  overviewMappedSub: 'strategy-classified traces',
  overviewSkipped: 'Skipped',
  overviewSkippedSub: 'optimization guardrails hit',
  overviewPatchDelta: 'Patch Delta',
  overviewPatchDeltaSub: 'lines changed',
  overviewHostDrift: 'Host Drift',
  overviewHostDriftSub: 'skills out of sync',
  overviewMappingStrategy: 'Mapping Strategy',
  overviewEvaluationRules: 'Evaluation Rules',
  overviewSkipReasons: 'Skip Reasons',
  overviewPatchTypes: 'Patch Types',
  overviewNoMappingData: 'No mapping data yet',
  overviewNoEvaluationData: 'No evaluation data yet',
  overviewNoSkipData: 'No skipped optimizations',
  overviewNoPatchData: 'No applied patches',
  overviewAgentScopes: 'Agent Scopes',
  overviewNoAgentScopes: 'No scoped usage yet',
  overviewAgentUsageSub: 'probe + optimization + explanation',

  // Daemon Status
  daemonStatus: 'Daemon Status',
  daemonState: 'State',
  daemonCurrentSkill: 'Current Skill',
  daemonRetryQueue: 'Retry Queue',
  daemonLastCheckpoint: 'Last Checkpoint',
  daemonLastOptimization: 'Last Optimization',
  daemonLastError: 'Last Error',
  daemonRunning: 'RUNNING',
  daemonPaused: 'PAUSED',
  daemonStopped: 'STOPPED',

  // States
  stateIdle: 'idle',
  stateAnalyzing: 'analyzing',
  stateOptimizing: 'optimizing',
  stateError: 'error',

  // Skills
  skillsTitle: 'Shadow Skills',
  skillsCount: 'skills',
  skillsEmpty: 'No shadow skills yet. Run the daemon to start optimizing.',
  skillView: 'View',
  skillHistory: 'History',
  skillTraces: 'traces',
  skillConfidence: 'conf',
  skillsRuntimeAll: 'All',
  skillsSearchPlaceholder: 'Search skills...',
  skillsSortLabel: 'Sort:',
  skillsSortName: 'Name',
  skillsSortUpdated: 'Updated',
  skillsSearchEmptyPrefix: 'No skills found matching',

  // Trace Activity
  traceTitle: 'Trace Activity',
  traceTotal: 'total',
  traceRuntime: 'Host',
  traceScope: 'Scope',
  traceDetail: 'Detail',
  traceAction: 'Action',
  traceStatus: 'Status',
  traceTime: 'Time',
  traceEvent: 'Event',
  activityNode: 'Node',
  traceSession: 'Session',
  traceId: 'Trace ID',
  activityLayerBusiness: 'Ornn Events',
  activityLayerRaw: 'Raw Traces',
  activityTagAll: 'All',
  activityTagCoreFlow: 'Core Flow',
  activityTagStabilityFeedback: 'Stability Feedback',
  activityTagSkillObserved: 'Skill Observed',
  activityTagAnalysisStarted: 'Analysis Started',
  activityTagAnalysisInterrupted: 'Analysis Interrupted',
  activityTagAnalysisWaiting: 'Waiting for More Context',
  activityTagAnalysisConcluded: 'Analysis Concluded',
  activityTagOptimizationSkipped: 'Optimization Skipped',
  activityTagOptimizationApplied: 'Optimization Applied',
  activityTagSkillCalled: 'Skill Called',
  activityTagSkillAdded: 'Skill Added',
  activityTagSkillRemoved: 'Skill Removed',
  activityTagSkillEdited: 'Skill Edited',
  activityTagSkillVersion: 'Version Iterated',
  activityTagDaemon: 'Daemon',
  activityTagOptimization: 'Optimization',
  activityTagEvaluationResult: 'Evaluation Result',
  activityTagSkillFeedback: 'Skill Feedback',
  activityTagPatchApplied: 'Patch Applied',
  activityTagAnalysisFailed: 'Analysis Pipeline Failure',
  activityTagAnalysisSubmitted: 'Analysis Submitted',
  activityTagProbeResult: 'Probe Result',
  activityTagProbeSubmitted: 'Probe Submitted',
  activityViewDetails: 'View Details',
  activityCopy: 'Copy',
  activityDetailTitle: 'Activity Detail',
  activityDetailEmpty: 'No readable detail available.',
  activityHostFallback: '—',
  activityScopeFallback: '—',
  activityStatusFallback: '—',
  activityStatusObserved: 'Observed',
  activityStatusAnalyzing: 'Analyzing',
  activityStatusWaiting: 'Waiting',
  activityStatusNoOptimization: 'No Optimization Needed',
  activityStatusSkipped: 'Kept Unchanged',
  activityStatusApplied: 'Applied',
  activityStatusInterrupted: 'Interrupted',
  activityStatusFailed: 'Failed',
  activityDetailFallback: 'No detail',
  activitySourceDecision: 'Decision Event',
  activitySourceTrace: 'Trace',
  activitySummarySkillCalled: 'Skill called',
  activitySummarySkillObserved: 'Observed skill activity',
  activitySummaryAnalysisStarted: 'Analysis started',
  activitySummaryAnalysisInterrupted: 'Analysis interrupted before a business conclusion was reached',
  activitySummaryAnalysisWaiting: 'Waiting for more context',
  activitySummaryAnalysisConcluded: 'Analysis concluded',
  activitySummaryOptimizationSkipped: 'Optimization skipped',
  activitySummaryOptimizationApplied: 'Optimization applied',
  activitySummarySkillAdded: 'Started monitoring skill',
  activitySummarySkillRemoved: 'Stopped monitoring skill',
  activitySummarySkillEdited: 'Skill edited',
  activitySummarySkillVersion: 'Skill version iterated',
  activitySummarySkillMapped: 'Skill mapped',
  activitySummaryDaemonStarted: 'Daemon started',
  activitySummaryDaemonStopped: 'Daemon stopped',
  activitySummaryOptimizationChanged: 'Optimization state changed',
  activitySummaryEvaluationResult: 'Evaluation result',
  activitySummarySkillFeedback: 'Skill feedback',
  activitySummaryPatchApplied: 'Patch applied',
  activitySummaryAnalysisFailed: 'Analysis pipeline failed',
  activitySummaryAnalysisSubmitted: 'Analysis submitted',
  activitySummaryProbeResult: 'Probe result',
  activitySummaryProbeSubmitted: 'Probe submitted',
  activityTraceToolCall: 'Tool call',
  activityTraceToolResult: 'Tool result',
  activityTraceAssistantOutput: 'Assistant output',
  activityTraceUserInput: 'User input',
  activityTraceFileChange: 'File change',
  activitySourceLabel: 'Source',
  activitySkillLabel: 'Skill',
  activitySessionIdLabel: 'Session ID',
  activityDetailNode: 'Node',
  activityDetailInput: 'Input',
  activityDetailSummary: 'Summary',
  activityDetailNextStep: 'Next Step',
  activityProject: 'Project',
  activityScopeStatusObserving: 'Observing',
  activityScopeStatusOptimized: 'Optimized',
  activityScopeStatusNoOptimization: 'No Optimization Needed',
  activityScopeTimelineTitle: 'Scope Timeline',
  activityScopeNodeSkillCalled: 'Skill Called',
  activityScopeNodeAnalysisSubmitted: 'Analysis Submitted',
  activityScopeNodeAnalysisResult: 'Analysis Result',
  activityScopeNodeOptimizationCompleted: 'Optimization Completed',
  activityScopeNodeNoOptimization: 'No Optimization',
  activityScopeTraceCount: 'Trace Count',
  activityScopeCharCount: 'Characters',
  activityScopeModel: 'Model',
  activityScopeSubmittedTraceText: 'Submitted Traces',
  activityScopeDetailLoading: 'Loading scope timeline...',
  activityScopeDetailLoadFailed: 'Failed to load scope timeline.',

  // Cost Panel
  costEmpty: 'No agent usage has been recorded yet.',
  costEstimated: 'Estimated Cost',
  costEstimatedSub: 'Calculated from LiteLLM pricing when available',
  costCalls: 'Agent Calls',
  costCallsSub: 'Cumulative analyzer / explainer invocations',
  costInputTokens: 'Input Tokens',
  costInputTokensSub: 'Prompt and context tokens',
  costOutputTokens: 'Output Tokens',
  costOutputTokensSub: 'Completion and reasoning tokens',
  costTotalTokens: 'Total Tokens',
  costTotalTokensSub: 'Input + output tokens',
  costModel: 'Model',
  costScope: 'Scope',
  costCapabilities: 'Capabilities',
  costMaxInput: 'Max Input',
  costMaxOutput: 'Max Output',
  costEstimatedSpend: 'Estimated Cost',
  costUnknownPricing: 'Pricing unavailable',
  costByScope: 'By Scope',
  costAvgLatency: 'Average Latency',
  costAvgLatencySub: 'Average time spent per invocation',
  costAvgTokensPerCall: 'Average Tokens / Call',
  costAvgTokensPerCallSub: 'Token density per invocation',
  costLastCall: 'Latest Call',
  costLastCallSub: 'Most recently recorded invocation',
  costModelSpend: 'Model Cost Breakdown',
  costModelCount: 'models',
  costScopeBreakdown: 'Scope Breakdown',
  costScopeEmpty: 'No scope usage rollups yet.',
  costSkillBreakdown: 'Top Skills by Token Spend',
  costSkillEmpty: 'No skill usage rollups yet.',
  costSignalsTitle: 'LiteLLM Signals',
  costSignalsSourceLabel: 'Visualization source:',
  costSignalsSourceBody: 'Unit pricing, context windows, and capability tags come from the LiteLLM model registry.',
  costSignalsVisibleLabel: 'Currently visible:',
  costSignalsVisibleBody: 'Calls, input tokens, output tokens, total tokens, average latency, latest call, and rollups by model, scope, and skill.',
  costSignalsContextReady: 'Context windows connected',
  costSignalsContextPending: 'Context windows pending',
  costSignalsReasoningDetected: 'Reasoning surcharge detected',
  costSignalsInputOutputOnly: 'Estimate based on input / output tokens only',
  costTableModel: 'Model',
  costTableUsage: 'Usage',
  costTableLatency: 'Latency',
  costTableContextWindow: 'Context Window',
  costTablePricing: 'Pricing',
  costTableCapabilities: 'Capabilities',
  costTableCallsSuffix: 'calls',
  costTableTokensSuffix: 'tokens',
  costTableInOut: 'input / output',
  costTableLastSeen: 'Last seen',
  costPricingReasoningSurcharge: 'Reasoning surcharge included',
  costPricingSource: 'LiteLLM registry',
  costCapabilityReasoning: 'Reasoning',
  costCapabilityFunctionCalling: 'Function Calling',
  costCapabilityPromptCaching: 'Prompt Caching',
  costCapabilityStructuredOutput: 'Structured Output',
  costCapabilityVision: 'Vision',
  costCapabilityWebSearch: 'Web Search',
  costCapabilityNone: 'No capability metadata',

  // Log Panel
  logTitle: 'Logs',
  logFilterAll: 'ALL',
  initProjectsLoadFailed: 'Failed to load projects',
  initRecoveryWaiting: 'Initialization failed. Waiting for backend data to recover...',
  projectRenderFailed: 'Project data loaded, but the dashboard panel failed to render.',
  projectRenderHint: 'Refresh the page. If it still reproduces, client errors have been queued for reporting.',
  runtimeBuildMismatchPrefix: 'build mismatch',
  runtimeHostUnavailable: 'host unavailable',

  // Modal
  modalClose: 'Close',
  modalLoading: 'Loading...',
  modalNoContent: '(no content)',
  modalVersionHistory: 'Version History',
  modalNoVersions: 'No versions yet',
  modalCurrent: 'current',
  modalEffective: 'effective',
  modalInvalid: 'invalid',
  modalInvalidate: 'Invalidate',
  modalRestore: 'Restore',
  modalClickToLoad: 'Click to load',
  modalLoadError: 'Error loading skill content.',
  modalSave: 'Save',
  modalSaving: 'Saving...',
  modalNoChanges: 'No changes detected',
  modalSavedVersionPrefix: 'Saved. Created v',
  modalManualEditReason: 'Manual edit from dashboard',
  modalSaveFailed: 'Save failed',
  modalVersionActionFailed: 'Failed to update version state.',
  modalApplyAllButton: 'Apply to all same-named skills',
  modalApplyAllTitle: 'Apply to all same-named skills',
  modalApplyAllCancel: 'Cancel',
  modalApplyAllConfirm: 'Apply now',
  modalApplyAllSavingLine: 'The current editor content will be saved as the latest version first if it has changed.',
  modalApplyAllTargetsLine:
    'Then Ornn will copy this content to the latest version of every same-named skill across all registered projects and deploy it to the corresponding host path immediately.',
  modalApplyAllOneOffLine: 'This is a one-time manual action. It will not keep syncing future changes.',
  modalApplyAllRunning: 'Applying...',
  modalApplyAllFailed: 'Failed to apply to same-named skills',
  modalApplyAllSummaryPrefix: 'Applied to same-named skills:',
  modalApplyAllSummaryUpdated: 'updated',
  modalApplyAllSummarySkipped: 'skipped',
  modalApplyAllSummaryFailed: 'failed',

  // Time
  timeAgo: 'ago',
  timeJustNow: 'just now',
  timeDays: 'd',
  timeHours: 'h',
  timeMinutes: 'm',
  timeSeconds: 's',
  uptimeDays: 'd',
  uptimeHours: 'h',
  uptimeMinutes: 'm',
  uptimeSeconds: 's',
};

const zh: I18nStrings = {
  // Header
  headerTitle: 'OrnnSkills',
  headerVersion: '控制面板',
  headerConnecting: '连接中...',
  headerConnected: '已连接',
  headerDisconnected: '已断开',
  headerRetrying: '重试中',

  // Sidebar
  sidebarProjects: '项目',
  sidebarAddProject: '添加项目',
  sidebarAddPlaceholder: '/项目路径',
  sidebarAddHint: '按回车键添加',
  sidebarNoProjects: '暂无注册的项目',
  sidebarRunning: '运行中',
  sidebarPaused: '已暂停',
  sidebarStopped: '已停止',
  sidebarSkills: '个技能',
  sidebarPause: '暂停',
  sidebarResume: '开始',

  // Main Panel
  mainSelectProject: '← 选择一个项目',
  mainLoading: '加载中...',
  mainNoData: '暂无数据',
  mainTabOverview: '总览',
  mainTabSkills: '技能列表',
  mainTabActivity: '实时追踪',
  mainTabCost: '成本',
  mainTabLogs: '日志',
  mainTabConfig: '配置',
  activityEmpty: '暂无追踪活动。',
  logsEmpty: '暂无日志。',
  configTitle: 'Ornn 配置',
  configSave: '保存配置',
  configSaved: '配置已保存',
  configSaving: '保存中...',
  configAutoSaved: '已自动保存',
  configSaveFailed: '配置保存失败',
  configLoading: '配置加载中...',
  configIntro:
    '这些配置会写入 ~/.ornn/config/settings.toml，并对所有已注册项目全局生效。',
  configLogLevelLabel: '日志级别',
  configLogLevelHelp:
    '控制写入 settings.toml 的宿主日志详细程度。',
  configDefaultProviderLabel: '默认模型服务',
  configDefaultProviderHelp:
    '设置 llm.default_provider。后续分析调用默认优先走这个模型服务，除非任务显式覆盖。',
  configAutoOptimizeHelp:
    '开启后，Ornn 会自动分析 trace 并触发技能优化建议或写回流程。',
  configUserConfirmHelp:
    '开启后，优化变更在写回前需要人工确认；关闭后按自动流程直接落盘。',
  configRuntimeSyncHelp:
    '开启后，会把最新技能内容同步回项目 skills，保证不同宿主使用同一份优化结果。',
  configProvidersLabel: '模型服务列表',
  configProvidersHelp:
    '通过下拉和输入框配置模型服务：选择模型服务，选择或输入模型，直接粘贴 API Key，并且只启用其中一个默认模型服务。',
  configLlmSafetyLabel: 'LLM 安全闸门',
  configLlmSafetyHelp: '在请求真正发到模型服务前，拦截异常突发或失控重试的调用。',
  configLlmSafetyEnabledLabel: '启用安全闸门',
  configLlmSafetyWindowLabel: '滚动窗口（毫秒）',
  configLlmSafetyRequestsLabel: '窗口内最大请求数',
  configLlmSafetyConcurrentLabel: '最大并发请求数',
  configLlmSafetyTokensLabel: '窗口内最大预计 Tokens',
  configPromptOverridesLabel: '提示词覆写',
  configPromptOverridesHelp:
    '把项目级附加规则追加到 Ornn 的内部 system prompt。留空时继续使用内置默认逻辑。',
  configPromptSkillCallAnalyzerLabel: 'Skill 调用分析器',
  configPromptSkillCallAnalyzerPlaceholder:
    '补充窗口分诊、归因判断、apply_optimization 触发阈值等规则。',
  configPromptDecisionExplainerLabel: '决策解释器',
  configPromptDecisionExplainerPlaceholder:
    '补充 dashboard 文案风格、长度、语气等解释约束。',
  configPromptReadinessProbeLabel: 'Readiness Probe',
  configPromptReadinessProbePlaceholder:
    '补充何时继续等待、拆分窗口或启动深度分析的判断规则。',
  configProvidersExample:
    '',
  configCheckConnectivity: '检查连通性',
  configConnectivityChecking: '检查中...',
  configConnectivityTitle: '模型服务连通性',
  configConnectivityEmpty: '暂无模型服务',
  configAddProvider: '新增模型服务',
  configNoProviders: '暂无模型服务，请点击下方按钮添加。',
  configCatalogLoading: 'LiteLLM 列表加载中...',
  configCatalogErrorPrefix: 'LiteLLM 列表错误：',
  configLoadErrorPrefix: '远端配置加载失败：',
  configRetry: '重试',
  configConnectivityCheckingHint: '连通性检查中...',
  configConnectivityDone: '连通性检查完成',
  configConnectivityFailed: '连通性检查失败',
  configCustomProviderPlaceholder: '自定义模型服务 ID（例如：xai）',
  configCustomModelPlaceholder: '自定义 model（例如：grok-3）',
  configApiKeyStoredPlaceholder: 'API Key 已保存；留空表示不修改',
  configApiKeyPastePlaceholder: '直接粘贴 API Key',
  configApiKeyShow: '显示',
  configApiKeyHide: '隐藏',
  configRemoveProvider: '删除',
  configCatalogCustomOnly: 'LiteLLM 列表未就绪（仅可自定义）',
  configCustomOption: '自定义',
  configProviderAlertNotConfigured: '模型服务未配置',
  configProviderAlertConnectivityFailed: '模型服务无法连通',
  configProviderAlertWarning: '模型服务检查异常',
  configProviderAlertNotConfiguredMessage: '当前项目尚未配置任何模型服务。',
  configProviderAlertConnectivityFailedPrefix: '检测到模型服务连通失败：',
  configProviderAlertHint: '请在配置页补充模型服务并完成连通性检查。',
  configProviderActiveLabel: '启用',

  // Stats
  statShadowSkills: '影子技能',
  statShadowSkillsSub: '维护中',
  statTraces: '追踪',
  statTracesSub: '已处理',
  statUptime: '运行时间',
  statUptimeSub: '运行状态',
  statQueue: '队列',
  statQueueSub: '等待优化',
  overviewMapped: '映射数',
  overviewMappedSub: '已分类的技能映射',
  overviewSkipped: '跳过数',
  overviewSkippedSub: '命中优化保护条件',
  overviewPatchDelta: '变更行数',
  overviewPatchDeltaSub: '累计补丁改动',
  overviewHostDrift: '宿主漂移',
  overviewHostDriftSub: '技能未与宿主对齐',
  overviewMappingStrategy: '映射策略',
  overviewEvaluationRules: '评估规则',
  overviewSkipReasons: '跳过原因',
  overviewPatchTypes: '修改类型',
  overviewNoMappingData: '暂无映射数据',
  overviewNoEvaluationData: '暂无评估规则数据',
  overviewNoSkipData: '暂无跳过记录',
  overviewNoPatchData: '暂无补丁记录',
  overviewAgentScopes: '调用范围',
  overviewNoAgentScopes: '暂无范围级调用数据',
  overviewAgentUsageSub: '探测 + 优化 + 解释',

  // Daemon Status
  daemonStatus: '守护进程状态',
  daemonState: '状态',
  daemonCurrentSkill: '当前技能',
  daemonRetryQueue: '重试队列',
  daemonLastCheckpoint: '上次检查点',
  daemonLastOptimization: '上次优化',
  daemonLastError: '上次错误',
  daemonRunning: '运行中',
  daemonPaused: '已暂停',
  daemonStopped: '已停止',

  // States
  stateIdle: '空闲',
  stateAnalyzing: '分析中',
  stateOptimizing: '优化中',
  stateError: '错误',

  // Skills
  skillsTitle: '影子技能',
  skillsCount: '个技能',
  skillsEmpty: '暂无影子技能。启动守护进程开始优化。',
  skillView: '查看',
  skillHistory: '历史',
  skillTraces: '次追踪',
  skillConfidence: '置信度',
  skillsRuntimeAll: '全部',
  skillsSearchPlaceholder: '搜索技能...',
  skillsSortLabel: '排序：',
  skillsSortName: '名称',
  skillsSortUpdated: '更新时间',
  skillsSearchEmptyPrefix: '没有匹配的技能',

  // Trace Activity
  traceTitle: '追踪活动',
  traceTotal: '总计',
  traceRuntime: '宿主',
  traceScope: '范围',
  traceDetail: '详情',
  traceAction: '操作',
  traceStatus: '状态',
  traceTime: '时间',
  traceEvent: '事件',
  activityNode: '节点',
  traceSession: '会话',
  traceId: '追踪 ID',
  activityLayerBusiness: 'Ornn 业务事件',
  activityLayerRaw: '原始 Trace',
  activityTagAll: '全部',
  activityTagCoreFlow: '核心流程',
  activityTagStabilityFeedback: '稳定性反馈',
  activityTagSkillObserved: '观察到技能参与',
  activityTagAnalysisStarted: '开始分析',
  activityTagAnalysisInterrupted: '分析中断',
  activityTagAnalysisWaiting: '继续等待上下文',
  activityTagAnalysisConcluded: '分析结论',
  activityTagOptimizationSkipped: '暂不优化',
  activityTagOptimizationApplied: '优化已应用',
  activityTagSkillCalled: '技能调用',
  activityTagSkillAdded: '新增监控',
  activityTagSkillRemoved: '移除监控',
  activityTagSkillEdited: '技能编辑',
  activityTagSkillVersion: '版本迭代',
  activityTagDaemon: '守护进程',
  activityTagOptimization: '优化状态',
  activityTagEvaluationResult: '评估结果',
  activityTagSkillFeedback: '技能反馈',
  activityTagPatchApplied: '补丁已应用',
  activityTagAnalysisFailed: '分析链路异常',
  activityTagAnalysisSubmitted: '分析已提交',
  activityTagProbeResult: '时机探测结果',
  activityTagProbeSubmitted: '时机探测已提交',
  activityViewDetails: '查看详情',
  activityCopy: '复制',
  activityDetailTitle: '事件详情',
  activityDetailEmpty: '当前事件没有可读详情。',
  activityHostFallback: '—',
  activityScopeFallback: '—',
  activityStatusFallback: '—',
  activityStatusObserved: '已观察',
  activityStatusAnalyzing: '分析中',
  activityStatusWaiting: '继续观察',
  activityStatusNoOptimization: '无需优化',
  activityStatusSkipped: '保持现状',
  activityStatusApplied: '已应用',
  activityStatusInterrupted: '已中断',
  activityStatusFailed: '失败',
  activityDetailFallback: '暂无详情',
  activitySourceDecision: '决策事件',
  activitySourceTrace: 'Trace',
  activitySummarySkillCalled: '调用技能',
  activitySummarySkillObserved: '观察到技能参与当前窗口',
  activitySummaryAnalysisStarted: '已提交本轮分析',
  activitySummaryAnalysisInterrupted: '本轮分析已中断，尚未形成业务结论',
  activitySummaryAnalysisWaiting: '当前证据不足，继续收集上下文',
  activitySummaryAnalysisConcluded: '本轮分析已形成结论',
  activitySummaryOptimizationSkipped: '当前结论是不执行优化',
  activitySummaryOptimizationApplied: '本轮优化已经写回',
  activitySummarySkillAdded: '开始监控技能',
  activitySummarySkillRemoved: '移除技能监控',
  activitySummarySkillEdited: '技能被编辑',
  activitySummarySkillVersion: '技能版本迭代',
  activitySummarySkillMapped: '技能映射成功',
  activitySummaryDaemonStarted: '守护进程已启动',
  activitySummaryDaemonStopped: '守护进程已停止',
  activitySummaryOptimizationChanged: '优化状态变化',
  activitySummaryEvaluationResult: '评估结果',
  activitySummarySkillFeedback: '技能反馈',
  activitySummaryPatchApplied: '修改已应用',
  activitySummaryAnalysisFailed: '分析链路异常',
  activitySummaryAnalysisSubmitted: '已提交分析请求',
  activitySummaryProbeResult: '时机探测结果',
  activitySummaryProbeSubmitted: '已提交时机探测',
  activityTraceToolCall: '工具调用',
  activityTraceToolResult: '工具返回',
  activityTraceAssistantOutput: '助手输出',
  activityTraceUserInput: '用户输入',
  activityTraceFileChange: '文件变更',
  activitySourceLabel: '来源',
  activitySkillLabel: '技能',
  activitySessionIdLabel: '会话 ID',
  activityDetailNode: '节点',
  activityDetailInput: '输入',
  activityDetailSummary: '说明',
  activityDetailNextStep: '下一步',
  activityProject: '项目',
  activityScopeStatusObserving: '观察中',
  activityScopeStatusOptimized: '优化完成',
  activityScopeStatusNoOptimization: '无需优化',
  activityScopeTimelineTitle: 'Scope 时间线',
  activityScopeNodeSkillCalled: '技能调用',
  activityScopeNodeAnalysisSubmitted: '提交分析',
  activityScopeNodeAnalysisResult: '分析结果',
  activityScopeNodeOptimizationCompleted: '优化完成',
  activityScopeNodeNoOptimization: '无需优化',
  activityScopeTraceCount: 'Trace 数',
  activityScopeCharCount: '字符数',
  activityScopeModel: '分析模型',
  activityScopeSubmittedTraceText: '提交分析的 Trace',
  activityScopeDetailLoading: '正在加载 scope 时间线...',
  activityScopeDetailLoadFailed: '加载 scope 时间线失败。',

  // Cost Panel
  costEmpty: '当前还没有记录到 agent 调用成本数据。',
  costEstimated: '估算成本',
  costEstimatedSub: '有 LiteLLM 定价数据时按模型自动估算',
  costCalls: 'Agent 调用',
  costCallsSub: '累计分析 / 解释调用次数',
  costInputTokens: '输入 Tokens',
  costInputTokensSub: 'Prompt 与上下文消耗',
  costOutputTokens: '输出 Tokens',
  costOutputTokensSub: 'Completion 与 reasoning 消耗',
  costTotalTokens: '总 Tokens',
  costTotalTokensSub: '输入 + 输出总量',
  costModel: '模型',
  costScope: '范围',
  costCapabilities: '能力',
  costMaxInput: '最大输入',
  costMaxOutput: '最大输出',
  costEstimatedSpend: '估算成本',
  costUnknownPricing: '暂无定价',
  costByScope: '按范围',
  costAvgLatency: '平均时延',
  costAvgLatencySub: '单次调用平均耗时',
  costAvgTokensPerCall: '单次平均 Token',
  costAvgTokensPerCallSub: '每次调用的 Token 密度',
  costLastCall: '最近调用',
  costLastCallSub: '最近一次记录',
  costModelSpend: '模型成本拆分',
  costModelCount: '个模型',
  costScopeBreakdown: '按范围拆分',
  costScopeEmpty: '当前还没有范围聚合数据。',
  costSkillBreakdown: '技能 Token 消耗 Top 5',
  costSkillEmpty: '当前还没有技能聚合数据。',
  costSignalsTitle: 'LiteLLM 信号',
  costSignalsSourceLabel: '可视化来源：',
  costSignalsSourceBody: '单价、上下文窗口和能力标签来自 LiteLLM 模型注册表。',
  costSignalsVisibleLabel: '当前可见：',
  costSignalsVisibleBody: '调用次数、输入 Token、输出 Token、总 Token、平均时延、最近调用，以及按模型、范围、技能的拆账。',
  costSignalsContextReady: '上下文窗口已接入',
  costSignalsContextPending: '上下文窗口待接入',
  costSignalsReasoningDetected: '已检测到 reasoning 附加计费',
  costSignalsInputOutputOnly: '当前估算仅基于输入 / 输出 Token',
  costTableModel: '模型',
  costTableUsage: '用量',
  costTableLatency: '时延',
  costTableContextWindow: '上下文窗口',
  costTablePricing: 'LiteLLM 定价',
  costTableCapabilities: '能力标签',
  costTableCallsSuffix: '次调用',
  costTableTokensSuffix: 'Token',
  costTableInOut: '输入 / 输出',
  costTableLastSeen: '最近',
  costPricingReasoningSurcharge: '含 reasoning 附加计费',
  costPricingSource: 'LiteLLM 模型注册表',
  costCapabilityReasoning: '推理',
  costCapabilityFunctionCalling: '函数调用',
  costCapabilityPromptCaching: 'Prompt 缓存',
  costCapabilityStructuredOutput: '结构化输出',
  costCapabilityVision: '视觉',
  costCapabilityWebSearch: 'Web 搜索',
  costCapabilityNone: '暂无能力元数据',

  // Log Panel
  logTitle: '日志',
  logFilterAll: '全部',
  initProjectsLoadFailed: '加载项目失败',
  initRecoveryWaiting: '初始化失败，正在等待后台数据自动恢复...',
  projectRenderFailed: '项目数据已加载，但仪表板面板渲染失败。',
  projectRenderHint: '请先刷新页面；如果仍能复现，客户端错误已经进入上报队列。',
  runtimeBuildMismatchPrefix: '版本不一致',
  runtimeHostUnavailable: '宿主信息不可用',

  // Modal
  modalClose: '关闭',
  modalLoading: '加载中...',
  modalNoContent: '（无内容）',
  modalVersionHistory: '版本历史',
  modalNoVersions: '暂无版本',
  modalCurrent: '当前',
  modalEffective: '生效中',
  modalInvalid: '无效',
  modalInvalidate: '无效',
  modalRestore: '恢复',
  modalClickToLoad: '点击加载',
  modalLoadError: '加载技能内容失败。',
  modalSave: '保存',
  modalSaving: '保存中...',
  modalNoChanges: '内容未变化',
  modalSavedVersionPrefix: '保存成功，已创建 v',
  modalManualEditReason: '通过 dashboard 手动编辑',
  modalSaveFailed: '保存失败',
  modalVersionActionFailed: '更新版本状态失败。',
  modalApplyAllButton: '应用到所有同名技能',
  modalApplyAllTitle: '应用到所有同名技能',
  modalApplyAllCancel: '取消',
  modalApplyAllConfirm: '立即应用',
  modalApplyAllSavingLine: '会先保存当前编辑器内容；如果内容有变化，会创建当前 skill 的最新版本。',
  modalApplyAllTargetsLine:
    '然后 Ornn 会把这份内容复制到所有已注册项目里所有同名 skill 的最新版本，并立即部署到对应宿主路径。',
  modalApplyAllOneOffLine: '这是一次性的手动操作，不会持续监听或自动同步后续变更。',
  modalApplyAllRunning: '批量应用中...',
  modalApplyAllFailed: '批量应用失败',
  modalApplyAllSummaryPrefix: '已应用到同名技能：',
  modalApplyAllSummaryUpdated: '个更新',
  modalApplyAllSummarySkipped: '个跳过',
  modalApplyAllSummaryFailed: '个失败',

  // Time
  timeAgo: '前',
  timeJustNow: '刚刚',
  timeDays: '天',
  timeHours: '小时',
  timeMinutes: '分',
  timeSeconds: '秒',
  uptimeDays: '天',
  uptimeHours: '小时',
  uptimeMinutes: '分',
  uptimeSeconds: '秒',
};

const dictionary: Record<Language, I18nStrings> = { en, zh };

export function getI18n(lang: Language = 'en'): I18nStrings {
  return dictionary[lang] ?? dictionary.en;
}
