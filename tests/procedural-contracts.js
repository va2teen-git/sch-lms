/**
 * Universal Procedural & Interaction Integrity Contracts Library for School LMS
 * 
 * Provides 5 automated contract-driven test suites:
 * 1. Math Invariant & Generation Solver
 * 2. Input Robustness & Linguistic Tolerance Fuzzing
 * 3. Matrix / Graph Solvability & Trap-Free Engine (Cyber Matrix & Arcades)
 * 4. Ontological Domain Taxonomy Linter
 * 5. UI Hit-Testing & Click-Delegation Integrity
 */

import { expect } from '@playwright/test';

/**
 * 1. CONTRACT: Math Invariant & Generation Solver
 * Validates that procedurally generated tasks never produce rounding discrepancies,
 * non-integer percentages where integers are expected, or mismatches between what
 * is rendered in DOM and what the validation function expects.
 */
export function verifyMathInvariants({
  pairs,
  formula,
  isIntegerExpected = true,
  tolerance = 0.001
}) {
  const issues = [];

  for (const pair of pairs) {
    const { xTrue, pct } = pair;
    const delta = (xTrue * pct) / 100;

    // Check integer arithmetic if required
    if (isIntegerExpected && !Number.isInteger(delta)) {
      issues.push({
        pair,
        reason: `Absolute delta is not an integer: (${xTrue} * ${pct}) / 100 = ${delta}`
      });
      continue;
    }

    for (const sign of [1, -1]) {
      const xModel = xTrue + (sign * delta);
      const calculatedPct = formula(xTrue, xModel);

      if (Math.abs(calculatedPct - pct) > tolerance) {
        issues.push({
          pair,
          sign,
          xModel,
          calculatedPct,
          expectedPct: pct,
          discrepancy: Math.abs(calculatedPct - pct),
          reason: `Formula output (${calculatedPct}%) diverges from expected (${pct}%)`
        });
      }
    }
  }

  return issues;
}

/**
 * 2. CONTRACT: Input Robustness & Linguistic Tolerance Fuzzer
 * Generates mutations of answers (comma/dot, %, whitespace, case, gender, synonyms, ё/е)
 * and verifies that input elements tolerate standard student input habits.
 */
export function generateInputMutations(canonicalValue, type = 'text') {
  if (type === 'number') {
    const num = parseFloat(canonicalValue);
    return [
      num.toString(),
      num.toString().replace('.', ','),
      `  ${num}  `,
      `${num}%`,
      ` ${num} % `,
      `${num},0`,
      `${num}.0`
    ];
  }

  const str = (canonicalValue || '').trim();
  const mutations = new Set();
  
  // Base variations
  mutations.add(str.toUpperCase());
  mutations.add(str.toLowerCase());
  mutations.add(`  ${str}  `);
  mutations.add(str.replace(/ё/g, 'е').replace(/Ё/g, 'Е'));

  // Gender & Morphological inflections (Russian adjective / participle endings)
  const stems = [
    { stem: 'статич', forms: ['статическая', 'статический', 'статичное', 'статика'] },
    { stem: 'динамич', forms: ['динамическая', 'динамический', 'динамичное', 'динамика'] },
    { stem: 'детермин', forms: ['детерминированная', 'детерминированный', 'детерминированное', 'детерминизм'] },
    { stem: 'стохаст', forms: ['стохастическая', 'стохастический', 'стохастическое', 'стохастика', 'вероятностная', 'вероятностный', 'вероятностное'] },
    { stem: 'вероятност', forms: ['вероятностная', 'вероятностный', 'вероятностное', 'стохастическая', 'стохастический'] },
    { stem: 'образ', forms: ['образная', 'образный', 'образное', 'образ'] },
    { stem: 'знак', forms: ['знаковая', 'знаковый', 'знаковое', 'знак'] },
    { stem: 'смешан', forms: ['смешанная', 'смешанный', 'смешанное'] }
  ];

  const lower = str.toLowerCase();
  for (const item of stems) {
    if (lower.startsWith(item.stem)) {
      item.forms.forEach(f => mutations.add(f.toUpperCase()));
      item.forms.forEach(f => mutations.add(f.toLowerCase()));
      break;
    }
  }

  return Array.from(mutations);
}

/**
 * 3. CONTRACT: Matrix / Graph Solvability & Trap-Free Engine
 * Runs Monte-Carlo simulations of Cyber Matrix / grid puzzles and asserts:
 * 1) No trap duplicates of targetSeq[0] in initial row.
 * 2) All steps in guaranteed path visit distinct cells (no overwriting/re-entry).
 * 3) Path is 100% reachable and solvable within step & buffer limits.
 */
export function verifyMatrixProceduralSolvability({
  wavesCatalog,
  tokensPool,
  generateMatrixFn,
  simulationsPerWave = 100
}) {
  const issues = [];

  wavesCatalog.forEach((waveConfig, waveIndex) => {
    const waveNum = waveIndex + 1;
    const targetSeq = waveConfig.targetSequence;

    for (let sim = 0; sim < simulationsPerWave; sim++) {
      const matrix = generateMatrixFn(targetSeq, tokensPool);

      // Invariant 1: Row 0 has exactly ONE cell with targetSeq[0]
      const row0Matches = matrix[0].filter(c => c.token === targetSeq[0]);
      if (row0Matches.length !== 1) {
        issues.push({
          wave: waveNum,
          sim,
          reason: `Row 0 contains ${row0Matches.length} occurrences of starting token "${targetSeq[0]}", creating ambiguous dead-end traps`
        });
        continue;
      }

      // Invariant 2: Step-by-step traversal along active lines
      let curR = 0;
      let curC = matrix[0].findIndex(c => c.token === targetSeq[0]);
      let curMode = 'col';
      const visited = new Set([`0,${curC}`]);
      let solved = true;

      for (let step = 1; step < targetSeq.length; step++) {
        const expectedToken = targetSeq[step];

        if (curMode === 'col') {
          // Look in column curC for expectedToken
          let foundRow = -1;
          for (let r = 0; r < 4; r++) {
            if (r !== curR && matrix[r][curC].token === expectedToken && !visited.has(`${r},${curC}`)) {
              foundRow = r;
              break;
            }
          }

          if (foundRow === -1) {
            issues.push({
              wave: waveNum,
              sim,
              step,
              reason: `Unsolvable transition: Token "${expectedToken}" not found in column ${curC}`
            });
            solved = false;
            break;
          }

          visited.add(`${foundRow},${curC}`);
          curR = foundRow;
          curMode = 'row';
        } else {
          // Look in row curR for expectedToken
          let foundCol = -1;
          for (let c = 0; c < 4; c++) {
            if (c !== curC && matrix[curR][c].token === expectedToken && !visited.has(`${curR},${c}`)) {
              foundCol = c;
              break;
            }
          }

          if (foundCol === -1) {
            issues.push({
              wave: waveNum,
              sim,
              step,
              reason: `Unsolvable transition: Token "${expectedToken}" not found in row ${curR}`
            });
            solved = false;
            break;
          }

          visited.add(`${curR},${foundCol}`);
          curC = foundCol;
          curMode = 'col';
        }
      }

      // Invariant 3: Path uniqueness
      if (solved && visited.size !== targetSeq.length) {
        issues.push({
          wave: waveNum,
          sim,
          reason: `Path length mismatch: visited ${visited.size} cells, target length is ${targetSeq.length}`
        });
      }
    }
  });

  return issues;
}

/**
 * 4. CONTRACT: Ontological Domain Taxonomy Linter
 * Ensures pedagogical categorization does not contain contradictory or disjoint sets.
 */
export const INFORMATICS_ONTOLOGY_RULES = [
  // Disjoint: Material (Natural) vs Informational
  {
    name: "Material vs Informational Disjointness",
    forbidCoexistence: ["НАТУРНАЯ", "ИНФОРМАЦИОННАЯ"]
  },
  // Subtypes: "Образная", "Знаковая", "Смешанная" belong strictly to Informational models!
  {
    name: "Visual/Symbolic/Mixed implies Informational and forbids Material",
    requires: ["ОБРАЗНАЯ", "ЗНАКОВАЯ", "СМЕШАННАЯ"],
    forbiddenWith: "НАТУРНАЯ"
  },
  // Disjoint: Static vs Dynamic
  {
    name: "Static vs Dynamic Disjointness",
    forbidCoexistence: ["СТАТИЧЕСКАЯ", "ДИНАМИЧЕСКАЯ"]
  },
  // Disjoint: Deterministic vs Stochastic
  {
    name: "Deterministic vs Stochastic Disjointness",
    forbidCoexistence: ["ДЕТЕРМИНИРОВАННАЯ", "СТОХАСТИЧЕСКАЯ"]
  }
];

export function lintOntologySequence(tokens, rules = INFORMATICS_ONTOLOGY_RULES) {
  const violations = [];
  const tokenSet = new Set(tokens.map(t => (t || '').toUpperCase()));

  for (const rule of rules) {
    if (rule.forbidCoexistence) {
      const matches = rule.forbidCoexistence.filter(t => tokenSet.has(t));
      if (matches.length > 1) {
        violations.push({
          rule: rule.name,
          tokens,
          reason: `Contradictory tokens coexist: ${matches.join(' AND ')}`
        });
      }
    }

    if (rule.requires && rule.forbiddenWith) {
      const hasRequired = rule.requires.some(t => tokenSet.has(t));
      const hasForbidden = tokenSet.has(rule.forbiddenWith);
      if (hasRequired && hasForbidden) {
        violations.push({
          rule: rule.name,
          tokens,
          reason: `Forbidden token "${rule.forbiddenWith}" found alongside informational forms ${rule.requires.join('/')}`
        });
      }
    }
  }

  return violations;
}

/**
 * 6. CONTRACT: Surface–Foreground Contrast & Visibility Integrity (WCAG 2.1)
 * Evaluates computed background and foreground colors of target DOM elements
 * (walking up the ancestor tree to resolve effective opaque background)
 * and verifies that contrast ratio >= minContrastRatio (no white-on-white or dark-on-dark text).
 */
export async function verifySurfaceContrast(page, selector = '.bg-white, .bg-light, [style*="background"]', minContrastRatio = 4.5) {
  return await page.evaluate(({ sel, minRatio }) => {
    function parseRgba(str) {
      if (!str || str === 'transparent') return null;
      const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
      if (!m) return null;
      return {
        r: Number(m[1]),
        g: Number(m[2]),
        b: Number(m[3]),
        a: m[4] !== undefined ? Number(m[4]) : 1
      };
    }

    function srgbToLinear(c) {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    function getLuminance(rgb) {
      return (
        0.2126 * srgbToLinear(rgb.r) +
        0.7152 * srgbToLinear(rgb.g) +
        0.0722 * srgbToLinear(rgb.b)
      );
    }

    function getContrastRatio(l1, l2) {
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function resolveEffectiveBg(el) {
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const bg = parseRgba(window.getComputedStyle(cur).backgroundColor);
        if (bg && bg.a >= 0.8) return bg;
        cur = cur.parentElement;
      }
      return { r: 0, g: 0, b: 0, a: 1 };
    }

    const elements = Array.from(document.querySelectorAll(sel));
    const violations = [];
    const checked = [];

    for (const el of elements) {
      const text = (el.innerText || '').trim();
      if (!text) continue;

      const comp = window.getComputedStyle(el);
      if (comp.display === 'none' || comp.visibility === 'hidden' || Number(comp.opacity) === 0) continue;

      const fg = parseRgba(comp.color);
      const bg = resolveEffectiveBg(el);
      if (!fg || !bg) continue;

      const fgLum = getLuminance(fg);
      const bgLum = getLuminance(bg);
      const ratio = Number(getContrastRatio(fgLum, bgLum).toFixed(2));

      const record = {
        tag: el.tagName,
        className: el.className,
        textPreview: text.slice(0, 60),
        color: comp.color,
        backgroundColor: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
        contrastRatio: ratio
      };
      checked.push(record);

      if (ratio < minRatio) {
        violations.push({
          ...record,
          reason: `Contrast ratio ${ratio}:1 is below minimum ${minRatio}:1 (fg=${comp.color}, bg=rgb(${bg.r},${bg.g},${bg.b}))`
        });
      }
    }

    return { checkedCount: checked.length, checked, violations };
  }, { sel: selector, minRatio: minContrastRatio });
}

