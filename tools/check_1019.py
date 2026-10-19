"""10/19 업데이트 확인: JS 오류, Pollstar Asia·JxJ·YG 오디션·Spotify·BTS 미확인 문구, 스크린샷."""
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/kpop-dashboard/'
pre = sys.argv[2] if len(sys.argv) > 2 else 'local'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 1000})
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console ' + m.text))
    def go(tab):
        pg.goto(base + '#' + tab, wait_until='networkidle'); pg.wait_for_timeout(1500)
    go('boxscore')
    out['pollstar_text'] = pg.locator('#bxPollstar').inner_text()[:700]
    out['pollstar_bars'] = pg.evaluate("(()=>{const c=echarts.getInstanceByDom(document.querySelector('#psGross'));return c?c.getOption().series[0].data.length:null})()")
    out['tix_bars'] = pg.evaluate("(()=>{const c=echarts.getInstanceByDom(document.querySelector('#psTix'));return c?c.getOption().series[0].data.length:null})()")
    pg.locator('#bxPollstar').screenshot(path=f'screenshots/{pre}-pollstar.png')
    go('hybe')
    row = pg.locator('#tab-hybe tr', has_text='JOURNEY INTO').first
    out['hybe_jxj'] = row.inner_text()[:400] if row.count() else None
    if row.count(): row.scroll_into_view_if_needed(); pg.screenshot(path=f'screenshots/{pre}-hybe-jxj.png')
    out['hybe_unverified_bts'] = '2,314,140' in pg.locator('#tab-hybe').inner_text()
    out['hybe_pollstar_stat'] = 'Pollstar 2026 Asia Focus' in pg.locator('#tab-hybe').inner_text()
    out['jxj_cal'] = pg.evaluate("document.body.innerText.split('JxJ').length-1")
    go('auditions')
    t = pg.locator('#tab-auditions').inner_text()
    out['yg_audition'] = 'YG GLOBAL AUDITION' in t
    el = pg.locator('#tab-auditions >> text=2026 YG GLOBAL AUDITION').first
    if el.count(): el.scroll_into_view_if_needed(); pg.screenshot(path=f'screenshots/{pre}-auditions-yg.png')
    go('social')
    out['spotify'] = pg.locator('#soSpotify').inner_text()[:400]
    if pg.locator('#soSpotify .card').count(): pg.locator('#soSpotify').screenshot(path=f'screenshots/{pre}-social-spotify.png')
    for tab in ['overview','tracker','calendar','artists','events','industry','rpd']:
        try: go(tab)
        except Exception as e: errs.append(f'{tab} {e}')
    out['figdiff'] = pg.evaluate("FIG_DIFF.filter(d=>d.filled||d.skipped).map(d=>d.file+' '+d.subject+' '+d.field+' '+d.record+(d.filled?' filled':' skipped'))")
    # mobile overflow
    m = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m.on('pageerror', lambda e: errs.append('m pageerror ' + str(e)))
    ov = {}
    for tab in ['boxscore', 'social', 'hybe', 'auditions']:
        m.goto(base + '#' + tab, wait_until='networkidle'); m.wait_for_timeout(1200)
        ov[tab] = m.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    out['mobile_overflow'] = ov
    out['errors'] = errs
    b.close()
print(json.dumps(out, ensure_ascii=False, indent=1))
