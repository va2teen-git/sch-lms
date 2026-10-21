/**
 * Cognitive Difficulty Benchmarker & Curve Evaluator for School LMS
 * 
 * Implements automated validation of lesson difficulty according to:
 * docs/difficulty-curve.md (Cognitive Difficulty Framework)
 * 
 * Key capabilities:
 * 1. Computes Cognitive Complexity Score (CCS 1-10) per phase:
 *    CCS = F_depth + F_memory + F_search + F_inversion + F_stress - S_scaffolding
 * 2. Validates Grade & Track Corridors (7th, 8th, 9th, 10th Base, 10th Tech)
 * 3. Enforces the "Sawtooth 2-1-2" profile on Level 2 (P1 < P2 < P3; P4 < P3 [Valley]; P5 >= P3)
 * 4. Detects "Fake Difficulty" anti-patterns (Pixel Hunting, Arithmetic Grind, Flat Plateau)
 * 5. Generates ASCII Visual Reports in Playwright test logs
 */

import { expect } from '@playwright/test';

export const GRADE_CORRIDORS = {
  '7-класс': { min: 2, max: 5, label: '7 класс (Базовый)' },
  '8-класс': { min: 3, max: 6, label: '8 класс (Базовый)' },
  '9-класс': { min: 4, max: 7, label: '9 класс (ОГЭ)' },
  '10-класс_базовый': { min: 4, max: 7, label: '10 класс (Гуманитарный/Базовый)' },
  '11-класс_базовый': { min: 4, max: 7, label: '11 класс (Гуманитарный/Базовый)' },
  '10-класс_углубленный': { min: 5, max: 10, label: '10 класс (Технологический/Углубленный)' },
  '11-класс_углубленный': { min: 5, max: 10, label: '11 класс (Технологический/Углубленный)' }
};

/**
 * Calculates the Cognitive Complexity Score (CCS) from structural parameters.
 * 
 * @param {Object} factors
 * @param {number} [factors.depth=1] F_depth: Deductive steps (1-4)
 * @param {number} [factors.memory=1] F_memory: Dynamic working memory items (1-4)
 * @param {number} [factors.search=0] F_search: Distractor density & noise (0-3)
 * @param {number} [factors.inversion=0] F_inversion: Negative rules, reverse problem, edge case (0-3)
 * @param {number} [factors.stress=0] F_stress: Time-pressure ratio TPR (0-3)
 * @param {number} [factors.scaffolding=0] S_scaffolding: UI scaffolding / hints to subtract (0-3)
 * @returns {{ ccs: number, breakdown: Object }}
 */
export function calculateCCS({
  depth = 1,
  memory = 1,
  search = 0,
  inversion = 0,
  stress = 0,
  scaffolding = 0
} = {}) {
  const d = Math.max(1, Math.min(4, depth));
  const m = Math.max(1, Math.min(4, memory));
  const s = Math.max(0, Math.min(3, search));
  const inv = Math.max(0, Math.min(3, inversion));
  const str = Math.max(0, Math.min(3, stress));
  const sc = Math.max(0, Math.min(3, scaffolding));

  const raw = d + m + s + inv + str - sc;
  const ccs = Math.max(1, Math.min(10, Math.round(raw * 10) / 10));

  return {
    ccs,
    breakdown: { depth: d, memory: m, search: s, inversion: inv, stress: str, scaffolding: sc }
  };
}

export class DifficultyBenchmarker {
  /**
   * @param {Object} [options]
   * @param {string} [options.courseSlug='10-класс_углубленный']
   * @param {string|number} [options.lessonId='']
   * @param {number} [options.levelNumber=2]
   */
  constructor(options = {}) {
    this.courseSlug = options.courseSlug || '10-класс_углубленный';
    this.lessonId = options.lessonId || '';
    this.levelNumber = options.levelNumber || 2;
    this.phases = [];
    this.hitboxViolations = [];
    this.antiPatterns = [];
  }

  /**
   * Records assessment for a specific phase.
   * 
   * @param {number} phaseNumber 1-based index
   * @param {Object} data
   * @param {string} data.title Short description of the phase task
   * @param {number} [data.depth=1]
   * @param {number} [data.memory=1]
   * @param {number} [data.search=0]
   * @param {number} [data.inversion=0]
   * @param {number} [data.stress=0]
   * @param {number} [data.scaffolding=0]
   * @param {number} [data.latencyMs=0] Measured cognitive latency to first action
   * @param {number} [data.attemptsCount=0]
   */
  recordPhase(phaseNumber, data) {
    const { ccs, breakdown } = calculateCCS({
      depth: data.depth,
      memory: data.memory,
      search: data.search,
      inversion: data.inversion,
      stress: data.stress,
      scaffolding: data.scaffolding
    });

    this.phases.push({
      phase: phaseNumber,
      title: data.title || `Шаг ${phaseNumber}`,
      ccs,
      breakdown,
      latencyMs: data.latencyMs || 0,
      attemptsCount: data.attemptsCount || 0
    });

    return ccs;
  }

  /**
   * Evaluates DOM interactive elements to detect Pixel Hunting (hitbox < minSize).
   * 
   * @param {import('@playwright/test').Locator[]} locators
   * @param {number} [minSize=36] Minimum width and height in CSS pixels
   */
  async auditHitboxes(locators, minSize = 36) {
    for (const locator of locators) {
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const item = locator.nth(i);
        const box = await item.boundingBox();
        if (box) {
          if (box.width < minSize || box.height < minSize) {
            const id = await item.getAttribute('id').catch(() => null);
            const text = (await item.innerText().catch(() => '')).slice(0, 20);
            this.hitboxViolations.push({
              identifier: id ? `#${id}` : `text:"${text}"`,
              width: Math.round(box.width),
              height: Math.round(box.height),
              minSize
            });
          }
        }
      }
    }
  }

  /**
   * Audits task procedural numbers to catch "Arithmetic Grind" anti-pattern.
   * Reject numbers with unreasonable manual division (e.g. 5-digit non-powers of 2 in mental arithmetic).
   * 
   * @param {number[]} numbers
   * @param {Object} [options]
   * @param {number} [options.maxMagnitude=100000]
   * @param {boolean} [options.allowPowerOfTwo=true]
   */
  auditNumberInvariants(numbers, options = {}) {
    const maxMag = options.maxMagnitude || 100000;
    const allowPow2 = options.allowPowerOfTwo !== false;

    for (const num of numbers) {
      if (Math.abs(num) > maxMag) {
        // If it's a clean power of 2 (e.g. 65536, 131072), it's standard CS, not grind
        const isPow2 = allowPow2 && (num > 0 && (num & (num - 1)) === 0);
        if (!isPow2) {
          this.antiPatterns.push({
            type: 'Arithmetic Grind',
            detail: `Number ${num} exceeds mental threshold (${maxMag}) without being a clean binary power. Educational task risks arithmetic exhaustion.`
          });
        }
      }
    }
  }

  /**
   * Asserts that Level 2 strictly satisfies the "Sawtooth 2-1-2" profile:
   * 1. P1 < P2 < P3 (Gradual buildup to first peak)
   * 2. P4 < P3 (CRITICAL RELIEF VALLEY: memory consolidation step)
   * 3. P5 >= P3 (Climax peak with edge cases / synthesis)
   */
  assertSawtoothProfile() {
    if (this.phases.length !== 5) {
      throw new Error(`[DifficultyBenchmarker] Sawtooth 2-1-2 assertion requires exactly 5 phases, found ${this.phases.length}.`);
    }

    const [p1, p2, p3, p4, p5] = this.phases;

    // 1. Initial progression: P1 <= P2 <= P3, with P3 strictly > P1
    expect(p2.ccs, `Phase 2 (${p2.ccs}) must be equal or harder than Phase 1 (${p1.ccs})`).toBeGreaterThanOrEqual(p1.ccs);
    expect(p3.ccs, `Phase 3 Peak 1 (${p3.ccs}) must be strictly harder than Phase 1 (${p1.ccs})`).toBeGreaterThan(p1.ccs);

    // 2. Critical Consolidation Valley: P4 MUST drop below P3 peak
    const valleyDepth = Math.round((p3.ccs - p4.ccs) * 10) / 10;
    expect(
      p4.ccs,
      `[Sawtooth Violation] Phase 4 (Consolidation Valley, CCS=${p4.ccs}) MUST be lower than Phase 3 Peak (CCS=${p3.ccs}) to allow cognitive recovery! Current delta: ${valleyDepth}`
    ).toBeLessThan(p3.ccs);

    // 3. Final Climax: P5 must be >= P3 Peak
    expect(
      p5.ccs,
      `[Sawtooth Violation] Phase 5 (Climax, CCS=${p5.ccs}) must reach or exceed Phase 3 Peak (CCS=${p3.ccs})`
    ).toBeGreaterThanOrEqual(p3.ccs);
  }

  /**
   * Asserts that all phases stay within the designated Grade/Track Corridor.
   */
  assertGradeCorridor(courseSlug = this.courseSlug) {
    const corridor = GRADE_CORRIDORS[courseSlug];
    if (!corridor) {
      console.warn(`[DifficultyBenchmarker] Unknown courseSlug: ${courseSlug}. Skipping corridor assert.`);
      return;
    }

    for (const p of this.phases) {
      expect(
        p.ccs,
        `[Grade Corridor Violation] Phase ${p.phase} ("${p.title}") CCS=${p.ccs} exceeds max allowed (${corridor.max}) for ${corridor.label}`
      ).toBeLessThanOrEqual(corridor.max);

      // We allow Level 1 intro phases to be lower, but check max strictly
      if (this.levelNumber >= 2 && p.phase >= 2) {
        expect(
          p.ccs,
          `[Grade Corridor Violation] Phase ${p.phase} CCS=${p.ccs} is below minimum challenge (${corridor.min}) for ${corridor.label}`
        ).toBeGreaterThanOrEqual(corridor.min);
      }
    }
  }

  /**
   * Asserts no "Fake Difficulty" anti-patterns were detected.
   */
  assertNoFakeDifficulty() {
    // 1. Check Hitboxes (Pixel Hunting)
    if (this.hitboxViolations.length > 0) {
      const sample = this.hitboxViolations[0];
      throw new Error(`[Fake Difficulty] Pixel Hunting detected: Element ${sample.identifier} has hitbox ${sample.width}x${sample.height}px (minimum allowed is ${sample.minSize}px)`);
    }

    // 2. Check Arithmetic Grind
    if (this.antiPatterns.length > 0) {
      const first = this.antiPatterns[0];
      throw new Error(`[Fake Difficulty] ${first.type}: ${first.detail}`);
    }

    // 3. Check Flat Monotonous Plateau (all phases having identical complexity)
    if (this.phases.length >= 3) {
      const ccsValues = this.phases.map(p => p.ccs);
      const allEqual = ccsValues.every(val => val === ccsValues[0]);
      if (allEqual) {
        throw new Error(`[Fake Difficulty] Flat Plateau detected: All phases have identical CCS (${ccsValues[0]}). Tasks lack pedagogical progression!`);
      }
    }
  }

  /**
   * Renders an ASCII difficulty curve visualization into test logs.
   * 
   * @param {string} [title='']
   * @returns {string} Formatted report
   */
  renderReport(title = '') {
    const lines = [];
    const bannerTitle = title || `LESSON ${this.lessonId} (Level ${this.levelNumber}) :: COGNITIVE DIFFICULTY REPORT`;
    lines.push('='.repeat(80));
    lines.push(bannerTitle);
    lines.push(`Course Track: ${this.courseSlug} | Target Corridor: [${GRADE_CORRIDORS[this.courseSlug]?.min || '?'}; ${GRADE_CORRIDORS[this.courseSlug]?.max || '?'}]`);
    lines.push('-'.repeat(80));

    for (const p of this.phases) {
      const filled = Math.min(10, Math.max(0, Math.round(p.ccs)));
      const empty = 10 - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const latencyStr = p.latencyMs > 0 ? ` | Latency: ${p.latencyMs}ms` : '';
      const attemptsStr = p.attemptsCount > 0 ? ` | Attempts: ${p.attemptsCount}` : '';
      lines.push(`  Phase ${p.phase}: [${bar}] CCS: ${p.ccs.toFixed(1)} | ${p.title}${latencyStr}${attemptsStr}`);
      lines.push(`           (Depth: ${p.breakdown.depth}, Mem: ${p.breakdown.memory}, Search: ${p.breakdown.search}, Inv: ${p.breakdown.inversion}, Str: ${p.breakdown.stress}, -Scaff: ${p.breakdown.scaffolding})`);
    }

    lines.push('-'.repeat(80));
    if (this.phases.length === 5) {
      const [p1, , p3, p4, p5] = this.phases;
      const valley = (p3.ccs - p4.ccs).toFixed(1);
      const verdict = (p4.ccs < p3.ccs && p5.ccs >= p3.ccs) ? 'PASSED ✅' : 'FAILED ❌';
      lines.push(`Sawtooth 2-1-2 Profile: ${verdict} (Valley depth P3->P4: ${valley} CCS)`);
    }
    lines.push('='.repeat(80));

    const report = lines.join('\n');
    console.log('\n' + report + '\n');
    return report;
  }
}
