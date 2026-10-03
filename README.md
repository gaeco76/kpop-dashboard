# K-pop 데이터 대시보드 (정적 SPA)

## 실행
```bash
cd /workspace && python3 -m http.server 8765 --bind 127.0.0.1
# → http://127.0.0.1:8765/kpop-dashboard/
```
`/workspace`(상위 폴더)를 루트로 서빙해야 로컬 폴백 `../kpop/site/data/`에 접근할 수 있습니다.
file:// 로 열면 fetch가 차단되므로 정적 서버를 쓰세요(오프라인 단일 파일 예외: `dist/`).

## 데이터 소스
- `js/config.js`의 `DATA_BASE` 상수 하나만 바꾸면 됨(기본: https://gaeco76.github.io/kpop-research/data/).
- 순서: `?data=<base>/` 쿼리 → DATA_BASE(라이브) → `../kpop/site/data/`(이 박스 전용) → `./data/`(동봉 스냅샷, GitHub Pages에서의 최후 폴백) → (오프라인 빌드만) 내장 스냅샷.
- 스냅샷 갱신: `tools/update_snapshot.sh` (라이브가 매주 갱신되므로 스냅샷은 비상용).

## 투어 트래커 주간 캘린더
- 월~일 주간 그리드, 이전/다음 주, ‘이번 주’(KST), 날짜·월 이동, 주/월 보기, 그룹·권역·검색 필터, 색(그룹별/구분별), 시상식 레이어.
- 데이터에 공연별 날짜가 없어 투어 시작~종료 기간 막대로 표시. 칩 클릭 → 상세 모달(관객·추정 관객·매출·정확도·출처).
- ‘차트·표’ 하위 탭에 기존 차트 유지.
- 캐시 우회: `?v=<분 단위 타임스탬프>`. 헤더 오른쪽에 라이브/폴백 상태 표시.

## 구조
- `index.html`, `css/style.css`, `js/config.js`(설정), `js/core.js`(로더·정확도·표·차트 헬퍼), `js/tabs.js`(탭별 렌더러), `js/app.js`(초기화)
- `vendor/echarts.min.js` (ECharts 5.5.1 로컬, 실패 시 CDN)
- `tools/shoot.py` 전 탭 스크린샷+JS 오류 검사, `tools/check.py` 필터·폴백·라이트 테마 회귀, `tools/build_offline.py` 오프라인 단일 HTML 생성
  (`/workspace/.venv-pw/bin/python tools/shoot.py`)
