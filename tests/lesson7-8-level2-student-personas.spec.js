import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 8: Cyber Security & Internet Communications Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes error on Phase 1 calculation, observes error alert, regenerates, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    // Novice mistake: Enters wrong number
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-input').fill('12345');
        await page.locator('#btn-phase1').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#error-box')).toBeVisible();
        await page.waitForTimeout(1600);
        await expect(page.locator('#error-box')).toBeHidden();
      },
      solveCorrectlyFn: async () => {
        const p1Desc = await page.locator('#p1-task-desc').innerText();
        let p1Ans = 10000;
        if (p1Desc.includes('4 символа')) p1Ans = 10000;
        else if (p1Desc.includes('3 символа')) p1Ans = 1000;
        else if (p1Desc.includes('строчные и прописные латинские буквы') && p1Desc.includes('цифры')) p1Ans = 62;
        else if (p1Desc.includes('строчные латинские буквы') && p1Desc.includes('цифры')) p1Ans = 36;
        else if (p1Desc.includes('8-битный')) p1Ans = 256;
        else if (p1Desc.includes('без цифр и специальных знаков')) p1Ans = 52;
        else if (p1Desc.includes('5-значный')) p1Ans = 100000;

        await page.locator('#p1-input').fill(p1Ans.toString());
        await page.locator('#btn-phase1').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — submits empty input and spam-clicks check buttons', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // Spam click button with empty input
    await sim.simulateSpamClick(page.locator('#btn-phase1'), 3);

    // Verify session remained healthy and error box showed
    await expect(page.locator('#error-box')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately completes all 5 phases with verified inputs', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // Phase 1
    const p1Desc = await page.locator('#p1-task-desc').innerText();
    let p1Ans = 10000;
    if (p1Desc.includes('4 символа')) p1Ans = 10000;
    else if (p1Desc.includes('3 символа')) p1Ans = 1000;
    else if (p1Desc.includes('строчные и прописные латинские буквы') && p1Desc.includes('цифры')) p1Ans = 62;
    else if (p1Desc.includes('строчные латинские буквы') && p1Desc.includes('цифры')) p1Ans = 36;
    else if (p1Desc.includes('8-битный')) p1Ans = 256;
    else if (p1Desc.includes('без цифр и специальных знаков')) p1Ans = 52;
    else if (p1Desc.includes('5-значный')) p1Ans = 100000;

    await page.locator('#p1-input').fill(p1Ans.toString());
    await page.locator('#btn-phase1').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // Phase 2
    const p2Desc = await page.locator('#p2-task-desc').innerText();
    let p2Ans = 465;
    if (p2Desc.includes('SMTPS')) p2Ans = 465;
    else if (p2Desc.includes('HTTPS')) p2Ans = 443;
    else if (p2Desc.includes('IMAPS')) p2Ans = 993;
    else if (p2Desc.includes('POP3S')) p2Ans = 995;
    else if (p2Desc.includes('открытом текстом по классическому протоколу HTTP')) p2Ans = 80;
    else if (p2Desc.includes('SMTP по умолчанию')) p2Ans = 25;
    else if (p2Desc.includes('незащищенного IMAP')) p2Ans = 143;
    else if (p2Desc.includes('открытого POP3')) p2Ans = 110;

    await page.locator('#p2-input').fill(p2Ans.toString());
    await page.locator('#btn-phase2').click();
    await expect(page.locator('#phase3')).toBeVisible();

    // Phase 3
    const p3Question = await page.locator('#p3-task-question').innerText();
    let p3Ans = '';
    if (p3Question.includes('Return-Path') || p3Question.includes('Reply-To, на который уйдет ответ')) {
      p3Ans = 'scam-collector@dark-server.xyz';
    } else if (p3Question.includes('доменное имя настоящего сервера из поля Reply-To')) {
      p3Ans = 'fake-bank-auth.com';
    } else if (p3Question.includes('IP-адрес')) {
      p3Ans = '192.0.2.77';
    } else if (p3Question.includes('исполняемое расширение')) {
      p3Ans = 'exe';
    } else if (p3Question.includes('доменное имя второго уровня из поля Reply-To')) {
      p3Ans = 'gosuslugi-verif.ru';
    }

    await page.locator('#p3-input').fill(p3Ans);
    await page.locator('#btn-phase3').click();
    await expect(page.locator('#phase4')).toBeVisible();

    // Phase 4
    const p4Url = await page.locator('#p4-url-box').innerText();
    let p4Ans = '';
    if (p4Url.includes('user-auth-check.org')) p4Ans = 'user-auth-check.org';
    else if (p4Url.includes('vkk-auth-security.ru')) p4Ans = 'vkk-auth-security.ru';
    else if (p4Url.includes('online-verif24.net')) p4Ans = 'online-verif24.net';
    else if (p4Url.includes('schoo1-portal.ru')) p4Ans = '1';
    else if (p4Url.includes('yandx-security.ru')) p4Ans = 'yandx-security.ru';
    else if (p4Url.includes('mos-service.org')) p4Ans = 'mos-service.org';

    await page.locator('#p4-input').fill(p4Ans);
    await page.locator('#btn-phase4').click();
    await expect(page.locator('#phase5')).toBeVisible();

    // Phase 5
    const p5Case = await page.locator('#p5-case-desc').innerText();
    let p5Ans = '272';
    if (p5Case.includes('похитили денежные средства со счетов')) {
      p5Ans = '159.6';
    } else if (p5Case.includes('тайну переписки') || p5Case.includes('опубликовал скриншоты чужой переписки')) {
      p5Ans = '138';
    } else if (p5Case.includes('паспортными данными') || p5Case.includes('персональных данных')) {
      p5Ans = '152';
    } else if (p5Case.includes('подобрал пароль') || p5Case.includes('блокирования доступа к компьютеру')) {
      p5Ans = '272';
    }

    await page.locator('#p5-input').fill(p5Ans);
    await page.locator('#btn-phase5').click();

    await expect(page.locator('#success-screen')).toBeVisible();
    sim.assertCleanSession();
  });

});
