import { DashboardActionToast } from '@/components/dashboard-action-toast'
import { SkillFamilyDetail } from '@/components/skill-family-detail'
import { SkillFamilyList } from '@/components/skill-family-list'
import { useDashboardV3SkillLibrary } from '@/features/dashboard/use-dashboard-v3-skill-library'
import type { DashboardProject } from '@/types/dashboard'

interface SkillsWorkspaceProps {
  onSelectProject: (projectPath: string) => void
  projects: DashboardProject[]
  selectedProjectId: string
}

export function SkillsWorkspace({
  onSelectProject,
  projects,
  selectedProjectId,
}: SkillsWorkspaceProps) {
  const skillLibrary = useDashboardV3SkillLibrary(selectedProjectId)

  return (
    <div className="grid min-w-[1540px] grid-cols-[340px_minmax(0,1fr)] items-start gap-6">
      <aside className="sticky top-24 self-start">
        <SkillFamilyList
          families={skillLibrary.families}
          isLoading={skillLibrary.isLoadingFamilies}
          onQueryChange={skillLibrary.setQuery}
          onSelectFamily={skillLibrary.selectFamily}
          query={skillLibrary.query}
          selectedFamilyId={skillLibrary.selectedFamilyId}
        />
      </aside>

      <section className="min-w-0">
        <SkillFamilyDetail
          actionMessage={skillLibrary.actionMessage}
          detailError={skillLibrary.detailError}
          draftContent={skillLibrary.draftContent}
          family={skillLibrary.selectedFamily}
          isCheckingMarketplace={skillLibrary.isCheckingMarketplace}
          isLoading={skillLibrary.isLoadingFamilyDetail || skillLibrary.isLoadingSkillDetail}
          isSaving={skillLibrary.isSaving}
          marketplaceReview={skillLibrary.marketplaceReview}
          onApplyMarketplaceChanges={skillLibrary.applyMarketplaceChanges}
          onCheckMarketplace={skillLibrary.checkMarketplace}
          onCloseMarketplaceReview={skillLibrary.closeMarketplaceReview}
          onDraftChange={skillLibrary.setDraftContent}
          onPreferredProjectChange={onSelectProject}
          onSave={skillLibrary.save}
          preferredProjectPath={selectedProjectId}
          projects={projects}
          selectedInstance={skillLibrary.selectedInstance}
        />
      </section>

      <DashboardActionToast
        message={skillLibrary.toastMessage}
        onDismiss={skillLibrary.clearToastMessage}
      />
    </div>
  )
}
