import asyncio
import re
from playwright.async_api import async_playwright

EXT_MAP = {
    "Текстовый документ": [".txt", ".doc", ".docx", ".rtf", "txt", "doc", "docx", "rtf"],
    "Графический файл": [".bmp", ".jpg", ".jpeg", ".png", ".gif", "bmp", "jpg", "jpeg", "png", "gif"],
    "Графика": [".bmp", ".jpg", ".jpeg", ".png", ".gif", "bmp", "jpg", "jpeg", "png", "gif"],
    "Звуковой файл": [".wav", ".mp3", "wav", "mp3"],
    "Аудио": [".wav", ".mp3", "wav", "mp3"],
    "Видеофайл": [".avi", ".mp4", "avi", "mp4"],
    "Исполняемый файл (программа)": [".exe", "exe"],
    "Исполняемая программа": [".exe", "exe"],
    "Программа": [".exe", "exe"]
}

OP_MAP = {
    "создание нового пустого файла": "Создание",
    "изменение имени файла": "Переименование",
    "создание точной копии": "Копирование",
    "перенос файла в другое место": "Перемещение",
    "уничтожение файла": "Удаление",
    "исчезает из старой": "перемещение",
    "оригинал не сохраняется": "перемещение",
    "точная копия файла": "копирование",
    "ОСТАЕТСЯ на своем старом месте": "копирование",
    "изменения имени файла без изменения его местоположения": "переименование",
    "переносится в системную папку «Корзина»": "удаление",
    "Файл исчез из исходной папки": "ПЕРЕМЕЩЕНИЕ",
    "Обнаружен дубликат файла": "КОПИРОВАНИЕ"
}

async def solve_level1(page):
    print("--- Solving Level 1 ---")
    await page.goto("http://localhost:4321/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/4/level1.html", wait_until="networkidle")
    
    # Phase 1
    await page.wait_for_selector("h4:has-text('Идентификация')")
    text = await page.locator("p.fs-5").inner_text()
    file_type = re.search(r'"([^"]+)"', text).group(1)
    
    buttons = await page.locator("#buttons-container button").all()
    for btn in buttons:
        btn_text = await btn.inner_text()
        if btn_text in EXT_MAP.get(file_type, []):
            await btn.click()
            break
            
    # Phase 2
    await page.wait_for_selector("h4:has-text('Восстановление пути')")
    p1 = await page.locator("p.fs-5").nth(0).inner_text()
    file_name = re.search(r'Файл (.*?) находится', p1).group(1).strip()
    
    p2 = await page.locator("p.fs-5").nth(1).inner_text()
    disk_match = re.search(r'Диск ([A-Z]): -> (.*)', p2)
    disk = disk_match.group(1)
    folders_str = disk_match.group(2).strip()
    folders = [f.strip() for f in folders_str.split('->')]
    
    full_path = f"{disk}:\\{'\\'.join(folders)}\\{file_name}"
    await page.fill("#path-input", full_path)
    await page.click("#check-btn")
    
    # Phase 3
    await page.wait_for_selector("h4:has-text('Анализ файловых операций')")
    desc_text = await page.locator("span.fst-italic").inner_text()
    
    correct_op = None
    for k, v in OP_MAP.items():
        if k.lower() in desc_text.lower():
            correct_op = v.upper()
            break
            
    buttons = await page.locator("#ops-container button").all()
    for btn in buttons:
        btn_text = await btn.inner_text()
        if correct_op in btn_text.upper():
            await btn.click()
            break
            
    await page.wait_for_selector("div.alert-success")
    print("Level 1 Passed!")

async def solve_level2(page):
    print("--- Solving Level 2 ---")
    await page.goto("http://localhost:4321/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/4/level2.html", wait_until="networkidle")
    
    # Phase 1
    await page.wait_for_selector("h4:has-text('Ручной ввод формата')")
    text = await page.locator("p.fs-5").nth(0).inner_text()
    file_type = re.search(r'"([^"]+)"', text).group(1)
    await page.fill("#ans-input", EXT_MAP[file_type][0].replace(".", ""))
    await page.click("#check-btn")
    
    # Phase 2
    await page.wait_for_selector("h4:has-text('Извлечение имени')")
    path_text = await page.locator("p.fs-4").inner_text()
    file_name = path_text.split("\\")[-1]
    await page.fill("#ans-input", file_name)
    await page.click("#check-btn")
    
    # Phase 3
    await page.wait_for_selector("h4:has-text('Анализ окружения')")
    path_text = await page.locator("p.fs-4").inner_text()
    folder_name = path_text.split("\\")[-2]
    await page.fill("#ans-input", folder_name)
    await page.click("#check-btn")
    
    # Phase 4
    await page.wait_for_selector("h4:has-text('Модификация маршрута')")
    old_path = await page.locator("span.text-white").inner_text()
    desc_text = await page.locator("p.fs-5").nth(1).inner_text()
    
    match = re.search(r'папки (.*?) в параллельную папку (.*?)\s*\(', desc_text)
    old_f = match.group(1).strip()
    new_f = match.group(2).strip()
    
    new_path = old_path.replace(f"\\{old_f}\\", f"\\{new_f}\\")
    await page.fill("#ans-input", new_path)
    await page.click("#check-btn")
    
    # Phase 5
    await page.wait_for_selector("h4:has-text('Терминологический контроль')")
    q_text = await page.locator("p.fs-5").inner_text()
    
    correct_op = None
    for k, v in OP_MAP.items():
        if k.lower() in q_text.lower():
            correct_op = v
            break
            
    await page.fill("#ans-input", correct_op)
    await page.click("#check-btn")
    
    await page.wait_for_selector("div.alert-warning")
    print("Level 2 Passed!")

async def solve_level3(page):
    print("--- Solving Level 3 ---")
    await page.goto("http://localhost:4321/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/4/level3.html", wait_until="networkidle")
    
    await page.click("button:has-text('ИНИЦИАЛИЗАЦИЯ ЗАЩИТЫ')")
    
    for i in range(1, 11):
        await page.wait_for_selector(f"span:has-text('ФАЗА {i} / 10')")
        
        q_text = await page.locator("h4.text-white").inner_text()
        
        buttons = await page.locator("button.btn-outline-danger").all()
        
        answered = False
        if "ПОВРЕЖДЕНО РАСШИРЕНИЕ" in q_text:
            file_type = re.search(r'\[ (.*?) \]', q_text).group(1).strip()
            for btn in buttons:
                btn_text = await btn.inner_text()
                ext = btn_text.replace(">>", "").strip()
                if ext in EXT_MAP.get(file_type, []):
                    await btn.click()
                    answered = True
                    break
        elif "АНАЛИЗ ПУТИ" in q_text:
            if "/" in q_text:
                for btn in buttons:
                    if "НЕТ" in await btn.inner_text():
                        await btn.click()
                        answered = True
                        break
            else:
                for btn in buttons:
                    if "ДА" in await btn.inner_text():
                        await btn.click()
                        answered = True
                        break
        elif "ЛОГ:" in q_text:
            correct_op = None
            for k, v in OP_MAP.items():
                if k.lower() in q_text.lower():
                    correct_op = v.upper()
                    break
            for btn in buttons:
                if correct_op in await btn.inner_text():
                    await btn.click()
                    answered = True
                    break
        
        if not answered:
            print(f"Failed to answer phase {i}: {q_text}")
            break
            
    await page.wait_for_selector("div.alert-danger:has-text('СИСТЕМА ЗАЩИЩЕНА')", timeout=10000)
    print("Level 3 Passed!")

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await solve_level1(page)
            await solve_level2(page)
            await solve_level3(page)
            print("All tests passed successfully!")
        except Exception as e:
            print(f"Test failed: {e}")
            raise e
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
