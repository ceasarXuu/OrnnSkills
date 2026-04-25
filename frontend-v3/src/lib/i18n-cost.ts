type DashboardLanguage = 'en' | 'zh'

export type CostTranslationKey =
  | 'cost'
  | 'costAvgLatency'
  | 'costAvgTokensPerCall'
  | 'costCalls'
  | 'costCapabilityFunctionCalling'
  | 'costCapabilityNone'
  | 'costCapabilityPromptCaching'
  | 'costCapabilityReasoning'
  | 'costCapabilityStructuredOutput'
  | 'costCatalogStatus'
  | 'costEmpty'
  | 'costEstimated'
  | 'costEstimatedSpend'
  | 'costEstimatedSub'
  | 'costInputTokens'
  | 'costLastCall'
  | 'costMatchedModels'
  | 'costModelCount'
  | 'costModelSpend'
  | 'costOutputTokens'
  | 'costPricingReasoningSurcharge'
  | 'costPricingSource'
  | 'costScopeBreakdown'
  | 'costSkillBreakdown'
  | 'costTableCallsSuffix'
  | 'costTableCapabilities'
  | 'costTableContextWindow'
  | 'costTableLastSeen'
  | 'costTableLatency'
  | 'costTableModel'
  | 'costTablePricing'
  | 'costTableTokensSuffix'
  | 'costTableUsage'
  | 'costTotalTokens'
  | 'costUnknownPricing'

export const COST_TRANSLATIONS: Record<DashboardLanguage, Record<CostTranslationKey, string>> = {
  zh: {
    cost: '成本',
    costAvgLatency: '平均时延',
    costAvgTokensPerCall: '单次平均 Token',
    costCalls: 'Agent 调用',
    costCapabilityFunctionCalling: '函数调用',
    costCapabilityNone: '暂无能力元数据',
    costCapabilityPromptCaching: 'Prompt 缓存',
    costCapabilityReasoning: '推理',
    costCapabilityStructuredOutput: '结构化输出',
    costCatalogStatus: '定价目录',
    costEmpty: '当前还没有记录到 agent 调用成本数据。',
    costEstimated: '估算成本',
    costEstimatedSpend: '估算成本',
    costEstimatedSub: '按 LiteLLM 模型定价估算',
    costInputTokens: '输入 Tokens',
    costLastCall: '最近调用',
    costMatchedModels: '个模型已匹配定价',
    costModelCount: '个模型',
    costModelSpend: '模型成本拆分',
    costOutputTokens: '输出 Tokens',
    costPricingReasoningSurcharge: '含 reasoning 附加计费',
    costPricingSource: 'LiteLLM 模型注册表',
    costScopeBreakdown: '按范围拆分',
    costSkillBreakdown: '技能 Token 消耗 Top 5',
    costTableCallsSuffix: '次调用',
    costTableCapabilities: '能力标签',
    costTableContextWindow: '上下文窗口',
    costTableLastSeen: '最近',
    costTableLatency: '时延',
    costTableModel: '模型',
    costTablePricing: 'LiteLLM 定价',
    costTableTokensSuffix: 'Token',
    costTableUsage: '用量',
    costTotalTokens: '总 Tokens',
    costUnknownPricing: '暂无定价',
  },
  en: {
    cost: 'Cost',
    costAvgLatency: 'Average latency',
    costAvgTokensPerCall: 'Average tokens / call',
    costCalls: 'Agent calls',
    costCapabilityFunctionCalling: 'Function calling',
    costCapabilityNone: 'No capability metadata',
    costCapabilityPromptCaching: 'Prompt caching',
    costCapabilityReasoning: 'Reasoning',
    costCapabilityStructuredOutput: 'Structured output',
    costCatalogStatus: 'Pricing catalog',
    costEmpty: 'No agent usage cost data has been recorded yet.',
    costEstimated: 'Estimated cost',
    costEstimatedSpend: 'Estimated cost',
    costEstimatedSub: 'Estimated from LiteLLM model pricing',
    costInputTokens: 'Input tokens',
    costLastCall: 'Latest call',
    costMatchedModels: 'models matched pricing',
    costModelCount: 'models',
    costModelSpend: 'Model cost breakdown',
    costOutputTokens: 'Output tokens',
    costPricingReasoningSurcharge: 'Reasoning surcharge included',
    costPricingSource: 'LiteLLM model registry',
    costScopeBreakdown: 'Scope breakdown',
    costSkillBreakdown: 'Top skills by token spend',
    costTableCallsSuffix: 'calls',
    costTableCapabilities: 'Capabilities',
    costTableContextWindow: 'Context window',
    costTableLastSeen: 'Last seen',
    costTableLatency: 'Latency',
    costTableModel: 'Model',
    costTablePricing: 'LiteLLM pricing',
    costTableTokensSuffix: 'tokens',
    costTableUsage: 'Usage',
    costTotalTokens: 'Total tokens',
    costUnknownPricing: 'Pricing unavailable',
  },
}
