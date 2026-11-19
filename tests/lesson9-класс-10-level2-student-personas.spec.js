import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2';

async function computeMatrixShortest(page, tbodyId) {
  return page.evaluate((id) => {
    const nodes = ['A', 'B', 'C', 'D', 'E'];
    const rows = Array.from(document.getElementById(id).querySelectorAll('tr'));
    const adj = {};
    nodes.forEach((n) => { adj[n] = {}; });
    rows.forEach((tr, rIdx) => {
      Array.from(tr.querySelectorAll('td')).forEach((td, cIdx) => {
        const val = Number(td.textContent.trim());
        if (Number.isFinite(val) && val > 0 && rIdx !== cIdx) adj[nodes[rIdx]][nodes[cIdx]] = val;
      });
    });
    let best = Infinity;
    const vis = new Set(['A']);
    function dfs(u, dist) {
      if (dist >= best) return;
      if (u === 'E') { best = dist; return; }
      for (const [v, w] of Object.entries(adj[u])) {
        if (!vis.has(v)) { vis.add(v); dfs(v, dist + w); vis.delete(v); }
      }
    }
    dfs('A', 0);
    return best;
  }, tbodyId);
}

async function computePhaseAnswerDOM(page, phaseNum) {
  await expect(page.locator(`#phase${phaseNum}`)).toBeVisible();
  if (phaseNum === 1) return computeMatrixShortest(page, 'p1-matrix-tbody');
  if (phaseNum === 2) return (await computeMatrixShortest(page, 'p2-matrix-tbody')) / 1000;
  if (phaseNum === 3) {
    return page.evaluate(() => {
      const targetT = Number((document.getElementById('p3-desc').textContent || '').match(/равна ровно\s+(\d+)\s*км/i)[1]);
      const svg = document.getElementById('p3-graph-svg');
      const nodes = Array.from(svg.querySelectorAll(':scope > circle')).map((c) => ({
        label: c.nextElementSibling.textContent.trim(),
        x: Number(c.getAttribute('cx')),
        y: Number(c.getAttribute('cy'))
      }));
      const nearest = (x, y) => {
        let best = null;
        let bestD = Infinity;
        for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bestD) { bestD = d; best = n.label; } }
        return best;
      };
      const edges = [];
      for (const el of Array.from(svg.querySelectorAll(':scope > line, :scope > path'))) {
        let sx, sy, ex, ey;
        if (el.tagName.toLowerCase() === 'line') {
          sx = Number(el.getAttribute('x1')); sy = Number(el.getAttribute('y1'));
          ex = Number(el.getAttribute('x2')); ey = Number(el.getAttribute('y2'));
        } else {
          const m = (el.getAttribute('d') || '').match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
          if (!m) continue;
          sx = Number(m[1]); sy = Number(m[2]); ex = Number(m[3]); ey = Number(m[4]);
        }
        const raw = el.nextElementSibling.nextElementSibling.textContent.trim();
        edges.push({ u: nearest(sx, sy), v: nearest(ex, ey), isX: raw === 'X', w: raw === 'X' ? 0 : Number(raw) });
      }
      let minFixedWithX = Infinity;
      function dfs(u, dist, usedX) {
        if (u === 'E') { if (usedX && dist < minFixedWithX) minFixedWithX = dist; return; }
        for (const e of edges) { if (e.u === u) dfs(e.v, dist + e.w, usedX || e.isX); }
      }
      dfs('A', 0, false);
      return targetT - minFixedWithX;
    });
  }
  const solveDag = (svgId, order, targetNode, reqNode, forbNode) => page.evaluate(({ svgId, order, targetNode, reqNode, forbNode }) => {
    const svg = document.getElementById(svgId);
    const nodes = Array.from(svg.querySelectorAll(':scope > circle')).map((c) => ({
      label: c.nextElementSibling.textContent.trim(),
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy'))
    }));
    const nearest = (x, y) => {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bestD) { bestD = d; best = n.label; } }
      return best;
    };
    const adj = {};
    order.forEach((n) => { adj[n] = []; });
    for (const line of Array.from(svg.querySelectorAll(':scope > line'))) {
      adj[nearest(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')))].push(
        nearest(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')))
      );
    }
    for (const p of Array.from(svg.querySelectorAll(':scope > path'))) {
      const m = (p.getAttribute('d') || '').match(/M\s+([0-9.-]+)\s+([0-9.-]+)\s+Q\s+[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)/);
      if (m) adj[nearest(Number(m[1]), Number(m[2]))].push(nearest(Number(m[3]), Number(m[4])));
    }
    const countRange = (start, end) => {
      const dp = {};
      order.forEach((n) => { dp[n] = 0; });
      if (start !== forbNode) dp[start] = 1;
      for (const u of order) {
        if (u === forbNode) continue;
        for (const v of adj[u] || []) { if (v !== forbNode) dp[v] += dp[u]; }
      }
      return dp[end];
    };
    return reqNode ? countRange('А', reqNode) * countRange(reqNode, targetNode) : countRange('А', targetNode);
  }, { svgId, order, targetNode, reqNode, forbNode });

  if (phaseNum === 4) {
    const m = (await page.locator('#p4-desc').innerText()).match(/через закрытый пункт\s+([А-ЯЁ])/i);
    return solveDag('p4-dag-svg', ['А', 'Б', 'Г', 'В', 'Д', 'Е'], 'Е', null, m[1]);
  }
  const desc = await page.locator('#p5-desc').innerText();
  const mReq = desc.match(/проходят через вершину\s+([А-ЯЁ])/i);
  const mForb = desc.match(/НЕ проходят через вершину\s+([А-ЯЁ])/i);
  return solveDag('p5-dag-svg', ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж'], 'Ж', mReq[1], mForb[1]);
}

async function solvePhaseDOM(page, phaseNum, formatFn = (v) => String(v)) {
  const ans = await computePhaseAnswerDOM(page, phaseNum);
  await page.locator(`#p${phaseNum}-input`).fill(formatFn(ans));
  await page.locator(`#p${phaseNum}-btn`).click();
  return ans;
}

test.describe('9th Grade Lesson 10: Level 2 Student Personas & Sawtooth 2-1-2 Benchmark', () => {
  test('Persona: NOVICE — enters wrong shortest path on Phase 1, sees feedback, recovers to full 5-phase victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const expected = await computePhaseAnswerDOM(page, 1);
        await sim.humanType(page.locator('#p1-input'), String(expected + 19), { submitWithEnter: true });
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#status-alert')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
        await expect(page.locator('#status-alert')).toBeHidden();
      },
      solveCorrectlyFn: async () => {
        await solvePhaseDOM(page, 1);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible();
      }
    });

    for (let p = 2; p <= 5; p++) {
      await solvePhaseDOM(page, p);
    }
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — types Russian commas and spaces on Phase 2 meter-to-km conversion and passes seamlessly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    await solvePhaseDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();

    const kmAns = await computePhaseAnswerDOM(page, 2);
    await sim.humanType(page.locator('#p2-input'), kmAns, {
      fuzzRussianComma: true,
      trailingSpaces: true,
      submitWithEnter: true
    });
    await expect(page.locator('#phase3')).toBeVisible();

    for (let p = 3; p <= 5; p++) {
      await solvePhaseDOM(page, p);
    }
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — Anti-Paste blocking and rapid spam clicks on inputs/buttons cause zero runtime exceptions', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    const p1Input = page.locator('#p1-input');
    await sim.attemptProhibitedPaste(p1Input, '42');
    await sim.simulateSpamClick(page.locator('#p1-btn'), 5);

    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — validates Sawtooth 2-1-2 curve, >=48px hitboxes & Grade 9 OGE corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '9-класс',
      lessonId: '10',
      levelNumber: 2
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    await bench.auditHitboxes([
      page.locator('#p1-input'),
      page.locator('#p1-btn')
    ], 48);

    const p1 = await solvePhaseDOM(page, 1);
    bench.auditNumberInvariants([p1]);
    bench.recordPhase(1, { title: 'Шаг 1: Прямой расчёт кратчайшего пути (матрица км)', depth: 2, memory: 2, search: 0, inversion: 0 });

    const p2 = await solvePhaseDOM(page, 2);
    bench.auditNumberInvariants([p2]);
    bench.recordPhase(2, { title: 'Шаг 2: Конвертация м → км', depth: 2, memory: 3, search: 0, inversion: 0 });

    const p3 = await solvePhaseDOM(page, 3);
    bench.auditNumberInvariants([p3]);
    bench.recordPhase(3, { title: 'Шаг 3: Пик инверсии (восстановление веса X)', depth: 3, memory: 2, search: 0, inversion: 2 });

    const p4 = await solvePhaseDOM(page, 4);
    bench.auditNumberInvariants([p4]);
    bench.recordPhase(4, { title: 'Шаг 4: Долина консолидации (DAG с запретом)', depth: 2, memory: 3, search: 0, inversion: 0 });

    const p5 = await solvePhaseDOM(page, 5);
    bench.auditNumberInvariants([p5]);
    bench.recordPhase(5, { title: 'Шаг 5: Кульминация (7-вершинный DAG: обязательный + запрет)', depth: 3, memory: 3, search: 0, inversion: 1 });

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('0');

    bench.assertSawtoothProfile();
    bench.assertGradeCorridor('9-класс');
    bench.assertNoFakeDifficulty();
    bench.renderReport('9-класс Lesson 10 (Level 2) :: Sawtooth 2-1-2 Benchmark');
    sim.assertCleanSession();
  });
});
