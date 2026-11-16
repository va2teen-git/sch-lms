import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const COURSE = '10-класс_углубленный';

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

test.describe('Stage 2 Migration: Lesson shells, Legacy HTML removal & DB compatibility', () => {
  test('All 3 lesson shells (17, 18, 19) load Astro routes (not .html) and expose Logo-Storm', async ({ page }) => {
    for (const id of ['17', '18', '19']) {
      await page.goto(`${BASE}/lesson/${enc(COURSE)}/${id}`);
      await expect(page.locator('#sprint-toggle')).toBeVisible();

      const iframeSrcs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('iframe')).map(f => f.getAttribute('src') || '')
      );
      expect(iframeSrcs.some(s => s.endsWith(`/${id}/level1`))).toBe(true);
      expect(iframeSrcs.some(s => s.endsWith(`/${id}/level2`))).toBe(true);
      expect(iframeSrcs.some(s => s.endsWith(`/${id}/level3`))).toBe(true);
      expect(iframeSrcs.some(s => s.includes('.html'))).toBe(false);
    }
  });

  test('Historical DB migration & APIs: 17 Interactive Task normalized and 19 records intact', async ({ request }) => {
    const db = new Database(path.join(process.cwd(), 'telemetry.db'), { readonly: true });
    const rows17 = db.prepare(`
      SELECT level_number, course_slug, lesson_id
      FROM telemetry
      WHERE course_slug = '10-класс_углубленный' AND lesson_id = '17'
    `).all();
    db.close();

    expect(rows17.length).toBeGreaterThanOrEqual(3);
    for (const r of rows17) {
      expect(r.level_number).toBe(1);
    }

    const p19 = await request.get(
      `${BASE}/api/progress?firstName=${enc('Николай')}&lastName=${enc('Ватутин')}&className=${enc('7-класс')}&lessonPrefix=${enc('Урок 19')}&courseSlug=${enc(COURSE)}&lessonId=19`
    );
    expect(p19.ok()).toBe(true);
    const p19Json = await p19.json();
    expect(p19Json.unlockedNormal).toBeGreaterThanOrEqual(1);

    const m19 = await request.get(
      `${BASE}/api/matrix-progress?firstName=${enc('Николай')}&lastName=${enc('Ватутин')}&className=${enc('7-класс')}`
    );
    expect(m19.ok()).toBe(true);
    const m19Json = await m19.json();
    expect(m19Json.lessons).toBeDefined();

    const s19 = await request.get(`${BASE}/api/teacher/stats?course=${enc(COURSE)}&lesson=19&date=all`);
    expect(s19.ok()).toBe(true);
    const s19Json = await s19.json();
    expect(s19Json.success).toBe(true);
    expect(s19Json.students.length).toBeGreaterThan(0);

    const s17 = await request.get(`${BASE}/api/teacher/stats?course=${enc(COURSE)}&lesson=17&date=all`);
    expect(s17.ok()).toBe(true);
    const s17Json = await s17.json();
    expect(s17Json.success).toBe(true);
  });
});

test.describe('Stage 2 E2E: 10-класс_углубленный / Урок 17', () => {
  test('Level 1 completes 3 routing-table manipulation phases with valid telemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/17/level1`);

    function matchInterface(ip, routes) {
      const ipParts = ip.split('.').map(Number);
      let best = null;
      let bestPrefix = -1;
      for (const rt of routes) {
        const [net, prefStr] = rt.cidr.split('/');
        const pref = Number(prefStr);
        const netParts = net.split('.').map(Number);
        const octs = pref / 8;
        let ok = true;
        for (let i = 0; i < octs; i++) {
          if (ipParts[i] !== netParts[i]) { ok = false; break; }
        }
        if (ok && pref > bestPrefix) {
          bestPrefix = pref;
          best = rt.id;
        }
      }
      return best;
    }

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 3`);

      const routes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#targetSlots .slot')).map(el => ({
          id: el.dataset.slotId,
          cidr: el.textContent.match(/(\d+\.\d+\.\d+\.\d+\/\d+)/)[1]
        }))
      );

      const packets = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#sourceList .item-card')).map(el => ({
          id: el.id,
          ip: el.dataset.ip
        }))
      );

      for (const pkt of packets) {
        const targetId = matchInterface(pkt.ip, routes);
        await page.click(`#${pkt.id}`);
        await page.click(`#targetSlots .slot[data-slot-id="${targetId}"]`);
      }

      await page.click('#checkBtn');
      if (phase < 3) {
        await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase + 1} из 3`, { timeout: 5000 });
      }
    }

    await expect(page.locator('#victoryBox')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(3);
    expect(completes[0].total_stages).toBe(3);
    expect(typeof completes[0].start_time).toBe('string');
  });

  test('Level 2 enforces Anti-Paste and completes 5 firewall phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/17/level2`);

    // Verify Anti-Paste blocks paste event
    await page.evaluate(() => {
      const inp = document.getElementById('answerInput');
      const evt = new Event('paste', { bubbles: true, cancelable: true });
      inp.dispatchEvent(evt);
    });
    await expect(page.locator('#pasteNotice')).toBeVisible();

    function solveFirewallPrompt(q) {
      if (q.includes('(HTTP)')) return 'ALLOW TCP 80';
      if (q.includes('(HTTPS)')) return 'ALLOW TCP 443';
      if (q.includes('(SSH)')) return 'DENY TCP 22';
      if (q.includes('(DNS)')) return 'ALLOW UDP 53';
      if (q.includes('(FTP)')) return 'DENY TCP 21';
      if (q.includes('(Telnet)')) return 'DENY TCP 23';
      if (q.includes('(RDP)')) return 'ALLOW TCP 3389';
      if (q.includes('(SMTP)')) return 'DENY TCP 25';
      if (q.includes('POP3')) return 'ALLOW TCP 110';
      if (q.includes('(IMAP)')) return 'ALLOW TCP 143';
      if (q.includes('(NTP)')) return 'ALLOW UDP 123';
      if (q.includes('MySQL')) return 'ALLOW TCP 3306';
      if (q.includes('PostgreSQL')) return 'DENY TCP 5432';
      if (q.includes('(TFTP)')) return 'ALLOW UDP 69';
      return 'DENY ALL';
    }

    // Trigger 1 error first
    await page.fill('#answerInput', 'WRONG RULE');
    await page.click('#checkBtn');
    await expect(page.locator('#feedbackMsg')).toBeVisible();
    await expect(page.locator('#errorsCount')).toHaveText('1');
    await expect(page.locator('#answerInput')).toBeEnabled({ timeout: 5000 });

    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 5`);
      const q = await page.locator('#questionText').innerText();
      await page.fill('#answerInput', solveFirewallPrompt(q));
      await page.click('#checkBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'hardcore_reset')).toBe(true);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(5);
    expect(completes[0].total_stages).toBe(5);
  });

  test('Level 3 has intro screen, resets on error, and completes 10 waves', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/17/level3`);

    await expect(page.locator('#startBtn')).toBeVisible();
    await page.click('#startBtn');

    function solveCliPrompt(desc) {
      let m;
      if ((m = desc.match(/\(ping\) по IP:\s*([\d.]+)/))) return `ping ${m[1]}`;
      if ((m = desc.match(/доступность домена:\s*(\S+)/))) return `ping ${m[1]}`;
      if ((m = desc.match(/маршрута до домена:\s*(\S+)\s*\(Windows\)/))) return `tracert ${m[1]}`;
      if ((m = desc.match(/маршрута до IP:\s*([\d.]+)\s*\(Linux\)/))) return `traceroute ${m[1]}`;
      if ((m = desc.match(/по доменному имени:\s*(\S+)/))) return `nslookup ${m[1]}`;
      if (desc.includes('-an')) return 'netstat -an';
      if (desc.includes('сетевые настройки (Windows)')) return 'ipconfig';
      if (desc.includes('сетевые настройки (Linux)')) return 'ifconfig';
      if ((m = desc.match(/трассировку до IP:\s*([\d.]+)\s*\(Windows\)/))) return `tracert ${m[1]}`;
      if ((m = desc.match(/трассировку до домена:\s*(\S+)\s*\(Linux\)/))) return `traceroute ${m[1]}`;
      if (desc.includes('кэш DNS')) return 'ipconfig /flushdns';
      if ((m = desc.match(/\(с ключом -t\) до домена:\s*(\S+)/))) return `ping -t ${m[1]}`;
      if ((m = desc.match(/\(с ключом -n 5\) до IP:\s*([\d.]+)/))) return `ping -n 5 ${m[1]}`;
      if (desc.includes('route print')) return 'route print';
      if (desc.includes('route -n')) return 'route -n';
      if ((m = desc.match(/для домена\s*(\S+)\s*с типом/))) return `nslookup -type=mx ${m[1]}`;
      if (desc.includes('ARP-кэш')) return 'arp -a';
      if ((m = desc.match(/до\s*([\d.]+)\s*без резолва/))) return `tracert -d ${m[1]}`;
      if (desc.includes('ключ /all')) return 'ipconfig /all';
      if ((m = desc.match(/до узла\s*([\d.]+)\s*с размером/))) return `ping -l 1500 ${m[1]}`;
      throw new Error(`Unknown CLI task: ${desc}`);
    }

    // Wrong command on wave 1 triggers hardcore_reset
    await page.fill('#cmdInput', 'badcmd');
    await page.click('#execBtn');
    await expect(page.locator('#failOverlay')).toBeVisible();
    await expect(page.locator('#failOverlay')).toBeHidden({ timeout: 5000 });

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('text=ВОЛНА ' + w + ' / 10')).toBeVisible();
      const desc = await page.locator('.bg-dark.border-danger .fs-5').innerText();
      await page.fill('#cmdInput', solveCliPrompt(desc));
      await page.click('#execBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'hardcore_reset')).toBe(true);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].wave).toBe(10);
    expect(completes[0].total_waves).toBe(10);
  });
});

test.describe('Stage 2 E2E: 10-класс_углубленный / Урок 18', () => {
  test('Level 1 completes 3 classification phases with valid telemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/18/level1`);

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 3`);
      const items = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#itemsContainer .item-card')).map(el => ({
          id: el.id,
          cat: el.dataset.cat
        }))
      );
      for (const item of items) {
        await page.click(`#${item.id}`);
        await page.click(`.bucket[data-category="${item.cat}"]`);
      }
      await page.click('#checkBtn');
      if (phase < 3) {
        await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase + 1} из 3`, { timeout: 5000 });
      }
    }

    await expect(page.locator('#victoryBox')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(3);
    expect(completes[0].total_stages).toBe(3);
  });

  test('Level 2 enforces Anti-Paste and completes 5 anti-phishing phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/18/level2`);

    await page.evaluate(() => {
      const inp = document.getElementById('domainInput');
      inp.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#pasteNotice')).toBeVisible();

    const domainMap = {
      'Госуслуги': 'gosuslugi.ru',
      'ФНС (Налоговая)': 'nalog.gov.ru',
      'Социальный фонд (СФР)': 'sfr.gov.ru',
      'Росреестр': 'rosreestr.gov.ru',
      'Сайт Администрации Санкт-Петербурга': 'gov.spb.ru',
      'Здоровье петербуржца (Запись к врачу)': 'gorzdrav.spb.ru',
      'Сбербанк Онлайн': 'online.sberbank.ru',
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

    await expect(page.locator('#successArea')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(5);
    expect(completes[0].total_stages).toBe(5);
  });

  test('Level 3 ESB Pipeline Router: intro screen, error reset, and 10 waves solved via grid', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/18/level3`);

    await expect(page.locator('#startBtn')).toBeVisible();
    await page.click('#startBtn');

    // Trigger intentional bad launch (grid starts scrambled) -> reset to wave 1
    await page.click('#launchBtn');
    await expect(page.locator('#failOverlay')).toBeVisible();
    await expect(page.locator('#failOverlay')).toBeHidden({ timeout: 5000 });

    const intentTargetMap = {
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

    // Solve 10 waves by reading tile glyphs and rotating each cell along a valid path
    for (let w = 1; w <= 10; w++) {
      await expect(page.locator(`text=ВОЛНА ${w} / 10`)).toBeVisible();

      const boardInfo = await page.evaluate(() => {
        const intent = document.querySelector('.bg-dark.border-info .fs-5').textContent.trim();
        let entryRow = 0;
        document.querySelectorAll('.col-3').forEach((el) => {
          // handled below via exit-row & entry text
        });
        const rows = Array.from(document.querySelectorAll('.d-flex.flex-column.gap-2.mb-3 > .row'));
        const exits = [];
        const grid = [];
        rows.forEach((rowEl, r) => {
          if (rowEl.textContent.includes('ВХОД ▶')) entryRow = r;
          exits.push(rowEl.querySelector(`[data-exit-row="${r}"]`).textContent.trim());
          const rowCells = [];
          for (let c = 0; c < 3; c++) {
            const btn = rowEl.querySelector(`button[data-row="${r}"][data-col="${c}"]`);
            rowCells.push({
              glyph: btn.textContent.trim(),
              blocked: btn.dataset.blocked === '1'
            });
          }
          grid.push(rowCells);
        });
        return { intent, entryRow, exits, grid };
      });

      const targetAgency = intentTargetMap[boardInfo.intent];
      const targetRow = boardInfo.exits.indexOf(targetAgency);
      expect(targetRow).toBeGreaterThanOrEqual(0);

      // Compute rotations needed in JS using same pipe geometry
      const clicksNeeded = solvePipeGrid(boardInfo.grid, boardInfo.entryRow, targetRow);
      for (const [r, c, times] of clicksNeeded) {
        const btn = page.locator(`button[data-row="${r}"][data-col="${c}"]`);
        for (let k = 0; k < times; k++) {
          await btn.click();
        }
      }

      await page.click('#launchBtn');
    }

    await expect(page.locator('#successArea')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    expect(events.some(e => e.action_type === 'hardcore_reset')).toBe(true);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].wave).toBe(10);
    expect(completes[0].total_waves).toBe(10);
  });
});

function solvePipeGrid(grid, entryRow, targetRow) {
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const DR = { N: -1, E: 0, S: 1, W: 0 };
  const DC = { N: 0, E: 1, S: 0, W: -1 };
  const DIRS = ['N', 'E', 'S', 'W'];

  function glyphOpenings(glyph) {
    switch (glyph) {
      case '━━': return ['W', 'E'];
      case '┃': return ['N', 'S'];
      case '┏━': return ['E', 'S'];
      case '━┓': return ['S', 'W'];
      case '━┛': return ['N', 'W'];
      case '┗━': return ['N', 'E'];
      default: return [];
    }
  }

  function isStraight(glyph) {
    return glyph === '━━' || glyph === '┃';
  }

  function rotateDir(d, k) {
    return DIRS[(DIRS.indexOf(d) + k) % 4];
  }

  // BFS over simple paths from (entryRow, 0, 'W') to exit E at (targetRow, 2)
  const queue = [{ r: entryRow, c: 0, inDir: 'W', visited: new Set(['' + entryRow + ',0']), steps: [] }];
  while (queue.length > 0) {
    const cur = queue.shift();
    const cell = grid[cur.r][cur.c];
    if (cell.blocked) continue;
    const baseOps = glyphOpenings(cell.glyph);
    const maxRot = isStraight(cell.glyph) ? 2 : 4;
    for (let rot = 0; rot < maxRot; rot++) {
      const ops = baseOps.map(d => rotateDir(d, rot));
      if (!ops.includes(cur.inDir)) continue;
      const outDir = ops.find(d => d !== cur.inDir);
      if (cur.c === 2 && outDir === 'E') {
        if (cur.r === targetRow) {
          return [...cur.steps, [cur.r, cur.c, rot]];
        }
        continue;
      }
      const nr = cur.r + DR[outDir];
      const nc = cur.c + DC[outDir];
      if (nr < 0 || nr >= 3 || nc < 0 || nc >= 3) continue;
      const key = `${nr},${nc}`;
      if (cur.visited.has(key)) continue;
      const nextVis = new Set(cur.visited);
      nextVis.add(key);
      queue.push({
        r: nr,
        c: nc,
        inDir: OPP[outDir],
        visited: nextVis,
        steps: [...cur.steps, [cur.r, cur.c, rot]]
      });
    }
  }
  throw new Error('No pipe path found in grid');
}

test.describe('Stage 2 E2E: 10-класс_углубленный / Урок 19 telemetry standardization', () => {
  test('Level 1 & Level 3 emit LMSTelemetry start_time, time_spent_sec, stage/wave and Level 3 has intro', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/19/level1`);
    await page.waitForSelector('text=Multiple failed SSH login attempts');

    // Should NOT emit premature in_progress before user interaction
    await page.waitForTimeout(300);
    let events = await getCapturedEvents(page);
    expect(events.length).toBe(0);

    // Wrong command emits hardcore_reset with start_time, time_spent_sec, stage, total_stages
    await page.fill('#cmd-input', 'ufw deny from 1.1.1.1');
    await page.press('#cmd-input', 'Enter');
    events = await getCapturedEvents(page);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const failEvt = events.find(e => e.action_type === 'hardcore_reset');
    expect(failEvt).toBeDefined();
    expect(typeof failEvt.start_time).toBe('string');
    expect(typeof failEvt.time_spent_sec).toBe('number');
    expect(failEvt.stage).toBe(1);
    expect(failEvt.total_stages).toBe(3);

    // Check Level 3 intro and telemetry
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc(COURSE)}/19/level3`);
    await expect(page.locator('#start-overlay')).toBeVisible();
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.click('#start-btn');
    await expect(page.locator('#start-overlay')).toBeHidden();

    events = await getCapturedEvents(page);
    const progEvt = events.find(e => e.action_type === 'in_progress');
    expect(progEvt).toBeDefined();
    expect(typeof progEvt.start_time).toBe('string');
    expect(progEvt.wave).toBe(1);
    expect(progEvt.total_waves).toBe(6);
  });
});
