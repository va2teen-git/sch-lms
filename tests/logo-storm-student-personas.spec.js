import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Logo-Storm Keyboard Trainer: Digital Student Personas Suite', () => {
  const lessonUrl = '/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27';

  test('Persona: NOVICE — launches Logo-Storm, toggles sound, reviews terms and closes via Esc', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(lessonUrl);

    // Verify toggle button is visible and active
    const sprintBtn = page.locator('#sprint-toggle');
    await expect(sprintBtn).toBeVisible();
    await expect(sprintBtn).toContainText('Лого-Шторм');

    // Novice takes pause to read button title
    await sim.cognitivePause();
    await sprintBtn.click();

    // Verify overlay appears
    const overlay = page.locator('#sprint-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#sprint-terms-count')).toHaveText('7');

    // Novice verifies terminal history window and Top-10 leaderboard are present (definition card removed)
    await expect(page.locator('#sprint-def-card')).toHaveCount(0);
    await expect(page.locator('#sprint-terminal-history')).toBeVisible();
    await expect(page.locator('#sprint-history-log')).toBeVisible();
    await expect(page.locator('#sprint-history-entries .sprint-history-entry')).toHaveCount(0);
    await expect(page.locator('#sprint-def-step')).toHaveText('1 / 7');
    await expect(page.locator('#sprint-leaderboard-sidebar')).toBeVisible();

    // Novice tests sound toggle
    const soundToggle = page.locator('#sprint-sound-toggle');
    await soundToggle.click();
    await expect(page.locator('#sprint-sound-icon')).toHaveText('🔇');
    await soundToggle.click();
    await expect(page.locator('#sprint-sound-icon')).toHaveText('🔊');

    // Novice closes overlay via Esc
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — attempts clipboard paste and non-linear keys, anti-cheat blocks corruption', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(lessonUrl);

    await page.locator('#sprint-toggle').click();
    await expect(page.locator('#sprint-overlay')).toBeVisible();

    // Chaos persona tries pasting huge unicode block
    await page.evaluate(() => {
      const overlay = document.getElementById('sprint-overlay');
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      overlay.dispatchEvent(pasteEvent);
    });

    // Chaos persona presses modifier keys and special keys
    await page.keyboard.press('Shift');
    await page.keyboard.press('Control');
    await page.keyboard.press('Alt');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('F5');

    // Text progress must remain 0
    await expect(page.locator('#sprint-chars-progress')).toHaveText('0');
    await expect(page.locator('#sprint-errors-count')).toHaveText('0');

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — triggers Stop-on-Error with wrong keystrokes, caret blocks advancement', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(lessonUrl);

    await page.locator('#sprint-toggle').click();
    await expect(page.locator('#sprint-overlay')).toBeVisible();

    // Get expected first char
    const firstChar = await page.locator('#sprint-text-display span[data-idx="0"]').textContent();
    // Choose an intentionally incorrect character
    const wrongChar = firstChar === 'z' ? 'a' : 'z';

    // Type wrong character
    await page.locator('#sprint-hidden-input').pressSequentially(wrongChar);

    // Errors count must increase to 1, progress stays 0, terminal live input stays empty
    await expect(page.locator('#sprint-errors-count')).toHaveText('1');
    await expect(page.locator('#sprint-chars-progress')).toHaveText('0');
    await expect(page.locator('#sprint-history-current')).toHaveText('');

    // Now type correct first character
    await page.locator('#sprint-hidden-input').pressSequentially(firstChar);

    // Progress moves to 1 and terminal live input shows typed character
    await expect(page.locator('#sprint-chars-progress')).toHaveText('1');
    await expect(page.locator('#sprint-history-current')).toHaveText(firstChar);
    await expect(page.locator('#sprint-errors-count')).toHaveText('1');

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately finishes Logo-Storm sprint, verifies HUD metrics and saves telemetry', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto(lessonUrl);

    // Set student credentials in localStorage
    await page.evaluate(() => {
      localStorage.setItem('student_firstName', 'Тест-Алиса');
      localStorage.setItem('student_lastName', 'Тест-Спринтер');
      localStorage.setItem('student_class', '10-класс_углубленный');
    });

    await page.locator('#sprint-toggle').click();
    const overlay = page.locator('#sprint-overlay');
    await expect(overlay).toBeVisible();

    // Diligent types terms one by one until sprint finishes
    const totalTerms = Number(await page.locator('#sprint-terms-count').textContent());
    expect(totalTerms).toBeGreaterThan(0);

    for (let t = 0; t < totalTerms; t++) {
      // Verify step counter in HUD updates with each active term
      await expect(page.locator('#sprint-def-step')).toHaveText(`${t + 1} / ${totalTerms}`);

      // Read current term sentence directly from spans preserving whitespace and type sequentially
      const termSentence = await page.evaluate(() => 
        Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
      );
      expect(termSentence.length).toBeGreaterThan(0);

      await page.locator('#sprint-hidden-input').pressSequentially(termSentence);

      const historyEntries = page.locator('#sprint-history-entries .sprint-history-entry');
      await expect(historyEntries).toHaveCount(t + 1);
      await expect(historyEntries.nth(t).locator('.sprint-history-text')).toHaveText(termSentence);
    }

    // Terminal history shows session completion state
    await expect(page.locator('#sprint-history-done')).toBeVisible();
    await expect(page.locator('#sprint-history-entries .sprint-history-entry')).toHaveCount(totalTerms);

    // Results card must appear
    const resultsCard = page.locator('#sprint-results-card');
    await expect(resultsCard).toBeVisible();
    await expect(page.locator('#sprint-play-arena')).toBeHidden();

    // Verify victory metrics in Russian
    await expect(page.locator('#sprint-res-acc')).toHaveText('100%');
    await expect(page.locator('#sprint-res-errors')).toHaveText('0');
    const cpmText = await page.locator('#sprint-res-cpm').textContent();
    expect(cpmText).toContain('зн/мин');

    // Telemetry is saved automatically upon completion: success banner appears without manual clicks
    await expect(page.locator('#sprint-telemetry-banner')).toBeVisible();
    await expect(page.locator('#sprint-telemetry-msg')).toContainText('Результат автоматически зафиксирован');

    // Manual submission button sprint-save-btn is no longer present
    await expect(page.locator('#sprint-save-btn')).toHaveCount(0);

    // Verify test persona is strictly filtered out from Top 10 leaderboard
    await page.waitForTimeout(500);
    const leaderboardText = await page.locator('#sprint-leaderboard-list').textContent();
    expect(leaderboardText).not.toContain('Тест');
    expect(leaderboardText).not.toContain('Алиса');

    // Verify retry clears terminal history and resets step counter
    await page.locator('#sprint-retry-btn').click();
    await expect(page.locator('#sprint-history-entries .sprint-history-entry')).toHaveCount(0);
    await expect(page.locator('#sprint-history-current')).toHaveText('');
    await expect(page.locator('#sprint-def-step')).toHaveText(`1 / ${totalTerms}`);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — Grade 9 Lesson 8: streams terms one by one, recording terminal history', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/lesson/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8');

    await page.locator('#sprint-toggle').click();
    const overlay = page.locator('#sprint-overlay');
    await expect(overlay).toBeVisible();

    // Lesson 8 has 12 terms
    await expect(page.locator('#sprint-terms-count')).toHaveText('12');

    // First term is rendered in arena and terminal history window is visible
    await expect(page.locator('#sprint-terminal-history')).toBeVisible();
    await expect(page.locator('#sprint-def-step')).toHaveText('1 / 12');

    // Arena only contains the single active term's text
    const term1Text = await page.evaluate(() => 
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(term1Text.trim().length).toBeGreaterThan(0);

    // Type the first term sentence
    await page.locator('#sprint-hidden-input').pressSequentially(term1Text);

    // Immediately switches to term 2 and logs term 1 in terminal history
    await expect(page.locator('#sprint-def-step')).toHaveText('2 / 12');
    const historyEntries = page.locator('#sprint-history-entries .sprint-history-entry');
    await expect(historyEntries).toHaveCount(1);
    await expect(historyEntries.first().locator('.sprint-history-text')).toHaveText(term1Text);

    const term2Text = await page.evaluate(() => 
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(term2Text.trim().length).toBeGreaterThan(0);
    expect(term2Text).not.toBe(term1Text);

    sim.assertCleanSession();
  });

  test('Persona: NOVICE — Grade 11 Basic Lesson 9: launches Logo-Storm, verifies 18 terms and terminal HUD', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9');

    const sprintBtn = page.locator('#sprint-toggle');
    await expect(sprintBtn).toBeVisible();
    await expect(sprintBtn).not.toBeDisabled();

    await sprintBtn.click();
    const overlay = page.locator('#sprint-overlay');
    await expect(overlay).toBeVisible();

    // Lesson 9 has 18 terms
    await expect(page.locator('#sprint-terms-count')).toHaveText('18');
    await expect(page.locator('#sprint-def-step')).toHaveText('1 / 18');
    await expect(page.locator('#sprint-terminal-history')).toBeVisible();

    const firstTermText = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(firstTermText.trim().length).toBeGreaterThan(0);

    // Close via Esc
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();

    sim.assertCleanSession();
  });

  test('Persona: NOVICE — Grade 7 all existing lessons (4, 5, 6, 7, 8, 9, 22): launch Logo-Storm and verify term counts & terminal HUD', async ({ page }) => {
    const expectedLessons = [
      { id: '4', count: 9 },
      { id: '5', count: 9 },
      { id: '6', count: 10 },
      { id: '7', count: 12 },
      { id: '8', count: 12 },
      { id: '9', count: 12 },
      { id: '22', count: 10 }
    ];

    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });

    for (const lesson of expectedLessons) {
      await page.goto(`/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/${lesson.id}`);

      const sprintBtn = page.locator('#sprint-toggle');
      await expect(sprintBtn).toBeVisible();
      await expect(sprintBtn).not.toBeDisabled();

      await sprintBtn.click();
      const overlay = page.locator('#sprint-overlay');
      await expect(overlay).toBeVisible();

      await expect(page.locator('#sprint-terms-count')).toHaveText(String(lesson.count));
      await expect(page.locator('#sprint-def-step')).toHaveText(`1 / ${lesson.count}`);
      await expect(page.locator('#sprint-terminal-history')).toBeVisible();

      const firstTermText = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
      );
      expect(firstTermText.trim().length).toBeGreaterThan(0);

      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    }

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — Grade 8 Lesson 10: launches Logo-Storm, verifies 12 terms, terminal history, and shuffle reset', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10');

    const sprintBtn = page.locator('#sprint-toggle');
    await expect(sprintBtn).toBeVisible();
    await expect(sprintBtn).not.toBeDisabled();

    await sprintBtn.click();
    const overlay = page.locator('#sprint-overlay');
    await expect(overlay).toBeVisible();

    // Grade 8 Lesson 10 has 12 marked-up terms
    await expect(page.locator('#sprint-terms-count')).toHaveText('12');
    await expect(page.locator('#sprint-def-step')).toHaveText('1 / 12');
    await expect(page.locator('#sprint-terminal-history')).toBeVisible();

    // Arena renders first term sentence, logs it to terminal history, and transitions to term 2 on completion
    const term1Text = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(term1Text.trim().length).toBeGreaterThan(0);

    await page.locator('#sprint-hidden-input').pressSequentially(term1Text);

    await expect(page.locator('#sprint-def-step')).toHaveText('2 / 12');
    const historyEntries = page.locator('#sprint-history-entries .sprint-history-entry');
    await expect(historyEntries).toHaveCount(1);
    await expect(historyEntries.first().locator('.sprint-history-text')).toHaveText(term1Text);

    const term2Text = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(term2Text.trim().length).toBeGreaterThan(0);
    expect(term2Text).not.toBe(term1Text);

    // Shuffle resets terminal history and step counter
    await page.locator('#sprint-shuffle-btn').click();
    await expect(historyEntries).toHaveCount(0);
    await expect(page.locator('#sprint-history-current')).toHaveText('');
    await expect(page.locator('#sprint-def-step')).toHaveText('1 / 12');

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();

    sim.assertCleanSession();
  });
});
