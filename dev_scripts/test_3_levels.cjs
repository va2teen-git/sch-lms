const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const page = await browser.newPage();
  
  try {
    console.log("=== ТЕСТ 1: 7 класс / Урок 5 / Уровень 1 ===");
    await page.goto('http://localhost:4321/tasks/7-класс/5/level1');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'dev_scripts/scr_test1_start.png' });
    
    // Фаза 1
    console.log("Решение Фазы 1...");
    // Выбираем только те, у которых расширение txt, log, csv, sql, json
    const compressibleExts = ['.txt', '.log', '.csv', '.sql', '.json'];
    const labels = await page.$$('.form-check-label');
    for (let label of labels) {
      const text = await label.innerText();
      if (compressibleExts.some(ext => text.includes(ext))) {
         await label.click();
      }
    }
    await page.click('#btn-phase1');
    await page.waitForTimeout(500); // ждем анимации/перехода

    // Фаза 2
    console.log("Решение Фазы 2...");
    const q2 = await page.innerText('#phase2-question');
    // Размер исходной папки с логами сервера составляет X МБ. Алгоритм сжал ее в Y раз.
    const match = q2.match(/составляет (\d+) МБ.*в (\d+) раз/);
    if (match) {
        const original = parseInt(match[1]);
        const ratio = parseInt(match[2]);
        const answer = original / ratio;
        await page.fill('#input-phase2', answer.toString());
        await page.click('#btn-phase2');
        await page.waitForTimeout(500);
    } else {
        console.log("Не удалось спарсить вопрос 2");
    }

    // Фаза 3
    console.log("Решение Фазы 3...");
    const q3 = await page.innerText('#phase3-question');
    if (q3.includes('по электронной почте') || q3.includes('Windows')) {
        await page.click('.p3-btn[data-answer="ZIP"]');
    } else if (q3.includes('gzip') || q3.includes('bzip2') || q3.includes('Linux') || q3.includes('TAR') || q3.includes('Ubuntu') || q3.includes('Debian')) {
        await page.click('.p3-btn[data-answer="TAR"]');
    } else {
        await page.click('.p3-btn[data-answer="7Z"]');
    }
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'dev_scripts/scr_test1_end.png' });
    if (await page.isVisible('#success-screen')) {
       console.log("Тест 1 ПРОЙДЕН!\n");
    } else {
       console.log("Тест 1 ПРОВАЛЕН!\n");
    }

    console.log("=== ТЕСТ 2: 10 класс / Урок 19 / Уровень 1 ===");
    await page.goto('http://localhost:4321/tasks/10-класс_углубленный/19/level1');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'dev_scripts/scr_test2_start.png' });
    
    // Фаза 1
    console.log("Решение Фазы 1...");
    // Подождем немного для инициализации терминала
    await page.waitForTimeout(1000);
    const attackerIP = await page.evaluate(() => window.attackerIP);
    await page.type('#cmd-input', `ufw deny from ${attackerIP}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Фаза 2
    console.log("Решение Фазы 2...");
    await page.waitForFunction(() => typeof window.malwarePID !== 'undefined');
    const malwarePID = await page.evaluate(() => window.malwarePID);
    await page.type('#cmd-input', `kill -9 ${malwarePID}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Фаза 3
    console.log("Решение Фазы 3...");
    await page.waitForFunction(() => typeof window.compromisedUser !== 'undefined');
    const compromisedUser = await page.evaluate(() => window.compromisedUser);
    await page.type('#cmd-input', `passwd -l ${compromisedUser}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'dev_scripts/scr_test2_end.png' });
    const terminalText = await page.innerText('#terminal-output');
    if (terminalText.includes('SYSTEM RECOVERY COMPLETE') || terminalText.includes('Mission Accomplished')) {
       console.log("Тест 2 ПРОЙДЕН!\n");
    } else if (await page.isVisible('.success-overlay')) {
       console.log("Тест 2 ПРОЙДЕН!\n");
    } else {
       // Let's just check if there is an overlay
       const isOverlayVisible = await page.evaluate(() => {
           const overlay = document.querySelector('.mission-success-overlay');
           return overlay && window.getComputedStyle(overlay).display !== 'none';
       });
       if(isOverlayVisible) console.log("Тест 2 ПРОЙДЕН!\n");
       else console.log("Тест 2 ПРОВАЛЕН! (overlay не найден)\n");
    }

    console.log("=== ТЕСТ 3: 7 класс / Урок 5 / Уровень 3 ===");
    await page.goto('http://localhost:4321/tasks/7-класс/5/level3');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'dev_scripts/scr_test3_start.png' });
    
    console.log("Решение Аркады...");
    await page.click('button:has-text("НАЧАТЬ ВЗЛОМ")');
    await page.waitForTimeout(500);
    
    // В аркаде нужно играть пока не закончится
    for(let i = 0; i < 20; i++) {
        const isComplete = await page.isVisible('h2:has-text("ДАННЫЕ УСПЕШНО ПЕРЕДАНЫ")');
        if(isComplete) break;
           
        const options = await page.$$('.list-group-item');
        if(options.length > 0) {
           const question = await page.innerText('h3');
           // Quick logic to answer the arcade questions
           if(question.includes('размер') && question.includes('сжатие')) {
               // find 7Z
               await page.click('.list-group-item:has-text("7Z")');
           } else if(question.includes('устройствами')) {
               await page.click('.list-group-item:has-text("ZIP")');
           } else {
               // default hack
               await page.evaluate(() => {
                   const btns = document.querySelectorAll('.list-group-item');
                   btns.forEach(b => { if(b.dataset.correct === 'true') b.click(); });
               });
           }
        }
        await page.waitForTimeout(200);
    }
    
    await page.screenshot({ path: 'dev_scripts/scr_test3_end.png' });
    const isCompleted = await page.isVisible('h2:has-text("ДАННЫЕ УСПЕШНО ПЕРЕДАНЫ")');
    if (isCompleted || await page.evaluate(() => !!document.querySelector('.text-success'))) {
       console.log("Тест 3 ПРОЙДЕН!\n");
    } else {
       console.log("Тест 3 ПРОВАЛЕН! (Имитация завершения аркады)\n");
    }

  } catch (error) {
    console.error("Ошибка при выполнении тестов:", error);
  } finally {
    await browser.close();
  }
})();
