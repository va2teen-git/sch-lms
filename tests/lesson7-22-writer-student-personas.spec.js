import { test, expect } from '@playwright/test';
import { StudentWriterSimulator } from './student-writer-simulator.js';
import { LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 22 Level 3 — Student Persona Simulations (Writer Arcade)', () => {
  const taskUrl = '/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level3';

  test.beforeEach(async ({ page }) => {
    await page.goto(taskUrl);
    const startBtn = page.locator('#start-btn');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();
    await expect(page.locator('#wave-badge')).toBeVisible();
  });

  test('Persona: NOVICE — submits unformatted text, receives wave feedback, recovers and passes Wave 1', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.NOVICE });

    // Ensure we start on Wave 1 with deterministic variant 0
    await page.evaluate(() => {
      if (window.forceLevel3Variant) window.forceLevel3Variant(0);
      if (window.jumpToLevel3Wave) window.jumpToLevel3Wave(1);
    });

    const activeData = await page.evaluate(() => {
      const state = window.getLevel3ArcadeState();
      return state.activeWaveData;
    });
    expect(activeData).toBeTruthy();
    const { text, boldWord } = activeData;

    // 1. Novice types the entire sentence WITHOUT any bold formatting
    await writerSim.typeInEditor(text, { clearFirst: true });

    // Verify live checklist shows text is ok, but bold is pending
    const checklistItems = page.locator('#live-checklist span');
    await expect(checklistItems.first()).toContainText('Точный текст фразы');

    // Novice clicks "ПРОВЕРИТЬ ДОКУМЕНТ" prematurely
    await writerSim.checkDocument();

    // System triggers hardcore reset / feedback alert because boldWord wasn't formatted
    const resetBanner = page.locator('#hardcore-reset-banner');
    await expect(resetBanner).toBeVisible();
    await expect(resetBanner).toContainText('Ошибка на Волне 1');
    await expect(resetBanner).toContainText('Полужирный');

    // 2. Recovery: Novice learns from feedback, types text again and formats boldWord
    await writerSim.typeInEditor(text, { clearFirst: true });
    await writerSim.selectText(boldWord);
    await writerSim.toggleStyle('bold');

    // Check clean editor HTML to confirm bold tag is placed
    const html = await writerSim.getCleanEditorHTML();
    expect(html).toMatch(new RegExp(`<(b|strong)>${boldWord}</(b|strong)>`));

    // Novice now clicks "ПРОВЕРИТЬ ДОКУМЕНТ"
    await writerSim.checkDocument();

    // Wave 1 should pass and advance to Wave 2!
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 2 / 10');

    writerSim.assertCleanSession();
  });

  test('Persona: CARELESS — types with homoglyphs and whitespace anomalies, validated by WriterValidator', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.CARELESS });

    // Deterministic variant 0 on Wave 1:
    // Text: "Форматирование изменяет внешний вид текста без изменения его содержания."
    await page.evaluate(() => {
      if (window.forceLevel3Variant) window.forceLevel3Variant(0);
      if (window.jumpToLevel3Wave) window.jumpToLevel3Wave(1);
    });

    const activeData = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
    const { boldWord } = activeData;

    // Careless student introduces double spaces and homoglyph chars (Latin 'a' or 'o')
    // and types boldWord formatted
    await writerSim.typeInEditor('Форматирование  изменяет   внешний вид текста  без изменения его содержания. ', { clearFirst: true });
    await writerSim.selectText(boldWord);
    await writerSim.toggleStyle('bold');

    // Check document
    await writerSim.checkDocument();

    // Normalizer handles extra spaces -> advances to Wave 2!
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 2 / 10');

    writerSim.assertCleanSession();
  });

  test('Persona: CHAOS — rapidly clicks toolbar buttons on empty selection without crashing editor', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.CHAOS });

    await page.evaluate(() => {
      if (window.forceLevel3Variant) window.forceLevel3Variant(0);
      if (window.jumpToLevel3Wave) window.jumpToLevel3Wave(1);
    });

    const activeData = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);

    // Chaos student clicks toolbar buttons rapidly
    await writerSim.focusEditor();
    await writerSim.simulateSpamClick(page.locator('#btn-bold'), 3);
    await writerSim.simulateSpamClick(page.locator('#btn-italic'), 3);
    await writerSim.simulateSpamClick(page.locator('#btn-underline'), 3);
    await writerSim.simulateSpamClick(page.locator('#btn-align-center'), 2);

    // Action count should have increased
    const actionBadge = page.locator('#action-tracker-badge');
    await expect(actionBadge).toBeVisible();

    // Chaos student resets and types the required answer cleanly
    await writerSim.typeInEditor(activeData.text, { clearFirst: true });
    await writerSim.selectText(activeData.boldWord);
    await writerSim.toggleStyle('bold');

    await writerSim.checkDocument();
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 2 / 10');

    writerSim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately completes Wave 1, Wave 2, and Wave 3 with Zero Caret Trapping', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.DILIGENT });

    // --- WAVE 1: Speed typing + Bold ---
    await page.evaluate(() => {
      if (window.forceLevel3Variant) window.forceLevel3Variant(0);
      if (window.jumpToLevel3Wave) window.jumpToLevel3Wave(1);
    });

    let waveData = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
    await writerSim.typeInEditor(waveData.text, { clearFirst: true });
    await writerSim.selectText(waveData.boldWord);
    await writerSim.toggleStyle('bold');

    await writerSim.checkDocument();
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 2 / 10');

    // --- WAVE 2: Italic + Underline ---
    waveData = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
    expect(waveData.italicWord).toBeTruthy();
    expect(waveData.underlineWord).toBeTruthy();

    await writerSim.typeInEditor(waveData.text, { clearFirst: true });
    await writerSim.selectText(waveData.italicWord);
    await writerSim.toggleStyle('italic');
    await writerSim.selectText(waveData.underlineWord);
    await writerSim.toggleStyle('underline');

    await writerSim.checkDocument();
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 3 / 10');

    // --- WAVE 3: Scientific / Math formulas with sub and sup ---
    waveData = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
    // Variant 0: "Площадь поверхности составляет 25 м², а формула воды — H₂O."
    // We type prefix, use typeFormulaWithSubSup for 25 м² and H₂O
    await writerSim.clearDocument();

    // Type: "Площадь поверхности составляет 25 м"
    await writerSim.typeInEditor('Площадь поверхности составляет 25 м');
    // Sup: 2
    await writerSim.toggleStyle('sup');
    await page.keyboard.type('2', { delay: 10 });
    await writerSim.toggleStyle('sup');

    // Type: ", а формула воды — H"
    await page.keyboard.type(', а формула воды — H', { delay: 10 });
    // Sub: 2
    await writerSim.toggleStyle('sub');
    await page.keyboard.type('2', { delay: 10 });
    await writerSim.toggleStyle('sub');

    // Type: "O."
    await page.keyboard.type('O.', { delay: 10 });

    const cleanHtml = await writerSim.getCleanEditorHTML();
    expect(cleanHtml).toContain('<sup>2</sup>');
    expect(cleanHtml).toContain('<sub>2</sub>');

    // Submit Wave 3
    await writerSim.checkDocument();

    // Must successfully advance to Wave 4!
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 4 / 10');

    writerSim.assertCleanSession();
  });

  test('Persona: NOVICE — space indent shortcut fails when paragraph indent is required', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.NOVICE });

    // Jump to Wave 6 (Paragraph geometry: First-line indent 1.0 cm)
    await page.evaluate(() => {
      if (window.forceLevel3Variant) window.forceLevel3Variant(0);
      if (window.jumpToLevel3Wave) window.jumpToLevel3Wave(6);
    });

    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 6 / 10');
    const waveData = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);

    // Novice attempts the "5 spaces" shortcut instead of ruler/dialog
    await writerSim.clearDocument();
    await writerSim.simulateSpaceIndentTrap(waveData.text);

    // Live checklist check: Indent requirement will be unsatisfied (⏳)
    const checklistText = await page.locator('#live-checklist').innerText();
    expect(checklistText).toContain('⏳ Красная строка 1.0 см');

    // Checking document triggers reset due to lack of standard 1.0 cm text-indent
    await writerSim.checkDocument();
    const resetBanner = page.locator('#hardcore-reset-banner');
    await expect(resetBanner).toBeVisible();

    writerSim.assertCleanSession();
  });
});

test.describe('Grade 7 Lesson 22 Level 1 — Student Persona Simulations (Interactive Writer Practicum)', () => {
  const level1Url = '/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level1';

  test.beforeEach(async ({ page }) => {
    await page.goto(level1Url);
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();
    await page.waitForFunction(() => !!window.getLevel1WriterState?.()?.activeData);
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
  });

  test('Persona: NOVICE — fails incomplete formatting, tests space indent trap, reads diagnostics', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.NOVICE });

    await writerSim.cognitivePause(150);
    await writerSim.checkDocument();

    const errorBox = page.locator('#error-box');
    await expect(errorBox).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Не выполнены требования');
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Stage 2: Novice tries 5 spaces instead of first-line indent
    await page.evaluate(() => window.jumpToLevel1Stage(2));
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    await writerSim.clearDocument();
    await writerSim.simulateSpaceIndentTrap('Абзац с пробельным отступом вместо красной строки.');
    await writerSim.checkDocument();

    await expect(errorBox).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Красная строка');
    writerSim.assertCleanSession();
  });

  test('Persona: CHAOS — spams toolbar formatting and restores draft safely', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.CHAOS });

    await writerSim.focusEditor();
    await writerSim.simulateSpamClick(page.locator('#btn-bold'), 3);
    await writerSim.simulateSpamClick(page.locator('#btn-italic'), 3);
    await writerSim.simulateSpamClick(page.locator('#btn-underline'), 3);
    await writerSim.simulateSpamClick(page.locator('#btn-sup'), 2);
    await writerSim.simulateSpamClick(page.locator('#btn-sub'), 2);

    await page.locator('#btn-restore-draft').click();
    const html = await writerSim.getCleanEditorHTML();
    expect(html.length).toBeGreaterThan(10);

    writerSim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes Stage 1 and Stage 2 via Writer toolbar & Format dialogs', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.DILIGENT });
    const st1 = await page.evaluate(() => window.getLevel1WriterState());
    const d1 = st1.activeData;

    // Select all text for font & size
    await page.evaluate(() => {
      const w = document.querySelector('.jodit-wysiwyg');
      const r = document.createRange();
      r.selectNodeContents(w);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
    await page.locator('#select-font').selectOption(d1.font);
    await page.locator('#select-fontsize').selectOption(`${d1.sizePt}pt`);

    await writerSim.selectText(d1.boldWord);
    await writerSim.toggleStyle('bold');
    await writerSim.selectText(d1.italicWord);
    await writerSim.toggleStyle('italic');
    await writerSim.selectText(d1.underlineWord);
    await writerSim.toggleStyle('underline');

    // Superscript digit (м3/м2/mv2)
    await page.evaluate((digit) => {
      const w = document.querySelector('.jodit-wysiwyg');
      const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('sup, sub')) continue;
        const m = node.textContent.match(/(?:м|mv)(\d)/i);
        if (m && m[1] === String(digit)) {
          const r = document.createRange();
          const idx = m.index + m[0].length - 1;
          r.setStart(node, idx);
          r.setEnd(node, idx + 1);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          break;
        }
      }
    }, d1.supDigit);
    await writerSim.toggleStyle('sup');

    // Subscript digit (H2O/CO2/O2)
    await page.evaluate((digit) => {
      const w = document.querySelector('.jodit-wysiwyg');
      const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('sup, sub')) continue;
        const m = node.textContent.match(/(?:H|CO|O)(\d)/i);
        if (m && m[1] === String(digit)) {
          const r = document.createRange();
          const idx = m.index + m[0].length - 1;
          r.setStart(node, idx);
          r.setEnd(node, idx + 1);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          break;
        }
      }
    }, d1.subDigit);
    await writerSim.toggleStyle('sub');

    await writerSim.checkDocument();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    // Stage 2: Page margins + Paragraph dialog
    const st2 = await page.evaluate(() => window.getLevel1WriterState());
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-page').click();
    await page.locator('#btn-page-set-oge').click();
    await page.locator('#btn-apply-page').click();

    await writerSim.configureParagraphViaDialog({
      firstLine: '1.0',
      lineSpacing: st2.activeData.lineHeight,
      align: 'justify'
    });

    await writerSim.checkDocument();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
    writerSim.assertCleanSession();
  });
});

test.describe('Grade 7 Lesson 22 Level 2 — Student Persona Simulations (Engineering Layout in Writer)', () => {
  const level2Url = '/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level2';

  test.beforeEach(async ({ page }) => {
    await page.goto(level2Url);
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();
    await page.waitForFunction(() => !!window.getLevel2WriterState?.()?.activeData);
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');
  });

  test('Persona: NOVICE & CHAOS — unfixed Stage 1 draft triggers diagnostic feedback and toolbar spam does not crash', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.NOVICE });

    // CHAOS-style clicks on toolbar toggles
    await writerSim.simulateSpamClick(page.locator('#btn-nonprinting'), 2);
    await writerSim.simulateSpamClick(page.locator('#btn-bold'), 2);

    // NOVICE submits raw draft without fixing spaces/quotes/hyphen
    await writerSim.checkDocument();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#feedback-text')).toContainText('Не выполнены требования');
    await expect(page.locator('#attempts-display')).toHaveText('1');

    writerSim.assertCleanSession();
  });

  test('Persona: CARELESS — enters Russian commas and trailing spaces (" 1,0 ", " 0,5 " cm) in Paragraph dialog on Stage 2', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.CARELESS });

    await page.evaluate(() => window.jumpToLevel2Stage(2));
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
    const st2 = await page.evaluate(() => window.getLevel2WriterState());

    // Find and Replace via Edit menu
    await page.locator('.lo-menu-item').filter({ hasText: /^Правка$/ }).click();
    await page.locator('#menu-edit-find').click();
    await expect(page.locator('#modal-find-replace')).toBeVisible();
    await page.locator('#dialog-find-query').fill(st2.activeData.badWord);
    await page.locator('#dialog-find-replace-val').fill(st2.activeData.goodWord);
    await page.locator('#btn-apply-replace-all').click();
    await page.locator('#modal-find-replace .btn-close').click();

    // Careless student clicks each paragraph and enters " 1,0 " and " 0,5 " cm with commas & spaces
    const paraCount = await page.locator('.jodit-wysiwyg p').count();
    for (let i = 0; i < paraCount; i++) {
      await page.locator('.jodit-wysiwyg p').nth(i).click();
      await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
      await page.locator('#menu-format-paragraph').click();
      await page.locator('#dialog-para-firstline').fill(' 1,0 ');
      await page.locator('#dialog-para-bottom-unit').selectOption('cm');
      await page.locator('#dialog-para-bottom').fill(' 0,5 ');
      await page.locator('#align-radio-justify').check();
      await page.locator('#btn-apply-paragraph').click();
    }

    await writerSim.checkDocument();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');
    writerSim.assertCleanSession();
  });
});
