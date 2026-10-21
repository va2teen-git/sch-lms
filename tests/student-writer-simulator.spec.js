import { test, expect } from '@playwright/test';
import { StudentWriterSimulator } from './student-writer-simulator.js';
import { LearnerPersona } from './student-simulator.js';

test.describe('StudentWriterSimulator Engine Unit & Integration Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Open Grade 7 Lesson 22 Level 3 which contains LibreOffice Writer emulator
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level3');
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();
  });

  test('Persona: NOVICE — tests typing and caret management in editor', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.NOVICE });

    // Type text into editor
    await writerSim.typeInEditor('Текстовый процессор LibreOffice Writer', { clearFirst: true });
    const html = await writerSim.getEditorHTML();
    expect(html).toContain('Текстовый процессор');

    writerSim.assertCleanSession();
  });

  test('Persona: DILIGENT — selects text and applies bold formatting via toolbar', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.DILIGENT });

    await writerSim.typeInEditor('Информатика изучает методы обработки информации.', { clearFirst: true });

    // Select the word "Информатика"
    await writerSim.selectText('Информатика');

    // Click bold button
    await writerSim.toggleStyle('bold');

    const html = await writerSim.getEditorHTML();
    // Must contain <b> or <strong> around "Информатика"
    expect(html).toMatch(/<(b|strong)>Информатика<\/(b|strong)>/);

    writerSim.assertCleanSession();
  });

  test('Persona: DILIGENT — types formula with Zero Caret Trapping (H₂O)', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.DILIGENT });

    // Clean start
    await writerSim.clearDocument();

    // Type formula H₂O: H, sub 2, O
    await writerSim.typeFormulaWithSubSup('H', '2', 'sub', 'O');

    const html = await writerSim.getCleanEditorHTML();
    // Expect H<sub>2</sub>O where 'O' is OUTSIDE the sub tag
    expect(html).toContain('<sub>2</sub>');
    expect(html).not.toContain('<sub>2O</sub>');
    expect(html).toContain('O');

    writerSim.assertCleanSession();
  });

  test('Persona: CHAOS — spam clicks formatting buttons on empty selection without crashing', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.CHAOS });

    await writerSim.focusEditor();

    // Rapid spam clicks on toolbar buttons
    await writerSim.simulateSpamClick(page.locator('#btn-bold'), 4);
    await writerSim.simulateSpamClick(page.locator('#btn-italic'), 4);
    await writerSim.simulateSpamClick(page.locator('#btn-sub'), 4);

    // Editor must still be operational
    await writerSim.typeInEditor('Стабильность');
    const html = await writerSim.getEditorHTML();
    expect(html).toContain('Стабильность');

    writerSim.assertCleanSession();
  });

  test('Persona: NOVICE — detects space indent shortcut trap in text', async ({ page }) => {
    const writerSim = new StudentWriterSimulator(page, { persona: LearnerPersona.NOVICE });

    // Clear and type with 5 spaces
    await writerSim.typeInEditor('', { clearFirst: true });
    await writerSim.simulateSpaceIndentTrap('Этот абзац начинается с пяти пробелов.');

    const html = await writerSim.getEditorHTML();
    // Check that spaces or &nbsp; exist before the text
    expect(html).toMatch(/(&nbsp;|\s){4,}/);

    writerSim.assertCleanSession();
  });
});
