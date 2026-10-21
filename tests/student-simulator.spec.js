import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('StudentSimulator Engine Unit & Behavioral Contracts', () => {

  test('initializes with all supported personas and default clean error registry', async ({ page }) => {
    for (const persona of Object.values(LearnerPersona)) {
      const sim = new StudentSimulator(page, { persona });
      expect(sim.persona).toBe(persona);
      expect(sim.consoleErrors).toEqual([]);
      expect(sim.unhandledExceptions).toEqual([]);
      expect(() => sim.assertCleanSession()).not.toThrow();
    }
  });

  test('detects and throws on unhandled browser exceptions in assertCleanSession', async ({ page }) => {
    const sim = new StudentSimulator(page);
    sim.unhandledExceptions.push('ReferenceError: undefinedVariable is not defined');
    expect(() => sim.assertCleanSession()).toThrow(/Fatal unhandled exception/);
  });

  test('cognitivePause delays correctly based on persona', async ({ page }) => {
    const noviceSim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    const carelessSim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });

    const t0 = Date.now();
    await noviceSim.cognitivePause();
    const noviceDuration = Date.now() - t0;
    expect(noviceDuration).toBeGreaterThanOrEqual(100);

    const t1 = Date.now();
    await carelessSim.cognitivePause();
    const carelessDuration = Date.now() - t1;
    expect(carelessDuration).toBeLessThan(120);
  });

  test('simulates human typing and careless input mutations', async ({ page }) => {
    // Setup a clean dummy form page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <input id="test-input" type="text" />
          <button id="test-btn">OK</button>
          <div id="output"></div>
          <script>
            document.getElementById('test-btn').addEventListener('click', () => {
              document.getElementById('output').textContent = document.getElementById('test-input').value.trim();
            });
          </script>
        </body>
      </html>
    `);

    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    const input = page.locator('#test-input');
    const btn = page.locator('#test-btn');
    const output = page.locator('#output');

    // Human type with careless spaces
    await sim.humanType(input, '12.5', { trailingSpaces: true });
    await btn.click();
    await expect(output).toHaveText('12.5');

    // Test careless input tolerance helper
    await sim.testCarelessInputTolerance(input, btn, '12.5', async () => {
      const text = await output.textContent();
      return text.includes('12') || text.includes('12.5') || text.includes('12,5');
    });
  });

  test('simulates novice distractor trap and recovery workflow', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="status">INIT</div>
          <button id="btn-trap">Trap Option</button>
          <button id="btn-correct">Correct Option</button>
          <script>
            let attempts = 0;
            document.getElementById('btn-trap').addEventListener('click', () => {
              attempts++;
              document.getElementById('status').textContent = 'ERROR';
            });
            document.getElementById('btn-correct').addEventListener('click', () => {
              document.getElementById('status').textContent = 'SUCCESS';
            });
          </script>
        </body>
      </html>
    `);

    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    const status = page.locator('#status');

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#btn-trap').click();
      },
      assertErrorStateFn: async () => {
        await expect(status).toHaveText('ERROR');
      },
      solveCorrectlyFn: async () => {
        await page.locator('#btn-correct').click();
      },
      assertSuccessStateFn: async () => {
        await expect(status).toHaveText('SUCCESS');
      }
    });
  });

  test('simulates spam-clicking without breaking DOM state', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <button id="spam-btn">Click me</button>
          <span id="click-count">0</span>
          <script>
            let count = 0;
            document.getElementById('spam-btn').addEventListener('click', () => {
              count++;
              document.getElementById('click-count').textContent = String(count);
            });
          </script>
        </body>
      </html>
    `);

    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await sim.simulateSpamClick(page.locator('#spam-btn'), 7);

    const count = Number(await page.locator('#click-count').textContent());
    expect(count).toBeGreaterThan(0);
    sim.assertCleanSession();
  });
});
