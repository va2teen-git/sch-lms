import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "http://localhost:4321/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level3.html"
        print(f"Opening {url}")
        
        await page.goto(url, wait_until="networkidle")
        print("Page loaded successfully.")
        
        start_button = page.locator("button", has_text="НАЧАТЬ РУЧНОЕ УПРАВЛЕНИЕ")
        await start_button.wait_for(state="visible", timeout=5000)
        await start_button.click()
        print("Game started.")
        
        # Проходим 10 фаз
        for phase in range(1, 11):
            print(f"\n--- Solving Phase {phase}/10 ---")
            # Ждем появления заголовка фазы
            phase_header = page.locator("h5", has_text=f"Фаза: {phase} / 10")
            await phase_header.wait_for(state="visible", timeout=5000)
            
            # Получаем чит-ответы из window
            ans = await page.evaluate("window.getTestAnswers()")
            p_type = ans['type']
            
            if p_type == 'url':
                target_str = ans['expectedUrlStr']
                print(f"URL Phase. Target to build: {target_str}")
                
                # Мы должны собирать строку из доступных фрагментов
                while target_str != "":
                    frag_buttons = page.locator(".frag-btn")
                    count = await frag_buttons.count()
                    
                    # Собираем все доступные фрагменты
                    available_frags = []
                    for i in range(count):
                        frag_text = await frag_buttons.nth(i).inner_text()
                        available_frags.append({'idx': i, 'text': frag_text.strip()})
                        
                    # Сортируем по длине (по убыванию), чтобы "https" проверялся раньше "http"
                    available_frags.sort(key=lambda x: len(x['text']), reverse=True)
                    
                    clicked = False
                    for frag in available_frags:
                        if target_str.startswith(frag['text']):
                            print(f"Clicking fragment: '{frag['text']}'")
                            await frag_buttons.nth(frag['idx']).click()
                            await page.wait_for_timeout(50) 
                            target_str = target_str[len(frag['text']):]
                            clicked = True
                            break
                    
                    if not clicked:
                        print(f"Error: Could not find a fragment to build remaining target: '{target_str}'")
                        break
                        
            elif p_type == 'logic':
                should_allow = ans['logicShouldAllow']
                print(f"Logic Phase. Should Allow: {should_allow}")
                
                if should_allow:
                    await page.locator("button", has_text="РАЗРЕШИТЬ").click()
                else:
                    await page.locator("button", has_text="БЛОКИРОВАТЬ").click()
            
            # Небольшая пауза перед следующей фазой
            await page.wait_for_timeout(300)
            
        print("\nAll 10 phases completed!")
        
        # Проверяем финальный экран победы
        win_screen = page.locator("h1", has_text="СИСТЕМА СТАБИЛИЗИРОВАНА")
        await win_screen.wait_for(state="visible", timeout=3000)
        print("WIN SCREEN DETECTED. FULL E2E TEST PASSED!")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
