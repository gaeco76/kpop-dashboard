#!/usr/bin/env bash
# 최후 폴백용 ./data/ 스냅샷을 라이브 데이터로 갱신 (라이브 실패 시 로컬 원본에서 복사)
set -e; cd "$(dirname "$0")/.."
for f in meta tours tracker social events industry artists auditions rpd sources; do
  curl -fsSL "https://gaeco76.github.io/kpop-research/data/$f.json" -o "data/$f.json.tmp" && python3 -m json.tool "data/$f.json.tmp" >/dev/null && mv "data/$f.json.tmp" "data/$f.json" \
    || { rm -f "data/$f.json.tmp"; cp "../kpop/site/data/$f.json" "data/$f.json"; echo "fallback copy: $f"; }
done
echo "snapshot: $(python3 -c 'import json;print(json.load(open("data/meta.json"))["lastUpdated"])')"
