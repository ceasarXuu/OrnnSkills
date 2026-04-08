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
  sidebarStopped: string;
  sidebarSkills: string;

  // Main Panel
  mainSelectProject: string;
  mainLoading: string;
  mainNoData: string;
  mainTabOverview: string;
  mainTabSkills: string;
  mainTabActivity: string;
  mainTabLogs: string;
  mainTabConfig: string;
  activityEmpty: string;
  logsEmpty: string;
  configTitle: string;
  configSave: string;
  configSaved: string;
  configSaveFailed: string;
  configLoading: string;
  configIntro: string;
  configLogLevelHelp: string;
  configDefaultProviderHelp: string;
  configAutoOptimizeHelp: string;
  configUserConfirmHelp: string;
  configRuntimeSyncHelp: string;
  configProvidersHelp: string;
  configProvidersExample: string;
  configCheckConnectivity: string;
  configConnectivityChecking: string;
  configConnectivityTitle: string;

  // Stats
  statShadowSkills: string;
  statShadowSkillsSub: string;
  statTraces: string;
  statTracesSub: string;
  statUptime: string;
  statUptimeSub: string;
  statQueue: string;
  statQueueSub: string;

  // Daemon Status
  daemonStatus: string;
  daemonState: string;
  daemonCurrentSkill: string;
  daemonRetryQueue: string;
  daemonLastCheckpoint: string;
  daemonLastOptimization: string;
  daemonLastError: string;
  daemonRunning: string;
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

  // Trace Activity
  traceTitle: string;
  traceTotal: string;
  traceRuntime: string;
  traceStatus: string;
  traceTime: string;
  traceEvent: string;
  traceSession: string;
  activityLayerBusiness: string;
  activityLayerRaw: string;
  activityTagAll: string;
  activityTagSkillCalled: string;
  activityTagSkillAdded: string;
  activityTagSkillRemoved: string;
  activityTagSkillEdited: string;
  activityTagSkillVersion: string;
  activityTagDaemon: string;
  activityTagOptimization: string;

  // Log Panel
  logTitle: string;
  logFilterAll: string;

  // Modal
  modalClose: string;
  modalLoading: string;
  modalNoContent: string;
  modalVersionHistory: string;
  modalNoVersions: string;
  modalCurrent: string;
  modalClickToLoad: string;

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
  sidebarStopped: 'STOPPED',
  sidebarSkills: 'skills',

  // Main Panel
  mainSelectProject: '← Select a project',
  mainLoading: 'Loading...',
  mainNoData: 'No data',
  mainTabOverview: 'Overview',
  mainTabSkills: 'Skills',
  mainTabActivity: 'Activity',
  mainTabLogs: 'Logs',
  mainTabConfig: 'Config',
  activityEmpty: 'No trace activity yet.',
  logsEmpty: 'No logs yet.',
  configTitle: 'Ornn Config',
  configSave: 'Save Config',
  configSaved: 'Config saved',
  configSaveFailed: 'Failed to save config',
  configLoading: 'Loading config...',
  configIntro:
    'These settings are written to .ornn/ornn.toml for the current project and control optimization strategy and model provider behavior.',
  configLogLevelHelp:
    '',
  configDefaultProviderHelp:
    '',
  configAutoOptimizeHelp:
    'When enabled, Ornn automatically analyzes traces and proposes or applies skill optimization.',
  configUserConfirmHelp:
    'When enabled, optimization changes require manual confirmation before write-back; disable for fully automatic flow.',
  configRuntimeSyncHelp:
    'When enabled, latest skill content is synced back to project skills so all runtimes share the same optimized version.',
  configProvidersHelp:
    'Configure providers with dropdown + inputs. Pick provider, choose or type model, paste API Key, and keep or adjust the env var name used in .env.local.',
  configProvidersExample:
    '',
  configCheckConnectivity: 'Check Connectivity',
  configConnectivityChecking: 'Checking...',
  configConnectivityTitle: 'Provider Connectivity',

  // Stats
  statShadowSkills: 'Shadow Skills',
  statShadowSkillsSub: 'in maintenance',
  statTraces: 'Traces',
  statTracesSub: 'processed',
  statUptime: 'Uptime',
  statUptimeSub: 'running',
  statQueue: 'Queue',
  statQueueSub: 'pending optimization',

  // Daemon Status
  daemonStatus: 'Daemon Status',
  daemonState: 'State',
  daemonCurrentSkill: 'Current Skill',
  daemonRetryQueue: 'Retry Queue',
  daemonLastCheckpoint: 'Last Checkpoint',
  daemonLastOptimization: 'Last Optimization',
  daemonLastError: 'Last Error',
  daemonRunning: 'RUNNING',
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

  // Trace Activity
  traceTitle: 'Trace Activity',
  traceTotal: 'total',
  traceRuntime: 'Runtime',
  traceStatus: 'Status',
  traceTime: 'Time',
  traceEvent: 'Event',
  traceSession: 'Session',
  activityLayerBusiness: 'Ornn Events',
  activityLayerRaw: 'Raw Traces',
  activityTagAll: 'All',
  activityTagSkillCalled: 'Skill Called',
  activityTagSkillAdded: 'Skill Added',
  activityTagSkillRemoved: 'Skill Removed',
  activityTagSkillEdited: 'Skill Edited',
  activityTagSkillVersion: 'Version Iterated',
  activityTagDaemon: 'Daemon',
  activityTagOptimization: 'Optimization',

  // Log Panel
  logTitle: 'Logs',
  logFilterAll: 'ALL',

  // Modal
  modalClose: 'Close',
  modalLoading: 'Loading...',
  modalNoContent: '(no content)',
  modalVersionHistory: 'Version History',
  modalNoVersions: 'No versions yet',
  modalCurrent: 'current',
  modalClickToLoad: 'Click to load',

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
  sidebarStopped: '已停止',
  sidebarSkills: '个技能',

  // Main Panel
  mainSelectProject: '← 选择一个项目',
  mainLoading: '加载中...',
  mainNoData: '暂无数据',
  mainTabOverview: '总览',
  mainTabSkills: '技能列表',
  mainTabActivity: '实时追踪',
  mainTabLogs: '日志',
  mainTabConfig: '配置',
  activityEmpty: '暂无追踪活动。',
  logsEmpty: '暂无日志。',
  configTitle: 'Ornn 配置',
  configSave: '保存配置',
  configSaved: '配置已保存',
  configSaveFailed: '配置保存失败',
  configLoading: '配置加载中...',
  configIntro:
    '这些配置会写入当前项目的 .ornn/ornn.toml，用于控制 Ornn 的优化策略与模型供应商行为。',
  configLogLevelHelp:
    '',
  configDefaultProviderHelp:
    '',
  configAutoOptimizeHelp:
    '开启后，Ornn 会自动分析 trace 并触发技能优化建议或写回流程。',
  configUserConfirmHelp:
    '开启后，优化变更在写回前需要人工确认；关闭后按自动流程直接落盘。',
  configRuntimeSyncHelp:
    '开启后，会把最新技能内容同步回项目 skills，保证不同 runtime 使用同一份优化结果。',
  configProvidersHelp:
    '通过下拉和输入框配置 provider：选择 provider，选择或输入 model，直接粘贴 API Key，并保留或调整写入 .env.local 的环境变量名。',
  configProvidersExample:
    '',
  configCheckConnectivity: '检查连通性',
  configConnectivityChecking: '检查中...',
  configConnectivityTitle: 'Provider 连通性',

  // Stats
  statShadowSkills: 'Shadow 技能',
  statShadowSkillsSub: '维护中',
  statTraces: '追踪',
  statTracesSub: '已处理',
  statUptime: '运行时间',
  statUptimeSub: '运行状态',
  statQueue: '队列',
  statQueueSub: '等待优化',

  // Daemon Status
  daemonStatus: '守护进程状态',
  daemonState: '状态',
  daemonCurrentSkill: '当前技能',
  daemonRetryQueue: '重试队列',
  daemonLastCheckpoint: '上次检查点',
  daemonLastOptimization: '上次优化',
  daemonLastError: '上次错误',
  daemonRunning: '运行中',
  daemonStopped: '已停止',

  // States
  stateIdle: '空闲',
  stateAnalyzing: '分析中',
  stateOptimizing: '优化中',
  stateError: '错误',

  // Skills
  skillsTitle: 'Shadow 技能',
  skillsCount: '个技能',
  skillsEmpty: '暂无 Shadow 技能。启动守护进程开始优化。',
  skillView: '查看',
  skillHistory: '历史',
  skillTraces: '次追踪',
  skillConfidence: '置信度',

  // Trace Activity
  traceTitle: '追踪活动',
  traceTotal: '总计',
  traceRuntime: '运行时',
  traceStatus: '状态',
  traceTime: '时间',
  traceEvent: '事件',
  traceSession: '会话',
  activityLayerBusiness: 'Ornn 业务事件',
  activityLayerRaw: '原始 Trace',
  activityTagAll: '全部',
  activityTagSkillCalled: '技能调用',
  activityTagSkillAdded: '新增监控',
  activityTagSkillRemoved: '移除监控',
  activityTagSkillEdited: '技能编辑',
  activityTagSkillVersion: '版本迭代',
  activityTagDaemon: '守护进程',
  activityTagOptimization: '优化状态',

  // Log Panel
  logTitle: '日志',
  logFilterAll: '全部',

  // Modal
  modalClose: '关闭',
  modalLoading: '加载中...',
  modalNoContent: '（无内容）',
  modalVersionHistory: '版本历史',
  modalNoVersions: '暂无版本',
  modalCurrent: '当前',
  modalClickToLoad: '点击加载',

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
