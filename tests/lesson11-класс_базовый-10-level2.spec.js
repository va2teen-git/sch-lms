import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/11-класс_базовый/10/level2.astro');
const TASK_URL = encodeURI('/tasks/11-класс_базовый/10/level2');
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

export async function solvePhaseFromDOM(page, phaseNum) {
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
      // Dijkstra / Floyd on 5 nodes from 0 to 4
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
      // Read SVG edge weights by midpoint order: A-B, B-G, G-D, A-V, V-D
      const texts = Array.from(document.querySelectorAll('#p3-svg-edges text')).map((t) => t.textContent.trim());
      // Edge 0: AB, Edge 1: BG='X', Edge 2: GD, Edge 3: AV, Edge 4: VD
      const nums = texts.filter((t) => t !== 'X').map(Number);
      const altLen = nums[2] + nums[3]; // A->V + V->D
      const targetLen = (altLen * pct) / 100;
      return Math.round(targetLen - (nums[0] + nums[1]));
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
      return {
        oddCount: deg.filter((d) => d % 2 === 1).length,
        missingEdges: (n * (n - 1)) / 2 - e
      };
    });
    await page.locator('#p4-input-odd').fill(String(oddCount));
    await page.locator('#p4-input-missing').fill(String(missingEdges));
    await page.locator('#p4-submit-btn').click();
    return;
  }

  if (phaseNum === 5) {
    const paths = await page.evaluate(() => {
      const labels = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];
      const reqLabel = document.getElementById('p5-req-badge').textContent.trim();
      const forbLabel = document.getElementById('p5-forb-badge').textContent.trim();
      const req = labels.indexOf(reqLabel);
      const forb = labels.indexOf(forbLabel);

      const coords = [
        { x: 45, y: 130 },
        { x: 150, y: 50 },
        { x: 150, y: 130 },
        { x: 150, y: 210 },
        { x: 280, y: 55 },
        { x: 280, y: 130 },
        { x: 280, y: 205 },
        { x: 385, y: 130 }
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
      const edges = [];
      document.querySelectorAll('#p5-svg-edges line').forEach((line) => {
        const u = nearest(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')));
        const v = nearest(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')));
        edges.push([u, v]);
      });

      function countPaths(start, end) {
        if (start === forb || end === forb) return 0;
        const dp = new Array(8).fill(0);
        dp[start] = 1;
        const topo = [0, 1, 3, 2, 4, 6, 5, 7];
        for (const u of topo) {
          if (u === forb) continue;
          for (const [a, b] of edges) {
            if (a === u && b !== forb) dp[b] += dp[a];
          }
        }
        return dp[end];
      }
      return countPaths(0, req) * countPaths(req, 7);
    });
    await page.locator('#p5-input-paths').fill(String(paths));
    await page.locator('#p5-submit-btn').click();
  }
}

test.describe('11th Grade Basic Lesson 10: Level 2 Suite', () => {
  test('Level 2 adheres to architectural contracts (5 phases, Anti-Paste, decimal text inputs, Zero-Style, LMSTelemetry)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={2}');
    for (let p = 1; p <= 5; p++) {
      expect(code).toContain(`id="phase${p}"`);
    }
    expect(code).toContain('inputmode="decimal"');
    expect(code).toContain('onpaste="return false;"');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('Урок 10');

    expect(code).not.toMatch(/type="number"/i);
    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/prince_complete/);
  });

  test('Calculation error on Phase 1 emits telemetry fail, shows error banner, regenerates, and preserves Prince gate', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await page.locator('#p1-input-sum').fill('0');
    await page.locator('#p1-input-edges').fill('0');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#error-feedback')).toBeVisible();
    const failEvts = await page.evaluate(() =>
      window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset' || e.action_type === 'level_fail')
    );
    expect(failEvts.length).toBeGreaterThanOrEqual(1);
    expect(failEvts[0].stage).toBe(1);
    expect(failEvts[0].total_stages).toBe(5);
    expect(failEvts[0].success).toBe(false);

    await page.waitForTimeout(1450);
    await expect(page.locator('#error-feedback')).toBeHidden();
    await expect(page.locator('#p1-input-sum')).toHaveValue('');

    // Verify lesson page keeps Prince bonus sealed
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
        mission_name: 'Урок 10 :: Графы. Решение алгоритмических задач, связанных с анализом графов (Уровень 2)',
        level: 2,
        stage: 1,
        total_stages: 5,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 4
      }, '*');
    });
    await expect(page.locator('#prince-bonus-card')).toBeHidden();
  });

  test('Full 5-phase walkthrough solving strictly from visible DOM verifies complete telemetry contract', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await solvePhaseFromDOM(page, p);
    }

    await expect(page.locator('#final-screen')).toBeVisible();
    await expect(page.locator('#stat-attempts')).toHaveText('0');

    const telemetry = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = telemetry.find((e) => e.action_type === 'level_complete' && e.success === true);
    expect(completeEvt).toBeDefined();
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(completeEvt.mission_name).toContain('Урок 10');
  });
});
