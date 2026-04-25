import { describe, expect, it } from 'vitest'
import {
  buildCostRows,
  buildModelDetailsIndex,
  formatUsd,
} from '../../frontend-v3/src/lib/dashboard-cost.ts'
import type { DashboardProviderCatalogEntry } from '../../frontend-v3/src/types/config.ts'

describe('dashboard v3 cost calculations', () => {
  it('matches LiteLLM model aliases and estimates spend from token buckets', () => {
    const catalog: DashboardProviderCatalogEntry[] = [
      {
        id: 'deepseek',
        modelDetails: [
          {
            id: 'deepseek/deepseek-chat',
            inputCostPerToken: 0.00000027,
            outputCostPerToken: 0.0000011,
          },
        ],
        models: ['deepseek-chat'],
        name: 'DeepSeek',
      },
    ]

    const rows = buildCostRows(
      {
        'deepseek/deepseek/deepseek-chat': {
          completionTokens: 500,
          promptTokens: 1000,
          totalTokens: 1500,
        },
      },
      buildModelDetailsIndex(catalog),
      { type: 'model' },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe('deepseek/deepseek-chat')
    expect(rows[0].detail?.id).toBe('deepseek/deepseek-chat')
    expect(rows[0].estimatedSpend).toBeCloseTo(0.00082, 6)
    expect(formatUsd(rows[0].estimatedSpend)).toBe('$0.0008')
  })
})

