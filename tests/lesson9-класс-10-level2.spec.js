import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/9-класс/10/level2.astro');
const TASK_URL = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2';

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

async function computeMatrixShortest(page, tbodyId) {
  return page.evaluate((id) => {
    const nodes = ['A', 'B', 'C', 'D', 'E'];
    const tbody = document.getElementById(id);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const adj = {};
    nodes.forEach((n) => { adj[n] = {}; });

    rows.forEach((tr, rIdx) => {
      const cells = Array.from(tr.querySelectorAll('td'));
      cells.forEach((td, cIdx) => {
        const val = Number(td.textContent.trim());
        if (Number.isFinite(val) && val > 0 && rIdx !== cIdx) {
          adj[nodes[rIdx]][nodes[cIdx]] = val;
        }
      });
    });

    let best = Infinity;
    const vis = new Set(['A']);
    function dfs(u, dist) {
      if (dist >= best) return;
      if (u === 'E') { best = dist; return; }
      for (const [v, w] of Object.entries(adj[u])) {
        if (vis.has(v)) continue;
        vis.add(v);
        dfs(v, dist + w);
        vis.delete(v);
      }
    }
    dfs('A', 0);
    return best;
  }, tbodyId);
}

async function solvePhase3FromDOM(page) {
  return page.evaluate(() => {
    const desc = document.getElementById('p3-desc').textContent || '';
    const match = desc.match(/равна ровно\s+(\d+)\s*км/i);
    if (!match) throw new Error('Cannot parse targetT in p3-desc: ' + desc);
    const targetT = Number(match[1]);

    const svg = document.getElementById('p3-graph-svg');
    const circles = Array.from(svg.querySelectorAll(':scope > circle'));
    const nodes = circles.map((c) => ({
      label: c.nextElementSibling.textContent.trim(),
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy'))
    }));

    function nearest(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) { bestD = d; best = n.label; }
      }
      return best;
    }

    const edges = [];
    const elems = Array.from(svg.querySelectorAll(':scope > line, :scope > path'));
    for (const el of elems) {
      let sx, sy, ex, ey;
      if (el.tagName.toLowerCase() === 'line') {
        sx = Number(el.getAttribute('x1'));
        sy = Number(el.getAttribute('y1'));
        ex = Number(el.getAttribute('x2'));
        ey = Number(el.getAttribute('y2'));
      } else {
        const m = (el.getAttribute('d') || '').match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
        if (!m) continue;
        sx = Number(m[1]); sy = Number(m[2]); ex = Number(m[3]); ey = Number(m[4]);
      }
      const u = nearest(sx, sy);
      const v = nearest(ex, ey);
      const rectEl = el.nextElementSibling;
      const txtEl = rectEl ? rectEl.nextElementSibling : null;
      const raw = txtEl ? txtEl.textContent.trim() : '';
      edges.push({ u, v, isX: raw === 'X', w: raw === 'X' ? 0 : Number(raw) });
    }

    let minFixedWithX = Infinity;
    function dfs(u, dist, usedX) {
      if (u === 'E') {
        if (usedX && dist < minFixedWithX) minFixedWithX = dist;
        return;
      }
      for (const e of edges) {
        if (e.u === u) dfs(e.v, dist + e.w, usedX || e.isX);
      }
    }
    dfs('A', 0, false);
    return targetT - minFixedWithX;
  });
}

async function solveDagFromDOM(page, svgId, order, targetNode, reqNode, forbNode) {
  return page.evaluate(({ svgId, order, targetNode, reqNode, forbNode }) => {
    const svg = document.getElementById(svgId);
    const circles = Array.from(svg.querySelectorAll(':scope > circle'));
    const nodes = circles.map((c) => ({
      label: c.nextElementSibling.textContent.trim(),
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy'))
    }));

    function nearest(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) { bestD = d; best = n.label; }
      }
      return best;
    }

    const adj = {};
    order.forEach((n) => { adj[n] = []; });

    for (const line of Array.from(svg.querySelectorAll(':scope > line'))) {
      const u = nearest(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
      const v = nearest(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
      adj[u].push(v);
    }
    for (const p of Array.from(svg.querySelectorAll(':scope > path'))) {
      const m = (p.getAttribute('d') || '').match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
      if (m) {
        adj[nearest(Number(m[1]), Number(m[2]))].push(nearest(Number(m[3]), Number(m[4])));
      }
    }

    function countRange(start, end) {
      const dp = {};
      order.forEach((n) => { dp[n] = 0; });
      if (start !== forbNode) dp[start] = 1;
      for (const u of order) {
        if (u === forbNode) continue;
        for (const v of adj[u] || []) {
          if (v !== forbNode) dp[v] += dp[u];
        }
      }
      return dp[end];
    }

    return reqNode ? countRange('А', reqNode) * countRange(reqNode, targetNode) : countRange('А', targetNode);
  }, { svgId, order, targetNode, reqNode, forbNode });
}

export async function computePhaseAnswerDOM(page, phaseNum) {
  await expect(page.locator(`#phase${phaseNum}`)).toBeVisible();

  if (phaseNum === 1) {
    return computeMatrixShortest(page, 'p1-matrix-tbody');
  }
  if (phaseNum === 2) {
    const meters = await computeMatrixShortest(page, 'p2-matrix-tbody');
    return meters / 1000;
  }
  if (phaseNum === 3) {
    return solvePhase3FromDOM(page);
  }
  if (phaseNum === 4) {
    const desc = await page.locator('#p4-desc').innerText();
    const m = desc.match(/через закрытый пункт\s+([А-ЯЁ])/i);
    expect(m, `Cannot parse Phase 4 forbidden node: ${desc}`).not.toBeNull();
    return solveDagFromDOM(page, 'p4-dag-svg', ['А', 'Б', 'Г', 'В', 'Д', 'Е'], 'Е', null, m[1]);
  }
  if (phaseNum === 5) {
    const desc = await page.locator('#p5-desc').innerText();
    const mReq = desc.match(/проходят через вершину\s+([А-ЯЁ])/i);
    const mForb = desc.match(/НЕ проходят через вершину\s+([А-ЯЁ])/i);
    expect(mReq && mForb, `Cannot parse Phase 5 constraints: ${desc}`).toBeTruthy();
    return solveDagFromDOM(page, 'p5-dag-svg', ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж'], 'Ж', mReq[1], mForb[1]);
  }
  throw new Error(`Unsupported phaseNum ${phaseNum}`);
}

export async function solvePhaseDOM(page, phaseNum, formatFn = (v) => String(v)) {
  const ans = await computePhaseAnswerDOM(page, phaseNum);
  await page.locator(`#p${phaseNum}-input`).fill(formatFn(ans));
  await page.locator(`#p${phaseNum}-btn`).click();
  return ans;
}

test.describe('9th Grade Lesson 10: Level 2 Analytical Suite', () => {
  test('Level 2 adheres to architectural requirements (Zero Multiple Choice, text inputmode=decimal, Zero-Style, Zero-CDN)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('Урок 10');

    expect(code).not.toMatch(/type=["']number["']/i);
    expect(code).not.toMatch(/<select\b/i);
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).toContain('inputmode="decimal"');

    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/prince_complete|prince-campaign/);
  });

  test('Full 5-phase Sawtooth walkthrough with Russian comma formatting & telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await expect(page.locator('#phase-badge')).toContainText(`Шаг ${p} из 5`);
      await solvePhaseDOM(page, p, (v) => ` ${String(v).replace('.', ',')} `);
    }

    await expect(page.locator('#victory-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__sentTelemetry);
    const progressEvts = events.filter((e) => e.action_type === 'in_progress');
    expect(progressEvts.length).toBe(4);
    expect(progressEvts[0].stage).toBe(2);
    expect(progressEvts[0].total_stages).toBe(5);

    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeDefined();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(completeEvt.mission_name).toContain('Урок 10');
  });

  test('Wrong numeric answer shows #status-alert error, emits fail telemetry, regenerates Phase 1, and stays recoverable', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const ans1 = await computePhaseAnswerDOM(page, 1);
    await page.locator('#p1-input').fill(String(ans1 + 88));
    await page.locator('#p1-btn').click();

    await expect(page.locator('#status-alert')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await expect(page.locator('#status-alert')).toBeHidden();

    const failEvt = await page.evaluate(() => window.__sentTelemetry.find((e) => e.success === false));
    expect(failEvt).toBeDefined();
    expect(['hardcore_reset', 'level_fail']).toContain(failEvt.action_type);
    expect(failEvt.stage).toBe(1);
    expect(failEvt.total_stages).toBe(5);

    await solvePhaseDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();
  });
});
