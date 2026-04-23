import type { ReactNode } from 'react'

interface DashboardStoryFrameProps {
  children: ReactNode
  width?: string
}

export function DashboardStoryFrame({
  children,
  width = '1120px',
}: DashboardStoryFrameProps) {
  return (
    <div
      className="dark min-h-screen bg-background p-4 text-foreground"
      style={{ width }}
    >
      {children}
    </div>
  )
}
