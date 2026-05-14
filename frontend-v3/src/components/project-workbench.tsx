import { CostWorkspace } from '@/components/cost-workspace'
import { EvolutionWorkspace } from '@/components/evolution-workspace'
import { SkillsTable } from '@/components/skills-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/lib/i18n'
import type { DashboardAgentUsage, DashboardEvolutionLifecycle, DashboardSkill } from '@/types/dashboard'
import type { DashboardProviderCatalogEntry } from '@/types/config'

interface ProjectWorkbenchProps {
  agentUsage?: DashboardAgentUsage | null
  catalogError?: string | null
  defaultTab?: 'skills' | 'cost' | 'evolution'
  evolutionLifecycle?: DashboardEvolutionLifecycle | null
  isLoading: boolean
  isCatalogLoading: boolean
  isLoadingEvolution?: boolean
  onQueryChange: (value: string) => void
  onSelectSkill: (skill: DashboardSkill) => void
  projectName?: string
  projectPath?: string
  providerCatalog: DashboardProviderCatalogEntry[]
  query: string
  selectedSkillKey: string
  skills: DashboardSkill[]
}

export function ProjectWorkbench({
  agentUsage,
  catalogError,
  defaultTab = 'skills',
  evolutionLifecycle,
  isLoading,
  isCatalogLoading,
  isLoadingEvolution = false,
  onQueryChange,
  onSelectSkill,
  projectName,
  projectPath,
  providerCatalog,
  query,
  selectedSkillKey,
  skills,
}: ProjectWorkbenchProps) {
  const { t } = useI18n()

  return (
    <Tabs className="gap-6" defaultValue={defaultTab}>
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <TabsList variant="line">
          <TabsTrigger value="skills">{t('skills')}</TabsTrigger>
          <TabsTrigger value="cost">{t('cost')}</TabsTrigger>
          <TabsTrigger value="evolution">演化</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="mt-0" value="skills">
        <SkillsTable
          isLoading={isLoading}
          onQueryChange={onQueryChange}
          onSelectSkill={onSelectSkill}
          query={query}
          selectedSkillKey={selectedSkillKey}
          skills={skills}
        />
      </TabsContent>

      <TabsContent className="mt-0" value="cost">
        <CostWorkspace
          agentUsage={agentUsage}
          catalogError={catalogError}
          isCatalogLoading={isCatalogLoading}
          isSnapshotLoading={isLoading}
          projectName={projectName}
          projectPath={projectPath}
          providerCatalog={providerCatalog}
        />
      </TabsContent>

      <TabsContent className="mt-0" value="evolution">
        <EvolutionWorkspace
          isLoading={isLoadingEvolution || isLoading}
          lifecycle={evolutionLifecycle}
        />
      </TabsContent>
    </Tabs>
  )
}
