/**
 * StudentWriterSimulator Engine for School LMS (LibreOffice Writer / Jodit WYSIWYG)
 * 
 * Specialized extension of StudentSimulator for Rich-Text and Word Processor tasks
 * (Grade 7 Lesson 22, Grade 9 Lesson 5, OGE 13.2).
 * 
 * Personas:
 * - NOVICE: Uses forbidden shortcuts (5 spaces for red line, hyphens instead of em-dash),
 *           struggles with caret traps, verifies pedagogical diagnostics.
 * - CARELESS: Leaves trailing spaces, typos, forgets to turn off subscripts,
 *             verifies homoglyph/Cyrillic-Latin normalization.
 * - CHAOS: Spams formatting buttons on empty selection, verifies no broken nested tags,
 *          clicks ruler and menus rapidly.
 * - DILIGENT: Uses clean selection, sets 1.0 cm paragraph indent via dialog or ruler,
 *             formats formulas (H₂O, x²) with proper inline tagging.
 */

import { expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

export class StudentWriterSimulator extends StudentSimulator {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Object} [options]
   */
  constructor(page, options = {}) {
    super(page, options);
    this.editorSelector = '.jodit-wysiwyg';
  }

  /**
   * Focuses the LibreOffice Writer document body.
   */
  async focusEditor() {
    const editor = this.page.locator(this.editorSelector);
    await editor.waitFor({ state: 'visible' });
    await editor.click();
    await this.cognitivePause();
  }

  /**
   * Resets the document to a clean empty state with properly collapsed caret at root paragraph.
   */
  async clearDocument() {
    await this.focusEditor();
    await this.page.evaluate(sel => {
      const wysiwyg = document.querySelector(sel);
      if (wysiwyg) {
        wysiwyg.innerHTML = '<p></p>';
        const p = wysiwyg.querySelector('p');
        if (p) {
          const r = document.createRange();
          r.setStart(p, 0);
          r.collapse(true);
          const s = window.getSelection();
          if (s) {
            s.removeAllRanges();
            s.addRange(r);
          }
        }
      }
    }, this.editorSelector);
    await this.cognitivePause(50);
  }

  /**
   * Types text into the WYSIWYG editor like a human student.
   * 
   * @param {string} text
   * @param {Object} [options]
   * @param {boolean} [options.clearFirst=false]
   */
  async typeInEditor(text, options = {}) {
    if (options.clearFirst) {
      await this.clearDocument();
    } else {
      await this.focusEditor();
    }

    const delay = this.persona === LearnerPersona.NOVICE ? 35 : (this.persona === LearnerPersona.CARELESS ? 5 : 15);
    await this.page.keyboard.type(text, { delay });
  }

  /**
   * Programmatically or textually selects a target word/phrase inside the editor
   * using browser Range and Selection API.
   * 
   * @param {string} targetText
   */
  async selectText(targetText) {
    const success = await this.page.evaluate(({ sel, text }) => {
      const editor = document.querySelector(sel);
      if (!editor) return false;

      // Find text node containing targetText
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.textContent.indexOf(text);
        if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + text.length);

          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
      }
      return false;
    }, { sel: this.editorSelector, text: targetText });

    if (!success) {
      throw new Error(`[StudentWriterSimulator] Could not find text "${targetText}" inside editor to select.`);
    }

    await this.cognitivePause(80);
  }

  /**
   * Toggles a formatting style on the current selection or caret.
   * 
   * @param {'bold'|'italic'|'underline'|'strikethrough'|'sub'|'sup'|'eraser'} styleName
   */
  async toggleStyle(styleName) {
    const buttonMap = {
      bold: '#btn-bold',
      italic: '#btn-italic',
      underline: '#btn-underline',
      strikethrough: '#btn-strikethrough',
      sub: '#btn-sub',
      sup: '#btn-sup',
      eraser: '#btn-eraser'
    };

    const btnId = buttonMap[styleName] || styleName;
    const btn = this.page.locator(btnId);
    await btn.waitFor({ state: 'visible' });
    await btn.click();
    await this.cognitivePause(50);
  }

  /**
   * Simulates typing a scientific/math formula with subscripts or superscripts (e.g. H₂O or 2¹⁰)
   * while actively exercising the Zero Caret Trapping mechanism:
   * 1. Types prefix (e.g. "H")
   * 2. Activates sub/sup style
   * 3. Types index character (e.g. "2")
   * 4. Deactivates sub/sup style (must collapse range outside tag!)
   * 5. Types suffix (e.g. "O") and ensures suffix has NORMAL styling
   * 
   * @param {string} prefix e.g. 'H'
   * @param {string} indexChar e.g. '2'
   * @param {'sub'|'sup'} styleType
   * @param {string} suffix e.g. 'O'
   */
  async typeFormulaWithSubSup(prefix, indexChar, styleType, suffix) {
    await this.focusEditor();
    const btnSelector = styleType === 'sub' ? '#btn-sub' : '#btn-sup';
    const btn = this.page.locator(btnSelector);

    // 1. Type prefix
    if (prefix) {
      await this.page.keyboard.type(prefix, { delay: 20 });
    }

    // 2. Turn on style and wait for active state
    await btn.click();
    await expect(btn).toHaveClass(/active/);

    // 3. Type index char
    await this.page.keyboard.type(indexChar, { delay: 20 });

    // 4. Turn off style (triggers Zero Caret Trapping) and wait for inactive state
    await btn.click();
    await expect(btn).not.toHaveClass(/active/);

    // 5. Type suffix
    if (suffix) {
      await this.page.keyboard.type(suffix, { delay: 20 });
    }
  }

  /**
   * Simulates a novice student shortcut: typing 5 spaces for paragraph indentation
   * instead of setting first-line indent via ruler or paragraph dialog.
   * 
   * @param {string} paragraphText
   */
  async simulateSpaceIndentTrap(paragraphText) {
    await this.focusEditor();
    // Novice taps space 5 times
    for (let i = 0; i < 5; i++) {
      await this.page.keyboard.press('Space');
    }
    await this.page.keyboard.type(paragraphText, { delay: 10 });
  }

  /**
   * Simulates typing a hyphen "-" instead of an em-dash "—" (common novice error).
   * 
   * @param {string} leftText
   * @param {string} rightText
   */
  async simulateHyphenTrap(leftText, rightText) {
    await this.focusEditor();
    await this.page.keyboard.type(`${leftText} - ${rightText}`, { delay: 15 });
  }

  /**
   * Sets the first-line indent (красная строка) using the interactive LibreOffice ruler marker.
   */
  async setIndentViaRuler() {
    const rulerMarker = this.page.locator('#ruler-first-line');
    await rulerMarker.waitFor({ state: 'visible' });
    // Click marker to toggle 1.0 cm OGE preset
    await rulerMarker.click();
    await this.cognitivePause(100);
  }

  /**
   * Opens the Format -> Paragraph modal dialog and applies proper OGE 13.2 geometry:
   * - First line indent: e.g. '1.0' cm
   * - Line spacing: e.g. '1.15'
   * - Alignment: e.g. 'justify' (по ширине)
   * 
   * @param {Object} config
   * @param {string} [config.firstLine='1.0']
   * @param {string} [config.lineSpacing='1.15']
   * @param {'left'|'center'|'right'|'justify'} [config.align='justify']
   */
  async configureParagraphViaDialog(config = {}) {
    const firstLine = config.firstLine || '1.0';
    const lineSpacing = config.lineSpacing || '1.15';
    const align = config.align || 'justify';

    // Open menu: Формат -> Абзац...
    await this.page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await this.page.locator('#menu-format-paragraph').click();

    const modal = this.page.locator('#modal-paragraph');
    await expect(modal).toBeVisible();

    // Fill first line
    const firstLineInput = this.page.locator('#dialog-para-firstline');
    await firstLineInput.fill(firstLine);

    // Line spacing
    await this.page.locator('#dialog-para-linespacing').selectOption(lineSpacing);

    // Alignment
    await this.page.locator('#dialog-para-align').selectOption(align);

    // Click OK
    await this.page.locator('#btn-dialog-para-ok').click();
    await expect(modal).toBeHidden();
    await this.cognitivePause(100);
  }

  /**
   * Clicks the "ПРОВЕРИТЬ ДОКУМЕНТ" button.
   */
  async checkDocument() {
    const btn = this.page.locator('#check-btn');
    await btn.waitFor({ state: 'visible' });
    await btn.click();
    await this.cognitivePause(200);
  }

  /**
   * Gets the inner HTML of the document editor for inspection.
   * @returns {Promise<string>}
   */
  async getEditorHTML() {
    return await this.page.evaluate(sel => {
      const editor = document.querySelector(sel);
      return editor ? editor.innerHTML : '';
    }, this.editorSelector);
  }

  /**
   * Gets clean HTML without invisible Zero-Width characters.
   * @returns {Promise<string>}
   */
  async getCleanEditorHTML() {
    const raw = await this.getEditorHTML();
    return raw.replace(/[\uFEFF\u200B\u200C\u200D]/g, '');
  }
}
