import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'frontend/src/App.tsx',
  'frontend/src/components/project-sidebar.tsx',
  'frontend/src/components/project-overview-hero.tsx',
  'frontend/src/components/activity-feed.tsx',
  'frontend/src/components/model-usage-panel.tsx',
  'frontend/src/styles/globals.css',
];

const forbiddenPatterns = [
  /text-white/,
  /border-white/,
  /bg-\[#/,
  /text-cyan|bg-cyan|border-cyan/,
  /text-slate|bg-slate|border-slate/,
  /bg-black\//,
  /radial-gradient/,
];

describe('dashboard v2 preset alignment', () => {
  it('keeps route-level styling on semantic preset tokens instead of a private palette', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} should not contain ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
