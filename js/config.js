/* ===== 데이터 소스 설정 =====
 * 원본: 공용 데이터 저장소 /workspace/data/kpop/<주제>/*.json (README §2 등급·출처 규칙)
 * - 로컬(/workspace를 정적 서버로 연 경우): ../data/kpop/ (저장소 직접)
 * - GitHub Pages: ./data/kpop/ (tools/sync_data.sh 로 만든 저장소 스냅샷 — Pages는 /workspace를 못 읽음)
 * - 최후 폴백: 리서치 사이트의 구형 평면 JSON (gaeco76/kpop-research Pages, 새 수치 레코드 파일 없음)
 * URL ?data=<base>/ 로 저장소 구조 base를 일시 지정 가능.
 */
const STORE_LOCAL = '../data/kpop/';
const STORE_SNAPSHOT = './data/kpop/';
const LEGACY_BASE = 'https://gaeco76.github.io/kpop-research/data/';
// 화면 키 → 저장소 경로(주제/파일). 구형 평면 폴백은 파일명만 사용.
const DATA_PATHS = {
  meta: 'sources/meta', sources: 'sources/sources',
  tours: 'tours/tours', tracker: 'tours/tracker', hybe: 'tours/hybe', tourFigures: 'tours/kpop_tours_figures',
  social: 'artists/social', artists: 'artists/artists', socialFigures: 'artists/kpop_social_figures',
  events: 'events/events', auditions: 'events/auditions', industry: 'industry/industry', rpd: 'rpd/rpd',
};
const DATA_FILES = Object.keys(DATA_PATHS);
const OPTIONAL_FILES = ['hybe', 'tourFigures', 'socialFigures'];  // 실패해도 해당 부분만 안내/대체
const STORE_ONLY = ['tourFigures', 'socialFigures'];              // 구형 평면 폴백에는 없음
const ON_PAGES = /github\.io$/.test(location.hostname);
