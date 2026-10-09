from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    page.goto('http://localhost:8080/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/19/level1')
    page.wait_for_timeout(2000)
    page.screenshot(path='D:/school-lms/scr1.png')

    page.goto('http://localhost:8080/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/19/level2')
    page.wait_for_timeout(2000)
    page.screenshot(path='D:/school-lms/scr2.png')

    page.goto('http://localhost:8080/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/19/level3')
    page.wait_for_timeout(2000)
    page.screenshot(path='D:/school-lms/scr3.png')

    browser.close()
