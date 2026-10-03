/* ===== core: 데이터 로딩, 정확도, 포맷, 표, 차트 헬퍼 ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNum = v => typeof v === 'number' && isFinite(v);

/* ---------- 데이터 로딩 ---------- */
const D = {};          // 로드된 JSON
const LOADINFO = {};   // 파일별 사용된 base
async function fetchJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function loadAll() {
  const qp = new URLSearchParams(location.search).get('data');
  const bases = [...new Set([qp, DATA_BASE, ...FALLBACK_BASES].filter(Boolean))];
  const bust = 'v=' + Math.floor(Date.now() / 60000); // 1분 단위 캐시 우회
  await Promise.all(DATA_FILES.map(async f => {
    let lastErr;
    for (const b of bases) {
      try { D[f] = await fetchJSON(b + f + '.json?' + bust); LOADINFO[f] = b; return; }
      catch (e) { lastErr = e; }
    }
    if (window.KPD_EMBED && window.KPD_EMBED[f]) { D[f] = window.KPD_EMBED[f]; LOADINFO[f] = 'embedded'; return; } // 오프라인 단일 파일 변형용 스냅샷
    D[f] = null; LOADINFO[f] = null; console.warn('load failed', f, lastErr);
  }));
  return LOADINFO;
}

/* ---------- 정확도 ---------- */
const ACC = {
  verified:   { label: '검증됨',            color: '#22c55e' },
  partial:    { label: '부분 확인',         color: '#60a5fa' },
  conflict:   { label: '충돌',              color: '#ef4444' },
  unverified: { label: '미확인',            color: '#9ca3af' },
  grok:       { label: 'Grok 대화 기준',     color: '#c084fc' },
  claude:     { label: 'Claude 리서치 기준', color: '#f59e0b' },
  estimate:   { label: '추정치',            color: '#f472b6' },
};
const ACC_KEYS = Object.keys(ACC);
// forecast(전망)는 추정치 그룹으로 필터링, 배지는 ‘전망’으로 표시
const STATUS_GROUP = s => s === 'forecast' ? 'estimate' : (ACC[s] ? s : 'unverified');
const S = { acc: new Set(ACC_KEYS) };
/** row의 정확도 키 목록: status + (estimate) */
function accKeys(status, estimate) {
  const k = new Set([STATUS_GROUP(status || 'unverified')]);
  if (estimate) k.add('estimate');
  return [...k];
}
const accVisible = (status, estimate) => accKeys(status, estimate).every(k => S.acc.has(k));

function badge(status, opt = {}) {
  if (!status) return '';
  if (status === 'forecast') return `<span class="badge b-estimate" title="전망치 — 추정치 필터에 포함">전망</span>`;
  const a = ACC[status]; if (!a) return `<span class="badge b-unverified">${esc(status)}</span>`;
  return `<span class="badge b-${status}">${a.label}</span>`;
}
const estBadge = (txt = '추정치') => `<span class="badge b-estimate">${esc(txt)}</span>`;
const badges = (status, est, estTxt) => badge(status) + (est && status !== 'estimate' && status !== 'forecast' ? ' ' + estBadge(estTxt) : '');
const estOn = () => S.acc.has('estimate');

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
      : `<tr><td colspan="${cols.length}"><div class="hidden-note">${opts.empty || '표시할 행이 없습니다 (정확도 필터를 확인하세요)'}</div></td></tr>`;
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
const hiddenNote = (what = '이 섹션') => `<div class="hidden-note">${what}은(는) 현재 정확도 필터로 숨겨져 있습니다.</div>`;
const sectionVisible = (status, est) => accVisible(status, est);
