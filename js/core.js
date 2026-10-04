/* ===== core: 데이터 로딩, 정확도, 포맷, 표, 차트 헬퍼 ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNum = v => typeof v === 'number' && isFinite(v);

/* ---------- 데이터 로딩 ---------- */
const D = {};          // 로드된 JSON
const LOADINFO = {};   // 파일별 사용된 source id
let SNAPSHOT = null;   // ./data/kpop/SNAPSHOT.json (동기화 시각·검증 상태)
async function fetchJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return await r.json();
  } finally { clearTimeout(t); }
}
function dataSources() {
  const qp = new URLSearchParams(location.search).get('data');
  const L = [];
  if (qp) L.push({ id: 'custom', base: qp, layout: 'store', label: '지정 경로' });
  if (!ON_PAGES && location.protocol !== 'file:') L.push({ id: 'store', base: STORE_LOCAL, layout: 'store', label: '공용 저장소 /workspace/data/kpop' });
  if (location.protocol !== 'file:') L.push({ id: 'snapshot', base: STORE_SNAPSHOT, layout: 'store', label: '저장소 스냅샷 (data/kpop)' });
  L.push({ id: 'legacy', base: LEGACY_BASE, layout: 'flat', label: '구형 라이브 폴백 (kpop-research)' });
  return L;
}
async function loadAll() {
  const bust = 'v=' + Math.floor(Date.now() / 60000);
  const SRC = dataSources();
  await Promise.all(DATA_FILES.map(async f => {
    let lastErr;
    if (!window.KPD_EMBED) for (const s of SRC) {
      if (s.layout === 'flat' && STORE_ONLY.includes(f)) continue;
      const url = s.base + (s.layout === 'store' ? DATA_PATHS[f] : DATA_PATHS[f].split('/').pop()) + '.json?' + bust;
      try { D[f] = await fetchJSON(url); LOADINFO[f] = s.id; return; } catch (e) { lastErr = e; }
    }
    if (window.KPD_EMBED && window.KPD_EMBED[f]) { D[f] = window.KPD_EMBED[f]; LOADINFO[f] = 'embedded'; return; }
    D[f] = null; LOADINFO[f] = null; if (!OPTIONAL_FILES.includes(f)) console.warn('load failed', f, lastErr);
  }));
  if (window.KPD_EMBED) SNAPSHOT = window.KPD_EMBED.__snapshot || null;
  else if (Object.values(LOADINFO).includes('snapshot')) { try { SNAPSHOT = await fetchJSON(STORE_SNAPSHOT + 'SNAPSHOT.json?' + bust); } catch (e) { } }
  DATA_FILES.forEach(f => D[f] && normalizeStore(D[f]));
  buildFigIndex(); applyFigures();
  return LOADINFO;
}
/** 저장소 형식 정규화: source_ids → sources(화면 출처 칩), grade(한글) → status(내부 키). 원본 status는 status_legacy로 보존 */
function normalizeStore(o) {
  if (Array.isArray(o)) { o.forEach(normalizeStore); return; }
  if (!o || typeof o !== 'object') return;
  if (o.source_ids && !o.sources) o.sources = o.source_ids;
  if (o.grade && GRADE_KEY[o.grade]) { if (o.status && o.status_legacy === undefined) o.status_legacy = o.status; o.status = GRADE_KEY[o.grade]; }
  for (const k in o) if (o[k] && typeof o[k] === 'object') normalizeStore(o[k]);
}
/* 수치 레코드 인덱스: subject("아티스트 투어") → metric → 최신 레코드 */
const FIG = new Map();
function buildFigIndex() {
  FIG.clear();
  for (const f of ['tourFigures', 'socialFigures']) for (const r of (D[f]?.records || [])) {
    const k = r.subject; if (!FIG.has(k)) FIG.set(k, {});
    const m = FIG.get(k); if (!m[r.metric] || (r.collected_at || '') >= (m[r.metric].collected_at || '')) m[r.metric] = r;
  }
}
/* 수치 레코드 → 화면 행 필드 덮어쓰기 + 지표별 등급(row._g[field]) 기록. 차트는 레코드 값·등급을 우선 사용 */
const FIG_MAP = {
  tours:   [['gross', 'gross'], ['attendance', 'attendance'], ['shows', 'shows']],
  tracker: [['attendance', 'attendance'], ['gross', 'revenue'], ['shows', 'shows'], ['cities', 'cities'], ['attendance_model_estimate', 'estimate']],
  hybe:    [['attendance', 'attendance'], ['gross', 'gross'], ['shows', 'shows'], ['cities', 'cities'], ['shows_done', 'done'], ['shows_left', 'left']],
};
const FIG_DIFF = []; let FIG_HITS = 0;
function applyFigures() {
  FIG_DIFF.length = 0; FIG_HITS = 0;
  for (const [f, map] of Object.entries(FIG_MAP)) for (const row of (D[f]?.tours || [])) {
    row._g = row._g || {}; row._rec = row._rec || {};
    for (const [metric, field] of map) {
      const r = figOf(row, metric); if (!r || !isNum(r.value)) continue;
      // 행 값이 없으면 채우지 않음: subject가 데이터셋 간 겹칠 수 있음(예: 트래커·하이브의 "BTS WORLD TOUR 'ARIRANG'") → 교차 오염 방지
      if (!isNum(row[field])) { if (row[field] == null) FIG_DIFF.push({ file: f, subject: r.subject, field, row: null, record: r.value, skipped: true }); continue; }
      FIG_HITS++;
      if (row[field] !== r.value) FIG_DIFF.push({ file: f, subject: r.subject, field, row: row[field], record: r.value });
      row[field] = r.value; row._g[field] = GRADE_KEY[r.grade] || 'unverified'; row._rec[field] = r;
    }
  }
  if (FIG_DIFF.length) console.info('수치 레코드와 행 값 차이', FIG_DIFF);
}
/* ---------- artist_id 조인 (트래커·하이브·소셜) ---------- */
let ARTISTS = null;
function artistIndex() {
  if (ARTISTS) return ARTISTS;
  ARTISTS = new Map();
  const get = id => { if (!ARTISTS.has(id)) ARTISTS.set(id, { id, ko: null, en: null, tracker: [], hybe: [], yt: null, ig: [] }); return ARTISTS.get(id); };
  (D.tracker?.tours || []).forEach((t, i) => { if (!t.artist_id) return; const a = get(t.artist_id); a.ko = a.ko || t.artist; a.tracker.push(i); });
  (D.hybe?.tours || []).forEach((t, i) => { if (!t.artist_id) return; const a = get(t.artist_id); a.en = a.en || t.artist; a.hybe.push(i); });
  (D.social?.youtube?.rows || []).forEach(r => { if (!r.artist_id) return; const a = get(r.artist_id); a.ko = a.ko || r.ko; a.en = a.en || r.group; a.ytRow = r; });
  (D.socialFigures?.records || []).forEach(r => { if (!r.artist_id) return; const a = get(r.artist_id);
    if (r.metric === 'youtube_subscribers' && (!a.yt || (r.collected_at || '') >= (a.yt.collected_at || ''))) a.yt = r;
    if (r.metric === 'instagram_followers') a.ig.push(r); });
  return ARTISTS;
}
const artistById = id => id ? artistIndex().get(id) || null : null;
const artistByName = name => { const n = String(name || '').toLowerCase(); for (const a of artistIndex().values()) if ([a.en, a.ko, a.ytRow?.group].some(x => x && x.toLowerCase() === n)) return a; return null; };
/** 유튜브 구독자 칩 (등급 포함) */
function ytChip(a) {
  if (!a) return '';
  const r = a.yt; const v = r ? r.value : a.ytRow?.subs;
  if (!isNum(v)) return '';
  return `<span class="ytchip" title="${esc(r ? `${r.subject} · ${r.as_of || ''} · 수집 ${r.collected_at}` : '소셜 탭 유튜브 표')}">▶ ${fmtKo(v, 1)}</span>${r ? badge({ status: GRADE_KEY[r.grade], collected_at: r.collected_at, primary_source: r.primary_source }) : ''}`;
}
/** 지표 등급 키: 레코드 등급 → 없으면 행 등급 */
const gradeOf = (row, field) => (row && row._g && row._g[field]) || STATUS_GROUP(row?.status || 'unverified');
/** 등급별 막대 스타일: 추정=빗금, 개략=점선 테두리, 미확=흐리게+점선, 충돌=빨간 테두리 */
function gradeStyle(color, g, extra = {}) {
  if (g === 'estimate') return estStyle(color, extra);
  if (g === 'rough') return { color, opacity: .8, borderColor: '#2dd4bf', borderType: 'dotted', borderWidth: 1.5, ...extra };
  if (g === 'unverified') return { color, opacity: .45, borderColor: '#9ca3af', borderType: 'dashed', borderWidth: 1, ...extra };
  if (g === 'conflict') return { color, borderColor: '#ef4444', borderWidth: 1.5, ...extra };
  return { color, ...extra };
}
/** 행(row)의 metric 레코드 — subject = "artist tour" (트래커는 한글명, 하이브·박스스코어는 영문명) */
const figOf = (row, metric) => row ? (FIG.get(`${row.artist} ${row.tour}`) || {})[metric] || null : null;
/** 차트용: 레코드 값·등급 우선, 없으면 행 필드 */
function figVal(row, metric, field) {
  const r = figOf(row, metric);
  if (r && isNum(r.value)) return { value: r.value, status: GRADE_KEY[r.grade] || 'unverified', rec: r };
  const v = row ? row[field || metric] : null;
  return { value: isNum(v) ? v : null, status: row?.status || 'unverified', rec: null };
}

/* ---------- 등급 (README: 확정·부분·개략·충돌·미확·추정) ---------- */
const GRADE_KEY = { '확정': 'verified', '부분': 'partial', '개략': 'rough', '충돌': 'conflict', '미확': 'unverified', '추정': 'estimate' };
const ACC = {
  verified:   { label: '확정', color: '#22c55e', desc: '인용 출처로 확인됨' },
  partial:    { label: '부분', color: '#60a5fa', desc: '일부만 출처로 확인 (일부 회차·기간)' },
  rough:      { label: '개략', color: '#2dd4bf', desc: '대략값 (반올림·“약/+” 보도)' },
  conflict:   { label: '충돌', color: '#ef4444', desc: '출처끼리 값이 다름 (note 참고)' },
  unverified: { label: '미확', color: '#9ca3af', desc: '아직 확인 안 됨' },
  estimate:   { label: '추정', color: '#f472b6', desc: '출처 없는 값·모델·AI 대화 추정' },
};
const ACC_KEYS = Object.keys(ACC);
// 구형 status(배열 행 등 grade 없는 곳): claude·grok·forecast → 추정 (저장소 규칙: AI 대화값은 원문 확인 전 미확/추정)
const LEGACY_STATUS = { claude: 'estimate', grok: 'estimate', forecast: 'estimate' };
const STATUS_GROUP = s => GRADE_KEY[s] || LEGACY_STATUS[s] || (ACC[s] ? s : 'unverified');
const S = { acc: new Set(ACC_KEYS) };
/** row의 등급 키 목록: status + (estimate) */
function accKeys(status, estimate) {
  if (status && typeof status === 'object') status = status.status;
  const k = new Set([STATUS_GROUP(status || 'unverified')]);
  if (estimate) k.add('estimate');
  return [...k];
}
const accVisible = (status, estimate) => accKeys(status, estimate).every(k => S.acc.has(k));

/** 등급 배지. 문자열(status/한글 등급) 또는 레코드 객체(grade·collected_at·source_note·primary_source 표시) */
function badge(x, opt = {}) {
  if (!x) return '';
  const obj = typeof x === 'object' ? x : null;
  const status = obj ? obj.status : x;
  if (!status) return '';
  const key = STATUS_GROUP(status), a = ACC[key];
  const lbl = status === 'forecast' ? '전망' : a.label;
  const tip = [a.desc, obj?.collected_at ? `수집 ${obj.collected_at}` : '', obj?.status_legacy && obj.status_legacy !== key ? `구형 표기: ${obj.status_legacy}` : '', ...(obj?.source_note || [])].filter(Boolean).join(' · ');
  const wiki = obj && obj.primary_source === false ? `<span class="wk" title="1차 출처 없음 — 위키 등 2차 출처만">2차</span>` : '';
  return `<span class="badge b-${key}" title="${esc(tip)}">${lbl}</span>${wiki}`;
}
const estBadge = (txt = '추정') => `<span class="badge b-estimate">${esc(txt)}</span>`;
const badges = (status, est, estTxt) => badge(status) + (est && STATUS_GROUP(typeof status === 'object' ? status?.status : status) !== 'estimate' ? ' ' + estBadge(estTxt) : '');
const estOn = () => S.acc.has('estimate');
/** 레코드의 source_url 배열 → 링크 칩 */
function urlLinks(urls, mode = 'chip') {
  if (!urls || !urls.length) return '';
  return urls.map((u, i) => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { }
    return mode === 'list' ? `<a href="${esc(u)}" target="_blank" rel="noopener">↗ ${esc(h)}</a>` : `<a class="src" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">${i + 1}</a>`; }).join(mode === 'list' ? '<br>' : '');
}

/* ---------- 출처 ---------- */
function srcLinks(keys, mode = 'chip') {
  if (!keys || !keys.length) return '';
  const S_ = D.sources || {};
  return keys.map((k, i) => {
    const s = S_[k]; const title = s ? s.title : k;
    if (mode === 'list') return s && s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">↗ ${esc(title)}</a>` : `<a>• ${esc(title)}</a>`;
    return s && s.url ? `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(title)}">${i + 1}</a>`
                      : `<span class="src" title="${esc(title)} (URL 없음)">${i + 1}</span>`;
  }).join('');
}

/* ---------- 포맷 ---------- */
const nf = new Intl.NumberFormat('ko-KR');
const fmtN = v => isNum(v) ? nf.format(v) : '—';
function fmtUSD(v, d = 1) {
  if (!isNum(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(d) + 'M';
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v;
}
function fmtKo(v, d = 1) { // 한국식 단위
  if (!isNum(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e8) return +(v / 1e8).toFixed(d + 1) + '억';
  if (a >= 1e4) return +(v / 1e4).toFixed(d) + '만';
  return nf.format(v);
}
const fmtEok = v => isNum(v) ? nf.format(v) + '억' : '—';
const nullCell = (txt = '미확인') => `<span class="nullval">${txt}</span>`;
/** "1억 2,600만", "4,300만", "47억", "~260k", "~4.5M" → number */
function parseKNum(s) {
  if (s == null) return null; if (isNum(s)) return s;
  s = String(s).replace(/[,\s~약원$]/g, '');
  let m;
  if ((m = s.match(/^([\d.]+)([kKmMbB])/))) return +m[1] * { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()];
  const pre = (s.match(/^(?:[\d.]+(?:조|억|만|천))*(?:[\d.]+)?/) || [''])[0];
  if (!pre || !/\d/.test(pre)) return null;
  let total = 0; const re = /([\d.]+)(조|억|만|천)?/g;
  while ((m = re.exec(pre))) total += +m[1] * ({ '조': 1e12, '억': 1e8, '만': 1e4, '천': 1e3 }[m[2]] || 1);
  return total;
}
function parseRange(s) { // "4,300만–1억 2,600만"
  if (s == null) return [null, null];
  const parts = String(s).split(/[–~\-]/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) { const v = parseKNum(parts[0]); return [v, v]; }
  let lo = parts[0], hi = parts[1];
  // 단위가 뒤에만 있으면 앞값에 같은 단위 적용 (예: 30만–150만 은 이미 OK, 5–10분)
  const unit = hi.match(/(억|만|천|[kKmM])$/);
  if (unit && !/(억|만|천|[kKmM])/.test(lo)) lo += unit[1];
  return [parseKNum(lo), parseKNum(hi)];
}

/* ---------- 정렬 가능한 표 ---------- */
/**
 * cols: [{k,label,num,html(row),val(row),cls,title}]
 * opts: {rows, sort:{k,dir}, rowClass(row), search:[keys], tools: html, empty}
 */
function DataTable(el, cols, opts) {
  const st = { k: opts.sort?.k, dir: opts.sort?.dir || 'desc', q: '' };
  el.innerHTML = `<div class="tbl-tools">${opts.search ? `<input type="search" placeholder="검색…">` : ''}${opts.tools || ''}<span class="count"></span></div><div class="tablewrap" style="${opts.maxH ? 'max-height:' + opts.maxH + 'px' : ''}"><table class="dt"><thead></thead><tbody></tbody></table></div>`;
  const thead = $('thead', el), tbody = $('tbody', el), cnt = $('.count', el);
  const valOf = (c, r) => c.val ? c.val(r) : r[c.k];
  function draw() {
    let rows = (typeof opts.rows === 'function' ? opts.rows() : opts.rows).slice();
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(r => opts.search.some(k => String(typeof k === 'function' ? k(r) : r[k] ?? '').toLowerCase().includes(q))); }
    if (st.k != null) {
      const c = cols.find(c => c.k === st.k);
      if (c) {
        const coll = new Intl.Collator('ko', { numeric: true });
        rows.sort((a, b) => {
          const va = valOf(c, a), vb = valOf(c, b);
          const na = va == null || va === '' || (typeof va === 'number' && isNaN(va)), nb = vb == null || vb === '' || (typeof vb === 'number' && isNaN(vb));
          if (na && nb) return 0; if (na) return 1; if (nb) return -1; // null은 항상 아래
          const r = (typeof va === 'number' && typeof vb === 'number') ? va - vb : coll.compare(String(va), String(vb));
          return st.dir === 'asc' ? r : -r;
        });
      }
    }
    thead.innerHTML = '<tr>' + cols.map(c => `<th class="${c.num ? 'num' : ''} ${c.nosort ? '' : 'sortable'}" data-k="${esc(c.k)}" title="${esc(c.title || '')}">${esc(c.label)}${st.k === c.k ? `<span class="arr">${st.dir === 'asc' ? '▲' : '▼'}</span>` : ''}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows.length ? rows.map((r, i) => `<tr class="${opts.rowClass ? opts.rowClass(r) : ''}">` + cols.map(c => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.html ? c.html(r, i) : esc(r[c.k] ?? '')}</td>`).join('') + '</tr>').join('')
      : `<tr><td colspan="${cols.length}"><div class="hidden-note">${opts.empty || '표시할 행이 없습니다 (등급 필터를 확인하세요)'}</div></td></tr>`;
    const total = (typeof opts.rows === 'function' ? opts.rows() : opts.rows).length;
    cnt.textContent = `${rows.length}행` + (opts.totalHint ? ` / 전체 ${opts.totalHint()}행` : (rows.length !== total ? ` / ${total}행` : ''));
  }
  thead.addEventListener('click', e => {
    const th = e.target.closest('th.sortable'); if (!th) return;
    const k = th.dataset.k; const c = cols.find(c => String(c.k) === k);
    if (st.k === c.k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.k = c.k; st.dir = c.num ? 'desc' : 'asc'; }
    draw();
  });
  const inp = $('input[type=search]', el); if (inp) inp.addEventListener('input', () => { st.q = inp.value.trim(); draw(); });
  draw();
  return { draw, el };
}

/* ---------- 차트 ---------- */
const CHARTS = new Map();
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function themeColors() {
  return { text: cssVar('--text'), muted: cssVar('--muted'), line: cssVar('--line'), line2: cssVar('--line2'), card: cssVar('--card'), card2: cssVar('--card2') };
}
const PAL = ['#7c6cff', '#22d3ee', '#f472b6', '#f59e0b', '#22c55e', '#60a5fa', '#a78bfa', '#fb7185', '#34d399', '#facc15', '#38bdf8', '#e879f9'];
const TYPE_COLOR = { girl: '#f472b6', boy: '#60a5fa', coed: '#a78bfa', solo: '#f59e0b' };
const TYPE_LABEL = { girl: '걸그룹', boy: '보이그룹', coed: '혼성', solo: '솔로' };
/** 추정치 해칭(decal) */
const DECAL = { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 4], rotation: -Math.PI / 4, color: 'rgba(255,255,255,0.45)' };
const estStyle = (color, extra = {}) => ({ color, opacity: 0.55, decal: DECAL, borderColor: color, borderType: 'dashed', borderWidth: 1, ...extra });
const solidStyle = (color, extra = {}) => ({ color, ...extra });

function baseOption() {
  const c = themeColors();
  return {
    backgroundColor: 'transparent', color: PAL, animationDuration: 500,
    textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: c.text },
    grid: { left: 10, right: 20, top: 30, bottom: 10, containLabel: true },
    tooltip: {
      confine: true, enterable: true, backgroundColor: c.card, borderColor: c.line2, borderWidth: 1, padding: [8, 10],
      textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'box-shadow:0 10px 30px rgba(0,0,0,.35);border-radius:10px;', className: 'ech-tip',
    },
    legend: { textStyle: { color: c.muted, fontSize: 12 }, icon: 'roundRect', itemWidth: 12, itemHeight: 8, top: 0, type: 'scroll', pageTextStyle: { color: c.muted } },
  };
}
function axisStyle(extra = {}) {
  const c = themeColors();
  return Object.assign({
    axisLine: { lineStyle: { color: c.line2 } }, axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.line, type: 'dashed' } },
    nameTextStyle: { color: c.muted, fontSize: 11 },
  }, extra);
}
function deepMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
function chart(el, option) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return null;
  let inst = echarts.getInstanceByDom(el);
  if (inst) inst.dispose();
  inst = echarts.init(el, null, { renderer: 'canvas' });
  inst.setOption(deepMerge(baseOption(), option));
  CHARTS.set(el, inst);
  return inst;
}
function resizeVisible() { for (const [el, c] of CHARTS) { if (!document.body.contains(el)) { CHARTS.delete(el); continue; } if (el.offsetParent) c.resize(); } }
window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(resizeVisible, 120); });

/** 툴팁 HTML */
function tipHTML({ title, rows = [], status, estimate, estTxt, note, sources }) {
  return `<div class="t">${esc(title)}</div>` +
    rows.filter(Boolean).map(([k, v]) => `<div class="row"><span class="muted">${esc(k)}</span><span>${v}</span></div>`).join('') +
    (status || estimate ? `<div style="margin-top:5px">${badges(status, estimate, estTxt)}</div>` : '') +
    (note ? `<div class="n">${esc(note).slice(0, 260)}${note.length > 260 ? '…' : ''}</div>` : '') +
    (sources && sources.length ? `<div class="srcs">${srcLinks(sources, 'list')}</div>` : '');
}

/* ---------- 카드/레이아웃 헬퍼 ---------- */
function card({ title, sub = '', tools = '', body = '', foot = '', cls = '', id = '' }) {
  return `<div class="card ${cls}" ${id ? `id="${id}"` : ''}><div class="card-h"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${tools ? `<div class="card-tools">${tools}</div>` : ''}</div>${body}${foot ? `<div class="card-foot">${foot}</div>` : ''}</div>`;
}
const chartDiv = (id, h = '') => `<div class="chart ${h}" id="${id}"></div>`;
function seg(id, items, on) { return `<div class="seg" id="${id}">${items.map(([v, l]) => `<button data-v="${esc(v)}" class="${v === on ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; }
function bindSeg(id, cb) {
  const el = document.getElementById(id); if (!el) return;
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
}
const hiddenNote = (what = '이 섹션') => `<div class="hidden-note">${what}은(는) 현재 등급 필터로 숨겨져 있습니다.</div>`;
const sectionVisible = (status, est) => accVisible(status, est);
