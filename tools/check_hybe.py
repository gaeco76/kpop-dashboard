"""hybe.json 실패 시 안내 + 트래커 캘린더의 갱신 행 렌더링 확인"""
import asyncio, os
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:8765/kpop-dashboard/'
OUT=os.path.join(os.path.dirname(__file__),'..','screenshots')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # 1) hybe 차단
        pg = await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/hybe.json*', lambda r: r.abort())
        await pg.goto(BASE+'#hybe', wait_until='networkidle'); await pg.wait_for_timeout(1500)
        print('blocked state:', await pg.inner_text('#srcState'))
        print('blocked tab:', (await pg.inner_text('#tab-hybe'))[:120].replace('\n',' '))
        await pg.screenshot(path=os.path.join(OUT,'hybe-missing.png'))
        await pg.click('#tabs button[data-tab="tracker"]'); await pg.wait_for_timeout(800)
        print('tracker chips while blocked:', await pg.eval_on_selector_all('#calMain .cal-chip','e=>e.length'), 'errors:', errs or 'none')
        await pg.close()
        # 2) 트래커 갱신 행
        pg = await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE+'#tracker', wait_until='networkidle'); await pg.wait_for_timeout(1500)
        names=['케이츠아이','투모로우바이투게더','TXT','엔하이픈','ENHYPEN','아일릿','ILLIT','캣츠아이','KATSEYE','보이넥스트도어','BOYNEXTDOOR','코르티스','CORTIS','&TEAM','앤팀','TWS','투어스']
        for d in ['2026-07-01','2026-09-01','2026-10-04','2026-11-16']:
            await pg.fill('#calDate', d); await pg.dispatch_event('#calDate','change'); await pg.wait_for_timeout(500)
            txt = await pg.eval_on_selector_all('#calMain .cal-chip','e=>e.map(x=>x.innerText.split("\\n")[0])')
            print(d, len(txt), 'chips'); print('  ', [t for t in txt if any(n in t for n in names)])
            await pg.screenshot(path=os.path.join(OUT,f'tracker-calendar-{d}.png'), full_page=True)
        print('errors:', errs or 'none'); await b.close()
asyncio.run(main())
