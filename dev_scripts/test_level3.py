import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "http://localhost:4321/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level3.html"
        print(f"Opening {url}")
        
        response = await page.goto(url, wait_until="networkidle")
        if response.status != 200:
            print(f"Error loading page: {response.status}")
            return
            
        print("Page loaded successfully.")
        
        # 1. Проверяем наличие стартового экрана
        start_button = page.locator("button", has_text="НАЧАТЬ РУЧНОЕ УПРАВЛЕНИЕ")
        await start_button.wait_for(state="visible", timeout=5000)
        print("Start screen is visible.")
        
        # 2. Начинаем игру
        await start_button.click()
        print("Clicked START button.")
        
        # 3. Проверяем, что загрузилась Фаза 1
        phase_header = page.locator("h5", has_text="Фаза: 1 / 10")
        await phase_header.wait_for(state="visible", timeout=2000)
        print("Phase 1 is visible (Routing).")
        
        # 4. Проверяем наличие слотов и фрагментов для маршрутизатора
        slot_boxes = page.locator(".slot-box")
        frag_buttons = page.locator(".frag-btn")
        slot_count = await slot_boxes.count()
        frag_count = await frag_buttons.count()
        
        print(f"Found {slot_count} empty slots and {frag_count} draggable fragments.")
        assert slot_count > 0, "No slots found!"
        assert frag_count > 0, "No fragments found!"
        
        # 5. Кликаем по случайному фрагменту (совершаем действие)
        print(f"Clicking the first fragment to test interaction...")
        await frag_buttons.nth(0).click()
        
        # После клика слот должен заполниться (появится класс slot-filled)
        filled_slot = page.locator(".slot-filled").first
        await filled_slot.wait_for(state="visible", timeout=2000)
        print("Slot successfully filled after click.")
        
        # 6. Ждем таймаута (или делаем намеренную ошибку в логике)
        # Поскольку время Фазы 1 около 15 секунд, а мы ввели неверную комбинацию, 
        # проще подождать, пока время истечет и мы увидим "СИСТЕМА ВЗЛОМАНА" / "КРИТИЧЕСКИЙ СБОЙ"
        print("Waiting for timeout to test HARDCORE RESET mechanism... (~15 seconds)")
        fail_screen = page.locator("h1", has_text="КРИТИЧЕСКИЙ СБОЙ")
        
        # Ждем максимум 20 секунд
        await fail_screen.wait_for(state="visible", timeout=20000)
        print("Failure screen appeared successfully! Hardcore reset triggered.")
        
        # Проверяем, что есть причина сбоя
        reason = await page.locator("h3", has_text="Причина:").inner_text()
        print(f"Failure reason displayed: {reason}")
        
        # 7. Проверяем, что игра сбросилась на стартовый экран через 2 секунды
        print("Waiting for auto-reset to start screen...")
        await start_button.wait_for(state="visible", timeout=5000)
        print("Successfully returned to start screen. E2E Test Passed!")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
