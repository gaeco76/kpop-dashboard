/* ===== 데이터 소스 설정 =====
 * DATA_BASE 하나만 바꾸면 됩니다. URL 쿼리 ?data=<base>/ 로도 일시 변경 가능.
 * 기본(라이브) 로드 실패 시 FALLBACK_BASES 순서대로 시도합니다.
 */
const DATA_BASE = 'https://gaeco76.github.io/kpop-research/data/';
const FALLBACK_BASES = ['../kpop/site/data/', './data/'];
const DATA_FILES = ['meta','tours','tracker','social','events','industry','artists','auditions','rpd','sources'];
