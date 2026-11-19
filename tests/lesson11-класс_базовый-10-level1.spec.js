import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/11-класс_базовый/10/level1.astro');
const TASK_URL = encodeURI('/tasks/11-класс_базовый/10/level1');
const LESSON_URL = encodeURI('/lesson/11-класс_базовый/10');

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(event.data);
      }
    });
  });
}

async function solvePhase1UI(page) {
  await expect(page.locator('#phase-1-container')).toBeVisible();
  const totalCards = await page.locator('#p1-cards-pool .phase1-card').count();
  expect(totalCards).toBe(6);

  for (let i = 0; i < totalCards; i++) {
    const card = page.locator('#p1-cards-pool .phase1-card').first();
    const expectedType = await card.getAttribute('data-expected-type');
    await card.click();
    await page.locator(`#bucket-${expectedType} .card-header`).click();
  }
  await expect(page.locator('#p1-verify-btn')).toBeEnabled();
  await page.locator('#p1-verify-btn').click();
}

async function solvePhase2UI(page) {
  await expect(page.locator('#phase-2-container')).toBeVisible();
  const labels = ['А', 'Б', 'В', 'Г'];
  const edges = await page.evaluate(() => {
    const coords = [
      { x: 95, y: 55 },
      { x: 305, y: 55 },
      { x: 305, y: 185 },
      { x: 95, y: 185 }
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
    const found = [];
    document.querySelectorAll('#p2-svg-edges path').forEach((p) => {
      const d = p.getAttribute('d') || '';
      const m = d.match(/M\s+([0-9.-]+)\s+([0-9.-]+).+?([0-9.-]+)\s+([0-9.-]+)$/);
      if (m) {
        found.push([nearest(Number(m[1]), Number(m[2])), nearest(Number(m[3]), Number(m[4]))]);
      }
    });
    return found;
  });

  expect(edges.length).toBeGreaterThanOrEqual(4);
  for (const [u, v] of edges) {
    const btn = page.locator(`#p2-matrix-body tr:nth-child(${u + 1}) button[data-row="${u}"][data-col="${v}"]`);
    const currentVal = (await btn.innerText()).trim();
    if (currentVal !== '1') {
      await btn.click();
    }
  }
  await page.locator('#p2-verify-btn').click();
}

async function solvePhase3UI(page) {
  await expect(page.locator('#phase-3-container')).toBeVisible();
  // Read target graph adjacency & matrix adjacency directly from visible DOM
  const assignments = await page.evaluate(() => {
    const coords = [];
    const labels = [];
    document.querySelectorAll('#p3-svg-nodes g').forEach((g) => {
      const c = g.querySelector('circle');
      const t = g.querySelector('text');
      coords.push({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) });
      labels.push(t.textContent.trim());
    });
    const nearest = (x, y) => {
      let best = 0;
      let bestD = Infinity;
      coords.forEach((c, idx) => {
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bestD) { bestD = d; best = idx; }
      });
      return best;
    };
    const n = coords.length;
    const gAdj = Array.from({ length: n }, () => Array(n).fill(0));
    document.querySelectorAll('#p3-svg-edges line').forEach((line) => {
      const u = nearest(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
      const v = nearest(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
      gAdj[u][v] = 1;
      gAdj[v][u] = 1;
    });

    const mAdj = Array.from({ length: n }, () => Array(n).fill(0));
    const rows = Array.from(document.querySelectorAll('#p3-matrix-body tr'));
    rows.forEach((tr, rIdx) => {
      Array.from(tr.querySelectorAll('td')).forEach((td, cIdx) => {
        if (td.textContent.trim() === '1') mAdj[rIdx][cIdx] = 1;
      });
    });

    // Backtracking isomorphism match from matrix rows P1..P6 -> graph vertices 0..5
    const perm = Array(n).fill(-1);
    const used = Array(n).fill(false);
    const gDeg = gAdj.map((row) => row.reduce((a, b) => a + b, 0));
    const mDeg = mAdj.map((row) => row.reduce((a, b) => a + b, 0));

    function backtrack(r) {
      if (r === n) return true;
      for (let v = 0; v < n; v++) {
        if (used[v] || gDeg[v] !== mDeg[r]) continue;
        let ok = true;
        for (let prev = 0; prev < r; prev++) {
          if (mAdj[r][prev] !== gAdj[v][perm[prev]]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        perm[r] = v;
        used[v] = true;
        if (backtrack(r + 1)) return true;
        used[v] = false;
        perm[r] = -1;
      }
      return false;
    }

    backtrack(0);
    const neededRows = Array.from(document.querySelectorAll('#p3-slots-container .p3-slot')).map((el) =>
      el.getAttribute('data-row-name')
    );
    const out = {};
    neededRows.forEach((rName) => {
      const rIdx = parseInt(rName.replace('П', ''), 10) - 1;
      out[rName] = labels[perm[rIdx]];
    });
    return out;
  });

  for (const [rName, letter] of Object.entries(assignments)) {
    await page.locator(`#p3-tokens-pool .p3-token[data-letter="${letter}"]`).click();
    await page.locator(`#p3-slots-container .p3-slot[data-row-name="${rName}"]`).click();
  }
  await expect(page.locator('#p3-verify-btn')).toBeEnabled();
  await page.locator('#p3-verify-btn').click();
}

test.describe('11th Grade Basic Lesson 10: Level 1 Suite', () => {
  test('Level 1 adheres to architectural contracts (Zero-Style, Zero Multiple Choice, TaskLayout 1, LMSTelemetry)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={1}');
    expect(code).toContain('id="phase-1-container"');
    expect(code).toContain('id="phase-2-container"');
    expect(code).toContain('id="phase-3-container"');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('Урок 10');

    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/<select\b/i);
    expect(code).not.toMatch(/type="radio"/i);
    expect(code).not.toMatch(/prince_complete/);
  });

  test('Wrong classification emits telemetry fail, regenerates Phase 1, and preserves Prince bonus gate', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Place card 0 in the wrong bucket, rest in right buckets
    const cards = page.locator('#p1-cards-pool .phase1-card');
    const firstExpected = await cards.first().getAttribute('data-expected-type');
    const wrongBucket = firstExpected === 'undirected' ? 'directed' : 'undirected';
    await cards.first().click();
    await page.locator(`#bucket-${wrongBucket} .card-header`).click();

    for (let i = 0; i < 5; i++) {
      const c = page.locator('#p1-cards-pool .phase1-card').first();
      const exp = await c.getAttribute('data-expected-type');
      await c.click();
      await page.locator(`#bucket-${exp} .card-header`).click();
    }

    await page.locator('#p1-verify-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();

    const failEvts = await page.evaluate(() =>
      window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset' || e.action_type === 'level_fail')
    );
    expect(failEvts.length).toBeGreaterThanOrEqual(1);
    expect(failEvts[0].stage).toBe(1);
    expect(failEvts[0].total_stages).toBe(3);
    expect(failEvts[0].success).toBe(false);

    // Regenerates after timeout
    await page.waitForTimeout(1400);
    await expect(page.locator('#feedback-box')).toBeHidden();
    expect(await page.locator('#p1-cards-pool .phase1-card').count()).toBe(6);

    // Verify lesson page keeps Prince bonus card hidden after reset event
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Графов');
      localStorage.setItem('student_class', '11-класс_базовый');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_11-класс_базовый_10', 'true');
    });
    page.on('dialog', (d) => d.accept());
    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 10 :: Графы. Решение алгоритмических задач, связанных с анализом графов (Уровень 1)',
        level: 1,
        stage: 1,
        total_stages: 3,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 3
      }, '*');
    });
    await expect(page.locator('#prince-bonus-card')).toBeHidden();
  });

  test('Full 3-phase walkthrough via real UI interactions emits complete telemetry contract', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await solvePhase1UI(page);
    await solvePhase2UI(page);
    await solvePhase3UI(page);

    await expect(page.locator('#final-screen')).toBeVisible();
    await expect(page.locator('#stat-attempts')).toHaveText('0');

    const telemetry = await page.evaluate(() => window.__sentTelemetry);
    const progressEvts = telemetry.filter((e) => e.action_type === 'in_progress');
    expect(progressEvts.length).toBeGreaterThanOrEqual(2);
    expect(progressEvts[0].start_time).toBeTruthy();

    const completeEvt = telemetry.find((e) => e.action_type === 'level_complete' && e.success === true);
    expect(completeEvt).toBeDefined();
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(completeEvt.mission_name).toContain('Урок 10');
  });
});
