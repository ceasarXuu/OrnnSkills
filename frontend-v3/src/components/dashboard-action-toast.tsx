import { useEffect, useState } from 'react'
import {
  Toast,
  ToastDescription,
  ToastProvider,
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
    <ToastProvider duration={2600} swipeDirection="right">
      <Toast
        key={message?.id ?? 'empty'}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) onDismiss()
        }}
        open={open}
      >
        {message ? (
          <ToastDescription>
            {translateDashboardActionMessage(message.message, locale, t)}
          </ToastDescription>
        ) : null}
      </Toast>
      <ToastViewport />
    </ToastProvider>
  )
}
