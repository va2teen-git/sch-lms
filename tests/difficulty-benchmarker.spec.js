import { test, expect } from '@playwright/test';
import { DifficultyBenchmarker, calculateCCS, GRADE_CORRIDORS } from './difficulty-benchmarker.js';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Cognitive Difficulty Benchmarker & Curve Evaluator Suite', () => {

  // =========================================================================
  // 1. CCS Formula Unit Integrity
  // =========================================================================
  test.describe('1. CCS Formula Calculation & Parameter Clamping', () => {

    test('calculates standard introductory phase (Ki/Intro): low depth, high scaffolding', () => {
      const { ccs, breakdown } = calculateCCS({
        depth: 1,
        memory: 1,
        search: 0,
        inversion: 0,
        stress: 0,
        scaffolding: 2 // High visual guides
      });

      // 1 + 1 + 0 + 0 + 0 - 2 = 0 -> clamped to 1.0 (min floor)
      expect(ccs).toBe(1.0);
      expect(breakdown.scaffolding).toBe(2);
    });

    test('calculates standard Level 2 direct calculation: 2 steps, 2 memory items', () => {
      const { ccs } = calculateCCS({
        depth: 2,
        memory: 2,
        search: 0,
        inversion: 0,
        stress: 0,
        scaffolding: 0
      });

      // 2 + 2 = 4.0
      expect(ccs).toBe(4.0);
    });

    test('calculates Level 2 Peak 1 (Inverse problem + multi-step deduction)', () => {
      const { ccs } = calculateCCS({
        depth: 3,
        memory: 3,
        search: 0,
        inversion: 2, // Inverse task (find input by output)
        stress: 0,
        scaffolding: 0
      });

      // 3 + 3 + 2 = 8.0
      expect(ccs).toBe(8.0);
    });

    test('calculates Level 3 Hardcore Arcade Climax with Time Pressure', () => {
      const { ccs } = calculateCCS({
        depth: 3,
        memory: 3,
        search: 2, // Distractor noise
        inversion: 1,
        stress: 3, // TPR >= 0.88
        scaffolding: 0
      });

      // 3 + 3 + 2 + 1 + 3 = 12 -> clamped to 10.0 (max ceiling)
      expect(ccs).toBe(10.0);
    });

  });

  // =========================================================================
  // 2. Sawtooth 2-1-2 Profile Validation Engine
  // =========================================================================
  test.describe('2. Sawtooth 2-1-2 Curve Assertions', () => {

    test('validates authentic Sawtooth 2-1-2 curve (Passes with healthy valley)', () => {
      const benchmarker = new DifficultyBenchmarker({
        courseSlug: '10-класс_углубленный',
        lessonId: 27,
        levelNumber: 2
      });

      // P1: Direct formula (CCS 4.0)
      benchmarker.recordPhase(1, { title: 'Прямой расчет Kotelnikov', depth: 2, memory: 2 });
      // P2: Multi-step conversion (CCS 6.0)
      benchmarker.recordPhase(2, { title: 'Квантование и АЦП', depth: 3, memory: 3 });
      // P3: Peak 1 (CCS 8.0)
      benchmarker.recordPhase(3, { title: 'SQNR & погрешность (Пик 1)', depth: 3, memory: 3, inversion: 2 });
      // P4: Consolidation Valley (CCS 5.0) - must drop below P3!
      benchmarker.recordPhase(4, { title: 'Битрейт (Консолидация / Долина)', depth: 2, memory: 3 });
      // P5: Climax (CCS 9.0) - edge cases & aliasing
      benchmarker.recordPhase(5, { title: 'Алиасинг Найквиста (Кульминация)', depth: 4, memory: 3, inversion: 2 });

      expect(() => benchmarker.assertSawtoothProfile()).not.toThrow();

      const report = benchmarker.renderReport('UNIT TEST :: SAWTOOTH VALIDATION');
      expect(report).toContain('Sawtooth 2-1-2 Profile: PASSED');
    });

    test('rejects violated curve when Phase 4 fails to provide a consolidation valley', () => {
      const benchmarker = new DifficultyBenchmarker({
        courseSlug: '10-класс_углубленный',
        lessonId: 99,
        levelNumber: 2
      });

      benchmarker.recordPhase(1, { title: 'P1', depth: 2, memory: 2 }); // 4.0
      benchmarker.recordPhase(2, { title: 'P2', depth: 3, memory: 3 }); // 6.0
      benchmarker.recordPhase(3, { title: 'P3 Peak', depth: 3, memory: 3, inversion: 1 }); // 7.0
      benchmarker.recordPhase(4, { title: 'P4 Overload', depth: 4, memory: 4 }); // 8.0 (Harder than P3!)
      benchmarker.recordPhase(5, { title: 'P5 Climax', depth: 4, memory: 4, inversion: 1 }); // 9.0

      expect(() => benchmarker.assertSawtoothProfile()).toThrowError(/Consolidation Valley/);
    });

  });

  // =========================================================================
  // 3. Grade Corridors Enforcement
  // =========================================================================
  test.describe('3. Grade & Track Corridors', () => {

    test('detects when 7th grade task exceeds maximum allowed cognitive ceiling (CCS > 5)', () => {
      const benchmarker = new DifficultyBenchmarker({
        courseSlug: '7-класс',
        lessonId: 5,
        levelNumber: 2
      });

      // 7th grade ceiling is 5.0
      benchmarker.recordPhase(1, { title: 'Intro', depth: 2, memory: 1 }); // 3.0
      benchmarker.recordPhase(2, { title: 'Complex Subnet Math', depth: 4, memory: 4 }); // 8.0! (Violates 7th grade limit)

      expect(() => benchmarker.assertGradeCorridor()).toThrowError(/exceeds max allowed \(5\)/);
    });

    test('verifies 10th grade tech track permits high-ceiling mastery tasks (up to CCS 10)', () => {
      const benchmarker = new DifficultyBenchmarker({
        courseSlug: '10-класс_углубленный',
        lessonId: 20,
        levelNumber: 2
      });

      benchmarker.recordPhase(1, { title: 'P1', depth: 2, memory: 2 }); // 4.0
      benchmarker.recordPhase(2, { title: 'P2', depth: 3, memory: 3 }); // 6.0
      benchmarker.recordPhase(3, { title: 'P3', depth: 3, memory: 3, inversion: 2 }); // 8.0
      benchmarker.recordPhase(4, { title: 'P4', depth: 2, memory: 3 }); // 5.0
      benchmarker.recordPhase(5, { title: 'P5', depth: 4, memory: 3, inversion: 2 }); // 9.0

      expect(() => benchmarker.assertGradeCorridor()).not.toThrow();
    });

  });

  // =========================================================================
  // 4. Fake Difficulty Anti-Pattern Linters
  // =========================================================================
  test.describe('4. Fake Difficulty Anti-Pattern Detection', () => {

    test('detects Flat Monotonous Plateau (all phases identical complexity)', () => {
      const benchmarker = new DifficultyBenchmarker({
        courseSlug: '9-класс',
        lessonId: 10,
        levelNumber: 2
      });

      // All 5 phases identical clones
      for (let p = 1; p <= 5; p++) {
        benchmarker.recordPhase(p, { title: `P${p}`, depth: 2, memory: 2 });
      }

      expect(() => benchmarker.assertNoFakeDifficulty()).toThrowError(/Flat Plateau detected/);
    });

    test('detects Arithmetic Grind on irregular 6-digit numbers in manual calculation', () => {
      const benchmarker = new DifficultyBenchmarker();
      benchmarker.auditNumberInvariants([64, 1024, 65536, 483917]); // 483917 is prime/irregular grind

      expect(() => benchmarker.assertNoFakeDifficulty()).toThrowError(/Arithmetic Grind/);
    });

  });

  // =========================================================================
  // 5. StudentSimulator Integration with Difficulty Profiling
  // =========================================================================
  test.describe('5. StudentSimulator Integration & Telemetry Reporting', () => {

    test('simulates student persona with integrated cognitive difficulty telemetry tracking', async () => {
      const sim = new StudentSimulator(null, {
        persona: LearnerPersona.DILIGENT,
        courseSlug: '10-класс_углубленный',
        lessonId: 27,
        levelNumber: 2
      });

      // Benchmark Phase 1
      sim.recordPhaseDifficulty(1, {
        title: 'Теорема Котельникова (fd min, dt max)',
        depth: 2,
        memory: 2,
        latencyMs: 380
      });

      // Benchmark Phase 2
      sim.recordPhaseDifficulty(2, {
        title: 'Уровни квантования N=2^b и шаг dU',
        depth: 3,
        memory: 3,
        latencyMs: 620
      });

      // Benchmark Phase 3: Peak 1
      sim.recordPhaseDifficulty(3, {
        title: 'Погрешность квантования |emax| и SQNR = 6b',
        depth: 3,
        memory: 3,
        inversion: 2,
        latencyMs: 940
      });

      // Benchmark Phase 4: Consolidation Valley
      sim.recordPhaseDifficulty(4, {
        title: 'Битрейт потока и объем несжатых аудиоданных',
        depth: 2,
        memory: 3,
        latencyMs: 480
      });

      // Benchmark Phase 5: Climax
      sim.recordPhaseDifficulty(5, {
        title: 'Анализ паразитного алиасинга и гармоник Найквиста',
        depth: 4,
        memory: 3,
        inversion: 2,
        latencyMs: 1180
      });

      // Assert full compliance with difficulty-curve.md
      sim.assertDifficultyCompliance({
        sawtooth: true,
        corridor: true,
        noFakeDifficulty: true,
        renderReport: true
      });
    });

  });

});
