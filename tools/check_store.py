"""저장소 전환 점검: 수정 값 반영·등급 분포·조인·DOM 표시 확인. 사용: python tools/check_store.py [url]"""
import sys, asyncio, json
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/kpop-dashboard/'
JS = r"""() => {
 const T = D.tracker.tours, H = D.hybe.tours;
 const f = (A, re) => A.filter(t => re.test(t.artist + ' ' + t.tour)).map(t => ({ a: t.artist, tour: t.tour, id: t.artist_id, start: t.start, end: t.end, shows: t.shows, done: t.done, left: t.left, att: t.attendance, g: t.grade }));
 return {
  src: LOADINFO, snapshot: SNAPSHOT && SNAPSHOT.synced_at, figHits: FIG_HITS, figDiff: FIG_DIFF.slice(0, 12), figDiffN: FIG_DIFF.length,
  walk: [...f(T, /WALK THE LINE/), ...f(H, /WALK THE LINE/)], kats: [...f(T, /캣츠아이|KATSEYE/i), ...f(H, /KATSEYE/)],
  andteam: [...f(T, /&TEAM/), ...f(H, /&TEAM/)], enh: [...f(T, /BLOOD SAGA/), ...f(H, /BLOOD SAGA/)], v8: [...f(T, /V8|\[V8\]/), ...f(H, /V8/)],
  pure: [...f(T, /PUREFLOW/i), ...f(H, /PUREFLOW/i)], bnd: [...f(T, /KNOCK ON Vol\.2/), ...f(H, /KNOCK ON Vol\.2/)],
  aespa: (D.tracker.records || []).concat(T).filter(r => /Parallel Line/i.test((r.tour || '') + (r.label || ''))).map(r => ({ tour: r.tour || r.label, att: r.attendance, g: r.grade })),
  bndSeoul: JSON.stringify(D.tracker).match(/[^"]{0,60}31,800[^"]{0,40}/g),
  grades: Object.fromEntries(ACC_KEYS.map(k => [k, ACC[k].label])), counts: accCounts(),
  noSourceIds: JSON.stringify(D.tracker).includes('"source_ids"') && !JSON.stringify(D.tracker.tours[0]).includes('"sources"'),
  wikiOnly: JSON.stringify(D.tracker).split('"primary_source":false').length - 1,
  join: [...artistIndex().values()].filter(a => a.tracker.length && a.hybe.length).length,
  bad: [...H.map((h, i) => ({ h, m: trackerMatch(h) }))].filter(x => x.m && trackerDiff(x.h, x.m.t).length).map(x => x.h.artist + ' ' + x.h.tour + ': ' + trackerDiff(x.h, x.m.t).join(', ')),
  unmatched: H.filter(h => !trackerMatch(h)).map(h => h.artist + ' ' + h.tour),
 };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL + '#hybe', wait_until='networkidle'); await pg.wait_for_timeout(2000)
        r = await pg.evaluate(JS)
        print(json.dumps(r, ensure_ascii=False, indent=1))
        txt = await pg.inner_text('#tab-hybe')
        for s in ['20 / 16', '16 / 22', '9 / 22', '225,250', '캣츠아이', '2027-03-09', '2026-05-13', '보고분 합']:
            print('DOM hybe has', s, s in txt)
        print('header:', await pg.inner_text('#srcState')); print('errors:', errs or 'none'); await b.close()
asyncio.run(main())
