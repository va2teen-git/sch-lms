import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/9-класс/10/level1.astro');
const TASK_URL = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1';

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

export async function solvePhase1UI(page) {
  await expect(page.locator('#phase-1-workspace')).toBeVisible();
  const matrixWeights = await page.evaluate(() => {
    const svg = document.getElementById('p1-graph-svg');
    const circles = Array.from(svg.querySelectorAll(':scope > circle'));
    const nodes = circles.map((c) => {
      const labelEl = c.nextElementSibling;
      return {
        label: labelEl ? labelEl.textContent.trim() : '',
        x: Number(c.getAttribute('cx')),
        y: Number(c.getAttribute('cy'))
      };
    });

    function nearestNode(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = n.label;
        }
      }
      return best;
    }

    const weights = {};
    const paths = Array.from(svg.querySelectorAll(':scope > path'));
    for (const p of paths) {
      const dStr = p.getAttribute('d') || '';
      const m = dStr.match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
      if (!m) continue;
      const u = nearestNode(Number(m[1]), Number(m[2]));
      const v = nearestNode(Number(m[3]), Number(m[4]));
      // path -> rect -> text
      const rectEl = p.nextElementSibling;
      const textEl = rectEl ? rectEl.nextElementSibling : null;
      if (u && v && textEl) {
        weights[u + '-' + v] = Number(textEl.textContent.trim());
      }
    }
    return weights;
  });

  const slotButtons = page.locator('#p1-matrix-tbody button[data-slot-key]');
  const slotCount = await slotButtons.count();
  expect(slotCount).toBeGreaterThanOrEqual(3);

  const slotKeys = [];
  for (let i = 0; i < slotCount; i++) {
    slotKeys.push(await slotButtons.nth(i).getAttribute('data-slot-key'));
  }

  for (const key of slotKeys) {
    const val = matrixWeights[key];
    expect(val, `Missing SVG edge weight for slot ${key}`).toBeGreaterThan(0);
    await page.locator(`#p1-palette button[data-token-val="${val}"]`).first().click();
    await page.locator(`#p1-matrix-tbody button[data-slot-key="${key}"]`).click();
  }

  await page.locator('#verify-btn').click();
}

export async function solvePhase2UI(page) {
  await expect(page.locator('#phase-2-workspace')).toBeVisible();
  const { bestPath, bestDist } = await page.evaluate(() => {
    const svg = document.getElementById('p2-graph-svg');
    const nodeGroups = Array.from(svg.querySelectorAll(':scope > g[data-node]'));
    const nodes = nodeGroups.map((g) => {
      const c = g.querySelector('circle');
      return {
        label: g.getAttribute('data-node'),
        x: Number(c.getAttribute('cx')),
        y: Number(c.getAttribute('cy'))
      };
    });

    function nearestNode(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = n.label;
        }
      }
      return best;
    }

    const adj = {};
    nodes.forEach((n) => { adj[n.label] = {}; });
    const lines = Array.from(svg.querySelectorAll(':scope > line'));
    for (const line of lines) {
      const u = nearestNode(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
      const v = nearestNode(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
      const rectEl = line.nextElementSibling;
      const textEl = rectEl ? rectEl.nextElementSibling : null;
      const w = Number(textEl.textContent.trim());
      adj[u][v] = w;
      adj[v][u] = w;
    }

    let bestCost = Infinity;
    let bestRoute = null;
    const visited = new Set(['A']);
    function dfs(curr, path, dist) {
      if (dist >= bestCost) return;
      if (curr === 'E') {
        bestCost = dist;
        bestRoute = path.slice();
        return;
      }
      for (const [nxt, w] of Object.entries(adj[curr] || {})) {
        if (visited.has(nxt)) continue;
        visited.add(nxt);
        path.push(nxt);
        dfs(nxt, path, dist + w);
        path.pop();
        visited.delete(nxt);
      }
    }
    dfs('A', ['A'], 0);
    return { bestPath: bestRoute, bestDist: bestCost };
  });

  expect(bestPath && bestPath.length >= 2).toBe(true);
  for (let i = 1; i < bestPath.length; i++) {
    await page.locator(`#p2-graph-svg g[data-node="${bestPath[i]}"]`).click();
  }

  await page.locator('#p2-length-slider').evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, bestDist);

  await expect(page.locator('#p2-slider-readout')).toHaveText(String(bestDist));
  await page.locator('#verify-btn').click();
}

export async function solvePhase3UI(page) {
  await expect(page.locator('#phase-3-workspace')).toBeVisible();
  const counts = await page.evaluate(() => {
    const badgeText = document.getElementById('p3-rule-badge').textContent || '';
    const banMatch = badgeText.match(/Запрещ[её]н(?:ный пункт|а вершина):\s*([А-ЯЁ])/i);
    const bannedNode = banMatch ? banMatch[1] : null;

    const svg = document.getElementById('p3-dag-svg');
    const circles = Array.from(svg.querySelectorAll(':scope > circle'));
    const nodes = circles.map((c) => {
      const t = c.nextElementSibling;
      return {
        label: t ? t.textContent.trim() : '',
        x: Number(c.getAttribute('cx')),
        y: Number(c.getAttribute('cy'))
      };
    });

    function nearestNode(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = n.label;
        }
      }
      return best;
    }

    const adj = {};
    nodes.forEach((n) => { adj[n.label] = []; });

    for (const line of Array.from(svg.querySelectorAll(':scope > line'))) {
      const u = nearestNode(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
      const v = nearestNode(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
      adj[u].push(v);
    }
    for (const p of Array.from(svg.querySelectorAll(':scope > path'))) {
      const dStr = p.getAttribute('d') || '';
      const m = dStr.match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
      if (m) {
        const u = nearestNode(Number(m[1]), Number(m[2]));
        const v = nearestNode(Number(m[3]), Number(m[4]));
        adj[u].push(v);
      }
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
  expect(slotCount).toBeGreaterThanOrEqual(4);

  const slotNodes = [];
  for (let i = 0; i < slotCount; i++) {
    slotNodes.push(await slotButtons.nth(i).getAttribute('data-dag-slot'));
  }

  for (const node of slotNodes) {
    const expected = counts[node];
    await page.locator(`#p3-palette button[data-token-val="${expected}"]`).first().click();
    await page.locator(`#p3-slots-grid button[data-dag-slot="${node}"]`).click();
  }

  await page.locator('#verify-btn').click();
}

test.describe('9th Grade Lesson 10: Level 1 Direct Manipulation Suite', () => {
  test('Level 1 adheres to architectural requirements (Zero Multiple Choice, Zero-Style, Zero-CDN, TaskLayout 1, LMSTelemetry)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('Урок 10');

    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/<select\b/i);
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).not.toMatch(/prince_complete|prince-campaign/);
  });

  test('Full 3-phase walkthrough emits valid telemetry (start_time, time_spent_sec, stage/total_stages, level_complete)', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase-badge')).toContainText('Шаг 1 из 3');
    await solvePhase1UI(page);

    await expect(page.locator('#phase-badge')).toContainText('Шаг 2 из 3');
    await solvePhase2UI(page);

    await expect(page.locator('#phase-badge')).toContainText('Шаг 3 из 3');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__sentTelemetry);
    const progressEvts = events.filter((e) => e.action_type === 'in_progress');
    expect(progressEvts.length).toBe(2);
    expect(progressEvts[0].stage).toBe(2);
    expect(progressEvts[0].total_stages).toBe(3);

    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeDefined();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(completeEvt.mission_name).toContain('Урок 10');
  });

  test('Wrong submission triggers #status-alert error, emits level_fail/hardcore_reset, and regenerates Phase 1 cleanly', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Submit empty Phase 1 slots
    await page.locator('#verify-btn').click();
    await expect(page.locator('#status-alert')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await expect(page.locator('#status-alert')).toBeHidden();

    const failEvt = await page.evaluate(() => window.__sentTelemetry.find((e) => e.success === false));
    expect(failEvt).toBeDefined();
    expect(['hardcore_reset', 'level_fail']).toContain(failEvt.action_type);
    expect(failEvt.stage).toBe(1);
    expect(failEvt.total_stages).toBe(3);

    await solvePhase1UI(page);
    await expect(page.locator('#phase-2-workspace')).toBeVisible();
  });
});
