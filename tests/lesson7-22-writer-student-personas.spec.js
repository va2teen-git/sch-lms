import { test, expect } from '@playwright/test';
import { StudentWriterSimulator } from './student-writer-simulator.js';
import { LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 22 Level 3 — Student Persona Simulations (Writer Arcade)', () => {
  const taskUrl = '/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level3';

  test.beforeEach(async ({ page }) => {
    await page.goto(taskUrl);
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
