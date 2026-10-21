import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 27: Level 3 Task Suite (Archetype 6: Clock-Tick Rhythm & Strobe Pipeline)', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/27');
  const level3File = path.join(tasksPath, 'level3.astro');

  test('Level 3 adheres to architectural and game design requirements', async () => {
    expect(fs.existsSync(level3File), 'level3.astro must exist').toBe(true);

    const code = fs.readFileSync(level3File, 'utf-8');

    // 1. TaskLayout component usage with level 3
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // 2. Strict Zero Multiple Choice Policy: no radio buttons, no select dropdowns
    expect(code.includes('type="radio"'), 'Radio buttons are strictly forbidden on Level 3!').toBe(false);
    expect(code.includes('<select'), 'Select dropdowns with answers are strictly forbidden on Level 3!').toBe(false);

    // 3. Strict Zero-Style Policy (must use utility classes)
    expect(code.includes('<style>'), 'Forbidden <style> tags found in level3.astro!').toBe(false);
    expect(code.includes('<style '), 'Forbidden <style ...> tags found in level3.astro!').toBe(false);

    // 4. Zero-Dependency: local Vue 3
    expect(code).toContain('src="/static/vue.global.js"');
    expect(code.includes('cdn.jsdelivr.net'), 'External CDNs are strictly forbidden!').toBe(false);
    expect(code.includes('unpkg.com'), 'External CDNs are strictly forbidden!').toBe(false);

    // 5. Responsive layout container
    expect(code).toContain('container-fluid');
    expect(code.includes('class="container"'), 'Forbidden fixed .container used! Must use container-fluid').toBe(false);

    // 6. Strict Archetype 6 declaration and components
    expect(code).toContain('АРХЕТИП 6: CLOCK-TICK RHYTHM');
    expect(code).toContain('id="osc-canvas"');
    expect(code).toContain('isApertureOpen');
    expect(code).toContain('clockPhase');
    expect(code).toContain('id="strobe-btn"');

    // 7. Telemetry integration
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 27');

    // 8. Screens and state controls
    expect(code).toContain("gameState === 'intro'");
    expect(code).toContain("gameState === 'playing'");
    expect(code).toContain("gameState === 'failed'");
    expect(code).toContain("gameState === 'success'");
    expect(code).toContain('id="start-btn"');
    expect(code).toContain('id="phase-counter"');
    expect(code).toContain('id="timer-display"');
    expect(code).toContain('id="fail-title"');
    expect(code).toContain('id="success-title"');
    expect(code).toContain('id="retry-btn"');
  });

  test('Level 3 implements 10 escalating waves with procedural signal configurations', async () => {
    const code = fs.readFileSync(level3File, 'utf-8');

    // 10 distinct waves in WAVE_DEFINITIONS
    expect(code).toContain('const WAVE_DEFINITIONS = [');
    expect(code).toContain('ВОЛНА 1: НЧ СИГНАЛ ГОЛОСА');
    expect(code).toContain('ВОЛНА 2: СИММЕТРИЧНЫЙ ТРАКТ');
    expect(code).toContain('ВОЛНА 3: УГРОЗА АЛИАСИНГА');
    expect(code).toContain('ВОЛНА 4: ЭНКОДЕР ПОЛОЖЕНИЯ');
    expect(code).toContain('ВОЛНА 5: ОВЕРСЕМПЛИНГ МУЗЫКИ');
    expect(code).toContain('ВОЛНА 6: ЛАЗЕРНЫЙ ТРАКТ С ШУМОМ');
    expect(code).toContain('ВОЛНА 7: СТУДИЙНЫЙ HI-RES АУДИО');
    expect(code).toContain('ВОЛНА 8: СЕРВОПРИВОД РОБОТА');
    expect(code).toContain('ВОЛНА 9: НАУЧНЫЙ ЭКСПЕРИМЕНТ');
    expect(code).toContain('ВОЛНА 10: КРИТИЧЕСКИЙ РЕЗОНАНС');

    // Extract WAVE_DEFINITIONS and evaluate invariants
    const match = code.match(/const WAVE_DEFINITIONS = (\[[\s\S]*?\]);\s*createApp/);
    expect(match, 'WAVE_DEFINITIONS array must be extractable').toBeTruthy();
    
    // Evaluate safely in test sandbox
    const waveDefs = eval(match[1]);
    expect(waveDefs.length).toBe(10);

    // Verify dynamic pacing (decreasing time from 8.5s to 4.0s)
    expect(waveDefs[0].maxTime).toBe(8.5);
    expect(waveDefs[9].maxTime).toBe(4.0);
    for (let i = 0; i < waveDefs.length - 1; i++) {
      expect(waveDefs[i].maxTime).toBeGreaterThanOrEqual(waveDefs[i + 1].maxTime);
    }

    // Verify unit targets valid range
    waveDefs.forEach((w, idx) => {
      expect([0, 1, 2]).toContain(w.targetUnit1);
      expect([0, 1, 2, 3]).toContain(w.targetUnit2);
      expect([0, 1, 2]).toContain(w.targetUnit3);

      // Invariants:
      // If noise present -> Anti-aliasing LPF required (targetUnit1 === 2)
      if (w.hasNoise) {
        expect(w.targetUnit1, `Wave ${idx + 1} has noise but filter not selected`).toBe(2);
      }
      // If sensor/angle -> Gray code required (targetUnit3 === 2)
      if (w.description.includes('энкодер') || w.description.includes('датчик угла')) {
        expect(w.targetUnit3, `Wave ${idx + 1} angle sensor requires Gray code`).toBe(2);
      }
      // If symmetrical negative voltage -> Two's complement required (targetUnit3 === 1)
      if (w.voltageSpan.includes('-') && !w.description.includes('энкодер') && !w.description.includes('датчик угла')) {
        expect(w.targetUnit3, `Wave ${idx + 1} bipolar voltage requires two's complement`).toBe(1);
      }
    });
  });

  test('Level 3 contains 3 hardware pipeline units and hotkey controls', async () => {
    const code = fs.readFileSync(level3File, 'utf-8');

    // Unit 1: Kotelnikov frequency divider (Keys 1, 2, 3)
    expect(code).toContain('dividerOptions: [');
    expect(code).toContain('f_d = 2 × f_max');
    expect(code).toContain('f_d = 4 × f_max (Оверсемплинг 4×)');
    expect(code).toContain('АКТИВАЦИЯ АНТИАЛИАСИНГА + ФНЧ');

    // Unit 2: Quantizer bit-depth and SQNR (Keys Q, W, E, R)
    expect(code).toContain('quantizerOptions: [');
    expect(code).toContain('8 бит (SQNR ~ 48 дБ');
    expect(code).toContain('12 бит (SQNR ~ 72 дБ');
    expect(code).toContain('16 бит (SQNR ~ 96 дБ');
    expect(code).toContain('24 бита (SQNR ~ 144 дБ');

    // Unit 3: Circuit codec (Keys A, S, D)
    expect(code).toContain('codecOptions: [');
    expect(code).toContain('Прямой двоичный (PCM | 0...+U)');
    expect(code).toContain('Дополнительный двухполярный (-U...+U)');
    expect(code).toContain('Код Грея (Датчики угла/положения)');

    // Hotkey handler support
    expect(code).toContain('handleKeyDown(e)');
    expect(code).toContain("e.key === '1'");
    expect(code).toContain("e.key === '2'");
    expect(code).toContain("e.key === '3'");
    expect(code).toContain("k === 'q'");
    expect(code).toContain("k === 'w'");
    expect(code).toContain("k === 'e'");
    expect(code).toContain("k === 'r'");
    expect(code).toContain("k === 'a'");
    expect(code).toContain("k === 's'");
    expect(code).toContain("k === 'd'");
    expect(code).toContain("e.key === ' ' || e.key === 'Enter'");
  });

  test('Level 3 implements real-time 60 FPS HTML5 Canvas oscilloscope with FFT and stems', async () => {
    const code = fs.readFileSync(level3File, 'utf-8');

    expect(code).toContain('startOscilloscopeLoop()');
    expect(code).toContain('requestAnimationFrame(render)');
    expect(code).toContain('ctx.fillRect(0, 0, w, h)');
    expect(code).toContain('ctx.setLineDash([2, 4])'); // quantization lines
    expect(code).toContain('Math.sin(phase)'); // continuous waveform
    expect(code).toContain('ctx.arc(x, quantY, 3.5, 0, Math.PI * 2)'); // discrete sample points
    expect(code).toContain('FFT СПЕКТР');
    expect(code).toContain('f_N'); // Nyquist frequency line
  });

  test('Level 3 uses native Web Audio API synthesizer with zero external assets', async () => {
    const code = fs.readFileSync(level3File, 'utf-8');

    expect(code).toContain('window.AudioContext || window.webkitAudioContext');
    expect(code).toContain('createOscillator()');
    expect(code).toContain('createGain()');
    expect(code.includes('.mp3'), 'External audio files are forbidden!').toBe(false);
    expect(code.includes('.wav'), 'External audio files are forbidden!').toBe(false);
  });
});
