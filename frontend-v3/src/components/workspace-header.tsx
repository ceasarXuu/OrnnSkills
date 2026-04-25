import { SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { DashboardView } from '@/types/dashboard'

interface WorkspaceHeaderProps {
  currentView: DashboardView
}

export function WorkspaceHeader({ currentView }: WorkspaceHeaderProps) {
  const { lang, setLanguage, t } = useI18n()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-4 xl:px-6">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-3" to="/skills">
            <Avatar size="lg">
              <AvatarFallback>
                <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />
              </AvatarFallback>
            </Avatar>
            <div className="font-medium tracking-tight">OrnnSkills</div>
          </Link>

          <nav aria-label={t('navLabel')}>
            <div className="inline-flex items-center gap-1 rounded-none bg-transparent p-[3px] text-muted-foreground">
              <HeaderNavLink currentView={currentView} label={t('skill')} to="/skills" value="skills" />
              <HeaderNavLink currentView={currentView} label={t('project')} to="/project" value="project" />
              <HeaderNavLink currentView={currentView} label={t('cost')} to="/cost" value="cost" />
              <HeaderNavLink currentView={currentView} label={t('config')} to="/config" value="config" />
            </div>
          </nav>
        </div>

        <Button
          aria-label={t('toggleLanguage')}
          onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}
          size="sm"
          type="button"
          variant="outline"
        >
          {lang === 'zh' ? 'EN' : '中文'}
        </Button>
      </div>
    </header>
  )
}

function HeaderNavLink({
  currentView,
  label,
  to,
  value,
}: {
  currentView: DashboardView
  label: string
  to: `/${DashboardView}`
  value: DashboardView
}) {
  const isActive = value === currentView

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative inline-flex h-8 items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring',
        isActive && 'text-foreground after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-foreground',
      )}
      to={to}
    >
      {label}
    </Link>
  )
}
