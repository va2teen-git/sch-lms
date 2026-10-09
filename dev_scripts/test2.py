import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page()
        
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"ERROR: {exc}"))
        
        await page.goto('http://localhost:8080/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/4/level3.html')
        await page.click('button:has-text("ИНИЦИАЛИЗАЦИЯ ЗАЩИТЫ")')
        
        for _ in range(4):
            await asyncio.sleep(1)
            html = await page.locator('h3').inner_text()
            print("HTML:", html)
        await b.close()

if __name__ == '__main__':
    asyncio.run(run())
