import sys, asyncio
from playwright.async_api import async_playwright
# usage: el.py tab selector out.png
async def main():
    tab, sel, out = sys.argv[1:4]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        await pg.goto('http://127.0.0.1:8765/kpop-dashboard/#' + tab, wait_until='networkidle')
        await pg.wait_for_timeout(1800)
        await pg.locator(sel).first.screenshot(path=out)
        await b.close()
asyncio.run(main())
