import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = encodeURI('/tasks/11-класс_базовый/10/level2');

async function solvePhaseFromDOM(page, phaseNum) {
  if (phaseNum === 1) {
    const { sum, edges } = await page.evaluate(() => {
      const nums = Array.from(document.querySelectorAll('#p1-degrees-box .text-warning')).map((el) =>
        Number(el.textContent.trim())
      );
      const total = nums.reduce((a, b) => a + b, 0);
      return { sum: total, edges: total / 2 };
    });
    await page.locator('#p1-input-sum').fill(String(sum));
    await page.locator('#p1-input-edges').fill(String(edges));
    await page.locator('#p1-submit-btn').click();
    return;
  }
  if (phaseNum === 2) {
    const { dist, timeStr } = await page.evaluate(() => {
      const n = 5;
      const mat = Array.from({ length: n }, () => Array(n).fill(Infinity));
      Array.from(document.querySelectorAll('#p2-matrix-body tr')).forEach((tr, r) => {
        Array.from(tr.querySelectorAll('td')).forEach((td, c) => {
          const val = Number(td.textContent.trim());
          if (Number.isFinite(val) && val > 0) mat[r][c] = val;
        });
      });
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (mat[i][k] + mat[k][j] < mat[i][j]) mat[i][j] = mat[i][k] + mat[k][j];
          }
        }
      }
      const bestDist = mat[0][4];
      const speedMatch = document.getElementById('p2-speed-card').textContent.match(/(\d+(?:[.,]\d+)?)/);
      const speedKmh = Number(speedMatch[1].replace(',', '.'));
      const speedMMin = (speedKmh * 1000) / 60;
      const t = Math.round((bestDist / speedMMin) * 100) / 100;
      return { dist: bestDist, timeStr: String(t).replace('.', ',') };
    });
    await page.locator('#p2-input-dist').fill(String(dist));
    await page.locator('#p2-input-time').fill(timeStr);
    await page.locator('#p2-submit-btn').click();
    return;
  }
  if (phaseNum === 3) {
    const ansX = await page.evaluate(() => {
      const pct = Number(document.getElementById('p3-pct-text').textContent.replace('%', '').trim());
      const texts = Array.from(document.querySelectorAll('#p3-svg-edges text')).map((t) => t.textContent.trim());
      const nums = texts.filter((t) => t !== 'X').map(Number);
      return Math.round(((nums[2] + nums[3]) * pct) / 100 - (nums[0] + nums[1]));
    });
    await page.locator('#p3-input-x').fill(String(ansX));
    await page.locator('#p3-submit-btn').click();
    return;
  }
  if (phaseNum === 4) {
    const { oddCount, missingEdges } = await page.evaluate(() => {
      const n = Number(document.getElementById('p4-n-val').textContent.trim());
      const e = Number(document.getElementById('p4-e-val').textContent.trim());
      const circles = Array.from(document.querySelectorAll('#p4-svg-nodes circle')).map((c) => ({
        x: Number(c.getAttribute('cx')),
        y: Number(c.getAttribute('cy'))
      }));
      const nearest = (x, y) => {
        let best = 0;
        let bestD = Infinity;
        circles.forEach((c, idx) => {
          const d = Math.hypot(c.x - x, c.y - y);
          if (d < bestD) { bestD = d; best = idx; }
        });
        return best;
      };
      const deg = new Array(n).fill(0);
      document.querySelectorAll('#p4-svg-edges line').forEach((line) => {
        const u = nearest(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
        const v = nearest(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
        deg[u]++;
        deg[v]++;
      });
      return { oddCount: deg.filter((d) => d % 2 === 1).length, missingEdges: (n * (n - 1)) / 2 - e };
    });
    await page.locator('#p4-input-odd').fill(String(oddCount));
    await page.locator('#p4-input-missing').fill(String(missingEdges));
    await page.locator('#p4-submit-btn').click();
    return;
  }
  if (phaseNum === 5) {
    const paths = await page.evaluate(() => {
      const labels = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];
      const req = labels.indexOf(document.getElementById('p5-req-badge').textContent.trim());
      const forb = labels.indexOf(document.getElementById('p5-forb-badge').textContent.trim());
      const coords = [
        { x: 45, y: 130 }, { x: 150, y: 50 }, { x: 150, y: 130 }, { x: 150, y: 210 },
        { x: 280, y: 55 }, { x: 280, y: 130 }, { x: 280, y: 205 }, { x: 385, y: 130 }
      ];
      const nearest = (x, y) => {
        let best = 0;
        let bestD = Infinity;
        coords.forEach((c, idx) => {
          const d = Math.hypot(c.x - x, c.y - y);
          if (d < bestD) { bestD = d; best = idx; }
        });
        return best;
      };
      const edges = Array.from(document.querySelectorAll('#p5-svg-edges line')).map((line) => [
        nearest(Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))),
        nearest(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')))
      ]);
      const countPaths = (start, end) => {
        if (start === forb || end === forb) return 0;
        const dp = new Array(8).fill(0);
        dp[start] = 1;
        for (const u of [0, 1, 3, 2, 4, 6, 5, 7]) {
          if (u === forb) continue;
          for (const [a, b] of edges) {
            if (a === u && b !== forb) dp[b] += dp[a];
          }
        }
        return dp[end];
      };
      return countPaths(0, req) * countPaths(req, 7);
    });
    await page.locator('#p5-input-paths').fill(String(paths));
    await page.locator('#p5-submit-btn').click();
  }
}

test.describe('11th Grade Basic Lesson 10: Level 2 Student Personas & Sawtooth 2-1-2 Benchmark', () => {
  test('Persona: NOVICE — commits arithmetic error on Phase 1, waits for regeneration, recovers cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.readVisiblePrompt(page.locator('#phase1 .alert'));
    await sim.humanType(page.locator('#p1-input-sum'), '0');
    await sim.humanType(page.locator('#p1-input-edges'), '0');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#error-feedback')).toBeVisible();
    await page.waitForTimeout(1450);
    await expect(page.locator('#error-feedback')).toBeHidden();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    await solvePhaseFromDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — enters Russian comma, trailing spaces and % sign on Phase 2 and succeeds', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    await solvePhaseFromDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();

    const targets = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getTargets().p2Target);
    const rawTime = String(targets.timeMin);

    await sim.humanType(page.locator('#p2-input-dist'), ` ${targets.dist} `);
    await sim.humanType(page.locator('#p2-input-time'), rawTime, {
      fuzzRussianComma: true,
      trailingSpaces: true
    });
    await page.locator('#p2-submit-btn').click();

    await expect(page.locator('#phase3')).toBeVisible();

    // Also test '%' tolerance on Phase 3
    const xVal = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getTargets().p3TargetX);
    await sim.humanType(page.locator('#p3-input-x'), ` ${xVal}% `);
    await page.locator('#p3-submit-btn').click();
    await expect(page.locator('#phase4')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks with empty fields & prohibited paste test trigger zero exceptions', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.attemptProhibitedPaste(page.locator('#p1-input-sum'), '99999');
    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 5);
    await expect(page.locator('#phase1')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — validates Sawtooth 2-1-2, >=48px hitboxes & Grade 11 Basic corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '11-класс_базовый',
      lessonId: '10',
      levelNumber: 2
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    // Phase 1: CCS = 4 (Direct calculation)
    await bench.auditHitboxes([page.locator('#p1-input-sum'), page.locator('#p1-input-edges'), page.locator('#p1-submit-btn')], 48);
    bench.recordPhase(1, {
      title: 'Лемма о рукопожатиях',
      depth: 2, memory: 2, search: 0, inversion: 0, stress: 0, scaffolding: 0 // CCS = 4
    });
    await solvePhaseFromDOM(page, 1);

    // Phase 2: CCS = 5 (Shortest path + km/h -> m/min conversion)
    await expect(page.locator('#phase2')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p2-input-dist'), page.locator('#p2-input-time'), page.locator('#p2-submit-btn')], 48);
    bench.recordPhase(2, {
      title: 'Весовая матрица + конвертация м/мин',
      depth: 3, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 1 // CCS = 5
    });
    await solvePhaseFromDOM(page, 2);

    // Phase 3: CCS = 6 (Peak Inversion: restore X from %)
    await expect(page.locator('#phase3')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p3-input-x'), page.locator('#p3-submit-btn')], 48);
    bench.recordPhase(3, {
      title: 'Пик инверсии: восстановление веса ребра X',
      depth: 3, memory: 2, search: 0, inversion: 1, stress: 0, scaffolding: 0 // CCS = 6
    });
    await solvePhaseFromDOM(page, 3);

    // Phase 4: CCS = 5 (Consolidation Valley: odd degrees & complete graph)
    await expect(page.locator('#phase4')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p4-input-odd'), page.locator('#p4-input-missing'), page.locator('#p4-submit-btn')], 48);
    bench.recordPhase(4, {
      title: 'Долина консолидации: инварианты графа',
      depth: 2, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 0 // CCS = 5
    });
    await solvePhaseFromDOM(page, 4);

    // Phase 5: CCS = 7 (Culmination: constrained DAG DP)
    await expect(page.locator('#phase5')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p5-input-paths'), page.locator('#p5-submit-btn')], 48);
    bench.recordPhase(5, {
      title: 'Кульминация: DAG с обязательной и запрещённой вершиной',
      depth: 3, memory: 3, search: 0, inversion: 1, stress: 0, scaffolding: 0 // CCS = 7
    });
    await solvePhaseFromDOM(page, 5);

    await expect(page.locator('#final-screen')).toBeVisible();
    bench.assertSawtoothProfile();
    bench.assertGradeCorridor('11-класс_базовый');
    bench.assertNoFakeDifficulty();
    bench.renderReport('11-класс_базовый Lesson 10 (Level 2 Sawtooth 2-1-2)');
    sim.assertCleanSession();
  });
});
