import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1';

async function solvePhase1UI(page) {
  await expect(page.locator('#phase-1-workspace')).toBeVisible();
  const matrixWeights = await page.evaluate(() => {
    const svg = document.getElementById('p1-graph-svg');
    const nodes = Array.from(svg.querySelectorAll(':scope > circle')).map((c) => ({
      label: c.nextElementSibling ? c.nextElementSibling.textContent.trim() : '',
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy'))
    }));
    const nearestNode = (x, y) => {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) { bestD = d; best = n.label; }
      }
      return best;
    };
    const weights = {};
    for (const p of Array.from(svg.querySelectorAll(':scope > path'))) {
      const m = (p.getAttribute('d') || '').match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
      if (!m) continue;
      const u = nearestNode(Number(m[1]), Number(m[2]));
      const v = nearestNode(Number(m[3]), Number(m[4]));
      const rectEl = p.nextElementSibling;
      const textEl = rectEl ? rectEl.nextElementSibling : null;
      if (u && v && textEl) weights[u + '-' + v] = Number(textEl.textContent.trim());
    }
    return weights;
  });

  const slotButtons = page.locator('#p1-matrix-tbody button[data-slot-key]');
  const slotCount = await slotButtons.count();
  const slotKeys = [];
  for (let i = 0; i < slotCount; i++) slotKeys.push(await slotButtons.nth(i).getAttribute('data-slot-key'));

  for (const key of slotKeys) {
    const val = matrixWeights[key];
    await page.locator(`#p1-palette button[data-token-val="${val}"]`).first().click();
    await page.locator(`#p1-matrix-tbody button[data-slot-key="${key}"]`).click();
  }
  await page.locator('#verify-btn').click();
}

async function solvePhase2UI(page) {
  await expect(page.locator('#phase-2-workspace')).toBeVisible();
  const { bestPath, bestDist } = await page.evaluate(() => {
    const svg = document.getElementById('p2-graph-svg');
    const nodes = Array.from(svg.querySelectorAll(':scope > g[data-node]')).map((g) => {
      const c = g.querySelector('circle');
      return { label: g.getAttribute('data-node'), x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) };
    });
    const nearestNode = (x, y) => {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) { bestD = d; best = n.label; }
      }
      return best;
    };
    const adj = {};
    nodes.forEach((n) => { adj[n.label] = {}; });
    for (const line of Array.from(svg.querySelectorAll(':scope > line'))) {
      const u = nearestNode(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
      const v = nearestNode(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
      const w = Number(line.nextElementSibling.nextElementSibling.textContent.trim());
      adj[u][v] = w;
      adj[v][u] = w;
    }
    let bestCost = Infinity;
    let bestRoute = null;
    const visited = new Set(['A']);
    function dfs(curr, path, dist) {
      if (dist >= bestCost) return;
      if (curr === 'E') { bestCost = dist; bestRoute = path.slice(); return; }
      for (const [nxt, w] of Object.entries(adj[curr] || {})) {
        if (visited.has(nxt)) continue;
        visited.add(nxt); path.push(nxt); dfs(nxt, path, dist + w); path.pop(); visited.delete(nxt);
      }
    }
    dfs('A', ['A'], 0);
    return { bestPath: bestRoute, bestDist: bestCost };
  });

  for (let i = 1; i < bestPath.length; i++) {
    await page.locator(`#p2-graph-svg g[data-node="${bestPath[i]}"]`).click();
  }
  await page.locator('#p2-length-slider').evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, bestDist);
  await page.locator('#verify-btn').click();
}

async function solvePhase3UI(page) {
  await expect(page.locator('#phase-3-workspace')).toBeVisible();
  const counts = await page.evaluate(() => {
    const banMatch = (document.getElementById('p3-rule-badge').textContent || '').match(/Запрещ[её]н(?:ный пункт|а вершина):\s*([А-ЯЁ])/i);
    const bannedNode = banMatch ? banMatch[1] : null;
    const svg = document.getElementById('p3-dag-svg');
    const nodes = Array.from(svg.querySelectorAll(':scope > circle')).map((c) => ({
      label: c.nextElementSibling ? c.nextElementSibling.textContent.trim() : '',
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy'))
    }));
    const nearestNode = (x, y) => {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) { bestD = d; best = n.label; }
      }
      return best;
    };
    const adj = {};
    nodes.forEach((n) => { adj[n.label] = []; });
    for (const line of Array.from(svg.querySelectorAll(':scope > line'))) {
      adj[nearestNode(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')))].push(
        nearestNode(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')))
      );
    }
    for (const p of Array.from(svg.querySelectorAll(':scope > path'))) {
      const m = (p.getAttribute('d') || '').match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
      if (m) adj[nearestNode(Number(m[1]), Number(m[2]))].push(nearestNode(Number(m[3]), Number(m[4])));
    }
    const order = ['А', 'Б', 'Г', 'В', 'Д', 'Е'];
    const dp = { А: 1, Б: 0, В: 0, Г: 0, Д: 0, Е: 0 };
    if (bannedNode) dp[bannedNode] = 0;
    for (const u of order) {
      if (u === bannedNode) continue;
      for (const v of adj[u] || []) {
        if (v !== bannedNode) dp[v] += dp[u];
      }
    }
    return dp;
  });

  const slotButtons = page.locator('#p3-slots-grid button[data-dag-slot]');
  const slotCount = await slotButtons.count();
  const slotNodes = [];
  for (let i = 0; i < slotCount; i++) slotNodes.push(await slotButtons.nth(i).getAttribute('data-dag-slot'));
  for (const node of slotNodes) {
    await page.locator(`#p3-palette button[data-token-val="${counts[node]}"]`).first().click();
    await page.locator(`#p3-slots-grid button[data-dag-slot="${node}"]`).click();
  }
  await page.locator('#verify-btn').click();
}

test.describe('9th Grade Lesson 10: Level 1 Student Personas & Ergonomics', () => {
  test('Persona: NOVICE — places distractor/wrong tokens on Phase 1, sees error feedback, recovers to victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#verify-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#status-alert')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
        await expect(page.locator('#status-alert')).toBeHidden();
      },
      solveCorrectlyFn: async () => {
        await solvePhase1UI(page);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase-2-workspace')).toBeVisible();
      }
    });

    await solvePhase2UI(page);
    await expect(page.locator('#phase-3-workspace')).toBeVisible();
    await solvePhase3UI(page);
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — resets Phase 1 matrix slots, resets Phase 2 SVG path, resets Phase 3 DAG slots, then completes cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    await page.locator('#p1-palette button[data-token-id]').first().click();
    await page.locator('#p1-matrix-tbody button[data-slot-key]').first().click();
    await page.locator('#p1-reset-btn').click();
    await solvePhase1UI(page);

    await expect(page.locator('#phase-2-workspace')).toBeVisible();
    await page.locator('#p2-graph-svg g[data-node="B"]').click();
    await page.locator('#p2-reset-btn').click();
    await expect(page.locator('#p2-path-display')).toHaveText('A');
    await solvePhase2UI(page);

    await expect(page.locator('#phase-3-workspace')).toBeVisible();
    await page.locator('#p3-palette button[data-token-id]').first().click();
    await page.locator('#p3-slots-grid button[data-dag-slot]').first().click();
    await page.locator('#p3-reset-btn').click();
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks across pools, slots, SVG nodes, and reset buttons cause zero runtime exceptions', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 5);
    await sim.simulateSpamClick(page.locator('#p1-palette button[data-token-id]').first(), 5);
    await sim.simulateSpamClick(page.locator('#p1-matrix-tbody button[data-slot-key]').first(), 5);
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 4);

    await expect(page.locator('#phase-1-workspace')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitboxes & Grade 9 OGE corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '9-класс',
      lessonId: '10',
      levelNumber: 1
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    await bench.auditHitboxes([
      page.locator('#p1-palette button[data-token-id]'),
      page.locator('#p1-matrix-tbody button[data-slot-key]'),
      page.locator('#p1-reset-btn'),
      page.locator('#verify-btn')
    ], 48);

    bench.recordPhase(1, {
      title: 'Весовая матрица орграфа 4x4 (Slot & Snap)',
      depth: 1,
      memory: 2,
      search: 1,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase1UI(page);

    await expect(page.locator('#phase-2-workspace')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p2-graph-svg g[data-node]'),
      page.locator('#p2-minus-btn'),
      page.locator('#p2-plus-btn'),
      page.locator('#p2-reset-btn')
    ], 48);

    bench.recordPhase(2, {
      title: 'Трассировка кратчайшего пути A -> E на графе + калибратор',
      depth: 2,
      memory: 2,
      search: 1,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase2UI(page);

    await expect(page.locator('#phase-3-workspace')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p3-palette button[data-token-id]'),
      page.locator('#p3-slots-grid button[data-dag-slot]'),
      page.locator('#p3-reset-btn')
    ], 48);

    bench.recordPhase(3, {
      title: 'Топологический подсчёт путей в DAG (Слоты с дистракторами)',
      depth: 3,
      memory: 3,
      search: 1,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('0');

    bench.assertGradeCorridor('9-класс');
    bench.assertNoFakeDifficulty();
    bench.renderReport('9-класс Lesson 10 (Level 1) :: Difficulty Benchmark');
    sim.assertCleanSession();
  });
});
