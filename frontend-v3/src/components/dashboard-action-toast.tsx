import { useEffect, useState } from 'react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { translateDashboardActionMessage } from '@/lib/dashboard-action-message'
import { useI18n } from '@/lib/i18n'

export interface DashboardActionToastMessage {
  id: number
  message: string
}

interface DashboardActionToastProps {
  message: DashboardActionToastMessage | null
  onDismiss: () => void
}

export function DashboardActionToast({
  message,
  onDismiss,
}: DashboardActionToastProps) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(Boolean(message))
  }, [message])

  return (
    <ToastProvider duration={8000} swipeDirection="right">
      <Toast
        key={message?.id ?? 'empty'}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) onDismiss()
        }}
        open={open}
      >
        {message ? (
          <div className="flex items-start gap-3 pl-2">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]" />
            <div className="min-w-0 flex-1 space-y-1">
              <ToastTitle>{locale.startsWith('zh') ? '提示' : 'Notice'}</ToastTitle>
              <ToastDescription>
                {translateDashboardActionMessage(message.message, locale, t)}
              </ToastDescription>
            </div>
            <ToastClose asChild>
              <Button
                aria-label={locale.startsWith('zh') ? '关闭提示' : 'Dismiss notification'}
                className="-mt-1 -mr-1 shrink-0"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </ToastClose>
          </div>
        ) : null}
      </Toast>
      <ToastViewport />
    </ToastProvider>
  )
}
