/* ===== 하이브 탭 (data/hybe.json, 선택 파일) ===== */
const HY = { metric: 'attendance' };
const LABEL_PAL = ['#7c6cff', '#f472b6', '#22d3ee', '#f59e0b', '#22c55e', '#60a5fa', '#e879f9', '#fb7185', '#a3e635', '#38bdf8', '#f97316', '#c084fc'];
function hybeLabelColor(labels) { const m = new Map(labels.map((l, i) => [l, LABEL_PAL[i % LABEL_PAL.length]])); return l => m.get(l) || PAL[0]; }
/* 날짜 null이면 period의 '연-월'로 임시 구간(점선) — 예: &TEAM '2026-05 ~', ENHYPEN '~ 2027-03' */
function hybeSpan(t) {
  const sp = trackerSpan({ ...t, yearHint: t.period });
  const [a, b] = String(t.period || '').split('~').map(x => x.trim());
  const ym = x => (x || '').match(/(\d{4})-(\d{2})(?!-\d)/);
  if (!t.start && t.end && ym(a)) { const m = ym(a); sp.s = tms(`${m[1]}-${m[2]}-01`); sp.dashS = true; }
  if (!t.end && t.start && ym(b)) { const m = ym(b); sp.e = tms(new Date(Date.UTC(+m[1], +m[2], 0)).toISOString().slice(0, 10)); sp.dashE = true; }
  return sp;
}
const hybeRows = () => (D.hybe?.tours || []).map((t, i) => ({ ...t, i, region: t.regions, yearHint: t.period, span: hybeSpan(t), attendance: isNum(t.attendance) ? t.attendance : null }));
const HYBE_RULE = '관객·매출 숫자는 출처가 있는 <b>보고분</b>만이며 투어마다 집계 범위(보고 회차·집계기간)가 다릅니다. 합계는 모두 <b>‘보고분 합’</b>(단순 합)으로, 투어 총량이나 회사 전체 총계가 아닙니다. null = 미확인.';

function renderHybe() {
  const el = $('#tab-hybe'); const H = D.hybe;
  if (!H) { el.innerHTML = `<div class="page-head"><div><h1>하이브</h1></div></div><div class="banner"><b>hybe.json을 불러오지 못했습니다.</b> 라이브(${esc(DATA_BASE)}hybe.json)와 폴백 경로 모두 실패했습니다. 다른 탭은 정상 동작합니다. 데이터가 게시되면 새로고침하세요.</div>`; return; }
  const rows = hybeRows(); const labels = [...new Set(rows.map(r => r.label).concat((H.roster || []).map(r => r[0])))];
  const lc = hybeLabelColor(labels);
  const vis = () => rows.filter(r => accVisible(r.status));
  const V = vis();
  const attR = V.filter(r => isNum(r.attendance)), grossR = V.filter(r => isNum(r.gross));
  const sumAtt = attR.reduce((a, r) => a + r.attendance, 0), sumGross = grossR.reduce((a, r) => a + r.gross, 0);
  const cnt = st => V.filter(r => r.state === st).length;
  const Q = H.company?.quarters || []; const unit = H.company?.unit || '억원';
  const qBars = Q.filter(q => !/연간/.test(q[0])), qYear = Q.filter(q => /연간/.test(q[0]));
  const isEst = q => q[3] === 'estimate' || q[3] === 'forecast' || /\(E\)/.test(q[0]);
  const kpi = (label, value, desc, extra = '') => `<div class="card kpi ${extra}"><div class="label">${label}</div><div class="value ${extra.includes('estk') ? 'est' : ''}">${value}</div><div class="desc">${desc}</div></div>`;
  el.innerHTML = `
  <div class="page-head"><div><h1>${esc(H.title || '하이브')}</h1><p>${esc(H.intro || '')}</p></div>
    <div class="asof"><span class="muted">하이브 데이터 기준</span> <b>${esc(String(H.asOf || '').replace('T', ' ').slice(0, 16))} KST</b></div></div>
  <div class="banner">⚠ ${HYBE_RULE}</div>
  <div class="grid g6">
    ${kpi('투어·공연', V.length + '건', `${new Set(V.map(r => r.label)).size}개 레이블 · ${new Set(V.map(r => r.artist)).size}팀 (필터 적용)`)}
    ${kpi('진행 중', cnt('진행 중') + '건', `예정 ${cnt('예정')}건 · 종료 ${cnt('종료')}건 · 2027년까지 ${V.filter(r => r.y2027).length}건`)}
    ${kpi('관객 보고분 합', fmtKo(sumAtt, 1) + '명', `<b>보고분 합</b> · ${attR.length}/${V.length}건만 수치 보고 · 집계 범위 상이, 총 관객 아님`, 'sumk')}
    ${kpi('매출 보고분 합', fmtUSD(sumGross), `<b>보고분 합</b> · ${grossR.length}/${V.length}건 · 보고 회차·기간 상이, 총매출 아님`, 'sumk')}
    ${(() => { const q = [...qBars].reverse().find(q => !isEst(q)); return q ? kpi(`최근 확정 분기 공연매출 (${esc(q[0])})`, fmtN(q[1]) + '억', `${esc(q[2])} ${badge(q[3])}`) : ''; })()}
    ${(() => { const q = qYear.find(isEst); return q ? kpi(`${esc(q[0])} 공연매출 전망`, fmtN(q[1]) + '억', `증권사 전망치 ${estBadge()}`, 'estk') : ''; })()}
  </div>
  <div class="grid g3" style="margin-top:16px">
    ${card({ title: 'HYBE 분기 공연 매출', sub: `단위 ${esc(unit)} · 실선 = 실적, 빗금·반투명·점선 테두리 = 증권사 전망치(E)`, cls: 'span2', body: chartDiv('hyQ', 'h420'), foot: qYear.map(q => `${esc(q[0])}: <b class="${isEst(q) ? 'estval' : ''}">${fmtN(q[1])}억</b> ${badge(q[3])} ${q[4] ? `<span class="muted">${esc(q[4])}</span>` : ''} ${srcLinks(q[5])}`).join('<br>') })}
    ${card({ title: '회사 지표', sub: '2026 2Q 실적 요약 등', body: `<ul class="clean">${(H.company?.stats || []).filter(s => accVisible(s[2])).map(s => `<li><span class="muted small">${esc(s[0])}</span><br><b>${esc(s[1])}</b> ${badge(s[2])}${srcLinks(s[3])}</li>`).join('')}</ul>` })}
  </div>
  <h2 class="sec">하이브 투어 주간 캘린더</h2>
  <div id="hyCal"></div>
  <div class="grid g2" style="margin-top:16px">
    ${card({ title: '투어별 보고 수치 순위', sub: '각 막대는 해당 투어의 보고 범위 수치(라벨 참고) · 투어 간 단순 비교에 주의 · 색 = 레이블 · 흰 점선 테두리 = 진행 중(수치 계속 변동) · [ ] = 정확도', tools: seg('hyMetric', [['attendance', '관객'], ['gross', '매출(USD)']], HY.metric), body: chartDiv('hyRank', 'h420') })}
    ${card({ title: '회차 진행률 (done / left)', sub: '완료·잔여 회차가 있는 투어 · 오늘 기준 데이터', body: chartDiv('hyProg', 'h420') })}
  </div>
  <h2 class="sec">레이블별 로스터</h2>
  <div class="grid g3" id="hyRoster"></div>
  <h2 class="sec">투어 표</h2>
  <div id="hyTable"></div>
  <h2 class="sec">미확인·주의 사항</h2>
  <div class="card"><ul class="clean">${(H.unverified || []).map(x => `<li><span class="badge b-unverified">미확인</span> ${esc(x)}</li>`).join('')}</ul></div>`;

  // 분기 차트
  const qv = qBars.filter(q => accVisible(isEst(q) ? 'estimate' : q[3]));
  chart('hyQ', {
    grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
    legend: { data: ['실적', '전망치(E)'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const q = qv[ps[0].dataIndex]; return tipHTML({ title: `${q[0]} 공연 매출`, rows: [['매출', `${fmtN(q[1])}억 원`], ['증감', esc(q[2])]], status: q[3], estimate: isEst(q), note: q[4], sources: q[5] }); } },
    xAxis: axisStyle({ type: 'category', data: qv.map(q => q[0]) }),
    yAxis: axisStyle({ type: 'value', name: '억 원', axisLabel: { color: themeColors().muted, formatter: v => fmtN(v) } }),
    series: [
      { name: '실적', type: 'bar', stack: 'q', barMaxWidth: 46, itemStyle: { color: PAL[0], borderRadius: [4, 4, 0, 0] }, data: qv.map(q => isEst(q) ? null : q[1]), label: { show: true, position: 'top', color: themeColors().muted, fontSize: 11, formatter: p => fmtN(p.value) } },
      { name: '전망치(E)', type: 'bar', stack: 'q', barMaxWidth: 46, itemStyle: estStyle(ACC.estimate.color, { borderRadius: [4, 4, 0, 0] }), data: qv.map(q => isEst(q) ? q[1] : null), label: { show: true, position: 'top', color: '#f9a8d4', fontSize: 11, formatter: p => fmtN(p.value) + ' (E)' } },
    ],
  });
  // 캘린더
  Calendar($('#hyCal'), {
    p: 'hcal', st: HCAL, rows: hybeRows, progress: true, estLegend: false,
    banner: '하이브 투어도 공연별 날짜 없이 시작·종료일만 있어 기간 막대로 표시합니다. 막대 하단의 흰 선은 <b>완료 회차 / 총 회차</b> 진행률입니다(done 값이 없는 투어는 미표시).',
    groups: [['all', '전체 레이블'], ...labels.filter(l => rows.some(r => r.label === l)).map(l => [l, l])], groupOf: r => r.label,
    typeName: '레이블별', typeColor: r => lc(r.label), typeLegend: labels.filter(l => rows.some(r => r.label === l)).map(l => [l, lc(l)]),
    detail: i => hybeDetail(i, lc),
  });
  // 순위
  const drawRank = () => {
    const m = HY.metric; const R = vis().filter(r => isNum(r[m])).sort((a, b) => b[m] - a[m]);
    hbar($('#hyRank'), R.map(r => ({ label: `${r.artist} — ${r.tour}`, value: r[m], color: lc(r.label), dashed: r.state === '진행 중', r })), {
      valueFmt: v => m === 'gross' ? fmtUSD(v) : fmtKo(v, 1), axisFmt: v => m === 'gross' ? fmtUSD(v, 0) : fmtKo(v, 0), labelWidth: 220, height: Math.max(320, R.length * 30 + 30),
      tip: it => tipHTML({ title: `${it.r.artist} — ${it.r.tour}`, rows: [['레이블', esc(it.r.label)], ['관객 (보고 범위)', esc(it.r.attendanceText || '미확인')], ['매출 (보고 범위)', esc(it.r.grossText || '미확인')], ['회차', `${it.r.shows ?? '—'}회 (완료 ${it.r.done ?? '—'} / 잔여 ${it.r.left ?? '—'})`], ['상태', esc(it.r.state)]], status: it.r.status, note: it.r.note, sources: it.r.sources }),
    });
    const c = CHARTS.get($('#hyRank')); c && c.setOption({ grid: { right: 250 }, series: [{ label: { formatter: p => { const r = R[p.dataIndex]; const t = m === 'gross' ? r.grossText : r.attendanceText; return `${m === 'gross' ? fmtUSD(p.value) : fmtKo(p.value, 1)}  ${String(t || '').replace(/^[^(]*\(?/, '(').slice(0, 26)}${String(t || '').length > 26 ? '…' : ''}  [${ACC[STATUS_GROUP(r.status)].label}]`; } } }] });
  };
  drawRank(); bindSeg('hyMetric', v => { HY.metric = v; drawRank(); });
  // 진행률
  const P = vis().filter(r => r.shows && (isNum(r.done) || isNum(r.left))).sort((a, b) => (b.shows || 0) - (a.shows || 0));
  $('#hyProg').style.height = Math.max(320, P.length * 26 + 50) + 'px';
  chart('hyProg', { legend: { data: ['완료', '잔여', '미확인'] }, grid: { left: 8, right: 40, top: 30, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = P[ps[0].dataIndex]; return tipHTML({ title: `${r.artist} — ${r.tour}`, rows: [['총 회차', r.shows + '회'], ['완료', (r.done ?? '미확인') + ''], ['잔여', (r.left ?? '미확인') + ''], ['기간', esc(r.period)], ['상태', esc(r.state)]], status: r.status, sources: r.sources }); } },
    xAxis: axisStyle({ type: 'value', name: '회' }),
    yAxis: axisStyle({ type: 'category', inverse: true, data: P.map(r => `${r.artist} — ${r.tour}`), axisLabel: { color: themeColors().text, fontSize: 11, width: 200, overflow: 'truncate' }, splitLine: { show: false } }),
    series: [{ name: '완료', type: 'bar', stack: 'p', barMaxWidth: 14, itemStyle: { color: PAL[4] }, data: P.map(r => r.done ?? null) },
      { name: '잔여', type: 'bar', stack: 'p', barMaxWidth: 14, itemStyle: { color: PAL[1], opacity: .55 }, data: P.map(r => r.left ?? null) },
      { name: '미확인', type: 'bar', stack: 'p', barMaxWidth: 14, itemStyle: { color: 'transparent', borderColor: themeColors().muted, borderType: 'dashed', borderWidth: 1 }, data: P.map(r => Math.max(0, r.shows - (r.done || 0) - (r.left || 0))),
        label: { show: true, position: 'right', color: themeColors().muted, fontSize: 10, formatter: p => { const r = P[p.dataIndex]; return `${r.done ?? '?'}/${r.shows}`; } } }] });
  // 진행률 라벨이 미확인 0이면 안 보이므로 완료 막대에도 라벨
  // 로스터
  const ro = H.roster || [];
  $('#hyRoster').innerHTML = labels.filter(l => ro.some(r => r[0] === l)).map(l => card({
    title: `<i class="dot" style="background:${lc(l)}"></i> ${esc(l)}`, sub: `${ro.filter(r => r[0] === l).length}팀 · 투어 ${rows.filter(r => r.label === l).length}건`,
    body: `<ul class="clean">${ro.filter(r => r[0] === l).map(r => `<li style="${accVisible(r[3]) ? '' : 'opacity:.35'}"><b>${esc(r[1])}</b> ${badge(r[3])}${srcLinks(r[4])}<br><span class="small muted">${esc(r[2])}</span></li>`).join('')}</ul>` })).join('');
  // 표
  const sumRow = () => { const R = vis(); const a = R.filter(r => isNum(r.attendance)), g = R.filter(r => isNum(r.gross));
    return `<div class="banner info small" style="margin:8px 0 0">표시 행 기준 <b>보고분 합</b>: 관객 ${fmtN(a.reduce((s, r) => s + r.attendance, 0))}명 (${a.length}건) · 매출 ${fmtUSD(g.reduce((s, r) => s + r.gross, 0))} (${g.length}건) — 집계 범위가 서로 달라 총계가 아닙니다.</div>`; };
  DataTable($('#hyTable'), [
    { k: 'label', label: '레이블', html: r => `<i class="dot" style="background:${lc(r.label)}"></i> <span class="small">${esc(r.label)}</span>` },
    { k: 'artist', label: '아티스트', html: r => `<b>${esc(r.artist)}</b>` },
    { k: 'tour', label: '투어', cls: 'wrap', html: r => `${esc(r.tour)} <span class="muted small">${esc(r.kind)}</span>${r.note ? `<span class="note">${esc(r.note)}</span>` : ''}` },
    { k: 'start', label: '기간', html: r => `${esc(r.start || '시작 미정')}<br>~ ${esc(r.end || '종료 미정')}` },
    { k: 'regions', label: '권역', cls: 'wrap', html: r => `<span class="small">${esc(r.regions || '')}</span>` },
    { k: 'cities', label: '도시', num: true, html: r => r.cities ?? nullCell('—') },
    { k: 'shows', label: '회차', num: true, html: r => r.shows ?? nullCell('—') },
    { k: 'done', label: '완료/잔여', num: true, val: r => r.shows && isNum(r.done) ? r.done / r.shows : null, html: r => isNum(r.done) || isNum(r.left) ? `${r.done ?? '?'} / ${r.left ?? '?'}` : nullCell('미확인') },
    { k: 'attendance', label: '관객(보고)', num: true, html: r => isNum(r.attendance) ? `${fmtN(r.attendance)}<span class="note">${esc(r.attendanceText)}</span>` : `${nullCell('미확인')}<span class="note">${esc(r.attendanceText && r.attendanceText !== '—' ? r.attendanceText : '')}</span>` },
    { k: 'gross', label: '매출(보고, USD)', num: true, html: r => isNum(r.gross) ? `${fmtUSD(r.gross)}<span class="note">${esc(r.grossText)}</span>` : nullCell('미확인') },
    { k: 'state', label: '상태', html: r => `<span class="badge ${r.state === '종료' ? 'b-state-done' : 'b-state-next'}">${esc(r.state)}</span>${r.y2027 ? ' <span class="badge b-change">~2027</span>' : ''}` },
    { k: 'status', label: '정확도', html: r => badge(r.status) },
    { k: 'src', label: '출처', nosort: true, html: r => srcLinks(r.sources) },
  ], { rows: vis, sort: { k: 'start', dir: 'desc' }, search: ['artist', 'tour', 'label', 'note'], tools: '' });
  $('#hyTable').insertAdjacentHTML('beforeend', sumRow());
}

function hybeDetail(i, lc) {
  const t = D.hybe.tours[i]; const sp = hybeSpan(t);
  const prog = isNum(t.done) && t.shows ? Math.round(t.done / t.shows * 100) : null;
  return `<div class="md-kicker"><i class="dot" style="background:${lc(t.label)}"></i> ${esc(t.label)} · ${esc(t.kind || '')}</div>
    <h2 class="md-title">${esc(t.artist)} <span class="muted">${esc(t.tour)}</span></h2>
    <div style="margin-bottom:10px">${badge(t.status)} <span class="badge ${t.state === '종료' ? 'b-state-done' : 'b-state-next'}">${esc(t.state)}</span> ${t.y2027 ? '<span class="badge b-change">2027년까지</span>' : ''} ${(sp.dashS || sp.dashE || sp.unknown) ? '<span class="badge b-unverified" style="border-style:dashed">일정 미확정</span>' : ''}</div>
    <dl class="kv">
      <dt>기간</dt><dd>${esc(t.period || `${t.start || '미정'} ~ ${t.end || '미정'}`)}${sp.dashS || sp.dashE ? ' <span class="small muted">(캘린더 표시는 임시 구간)</span>' : ''}</dd>
      <dt>권역</dt><dd>${esc(t.regions || '—')}</dd>
      <dt>도시 · 회차</dt><dd>${t.cities != null ? t.cities + '개 도시' : '도시 수 미확인'} · ${t.shows != null ? t.shows + '회' : '회차 미확인'}</dd>
      <dt>진행</dt><dd>${isNum(t.done) || isNum(t.left) ? `완료 ${t.done ?? '?'}회 / 잔여 ${t.left ?? '?'}회` : '<span class="nullval">미확인</span>'}${prog != null ? `<div class="md-prog"><i style="width:${prog}%"></i></div><span class="small muted">${prog}%</span>` : ''}</dd>
      <dt>공연장·도시</dt><dd class="muted small">공연별 공연장·도시 데이터 없음 (투어 단위)</dd>
      <dt>관객 (보고 범위)</dt><dd>${isNum(t.attendance) ? fmtN(t.attendance) + '명 · ' : ''}<span class="small">${esc(t.attendanceText || '미확인')}</span></dd>
      <dt>매출 (보고 범위)</dt><dd>${isNum(t.gross) ? fmtUSD(t.gross) + ' · ' : ''}<span class="small">${esc(t.grossText || '미확인')}</span></dd>
    </dl>
    ${t.note ? `<p class="small">${esc(t.note)}</p>` : ''}
    <div class="md-src"><div class="small muted">출처</div>${srcLinks(t.sources, 'list') || '<span class="muted small">없음</span>'}</div>`;
}
