"""헤드리스 Chrome으로 각 탭 로드 → JS 오류 수집 + 전체 페이지 스크린샷.
사용: /workspace/.venv-pw/bin/python tools/shoot.py [base_url] [tabs...]"""
import sys, asyncio, os
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/kpop-dashboard/'
TABS = sys.argv[2:] or ['overview','boxscore','tracker','hybe','social','events','artists','auditions','rpd','industry']
OUT = os.path.join(os.path.dirname(__file__), '..', 'screenshots')
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR {e}'))
        pg.on('console', lambda m: errs.append(f'CONSOLE {m.type}: {m.text}') if m.type in ('error','warning') else None)
        pg.on('requestfailed', lambda r: errs.append(f'REQFAIL {r.url} {r.failure}'))
        await pg.goto(BASE + '#overview', wait_until='networkidle')
        await pg.wait_for_selector('#asOf:not(:empty)')
        print('asOf:', await pg.inner_text('#asOf'), '|', await pg.inner_text('#srcState'))
        for t in TABS:
            await pg.click(f'#tabs button[data-tab="{t}"]')
            await pg.wait_for_timeout(1500)
            errtxt = await pg.eval_on_selector(f'#tab-{t}', 'e => [...e.querySelectorAll(".error")].map(x=>x.textContent).join("|")')
            if errtxt: errs.append(f'RENDER {t}: {errtxt}')
            await pg.screenshot(path=os.path.join(OUT, f'{t}.png'), full_page=True)
            print('shot', t)
            if t == 'tracker':
                await pg.click('#calView button[data-v="month"]'); await pg.wait_for_timeout(500)
                await pg.screenshot(path=os.path.join(OUT, 'tracker-calendar-month.png'), full_page=True)
                await pg.click('#calMain .cal-chip'); await pg.wait_for_timeout(400)
                await pg.screenshot(path=os.path.join(OUT, 'tracker-calendar-detail.png'))
                await pg.click('.modal-x')
                await pg.click('#calView button[data-v="week"]'); await pg.click('#calToday')
                await pg.click('#tkSub button[data-v="charts"]'); await pg.wait_for_timeout(1500)
                await pg.screenshot(path=os.path.join(OUT, 'tracker-charts.png'), full_page=True)
                await pg.click('#tkSub button[data-v="cal"]'); await pg.wait_for_timeout(300)
                await pg.screenshot(path=os.path.join(OUT, 'tracker-calendar-week.png'), full_page=True)
                print('shot calendar variants')
            if t == 'hybe':
                cal = await pg.query_selector('#hyCal')
                await cal.screenshot(path=os.path.join(OUT, 'hybe-calendar-week.png'))
                await pg.click('#hcalView button[data-v="month"]'); await pg.wait_for_timeout(500)
                await cal.screenshot(path=os.path.join(OUT, 'hybe-calendar-month.png'))
                await pg.click('#hcalMain .cal-chip'); await pg.wait_for_timeout(400)
                await pg.screenshot(path=os.path.join(OUT, 'hybe-calendar-detail.png'))
                await pg.click('.modal-x')
                await pg.click('#hcalView button[data-v="week"]')
                print('shot hybe calendar')
        await b.close()
    print('\n'.join(errs) or 'NO ERRORS')
asyncio.run(main())
