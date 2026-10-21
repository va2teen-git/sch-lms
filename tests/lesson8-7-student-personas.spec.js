import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

// Dictionary of all possible payloads in Level 3 Arcade
const TARGET_MAP = {
  '«В одном килобайте ровно 1024 байта»': 'true',
  '«Монитор является устройством ввода текстовой информации»': 'false',
  '«Сколько бит содержится в половине байта?»': 'not_statement',
  '«19 ≥ 19»': 'true',
  '«45 < 20»': 'false',
  '«x > 100»': 'not_statement',
  '«101₂ = 5₁₀»': 'true',
  '«1111₂ = 12₁₀»': 'false',
  '«Переведите число 25 в шестнадцатеричную систему!»': 'not_statement',
  '«Операционная система управляет файловой структурой носителя»': 'true',
  '«Клавиатура преобразует электрический ток в звуковые волны»': 'false',
  '«Язык программирования Python гораздо приятнее, чем C++»': 'not_statement',
  '«2⁴ = 16»': 'true',
  '«Число 33 делится нацело на 5»': 'false',
  '«То, что утверждает данный сетевой пакет, является ложью»': 'not_statement',
  '«(15 > 10) И (8 является чётным числом)»': 'true',
  '«(15 > 10) И (9 является чётным числом)»': 'false',
  '«(x > 5) И (x < 15)»': 'not_statement',
  '«(5 > 10) ИЛИ (16 кратно 4)»': 'true',
  '«(5 > 10) ИЛИ (15 кратно 4)»': 'false',
  '«Не выключайте питание компьютера во время обновления системы!»': 'not_statement',
  '«Символ "A" в кодировке ASCII имеет код 65, а "B" — код 66»': 'true',
  '«Число 100 в десятичной системе записывается как 100 в двоичной»': 'false',
  '«k кратно 7 без остатка»': 'not_statement'
};

// Helper to solve 3 phases of Level 1
async function solveLevel1(frameLocator) {
  for (let phase = 1; phase <= 3; phase++) {
    await expect(frameLocator.locator('#phase-badge')).toContainText(`Шаг ${phase} из 3`);
    const pool = frameLocator.locator('#cards-pool');
    await expect(pool).toBeVisible();

    let count = await pool.locator('.card-token').count();
    while (count > 0) {
      const card = pool.locator('.card-token').first();
      const cat = await card.getAttribute('data-category');
      await card.click();

      let targetHeader = '#bucket-true .card-header';
      if (cat === 'false') targetHeader = '#bucket-false .card-header';
      else if (cat === 'not_statement') targetHeader = '#bucket-not-statement .card-header';

      await frameLocator.locator(targetHeader).click();
      count = await pool.locator('.card-token').count();
    }

    const verifyBtn = frameLocator.locator('#verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();
  }
}

// Helper to solve 5 phases of Level 2
async function solveLevel2(frameLocator) {
  // Phase 1: Number comparison
  await expect(frameLocator.locator('#phase1')).toBeVisible();
  const p1Param = await frameLocator.locator('#p1-param').innerText();
  const p1Stmt = await frameLocator.locator('#p1-statement').innerText();
  const val1 = parseInt(p1Param.replace('x =', '').trim(), 10);
  const m1 = p1Stmt.match(/x\s*(>|<|≥|≤|==|≠)\s*(\d+)/);
  let ans1 = false;
  if (m1[1] === '>') ans1 = val1 > parseInt(m1[2], 10);
  else if (m1[1] === '<') ans1 = val1 < parseInt(m1[2], 10);
  else if (m1[1] === '≥') ans1 = val1 >= parseInt(m1[2], 10);
  else if (m1[1] === '≤') ans1 = val1 <= parseInt(m1[2], 10);
  else if (m1[1] === '==') ans1 = val1 === parseInt(m1[2], 10);
  else if (m1[1] === '≠') ans1 = val1 !== parseInt(m1[2], 10);
  await frameLocator.locator('#p1-input').fill(ans1 ? '1' : '0');
  await frameLocator.locator('#p1-btn').click();

  // Phase 2: Divisibility and Parity
  await expect(frameLocator.locator('#phase2')).toBeVisible();
  const p2Stmt = await frameLocator.locator('#p2-statement').innerText();
  let ans2 = false;
  if (p2Stmt.includes('делится нацело на')) {
    const m = p2Stmt.match(/Число\s*(\d+)\s*делится нацело на\s*(\d+)/);
    ans2 = (parseInt(m[1], 10) % parseInt(m[2], 10) === 0);
  } else if (p2Stmt.includes('нечётным') || p2Stmt.includes('нечетным')) {
    const m = p2Stmt.match(/Число\s*(\d+)/);
    ans2 = (parseInt(m[1], 10) % 2 !== 0);
  } else if (p2Stmt.includes('чётным') || p2Stmt.includes('четным')) {
    const m = p2Stmt.match(/Число\s*(\d+)/);
    ans2 = (parseInt(m[1], 10) % 2 === 0);
  }
  await frameLocator.locator('#p2-input').fill(ans2 ? '1' : '0');
  await frameLocator.locator('#p2-btn').click();

  // Phase 3: Number systems
  await expect(frameLocator.locator('#phase3')).toBeVisible();
  const p3Stmt = await frameLocator.locator('#p3-statement').innerText();
  let ans3 = false;
  if (p3Stmt.includes('₂ == ') && p3Stmt.includes('₁₀')) {
    const m = p3Stmt.match(/([01]+)₂\s*==\s*(\d+)₁₀/);
    ans3 = (parseInt(m[1], 2) === parseInt(m[2], 10));
  } else if (p3Stmt.includes('₁₆ == ') && p3Stmt.includes('₁₀')) {
    const m = p3Stmt.match(/([0-9A-F]+)₁₆\s*==\s*(\d+)₁₀/);
    ans3 = (parseInt(m[1], 16) === parseInt(m[2], 10));
  } else if (p3Stmt.includes('₂ == ') && p3Stmt.includes('₁₆')) {
    const m = p3Stmt.match(/([01]+)₂\s*==\s*([0-9A-F]+)₁₆/);
    ans3 = (parseInt(m[1], 2) === parseInt(m[2], 16));
  }
  await frameLocator.locator('#p3-input').fill(ans3 ? '1' : '0');
  await frameLocator.locator('#p3-btn').click();

  // Phase 4: Compound logical conditions
  await expect(frameLocator.locator('#phase4')).toBeVisible();
  const p4Params = await frameLocator.locator('#p4-params').innerText();
  const p4Stmt = await frameLocator.locator('#p4-statement').innerText();
  const m4Params = p4Params.match(/порт\s*=\s*(\d+),\s*размер\s*=\s*(\d+)/);
  const port = parseInt(m4Params[1], 10);
  const size = parseInt(m4Params[2], 10);
  const c1 = port > 1024;
  const c2 = size < 1500;
  const ans4 = p4Stmt.includes(' ИЛИ ') ? (c1 || c2) : (c1 && c2);
  await frameLocator.locator('#p4-input').fill(ans4 ? '1' : '0');
  await frameLocator.locator('#p4-btn').click();

  // Phase 5: Boundary value calculation
  await expect(frameLocator.locator('#phase5')).toBeVisible();
  const p5Stmt = await frameLocator.locator('#p5-statement').innerText();
  const p5Instr = await frameLocator.locator('#p5-target-instruction').innerText();
  const isMax = p5Instr.includes('НАИБОЛЬШЕЕ');
  let ans5 = 0;
  if (isMax) {
    const m = p5Stmt.match(/\(x\s*>\s*(\d+)\)\s*И\s*\(x\s*(<|≤)\s*(\d+)\)/);
    const isStrictB = (m[2] === '<');
    const b = parseInt(m[3], 10);
    ans5 = isStrictB ? (b - 1) : b;
  } else {
    const m = p5Stmt.match(/\(x\s*(>|≥)\s*(\d+)\)\s*И\s*\(x\s*<\s*(\d+)\)/);
    const isStrictA = (m[1] === '>');
    const a = parseInt(m[2], 10);
    ans5 = isStrictA ? (a + 1) : a;
  }
  await frameLocator.locator('#p5-input').fill(ans5.toString());
  await frameLocator.locator('#p5-btn').click();
}

async function alignRouterAndLaunch(frameLocator, target) {
  const getActiveTerminal = async () => {
    if (await frameLocator.locator('#terminal-true.bg-success').count() > 0) return 'true';
    if (await frameLocator.locator('#terminal-false.bg-danger').count() > 0) return 'false';
    if (await frameLocator.locator('#terminal-not-statement.bg-warning').count() > 0) return 'not_statement';
    return null;
  };

  let active = await getActiveTerminal();

  if (target === 'not_statement') {
    if (active !== 'not_statement') {
      await frameLocator.locator('#router-node-1').click();
    }
  } else {
    if (active === 'not_statement') {
      await frameLocator.locator('#router-node-1').click();
    }
    active = await getActiveTerminal();
    if (active !== target) {
      await frameLocator.locator('#router-node-2').click();
    }
  }

  await frameLocator.locator('#launch-packet-btn').click();
}

// Helper to solve 8 waves of Level 3 Arcade
async function solveLevel3(frameLocator) {
  await expect(frameLocator.locator('#start-btn')).toBeVisible();
  await frameLocator.locator('#start-btn').click();

  for (let wave = 1; wave <= 8; wave++) {
    await expect(frameLocator.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 8`);
    const payloadEl = frameLocator.locator('.fs-4.text-light.fw-bold.my-1');
    await expect(payloadEl).toBeVisible();
    const payload = (await payloadEl.innerText()).trim();

    const target = TARGET_MAP[payload];
    expect(target).toBeDefined();

    await alignRouterAndLaunch(frameLocator, target);
    await new Promise(r => setTimeout(r, 120));
  }
}

test.describe('Grade 8 Lesson 7: Logical Statements (Student Personas & End-to-End Walkthrough)', () => {

  // =========================================================================
  // 1. LEVEL 1: Persona Simulations
  // =========================================================================
  test.describe('Level 1: Manipulations & Bucket Sorting', () => {

    test('Persona: NOVICE — misclassifies card, handles feedback alert, resets and passes', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1');

      await expect(page.locator('#phase-badge')).toContainText('Шаг 1 из 3');
      const pool = page.locator('#cards-pool');
      await expect(pool).toBeVisible();

      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          // Put all cards into the wrong bucket
          const cardsCount = await pool.locator('.card-token').count();
          for (let i = 0; i < cardsCount; i++) {
            const card = pool.locator('.card-token').first();
            await card.click();
            await page.locator('#bucket-false .card-header').click();
          }
          await page.locator('#verify-btn').click();
        },
        assertErrorStateFn: async () => {
          await expect(page.locator('#feedback-box')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          // Wait for procedural regeneration
          await page.waitForTimeout(1600);
          await expect(page.locator('#feedback-box')).toBeHidden();

          let count = await pool.locator('.card-token').count();
          while (count > 0) {
            const card = pool.locator('.card-token').first();
            const cat = await card.getAttribute('data-category');
            await card.click();

            let targetHeader = '#bucket-true .card-header';
            if (cat === 'false') targetHeader = '#bucket-false .card-header';
            else if (cat === 'not_statement') targetHeader = '#bucket-not-statement .card-header';

            await page.locator(targetHeader).click();
            count = await pool.locator('.card-token').count();
          }
          await page.locator('#verify-btn').click();
        },
        assertSuccessStateFn: async () => {
          await expect(page.locator('#phase-badge')).toContainText('Шаг 2 из 3');
        }
      });

      sim.assertCleanSession();
    });

    test('Persona: CHAOS — stress tests reset pool button and empty clicks', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1');

      // Click bucket headers with no cards selected
      await page.locator('#bucket-true .card-header').click();
      await page.locator('#bucket-false .card-header').click();
      await page.locator('#bucket-not-statement .card-header').click();

      // Spam reset button
      await sim.simulateSpamClick(page.locator('#reset-pool-btn'), 5);

      // Verify buttons still responsive and tokens count is maintained
      const tokenCount = await page.locator('#cards-pool .card-token').count();
      expect(tokenCount).toBeGreaterThanOrEqual(4);

      sim.assertCleanSession();
    });

  });

  // =========================================================================
  // 2. LEVEL 2: Persona Simulations
  // =========================================================================
  test.describe('Level 2: Analytical Calculation & Keyboard Input', () => {

    test('Persona: NOVICE — submits invalid value, handles error feedback, recovers and solves', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2');

      await expect(page.locator('#phase1')).toBeVisible();

      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          await sim.humanType(page.locator('#p1-input'), '999');
          await page.locator('#p1-btn').click();
        },
        assertErrorStateFn: async () => {
          await expect(page.locator('#p1-feedback')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          await page.waitForTimeout(1600);
          await expect(page.locator('#p1-feedback')).toBeHidden();

          const p1Param = await page.locator('#p1-param').innerText();
          const p1Stmt = await page.locator('#p1-statement').innerText();
          const val1 = parseInt(p1Param.replace('x =', '').trim(), 10);
          const m1 = p1Stmt.match(/x\s*(>|<|≥|≤|==|≠)\s*(\d+)/);
          let ans1 = false;
          if (m1[1] === '>') ans1 = val1 > parseInt(m1[2], 10);
          else if (m1[1] === '<') ans1 = val1 < parseInt(m1[2], 10);
          else if (m1[1] === '≥') ans1 = val1 >= parseInt(m1[2], 10);
          else if (m1[1] === '≤') ans1 = val1 <= parseInt(m1[2], 10);
          else if (m1[1] === '==') ans1 = val1 === parseInt(m1[2], 10);
          else if (m1[1] === '≠') ans1 = val1 !== parseInt(m1[2], 10);

          await sim.humanType(page.locator('#p1-input'), ans1 ? '1' : '0');
          await page.locator('#p1-btn').click();
        },
        assertSuccessStateFn: async () => {
          await expect(page.locator('#phase1')).toBeHidden();
          await expect(page.locator('#phase2')).toBeVisible();
        }
      });

      sim.assertCleanSession();
    });

    test('Persona: CARELESS — submits values with accidental whitespace and uses Enter key', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2');

      await expect(page.locator('#phase1')).toBeVisible();

      const p1Param = await page.locator('#p1-param').innerText();
      const p1Stmt = await page.locator('#p1-statement').innerText();
      const val1 = parseInt(p1Param.replace('x =', '').trim(), 10);
      const m1 = p1Stmt.match(/x\s*(>|<|≥|≤|==|≠)\s*(\d+)/);
      let ans1 = false;
      if (m1[1] === '>') ans1 = val1 > parseInt(m1[2], 10);
      else if (m1[1] === '<') ans1 = val1 < parseInt(m1[2], 10);
      else if (m1[1] === '≥') ans1 = val1 >= parseInt(m1[2], 10);
      else if (m1[1] === '≤') ans1 = val1 <= parseInt(m1[2], 10);
      else if (m1[1] === '==') ans1 = val1 === parseInt(m1[2], 10);
      else if (m1[1] === '≠') ans1 = val1 !== parseInt(m1[2], 10);

      // Careless student types answer with accidental spaces and presses Enter
      const answerStr = ans1 ? '  1  ' : '  0  ';
      const input = page.locator('#p1-input');
      await input.fill(answerStr);
      await input.press('Enter');

      await expect(page.locator('#phase1')).toBeHidden();
      await expect(page.locator('#phase2')).toBeVisible();

      sim.assertCleanSession();
    });

    test('Persona: CHAOS — verifies anti-paste protection on inputs', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2');

      await sim.attemptProhibitedPaste(page.locator('#p1-input'), '1');
      sim.assertCleanSession();
    });

  });

  // =========================================================================
  // 3. LEVEL 3: Persona Simulations
  // =========================================================================
  test.describe('Level 3: WAF Real-Time Arcade', () => {

    test('Persona: NOVICE — makes error on Wave 1, triggers critical failure and resets to Wave 1', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3');

      await expect(page.locator('#start-btn')).toBeVisible();
      await page.locator('#start-btn').click();
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8');

      const payloadEl = page.locator('.fs-4.text-light.fw-bold.my-1');
      await expect(payloadEl).toBeVisible();
      const payload = (await payloadEl.innerText()).trim();
      const target = TARGET_MAP[payload];
      expect(target).toBeDefined();

      // Novice intentionally routes to the wrong terminal
      const wrongTarget = target === 'true' ? 'false' : 'true';
      await alignRouterAndLaunch(page, wrongTarget);

      // Hardcore routing collision screen should appear
      await expect(page.locator('text=CRITICAL ROUTING COLLISION')).toBeVisible();

      // Wait for auto reset back to Wave 1
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8', { timeout: 6000 });

      sim.assertCleanSession();
    });

    test('Persona: DILIGENT — accurately classifies 8 waves and completes Level 3', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
      await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3');

      await solveLevel3(page);

      // Verify victory screen
      await expect(page.locator('text=ШЛЮЗ WAF УСПЕШНО ОТРАЗИЛ ВСЕ 8 ВОЛН АТАКИ')).toBeVisible();

      sim.assertCleanSession();
    });

  });

  // =========================================================================
  // 4. END-TO-END LESSON WALKTHROUGH (Сквозное прохождение урока учеником)
  // =========================================================================
  test.describe('End-to-End Lesson Progression: Host Page Walkthrough', () => {

    test('Persona: DILIGENT — completes full lesson (Levels 1 → 2 → 3), unlocks tabs, completes lesson and writes telemetry', async ({ page }) => {
      const sim = new StudentSimulator(page, {
        persona: LearnerPersona.DILIGENT,
        courseSlug: '8-класс',
        lessonId: '7',
        levelNumber: 1
      });

      const testRunId = Date.now();
      const studentFirst = `Алексей_${testRunId}`;
      const studentLast = `Смирнов_${testRunId}`;

      // 1. Setup Student Session in LocalStorage
      await page.addInitScript(({ fName, lName }) => {
        localStorage.setItem('student_firstName', fName);
        localStorage.setItem('student_lastName', lName);
        localStorage.setItem('student_class', '8-класс');
      }, { fName: studentFirst, lName: studentLast });

      // 2. Open Lesson Host Page
      await page.goto('/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');

      // Verify tabs initial state: Level 1 active, Level 2 and Level 3 locked with lock icon
      const tab1 = page.locator('.tab-btn').nth(0);
      const tab2 = page.locator('.tab-btn').nth(1);
      const tab3 = page.locator('.tab-btn').nth(2);

      await expect(tab1).toContainText('Уровень 1');
      await expect(tab2).toContainText('🔒');
      await expect(tab3).toContainText('🔒');

      // Verify theory is loaded on the left side
      await expect(page.locator('h1[title*="Урок 7"]')).toContainText('Урок 7');
      await expect(page.getByText('Основоположником традиционной (формальной) логики')).toBeVisible();

      // =======================================================================
      // STEP 1: Complete Level 1 in iframe-1
      // =======================================================================
      const frame1 = page.frameLocator('#iframe-1');
      await solveLevel1(frame1);

      // Verify Level 2 tab is automatically unlocked and becomes active
      await expect(tab2).not.toContainText('🔒', { timeout: 10000 });
      await expect(page.locator('#iframe-2')).toBeVisible();

      // =======================================================================
      // STEP 2: Complete Level 2 in iframe-2
      // =======================================================================
      const frame2 = page.frameLocator('#iframe-2');

      // Record Difficulty curve benchmarks
      sim.recordPhaseDifficulty(1, { title: 'Сравнение чисел (x > threshold)', depth: 1, memory: 1, scaffolding: 1 });
      sim.recordPhaseDifficulty(2, { title: 'Делимость и четность целых чисел', depth: 2, memory: 1 });
      sim.recordPhaseDifficulty(3, { title: 'Системы счисления (101_2 == 5_10)', depth: 2, memory: 2 });
      sim.recordPhaseDifficulty(4, { title: 'Составные условия (порт > 1024 ИЛИ размер < 1500)', depth: 2, memory: 2, scaffolding: 1 });
      sim.recordPhaseDifficulty(5, { title: 'Аналитический синтез границ (min/max x)', depth: 3, memory: 2, inversion: 1 });

      sim.assertDifficultyCompliance({ sawtooth: true, corridor: true, noFakeDifficulty: true });

      await solveLevel2(frame2);

      // Verify Level 3 tab is automatically unlocked and becomes active
      await expect(tab3).not.toContainText('🔒', { timeout: 10000 });
      await expect(page.locator('#iframe-3')).toBeVisible();

      // =======================================================================
      // STEP 3: Complete Level 3 in iframe-3
      // =======================================================================
      const frame3 = page.frameLocator('#iframe-3');
      await solveLevel3(frame3);

      // =======================================================================
      // STEP 4: Full Lesson Completion Screen & Telemetry Verification
      // =======================================================================
      // Lesson content should hide and completion screen should display
      await expect(page.locator('#lesson-content')).toBeHidden({ timeout: 10000 });
      const completionScreen = page.locator('#completion-screen');
      await expect(completionScreen).toBeVisible();
      await expect(page.locator('#completion-title')).toContainText('🎉 Урок пройден!');
      await expect(page.locator('#reset-lesson-btn')).toBeVisible();

      // Verify SQLite Telemetry records
      const db = new sqlite3('telemetry.db');
      const rows = db.prepare(`
        SELECT mission_name, action_type, success, status 
        FROM telemetry 
        WHERE (student_class = '8-класс' OR class_name = '8-класс') 
          AND first_name = ?
          AND action_type = 'level_complete'
        ORDER BY id DESC LIMIT 5
      `).all(studentFirst);

      expect(rows.length).toBeGreaterThanOrEqual(3);
      const completedLevels = rows.map(r => r.mission_name);
      expect(completedLevels.some(m => m.includes('Уровень 1'))).toBe(true);
      expect(completedLevels.some(m => m.includes('Уровень 2'))).toBe(true);
      expect(completedLevels.some(m => m.includes('Уровень 3'))).toBe(true);

      // Render Cognitive Report
      sim.benchmarker.renderReport('GRADE 8 LESSON 7 — E2E LESSON WALKTHROUGH COMPLETE');

      sim.assertCleanSession();
    });

  });

});
