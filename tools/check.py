"""필터·폴백 회귀 체크: (1) '검증만' 필터로 전 탭 렌더 (2) GitHub Pages 차단 시 로컬 폴백"""
import asyncio
from playwright.async_api import async_playwright
URL='http://127.0.0.1:8765/kpop-dashboard/'
TABS=['overview','boxscore','tracker','social','events','artists','auditions','rpd','industry']
async def run(block=False, verified=False, light=False):
    errs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1440,'height':900})
        pg.on('pageerror',lambda e:errs.append(f'PAGEERROR {e}'))
        pg.on('console',lambda m:errs.append(f'CONSOLE {m.type}: {m.text}') if m.type=='error' and not block else None)
        if block: await pg.route('**/gaeco76.github.io/**', lambda r: r.abort())
        await pg.goto(URL,wait_until='networkidle'); await pg.wait_for_timeout(800)
        print('state:', await pg.inner_text('#srcState'), '| asOf', await pg.inner_text('#asOf'), '|', await pg.inner_text('#footSrc'))
        if verified: await pg.click('#accVerified')
        if light: await pg.click('#themeBtn')
        for t in TABS:
            await pg.click(f'#tabs button[data-tab="{t}"]'); await pg.wait_for_timeout(700)
            e=await pg.eval_on_selector(f'#tab-{t}','e=>[...e.querySelectorAll(".error")].map(x=>x.textContent).join("|")')
            if e: errs.append(f'RENDER {t}: {e}')
        if light: await pg.click('#tabs button[data-tab="overview"]'); await pg.wait_for_timeout(800); await pg.screenshot(path='/workspace/kpd-tmp/light.png')
        await b.close()
    print('block' if block else '', 'verified' if verified else '', 'light' if light else '', '->', errs or 'OK')
async def main():
    await run(verified=True); await run(block=True); await run(light=True)
asyncio.run(main())
