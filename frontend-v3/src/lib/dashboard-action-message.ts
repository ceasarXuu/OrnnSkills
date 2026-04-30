import type { useI18n } from '@/lib/i18n'

export function translateDashboardActionMessage(
  message: string,
  locale: string,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (locale.startsWith('zh')) return message
  if (message === '保存中') return t('saving')
  if (message === '没有正文变更') return 'No content changes'
  if (message.startsWith('已保存 v')) return message.replace('已保存', 'Saved')
  if (message.startsWith('已停用 v')) return message.replace('已停用', 'Disabled')
  if (message.startsWith('已恢复 v')) return message.replace('已恢复', 'Restored')
  if (message === '未在市场找到该技能') return t('noMarketplaceFound')
  if (message === '本地内容与市场版本一致') return 'Local content matches marketplace'
  return message
}
