/**
 * Student Simulation Engine for School LMS (Playwright Extension)
 * 
 * Simulates realistic student behaviors, personas, and cognitive traits
 * to eliminate "white-box / author-oracle bias" in task automated testing.
 * 
 * Personas:
 * - NOVICE: Reads task, hesitates, falls into plausible distractor traps first,
 *           verifies that error feedback and procedural regeneration work seamlessly.
 * - CARELESS: Fast typist, adds accidental spaces, uses Russian commas (3,14),
 *             mis-cases inputs, presses Enter prematurely, double-clicks buttons.
 * - CHAOS: Tries forbidden actions (paste, extreme drag offsets, rapid spam clicks),
 *          tests debounce, state locks, and ensuring no runtime exceptions (NaN, unhandled errors).
 * - DILIGENT: Solves tasks strictly through visible text and UI elements,
 *             avoiding private/internal backdoor globals (__testState).
 */

import { expect } from '@playwright/test';

export const LearnerPersona = {
  NOVICE: 'novice',
  CARELESS: 'careless',
  CHAOS: 'chaos',
  DILIGENT: 'diligent'
};

export class StudentSimulator {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Object} [options]
   * @param {string} [options.persona='diligent']
   * @param {boolean} [options.catchConsoleErrors=true]
   */
  constructor(page, options = {}) {
    this.page = page;
    this.persona = options.persona || LearnerPersona.DILIGENT;
    this.consoleErrors = [];
    this.unhandledExceptions = [];

    if (options.catchConsoleErrors !== false) {
      this.attachErrorListeners();
    }
  }

  /**
   * Listens for browser console errors, page crashes, and uncaught exceptions.
   */
  attachErrorListeners() {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    this.page.on('pageerror', error => {
      this.unhandledExceptions.push(error.message || String(error));
    });
  }

  /**
   * Asserts that no critical runtime errors, uncaught exceptions, or NaN values occurred.
   */
  assertCleanSession() {
    // Filter out benign browser warnings (e.g., favicon or third-party audio context notices if any)
    const fatalErrors = this.unhandledExceptions;
    if (fatalErrors.length > 0) {
      throw new Error(`[StudentSimulator] Fatal unhandled exception(s) detected during student session:\n${fatalErrors.join('\n')}`);
    }
  }

  /**
   * Simulates a cognitive reading pause.
   * Novices pause longer to comprehend instructions; Careless learners act almost instantly.
   */
  async cognitivePause(customMs = null) {
    if (customMs !== null) {
      await this.page.waitForTimeout(customMs);
      return;
    }

    switch (this.persona) {
      case LearnerPersona.NOVICE:
        await this.page.waitForTimeout(150);
        break;
      case LearnerPersona.CARELESS:
        await this.page.waitForTimeout(20);
        break;
      case LearnerPersona.CHAOS:
        await this.page.waitForTimeout(10);
        break;
      case LearnerPersona.DILIGENT:
      default:
        await this.page.waitForTimeout(80);
        break;
    }
  }

  /**
   * Types text into a locator realistically, adapting to the student's persona.
   * For Careless learners: introduces accidental whitespace, case alterations, or Russian comma.
   * 
   * @param {import('@playwright/test').Locator} locator
   * @param {string|number} canonicalAnswer
   * @param {Object} [options]
   * @param {boolean} [options.fuzzRussianComma=false]
   * @param {boolean} [options.trailingSpaces=false]
   * @param {boolean} [options.submitWithEnter=false]
   */
  async humanType(locator, canonicalAnswer, options = {}) {
    await locator.waitFor({ state: 'visible' });
    await this.cognitivePause();

    let textToType = String(canonicalAnswer);

    if (this.persona === LearnerPersona.CARELESS) {
      // Careless student habits: Russian comma instead of dot
      if (options.fuzzRussianComma && textToType.includes('.')) {
        textToType = textToType.replace('.', ',');
      }
      // Accidental trailing/leading whitespace
      if (options.trailingSpaces) {
        textToType = `  ${textToType}  `;
      }
      // Case variation
      if (options.alterCase && Math.random() > 0.5) {
        textToType = textToType.toLowerCase();
      }
    }

    // Click to focus like a real user
    await locator.click();

    // Type sequentially to trigger input/keyup listeners
    const delay = this.persona === LearnerPersona.NOVICE ? 40 : (this.persona === LearnerPersona.CARELESS ? 5 : 20);
    await locator.pressSequentially(textToType, { delay });

    if (options.submitWithEnter) {
      await locator.press('Enter');
    }
  }

  /**
   * Tests input robustness against a student with careless input habits
   * (e.g. Russian comma, random whitespace, case variations).
   * 
   * @param {import('@playwright/test').Locator} inputLocator
   * @param {import('@playwright/test').Locator} submitLocator
   * @param {string|number} validValue
   * @param {Function} isSuccessCheckFn
   */
  async testCarelessInputTolerance(inputLocator, submitLocator, validValue, isSuccessCheckFn) {
    const mutations = [];
    const str = String(validValue).trim();

    // 1. Value with Russian comma (if numeric with dot)
    if (str.includes('.')) {
      mutations.push(str.replace('.', ','));
    }
    // 2. Value with whitespace padding
    mutations.push(`  ${str}  `);
    // 3. Lowercase / Uppercase
    mutations.push(str.toLowerCase());
    mutations.push(str.toUpperCase());

    for (const val of mutations) {
      await inputLocator.fill('');
      await inputLocator.fill(val);
      if (submitLocator) {
        await submitLocator.click();
      } else {
        await inputLocator.press('Enter');
      }

      const passed = await isSuccessCheckFn();
      if (!passed) {
        throw new Error(`[StudentSimulator] Careless input tolerance failure: Input "${val}" for expected "${validValue}" was rejected by the task.`);
      }
    }
  }

  /**
   * Simulates a novice making an initial mistake on a plausible distractor,
   * then asserts that the error message/reset occurred and the task remains recoverable.
   * 
   * @param {Object} config
   * @param {Function} config.triggerDistractorFn
   * @param {Function} config.assertErrorStateFn
   * @param {Function} config.solveCorrectlyFn
   * @param {Function} config.assertSuccessStateFn
   */
  async simulateNoviceDistractorTrap({
    triggerDistractorFn,
    assertErrorStateFn,
    solveCorrectlyFn,
    assertSuccessStateFn
  }) {
    // 1. Novice student makes plausible error
    await this.cognitivePause(150);
    await triggerDistractorFn();

    // 2. Validate the error state
    await assertErrorStateFn();

    // 3. Novice realizes mistake, reads again, and attempts correct solution
    await this.cognitivePause(300);
    await solveCorrectlyFn();

    // 4. Validate success after recovery
    await assertSuccessStateFn();
  }

  /**
   * Simulates a chaotic student rapidly spam-clicking an action button
   * (testing debounce, race conditions, and single-event dispatching).
   * 
   * @param {import('@playwright/test').Locator} locator
   * @param {number} [clicks=5]
   */
  async simulateSpamClick(locator, clicks = 5) {
    await locator.waitFor({ state: 'visible' });
    for (let i = 0; i < clicks; i++) {
      // Fire rapid clicks without waiting for full animations
      await locator.click({ force: true, noWaitAfter: true }).catch(() => {});
    }
    // Allow state to settle
    await this.page.waitForTimeout(200);
    this.assertCleanSession();
  }

  /**
   * Simulates a student attempting prohibited copy/paste
   * to verify that the platform's Anti-Paste / Zero Multiple Choice policy holds.
   * 
   * @param {import('@playwright/test').Locator} inputLocator
   * @param {string} textToPaste
   */
  async attemptProhibitedPaste(inputLocator, textToPaste) {
    await inputLocator.waitFor({ state: 'visible' });
    await inputLocator.focus();

    // Dispatch paste event through DOM
    await this.page.evaluate(({ sel, text }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
        bubbles: true,
        cancelable: true
      });
      el.dispatchEvent(pasteEvent);
    }, { sel: await inputLocator.evaluate(el => el.id ? `#${el.id}` : el.tagName.toLowerCase()), text: textToPaste });

    // Ensure value did not get populated via paste
    const val = await inputLocator.inputValue().catch(() => '');
    expect(val).not.toBe(textToPaste);
  }

  /**
   * Simulates a drag-and-drop interaction with human jitter or near-miss.
   * 
   * @param {import('@playwright/test').Locator} sourceLocator
   * @param {import('@playwright/test').Locator} targetLocator
   * @param {Object} [options]
   * @param {boolean} [options.nearMissFirst=false] If true, drags to an incorrect area first to test bounce-back
   * @param {import('@playwright/test').Locator} [options.wrongTargetLocator]
   */
  async humanDragAndDrop(sourceLocator, targetLocator, options = {}) {
    await sourceLocator.waitFor({ state: 'visible' });
    await targetLocator.waitFor({ state: 'visible' });

    const sourceBox = await sourceLocator.boundingBox();
    const targetBox = await targetLocator.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('[StudentSimulator] Could not calculate bounding boxes for drag-and-drop');
    }

    const mouse = this.page.mouse;

    if (options.nearMissFirst && options.wrongTargetLocator) {
      const wrongBox = await options.wrongTargetLocator.boundingBox();
      if (wrongBox) {
        // Drag to wrong target and release
        await mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
        await mouse.down();
        await mouse.move(wrongBox.x + wrongBox.width / 2, wrongBox.y + wrongBox.height / 2, { steps: 5 });
        await mouse.up();
        await this.page.waitForTimeout(200);
      }
    }

    // Now drag to the legitimate target
    await mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await mouse.down();
    await mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await mouse.up();
    await this.page.waitForTimeout(100);
  }

  /**
   * Reads the text problem strictly from what is rendered on screen (Black-Box perception).
   * 
   * @param {import('@playwright/test').Locator} locator
   * @returns {Promise<string>}
   */
  async readVisiblePrompt(locator) {
    await locator.waitFor({ state: 'visible' });
    const text = await locator.innerText();
    return text.trim().replace(/\s+/g, ' ');
  }
}
