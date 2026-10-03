"""오프라인 단일 HTML 생성: CSS·ECharts·JS 인라인 + 현재 로컬 JSON 스냅샷 내장.
실행 시에도 먼저 라이브 URL을 시도하고, 실패하면 내장 스냅샷을 사용합니다.
사용: python3 tools/build_offline.py  →  dist/kpop-dashboard-offline.html"""
import json, os, re, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data') if os.path.isdir(os.path.join(ROOT, 'data')) else os.path.join(ROOT, '..', 'kpop', 'site', 'data')
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
html = rd('index.html')
emb = {}
for f in ['meta','tours','tracker','social','events','industry','artists','auditions','rpd','sources']:
    fp = os.path.join(DATA, f + '.json')
    if os.path.exists(fp): emb[f] = json.load(open(fp, encoding='utf-8'))
safe = lambda s: s.replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>' + rd('css/style.css') + '</style>')
html = re.sub(r'<script src="vendor/echarts.min.js"></script>\s*<script>if\(!window.echarts\).*?</script>', lambda m: '<script>' + safe(rd('vendor/echarts.min.js')) + '</script>', html, flags=re.S)
embed_js = 'window.KPD_EMBED=' + json.dumps(emb, ensure_ascii=False) + ';'
for js in ['config', 'core', 'tabs', 'app']:
    code = rd(f'js/{js}.js')
    if js == 'config': code = embed_js + '\n' + code
    html = html.replace(f'<script src="js/{js}.js"></script>', '<script>' + safe(code) + '</script>')
html = html.replace('<title>K-pop 데이터 대시보드</title>', f'<title>K-pop 데이터 대시보드 (오프라인, 스냅샷 {emb.get("meta",{}).get("lastUpdated","")})</title>')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'kpop-dashboard-offline.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, os.path.getsize(out), 'bytes; embedded', list(emb))
