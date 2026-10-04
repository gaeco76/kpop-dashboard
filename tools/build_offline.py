"""오프라인 단일 HTML 생성: CSS·ECharts·JS 인라인 + 저장소 스냅샷(./data/kpop) 내장.
내장 데이터가 있으면 네트워크 없이 그것만 사용합니다. (먼저 tools/sync_data.sh 로 스냅샷 갱신)
사용: python3 tools/build_offline.py  →  dist/kpop-dashboard-offline.html"""
import json, os, re, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'kpop')
PATHS = dict(re.findall(r"(\w+): '([a-z_]+/[a-z_]+)'", open(os.path.join(ROOT, 'js', 'config.js'), encoding='utf-8').read()))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
html = rd('index.html')
emb = {}
for f, rel in PATHS.items():
    fp = os.path.join(DATA, rel + '.json')
    if os.path.exists(fp): emb[f] = json.load(open(fp, encoding='utf-8'))
emb['__snapshot'] = json.load(open(os.path.join(DATA, 'SNAPSHOT.json'), encoding='utf-8'))
safe = lambda s: s.replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>' + rd('css/style.css') + '</style>')
html = re.sub(r'<script src="vendor/echarts.min.js"></script>\s*<script>if\(!window.echarts\).*?</script>', lambda m: '<script>' + safe(rd('vendor/echarts.min.js')) + '</script>', html, flags=re.S)
embed_js = 'window.KPD_EMBED=' + json.dumps(emb, ensure_ascii=False) + ';'
for js in ['config', 'core', 'tabs', 'calendar', 'hybe', 'app']:
    code = rd(f'js/{js}.js')
    if js == 'config': code = embed_js + '\n' + code
    html = html.replace(f'<script src="js/{js}.js"></script>', '<script>' + safe(code) + '</script>')
html = html.replace('<title>K-pop 데이터 대시보드</title>', f'<title>K-pop 데이터 대시보드 (오프라인, 스냅샷 {emb.get("meta",{}).get("lastUpdated","")})</title>')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'kpop-dashboard-offline.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, os.path.getsize(out), 'bytes; embedded', list(emb))
