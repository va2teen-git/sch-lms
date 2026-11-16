import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function walkFiles(dir, extFilter) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extFilter));
    } else if (!extFilter || entry.name.endsWith(extFilter)) {
      results.push(fullPath);
    }
  }
  return results;
}

const EXTERNAL_CDN_RE = /https?:\/\/(?:cdn\.|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|stackpath\.bootstrapcdn\.com|code\.jquery\.com)/i;

test.describe('Global Standards & Telemetry Audit (src/pages/tasks & public/tasks)', () => {
  const rootDir = process.cwd();
  const astroTasksDir = path.join(rootDir, 'src', 'pages', 'tasks');
  const legacyTasksDir = path.join(rootDir, 'public', 'tasks');
  const strictMode = process.env.STRICT_STANDARDS_AUDIT === '1';

  test('Audit src/pages/tasks/ for <style>, external CDNs, TaskLayout, start_time, stage/wave and AFK guard', async () => {
    const astroFiles = walkFiles(astroTasksDir, '.astro').sort();
    const legacyHtmlFiles = walkFiles(legacyTasksDir, '.html').sort();

    expect(astroFiles.length).toBeGreaterThan(0);

    const violations = {
      inlineStyle: [],
      externalCdn: [],
      missingTaskLayout: [],
      missingTelemetryEvent: [],
      missingStartTime: [],
      missingTimeSpent: [],
      missingStageOrWave: [],
      level3MissingIntro: [],
      level3MissingAfkGuard: []
    };

    for (const absPath of astroFiles) {
      const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');
      const code = fs.readFileSync(absPath, 'utf-8');
      const isLevel3 = relPath.endsWith('/level3.astro');
      const usesHelper = /LMSTelemetry|LmsTelemetry/.test(code);

      if (/<style[\s>]/i.test(code)) {
        violations.inlineStyle.push(relPath);
      }

      if (EXTERNAL_CDN_RE.test(code)) {
        violations.externalCdn.push(relPath);
      }

      if (!code.includes('import TaskLayout') || !code.includes('<TaskLayout')) {
        violations.missingTaskLayout.push(relPath);
      }

      if (!code.includes('TELEMETRY_EVENT') && !usesHelper) {
        violations.missingTelemetryEvent.push(relPath);
      }

      if (!code.includes('start_time') && !usesHelper) {
        violations.missingStartTime.push(relPath);
      }

      if (!code.includes('time_spent_sec') && !usesHelper) {
        violations.missingTimeSpent.push(relPath);
      }

      if (isLevel3) {
        if (!(/\bwave\b|total_waves|totalWaves/.test(code) || usesHelper)) {
          violations.missingStageOrWave.push(relPath);
        }
        if (!(/intro|showIntro|gameStarted|startGame|Начать/i.test(code))) {
          violations.level3MissingIntro.push(relPath);
        }
        if (!(usesHelper || /afk|lms-afk|AfkWave1|Повторить/i.test(code))) {
          violations.level3MissingAfkGuard.push(relPath);
        }
      } else {
        if (!(/\bstage\b|total_stages|totalStages/.test(code) || usesHelper)) {
          violations.missingStageOrWave.push(relPath);
        }
      }
    }

    const reportLines = [
      '',
      '=== STANDARDS AUDIT REPORT (Issue #566) ===',
      `Scanned .astro task files: ${astroFiles.length}`,
      `Remaining legacy .html files in public/tasks/: ${legacyHtmlFiles.length}`,
      `  - Forbidden <style> tags:        ${violations.inlineStyle.length}`,
      `  - External CDN references:       ${violations.externalCdn.length}`,
      `  - Missing TaskLayout:            ${violations.missingTaskLayout.length}`,
      `  - Missing TELEMETRY_EVENT:       ${violations.missingTelemetryEvent.length}`,
      `  - Missing start_time:            ${violations.missingStartTime.length}`,
      `  - Missing time_spent_sec:        ${violations.missingTimeSpent.length}`,
      `  - Missing stage/wave telemetry:  ${violations.missingStageOrWave.length}`,
      `  - Level 3 missing intro screen:  ${violations.level3MissingIntro.length}`,
      `  - Level 3 missing AFK guard:     ${violations.level3MissingAfkGuard.length}`,
      '-------------------------------------------'
    ];

    const addSection = (label, list) => {
      if (list.length > 0) {
        reportLines.push(`${label} (${list.length}):`);
        for (const item of list.slice(0, 15)) {
          reportLines.push(`  • ${item}`);
        }
        if (list.length > 15) {
          reportLines.push(`  ... and ${list.length - 15} more`);
        }
      }
    };

    addSection('Inline <style>', violations.inlineStyle);
    addSection('External CDN', violations.externalCdn);
    addSection('Missing TaskLayout', violations.missingTaskLayout);
    addSection('Missing TELEMETRY_EVENT', violations.missingTelemetryEvent);
    addSection('Missing start_time', violations.missingStartTime);
    addSection('Missing time_spent_sec', violations.missingTimeSpent);
    addSection('Missing stage/wave', violations.missingStageOrWave);
    addSection('Level 3 missing intro', violations.level3MissingIntro);
    addSection('Level 3 missing AFK guard', violations.level3MissingAfkGuard);
    addSection('Legacy HTML in public/tasks', legacyHtmlFiles.map(f => path.relative(rootDir, f).replace(/\\/g, '/')));

    console.log(reportLines.join('\n'));

    // Zero external CDNs must always hold across all .astro tasks
    expect(violations.externalCdn, 'External CDN links are strictly forbidden in src/pages/tasks/').toEqual([]);

    // In strict mode (Stage 11 final gate), zero violations and zero legacy HTML tasks are permitted
    if (strictMode) {
      expect(legacyHtmlFiles).toEqual([]);
      expect(violations.inlineStyle).toEqual([]);
      expect(violations.missingTaskLayout).toEqual([]);
      expect(violations.missingTelemetryEvent).toEqual([]);
      expect(violations.missingStartTime).toEqual([]);
      expect(violations.missingTimeSpent).toEqual([]);
      expect(violations.missingStageOrWave).toEqual([]);
      expect(violations.level3MissingIntro).toEqual([]);
      expect(violations.level3MissingAfkGuard).toEqual([]);
    }
  });

  test('Unified client helper public/static/lms-telemetry.js exists and is included in TaskLayout.astro', async () => {
    const helperPath = path.join(rootDir, 'public', 'static', 'lms-telemetry.js');
    const layoutPath = path.join(rootDir, 'src', 'layouts', 'TaskLayout.astro');

    expect(fs.existsSync(helperPath)).toBe(true);
    const helperCode = fs.readFileSync(helperPath, 'utf-8');
    expect(helperCode).toContain('LMSTelemetry');
    expect(helperCode).toContain('level_complete');
    expect(helperCode).toContain('lms-afk-retry-btn');

    const layoutCode = fs.readFileSync(layoutPath, 'utf-8');
    expect(layoutCode).toContain('/static/lms-telemetry.js');
  });
});
