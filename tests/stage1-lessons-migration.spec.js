import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:4321';

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

test.describe('Stage 1 Migration: Lesson shells, Legacy HTML removal & Historical DB APIs', () => {
  test('All 3 lesson shells load Astro task routes (not .html) and expose Logo-Storm terms', async ({ page }) => {
    const targets = [
      { course: '7-класс', id: '4' },
      { course: '9-класс', id: '6' },
      { course: '10-класс_базовый', id: '6' }
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

  test('Historical DB compatibility: /api/progress, /api/matrix-progress, /api/teacher/stats preserve student records', async ({ request }) => {
    const p7 = await request.get(`${BASE}/api/progress?firstName=${enc('Аркадий')}&lastName=${enc('Шаманский')}&className=${enc('7-класс')}&lessonPrefix=${enc('Урок 4')}&courseSlug=${enc('7-класс')}&lessonId=4`);
    expect(p7.ok()).toBe(true);
    const p7Json = await p7.json();
    expect(p7Json.isNormalCompleted).toBe(true);
    expect(p7Json.unlockedNormal).toBe(4);

    const p9 = await request.get(`${BASE}/api/progress?firstName=${enc('Константин')}&lastName=${enc('Ященко')}&className=${enc('9-класс')}&lessonPrefix=${enc('Урок 6')}&courseSlug=${enc('9-класс')}&lessonId=6`);
    expect(p9.ok()).toBe(true);
    const p9Json = await p9.json();
    expect(p9Json.isNormalCompleted).toBe(true);
    expect(p9Json.unlockedNormal).toBe(4);

    const p10 = await request.get(`${BASE}/api/progress?firstName=${enc('Лилиана')}&lastName=${enc('Боровкова')}&className=${enc('8-класс')}&lessonPrefix=${enc('Урок 6')}&courseSlug=${enc('10-класс_базовый')}&lessonId=6`);
    expect(p10.ok()).toBe(true);
    const p10Json = await p10.json();
    expect(p10Json.unlockedNormal).toBeGreaterThanOrEqual(2);

    const m7 = await request.get(`${BASE}/api/matrix-progress?firstName=${enc('Аркадий')}&lastName=${enc('Шаманский')}&className=${enc('7-класс')}`);
    expect(m7.ok()).toBe(true);
    const m7Json = await m7.json();
    expect(m7Json.lessons['7-класс::4']?.completed).toBe(true);

    const m9 = await request.get(`${BASE}/api/matrix-progress?firstName=${enc('Константин')}&lastName=${enc('Ященко')}&className=${enc('9-класс')}`);
    expect(m9.ok()).toBe(true);
    const m9Json = await m9.json();
    expect(m9Json.lessons['9-класс::6']?.completed).toBe(true);

    for (const [course, lesson] of [['7-класс', '4'], ['9-класс', '6'], ['10-класс_базовый', '6']]) {
      const sResp = await request.get(`${BASE}/api/teacher/stats?course=${enc(course)}&lesson=${lesson}&date=all`);
      expect(sResp.ok()).toBe(true);
      const sJson = await sResp.json();
      expect(sJson.success).toBe(true);
      expect(Array.isArray(sJson.students)).toBe(true);
      expect(sJson.students.length).toBeGreaterThan(0);
      expect(sJson.kpi.totalStudents).toBeGreaterThan(0);
    }
  });
});

test.describe('Stage 1 E2E: 7-класс / Урок 4', () => {
  test('Level 1 completes 3 mouse-manipulation phases and emits valid telemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc('7-класс')}/4/level1`);

    const extMap = {
      'Текстовый документ': ['.txt', '.docx', '.rtf'],
      'Графический файл': ['.png', '.jpg', '.bmp'],
      'Звуковой файл': ['.mp3', '.wav'],
      'Видеофайл': ['.mp4', '.avi'],
      'Исполняемая программа': ['.exe']
    };

    // Phase 1: match file types to extensions
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 1 / 3');
    const slotButtons = page.locator('#slots-container button[data-slot-id]');
    const slotCount = await slotButtons.count();
    for (let i = 0; i < slotCount; i++) {
      const slotBtn = slotButtons.nth(i);
      const titleText = await slotBtn.innerText();
      const matchedType = Object.keys(extMap).find(k => titleText.includes(k));
      const validExts = extMap[matchedType];
      const paletteBtns = page.locator('#palette-container button[data-token-id]');
      const pCount = await paletteBtns.count();
      for (let j = 0; j < pCount; j++) {
        const tokText = (await paletteBtns.nth(j).innerText()).trim();
        if (validExts.includes(tokText)) {
          await paletteBtns.nth(j).click();
          await slotBtn.click();
          break;
        }
      }
    }
    await page.click('#check-btn');
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 2 / 3', { timeout: 5000 });

    // Phase 2: assemble path in order from description
    const desc2 = await page.locator('#task-desc').innerText();
    const match2 = desc2.match(/Иерархия:\s*Диск\s+([A-Z]:)\s*→\s*([^\.]+)\.\s*Расставьте/);
    const fileMatch2 = desc2.match(/Файл\s+«([^»]+)»/);
    const expectedParts = [
      match2[1].trim(),
      ...match2[2].split('→').map(s => s.trim()),
      fileMatch2[1].trim()
    ];
    for (let i = 0; i < expectedParts.length; i++) {
      await page.locator('#palette-container button[data-token-id]', { hasText: expectedParts[i] }).first().click();
      await page.locator('#slots-container button[data-slot-id]').nth(i).click();
    }
    await page.click('#check-btn');
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 3 / 3', { timeout: 5000 });

    // Phase 3: classify file operations
    const opRules = [
      { key: 'Копирование', match: 'точная копия' },
      { key: 'Перемещение', match: 'исчез из исходной' },
      { key: 'Переименование', match: 'Изменено имя' },
      { key: 'Удаление', match: 'Корзину' },
      { key: 'Создание', match: 'новый пустой' }
    ];
    const slots3 = page.locator('#slots-container button[data-slot-id]');
    const s3Count = await slots3.count();
    for (let i = 0; i < s3Count; i++) {
      const txt = await slots3.nth(i).innerText();
      const rule = opRules.find(r => txt.includes(r.match));
      await page.locator('#palette-container button[data-token-id]', { hasText: rule.key }).first().click();
      await slots3.nth(i).click();
    }
    await page.click('#check-btn');
    await expect(page.locator('#victory-box')).toBeVisible({ timeout: 5000 });

    const events = await getCapturedEvents(page);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].mission_name).toMatch(/^Урок 4/);
    expect(completes[0].stage).toBe(3);
    expect(completes[0].total_stages).toBe(3);
    expect(events.some(e => e.action_type === 'in_progress' && e.stage === 2)).toBe(true);
    expect(events.some(e => e.action_type === 'in_progress' && e.stage === 3)).toBe(true);
  });

  test('Level 2 enforces Anti-Paste and completes 5 phases', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc('7-класс')}/4/level2`);

    // Anti-paste check
    await page.locator('#ans-input').evaluate((el) => {
      const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    });
    await expect(page.locator('#paste-notice')).toBeVisible();

    // Phase 1: extension
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 1 / 5');
    const p1Text = await page.locator('#task-prompt').innerText();
    const extByType = {
      'Текстовый документ': 'txt',
      'Графический файл': 'png',
      'Звуковой файл': 'mp3',
      'Видеофайл': 'mp4',
      'Исполняемая программа': 'exe'
    };
    const p1Type = Object.keys(extByType).find(k => p1Text.includes(k));
    await page.fill('#ans-input', extByType[p1Type]);
    await page.click('#check-btn');

    // Phase 2: extract filename
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 2 / 5', { timeout: 5000 });
    const path2 = (await page.locator('#code-box').innerText()).trim();
    const file2 = path2.split('\\').pop();
    await page.fill('#ans-input', file2);
    await page.click('#check-btn');

    // Phase 3: parent folder
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 3 / 5', { timeout: 5000 });
    const path3 = (await page.locator('#code-box').innerText()).trim();
    const parts3 = path3.split('\\');
    await page.fill('#ans-input', parts3[parts3.length - 2]);
    await page.click('#check-btn');

    // Phase 4: modify parallel path
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 4 / 5', { timeout: 5000 });
    const prompt4 = await page.locator('#task-prompt').innerText();
    const path4 = (await page.locator('#code-box').innerText()).trim();
    const m4 = prompt4.match(/из папки\s+(\S+)\s+в параллельную папку\s+(\S+)/);
    const newPath4 = path4.replace(`\\${m4[1]}\\`, `\\${m4[2]}\\`);
    await page.fill('#ans-input', newPath4);
    await page.click('#check-btn');

    // Phase 5: terminology
    await expect(page.locator('#phase-title')).toHaveText('ФАЗА 5 / 5', { timeout: 5000 });
    const prompt5 = await page.locator('#task-prompt').innerText();
    let ans5 = 'перемещение';
    if (prompt5.includes('точная копия')) ans5 = 'копирование';
    else if (prompt5.includes('изменения имени')) ans5 = 'переименование';
    else if (prompt5.includes('Корзина')) ans5 = 'удаление';
    await page.fill('#ans-input', ans5);
    await page.click('#check-btn');

    await expect(page.locator('#victory-box')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    const complete = events.find(e => e.action_type === 'level_complete');
    expect(complete).toBeTruthy();
    expect(complete.stage).toBe(5);
    expect(complete.total_stages).toBe(5);
  });

  test('Level 3 has intro screen, completes 10 waves and prevents duplicate level_complete', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc('7-класс')}/4/level3`);

    await expect(page.locator('#start-btn')).toBeVisible();
    expect((await getCapturedEvents(page)).length).toBe(0);

    await page.click('#start-btn');

    const validExtPairs = {
      'Текстовый документ': ['.txt', '.docx', '.rtf'],
      'Графический файл': ['.png', '.jpg', '.bmp'],
      'Звуковой файл': ['.mp3', '.wav'],
      'Видеофайл': ['.mp4', '.avi']
    };

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('text=ВОЛНА: ' + w + ' / 10')).toBeVisible({ timeout: 5000 });
      const nodeBtns = page.locator('button.btn-outline-danger');
      const count = await nodeBtns.count();
      let pickIdx = 0;

      for (let i = 0; i < count; i++) {
        const txt = await nodeBtns.nth(i).innerText();
        if (w <= 3) {
          if (txt.includes('/') || !/^[A-Z]:\\/.test(txt.replace(/^\d+\s*/, '').trim())) {
            pickIdx = i;
            break;
          }
        } else if (w <= 6) {
          const m = txt.match(/(Текстовый документ|Графический файл|Звуковой файл|Видеофайл)\s*→\s*(\S+)/);
          if (m) {
            const ext = '.' + m[2].split('.').pop();
            if (!validExtPairs[m[1]].includes(ext)) {
              pickIdx = i;
              break;
            }
          }
        } else {
          const isValidLog =
            (txt.includes('КОПИРОВАНИЕ') && txt.includes('A:') && txt.match(/ПОСЛЕ:\s*\[A:\s*[^—\]]+,\s*B:\s*[^—\]]+/)) ||
            (txt.includes('ПЕРЕМЕЩЕНИЕ') && txt.match(/ПОСЛЕ:\s*\[A:\s*—,\s*B:\s*[^—\]]+/)) ||
            (txt.includes('ПЕРЕИМЕНОВАНИЕ') && txt.includes('old.txt')) ||
            (txt.includes('УДАЛЕНИЕ') && txt.includes('Корзина'));
          if (!isValidLog) {
            pickIdx = i;
            break;
          }
        }
      }
      await nodeBtns.nth(pickIdx).click();
    }

    await expect(page.locator('text=СИСТЕМА ЗАЩИЩЕНА')).toBeVisible({ timeout: 5000 });
    const events = await getCapturedEvents(page);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].wave).toBe(10);
    expect(completes[0].total_waves).toBe(10);
  });
});

test.describe('Stage 1 E2E: 9-класс / Урок 6 (L1 & L2) & 10-класс_базовый / Урок 6 (L1-L3 + AFK)', () => {
  test('9-класс/6 Level 1 & Level 2 complete with valid telemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(`${BASE}/tasks/${enc('9-класс')}/6/level1`);

    const dbTerms = [
      ['Фишинг', 'поддельных сайтов'],
      ['Спам', 'рекламных сообщений'],
      ['Брандмауэр', 'несанкционированного доступа'],
      ['Антивирус', 'вредоносного ПО'],
      ['HTTP', 'без встроенного шифрования'],
      ['HTTPS', 'поддерживающий защищённое'],
      ['IP-адрес', 'сетевой адрес узла'],
      ['Провайдер', 'доступ к услугам интернета'],
      ['Браузер', 'просмотра веб-страниц'],
      ['URL', 'Единый указатель ресурса'],
      ['Троян', 'маскирующаяся под легитимное'],
      ['DDoS-атака', 'перегрузки запросами'],
      ['Доменное имя', 'символьное имя'],
      ['Кибербуллинг', 'травля и оскорбления'],
      ['Цифровой след', 'оставляемой им в сети'],
      ['Куки (Cookies)', 'хранимые в браузере'],
      ['2FA (Двухфакторная)', 'разными способами подтверждения'],
      ['VPN', 'зашифрованного подключения'],
      ['Malware', 'нанесения вреда'],
      ['SSL/TLS', 'Криптографические протоколы']
    ];

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phase-indicator')).toHaveText(`${phase} / 3`, { timeout: 5000 });
      const leftBtns = page.locator('#left-col button');
      const rightBtns = page.locator('#right-col button');
      for (let i = 0; i < 4; i++) {
        const term = (await leftBtns.nth(i).innerText()).trim();
        const pair = dbTerms.find(p => p[0] === term);
        await leftBtns.nth(i).click();
        await rightBtns.filter({ hasText: pair[1] }).first().click();
      }
    }
    await expect(page.locator('#victory-box')).toBeVisible({ timeout: 5000 });
    const ev1 = await getCapturedEvents(page);
    expect(ev1.filter(e => e.action_type === 'level_complete').length).toBe(1);
    expect(ev1.find(e => e.action_type === 'level_complete').stage).toBe(3);

    // Level 2
    await page.goto(`${BASE}/tasks/${enc('9-класс')}/6/level2`);
    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phase-indicator')).toHaveText(`${phase} / 5`, { timeout: 5000 });
      const txt = await page.locator('#task-text').innerText();
      const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
      const getVal = (prefix) => {
        const line = lines.find(l => l.includes(prefix));
        return line ? line.split(':').pop().trim() : '';
      };

      let url = '';
      if (phase === 1) {
        const d = getVal('Домен 2-го уровня');
        const t = getVal('Домен верхнего уровня');
        const proto = getVal('Протокол').includes('защищ') ? 'https' : 'http';
        url = `${proto}://${d}.${t}`;
      } else if (phase === 2) {
        const d = getVal('Основной домен');
        const sub = getVal('Домен 3-го уровня');
        const proto = getVal('Протокол').includes('защищ') ? 'https' : 'http';
        url = `${proto}://${sub}.${d}`;
      } else if (phase === 3) {
        const d = getVal('Сервер');
        const port = getVal('Нестандартный порт');
        const dir = getVal('Вложенный каталог');
        url = `http://${d}:${port}/${dir}`;
      } else if (phase === 4) {
        const d = getVal('Хост');
        const file = getVal('Запрашиваемый файл');
        const paramLine = lines.find(l => l.includes('GET-параметр'));
        const idVal = paramLine.match(/(\d+)/)[1];
        url = `https://${d}/${file}?id=${idVal}`;
      } else {
        const d = getVal('Доменное имя');
        const dir1 = getVal('Родительский каталог');
        const dir2 = getVal('Вложенный подкаталог');
        url = `ftp://${d}/${dir1}/${dir2}`;
      }
      await page.fill('#answer-input', url);
      await page.click('#submit-btn');
    }
    await expect(page.locator('#victory-box')).toBeVisible({ timeout: 5000 });
    const ev2 = await getCapturedEvents(page);
    expect(ev2.filter(e => e.action_type === 'level_complete').length).toBe(1);
    expect(ev2.find(e => e.action_type === 'level_complete').stage).toBe(5);
  });

  test('10-класс_базовый/6 Level 1, Level 2 and Level 3 (intro + AFK guard + 10 waves)', async ({ page }) => {
    await attachTelemetrySpy(page);

    // Level 1
    await page.goto(`${BASE}/tasks/${enc('10-класс_базовый')}/6/level1`);
    const slotKeyMap = {
      proprietary: ['продаётся за деньги', 'коммерческой тайной', 'Microsoft Office', 'дизассемблировать', 'штрафу до 5 млн', 'EULA'],
      shareware: ['пробный период', 'заблокирована до оплаты', 'WinRAR', 'купить ключ', 'только для ознакомления'],
      freeware: ['нельзя продавать', 'запрещает изменять код', 'Google Chrome', 'бесконечно долго', 'от своего имени'],
      opensource: ['код открыт', 'LibreOffice', 'GNU GPL', 'Сообщество программистов', 'любое количество компьютеров']
    };

    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phaseTitle')).toContainText(`Этап ${phase} из 3`, { timeout: 5000 });
      const cards = page.locator('#sourceList .item-card');
      for (let i = 0; i < 4; i++) {
        const firstCard = cards.first();
        const text = await firstCard.innerText();
        const slotId = Object.keys(slotKeyMap).find(k => slotKeyMap[k].some(sub => text.includes(sub)));
        await firstCard.click();
        await page.locator(`#targetSlots .slot[data-slot-id="${slotId}"]`).click();
      }
      await page.click('#checkBtn');
    }
    await expect(page.locator('#victoryBox')).toBeVisible({ timeout: 5000 });

    // Level 2
    await page.goto(`${BASE}/tasks/${enc('10-класс_базовый')}/6/level2`);
    const qAnswers = [
      ['ВКонтакте', '272'],
      ['университета', '272'],
      ['модификацию', '272'],
      ['шифровальщика', '273'],
      ['флешек', '273'],
      ['уничтожения данных', '273'],
      ['пациентов', '274'],
      ['по неосторожности', '274'],
      ['водоканала', '274.1'],
      ['государственного банка', '274.1'],
      ['100 тысяч', '146'],
      ['3ds Max', '146'],
      ['код скрыт', 'freeware'],
      ['от своего имени', 'freeware'],
      ['30 дней', 'shareware'],
      ['trial-периода', 'shareware'],
      ['можно менять', 'opensource'],
      ['сообществом', 'opensource'],
      ['собственностью компании', 'proprietary'],
      ['Microsoft Office', 'proprietary'],
      ['Договор между', 'лицензия']
    ];
    for (let phase = 1; phase <= 5; phase++) {
      await expect(page.locator('#phaseTitle')).toHaveText(`Этап ${phase} из 5`, { timeout: 5000 });
      const q = await page.locator('#questionText').innerText();
      const match = qAnswers.find(([needle]) => q.includes(needle));
      await page.fill('#answerInput', match[1]);
      await page.click('#checkBtn');
    }
    await expect(page.locator('#successArea')).toBeVisible({ timeout: 5000 });

    // Level 3: Intro screen visible, no telemetry before clicking Start
    await page.clock.install();
    await page.goto(`${BASE}/tasks/${enc('10-класс_базовый')}/6/level3`);
    await expect(page.locator('#startBtn')).toBeVisible();
    expect((await getCapturedEvents(page)).length).toBe(0);

    await page.click('#startBtn');
    await expect(page.locator('text=ДЕЛО 1 ИЗ 10')).toBeVisible();

    // Verify AFK wave-1 protection: fast-forward 2 wave-1 timeouts without activity
    await page.clock.runFor(13000);
    await page.clock.runFor(2000);
    await page.clock.runFor(13000);
    await expect(page.locator('#lms-afk-retry-btn')).toBeVisible({ timeout: 5000 });
    await page.click('#lms-afk-retry-btn');
    await expect(page.locator('#lms-afk-retry-btn')).not.toBeVisible();

    // Complete all 10 waves
    const guiltyNeedles = [
      'торрент', 'троян', 'подобрал пароль', 'забыл обновить', 'продавать её от своего имени',
      'кейлоггер', 'активатором', 'DDoS', 'выложил его образ', 'взлома Wi-Fi', 'удаляет системные'
    ];
    for (let w = 1; w <= 10; w++) {
      await expect(page.locator(`text=ДЕЛО ${w} ИЗ 10`)).toBeVisible({ timeout: 5000 });
      const caseText = await page.locator('.bg-dark.border.border-secondary.text-white').innerText();
      const isGuilty = guiltyNeedles.some(n => caseText.includes(n));
      await page.click(isGuilty ? 'button:has-text("ВИНОВЕН")' : 'button:has-text("ОПРАВДАН")');
    }

    await expect(page.locator('#successArea')).toBeVisible({ timeout: 5000 });
    const ev3 = await getCapturedEvents(page);
    const complete3 = ev3.filter(e => e.action_type === 'level_complete');
    expect(complete3.length).toBe(1);
    expect(complete3[0].mission_name).toMatch(/^Урок 6/);
    expect(complete3[0].wave).toBe(10);
    expect(complete3[0].total_waves).toBe(10);
  });
});
