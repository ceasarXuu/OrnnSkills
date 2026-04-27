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
          applyPreview={skillLibrary.applyPreview}
          detail={skillLibrary.detail}
          detailError={skillLibrary.detailError}
          diffContent={skillLibrary.diffContent}
          diffVersion={skillLibrary.diffVersion}
          draftContent={skillLibrary.draftContent}
          family={skillLibrary.selectedFamily}
          isApplying={skillLibrary.isApplying}
          isLoading={skillLibrary.isLoadingFamilyDetail || skillLibrary.isLoadingSkillDetail}
          isSaving={skillLibrary.isSaving}
          onApplyToFamily={skillLibrary.applyToFamily}
          onDraftChange={skillLibrary.setDraftContent}
          onLoadApplyPreview={skillLibrary.loadApplyPreview}
          onPreferredProjectChange={onSelectProject}
          onSelectDiffVersion={skillLibrary.loadDiffVersion}
          onSelectVersion={skillLibrary.loadVersion}
          onSave={skillLibrary.save}
          onSwitchRuntime={skillLibrary.switchRuntime}
          onToggleVersionDisabled={skillLibrary.toggleVersionDisabled}
          preferredProjectPath={selectedProjectId}
          preferredRuntime={skillLibrary.preferredRuntime}
          projects={projects}
          selectedInstance={skillLibrary.selectedInstance}
          selectedVersion={skillLibrary.selectedVersion}
          versionMetadataByNumber={skillLibrary.versionMetadataByNumber}
        />
      </section>
    </div>
  )
}
