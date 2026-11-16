import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const COURSE_11B = '11-класс_базовый';
const COURSE_11U = '11-класс_углубленный';

function enc(s) {
  return encodeURIComponent(s);
}

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__capturedTelemetry = [];
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TELEMETRY_EVENT') {
        window.__capturedTelemetry.push(event.data);
      }
    });
  });
}

async function getCapturedEvents(page) {
  return page.evaluate(() => window.__capturedTelemetry || []);
}

// Pipe solver helpers for 11b/5 Level 3
function glyphOpenings(glyph) {
  switch (glyph) {
    case '━━': return ['E', 'W'];
    case '┃': return ['N', 'S'];
    case '┏━': return ['E', 'S'];
    case '━┓': return ['S', 'W'];
    case '━┛': return ['N', 'W'];
    case '┗━': return ['E', 'N'];
    default: return [];
  }
}

function isStraight(glyph) {
  return glyph === '━━' || glyph === '┃';
}

function rotateDir(d, k) {
  const dirs = ['N', 'E', 'S', 'W'];
  return dirs[(dirs.indexOf(d) + k) % 4];
}

function solvePipeGrid(grid, entryRow, targetRow) {
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const DR = { N: -1, E: 0, S: 1, W: 0 };
  const DC = { N: 0, E: 1, S: 0, W: -1 };

  const path = [];
  const visited = new Set();

  function dfs(r, c, inDir) {
    if (c === 3 && r === targetRow && inDir === 'E') return true;
    if (r < 0 || r >= 3 || c < 0 || c >= 3) return false;
    const cell = grid[r][c];
    if (cell.blocked) return false;
    const key = `${r},${c}`;
    if (visited.has(key)) return false;

    const baseOpens = glyphOpenings(cell.glyph);
    const maxRot = isStraight(cell.glyph) ? 2 : 4;
    visited.add(key);

    for (let rot = 0; rot < maxRot; rot++) {
      const opens = baseOpens.map(d => rotateDir(d, rot));
      if (!opens.includes(inDir)) continue;
      const outDir = opens.find(d => d !== inDir);
      if (!outDir) continue;

      if (c === 2 && outDir === 'E') {
        if (r === targetRow) {
          path.push({ r, c, clicks: rot });
          return true;
        }
        continue;
      }

      const nr = r + DR[outDir];
      const nc = c + DC[outDir];
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        if (dfs(nr, nc, OPP[outDir])) {
          path.push({ r, c, clicks: rot });
          return true;
        }
      }
    }

    visited.delete(key);
    return false;
  }

  dfs(entryRow, 0, 'W');
  return path.reverse();
}

test.describe('Stage 3 Migration: Lesson shells, Legacy HTML removal & DB compatibility', () => {
  test('All 4 lesson shells load Astro routes (not .html) and expose Logo-Storm', async ({ page }) => {
    const targets = [
      { course: COURSE_11B, id: '5' },
      { course: COURSE_11U, id: '15' },
      { course: COURSE_11U, id: '16' },
      { course: COURSE_11U, id: '18' }
    ];

    for (const t of targets) {
      await page.goto(`${BASE}/lesson/${enc(t.course)}/${t.id}`);
      await expect(page.locator('#sprint-toggle')).toBeVisible();

      const iframeSrcs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('iframe')).map(f => f.getAttribute('src') || '')
      );
      expect(iframeSrcs.some(s => s.endsWith(`/${t.id}/level1`))).toBe(true);
      expect(iframeSrcs.some(s => s.endsWith(`/${t.id}/level2`))).toBe(true);
      expect(iframeSrcs.some(s => s.endsWith(`/${t.id}/level3`))).toBe(true);
      expect(iframeSrcs.some(s => s.includes('.html'))).toBe(false);
    }
  });

  test('Historical DB migration & APIs: 11b/5, 11u/16, 11u/18 restored across progress, matrix-progress and teacher stats', async ({ request }) => {
    const db = new Database(path.join(process.cwd(), 'telemetry.db'), { readonly: true });
    const cnt5 = db.prepare(`SELECT COUNT(*) as c FROM telemetry WHERE course_slug = '11-класс_базовый' AND lesson_id = '5'`).get().c;
    const cnt16 = db.prepare(`SELECT COUNT(*) as c FROM telemetry WHERE course_slug = '11-класс_углубленный' AND lesson_id = '16'`).get().c;
    const cnt18u = db.prepare(`SELECT COUNT(*) as c FROM telemetry WHERE course_slug = '11-класс_углубленный' AND lesson_id = '18'`).get().c;
    const cnt18adv10 = db.prepare(`SELECT COUNT(*) as c FROM telemetry WHERE course_slug = '10-класс_углубленный' AND lesson_id = '18'`).get().c;
    db.close();

    expect(cnt5).toBeGreaterThan(500);
    expect(cnt16).toBeGreaterThan(200);
    expect(cnt18u).toBeGreaterThan(200);
    expect(cnt18adv10).toBeGreaterThan(500);

    // /api/progress for 11b/5
    const p5 = await request.get(
      `${BASE}/api/progress?firstName=${enc('Алексей')}&lastName=${enc('Артемович')}&className=${enc(COURSE_11B)}&lessonPrefix=${enc('Урок 5')}&courseSlug=${enc(COURSE_11B)}&lessonId=5`
    );
    expect(p5.ok()).toBe(true);
    const p5Json = await p5.json();
    expect(p5Json.isNormalCompleted).toBe(true);
    expect(p5Json.unlockedNormal).toBe(4);

    // /api/matrix-progress for 11b/5
    const m5 = await request.get(
      `${BASE}/api/matrix-progress?firstName=${enc('Алексей')}&lastName=${enc('Артемович')}&className=${enc(COURSE_11B)}`
    );
    expect(m5.ok()).toBe(true);
    const m5Json = await m5.json();
    expect(m5Json.lessons['11-класс_базовый::5']?.completed).toBe(true);

    // /api/progress & /api/matrix-progress for 11u/16 and 11u/18
    const p16 = await request.get(
      `${BASE}/api/progress?firstName=${enc('Артём')}&lastName=${enc('Загребнев')}&className=${enc(COURSE_11U)}&lessonPrefix=${enc('Урок 16')}&courseSlug=${enc(COURSE_11U)}&lessonId=16`
    );
    expect(p16.ok()).toBe(true);
    expect((await p16.json()).isNormalCompleted).toBe(true);

    const m11u = await request.get(
      `${BASE}/api/matrix-progress?firstName=${enc('Артём')}&lastName=${enc('Загребнев')}&className=${enc(COURSE_11U)}`
    );
    expect(m11u.ok()).toBe(true);
    const m11uJson = await m11u.json();
    expect(m11uJson.lessons['11-класс_углубленный::16']?.completed).toBe(true);
    expect(m11uJson.lessons['11-класс_углубленный::18']?.completed).toBe(true);

    // /api/teacher/stats for 11b/5, 11u/16, 11u/18
    for (const q of [
      `course=${enc(COURSE_11B)}&lesson=5&date=all`,
      `course=${enc(COURSE_11U)}&lesson=16&date=all`,
      `course=${enc(COURSE_11U)}&lesson=18&date=all`
    ]) {
      const res = await request.get(`${BASE}/api/teacher/stats?${q}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.students.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Stage 3 E2E: 11-класс_базовый / Урок 5', () => {
  test('Level 1 completes 3 classification phases with LMSTelemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11B)}/5/level1`);

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 3`);
      const count = await page.locator('#itemsContainer .item-card').count();
      for (let i = 0; i < count; i++) {
        const card = page.locator('#itemsContainer .item-card').first();
        const cat = await card.getAttribute('data-cat');
        await card.click();
        await page.locator(`.bucket[data-category="${cat}"]`).click();
      }
      await page.click('#checkBtn');
      if (phase < 3) await page.waitForTimeout(700);
    }

    await expect(page.locator('#victoryBox')).toBeVisible();
    const events = await getCapturedEvents(page);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
  });

  test('Level 2 enforces Anti-Paste and completes 5 anti-phishing phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11B)}/5/level2`);

    await page.locator('#domainInput').evaluate((el) => {
      const ev = new Event('paste', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    });
    await expect(page.locator('#pasteNotice')).toBeVisible();

    const domainMap = {
      'Госуслуги': 'gosuslugi.ru',
      'ФНС (Налоговая)': 'nalog.gov.ru',
      'Социальный фонд (СФР)': 'sfr.gov.ru',
      'Росреестр': 'rosreestr.gov.ru',
      'Сайт Администрации Санкт-Петербурга': 'gov.spb.ru',
      'Здоровье петербуржца (Запись к врачу)': 'gorzdrav.spb.ru',
      'Сбербанк Онлайн': 'sberbank.ru',
      'Т-Банк (Тинькофф)': 'tbank.ru',
      'Альфа-Банк': 'alfabank.ru',
      'Ozon': 'ozon.ru',
      'Wildberries': 'wildberries.ru',
      'Авито': 'avito.ru',
      'РЖД': 'rzd.ru',
      'Аэрофлот': 'aeroflot.ru',
      'Почта России': 'pochta.ru',
      'Электронный дневник': 'dnevnik.ru',
      'Stepik': 'stepik.org',
      'Учи.ру': 'uchi.ru',
      'ВКонтакте': 'vk.com',
      'Яндекс': 'ya.ru'
    };

    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 5`);
      const intent = (await page.locator('#userIntent').innerText()).trim();
      await page.fill('#domainInput', domainMap[intent]);
      await page.click('#checkBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
  });

  test('Level 3 SMEV Router: intro screen, error reset, and 10 waves solved', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11B)}/5/level3`);

    await expect(page.locator('#startScreen')).toBeVisible();
    await page.click('#startBtn');

    // Trigger intentional fail on wave 1
    await page.click('#launchBtn');
    await expect(page.locator('#failOverlay')).toBeVisible();
    await expect(page.locator('#failOverlay')).toBeHidden({ timeout: 5000 });

    const targetByIntent = {
      'Оформление загранпаспорта нового образца': 'МВД России',
      'Оплата транспортного налога и регистрация ИП': 'ФНС России',
      'Запись к врачу по ОМС (ЕМИАС)': 'Минздрав',
      'Регистрация права собственности на квартиру': 'Росреестр',
      'Оформление выписки о материнском капитале': 'Соцфонд (СФР)',
      'Проверка штрафов за нарушение ПДД': 'ГИБДД',
      'Подача заявления о регистрации брака': 'Органы ЗАГС',
      'Оплата квитанции за электроэнергию и воду': 'ГИС ЖКХ',
      'Оформление электронной цифровой подписи': 'Удост. центр',
      'Передача показаний счётчиков воды': 'ГИС ЖКХ',
      'Получение справки об отсутствии судимости': 'МВД России',
      'Покупка билета на поезд Сапсан': 'РЖД',
      'Проверка оценок за четверть в школе': 'Эл. дневник',
      'Проверка налоговой задолженности физического лица': 'ФНС России'
    };

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('.badge', { hasText: `ВОЛНА ${w} / 10` })).toBeVisible();
      const boardState = await page.evaluate(() => {
        const intent = document.querySelector('.bg-dark.border-info .fs-5')?.textContent?.trim() || '';
        const exits = [0, 1, 2].map(r => document.querySelector(`[data-exit-row="${r}"]`)?.textContent?.trim() || '');
        const entryRow = Array.from(document.querySelectorAll('.d-flex.flex-column.gap-2 > .row')).findIndex(row =>
          row.textContent?.includes('ВХОД ▶')
        );
        const grid = [0, 1, 2].map(r =>
          [0, 1, 2].map(c => {
            const btn = document.querySelector(`button[data-row="${r}"][data-col="${c}"]`);
            return {
              glyph: btn?.textContent?.trim() || '',
              blocked: btn?.getAttribute('data-blocked') === '1'
            };
          })
        );
        return { intent, exits, entryRow, grid };
      });

      const targetName = targetByIntent[boardState.intent];
      const targetRow = boardState.exits.indexOf(targetName);
      const steps = solvePipeGrid(boardState.grid, boardState.entryRow, targetRow);
      expect(steps.length).toBeGreaterThan(0);

      for (const s of steps) {
        for (let k = 0; k < s.clicks; k++) {
          await page.click(`button[data-row="${s.r}"][data-col="${s.c}"]`);
        }
      }
      await page.click('#launchBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'hardcore_reset' && e.wave === 1)).toBe(true);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.wave).toBe(10);
    expect(completeEvt.total_waves).toBe(10);
  });
});

test.describe('Stage 3 E2E: 11-класс_углубленный / Урок 15 (Деревья)', () => {
  test('Level 1 tree node selection completes 3 phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/15/level1`);

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 3`);
      const targetNodes = await page.evaluate(() => {
        const q = document.getElementById('questionText').textContent;
        const nodes = Array.from(document.querySelectorAll('.tree-node')).map(el => ({
          name: el.dataset.node,
          top: parseFloat(el.style.top.match(/([\d.]+)%/)?.[1] || '0'),
          left: parseFloat(el.style.left.match(/([\d.]+)%/)?.[1] || '0')
        }));
        const lines = Array.from(document.querySelectorAll('#treeSvg line')).map(l => ({
          x1: parseFloat(l.getAttribute('x1')),
          y1: parseFloat(l.getAttribute('y1')),
          x2: parseFloat(l.getAttribute('x2')),
          y2: parseFloat(l.getAttribute('y2'))
        }));

        // Map SVG coords back to node names
        const svgCoords = {};
        for (const n of nodes) {
          svgCoords[n.name] = { x: (n.left / 100) * 600, y: (n.top / 100) * 330 };
        }
        const findClosest = (x, y) => {
          let best = null, minD = 1e9;
          for (const [name, pt] of Object.entries(svgCoords)) {
            const d = Math.hypot(pt.x - x, pt.y - y);
            if (d < minD) { minD = d; best = name; }
          }
          return best;
        };

        const children = {};
        const depth = { A: 0 };
        nodes.forEach(n => children[n.name] = []);
        const edges = lines.map(l => [findClosest(l.x1, l.y1), findClosest(l.x2, l.y2)]);
        // BFS depths
        const queue = ['A'];
        while (queue.length) {
          const u = queue.shift();
          for (const [p, c] of edges) {
            if (p === u && depth[c] === undefined) {
              children[u].push(c);
              depth[c] = depth[u] + 1;
              queue.push(c);
            }
          }
        }

        if (q.includes('ЛИСТЬЯ')) {
          return nodes.filter(n => children[n.name].length === 0).map(n => n.name);
        }
        const m = q.match(/ГЛУБИНЕ\s+(\d+)/);
        if (m) {
          const d = parseInt(m[1], 10);
          return nodes.filter(n => depth[n.name] === d).map(n => n.name);
        }
        return nodes.filter(n => n.name !== 'A' && children[n.name].length > 0).map(n => n.name);
      });

      for (const n of targetNodes) {
        await page.click(`.tree-node[data-node="${n}"]`);
      }
      await page.click('#checkBtn');
      if (phase < 3) await page.waitForTimeout(750);
    }

    await expect(page.locator('#victoryBox')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.stage === 3)).toBe(true);
  });

  test('Level 2 enforces Anti-Paste and solves 5 AST expression phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/15/level2`);

    await page.locator('#answerInput').evaluate((el) => {
      el.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#pasteNotice')).toBeVisible();

    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 5`);
      const ans = await page.evaluate((p) => {
        const q = document.getElementById('questionText').textContent;
        const rects = Array.from(document.querySelectorAll('#exprSvg rect'));
        const texts = Array.from(document.querySelectorAll('#exprSvg text'));
        const nodes = rects.map((r, i) => ({
          x: parseFloat(r.getAttribute('x')) + parseFloat(r.getAttribute('width')) / 2,
          y: parseFloat(r.getAttribute('y')) + parseFloat(r.getAttribute('height')) / 2,
          label: texts[i].textContent.trim()
        }));
        const lines = Array.from(document.querySelectorAll('#exprSvg line')).map(l => ({
          x1: parseFloat(l.getAttribute('x1')),
          y1: parseFloat(l.getAttribute('y1')),
          x2: parseFloat(l.getAttribute('x2')),
          y2: parseFloat(l.getAttribute('y2'))
        }));

        const findNode = (x, y) => nodes.reduce((best, n) => {
          const d = Math.hypot(n.x - x, n.y - y);
          return (!best || d < best.d) ? { n, d } : best;
        }, null).n;

        const children = new Map(nodes.map(n => [n, []]));
        const hasParent = new Set();
        for (const l of lines) {
          const p = findNode(l.x1, l.y1);
          const c = findNode(l.x2, l.y2);
          children.get(p).push(c);
          hasParent.add(c);
        }
        const root = nodes.find(n => !hasParent.has(n));
        for (const ch of children.values()) ch.sort((a, b) => a.x - b.x);

        if (p === 4) {
          const depth = new Map([[root, 0]]);
          const stack = [root];
          let maxD = 0, maxDeg = 0;
          while (stack.length) {
            const cur = stack.pop();
            const ch = children.get(cur);
            if (ch.length > maxDeg) maxDeg = ch.length;
            for (const c of ch) {
              depth.set(c, depth.get(cur) + 1);
              if (depth.get(c) > maxD) maxD = depth.get(c);
              stack.push(c);
            }
          }
          return q.includes('ВЫСОТУ') ? String(maxD) : String(maxDeg);
        }

        function evalExpr(node) {
          const ch = children.get(node);
          if (ch.length === 0) return parseInt(node.label, 10);
          const l = evalExpr(ch[0]);
          const r = evalExpr(ch[1]);
          if (node.label === '+') return l + r;
          if (node.label === '-') return l - r;
          if (node.label === '*') return l * r;
          return l / r;
        }

        function toInfix(node, isRoot) {
          const ch = children.get(node);
          if (ch.length === 0) return node.label;
          const expr = `${toInfix(ch[0], false)}${node.label}${toInfix(ch[1], false)}`;
          return isRoot ? expr : `(${expr})`;
        }

        if (p === 2) return toInfix(root, true);
        if (p === 5) {
          const m = q.match(/равно\s+(-?\d+)/);
          const target = parseInt(m[1], 10);
          const ch = children.get(root); // [leftOp, rightNum]
          const b = parseInt(ch[1].label, 10);
          const leftCh = children.get(ch[0]);
          const a = parseInt(leftCh[1].label, 10);
          const inner = target / b;
          const x = ch[0].label === '+' ? inner - a : inner + a;
          return String(x);
        }
        return String(evalExpr(root));
      }, phase);

      await page.fill('#answerInput', ans);
      await page.click('#checkBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.stage === 5)).toBe(true);
  });

  test('Level 3 Minimax Arcade: intro, hardcore reset on error, and 10 waves solved', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/15/level3`);

    await expect(page.locator('#startScreen')).toBeVisible();
    await page.click('#startBtn');

    // Intentional wrong answer to verify reset to wave 1
    await page.fill('input[type="number"]', '99');
    await page.click('#submitBtn');
    await expect(page.locator('#failOverlay')).toBeVisible();
    await expect(page.locator('#failOverlay')).toBeHidden({ timeout: 5000 });

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('.badge', { hasText: `ВОЛНА ${w} / 10` })).toBeVisible();
      const rootAns = await page.evaluate(() => {
        const texts = Array.from(document.querySelectorAll('svg text'))
          .map(t => t.textContent.trim())
          .filter(t => /^[1-9]$/.test(t))
          .map(t => parseInt(t, 10));
        const m1 = Math.max(texts[0], texts[1]);
        const m2 = Math.max(texts[2], texts[3]);
        const m3 = Math.max(texts[4], texts[5]);
        const m4 = Math.max(texts[6], texts[7]);
        return String(Math.max(Math.min(m1, m2), Math.min(m3, m4)));
      });
      await page.fill('input[type="number"]', rootAns);
      await page.click('#submitBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'hardcore_reset' && e.wave === 1)).toBe(true);
    expect(events.some(e => e.action_type === 'level_complete' && e.wave === 10)).toBe(true);
  });
});

test.describe('Stage 3 E2E: 11-класс_углубленный / Урок 16 (Теория игр)', () => {
  test('Level 1 completes 3 mouse-driven stages', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/16/level1`);

    // Stage 1: bins
    await expect(page.locator('#phaseTitle')).toContainText('Этап 1 из 3');
    const s1Count = await page.locator('#s1Items .s1-item').count();
    for (let i = 0; i < s1Count; i++) {
      const card = page.locator('#s1Items .s1-item').first();
      const cat = await card.getAttribute('data-cat');
      await card.click();
      await page.locator(`#s1Buckets .bucket[data-cat="${cat}"]`).click();
    }
    await page.click('#s1CheckBtn');
    await expect(page.locator('#stage2Card')).toBeVisible({ timeout: 3000 });

    // Stage 2: tree node toggles
    const s2Nodes = await page.evaluate(() => {
      const bText = document.getElementById('bLeavesDesc').textContent;
      const cText = document.getElementById('cLeavesDesc').textContent;
      const bExp = bText.includes('(П)') ? 'В' : 'П';
      const cExp = cText.includes('(П)') ? 'В' : 'П';
      const aExp = (bExp === 'П' || cExp === 'П') ? 'В' : 'П';
      return { A: aExp, B: bExp, C: cExp };
    });
    for (const [k, target] of Object.entries(s2Nodes)) {
      const clicks = target === 'В' ? 1 : 2;
      for (let i = 0; i < clicks; i++) {
        await page.click(`#node${k}`);
      }
    }
    await page.click('#s2CheckBtn');
    await expect(page.locator('#stage3Card')).toBeVisible({ timeout: 3000 });

    // Stage 3: slot & snap
    const s3Tokens = await page.evaluate(() => {
      const p = document.getElementById('s3Prompt').textContent;
      return p.includes('ВЫИГРЫШНОЙ')
        ? ['выигрышной', 'есть', 'первый']
        : ['проигрышной', 'нет', 'второй'];
    });
    for (let i = 0; i < 3; i++) {
      await page.click(`#s3Tokens .s3-tok[data-token="${s3Tokens[i]}"]`);
      await page.click(`#s3Sentence .s3-slot[data-slot="${i}"]`);
    }
    await page.click('#s3CheckBtn');

    await expect(page.locator('#victoryBox')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.stage === 3)).toBe(true);
  });

  test('Level 2 enforces Anti-Paste and completes 5 backward-induction phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/16/level2`);

    await page.locator('#answerInput').evaluate((el) => {
      el.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#pasteNotice')).toBeVisible();

    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 5`);
      const sol = await page.evaluate((p) => {
        const diag = document.getElementById('treeDiagram').textContent;
        if (p === 1) return { v1: 'П' };
        if (p === 2) return { v1: 'В' };
        if (p === 3) return { v1: 'П' };
        if (p === 4) {
          const m = diag.match(/\[([A-Z])\]\s+\(П\)/);
          return { v1: m[1] };
        }
        // p === 5: parse 4 leaves in order
        const leaves = [...diag.matchAll(/\((В|П)\)/g)].map(x => x[1]);
        const bStatus = (leaves[0] === 'П' || leaves[1] === 'П') ? 'В' : 'П';
        const cStatus = (leaves[2] === 'П' || leaves[3] === 'П') ? 'В' : 'П';
        const rootStatus = (bStatus === 'П' || cStatus === 'П') ? 'В' : 'П';
        return { v1: rootStatus, v2: rootStatus === 'В' ? 'первый' : 'второй' };
      }, phase);

      await page.fill('#answerInput', sol.v1);
      if (sol.v2) await page.fill('#answerInput2', sol.v2);
      await page.click('#checkBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.stage === 5)).toBe(true);
  });

  test('Level 3 Cyber-Stones: intro screen and 10 waves solved by P-position strategy', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/16/level3`);

    await expect(page.locator('#startScreen')).toBeVisible();
    await page.click('#startBtn');

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('.badge', { hasText: `ВОЛНА ${w} / 10` })).toBeVisible();

      // Play turns until wave advances or gameWon
      while (true) {
        const doneWave = await page.evaluate((curW) => {
          if (document.getElementById('successArea')) return true;
          const badges = Array.from(document.querySelectorAll('.badge'));
          return !badges.some(b => b.textContent?.includes(`ВОЛНА ${curW} / 10`));
        }, w);
        if (doneWave) break;

        // Wait until player's turn (move buttons enabled)
        await page.waitForFunction(() => {
          const btn = document.querySelector('.move-btn');
          return btn && !btn.disabled;
        });

        const moveIdx = await page.evaluate(() => {
          const targetTxt = document.querySelector('.badge.bg-info')?.textContent || '';
          const target = parseInt(targetTxt.match(/(\d+)/)?.[1] || '21', 10);
          const cur = parseInt(document.getElementById('currentData')?.textContent || '1', 10);
          const btns = Array.from(document.querySelectorAll('.move-btn'));
          const moves = btns.map(b => {
            const m = b.textContent.match(/([+*])(\d+)/);
            return { t: m[1], v: parseInt(m[2], 10) };
          });

          const vp = [];
          for (let i = target - 1; i >= 1; i--) {
            let win = false;
            for (const m of moves) {
              const nx = m.t === '+' ? i + m.v : i * m.v;
              if (nx >= target || vp[nx] === 'P') { win = true; break; }
            }
            vp[i] = win ? 'V' : 'P';
          }
          for (let idx = 0; idx < moves.length; idx++) {
            const nx = moves[idx].t === '+' ? cur + moves[idx].v : cur * moves[idx].v;
            if (nx >= target || vp[nx] === 'P') return idx;
          }
          return 0;
        });

        await page.click(`.move-btn[data-move-idx="${moveIdx}"]`);
        await page.waitForTimeout(100);
      }
    }

    await expect(page.locator('#successArea')).toBeVisible({ timeout: 15000 });
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.wave === 10)).toBe(true);
  });
});

test.describe('Stage 3 E2E: 11-класс_углубленный / Урок 18 (ИИ)', () => {
  test('Level 1 completes 3 slider calibrator stages', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/18/level1`);

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 3`);
      const targetVal = await page.evaluate((p) => {
        const txt = document.getElementById('paramsBlock').textContent;
        const nums = [...txt.matchAll(/=\s*(-?\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        if (p === 1) return nums[0] * nums[2] + nums[1] * nums[3];
        if (p === 2) return (nums[0] - nums[1]) * nums[2];
        return (nums[0] / nums[1]) * nums[2];
      }, phase);

      await page.locator('#calibSlider').evaluate((el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, targetVal);
      await page.click('#checkBtn');
      if (phase < 3) await page.waitForTimeout(750);
    }

    await expect(page.locator('#victoryBox')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.stage === 3)).toBe(true);
  });

  test('Level 2 enforces Anti-Paste and completes 5 GenAI log phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/18/level2`);

    await page.locator('#answerInput').evaluate((el) => {
      el.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#pasteNotice')).toBeVisible();

    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 5`);
      const ans = await page.evaluate((p) => {
        const log = document.getElementById('logBox').textContent;
        const prompt = document.getElementById('questionPrompt').textContent;
        if (p === 1) {
          return log.match(/FAKE-(\d{4})-ER/)[1];
        }
        if (p === 2) {
          let best = '', maxS = -1;
          for (const m of log.matchAll(/->\s*([a-z]+)\s*:\s*([\d.]+)/gi)) {
            const sc = parseFloat(m[2]);
            if (sc > maxS) { maxS = sc; best = m[1]; }
          }
          return best;
        }
        if (p === 3) {
          const thr = parseInt(prompt.match(/больше\s+(\d+)/)[1], 10);
          for (const m of log.matchAll(/token:"([A-Z]+)",\s*freq:(\d+)/g)) {
            if (parseInt(m[2], 10) > thr) return m[1];
          }
        }
        if (p === 4) {
          return JSON.parse(log).payload.prompt.instruction_code;
        }
        let bestM = '', maxR = -999;
        for (const m of log.matchAll(/([A-Z]+):\s*(-?\d+)/g)) {
          const r = parseInt(m[2], 10);
          if (r > maxR) { maxR = r; bestM = m[1]; }
        }
        return bestM;
      }, phase);

      await page.fill('#answerInput', ans);
      await page.click('#checkBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'level_complete' && e.stage === 5)).toBe(true);
  });

  test('Level 3 AlphaGo 5x5 MCTS Arcade: intro, error reset, and 10 waves solved', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE_11U)}/18/level3`);

    await expect(page.locator('#startScreen')).toBeVisible();
    await page.click('#startBtn');

    // Intentional click on non-best cell on wave 1 to test hardcore reset
    await page.locator('.board-cell[data-best="0"]').first().click();
    await expect(page.locator('#failOverlay')).toBeVisible();
    await expect(page.locator('#failOverlay')).toBeHidden({ timeout: 5000 });

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('.badge', { hasText: `ВОЛНА ${w} / 10` })).toBeVisible();
      if (w <= 3 || (w >= 7 && w <= 9)) {
        await page.locator('.board-cell[data-best="1"]').click();
      } else if (w <= 6) {
        const winrate = await page.evaluate(() => {
          const desc = document.querySelector('.bg-dark.border-danger .fs-6')?.textContent || '';
          const total = parseInt(desc.match(/симуляций:\s*(\d+)/)[1], 10);
          const wins = parseInt(desc.match(/Побед:\s*(\d+)/)[1], 10);
          return String(Math.round((wins / total) * 100));
        });
        await page.fill('input[type="text"]', winrate);
        await page.click('#submitBtn');
      } else {
        const coord = await page.evaluate(() => {
          const desc = document.querySelector('.bg-dark.border-danger .fs-6')?.textContent || '';
          return desc.match(/координаты хода:\s*([A-Z]\d+)/)[1];
        });
        await page.fill('input[type="text"]', coord);
        await page.click('#submitBtn');
      }
    }

    await expect(page.locator('#successArea')).toBeVisible();
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'hardcore_reset' && e.wave === 1)).toBe(true);
    expect(events.some(e => e.action_type === 'level_complete' && e.wave === 10)).toBe(true);
  });
});
