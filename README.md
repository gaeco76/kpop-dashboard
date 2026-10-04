# K-pop 데이터 대시보드 (정적 SPA)

## 실행
```bash
cd /workspace && python3 -m http.server 8765 --bind 127.0.0.1
# → http://127.0.0.1:8765/kpop-dashboard/
```
`/workspace`(상위 폴더)를 루트로 서빙해야 공용 저장소 `../data/kpop/`에 접근할 수 있습니다.
file:// 로 열면 fetch가 차단되므로 정적 서버를 쓰세요(오프라인 단일 파일 예외: `dist/`).

## 데이터 소스 (공용 검증 저장소)
- 원본: `/workspace/data/kpop/<topic>/` (tours, artists, events, industry, rpd, sources). 대시보드는 이 폴더를 **읽기만** 합니다.
- 로딩 순서 (`js/core.js` `dataSources()`):
  1. `?data=<base>/` 쿼리(구조: `<base>/<topic>/<file>.json`)
  2. `../data/kpop/` 공용 저장소 (로컬 서버 전용, Pages·file://에서는 건너뜀)
  3. `./data/kpop/` 저장소 스냅샷 (GitHub Pages가 실제로 읽는 곳, `SNAPSHOT.json`에 동기화 시각·md5)
  4. 구형 라이브 `https://gaeco76.github.io/kpop-research/data/` (평면 구조, figures 파일 없음 → 레코드 오버레이 없이 동작)
  5. 오프라인 빌드의 내장 스냅샷
- 스냅샷 갱신: `tools/sync_data.sh` (복사+JSON 검증+SNAPSHOT.json), `tools/sync_data.sh --push` (커밋·푸시까지). kpop-research Pages는 `data/kpop` 구조와 figures 파일을 공개하지 않으므로 이 스냅샷이 라이브 소스입니다.
- 레코드 파일 `tours/kpop_tours_figures.json`, `artists/kpop_social_figures.json`의 값·등급이 투어/트래커/HYBE 행에 지표별로 덧씌워집니다(값이 null인 칸은 채우지 않음 — subject가 데이터셋 간 중복될 수 있음).
- `artist_id`로 트래커·HYBE·소셜(유튜브/인스타 레코드) 조인.

## 등급 표시
| 저장소 grade | 키 | 표시 |
|---|---|---|
| 확정 | verified | 초록 배지 |
| 부분 | partial | 파랑 배지 |
| 개략 | rough | 청록 배지 + 점선 테두리 |
| 충돌 | conflict | 빨강 배지 + 빨간 테두리 |
| 미확 | unverified | 회색 배지, 흐리게 + 점선 |
| 추정 | estimate | 분홍 배지 + 빗금(차트 막대·값) |
- `primary_source:false`(위키 단독 출처)는 배지 옆 작은 `2차` 표시. 배지 툴팁에 collected_at·source_note·구 status.
- 헤더에 소스 상태와 INDEX.md 검증 상태(예: "비서실장 검증 대기") 표시.

## 투어 트래커 주간 캘린더
- 월~일 주간 그리드, 이전/다음 주, ‘이번 주’(KST), 날짜·월 이동, 주/월 보기, 그룹·권역·검색 필터, 색(그룹별/구분별), 시상식 레이어.
- 데이터에 공연별 날짜가 없어 투어 시작~종료 기간 막대로 표시. 칩 클릭 → 상세 모달(관객·추정 관객·매출·등급·출처 URL·artist_id 조인).
- ‘차트·표’ 하위 탭에 기존 차트 유지.
- 캐시 우회: `?v=<분 단위 타임스탬프>`. 헤더 오른쪽에 라이브/폴백 상태 표시.

## 구조
- `index.html`, `css/style.css`, `js/config.js`(설정), `js/core.js`(로더·등급·조인·표·차트 헬퍼), `js/tabs.js`(탭별 렌더러), `js/app.js`(초기화)
- `vendor/echarts.min.js` (ECharts 5.5.1 로컬, 실패 시 CDN)
- `tools/shoot.py` 전 탭 스크린샷+JS 오류 검사, `tools/check.py` 필터·폴백·라이트 테마 회귀, `tools/build_offline.py` 오프라인 단일 HTML 생성, `tools/check_store.py` 저장소 고정값·조인 검증, `tools/sync_data.sh` 스냅샷 동기화
  (`/workspace/.venv-pw/bin/python tools/shoot.py`)
