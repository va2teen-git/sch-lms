import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('9 класс Урок 5 Уровень 1 (Writer Emulator)', () => {

  test('Успешное прохождение уровня', async ({ page }) => {
    // 1. Переход на страницу урока
    await page.goto('http://localhost:4321/tasks/9-класс/5/level1');
    const frame = page; // In Astro pages, it's just a page, wait, is it in an iframe in the app?
    // The test in testing.md says: await page.goto('http://localhost:4321/lesson/класс/номер_урока'); const frame = page.frameLocator('#iframe-1');
    // But since I am testing the task directly for now without the main shell, I can just go to /tasks/...
    // Let's use the task route.
    
    // Actually, I can just test the task page directly.
    await expect(page.locator('#phase-counter')).toBeVisible();
    
    // We will just evaluate the HTML into the editor to simulate formatting since clicking Jodit toolbar is complex in tests
    
    for (let phase = 1; phase <= 3; phase++) {
        await expect(page.locator('#phase-counter')).toHaveText(phase.toString());
        
        // Extract the target from instruction panel
        const instructionHTML = await page.locator('#instruction-panel').innerHTML();
        
        let targetHtml = '';
        if (phase === 1) {
            // Find sentence and word and format
            const sentenceMatch = instructionHTML.match(/"([^"]+)"/);
            const sentence = sentenceMatch ? sentenceMatch[1] : '';
            const wordMatch = instructionHTML.match(/«([^»]+)»/);
            const word = wordMatch ? wordMatch[1] : '';
            const formatMatch = instructionHTML.match(/text-danger fw-bold">([^<]+)<\/span>/);
            const format = formatMatch ? formatMatch[1] : '';
            
            let formattedWord = word;
            if (format === 'ЖИРНЫМ') formattedWord = `<b>${word}</b>`;
            if (format === 'КУРСИВОМ') formattedWord = `<i>${word}</i>`;
            if (format === 'ПОДЧЕРКНУТЫМ') formattedWord = `<u>${word}</u>`;
            
            targetHtml = sentence.replace(word, formattedWord);
        } else if (phase === 2) {
            const sentenceMatch = instructionHTML.match(/"([^"]+)"/);
            const sentence = sentenceMatch ? sentenceMatch[1] : '';
            const alignMatch = instructionHTML.match(/text-danger fw-bold">([^<]+)<\/span>/);
            const align = alignMatch ? alignMatch[1] : '';
            const alignStyle = align.includes('центру') ? 'center' : 'right';
            
            targetHtml = `<p style="text-align: ${alignStyle};">${sentence}</p>`;
        } else if (phase === 3) {
            const tagMatch = instructionHTML.match(/text-danger fw-bold">([^<]+)</);
            const tagStr = tagMatch ? tagMatch[1] : '';
            const tag = tagStr.includes('Маркированный') ? 'ul' : 'ol';
            
            const items = await page.locator('#instruction-panel ul li').allInnerTexts();
            targetHtml = `<${tag}><li>${items[0]}</li><li>${items[1]}</li><li>${items[2]}</li></${tag}>`;
        }
        
        // Insert into editor
        await page.locator('.jodit-wysiwyg').evaluate((el, html) => el.innerHTML = html, targetHtml);
        
        // Click check
        await page.locator('#check-btn').click();
        await page.waitForTimeout(500);
        const statusMsg = await page.locator('#writer-status').innerText();
        console.log(`Phase ${phase} status: ${statusMsg}`);
        await page.waitForTimeout(1100); // Wait for regeneration (1.5s timeout in code)
    }
    
    // Check success screen
    await expect(page.locator('#instruction-panel')).toContainText('ЗАДАНИЕ УСПЕШНО ВЫПОЛНЕНО');
  });

});
