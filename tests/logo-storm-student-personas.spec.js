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

    // Novice verifies definition HUD and Top-10 leaderboard are present
    await expect(page.locator('#sprint-def-card')).toBeVisible();
    await expect(page.locator('#sprint-leaderboard-sidebar')).toBeVisible();
    await expect(page.locator('#sprint-def-term')).not.toBeEmpty();

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

    // Errors count must increase to 1, but progress stays 0
    await expect(page.locator('#sprint-errors-count')).toHaveText('1');
    await expect(page.locator('#sprint-chars-progress')).toHaveText('0');

    // Now type correct first character
    await page.locator('#sprint-hidden-input').pressSequentially(firstChar);

    // Progress moves to 1
    await expect(page.locator('#sprint-chars-progress')).toHaveText('1');
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
    }

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

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — Grade 9 Lesson 8: streams terms one by one, verifying didactic definition synchronization', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/lesson/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8');

    await page.locator('#sprint-toggle').click();
    const overlay = page.locator('#sprint-overlay');
    await expect(overlay).toBeVisible();

    // Lesson 8 has 12 terms
    await expect(page.locator('#sprint-terms-count')).toHaveText('12');

    // First term is rendered in arena and HUD
    await expect(page.locator('#sprint-def-step')).toHaveText('1 / 12');
    const firstTermHud = await page.locator('#sprint-def-term').textContent();
    expect(firstTermHud.trim().length).toBeGreaterThan(0);

    // Arena only contains the single active term's text
    const term1Text = await page.evaluate(() => 
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(term1Text.toLowerCase()).toContain(firstTermHud.trim().toLowerCase());

    // Type the first term sentence
    await page.locator('#sprint-hidden-input').pressSequentially(term1Text);

    // Immediately switches to term 2 in HUD and arena
    await expect(page.locator('#sprint-def-step')).toHaveText('2 / 12');
    const secondTermHud = await page.locator('#sprint-def-term').textContent();
    expect(secondTermHud.trim().length).toBeGreaterThan(0);

    const term2Text = await page.evaluate(() => 
      Array.from(document.querySelectorAll('#sprint-text-display span')).map(s => s.textContent).join('')
    );
    expect(term2Text.toLowerCase()).toContain(secondTermHud.trim().toLowerCase());

    sim.assertCleanSession();
  });

  test('Persona: NOVICE — Grade 11 Basic Lesson 9: launches Logo-Storm, verifies 18 terms and HUD', async ({ page }) => {
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

    // Definition HUD displays term and definition
    const defTerm = await page.locator('#sprint-def-term').textContent();
    const defDesc = await page.locator('#sprint-def-desc').textContent();
    expect(defTerm.trim().length).toBeGreaterThan(0);
    expect(defDesc.trim().length).toBeGreaterThan(0);

    // Close via Esc
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();

    sim.assertCleanSession();
  });
});
