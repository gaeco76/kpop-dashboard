#!/usr/bin/env bash
# 공용 데이터 저장소(/workspace/data/kpop) → 대시보드 공개 스냅샷(./data/kpop) 동기화.
# GitHub Pages는 /workspace를 읽을 수 없어서, 공개 사이트는 이 스냅샷을 읽습니다 (로컬 서버에서는 ../data/kpop 직접).
# 저장소 파일은 읽기만 하고 바이트 그대로 복사합니다. Claude 수집본(claude_*: 전부 추정, 샘플 포함)은 화면에서 쓰지 않아 제외.
# 사용: tools/sync_data.sh [--push]   (--push: 변경 시 commit·push까지)
set -euo pipefail; cd "$(dirname "$0")/.."
SRC=${KPOP_STORE:-/workspace/data/kpop}
[ -f "$SRC/tours/tracker.json" ] || { echo "저장소 없음: $SRC" >&2; exit 1; }
rm -rf data/kpop.tmp && mkdir -p data/kpop.tmp
for f in "$SRC"/*/*.json; do
  b=$(basename "$f"); case "$b" in claude_*) continue;; esac
  python3 -m json.tool "$f" >/dev/null || { echo "JSON 오류: $f" >&2; exit 1; }
  rel=${f#"$SRC"/}; mkdir -p "data/kpop.tmp/$(dirname "$rel")"; cp -p "$f" "data/kpop.tmp/$rel"
done
python3 - "$SRC" <<'PY'
import json, hashlib, os, re, sys, datetime as dt
src = sys.argv[1]; out = 'data/kpop.tmp'
files = {}
for root, _, fs in os.walk(out):
    for f in sorted(fs):
        p = os.path.join(root, f); rel = os.path.relpath(p, out)
        files[rel] = hashlib.md5(open(p, 'rb').read()).hexdigest()
idx = os.path.join(os.path.dirname(src), 'INDEX.md'); status_lines = []
if os.path.exists(idx):
    t = open(idx, encoding='utf-8').read()
    m = re.search(r'##\s*6\..*?\n(.*?)(\n## |\Z)', t, re.S)
    status_lines = [l.strip() for l in (m.group(1) if m else '').splitlines() if l.strip().startswith('|') and not re.match(r'^\|\s*-', l.strip())][1:]
verified = [l for l in status_lines if '검증 완료' in l and 'kpop' in l]
meta = json.load(open(os.path.join(out, 'sources/meta.json')))
snap = {'synced_at': dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec='seconds'), 'store': src,
        'store_lastUpdated': meta.get('lastUpdated'), 'files': files,
        'verification': {'label': '비서실장 검증 완료' if verified and len(verified) == len(status_lines) else ('일부 검증 완료' if verified else '비서실장 검증 대기'),
                         'detail': 'INDEX.md §6: ' + ' / '.join(status_lines)}}
json.dump(snap, open(os.path.join(out, 'SNAPSHOT.json'), 'w'), ensure_ascii=False, indent=1)
print('files', len(files), '| store lastUpdated', snap['store_lastUpdated'], '|', snap['verification']['label'])
PY
rm -rf data/kpop && mv data/kpop.tmp data/kpop
if [ "${1:-}" = "--push" ] && [ -n "$(git status --porcelain data/kpop)" ]; then
  git add data/kpop && git -c user.name=gaeco76 -c user.email=gaeco76@users.noreply.github.com commit -qm "데이터 스냅샷 동기화 ($(date +%F\ %H:%M) KST)" && git push -q && echo pushed
fi
