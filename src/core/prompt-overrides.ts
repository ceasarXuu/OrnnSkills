import type { Language } from '../dashboard/i18n.js';

export function appendProjectPromptOverride(
  basePrompt: string,
  promptOverride: string,
  lang: Language
): string {
  const trimmedOverride = String(promptOverride || '').trim();
  if (!trimmedOverride) {
    return basePrompt;
  }

  return [
    basePrompt,
    '',
    lang === 'zh' ? '## 项目级提示词覆写' : '## Project Prompt Override',
    trimmedOverride,
  ].join('\n');
}
