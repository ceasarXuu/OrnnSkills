import { useCallback, useState } from 'react'
import { fetchMarketplaceSkill } from '@/lib/dashboard-api'
import type { DashboardSkillInstance } from '@/types/dashboard'

export interface SkillMarketplaceReviewState {
  source: { repo: string; skill: string; url: string }
  content: string
  localContent: string
}

interface UseDashboardV3SkillMarketplaceOptions {
  draftContent: string
  onActionMessage: (message: string | null) => void
  onDraftContent: (content: string) => void
  selectedInstance: DashboardSkillInstance | null
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

export function useDashboardV3SkillMarketplace({
  draftContent,
  onActionMessage,
  onDraftContent,
  selectedInstance,
}: UseDashboardV3SkillMarketplaceOptions) {
  const [isCheckingMarketplace, setIsCheckingMarketplace] = useState(false)
  const [marketplaceReview, setMarketplaceReview] =
    useState<SkillMarketplaceReviewState | null>(null)

  const checkMarketplace = useCallback(async () => {
    if (!selectedInstance) return
    setIsCheckingMarketplace(true)
    onActionMessage(null)
    try {
      const result = await fetchMarketplaceSkill(
        selectedInstance.projectPath,
        selectedInstance.skillId,
      )
      if (result.found && result.source && result.content) {
        if (result.content === draftContent) {
          onActionMessage('本地内容与市场版本一致')
        } else {
          setMarketplaceReview({
            source: result.source,
            content: result.content,
            localContent: draftContent,
          })
        }
      } else {
        onActionMessage('未在市场找到该技能')
      }
    } catch (error) {
      onActionMessage(getErrorMessage(error, '市场查询失败。'))
    } finally {
      setIsCheckingMarketplace(false)
    }
  }, [draftContent, onActionMessage, selectedInstance])

  const applyMarketplaceChanges = useCallback(
    (mergedContent: string) => {
      onDraftContent(mergedContent)
      setMarketplaceReview(null)
    },
    [onDraftContent],
  )

  const closeMarketplaceReview = useCallback(() => {
    setMarketplaceReview(null)
  }, [])

  return {
    applyMarketplaceChanges,
    checkMarketplace,
    closeMarketplaceReview,
    isCheckingMarketplace,
    marketplaceReview,
  }
}
