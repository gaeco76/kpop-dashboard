/* ===== 투어 트래커: 주간 캘린더 ===== */
const DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];
const dn = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null; };
const dstr = n => new Date(n * DAY).toISOString().slice(0, 10);
const dparts = n => { const d = new Date(n * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: (d.getUTCDay() + 6) % 7 }; };
const todayDn = () => Math.floor((Date.now() + 9 * 3600e3) / DAY);       // KST 오늘
const weekStartOf = n => n - dparts(n).dow;                               // 월요일 시작
const msToDn = ms => Math.round((ms + 9 * 3600e3) / DAY);
function isoWeek(n) { const p = dparts(n); const th = n - p.dow + 3; const y = dparts(th).y; const jan4 = Date.UTC(y, 0, 4) / DAY; return { y, w: 1 + Math.round((th - (jan4 - dparts(jan4).dow + 3)) / 7) }; }
const fmtMD = n => { const p = dparts(n); return `${p.m}/${p.d}`; };

const CAL = { view: 'week', cursor: null, group: 'all', regions: new Set(), q: '', color: 'artist', awards: false, sub: 'cal' };
const CAL_REGIONS = [...REGION_KEYS, ['다지역·대륙', /대륙|권역|다지역/]];
const ART_PAL = ['#7c6cff', '#22d3ee', '#f472b6', '#f59e0b', '#22c55e', '#60a5fa', '#e879f9', '#fb7185', '#34d399', '#facc15', '#38bdf8', '#a3e635', '#f97316', '#c084fc', '#2dd4bf', '#ef4444'];
let __artIdx = null;
function artistColor(a) { // 아티스트 목록(이름순) 기준 황금각 색상 → 인접 그룹끼리 색이 겹치지 않음
  if (!__artIdx) { __artIdx = new Map([...new Set((D.tracker?.tours || []).map(t => t.artist))].sort((x, y) => x.localeCompare(y, 'ko')).map((n, i) => [n, i])); }
  const i = __artIdx.get(a) ?? 0; return `hsl(${Math.round((i * 137.508) % 360)} ${[66, 55, 72][i % 3]}% ${[50, 62, 42][i % 3]}%)`;
}
const calColor = t => CAL.color === 'artist' ? artistColor(t.artist) : (TYPE_COLOR[t.group] || PAL[0]);

function calItems() {
  const tours = (D.tracker?.tours || []).map((t, i) => ({ t, i }));
  const out = [], undated = [];
  for (const { t, i } of tours) {
    if (!accVisible(t.status)) continue;
    if (CAL.group !== 'all' && t.group !== CAL.group) continue;
    if (CAL.regions.size && ![...CAL.regions].some(k => CAL_REGIONS.find(r => r[0] === k)[1].test(t.region || ''))) continue;
    if (CAL.q && !(t.artist + ' ' + t.tour).toLowerCase().includes(CAL.q.toLowerCase())) continue;
    const sp = trackerSpan(t);
    if (sp.unknown) { undated.push({ t, i }); continue; }
    out.push({ kind: 'tour', t, i, s: msToDn(sp.s), e: msToDn(sp.e), dashS: sp.dashS, dashE: sp.dashE,
      unconf: sp.dashS || sp.dashE || t.status === 'unverified' || t.status === 'conflict',
      estAtt: !isNum(t.attendance) && !!t.estimateText });
  }
  if (CAL.awards) (D.events?.awards2026?.events || []).forEach((e, i) => {
    if (!accVisible(e.status) || !e.dateSort) return;
    const s = dn(e.dateSort); const m = String(e.date).match(/[–-](\d{1,2})$/); const e2 = m ? s + Math.max(0, +m[1] - dparts(s).d) : s;
    if (CAL.q && !(e.name + ' ' + e.lineup).toLowerCase().includes(CAL.q.toLowerCase())) return;
    out.push({ kind: 'award', ev: e, i, s, e: e2 });
  });
  out.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  return { items: out, undated };
}

function renderTracker() {
  const el = $('#tab-tracker'); const TRD = D.tracker || {};
  if (CAL.cursor == null) CAL.cursor = weekStartOf(todayDn());
  el.innerHTML = `
  <div class="page-head"><div><h1>해외 투어 트래커 (2025–2027)</h1><p>${esc(TRD.intro || '')} Claude 원자료 기준일 ${esc(TRD.claudeCut || '')}.</p></div>
    <div class="card-tools">${seg('tkSub', [['cal', '📅 주간 캘린더'], ['charts', '📊 차트·표']], CAL.sub)}</div></div>
  <div id="tkCalWrap" ${CAL.sub === 'cal' ? '' : 'hidden'}></div>
  <div id="tkChartsWrap" ${CAL.sub === 'charts' ? '' : 'hidden'}></div>`;
  bindSeg('tkSub', v => { CAL.sub = v; $('#tkCalWrap').hidden = v !== 'cal'; $('#tkChartsWrap').hidden = v !== 'charts'; if (v === 'charts' && !$('#tkChartsWrap').dataset.done) { renderTrackerCharts($('#tkChartsWrap')); $('#tkChartsWrap').dataset.done = 1; } requestAnimationFrame(resizeVisible); });
  renderCalendar($('#tkCalWrap'));
  if (CAL.sub === 'charts') { renderTrackerCharts($('#tkChartsWrap')); $('#tkChartsWrap').dataset.done = 1; }
}

function renderCalendar(wrap) {
  wrap.innerHTML = `
  <div class="banner info small">📌 데이터에는 <b>공연(회차)별 날짜가 없고 투어 시작·종료일만</b> 있어, 각 투어를 기간 막대로 주(週) 행에 걸쳐 표시합니다. 시작/종료일 미정 투어는 임시 구간(빗금·점선, ‘?’ 표시)으로, 날짜가 전혀 없는 투어는 아래 ‘날짜 미정’ 목록에 둡니다.</div>
  <div class="cal-toolbar card">
    <div class="cal-nav">
      <button class="btn" id="calPrev" title="이전">◀</button>
      <button class="btn" id="calToday">이번 주</button>
      <button class="btn" id="calNext" title="다음">▶</button>
      <div class="cal-title" id="calTitle"></div>
    </div>
    <div class="cal-tools">
      ${seg('calView', [['week', '주'], ['month', '월']], CAL.view)}
      <input type="date" id="calDate" title="날짜로 이동" min="2024-01-01" max="2027-12-31">
      <input type="month" id="calMonth" title="월로 이동" min="2024-01" max="2027-12">
      ${seg('calGroup', [['all', '전체'], ['girl', '걸그룹'], ['boy', '보이그룹'], ['solo', '솔로']], CAL.group)}
      ${seg('calColor', [['artist', '색: 그룹별'], ['type', '색: 구분별']], CAL.color)}
      <input type="search" id="calQ" placeholder="아티스트·투어 검색" value="${esc(CAL.q)}">
      <label class="tog"><input type="checkbox" id="calAw" ${CAL.awards ? 'checked' : ''}> 시상식 표시</label>
    </div>
    <div class="cal-regions"><span class="small muted">권역</span> ${CAL_REGIONS.map(([k]) => `<span class="chip ${CAL.regions.has(k) ? 'on' : ''}" data-r="${esc(k)}">${esc(k)}</span>`).join('')}
      <span class="cal-legend small muted"><i class="lg lg-solid"></i>확정 일정 <i class="lg lg-unconf"></i>일정 미확정(임시 구간) <i class="lg lg-est"></i>관객 추정치만 존재 <i class="lg lg-aw"></i>시상식 ◀▶ 주 경계 넘어 계속</span></div>
  </div>
  <div class="cal-layout">
    <div class="cal-main card" id="calMain"></div>
    <aside class="cal-side">
      <div class="card" id="calSummary"></div>
      <div class="card" id="calUndated"></div>
    </aside>
  </div>
  <div class="cal-artlegend" id="calArtLegend"></div>`;
  const redraw = () => drawCalendar();
  $('#calPrev').onclick = () => { CAL.cursor = CAL.view === 'week' ? CAL.cursor - 7 : monthShift(CAL.cursor, -1); redraw(); };
  $('#calNext').onclick = () => { CAL.cursor = CAL.view === 'week' ? CAL.cursor + 7 : monthShift(CAL.cursor, 1); redraw(); };
  $('#calToday').onclick = () => { CAL.cursor = weekStartOf(todayDn()); redraw(); };
  $('#calDate').onchange = e => { const n = dn(e.target.value); if (n != null) { CAL.cursor = weekStartOf(n); CAL.view = 'week'; syncSeg('calView', 'week'); redraw(); } };
  $('#calMonth').onchange = e => { const n = dn(e.target.value + '-01'); if (n != null) { CAL.cursor = n; CAL.view = 'month'; syncSeg('calView', 'month'); redraw(); } };
  bindSeg('calView', v => { CAL.view = v; if (v === 'week') CAL.cursor = weekStartOf(CAL.cursor); redraw(); });
  bindSeg('calGroup', v => { CAL.group = v; redraw(); });
  bindSeg('calColor', v => { CAL.color = v; redraw(); });
  $('#calQ').oninput = e => { CAL.q = e.target.value.trim(); redraw(); };
  $('#calAw').onchange = e => { CAL.awards = e.target.checked; redraw(); };
  $('.cal-regions').onclick = e => { const c = e.target.closest('.chip[data-r]'); if (!c) return; const k = c.dataset.r; CAL.regions.has(k) ? CAL.regions.delete(k) : CAL.regions.add(k); c.classList.toggle('on'); redraw(); };
  $('#calMain').onclick = e => { const c = e.target.closest('[data-k]'); if (c) openCalDetail(c.dataset.k, +c.dataset.i); };
  $('#calSummary').onclick = $('#calUndated').onclick = e => { const c = e.target.closest('[data-k]'); if (c) openCalDetail(c.dataset.k, +c.dataset.i); };
  drawCalendar();
}
function syncSeg(id, v) { $$('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }
function monthShift(n, k) { const p = dparts(n); return Date.UTC(p.y, p.m - 1 + k, 1) / DAY; }

function chipHTML(it, ws, detailed) {
  const a = Math.max(it.s, ws), b = Math.min(it.e, ws + 6);
  const contL = it.s < ws, contR = it.e > ws + 6;
  const col = `grid-column:${a - ws + 1}/${b - ws + 2}`;
  if (it.kind === 'award') {
    const e = it.ev;
    return `<button class="cal-chip award ${contL ? 'cont-l' : ''} ${contR ? 'cont-r' : ''}" style="${col}" data-k="award" data-i="${it.i}" title="${esc(e.name)}"><span class="ct">🏆 <b>${esc(e.name)}</b></span>${detailed ? `<small>${esc(e.venue)} · ${esc(e.state)}</small>` : ''}</button>`;
  }
  const t = it.t; const c = calColor(t);
  const startsHere = it.s >= ws && it.s <= ws + 6, endsHere = it.e >= ws && it.e <= ws + 6;
  const tags = [startsHere ? (it.dashS ? '개막?' : '개막') : '', endsHere ? (it.dashE ? '종료?' : '폐막') : ''].filter(Boolean).map(x => `<em class="tg">${x}</em>`).join('');
  const att = isNum(t.attendance) ? `관객 ${esc(t.attendanceText || fmtKo(t.attendance))}` : (t.estimateText && estOn() ? `<span class="estmini">추정 ${esc(t.estimateText)}</span>` : '관객 미확인');
  const cls = ['cal-chip', it.unconf ? 'unconf' : '', it.estAtt && estOn() ? 'estatt' : '', contL ? 'cont-l' : '', contR ? 'cont-r' : ''].join(' ');
  const tip = `${t.artist} · ${t.tour}\n${t.start || '미정'} ~ ${t.end || '미정'}${it.unconf ? ' (일정 미확정)' : ''}`;
  return `<button class="${cls}" style="${col};--c:${c}" data-k="tour" data-i="${it.i}" title="${esc(tip)}">
    <span class="ct">${contL ? '◀ ' : ''}${tags}<b>${esc(t.artist)}</b> <span class="tn">${esc(t.tour)}</span>${contR ? ' ▶' : ''}</span>
    ${detailed ? `<small>${fmtMD(it.s)}${it.dashS ? '?' : ''}–${fmtMD(it.e)}${it.dashE ? '?' : ''} · ${esc(t.region || '')} · ${t.shows ? t.shows + '회' : '회차 미확인'} · ${att}</small>` : ''}
  </button>`;
}

function weekRowHTML(ws, items, detailed, monthOf) {
  const td = todayDn();
  const inWeek = items.filter(it => it.s <= ws + 6 && it.e >= ws);
  const head = Array.from({ length: 7 }, (_, k) => { const n = ws + k, p = dparts(n);
    return `<div class="cal-dh ${n === td ? 'today' : ''} ${k >= 5 ? 'wkend' : ''} ${monthOf != null && p.m !== monthOf ? 'other' : ''}"><span>${DOW_KO[k]}</span><b>${p.d}</b>${p.d === 1 || k === 0 ? `<small>${p.m}월</small>` : ''}${n === td ? '<em>오늘</em>' : ''}</div>`; }).join('');
  const todayIdx = td >= ws && td <= ws + 6 ? td - ws : -1;
  return `<div class="cal-week ${detailed ? 'detailed' : ''}">
    <div class="cal-days">${head}</div>
    <div class="cal-lanes">${todayIdx >= 0 ? `<div class="cal-todaycol" style="left:calc(${todayIdx} * 100% / 7);"></div>` : ''}
      ${inWeek.map(it => chipHTML(it, ws, detailed)).join('') || `<div class="cal-empty">이 주에 진행 중인 투어가 없습니다</div>`}
    </div></div>`;
}

function drawCalendar() {
  const { items, undated } = calItems();
  let weeks = [], title, monthOf = null;
  if (CAL.view === 'week') {
    const ws = CAL.cursor; weeks = [ws];
    const a = dparts(ws), b = dparts(ws + 6), iw = isoWeek(ws);
    title = `${a.y}년 ${a.m}월 ${a.d}일 – ${b.y !== a.y ? b.y + '년 ' : ''}${b.m}월 ${b.d}일 <span class="muted small">(${iw.y}년 ${iw.w}주차)</span>`;
  } else {
    const p = dparts(CAL.cursor); const first = Date.UTC(p.y, p.m - 1, 1) / DAY, last = Date.UTC(p.y, p.m, 0) / DAY;
    for (let w = weekStartOf(first); w <= last; w += 7) weeks.push(w);
    monthOf = p.m; title = `${p.y}년 ${p.m}월 <span class="muted small">(${weeks.length}주)</span>`;
  }
  $('#calTitle').innerHTML = title;
  $('#calDate').value = dstr(CAL.view === 'week' ? CAL.cursor : weeks[0]);
  $('#calMonth').value = dstr(CAL.view === 'week' ? CAL.cursor + 3 : CAL.cursor).slice(0, 7);
  const detailed = CAL.view === 'week';
  $('#calMain').innerHTML = weeks.map(ws => weekRowHTML(ws, items, detailed, monthOf)).join('');
  // 요약
  const r0 = weeks[0], r1 = weeks[weeks.length - 1] + 6, td = todayDn();
  const tours = items.filter(it => it.kind === 'tour' && it.s <= r1 && it.e >= r0);
  const starts = tours.filter(it => it.s >= r0 && it.s <= r1), ends = tours.filter(it => it.e >= r0 && it.e <= r1);
  const li = it => `<li><button class="linkish" data-k="tour" data-i="${it.i}"><i class="dot" style="background:${calColor(it.t)}"></i><b>${esc(it.t.artist)}</b> <span class="muted">${esc(it.t.tour)}</span></button></li>`;
  $('#calSummary').innerHTML = `<h3 class="side-h">${CAL.view === 'week' ? '이번 주' : '이번 달'} 요약 ${r0 <= td && td <= r1 ? '<span class="badge b-state-next">오늘 포함</span>' : ''}</h3>
    <div class="side-kpis"><div><b>${tours.length}</b><span>진행 중</span></div><div><b>${starts.length}</b><span>개막</span></div><div><b>${ends.length}</b><span>폐막</span></div></div>
    ${starts.length ? `<div class="side-sub">개막</div><ul class="side-list">${starts.map(li).join('')}</ul>` : ''}
    ${ends.length ? `<div class="side-sub">폐막</div><ul class="side-list">${ends.map(li).join('')}</ul>` : ''}`;
  $('#calUndated').innerHTML = `<h3 class="side-h">날짜 미정 (${undated.length})</h3><p class="small muted" style="margin:0 0 6px">시작·종료일이 모두 없어 캘린더에 표시하지 않음</p><ul class="side-list">${undated.map(({ t, i }) => `<li><button class="linkish" data-k="tour" data-i="${i}"><i class="dot" style="background:${calColor(t)}"></i><b>${esc(t.artist)}</b> <span class="muted">${esc(t.tour)} · ${esc(t.yearHint || '')}</span></button></li>`).join('') || '<li class="muted small">없음</li>'}</ul>`;
  // 아티스트 색 범례
  if (CAL.color === 'artist') {
    const arts = [...new Map(tours.map(it => [it.t.artist, calColor(it.t)])).entries()];
    $('#calArtLegend').innerHTML = arts.length ? `<span class="small muted">색 범례:</span> ` + arts.map(([a, c]) => `<span class="tag"><i class="dot" style="background:${c}"></i>${esc(a)}</span>`).join(' ') : '';
  } else $('#calArtLegend').innerHTML = `<span class="small muted">색 범례:</span> ` + ['girl', 'boy', 'solo'].map(g => `<span class="tag"><i class="dot" style="background:${TYPE_COLOR[g]}"></i>${TYPE_LABEL[g]}</span>`).join(' ');
}

/* 상세 모달 */
function ensureModal() {
  let m = $('#calModal'); if (m) return m;
  document.body.insertAdjacentHTML('beforeend', `<div id="calModal" class="modal" hidden><div class="modal-card" role="dialog" aria-modal="true"><button class="modal-x" aria-label="닫기">✕</button><div id="calModalBody"></div></div></div>`);
  m = $('#calModal');
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.modal-x')) m.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') m.hidden = true; });
  return m;
}
function openCalDetail(kind, i) {
  const m = ensureModal(); let h = '';
  if (kind === 'award') {
    const e = D.events.awards2026.events[i];
    h = `<div class="md-kicker">시상식 · ${esc(e.state)}</div><h2 class="md-title">🏆 ${esc(e.name)}</h2>
      <dl class="kv"><dt>일정</dt><dd>${esc(e.date)} (${esc(e.dateSort)})</dd><dt>장소</dt><dd>${esc(e.venue)}</dd><dt>라인업</dt><dd class="small">${esc(e.lineup)}</dd>
      ${e.results?.length ? `<dt>결과</dt><dd><ul class="dots small">${e.results.map(x => `<li>${esc(x)}</li>`).join('')}</ul></dd>` : ''}<dt>정확도</dt><dd>${badge(e.status)}</dd></dl>
      ${e.note ? `<p class="small muted">${esc(e.note)}</p>` : ''}<div class="md-src">${srcLinks(e.sources, 'list')}</div>`;
  } else {
    const t = D.tracker.tours[i]; const sp = trackerSpan(t);
    const s = msToDn(sp.s), e = msToDn(sp.e);
    const days = sp.unknown ? null : e - s + 1;
    h = `<div class="md-kicker"><i class="dot" style="background:${calColor(t)}"></i> ${TYPE_LABEL[t.group] || ''} · ${esc(t.tier || '')}</div>
      <h2 class="md-title">${esc(t.artist)} <span class="muted">${esc(t.tour)}</span></h2>
      <div style="margin-bottom:10px">${badge(t.status)} ${t.estimateText && !isNum(t.attendance) && estOn() ? estBadge('관객 추정치') : ''} ${(sp.dashS || sp.dashE || sp.unknown) ? '<span class="badge b-unverified" style="border-style:dashed">일정 미확정</span>' : ''} ${t.changes ? '<span class="badge b-change">변경</span>' : ''}</div>
      <dl class="kv">
        <dt>기간</dt><dd>${esc(t.start || '시작일 미정')} ~ ${esc(t.end || '종료일 미정')} ${days ? `<span class="muted small">(${days}일${sp.dashS || sp.dashE ? ', 캘린더 표시는 임시 구간' : ''})</span>` : `<span class="muted small">(${esc(t.yearHint || '')})</span>`}</dd>
        <dt>회차 · 도시</dt><dd>${t.shows != null ? t.shows + '회' : '회차 미확인'} · ${t.cities != null ? t.cities + '개 도시' : '도시 수 미확인'}</dd>
        <dt>권역</dt><dd>${esc(t.region || '—')}</dd>
        <dt>공연장·도시</dt><dd class="muted small">공연별 공연장·도시 데이터 없음 (투어 단위 데이터)</dd>
        <dt>관객 (실집계)</dt><dd>${t.attendanceText ? esc(t.attendanceText) : '<span class="nullval">미확인</span>'}</dd>
        <dt>추정 관객</dt><dd>${t.estimateText ? (estOn() ? `<span class="estval">${esc(t.estimateText)}</span> <span class="small muted">Claude 모델값, 공식 아님</span>` : '<span class="dim">추정치 필터로 숨김</span>') : '—'}</dd>
        <dt>매출 (gross)</dt><dd>${t.revenueText ? esc(t.revenueText) : '<span class="nullval">미확인</span>'}</dd>
        <dt>원자료 정확도</dt><dd>${esc(t.claudeAcc || '—')}</dd>
        ${t.ticket?.url ? `<dt>예매</dt><dd><a href="${esc(t.ticket.url)}" target="_blank" rel="noopener">${esc(t.ticket.name)} ↗</a></dd>` : ''}
      </dl>
      ${t.note ? `<p class="small">${esc(t.note)}</p>` : ''}
      ${t.changes ? `<p class="small muted"><b>변경 이력</b> ${esc(t.changes)}</p>` : ''}
      <div class="md-src"><div class="small muted">출처</div>${srcLinks(t.sources, 'list') || '<span class="muted small">없음</span>'}</div>`;
  }
  $('#calModalBody').innerHTML = h; m.hidden = false;
}

/* 박스스코어 → 캘린더 연결 (박스스코어는 연도 단위 기간만 있음) */
const BX2TR = { 'BTS': 'BTS', 'Stray Kids': '스트레이 키즈', 'BLACKPINK': '블랙핑크', 'SEVENTEEN': '세븐틴', 'TWICE': '트와이스' };
function boxscoreCalLinks(el, rows) {
  const tr = D.tracker?.tours || []; const links = [];
  rows.filter(r => BX2TR[r.artist]).forEach(r => {
    const words = r.tour.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(w => w.length > 3 && !['world', 'tour'].includes(w));
    const i = tr.findIndex(t => t.artist === BX2TR[r.artist] && words.some(w => t.tour.toLowerCase().includes(w)));
    links.push({ r, i });
  });
  el.innerHTML = card({ title: '투어 일정 (캘린더)', sub: '박스스코어 데이터는 연도 단위 기간(period)만 있어 날짜 캘린더를 그릴 수 없습니다. 트래커에 시작·종료일이 있는 K-pop 투어는 주간 캘린더로 이동할 수 있습니다.',
    body: `<div class="tagwrap">${links.map(({ r, i }) => i >= 0 ? `<button class="btn small" data-tr="${i}">📅 ${esc(r.artist)} — ${esc(r.tour)} <span class="muted">(${esc(tr[i].start || '?')} ~ ${esc(tr[i].end || '?')})</span></button>` : `<span class="tag muted">${esc(r.artist)} — ${esc(r.tour)} · ${esc(r.period)} (트래커 일정 없음)</span>`).join('')}</div>` });
  el.onclick = e => { const b = e.target.closest('[data-tr]'); if (!b) return; const t = tr[+b.dataset.tr]; const s = t.start ? dn(t.start) : msToDn(trackerSpan(t).s);
    CAL.sub = 'cal'; CAL.view = 'week'; CAL.cursor = weekStartOf(s); CAL.q = t.artist; RENDERED.delete('tracker'); showTab('tracker'); };
}
