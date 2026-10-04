/* ===== 탭 렌더러 ===== */
const KPOP_TOURS = ['BTS', 'BLACKPINK', 'Stray Kids', 'SEVENTEEN', 'TWICE'];
const isKpop = a => KPOP_TOURS.includes(a);
const DAY = 864e5;
const tms = s => s ? Date.parse(s + 'T00:00:00+09:00') : null;
const asOfMs = () => tms((D.meta?.lastUpdated || '').slice(0, 10)) || Date.now();
const fmtDate = ms => { const d = new Date(ms + 9 * 3600e3); return d.toISOString().slice(0, 10); };

/* 공통: 가로 막대 랭킹 */
function hbar(el, items, { valueFmt = fmtN, axisFmt, name = '', tip, height, markAvg = false, labelWidth = 150 } = {}) {
  // items: [{label, value, color, est, dashed, ...}]
  const data = items.map(it => ({
    value: it.value, it,
    itemStyle: it.est ? estStyle(it.color || PAL[0], { borderRadius: [0, 4, 4, 0] }) : it.g && it.g !== 'verified' && it.g !== 'partial' ? gradeStyle(it.color || PAL[0], it.g, { borderRadius: [0, 4, 4, 0] }) : solidStyle(it.color || PAL[0], { borderRadius: [0, 4, 4, 0], ...(it.dashed ? { borderColor: '#fff', borderType: 'dashed', borderWidth: 1, opacity: .8 } : {}) }),
  }));
  if (height) el.style.height = height + 'px';
  return chart(el, {
    grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'item', formatter: p => tip ? tip(p.data.it) : `${esc(p.name)}: ${valueFmt(p.value)}` },
    xAxis: axisStyle({ type: 'value', name, axisLabel: { color: themeColors().muted, fontSize: 11, formatter: axisFmt || (v => fmtKo(v, 0)) } }),
    yAxis: axisStyle({ type: 'category', inverse: true, data: items.map(i => i.label), axisLabel: { color: themeColors().text, fontSize: 11.5, width: labelWidth, overflow: 'truncate' }, splitLine: { show: false } }),
    series: [{ type: 'bar', data, barMaxWidth: 18, label: { show: true, position: 'right', color: themeColors().muted, fontSize: 11, formatter: p => valueFmt(p.value) + (p.data.it.est ? ' (추정)' : p.data.it.g && p.data.it.g !== 'verified' ? ` [${ACC[p.data.it.g].label}]` : '') },
      ...(markAvg ? { markLine: { symbol: 'none', label: { color: themeColors().muted, formatter: '평균 {c}' }, lineStyle: { color: themeColors().muted, type: 'dashed' }, data: [{ type: 'average' }] } } : {}) }],
  });
}

/* 공통: 간트(가로 기간 막대) */
function gantt(el, items, { xType = 'time', min, max, today, height, labelWidth = 230, tip, xFmt } = {}) {
  // items: [{label, s, e, color, dashS, dashE, unknown, it}]
  el.style.height = (height || Math.max(240, items.length * 24 + 70)) + 'px';
  const c = themeColors();
  const data = items.map((d, i) => ({ value: [i, d.s, d.e], d }));
  const series = [{
    type: 'custom', encode: { x: [1, 2], y: 0 }, data,
    renderItem: (params, api) => {
      const d = data[params.dataIndex].d;
      const y = api.value(0), s = api.coord([api.value(1), y]), e = api.coord([api.value(2), y]);
      const h = api.size([0, 1])[1] * 0.62;
      const cs = params.coordSys;
      const rect = echarts.graphic.clipRectByRect({ x: s[0], y: s[1] - h / 2, width: Math.max(e[0] - s[0], 4), height: h }, { x: cs.x, y: cs.y, width: cs.width, height: cs.height });
      if (!rect) return;
      const uncertain = d.unknown || d.dashS || d.dashE;
      const children = [{ type: 'rect', shape: { ...rect, r: 3 }, style: { fill: d.color, opacity: d.unknown ? 0.18 : uncertain ? 0.45 : (d.fade ? 0.55 : 0.9), stroke: uncertain ? d.color : null, lineWidth: uncertain ? 1.2 : 0, lineDash: uncertain ? [4, 3] : null } }];
      if (d.dashS && !d.unknown) children.push({ type: 'text', style: { text: '?', x: rect.x + 3, y: rect.y + rect.height / 2, verticalAlign: 'middle', fill: c.text, fontSize: 10 } });
      if (d.dashE && !d.unknown) children.push({ type: 'text', style: { text: '?', x: rect.x + rect.width - 9, y: rect.y + rect.height / 2, verticalAlign: 'middle', fill: c.text, fontSize: 10 } });
      if (d.unknown) children.push({ type: 'text', style: { text: '날짜 미정', x: rect.x + 6, y: rect.y + rect.height / 2, verticalAlign: 'middle', fill: c.muted, fontSize: 10 } });
      return { type: 'group', children };
    },
  }];
  if (today) series.push({ type: 'line', data: [], markLine: { symbol: 'none', silent: true, label: { formatter: '오늘(기준일)', color: '#22d3ee', fontSize: 11 }, lineStyle: { color: '#22d3ee', type: 'dashed' }, data: [{ xAxis: today }] } });
  return chart(el, {
    grid: { left: 8, right: 24, top: 26, bottom: 30, containLabel: true },
    tooltip: { trigger: 'item', formatter: p => p.data && p.data.d ? tip(p.data.d) : '' },
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],
    xAxis: axisStyle({ type: xType, min, max, position: 'top', axisLabel: { color: c.muted, fontSize: 11, formatter: xFmt } }),
    yAxis: axisStyle({ type: 'category', inverse: true, data: items.map(d => d.label), axisLabel: { color: c.text, fontSize: 11, width: labelWidth, overflow: 'truncate' }, splitLine: { show: true, lineStyle: { color: c.line, type: 'dotted' } } }),
    series,
  });
}

/* ========== 개요 ========== */
function renderOverview() {
  const el = $('#tab-overview');
  const T = (D.tours?.tours || []), TR = D.tracker?.tours || [], YT = D.social?.youtube?.rows || [], AW = D.events?.awards2026?.events || [];
  const top = [...T].sort((a, b) => (b.gross || 0) - (a.gross || 0));
  const kTop = top.find(t => isKpop(t.artist));
  const next = AW.filter(e => e.state === '예정').sort((a, b) => a.dateSort.localeCompare(b.dateSort))[0];
  const ig = (D.social?.instagram?.rows || []).slice().sort((a, b) => b.followers - a.followers)[0];
  const artistsN = new Set(TR.map(t => t.artist)).size;
  const ongoing = TR.filter(t => { const s = tms(t.start), e = tms(t.end), now = asOfMs(); return s && s <= now && (!e || e >= now); }).length;
  const kpi = (label, value, desc, extra = '') => `<div class="card kpi"><div class="label">${label}</div><div class="value ${extra}">${value}</div><div class="desc">${desc}</div></div>`;
  el.innerHTML = `
  <div class="page-head"><div><h1>개요</h1><p>${esc(D.tours?.definition || '')}</p></div></div>
  <div class="grid g6">
    ${kpi('역대 단일 투어 최고 매출', top[0] ? fmtUSD(top[0].gross) : '—', top[0] ? `${esc(top[0].artist)} · ${esc(top[0].tour)} ${badge(top[0].status)}` : '')}
    ${kpi('K-pop 최고 박스스코어', kTop ? fmtUSD(kTop.gross) : '—', kTop ? `${esc(kTop.artist)} ${esc(kTop.tour)} ${badge(kTop)}` : '')}
    ${kpi('해외 투어 트래커', TR.length + '건', `${artistsN}팀 · 기준일 진행 중 ${ongoing}건 (날짜 확인분)`)}
    ${kpi('유튜브 구독자 1위', YT[0] ? fmtKo(YT[0].subs, 2) : '—', YT[0] ? `${esc(YT[0].ko)} (${esc(YT[0].group)}) ${badge(D.social.youtube.status)}` : '')}
    ${kpi('인스타그램 최다 팔로워', ig ? fmtKo(ig.followers, 2) : '—', ig ? `${esc(ig.member)} ${badge(ig)}` : '')}
    ${kpi('다음 시상식', next ? esc(next.date) : '—', next ? `${esc(next.name)} · ${esc(next.venue)}` : '예정 없음')}
  </div>
  <div class="grid g3" style="margin-top:16px">
    ${card({ title: '역대 단일 투어 매출 Top 12', sub: 'K-pop 강조 · USD 명목 · 진행 중 투어는 점선 테두리', body: chartDiv('ovTop', 'h420'), cls: 'span2', foot: '출처: tours.json (Billboard·Pollstar·Wikipedia). 막대 위 마우스 → 출처 링크' })}
    ${card({ title: '데이터 등급 분포', sub: '전체 JSON 행의 status 집계 · 조각 클릭 시 필터 토글', body: chartDiv('ovAcc', 'h420') })}
    ${card({ title: '그룹 공식 유튜브 구독자 Top 10', sub: esc(D.social?.youtube?.snapshot || ''), body: chartDiv('ovYT', 'h300') })}
    ${card({ title: '해외 투어 — 연도별 진행 투어 수', sub: '트래커 years 필드 기준(연도 걸침은 각 연도에 집계)', body: chartDiv('ovYears', 'h300') })}
    ${card({ title: '2026 시상식 진행 현황', sub: '종료 vs 예정 (기준일)', body: chartDiv('ovAw', 'h300') })}
  </div>
  <div class="grid g2" style="margin-top:16px">
    ${card({ title: '주요 마일스톤', sub: 'tours.json milestones', body: `<ul class="clean" id="ovMs"></ul>` })}
    ${card({ title: '미해결 데이터 이슈', sub: 'tracker.json unresolved', body: `<ul class="clean">${(D.tracker?.unresolved || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` })}
    ${card({ title: '업데이트 로그', sub: 'meta.json', cls: 'spanall', body: `<ul class="clean">${(D.meta?.log || []).map(l => `<li><b class="nowrap">${esc(l.date)}</b><br><span class="muted">${esc(l.text)}</span></li>`).join('')}</ul>` })}
  </div>`;

  // Top 12
  const tv = top.filter(t => accVisible(t.status)).slice(0, 12);
  hbar($('#ovTop'), tv.map(t => ({ label: `${t.artist} — ${t.tour}`, value: t.gross, color: isKpop(t.artist) ? TYPE_COLOR.girl : PAL[0], dashed: t.ongoing, t })), {
    valueFmt: v => fmtUSD(v), axisFmt: v => fmtUSD(v, 0), labelWidth: 220,
    tip: it => tipHTML({ title: `${it.t.artist} — ${it.t.tour}`, rows: [['매출', fmtUSD(it.t.gross)], ['기간', esc(it.t.period)], ['회차', fmtN(it.t.shows)], ['관객', it.t.attendance ? fmtN(it.t.attendance) : '미확인'], ['상태', it.t.ongoing ? '진행 중(누적 증가)' : it.t.ongoing === false ? '종료' : '미확인']], status: it.t.status, note: it.t.note, sources: it.t.sources }),
  });
  // accuracy donut
  const cnt = accCounts();
  const ac = chart('ovAcc', {
    tooltip: { trigger: 'item', formatter: p => `${p.name}: <b>${p.value}</b>행 (${p.percent}%)` },
    legend: { orient: 'vertical', right: 0, top: 'middle', type: 'plain' },
    series: [{ type: 'pie', radius: ['48%', '74%'], center: ['36%', '50%'], itemStyle: { borderColor: themeColors().card, borderWidth: 2 }, label: { show: false },
      data: ACC_KEYS.map(k => ({ name: ACC[k].label, value: cnt[k] || 0, key: k, itemStyle: k === 'estimate' ? estStyle(ACC[k].color, { opacity: S.acc.has(k) ? 0.75 : 0.15 }) : { color: ACC[k].color, opacity: S.acc.has(k) ? 1 : 0.15 } })) }],
    graphic: [{ type: 'text', left: '36%', top: 'middle', style: { text: Object.values(cnt).reduce((a, b) => a + b, 0) + '\n행', textAlign: 'center', fill: themeColors().text, fontSize: 18, fontWeight: 700 } }],
  });
  ac && ac.on('click', p => toggleAcc(p.data.key));
  // YT
  hbar($('#ovYT'), YT.slice(0, 10).map(r => ({ label: r.ko || r.group, value: r.subs, color: TYPE_COLOR[r.type], r })), {
    valueFmt: v => fmtKo(v, 1), tip: it => tipHTML({ title: `${it.r.ko} (${it.r.group})`, rows: [['구독자', fmtN(it.r.subs)], ['주간 변화', (it.r.weekly >= 0 ? '+' : '') + fmtN(it.r.weekly)], ['세대·구분', `${it.r.gen}세대 · ${TYPE_LABEL[it.r.type] || it.r.type}`], ['소속', esc(it.r.company)]], status: D.social.youtube.status, sources: D.social.youtube.sources }),
  });
  // years stacked
  const yrs = ['2025', '2026', '2027'], groups = ['girl', 'boy', 'solo'];
  const trV = TR.filter(t => accVisible(t.status));
  chart('ovYears', {
    tooltip: { trigger: 'axis' }, legend: {},
    grid: { top: 30, left: 8, right: 10, bottom: 8, containLabel: true },
    xAxis: axisStyle({ type: 'category', data: yrs.map(y => y + '년') }), yAxis: axisStyle({ type: 'value' }),
    series: groups.map(g => ({ name: TYPE_LABEL[g], type: 'bar', stack: 'y', barMaxWidth: 46, itemStyle: { color: TYPE_COLOR[g] }, data: yrs.map(y => trV.filter(t => t.group === g && (t.years || []).includes(y)).length) })),
  });
  // awards
  const awV = AW.filter(e => accVisible(e.status));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  chart('ovAw', {
    tooltip: { trigger: 'axis', formatter: ps => { const m = ps[0].dataIndex + 1; const ev = awV.filter(e => +e.dateSort.slice(5, 7) === m); return `<b>${m}월</b><br>` + (ev.map(e => `${esc(e.date)} ${esc(e.name)} <span class="muted">(${e.state})</span>`).join('<br>') || '없음'); } },
    legend: {}, grid: { top: 30, left: 8, right: 10, bottom: 8, containLabel: true },
    xAxis: axisStyle({ type: 'category', data: months.map(m => m + '월') }), yAxis: axisStyle({ type: 'value', minInterval: 1 }),
    series: [['종료', '#5d6578'], ['예정', '#22d3ee']].map(([st, col]) => ({ name: st, type: 'bar', stack: 's', itemStyle: { color: col }, data: months.map(m => awV.filter(e => e.state === st && +e.dateSort.slice(5, 7) === m).length) })),
  });
  // milestones
  $('#ovMs').innerHTML = (D.tours?.milestones || []).filter(m => accVisible(m.status)).map(m => `<li>${badge(m)} ${esc(m.text)} ${srcLinks(m.sources)}</li>`).join('') || '<li class="muted">필터로 숨김</li>';
}

/* 전체 status 집계 */
let __accCounts = null;
function accCounts() {
  if (__accCounts) return __accCounts;
  const c = {}; ACC_KEYS.forEach(k => c[k] = 0);
  const walk = (x, inheritEst) => {
    if (Array.isArray(x)) return x.forEach(y => walk(y, inheritEst));
    if (x && typeof x === 'object') {
      if (typeof x.status === 'string') c[STATUS_GROUP(x.status)]++;
      if ((x.estimate === true && STATUS_GROUP(x.status) !== 'estimate') || typeof x.estimateText === 'string') c.estimate++;
      Object.values(x).forEach(v => walk(v, inheritEst));
    }
  };
  ['tours', 'tracker', 'social', 'events', 'industry', 'artists', 'auditions', 'rpd', 'hybe'].forEach(f => D[f] && walk(D[f]));
  return (__accCounts = c);
}

/* ========== 투어 박스스코어 ========== */
const BX = { metric: 'gross', kpop: false, top: 20 };
function tourRows() {
  return (D.tours?.tours || []).map(t => ({ ...t,
    perShowGross: isNum(t.gross) && t.shows ? t.gross / t.shows : null,
    perShowAtt: isNum(t.attendance) && t.shows ? t.attendance / t.shows : null,
    avgTicket: isNum(t.gross) && isNum(t.attendance) && t.attendance ? t.gross / t.attendance : null,
    startYear: +(String(t.period).match(/\d{4}/) || [])[0] || null,
  }));
}
function renderBoxscore() {
  const el = $('#tab-boxscore');
  const all = tourRows().sort((a, b) => b.gross - a.gross).map((t, i) => ({ ...t, rank: i + 1 }));
  const rows = () => all.filter(t => accVisible(t.status) && (!BX.kpop || isKpop(t.artist)));
  const M = { gross: ['총매출', v => fmtUSD(v)], attendance: ['총관객', v => fmtKo(v)], perShowGross: ['회당 매출', v => fmtUSD(v, 2)], perShowAtt: ['회당 관객', v => fmtN(Math.round(v))], avgTicket: ['평균 티켓가(계산)', v => '$' + v.toFixed(0)] };
  el.innerHTML = `
  <div class="page-head"><div><h1>투어 박스스코어</h1><p>역대 단일 투어 매출 상위 ${all.length}건 · 기준일 ${esc(D.tours?.asOf || '')}. 회당 값·평균 티켓가는 gross/shows, gross/attendance로 계산한 값입니다.</p></div>
    <div class="card-tools">${seg('bxMetric', Object.entries(M).map(([k, v]) => [k, v[0]]), BX.metric)}
      <label class="tog"><input type="checkbox" id="bxK" ${BX.kpop ? 'checked' : ''}> K-pop만</label>
      <select id="bxTop">${[10, 20, 33].map(n => `<option value="${n}" ${BX.top === n ? 'selected' : ''}>Top ${n}</option>`).join('')}</select></div></div>
  <div class="grid g2">
    ${card({ title: '투어 순위', sub: '선택 지표 기준 · 관객 미확인 투어는 관객 지표에서 제외', body: chartDiv('bxRank', 'h560'), id: 'bxRankCard' })}
    ${card({ title: '총매출 × 총관객', sub: '버블 크기 = 회차 · 분홍 = K-pop · 우상단일수록 대형', body: chartDiv('bxScatter', 'h560') })}
    ${card({ title: '회당 매출 × 회당 관객', sub: '스타디움급 효율 비교 (계산값)', body: chartDiv('bxPer', 'h420') })}
    ${card({ title: '투어 시작 연도별 매출', sub: '기간(period) 첫 연도 기준 · 최근 투어일수록 매출 상승(명목 달러)', body: chartDiv('bxYear', 'h420') })}
  </div>
  <div id="bxCalLinks"></div>
  <h2 class="sec">박스스코어 표</h2>
  <div id="bxTable"></div>
  <h2 class="sec">마일스톤</h2>
  <div class="card"><ul class="clean">${(D.tours?.milestones || []).map(m => `<li data-st="${m.status}">${badge(m)} ${esc(m.text)} ${srcLinks(m.sources)}</li>`).join('')}</ul></div>`;

  const drawCharts = () => {
    const R = rows(); const [mLabel, mFmt] = M[BX.metric];
    const ranked = R.filter(t => isNum(t[BX.metric])).sort((a, b) => b[BX.metric] - a[BX.metric]).slice(0, BX.top);
    const tip = t => tipHTML({ title: `${t.artist} — ${t.tour}`, rows: [['총매출', fmtUSD(t.gross)], ['회차', fmtN(t.shows)], ['총관객', t.attendance ? fmtN(t.attendance) : '미확인'], ['회당 매출', fmtUSD(t.perShowGross, 2)], ['회당 관객', t.perShowAtt ? fmtN(Math.round(t.perShowAtt)) : '—'], ['평균 티켓가(계산)', t.avgTicket ? '$' + t.avgTicket.toFixed(0) : '—'], ['기간', esc(t.period) + (t.ongoing ? ' · 진행 중' : '')]], status: t.status, note: t.note, sources: t.sources });
    hbar($('#bxRank'), ranked.map(t => ({ label: `${t.artist} — ${t.tour}`, value: t[BX.metric], color: isKpop(t.artist) ? TYPE_COLOR.girl : PAL[0], dashed: t.ongoing, g: gradeOf(t, BX.metric === 'perShowGross' || BX.metric === 'avgTicket' ? 'gross' : BX.metric === 'perShowAtt' ? 'attendance' : BX.metric), t })), { valueFmt: mFmt, axisFmt: BX.metric.includes('ross') || BX.metric === 'avgTicket' ? (v => BX.metric === 'avgTicket' ? '$' + v : fmtUSD(v, 0)) : (v => fmtKo(v, 0)), tip: it => tip(it.t), labelWidth: 230, height: Math.max(360, ranked.length * 24 + 40) });
    const sc = R.filter(t => isNum(t.attendance));
    const missing = R.length - sc.length;
    const pt = (t, x, y) => ({ value: [x, y, t.shows], t, itemStyle: { color: isKpop(t.artist) ? TYPE_COLOR.girl : PAL[0], opacity: t.status === 'verified' ? .85 : .5, borderColor: t.status === 'verified' ? 'transparent' : '#fff', borderType: 'dashed', borderWidth: t.status === 'verified' ? 0 : 1 } });
    const scOpt = (data, xn, yn, xf, yf) => ({
      grid: { left: 10, right: 30, top: 30, bottom: 30, containLabel: true },
      tooltip: { trigger: 'item', formatter: p => tip(p.data.t) },
      xAxis: axisStyle({ type: 'value', name: xn, nameLocation: 'middle', nameGap: 26, axisLabel: { color: themeColors().muted, formatter: xf } }),
      yAxis: axisStyle({ type: 'value', name: yn, axisLabel: { color: themeColors().muted, formatter: yf } }),
      series: [{ type: 'scatter', data, symbolSize: d => Math.max(7, Math.sqrt(d[2]) * 1.5), label: { show: true, position: 'right', fontSize: 10.5, color: themeColors().muted, formatter: p => p.data.t.gross > 6e8 || isKpop(p.data.t.artist) ? p.data.t.artist : '' }, emphasis: { focus: 'self', label: { show: true, formatter: p => p.data.t.artist } } }],
    });
    chart('bxScatter', scOpt(sc.map(t => pt(t, t.attendance, t.gross)), '총관객', '총매출', v => fmtKo(v, 0), v => fmtUSD(v, 0)));
    const sub = $('#bxScatter').closest('.card').querySelector('.sub');
    sub.innerHTML = `버블 크기 = 회차 · 분홍 = K-pop · 점선 테두리 = 부분 확인 · 관객 미확인 ${missing}건 제외`;
    chart('bxPer', scOpt(sc.map(t => pt(t, t.perShowAtt, t.perShowGross)), '회당 관객', '회당 매출', v => fmtKo(v, 0), v => fmtUSD(v, 1)));
    // year
    chart('bxYear', {
      grid: { left: 10, right: 20, top: 30, bottom: 30, containLabel: true },
      tooltip: { trigger: 'item', formatter: p => tip(p.data.t) },
      xAxis: axisStyle({ type: 'value', min: 2000, max: 2028, name: '시작 연도', nameLocation: 'middle', nameGap: 26, axisLabel: { color: themeColors().muted, formatter: v => v } }),
      yAxis: axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: v => fmtUSD(v, 0) } }),
      series: [{ type: 'scatter', data: R.filter(t => t.startYear).map(t => ({ ...pt(t, t.startYear, t.gross), value: [t.startYear, t.gross, t.shows] })), symbolSize: d => Math.max(7, Math.sqrt(d[2]) * 1.4), label: { show: true, position: 'top', fontSize: 10, color: themeColors().muted, formatter: p => p.data.t.gross > 8e8 || isKpop(p.data.t.artist) ? p.data.t.artist : '' } }],
    });
  };
  drawCharts();
  const tbl = DataTable($('#bxTable'), [
    { k: 'rank', label: '#', num: true, title: '총매출 순위(전체 기준)' },
    { k: 'artist', label: '아티스트', html: t => `<b>${esc(t.artist)}</b>` },
    { k: 'tour', label: '투어', cls: 'wrap', html: t => `${esc(t.tour)}${t.ongoing ? ' <span class="badge b-change" title="진행 중 — 누적 수치 증가 중">진행 중</span>' : ''}${t.note ? `<span class="note">${esc(t.note)}</span>` : ''}` },
    { k: 'period', label: '기간' },
    { k: 'gross', label: '총매출', num: true, html: t => `<span title="$${fmtN(t.gross)}">${fmtUSD(t.gross)}</span>` },
    { k: 'shows', label: '회차', num: true, html: t => fmtN(t.shows) },
    { k: 'attendance', label: '총관객', num: true, html: t => t.attendance == null ? nullCell() : fmtN(t.attendance) },
    { k: 'perShowGross', label: '회당 매출', num: true, html: t => fmtUSD(t.perShowGross, 2) },
    { k: 'perShowAtt', label: '회당 관객', num: true, html: t => t.perShowAtt ? fmtN(Math.round(t.perShowAtt)) : nullCell('—') },
    { k: 'avgTicket', label: '평균 티켓가', num: true, title: 'gross ÷ attendance (계산값)', html: t => t.avgTicket ? '$' + t.avgTicket.toFixed(0) : nullCell('—') },
    { k: 'status', label: '등급', html: t => badge(t) },
    { k: 'src', label: '출처', nosort: true, html: t => srcLinks(t.sources) },
  ], { rows, sort: { k: 'gross', dir: 'desc' }, search: ['artist', 'tour', 'note'], rowClass: t => isKpop(t.artist) ? 'hl' : '' });
  bindSeg('bxMetric', v => { BX.metric = v; drawCharts(); });
  $('#bxK').onchange = e => { BX.kpop = e.target.checked; drawCharts(); tbl.draw(); };
  $('#bxTop').onchange = e => { BX.top = +e.target.value; drawCharts(); };
  if (typeof boxscoreCalLinks === 'function') boxscoreCalLinks($('#bxCalLinks'), all);
  $$('#tab-boxscore li[data-st]').forEach(li => li.style.display = accVisible(li.dataset.st) ? '' : 'none');
}

/* ========== 투어 트래커 ========== */
const TK = { group: 'all', year: 'all', tier: 'all', q: '', kind: 'tour' };
const REGION_KEYS = [['한국', /한국|국내/], ['일본', /일본/], ['아시아', /아시아|마카오|대만|중화/], ['북미', /북미|미주/], ['유럽', /유럽/], ['오세아니아', /오세아니아/], ['중남미', /중남미|남미|멕시코|미주/]];
function trackerSpan(t) {
  const yrs = String(t.yearHint || '').match(/\d{4}/g) || (t.years || []);
  const y0 = +(yrs[0] || 2026), y1 = +(yrs[yrs.length - 1] || y0);
  let s = tms(t.start), e = tms(t.end), dashS = false, dashE = false, unknown = false;
  if (!s && !e) { s = tms(y0 + '-01-01'); e = tms(y1 + '-12-31'); unknown = true; }
  else if (!s) { s = Math.max(tms(y0 + '-01-01'), e - 180 * DAY); dashS = true; }
  else if (!e) { e = Math.min(s + 180 * DAY, tms(Math.max(y1, new Date(s).getUTCFullYear()) + '-12-31')); if (e <= s) e = s + 90 * DAY; dashE = true; }
  return { s, e, dashS, dashE, unknown };
}
function renderTrackerCharts(el) {
  const TRD = D.tracker || {};
  const all = (TRD.tours || []);
  const tiers = [...new Set(all.map(t => t.tier).filter(Boolean))];
  const filt = () => all.filter(t => accVisible(t.status) && (TK.group === 'all' || t.group === TK.group) && (TK.year === 'all' || (t.years || []).includes(TK.year)) && (TK.tier === 'all' || t.tier === TK.tier) && (!TK.q || (t.artist + ' ' + t.tour).toLowerCase().includes(TK.q.toLowerCase())));
  el.innerHTML = `
  <div class="page-head"><div><h1 style="font-size:18px">차트·표</h1><p class="small">아래 필터는 차트·표에만 적용됩니다.</p></div>
    <div class="card-tools">${seg('tkGroup', [['all', '전체'], ['girl', '걸그룹'], ['boy', '보이그룹'], ['solo', '솔로']], TK.group)}
    ${seg('tkYear', [['all', '전 연도'], ['2025', '2025'], ['2026', '2026'], ['2027', '2027']], TK.year)}
    <select id="tkTier"><option value="all">규모 전체</option>${tiers.map(t => `<option ${TK.tier === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <input type="search" id="tkQ" placeholder="아티스트·투어 검색" value="${esc(TK.q)}"></div></div>
  ${card({ title: '투어 타임라인 (간트)', sub: '실선 = 확인된 시작·종료일 · 점선/물음표 = 시작 또는 종료일 미정(표시 구간은 임시 추정) · 흐린 막대 = 날짜 미정(연도만) · 휠로 확대', body: chartDiv('tkGantt'), id: 'tkGanttCard' })}
  <div class="grid g3" style="margin-top:16px">
    ${card({ title: '연도 × 그룹 구분', sub: '투어가 걸친 연도마다 집계', body: chartDiv('tkYears', 'h300') })}
    ${card({ title: '공연장 규모(tier)', sub: '아레나·돔·스타디움·레지던시', body: chartDiv('tkTierC', 'h300') })}
    ${card({ title: '권역별 투어 수', sub: 'region 문자열의 권역 키워드 포함 여부(계산)', body: chartDiv('tkRegion', 'h300') })}
  </div>
  <div class="grid g2" style="margin-top:16px">
    ${card({ title: '관객 기록 (records)', sub: '해칭·흐린 막대 = 추정치(estimate:true) · 투어 총량 vs 도시/회차 단위', tools: seg('tkKind', [['tour', '투어 단위'], ['city', '도시·공연장 단위']], TK.kind), body: chartDiv('tkRec', 'h560') })}
    ${card({ title: esc(TRD.billboard2025?.title || 'Billboard 2025'), sub: '막대 = 연간 매출 · 점 = 관객 · 집계기간 기준(투어 총량 아님) · 등급 필드 없음 → 출처 기준 표시', body: chartDiv('tkBB', 'h560'), foot: srcLinks(TRD.billboard2025?.sources) + ' Billboard Year-End 2025' })}
  </div>
  ${(all.some(t => t.estimateText) ? `<div class="grid g2" style="margin-top:16px">${card({ title: '실집계 관객 vs 추정 관객(모델)', sub: '실선 = 보고된 관객(일부는 도시·부분 집계) · 해칭 = Claude 모델 추정 관객(공식 아님) · 필터 적용', body: chartDiv('tkEst', 'h560'), foot: esc(TRD.estimateNote || ''), cls: 'spanall' })}</div>` : '')}
  ${TRD.btsMonthly ? `<div class="grid g2" style="margin-top:16px">${card({ title: `${esc(TRD.btsMonthly.title)} ${badge(TRD.btsMonthly.status)} ${srcLinks(TRD.btsMonthly.sources)}`, sub: '막대 = 월 매출 · 선 = 관객 · 흐린 막대 = Claude 인용(원문 미확인)', body: chartDiv('tkBTS', 'h360'), foot: esc(TRD.btsMonthly.note || '') })}
    ${TRD.westStatus ? sectionCard(TRD.westStatus, simpleTable(TRD.westStatus.columns || [], (TRD.westStatus.rows || []).map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : `<span class="small">${esc(c)}</span>`)))) : ''}</div>` : ''}
  <h2 class="sec">투어 목록</h2>
  <div id="tkTable"></div>
  <h2 class="sec">관객 기록 표</h2>
  <div id="tkRecTable"></div>
  <h2 class="sec">미해결 항목</h2>
  <div class="card"><ul class="clean">${(TRD.unresolved || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;

  const tipT = t => tipHTML({ title: `${t.artist} — ${t.tour}`, rows: [['기간', `${t.start || '미정'} ~ ${t.end || '미정'}`], ['회차·도시', `${t.shows ?? '—'}회 · ${t.cities ?? '—'}개 도시`], ['권역', esc(t.region)], ['규모', esc(t.tier)], ['관객(실집계)', t.attendanceText ? esc(t.attendanceText) : '미확인'], (t.estimateText && estOn()) ? ['추정 관객(모델)', `<span class="estval">${esc(t.estimateText)}</span>`] : null, ['매출', t.revenueText ? esc(t.revenueText) : '미확인'], ['원자료 정확도', esc(t.claudeAcc || '—')]], status: t.status, estimate: !!(t.estimateText && estOn()), estTxt: '추정 관객 포함', note: (t.changes ? '[변경] ' + t.changes + ' ' : '') + (t.note || ''), sources: t.sources });
  const draw = () => {
    const R = filt();
    const items = R.map(t => ({ ...trackerSpan(t), t })).sort((a, b) => a.s - b.s).map(d => ({ ...d, label: `${d.t.artist} · ${d.t.tour}`, color: TYPE_COLOR[d.t.group] || PAL[0], fade: d.t.status !== 'verified' && d.t.status !== 'partial' }));
    gantt($('#tkGantt'), items, { min: tms('2024-08-01'), max: tms('2027-07-01'), today: asOfMs(), tip: d => tipT(d.t), labelWidth: 250, xFmt: v => { const d = new Date(v); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0'); } });
    const yrs = ['2025', '2026', '2027'];
    chart('tkYears', { tooltip: { trigger: 'axis' }, legend: {}, grid: { top: 30, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: yrs }), yAxis: axisStyle({ type: 'value', minInterval: 1 }),
      series: ['girl', 'boy', 'solo'].map(g => ({ name: TYPE_LABEL[g], type: 'bar', stack: 's', barMaxWidth: 44, itemStyle: { color: TYPE_COLOR[g] }, data: yrs.map(y => R.filter(t => t.group === g && (t.years || []).includes(y)).length) })) });
    const tc = {}; R.forEach(t => tc[t.tier || '미상'] = (tc[t.tier || '미상'] || 0) + 1);
    chart('tkTierC', { tooltip: { trigger: 'item', formatter: '{b}: {c}건 ({d}%)' }, legend: { bottom: 0, top: 'auto' },
      series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'], itemStyle: { borderColor: themeColors().card, borderWidth: 2 }, label: { color: themeColors().muted, formatter: '{b}\n{c}' }, data: Object.entries(tc).map(([name, value]) => ({ name, value })) }] });
    const rc = REGION_KEYS.map(([k, re]) => [k, R.filter(t => re.test(t.region || '')).length]).sort((a, b) => b[1] - a[1]);
    hbar($('#tkRegion'), rc.map(([k, v], i) => ({ label: k, value: v, color: PAL[i % PAL.length] })), { valueFmt: v => v + '건', axisFmt: v => v, labelWidth: 70 });
    if ($('#tkEst')) {
      const E = R.filter(t => isNum(t.attendance) || (isNum(t.estimate) && estOn())).sort((a, b) => Math.max(b.attendance || 0, estOn() ? b.estimate || 0 : 0) - Math.max(a.attendance || 0, estOn() ? a.estimate || 0 : 0));
      $('#tkEst').style.height = Math.max(360, E.length * 26 + 60) + 'px';
      chart('tkEst', { legend: { data: ['실집계 관객', '추정 관객(모델)'] }, grid: { left: 8, right: 70, top: 30, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => tipT(E[ps[0].dataIndex]) },
        xAxis: axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } }),
        yAxis: axisStyle({ type: 'category', inverse: true, data: E.map(t => `${t.artist} · ${t.tour}`), axisLabel: { color: themeColors().text, fontSize: 11, width: 250, overflow: 'truncate' }, splitLine: { show: false } }),
        series: [{ name: '실집계 관객', type: 'bar', barMaxWidth: 10, barGap: '20%', itemStyle: { color: PAL[1], borderRadius: [0, 3, 3, 0] }, data: E.map(t => ({ value: t.attendance ?? null, itemStyle: gradeStyle(PAL[1], gradeOf(t, 'attendance'), { borderRadius: [0, 3, 3, 0] }) })), label: { show: true, position: 'right', fontSize: 10, color: themeColors().muted, formatter: p => p.value ? fmtKo(p.value, 1) + ` [${ACC[gradeOf(E[p.dataIndex], 'attendance')].label}]` : '' } },
          { name: '추정 관객(모델)', type: 'bar', barMaxWidth: 10, itemStyle: estStyle(ACC.estimate.color, { borderRadius: [0, 3, 3, 0] }), data: E.map(t => estOn() ? t.estimate ?? null : null), label: { show: true, position: 'right', fontSize: 10, color: '#f9a8d4', formatter: p => p.value ? E[p.dataIndex].estimateText : '' } }] });
    }
    // table refresh
    tkTbl && tkTbl.draw();
  };
  const drawRec = () => {
    const recs = (TRD.records || []).filter(r => r.kind === TK.kind && accVisible(r.status, r.estimate) && isNum(r.attendance)).sort((a, b) => b.attendance - a.attendance);
    hbar($('#tkRec'), recs.map(r => ({ label: `${r.artist} · ${r.label}`, value: r.attendance, est: r.estimate, color: r.estimate ? ACC.estimate.color : PAL[1], r })), {
      valueFmt: v => fmtKo(v, 1), labelWidth: 210, height: Math.max(360, recs.length * 22 + 30),
      tip: it => tipHTML({ title: `${it.r.artist} · ${it.r.label}`, rows: [['관객', esc(it.r.attendanceText || fmtN(it.r.attendance))], ['회차', fmtN(it.r.shows)], ['회당 평균(계산)', it.r.shows ? fmtN(Math.round(it.r.attendance / it.r.shows)) : '—'], ['권역', esc(it.r.region)]], status: it.r.status, estimate: it.r.estimate, note: it.r.note, sources: it.r.sources || ['CLAUDE-TRACKER'] }),
    });
  };
  // billboard
  const bb = (TRD.billboard2025?.rows || []);
  chart('tkBB', {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = bb[ps[0].dataIndex]; return tipHTML({ title: r.artist, rows: [['매출', fmtUSD(r.gross)], ['관객', fmtN(r.attendance)], ['회차', fmtN(r.shows)], ['회당 매출(계산)', fmtUSD(r.gross / r.shows, 2)], ['평균 티켓가(계산)', '$' + (r.gross / r.attendance).toFixed(0)]], sources: TRD.billboard2025.sources }); } },
    legend: { data: ['연간 매출', '관객'] }, grid: { top: 34, left: 8, right: 10, bottom: 8, containLabel: true },
    xAxis: axisStyle({ type: 'category', data: bb.map(r => r.artist), axisLabel: { color: themeColors().muted, rotate: 35, fontSize: 11 } }),
    yAxis: [axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: v => fmtUSD(v, 0) } }), axisStyle({ type: 'value', splitLine: { show: false }, axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } })],
    series: [{ name: '연간 매출', type: 'bar', barMaxWidth: 34, itemStyle: { color: PAL[0], borderRadius: [4, 4, 0, 0] }, data: bb.map(r => r.gross), label: { show: true, position: 'top', color: themeColors().muted, fontSize: 10, formatter: p => fmtUSD(p.value, 0) } },
      { name: '관객', type: 'line', yAxisIndex: 1, symbolSize: 8, itemStyle: { color: PAL[1] }, lineStyle: { width: 2 }, data: bb.map(r => r.attendance) }],
  });
  if ($('#tkBTS')) {
    const bm = (TRD.btsMonthly.rows || []).filter(r => accVisible(r.status));
    chart('tkBTS', { legend: { data: ['매출', '관객'] }, grid: { top: 34, left: 8, right: 10, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = bm[ps[0].dataIndex]; return tipHTML({ title: 'BTS ARIRANG · ' + r.month, rows: [['회차', fmtN(r.shows)], ['관객', fmtN(r.att)], ['매출', fmtUSD(r.gross)], ['회당 관객(계산)', r.shows ? fmtN(Math.round(r.att / r.shows)) : '—'], ['회당 매출(계산)', r.shows ? fmtUSD(r.gross / r.shows, 2) : '—'], ['순위', esc(r.rank || '—')]], status: r.status, sources: r.sources }); } },
      xAxis: axisStyle({ type: 'category', data: bm.map(r => r.month) }),
      yAxis: [axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: v => fmtUSD(v, 0) } }), axisStyle({ type: 'value', splitLine: { show: false }, axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } })],
      series: [{ name: '매출', type: 'bar', barMaxWidth: 40, data: bm.map(r => ({ value: r.gross, itemStyle: { color: PAL[0], opacity: r.status === 'verified' || r.status === 'partial' ? 1 : 0.5, borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: 'top', color: themeColors().muted, fontSize: 10, formatter: p => fmtUSD(p.value, 1) } },
        { name: '관객', type: 'line', yAxisIndex: 1, itemStyle: { color: PAL[1] }, symbolSize: 8, data: bm.map(r => r.att) }] });
  }
  let tkTbl = null;
  tkTbl = DataTable($('#tkTable'), [
    { k: 'artist', label: '아티스트', html: t => `<b>${esc(t.artist)}</b><span class="note">${TYPE_LABEL[t.group] || ''}</span>` },
    { k: 'tour', label: '투어', cls: 'wrap', html: t => `${esc(t.tour)}${t.changes ? ' <span class="badge b-change" title="' + esc(t.changes) + '">변경</span>' : ''}${t.note ? `<span class="note">${esc(t.note)}</span>` : ''}` },
    { k: 'start', label: '시작', html: t => t.start || nullCell('미정') }, { k: 'end', label: '종료', html: t => t.end || nullCell('미정') },
    { k: 'shows', label: '회차', num: true, html: t => t.shows ?? nullCell('—') }, { k: 'cities', label: '도시', num: true, html: t => t.cities ?? nullCell('—') },
    { k: 'region', label: '권역' }, { k: 'tier', label: '규모' },
    { k: 'attendance', label: '관객(실집계)', num: true, html: t => t.attendanceText ? esc(t.attendanceText) : nullCell() },
    { k: 'estimate', label: '추정 관객', num: true, title: 'Claude 모델값 (공식 집계 아님)', val: t => estOn() ? t.estimate : null, html: t => t.estimateText ? (estOn() ? `<span class="estval" title="추정치 — 공식 집계 아님">${esc(t.estimateText)}</span>` : '<span class="dim small">숨김</span>') : nullCell('—') },
    { k: 'revenue', label: '매출', num: true, html: t => t.revenueText ? esc(t.revenueText) : nullCell() },
    { k: 'status', label: '등급', html: t => badge(t) + `<span class="note">원자료: ${esc(t.claudeAcc || '—')}</span>` },
    { k: 'src', label: '출처·예매', nosort: true, html: t => srcLinks(t.sources) + (t.ticket?.url ? ` <a class="src" href="${esc(t.ticket.url)}" target="_blank" rel="noopener">${esc(t.ticket.name)}</a>` : '') },
  ], { rows: filt, sort: { k: 'start', dir: 'asc' } });
  DataTable($('#tkRecTable'), [
    { k: 'kind', label: '단위', html: r => r.kind === 'tour' ? '투어' : '도시·공연장' },
    { k: 'artist', label: '아티스트', html: r => `<b>${esc(r.artist)}</b>` }, { k: 'label', label: '기록', cls: 'wrap', html: r => `${esc(r.label)}<span class="note">${esc(r.note)}</span>` },
    { k: 'region', label: '권역' }, { k: 'shows', label: '회차', num: true },
    { k: 'attendance', label: '관객', num: true, html: r => r.estimate ? `<span class="estval" title="추정치">${esc(r.attendanceText)}</span>` : esc(r.attendanceText || '—') },
    { k: 'avg', label: '회당(계산)', num: true, val: r => isNum(r.attendance) && r.shows ? r.attendance / r.shows : null, html: r => isNum(r.attendance) && r.shows ? fmtN(Math.round(r.attendance / r.shows)) : nullCell('—') },
    { k: 'status', label: '등급', html: r => badges(r.status, r.estimate) },
    { k: 'src', label: '출처', nosort: true, html: r => srcLinks(r.sources || ['CLAUDE-TRACKER']) },
  ], { rows: () => (TRD.records || []).filter(r => accVisible(r.status, r.estimate)), sort: { k: 'attendance', dir: 'desc' }, search: ['artist', 'label', 'note'], rowClass: r => r.estimate ? 'est' : '' });
  draw(); drawRec();
  bindSeg('tkGroup', v => { TK.group = v; draw(); }); bindSeg('tkYear', v => { TK.year = v; draw(); });
  bindSeg('tkKind', v => { TK.kind = v; drawRec(); });
  $('#tkTier').onchange = e => { TK.tier = e.target.value; draw(); };
  $('#tkQ').oninput = e => { TK.q = e.target.value.trim(); draw(); };
}

/* ========== 소셜 ========== */
const SO = { gens: new Set([2, 3, 4, 5]), type: 'all', top: 25, metric: 'subs' };
function renderSocial() {
  const el = $('#tab-social'); const so = D.social || {}; const yt = so.youtube || {}; const ig = so.instagram || {}; const mg = so.multiGroup || {};
  const ytOK = accVisible(yt.status);
  const filt = () => ytOK ? (yt.rows || []).filter(r => SO.gens.has(r.gen) && (SO.type === 'all' || r.type === SO.type)) : [];
  el.innerHTML = `
  <div class="page-head"><div><h1>소셜 — 유튜브·인스타그램</h1><p>${esc(yt.title || '')} · 스냅샷 ${esc(yt.snapshot || '')} ${badge(yt)} ${srcLinks(yt.sources)}</p></div>
    <div class="card-tools">
      <span class="small muted">세대</span><span id="soGens">${[2, 3, 4, 5].map(g => `<span class="chip ${SO.gens.has(g) ? 'on' : ''}" data-g="${g}"><i style="background:${PAL[g]}"></i>${g}세대</span>`).join(' ')}</span>
      ${seg('soType', [['all', '전체'], ['girl', '걸그룹'], ['boy', '보이그룹'], ['coed', '혼성']], SO.type)}
      <select id="soTop">${[15, 25, 40, 66].map(n => `<option value="${n}" ${SO.top === n ? 'selected' : ''}>Top ${n}</option>`).join('')}</select></div></div>
  <div class="grid g3">
    ${card({ title: '구독자 리더보드', sub: '분홍 = 걸그룹 · 파랑 = 보이그룹 · 보라 = 혼성', tools: seg('soMetric', [['subs', '구독자'], ['weekly', '주간 증가']], SO.metric), body: chartDiv('soBoard', 'h560'), cls: 'span2' })}
    ${card({ title: '세대별 구독자 합계', sub: '그룹 구분 누적 · 필터 적용(계산)', body: chartDiv('soGen', 'h260') + chartDiv('soGenCnt', 'h260') })}
    ${card({ title: '구독자 × 주간 증가', sub: '로그 X축 · 주간 0은 축 하단 · 우상단 = 대형+성장', body: chartDiv('soScatter', 'h420'), cls: 'span2' })}
    ${card({ title: '소속사별 구독자 합계 Top 12', sub: '필터 적용(계산)', body: chartDiv('soCo', 'h420') })}
  </div>
  <h2 class="sec">유튜브 구독자 표</h2>
  <div id="soTable"></div>
  <div class="card" style="margin-top:12px"><ul class="dots small muted">${(yt.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
  <h2 class="sec">${esc(ig.title || '인스타그램')}</h2>
  <div class="grid g2">
    ${card({ title: '멤버별 팔로워', sub: '각 행 기준 시각 참고', body: chartDiv('soIG', 'h260') + '<div id="soIGt"></div>' })}
    ${card({ title: '기타 아티스트 (텍스트 값)', sub: '수치가 문자열(약 ~)로만 제공 → 차트 미표시 · 상태 필드 없음', body: `<ul class="clean">${(ig.others || []).map(o => `<li><b>${esc(o.member)}</b> <span class="muted">${esc(o.text)}</span></li>`).join('')}</ul><div class="card-foot">${srcLinks(ig.othersSources)}</div><ul class="dots small muted" style="margin-top:10px">${(ig.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` })}
  </div>
  <h2 class="sec">${esc(mg.title || '')} ${badge(mg)} ${srcLinks(mg.sources)}</h2>
  <div class="card" id="soMG"></div>`;

  const draw = () => {
    const R = filt();
    if (!ytOK) { ['soBoard', 'soGen', 'soGenCnt', 'soScatter', 'soCo'].forEach(id => $('#' + id).innerHTML = hiddenNote('유튜브 데이터')); soTbl.draw(); return; }
    const sorted = R.slice().sort((a, b) => b[SO.metric] - a[SO.metric]).slice(0, SO.top);
    const tip = r => tipHTML({ title: `${r.ko} (${r.group})`, rows: [['순위', '#' + r.rank], ['구독자', fmtN(r.subs)], ['주간 변화', (r.weekly > 0 ? '+' : '') + fmtN(r.weekly)], ['주간 증가율(계산)', r.subs ? (r.weekly / r.subs * 100).toFixed(2) + '%' : '—'], ['세대·구분', `${r.gen}세대 · ${TYPE_LABEL[r.type]}`], ['소속', esc(r.company)]], status: yt.status, sources: yt.sources });
    hbar($('#soBoard'), sorted.map(r => ({ label: `${r.ko}`, value: r[SO.metric], color: TYPE_COLOR[r.type], r })), { valueFmt: v => SO.metric === 'subs' ? fmtKo(v, 1) : (v > 0 ? '+' : '') + fmtKo(v, 0), tip: it => tip(it.r), height: Math.max(360, sorted.length * 21 + 30), labelWidth: 110 });
    const gens = [2, 3, 4, 5].filter(g => SO.gens.has(g)), types = ['girl', 'boy', 'coed'];
    chart('soGen', { tooltip: { trigger: 'axis', valueFormatter: v => fmtKo(v, 1) }, legend: {}, grid: { top: 30, left: 8, right: 10, bottom: 4, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: gens.map(g => g + '세대') }), yAxis: axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } }),
      series: types.map(t => ({ name: TYPE_LABEL[t], type: 'bar', stack: 's', barMaxWidth: 40, itemStyle: { color: TYPE_COLOR[t] }, data: gens.map(g => R.filter(r => r.gen === g && r.type === t).reduce((a, r) => a + r.subs, 0)) })) });
    chart('soGenCnt', { tooltip: { trigger: 'axis' }, legend: { data: ['그룹 수', '평균 구독자'] }, grid: { top: 30, left: 8, right: 10, bottom: 4, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: gens.map(g => g + '세대') }),
      yAxis: [axisStyle({ type: 'value', minInterval: 1 }), axisStyle({ type: 'value', splitLine: { show: false }, axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } })],
      series: [{ name: '그룹 수', type: 'bar', barMaxWidth: 30, itemStyle: { color: PAL[6] }, data: gens.map(g => R.filter(r => r.gen === g).length) },
        { name: '평균 구독자', type: 'line', yAxisIndex: 1, itemStyle: { color: PAL[1] }, data: gens.map(g => { const a = R.filter(r => r.gen === g); return a.length ? Math.round(a.reduce((s, r) => s + r.subs, 0) / a.length) : null; }), tooltip: { valueFormatter: v => fmtKo(v, 1) } }] });
    chart('soScatter', { grid: { left: 10, right: 30, top: 30, bottom: 30, containLabel: true }, tooltip: { trigger: 'item', formatter: p => tip(p.data.r) },
      legend: { data: types.map(t => TYPE_LABEL[t]) },
      xAxis: axisStyle({ type: 'log', name: '구독자', nameLocation: 'middle', nameGap: 26, min: 5e5, axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } }),
      yAxis: axisStyle({ type: 'value', name: '주간 증가', axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } }),
      series: types.map(t => ({ name: TYPE_LABEL[t], type: 'scatter', itemStyle: { color: TYPE_COLOR[t], opacity: .85 }, symbolSize: 11,
        data: R.filter(r => r.type === t).map(r => ({ value: [r.subs, r.weekly], r })), label: { show: true, position: 'right', fontSize: 10, color: themeColors().muted, formatter: p => p.data.r.weekly >= 50000 || p.data.r.subs >= 2e7 ? p.data.r.ko : '' }, labelLayout: { hideOverlap: true } })) });
    const co = {}; R.forEach(r => { co[r.company] = co[r.company] || { v: 0, n: [] }; co[r.company].v += r.subs; co[r.company].n.push(r.ko); });
    const coS = Object.entries(co).sort((a, b) => b[1].v - a[1].v).slice(0, 12);
    hbar($('#soCo'), coS.map(([k, o], i) => ({ label: k, value: o.v, color: PAL[i % PAL.length], o })), { valueFmt: v => fmtKo(v, 1), labelWidth: 130, tip: it => `<b>${esc(it.label)}</b><br>${fmtN(it.value)}<br><span class="muted">${it.o.n.map(esc).join(', ')}</span>` });
    soTbl.draw();
  };
  const soTbl = DataTable($('#soTable'), [
    { k: 'rank', label: '순위', num: true }, { k: 'ko', label: '그룹', html: r => `<b>${esc(r.ko)}</b> <span class="muted small">${esc(r.group)}</span>` },
    { k: 'type', label: '구분', html: r => `<span style="color:${TYPE_COLOR[r.type]}">●</span> ${TYPE_LABEL[r.type] || r.type}` },
    { k: 'gen', label: '세대', num: true, html: r => r.gen + '세대' }, { k: 'company', label: '소속사' },
    { k: 'subs', label: '구독자', num: true, html: r => fmtN(r.subs) },
    { k: 'weekly', label: '주간 변화', num: true, html: r => r.weekly > 0 ? `<span style="color:#4ade80">+${fmtN(r.weekly)}</span>` : r.weekly < 0 ? `<span style="color:#f87171">${fmtN(r.weekly)}</span>` : '<span class="dim">0</span>' },
    { k: 'rate', label: '주간 증가율', num: true, title: 'weekly ÷ subs (계산)', val: r => r.subs ? r.weekly / r.subs : null, html: r => r.subs ? (r.weekly / r.subs * 100).toFixed(2) + '%' : '—' },
    { k: 'st', label: '등급', nosort: true, html: () => badge(yt) + srcLinks(yt.sources) },
  ], { rows: filt, sort: { k: 'subs', dir: 'desc' }, search: ['group', 'ko', 'company'], maxH: 520 });
  draw();
  $('#soGens').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; const g = +c.dataset.g; SO.gens.has(g) ? SO.gens.delete(g) : SO.gens.add(g); if (!SO.gens.size) SO.gens.add(g); $$('#soGens .chip').forEach(x => x.classList.toggle('on', SO.gens.has(+x.dataset.g))); draw(); };
  bindSeg('soType', v => { SO.type = v; draw(); }); bindSeg('soMetric', v => { SO.metric = v; draw(); });
  $('#soTop').onchange = e => { SO.top = +e.target.value; draw(); };
  // IG
  const igR = (ig.rows || []).filter(r => accVisible(r.status)).sort((a, b) => b.followers - a.followers);
  if (igR.length) hbar($('#soIG'), igR.map((r, i) => ({ label: r.member, value: r.followers, color: ['#f472b6', '#fb7185', '#e879f9', '#c084fc'][i % 4], r })), { valueFmt: v => fmtKo(v, 2), labelWidth: 110, tip: it => tipHTML({ title: `${it.r.member} ${it.r.handle}`, rows: [['팔로워', esc(it.r.text)], ['기준 시각', esc(it.r.asOf)]], status: it.r.status, sources: it.r.sources }) });
  else $('#soIG').innerHTML = hiddenNote('인스타그램');
  $('#soIGt').innerHTML = `<table class="dt" style="margin-top:8px"><thead><tr><th>멤버</th><th>계정</th><th class="num">팔로워</th><th>기준 시각</th><th>등급</th></tr></thead><tbody>${igR.map(r => `<tr><td><b>${esc(r.member)}</b></td><td class="muted">${esc(r.handle)}</td><td class="num">${esc(r.text)}</td><td class="small muted">${esc(r.asOf)}</td><td>${badge(r)}${srcLinks(r.sources)}</td></tr>`).join('')}</tbody></table>`;
  $('#soMG').innerHTML = accVisible(mg.status) ? `<table class="dt"><thead><tr><th>멤버</th><th>소속 그룹</th></tr></thead><tbody>${(mg.rows || []).map(r => `<tr><td><b>${esc(r.person)}</b></td><td>${esc(r.groups)}</td></tr>`).join('')}</tbody></table><div class="card-foot">${esc(mg.note || '')}</div>` : hiddenNote('복수 그룹 멤버');
}

/* ========== 시상식·이벤트 ========== */
const EV = { state: 'all' };
function parseLineup(s) {
  if (!s) return { names: [], count: null, undisclosed: true };
  const m = s.match(/\((\d+)팀/) || s.match(/^(\d+)팀/);
  if (/미공개/.test(s) && !/,/.test(s)) return { names: [], count: 0, undisclosed: true };
  const names = s.replace(/\[[^\]]*\]/g, ',').replace(/\d차\s*(\([^)]*\))?\s*:/g, ',').split(/[,/]/).map(x => x.replace(/\(\d+팀\)?/, '').replace(/\s외\s*$/, '').replace(/\s외\s*\(.*$/, '').trim())
    .filter(x => x && !/미공개|미확인|참조|명단|^외$/.test(x));
  return { names, count: m ? +m[1] : names.length, undisclosed: false, partial: /외|미확인|\d차/.test(s) };
}
function renderEvents() {
  const el = $('#tab-events'); const A = D.events?.awards2026 || {}; const T = D.events?.tma2026 || {};
  const evs = (A.events || []).map(e => ({ ...e, lu: parseLineup(e.lineup) }));
  const vis = () => evs.filter(e => accVisible(e.status) && (EV.state === 'all' || e.state === EV.state));
  el.innerHTML = `
  <div class="page-head"><div><h1>시상식·이벤트</h1><p>${esc(A.title || '')} · ${esc(A.note || '')}</p></div>
    <div class="card-tools">${seg('evState', [['all', '전체'], ['종료', '종료'], ['예정', '예정']], EV.state)}</div></div>
  <div class="grid g3">
    ${card({ title: '2026 시상식 타임라인', sub: 'Y = 라인업 표기 팀 수(문자열 파싱, ‘N팀’ 표기 우선) · 빈 원 = 라인업 미공개 · 점선 = 오늘', body: chartDiv('evTL', 'h420'), cls: 'span2' })}
    ${card({ title: '시상식 다출연 아티스트', sub: '라인업 문자열 표기 그대로 집계(별칭 미통합, 예: ZB1)', body: chartDiv('evFreq', 'h420') })}
  </div>
  <h2 class="sec">시상식 캘린더</h2>
  <div id="evTable"></div>
  ${D.events?.festivals2026 ? festivalsHTML(D.events.festivals2026) : ''}
  <h2 class="sec">${esc(T.name || 'TMA')}</h2>
  <div class="grid g3">
    ${card({ title: '개요', body: `<dl class="kv"><dt>일시</dt><dd>${esc(T.date)}</dd><dt>장소</dt><dd>${esc(T.venue)}</dd><dt>중계</dt><dd>${esc(T.broadcast)}</dd><dt>영상</dt><dd class="small muted">${esc(T.video)}</dd></dl><h4 style="margin:14px 0 6px">라인업 ${srcLinks(T.lineupSources)}</h4><div class="tagwrap">${(T.lineup || []).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` })}
    ${card({ title: '타임테이블', body: `<div id="tmaSched"></div>` })}
    ${card({ title: '수상 결과', sub: srcLinks(T.winnerSources), body: `<ul class="clean">${(T.winners || []).map(w => `<li><span class="muted small">${esc(w.award)}</span><br><b>${esc(w.winner)}</b></li>`).join('')}</ul>` })}
    ${card({ title: '무대 구성', sub: esc(T.orderNote || ''), cls: 'spanall', body: '<div id="tmaStages"></div>' })}
  </div>`;
  const draw = () => {
    const R = vis(); const now = asOfMs();
    chart('evTL', {
      grid: { left: 10, right: 30, top: 30, bottom: 30, containLabel: true },
      tooltip: { trigger: 'item', formatter: p => { const e = p.data.e; return tipHTML({ title: e.name, rows: [['일정', esc(e.date)], ['장소', esc(e.venue)], ['상태', e.state], ['라인업', e.lu.undisclosed ? '미공개' : e.lu.count + '팀' + (e.lu.partial ? ' (부분/외)' : '')]], status: e.status, note: (e.results.length ? '결과: ' + e.results.join(' / ') + ' ' : '') + (e.note || ''), sources: e.sources }); } },
      legend: { data: ['종료', '예정'] },
      xAxis: axisStyle({ type: 'time', min: tms('2026-01-01'), max: tms('2026-12-31'), axisLabel: { color: themeColors().muted, formatter: v => (new Date(v).getMonth() + 1) + '월' } }),
      yAxis: axisStyle({ type: 'value', name: '라인업 팀 수', minInterval: 1 }),
      series: [['종료', '#8b93a5'], ['예정', '#22d3ee']].map(([st, col]) => ({
        name: st, type: 'scatter', itemStyle: { color: col },
        data: R.filter(e => e.state === st).map(e => ({ value: [tms(e.dateSort), e.lu.count || 0], e, symbolSize: 12 + Math.sqrt(e.lu.count || 1) * 3, itemStyle: e.lu.undisclosed ? { color: 'transparent', borderColor: col, borderWidth: 2, borderType: 'dashed' } : { color: col, opacity: .85 } })),
        label: { show: true, position: 'top', fontSize: 10, color: themeColors().muted, formatter: p => p.data.e.name.replace(/^제\d+회\s*/, '').replace(/\s*\(.*\)/, '').slice(0, 14) },
        labelLayout: { hideOverlap: true },
        ...(st === '종료' ? { markLine: { symbol: 'none', silent: true, label: { formatter: '오늘', color: '#22d3ee' }, lineStyle: { color: '#22d3ee', type: 'dashed' }, data: [{ xAxis: now }] } } : {}),
      })),
    });
    const freq = {}; R.forEach(e => e.lu.names.forEach(n => freq[n] = (freq[n] || 0) + 1));
    const top = Object.entries(freq).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 18);
    hbar($('#evFreq'), top.map(([k, v], i) => ({ label: k, value: v, color: PAL[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2] })), { valueFmt: v => v + '회', axisFmt: v => v, labelWidth: 120, tip: it => `<b>${esc(it.label)}</b><br>${it.value}개 시상식 라인업<br><span class="muted small">${R.filter(e => e.lu.names.includes(it.label)).map(e => esc(e.name)).join('<br>')}</span>` });
    evTbl.draw();
  };
  const evTbl = DataTable($('#evTable'), [
    { k: 'dateSort', label: '일정', html: e => `<b>${esc(e.date)}</b>` }, { k: 'name', label: '시상식', html: e => `<b>${esc(e.name)}</b>` }, { k: 'venue', label: '장소' },
    { k: 'state', label: '상태', html: e => `<span class="badge ${e.state === '종료' ? 'b-state-done' : 'b-state-next'}">${esc(e.state)}</span>` },
    { k: 'luc', label: '라인업', cls: 'wrap', val: e => e.lu.count, html: e => `<span class="small">${esc(e.lineup)}</span>` },
    { k: 'res', label: '결과·비고', cls: 'wrap', nosort: true, html: e => (e.results.length ? `<ul class="dots small">${e.results.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '') + (e.note ? `<span class="note">${esc(e.note)}</span>` : '') },
    { k: 'status', label: '등급', html: e => badge(e) + srcLinks(e.sources) },
  ], { rows: vis, sort: { k: 'dateSort', dir: 'asc' }, search: ['name', 'venue', 'lineup'] });
  draw();
  bindSeg('evState', v => { EV.state = v; draw(); });
  if (D.events?.festivals2026) festivalsCharts(D.events.festivals2026);
  const sch = (T.schedule || []).filter(s => accVisible(s.status)).sort((a, b) => a.time.replace('~', '').localeCompare(b.time.replace('~', '')));
  $('#tmaSched').innerHTML = `<div class="timeline">${sch.map(s => `<div class="ev"><div class="d">${esc(s.time)}</div>${esc(s.item)} ${badge(s)}${srcLinks(s.sources)}</div>`).join('') || hiddenNote('타임테이블')}</div>`;
  DataTable($('#tmaStages'), [
    { k: 'order', label: '순서' }, { k: 'artist', label: '아티스트', html: s => `<b>${esc(s.artist)}</b>` }, { k: 'stage', label: '무대', cls: 'wrap' },
    { k: 'status', label: '등급', html: s => badge(s) + srcLinks(s.sources) },
  ], { rows: () => (T.stages || []).filter(s => accVisible(s.status)) });
}

function festivalsHTML(F) {
  const last = (F.columns || []).length - 1;
  const rows = (F.rows || []).filter(r => accVisible(r[last]));
  return `<h2 class="sec">${esc(F.title)} ${srcLinks(F.sources)} <span class="small muted">기준 ${esc(F.asOf || '')}</span></h2>
  <div class="grid g3">
    ${card({ title: '페스티벌별 K-pop 출연', cls: 'span2', body: simpleTable(F.columns || [], rows.map(r => r.map((c, i) => i === last ? badge(c) + srcLinks((F.rowSources || {})[r[0]]) : i === 0 ? `<b>${esc(c)}</b>` : i === 2 ? `<span class="small">${esc(c)}</span>` : esc(c)))), foot: esc(F.note || '') })}
    ${card({ title: '걸그룹 2026 페스티벌 출연 수', sub: 'girls 표 ‘횟수’ 열 · Claude 대화 기준', body: chartDiv('evFest', 'h300') })}
    ${card({ title: '걸그룹 출연 현황', cls: 'span2', body: simpleTable(['그룹', '세대', '출연 페스티벌', '횟수', '투어와의 관계'], (F.girls || []).map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : esc(c)))) })}
    ${card({ title: `연도별 이정표 ${badge('claude')}`, body: `<div class="timeline">${(F.milestones || []).map(m => `<div class="ev"><div class="d">${esc(m[0])}</div>${esc(m[1])}</div>`).join('')}</div>` })}
  </div>`;
}
function festivalsCharts(F) {
  if (!accVisible('claude')) { $('#evFest').innerHTML = hiddenNote('Claude 기준 데이터'); return; }
  const g = (F.girls || []).map(r => ({ label: r[0], value: +r[3] || 0, gen: r[1], f: r[2] })).sort((a, b) => b.value - a.value);
  hbar($('#evFest'), g.map(x => ({ ...x, color: TYPE_COLOR.girl })), { valueFmt: v => v + '회', axisFmt: v => v, labelWidth: 100, tip: it => tipHTML({ title: it.label, rows: [['세대', it.gen + '세대'], ['횟수', it.value + '회']], status: 'claude', note: it.f, sources: F.sources }) });
}

/* ========== 아티스트·브랜드 ========== */
const AR = { year: 'all' };
function simpleTable(head, rows) { return `<div class="tablewrap"><table class="dt"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function sectionCard(obj, inner, opts = {}) {
  if (!obj) return '';
  const est = !!opts.est;
  const head = `${esc(obj.title || opts.title || '')} ${badges(obj.status, est)} ${srcLinks(obj.sources)}`;
  return card({ title: head, sub: opts.sub || '', cls: opts.cls || '', body: accVisible(obj.status, est) ? inner : hiddenNote('이 섹션'), foot: obj.note ? esc(obj.note) : '' });
}
function renderArtists() {
  const el = $('#tab-artists'); const A = D.artists || {};
  const mc = A.memberChart || {}; const amb = A.ambassadors || {}; const fe = A.fanEvents;
  const cmp = A.compare || {};
  const members = (mc.rows || []).map(r => ({ n: +r[0], date: r[1], name: r[2], group: r[3], year: +(String(r[1]).match(/\d{4}/) || [])[0] || null, exact: /^\d{4}-\d{2}-\d{2}$/.test(r[1]) }));
  el.innerHTML = `
  <div class="page-head"><div><h1>아티스트·브랜드</h1><p>프로필, 2004–2010년생 걸그룹 멤버, 앰버서더·광고, 소속사, 팬 이벤트 비용(추정).</p></div></div>
  <h2 class="sec">${esc(cmp.title || '')} ${badge('verified')}<span class="small muted">셀별 등급</span></h2>
  <div class="card" id="arCmp"></div>
  <div class="card" style="margin-top:12px"><b class="small">인사이트</b> ${badge(cmp.insightStatus)}<ul class="dots small">${(cmp.insights || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <h2 class="sec">프로필</h2>
  <div class="grid g2" id="arProfiles"></div>
  <h2 class="sec">${esc(mc.title || '')} ${badge(mc)} ${srcLinks(mc.sources)}</h2>
  <div class="grid g3">
    ${card({ title: '출생 연도 분포', sub: '해칭 = 정확한 날짜 미확인(‘경’·연도만)', body: chartDiv('arYear', 'h300') })}
    ${card({ title: '그룹별 인원', sub: '해당 연령대 멤버 수(계산)', body: chartDiv('arGroup', 'h300') })}
    ${card({ title: '멤버 표', tools: seg('arYearSeg', [['all', '전체'], ...[2004, 2005, 2006, 2007, 2008, 2009, 2010].map(y => [String(y), String(y).slice(2)])], AR.year), body: '<div id="arMembers"></div>' })}
  </div>
  <div class="card-foot">${esc(mc.note || '')}</div>
  <h2 class="sec">브랜드·앰버서더</h2>
  <div class="grid g2">
    ${sectionCard(amb, `<p class="small muted">${esc(amb.summary || '')}</p>${chartDiv('arAmb', 'h260')}<h4 style="margin:10px 0 6px">대표 사례</h4><div class="tagwrap">${(amb.examples || []).map(e => `<span class="tag"><b>${esc(e[0])}</b> · ${esc(e[1])}</span>`).join('')}</div>`)}
    ${sectionCard(amb.girlAds, amb.girlAds ? simpleTable(['그룹', '광고·앰버서더'], amb.girlAds.rows.map(r => [`<b>${esc(r[0])}</b>`, esc(r[1])])) : '')}
    ${sectionCard(A.brandCollabs, A.brandCollabs ? `<div id="arBrand"></div>` : '', { cls: 'spanall' })}
  </div>
  <h2 class="sec">소속사·프로듀서</h2>
  <div class="grid g2">
    ${sectionCard(A.agencies, A.agencies ? simpleTable(A.agencies.columns, A.agencies.rows.map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : esc(c)))) : '')}
    ${sectionCard(A.producers, A.producers ? simpleTable(A.producers.columns, A.producers.rows.map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : `<span class="small">${esc(c)}</span>`))) : '')}
  </div>
  ${fe ? `<h2 class="sec">${esc(fe.title)} ${badges(fe.status, true)} ${srcLinks(fe.sources)}</h2>
  <div class="banner"><b>추정치</b> — 팬 이벤트 비용은 시장 단가 기반 추정(실제 집행액 비공개). 막대는 최소–최대 범위.</div>
  <div class="grid g2">
    ${card({ title: '2026 지역별 집행 추정 범위', sub: '원 · 범위 막대(해칭 = 추정)', body: accVisible(fe.status, true) ? chartDiv('arFE', 'h260') : hiddenNote('팬 이벤트 추정') })}
    ${card({ title: '유형별 예상 비용', body: accVisible(fe.status, true) ? chartDiv('arFEc', 'h480') : hiddenNote('팬 이벤트 추정') })}
    ${card({ title: '지역별 구성', cls: 'spanall', body: accVisible(fe.status, true) ? simpleTable(['지역', '주요 구성', '소계 추정'], fe.regions.map(r => [`<b>${esc(r[0])}</b>`, `<span class="small">${esc(r[1])}</span>`, `<span class="estval">${esc(r[2])}</span>`])) : '', foot: esc(fe.note) })}
  </div>` : ''}
  <h2 class="sec">${esc(A.groups?.title || '')}</h2>
  <div class="card"><div class="tagwrap" style="margin-bottom:10px">${(A.groups?.list || []).map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div><ul class="clean">${(A.groups?.facts || []).filter(f => accVisible(f.status)).map(f => `<li>${badge(f)} ${esc(f.text)} ${srcLinks(f.sources)}</li>`).join('')}</ul></div>`;

  // compare
  $('#arCmp').innerHTML = `<div class="tablewrap"><table class="dt"><thead><tr><th>항목</th>${(cmp.columns || []).map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(cmp.rows || []).map(r => `<tr><td class="muted">${esc(r.item)}</td>${r.cells.map(c => `<td>${accVisible(c.status) ? `${esc(c.v)} ${badge(c)}${srcLinks(c.sources)}` : '<span class="dim small">필터로 숨김</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  // profiles
  $('#arProfiles').innerHTML = (A.profiles || []).map(p => card({
    title: `${esc(p.name)} <span class="muted small">${TYPE_LABEL[p.type] || p.type || ''}</span>`,
    body: `<dl class="kv">${(p.facts || []).filter(f => accVisible(f.status)).map(f => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)} ${badge(f)}${srcLinks(f.sources)}</dd>`).join('')}</dl>
      ${(p.timeline || []).length ? `<h4 style="margin:12px 0 6px">타임라인</h4><div class="timeline">${p.timeline.filter(t => accVisible(t.status)).map(t => `<div class="ev"><div class="d">${esc(t.date)}</div>${esc(t.text)} ${badge(t)}${srcLinks(t.sources)}</div>`).join('')}</div>` : ''}
      ${(p.pending || []).length ? `<div class="small" style="margin-top:8px"><span class="badge b-conflict">배치 2 예정</span> ${p.pending.map(esc).join(', ')}</div>` : ''}
      ${p.artifacts ? `<div class="small muted" style="margin-top:8px">자료: ${esc(p.artifacts)}</div>` : ''}`,
    foot: p.withheld ? '게재 보류: ' + esc(p.withheld) : '',
  })).join('');
  // members
  const mOK = accVisible(mc.status);
  if (mOK) {
    const years = [2004, 2005, 2006, 2007, 2008, 2009, 2010];
    chart('arYear', { tooltip: { trigger: 'axis' }, legend: { data: ['날짜 확인', '연도만/‘경’'] }, grid: { top: 30, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: years.map(y => y + '') }), yAxis: axisStyle({ type: 'value', minInterval: 1 }),
      series: [{ name: '날짜 확인', type: 'bar', stack: 'y', barMaxWidth: 40, itemStyle: { color: PAL[2] }, data: years.map(y => members.filter(m => m.year === y && m.exact).length) },
        { name: '연도만/‘경’', type: 'bar', stack: 'y', barMaxWidth: 40, itemStyle: estStyle(PAL[2]), data: years.map(y => members.filter(m => m.year === y && !m.exact).length) }] });
    const gc = {}; members.forEach(m => gc[m.group] = (gc[m.group] || 0) + 1);
    const gs = Object.entries(gc).sort((a, b) => b[1] - a[1]);
    hbar($('#arGroup'), gs.map(([k, v]) => ({ label: k, value: v, color: PAL[2] })), { valueFmt: v => v + '명', axisFmt: v => v, labelWidth: 100, height: Math.max(300, gs.length * 20 + 20), tip: it => `<b>${esc(it.label)}</b><br>${members.filter(m => m.group === it.label).map(m => `${esc(m.name)} <span class="muted">${esc(m.date)}</span>`).join('<br>')}` });
    const mt = DataTable($('#arMembers'), [
      { k: 'date', label: '생년월일', html: m => m.exact ? esc(m.date) : `<span class="estval" title="정확한 날짜 미확인">${esc(m.date)}</span>` }, { k: 'name', label: '이름', html: m => `<b>${esc(m.name)}</b>` }, { k: 'group', label: '그룹' },
    ], { rows: () => members.filter(m => AR.year === 'all' || String(m.year) === AR.year), sort: { k: 'date', dir: 'asc' }, search: ['name', 'group'], maxH: 300 });
    bindSeg('arYearSeg', v => { AR.year = v; mt.draw(); });
  } else ['arYear', 'arGroup', 'arMembers'].forEach(id => $('#' + id).innerHTML = hiddenNote('멤버 데이터'));
  // ambassadors comparison
  if ($('#arAmb')) {
    const rows = (amb.comparisons || []).map(r => ({ b: r[0], k: +(String(r[1]).match(/\d+/) || [0])[0], o: +(String(r[2]).match(/\d+/) || [0])[0] }));
    chart('arAmb', { tooltip: { trigger: 'axis' }, legend: {}, grid: { top: 30, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: rows.map(r => r.b) }), yAxis: axisStyle({ type: 'value', name: '명', minInterval: 1 }),
      series: [{ name: 'K-pop', type: 'bar', barMaxWidth: 28, itemStyle: { color: PAL[2] }, data: rows.map(r => r.k), label: { show: true, position: 'top', color: themeColors().muted } }, { name: '해외', type: 'bar', barMaxWidth: 28, itemStyle: { color: PAL[5] }, data: rows.map(r => r.o), label: { show: true, position: 'top', color: themeColors().muted } }] });
  }
  if ($('#arBrand') && A.brandCollabs) {
    const bc = A.brandCollabs; const last = bc.columns.length - 1;
    $('#arBrand').innerHTML = simpleTable(bc.columns.slice(0, last).concat(['등급']), bc.rows.filter(r => accVisible(r[last] || bc.status)).map(r => r.map((c, i) => i === last ? badge(c) : i === 0 ? `<b>${esc(c)}</b>` : `<span class="small">${esc(c)}</span>`)));
  }
  // fan events range
  if (fe && accVisible(fe.status, true)) {
    const rangeChart = (id, rows, labelW) => {
      const data = rows.map(r => { const [lo, hi] = parseRange(r.v); return { ...r, lo, hi }; }).filter(r => isNum(r.lo));
      return chart(id, { grid: { left: 8, right: 110, top: 10, bottom: 10, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = data[ps[0].dataIndex]; return tipHTML({ title: r.label, rows: [['추정 범위', esc(r.v) + '원'], r.p ? ['기간', esc(r.p)] : null], status: fe.status, estimate: true, sources: fe.sources }); } },
        xAxis: axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: v => fmtKo(v, 0) } }),
        yAxis: axisStyle({ type: 'category', inverse: true, data: data.map(r => r.label), axisLabel: { color: themeColors().text, fontSize: 11, width: labelW, overflow: 'truncate' }, splitLine: { show: false } }),
        series: [{ type: 'bar', stack: 'r', silent: true, itemStyle: { color: 'transparent' }, data: data.map(r => r.lo) },
          { type: 'bar', stack: 'r', barMaxWidth: 14, itemStyle: estStyle(ACC.estimate.color, { borderRadius: 3 }), data: data.map(r => Math.max(r.hi - r.lo, r.hi * 0.01)), label: { show: true, position: 'right', fontSize: 10, color: themeColors().muted, formatter: p => data[p.dataIndex].v } }] });
    };
    rangeChart('arFE', fe.regions.map(r => ({ label: r[0], v: r[2] })), 80);
    rangeChart('arFEc', fe.costs.map(r => ({ label: r[0], v: r[2], p: r[1] })), 160);
  }
}

/* ========== 오디션 ========== */
function renderAuditions() {
  const el = $('#tab-auditions'); const A = D.auditions || {};
  const progs = (A.programs || []).map(p => { const ys = String(p.year).match(/\d{4}/g) || []; return { ...p, y0: +ys[0] || null, y1: +(ys[1] || ys[0]) || null }; });
  const vis = () => progs.filter(p => accVisible(p.status));
  el.innerHTML = `
  <div class="page-head"><div><h1>오디션</h1><p>기획사·방송 서바이벌 오디션 프로그램과 결과 그룹, HYBE INDIA 오디션.</p></div></div>
  <div class="grid g3">
    ${card({ title: '오디션 프로그램 연표', sub: '방송 연도 기준 · 색 = 등급 · 마우스 → 결과 그룹', body: chartDiv('auTL', 'h420'), cls: 'span2' })}
    ${card({ title: esc(A.hybeIndia?.title || 'HYBE INDIA'), body: `<dl class="kv">${(A.hybeIndia?.facts || []).filter(f => accVisible(f.status)).map(f => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)} ${badge(f)}${srcLinks(f.sources)}</dd>`).join('')}</dl>` })}
  </div>
  <h2 class="sec">프로그램 표</h2><div id="auTable"></div>
  <h2 class="sec">메모 ${srcLinks(A.noteSources)}</h2><div class="card"><ul class="clean">${(A.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
  const R = vis().filter(p => p.y0).sort((a, b) => a.y0 - b.y0);
  gantt($('#auTL'), R.map(p => ({ label: `${p.program} → ${p.result}`, s: p.y0, e: p.y1 + 1, color: ACC[STATUS_GROUP(p.status)].color, p })), { xType: 'value', min: 2014, max: 2027, height: 420, labelWidth: 260, xFmt: v => v, tip: d => tipHTML({ title: d.p.program, rows: [['연도', esc(d.p.year)], ['주최', esc(d.p.organizer)], ['결과', `<b>${esc(d.p.result)}</b>`]], status: d.p.status, note: d.p.feature, sources: d.p.sources }) });
  DataTable($('#auTable'), [
    { k: 'y0', label: '연도', html: p => esc(p.year) }, { k: 'program', label: '프로그램', html: p => `<b>${esc(p.program)}</b>` }, { k: 'organizer', label: '주최·방송' },
    { k: 'result', label: '결과 그룹', html: p => `<b>${esc(p.result)}</b>` }, { k: 'feature', label: '특징', cls: 'wrap' },
    { k: 'status', label: '등급', html: p => badge(p) + srcLinks(p.sources) },
  ], { rows: vis, sort: { k: 'y0', dir: 'asc' }, search: ['program', 'result', 'organizer'] });
}

/* ========== 랜덤플레이댄스 ========== */
function renderRPD() {
  const el = $('#tab-rpd'); const R = D.rpd || {}; const v2 = R.v2 || {};
  el.innerHTML = `
  <div class="page-head"><div><h1>랜덤플레이댄스 (RPD) 참여 인원 추정</h1><p>${esc(R.summary || '')} ${badge(R)}</p></div></div>
  <div class="banner"><b>데이터 상태</b> — 실제 영상별 참여 인원·조회수 데이터는 아직 없습니다(조회수 ‘미확인’). 아래 결과 표의 인원은 도구의 <b>예시 출력</b>이며, 벤치마크 수치는 추정치입니다.</div>
  <div class="grid g3">
    ${card({ title: 'v1 파이프라인', sub: badge(R), body: `<ol class="steps">${(R.pipeline || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` })}
    ${sectionCard(v2, `<ol class="steps">${(v2.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>`, {})}
    ${sectionCard({ ...v2, title: 'v2 판정 신호 가중치', note: '' }, chartDiv('rpdW', 'h260'))}
    ${card({ title: '방식별 토큰 사용량', sub: '60분·40곡 영상 기준 추정 · 로그 축 · 해칭 = 추정', body: accVisible(v2.benchStatus || v2.status, true) ? chartDiv('rpdTok', 'h300') : hiddenNote('벤치마크') })}
    ${card({ title: '방식별 소요 시간 범위', sub: '분 · 최소–최대 · 해칭 = 추정', body: accVisible(v2.benchStatus || v2.status, true) ? chartDiv('rpdTime', 'h300') : hiddenNote('벤치마크'), foot: esc(v2.benchNote || '') })}
    ${card({ title: '결과 (results)', sub: '조회수는 미확인', body: '<div id="rpdRes"></div>' })}
  </div>
  <div class="grid g3" style="margin-top:16px">
    ${card({ title: '실행 명령', body: `<pre>${(R.commands || []).map(esc).join('\n')}\n\n# v2\n${esc(v2.command || '')}</pre><div class="small muted">출력: ${(R.outputs || []).map(esc).join(', ')} · v2 산출물: ${(v2.artifacts || []).map(esc).join(', ')}</div>` })}
    ${card({ title: '튜닝 파라미터·한계', body: `<div class="tagwrap" style="margin-bottom:8px">${(R.tunables || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><ul class="dots">${(R.limits || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` })}
    ${card({ title: '테스트·비고', body: `<p class="small">${esc(v2.test || '')}</p><p class="small muted">${esc(R.note || '')}</p>` })}
  </div>
  ${(v2.options || v2.tuning || v2.bot) ? `<div class="grid g3" style="margin-top:16px">
    ${v2.options ? card({ title: 'count_dancers.py 옵션', cls: 'span2', body: simpleTable(['옵션', '기본값', '의미'], v2.options.map(r => [`<code>${esc(r[0])}</code>`, `<code>${esc(r[1])}</code>`, esc(r[2])])), foot: (v2.install ? '설치: ' + esc(v2.install) : '') + (v2.outputs ? '<br>출력: ' + esc(v2.outputs) : '') }) : ''}
    ${v2.tuning ? card({ title: '튜닝 루프', body: `<ol class="steps">${v2.tuning.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` }) : ''}
    ${v2.bot ? sectionCard(v2.bot, `<ul class="dots">${(v2.bot.items || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, { cls: 'spanall' }) : ''}
  </div>` : ''}`;
  if (accVisible(v2.status)) chart('rpdW', { tooltip: { trigger: 'item', formatter: '{b}: {c}%' }, legend: { bottom: 0, top: 'auto' }, series: [{ type: 'pie', radius: ['40%', '68%'], center: ['50%', '45%'], itemStyle: { borderColor: themeColors().card, borderWidth: 2 }, label: { color: themeColors().muted, formatter: '{b}\n{c}%' }, data: (v2.weights || []).map(w => ({ name: w[0], value: w[1] })) }] });
  if (accVisible(v2.benchStatus || v2.status, true)) {
    const bench = (v2.bench || []).map(b => ({ m: b[0], tokTxt: b[1], tok: parseKNum(b[1]), time: b[2], rng: parseRange(String(b[2]).replace('분', '')) }));
    hbar($('#rpdTok'), bench.map(b => ({ label: b.m, value: b.tok > 0 ? b.tok : null, est: true, color: ACC.estimate.color, b })), { valueFmt: v => v == null ? '0' : fmtKo(v, 0), labelWidth: 130, tip: it => tipHTML({ title: it.b.m, rows: [['토큰', esc(it.b.tokTxt)], ['소요', esc(it.b.time)]], status: v2.status, estimate: true, sources: v2.sources }) });
    const c = CHARTS.get($('#rpdTok')); c && c.setOption({ xAxis: { type: 'log', min: 1e4, axisLabel: { formatter: v => fmtKo(v, 0) } } });
    chart('rpdTime', { grid: { left: 8, right: 60, top: 10, bottom: 10, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => esc(bench[ps[0].dataIndex].m) + ': ' + esc(bench[ps[0].dataIndex].time) },
      xAxis: axisStyle({ type: 'value', name: '분' }), yAxis: axisStyle({ type: 'category', inverse: true, data: bench.map(b => b.m), splitLine: { show: false }, axisLabel: { color: themeColors().text, fontSize: 11 } }),
      series: [{ type: 'bar', stack: 'r', silent: true, itemStyle: { color: 'transparent' }, data: bench.map(b => b.rng[0]) }, { type: 'bar', stack: 'r', barMaxWidth: 14, itemStyle: estStyle(ACC.estimate.color, { borderRadius: 3 }), data: bench.map(b => b.rng[1] - b.rng[0]), label: { show: true, position: 'right', color: themeColors().muted, fontSize: 10, formatter: p => bench[p.dataIndex].time } }] });
  }
  DataTable($('#rpdRes'), [{ k: 'time', label: '시점' }, { k: 'song', label: '곡' }, { k: 'dancers', label: '인원', html: r => `<span class="estval">${esc(r.dancers)}</span>` }, { k: 'views', label: '조회수', html: r => nullCell(esc(r.views)) }, { k: 'status', label: '등급', html: r => badge(r) }],
    { rows: () => (R.results || []).filter(r => accVisible(r.status)) });
}

/* ========== 산업 모델 ========== */
function renderIndustry() {
  const el = $('#tab-industry'); const I = D.industry || {};
  const te = I.tourEcon || {}, cp = I.compare || {}, lsf = I.lsf || {}, am = I.amort || {}, yv = I.ytViews || {}, kw = I.kwda || {};
  const ok = o => accVisible(o.status, true);
  el.innerHTML = `
  <div class="page-head"><div><h1>산업 모델</h1><p>투어 경제성·수익·감가상각·조회수 집계 모델. <b>모두 Claude 대화의 가정 기반 추정치</b>이며 실제 보고치가 아닙니다.</p></div></div>
  <div class="banner"><b>⚠ 전부 추정치</b> — 이 탭의 모든 차트는 해칭(빗금)·반투명으로 표시됩니다. 관객 수도 모델값이라 ‘투어 트래커’의 실집계와 다를 수 있습니다. ${esc(te.caveat || '')}</div>
  <div class="grid g2">
    ${card({ title: `${esc(te.title || '')} ${badges(te.status, true)} ${srcLinks(te.sources)}`, sub: '총매출 구성(티켓·MD·스폰서, 억 원) + 영업이익률(점선)', body: ok(te) ? chartDiv('inTE', 'h420') : hiddenNote('투어 경제성'), cls: 'spanall' })}
    ${card({ title: '그룹별 효율 지표 (추정)', sub: '회당 매출(억) vs 손익분기 점유율(%)', body: ok(te) ? chartDiv('inEff', 'h360') : hiddenNote('효율') })}
    ${card({ title: '시나리오 (추정)', sub: '합계 총매출·영업이익(억) / 이익률', body: ok(te) ? chartDiv('inSc', 'h360') : hiddenNote('시나리오') })}
    ${card({ title: '모델 표', cls: 'spanall', body: ok(te) ? '<div id="inTEt"></div>' : '', foot: `가정: ${(te.assumptions || []).map(esc).join(' · ')}` })}
    ${card({ title: '지역별 평균 티켓가 가정', body: ok(te) ? simpleTable(['지역', '평균가', '예매율'], (te.prices || []).map(r => r.map(c => `<span class="estval">${esc(c)}</span>`))) : '' })}
    ${card({ title: `${esc(cp.title || '')} ${badges(cp.status, true)} ${srcLinks(cp.sources)}`, sub: '총매출(티켓+MD) 추정, 억 원', body: ok(cp) ? chartDiv('inCp', 'h360') : hiddenNote('비교'), foot: esc(cp.note || '') })}
    ${card({ title: `${esc(lsf.title || '')} ${badges(lsf.status, true)} ${srcLinks(lsf.sources)}`, sub: '지역별 티켓 매출 모델(억 원) · 실적은 하단', body: ok(lsf) ? chartDiv('inLsf', 'h300') + `<ul class="dots small">${(lsf.pnl || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : hiddenNote('PUREFLOW'), foot: '직전 투어 실적(참고): ' + esc(lsf.actual || '') })}
    ${card({ title: `${esc(am.title || '')} ${badges(am.status, true)} ${srcLinks(am.sources)}`, sub: esc(am.base || ''), body: ok(am) ? chartDiv('inAm', 'h300') + simpleTable(['방법', '상각액'], (am.methods || []).map(r => [esc(r[0]), `<span class="estval">${esc(r[1])}</span>`])) : hiddenNote('감가상각'), foot: esc(am.simple || '') })}
    ${card({ title: `${esc(yv.title || '')} ${badges(yv.status, true)} ${srcLinks(yv.sources)}`, sub: '30초 통과율 → 공개 조회수 배수(가설 모델)', body: ok(yv) ? chartDiv('inYv', 'h300') + simpleTable(['유형', '추정 통과율', '예상 배수'], (yv.types || []).map(r => r.map(esc))) : hiddenNote('조회수 모델'), foot: (yv.points || []).map(esc).join('<br>') })}
    ${te.basis ? card({ title: '모델 가정·근거', body: ok(te) ? simpleTable(['항목', '가정', '근거'], te.basis.map(r => r.map(esc))) : hiddenNote('가정') }) : ''}
    ${te.types ? card({ title: '손익 유형', body: ok(te) ? simpleTable(['유형', '팀', '구조', '리스크'], te.types.map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : `<span class="small">${esc(c)}</span>`))) : hiddenNote('유형') }) : ''}
    ${te.regionShare ? card({ title: '지역 기여 (추정)', sub: '관객 비중 vs 매출 비중', body: ok(te) ? chartDiv('inRS', 'h300') + simpleTable(['지역', '관객 비중', '매출 비중', '특징'], te.regionShare.map(r => r.map(esc))) : hiddenNote('지역 기여') }) : ''}
    ${te.benchmark ? card({ title: esc(te.benchmark.title || '벤치마크'), sub: '남성 그룹 실적(보고값)과 걸그룹 모델 대조', body: simpleTable(['아티스트', '기간', '회차', '관객', '매출', '회당 매출', '티켓 단가'], te.benchmark.rows.map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : /추정/.test(r[0]) ? `<span class="estval">${esc(c)}</span>` : esc(c)))), foot: esc(te.benchmark.note || '') + (te.limits ? '<br><b>모델 한계</b>: ' + te.limits.map(esc).join(' · ') : '') }) : ''}
    ${I.merch ? merchHTML(I.merch, ok) : ''}
    ${card({ title: `${esc(kw.title || '')} ${badge(kw)} ${srcLinks(kw.sources)}`, sub: '정성 정보 (수익 금액 미확인)', body: accVisible(kw.status) ? `<dl class="kv">${(kw.changes || []).map(c => `<dt>${esc(c.k)}</dt><dd>${esc(c.v)}</dd>`).join('')}</dl><h4 style="margin:12px 0 6px">아티스트 참여 이유</h4><ul class="dots">${(kw.why || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : hiddenNote('KWDA'), foot: esc(kw.note || '') })}
  </div>`;
  const E = estStyle; const mut = themeColors().muted;
  if (ok(te)) {
    const rows = te.rows || [];
    chart('inTE', { tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return tipHTML({ title: r[0] + ' (추정)', rows: [['세대', r[1] + '세대'], ['회차', r[2]], ['관객(모델)', fmtN(r[3])], ['티켓', fmtEok(r[4])], ['MD', fmtEok(r[5])], ['스폰서', fmtEok(r[6])], ['총매출', fmtEok(r[7])], ['영업이익', fmtEok(r[8])], ['이익률', r[9] + '%']], status: te.status, estimate: true, sources: te.sources }); } },
      legend: { data: ['티켓', 'MD', '스폰서·스트리밍', '영업이익', '이익률'] }, grid: { top: 34, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: rows.map(r => r[0]) }),
      yAxis: [axisStyle({ type: 'value', name: '억 원' }), axisStyle({ type: 'value', name: '%', splitLine: { show: false } })],
      series: [['티켓', 4, PAL[0]], ['MD', 5, PAL[1]], ['스폰서·스트리밍', 6, PAL[3]]].map(([n, i, c]) => ({ name: n, type: 'bar', stack: 'rev', barMaxWidth: 44, itemStyle: E(c), data: rows.map(r => r[i]) }))
        .concat([{ name: '영업이익', type: 'bar', barMaxWidth: 16, itemStyle: E(PAL[4]), data: rows.map(r => r[8]) },
          { name: '이익률', type: 'line', yAxisIndex: 1, lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: ACC.estimate.color }, symbol: 'circle', data: rows.map(r => r[9]) }]) });
    const eff = te.eff || [];
    chart('inEff', { tooltip: { trigger: 'axis' }, legend: { data: ['회당 매출(억)', '손익분기 점유율(%)'] }, grid: { top: 34, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: eff.map(r => r[0]), axisLabel: { color: mut, rotate: 30 } }),
      yAxis: [axisStyle({ type: 'value', name: '억' }), axisStyle({ type: 'value', name: '%', min: 0, max: 100, splitLine: { show: false } })],
      series: [{ name: '회당 매출(억)', type: 'bar', barMaxWidth: 30, itemStyle: E(PAL[0]), data: eff.map(r => r[1]) }, { name: '손익분기 점유율(%)', type: 'line', yAxisIndex: 1, lineStyle: { type: 'dashed' }, itemStyle: { color: ACC.estimate.color }, data: eff.map(r => r[4]) }] });
    const sc = te.scenarios || [];
    chart('inSc', { tooltip: { trigger: 'axis' }, legend: { data: ['총매출', '영업이익', '이익률'] }, grid: { top: 34, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: sc.map(r => r[0]) }), yAxis: [axisStyle({ type: 'value', name: '억' }), axisStyle({ type: 'value', name: '%', splitLine: { show: false } })],
      series: [{ name: '총매출', type: 'bar', barMaxWidth: 40, itemStyle: E(PAL[0]), data: sc.map(r => r[1]), label: { show: true, position: 'top', color: mut, formatter: p => fmtN(p.value) } }, { name: '영업이익', type: 'bar', barMaxWidth: 40, itemStyle: E(PAL[4]), data: sc.map(r => r[2]) }, { name: '이익률', type: 'line', yAxisIndex: 1, lineStyle: { type: 'dashed' }, itemStyle: { color: ACC.estimate.color }, data: sc.map(r => r[3]) }] });
    const cols = ['그룹', '세대', '회차', '관객', '티켓', 'MD', '스폰서', '총매출', '영업이익', '이익률'];
    $('#inTEt').innerHTML = simpleTable(cols, rows.concat(te.total ? [te.total] : []).map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : i === 3 ? fmtN(c) : i >= 4 && i <= 8 ? `<span class="estval">${fmtN(c)}</span>` : i === 9 ? c + '%' : esc(c))));
  }
  if (ok(te) && te.regionShare && $('#inRS')) { const rs = te.regionShare; const pf = x => parseFloat(String(x).replace(/[^\d.]/g, '')) || 0;
    chart('inRS', { tooltip: { trigger: 'axis', valueFormatter: v => v + '%' }, legend: { data: ['관객 비중', '매출 비중'] }, grid: { top: 30, left: 8, right: 10, bottom: 8, containLabel: true },
      xAxis: axisStyle({ type: 'category', data: rs.map(r => r[0]), axisLabel: { color: mut, fontSize: 10.5, interval: 0, width: 70, overflow: 'break' } }), yAxis: axisStyle({ type: 'value', name: '%' }),
      series: [{ name: '관객 비중', type: 'bar', barMaxWidth: 22, itemStyle: E(PAL[1]), data: rs.map(r => pf(r[1])) }, { name: '매출 비중', type: 'bar', barMaxWidth: 22, itemStyle: E(PAL[0]), data: rs.map(r => pf(r[2])) }] }); }
  if (I.merch && ok(I.merch)) merchCharts(I.merch);
  if (ok(cp)) hbar($('#inCp'), (cp.rows || []).map(r => ({ label: r[0], value: r[1], est: true, color: PAL[0] })).sort((a, b) => b.value - a.value), { valueFmt: v => fmtN(v) + '억', axisFmt: v => v, labelWidth: 150 });
  if (ok(lsf)) { const m = (lsf.model || []).filter(r => r[0] !== '합계'); hbar($('#inLsf'), m.map(r => ({ label: r[0], value: parseKNum(r[2]) / 1e8, est: true, color: PAL[2], r })), { valueFmt: v => fmtN(v) + '억', axisFmt: v => v, labelWidth: 60, tip: it => tipHTML({ title: it.r[0], rows: [['계산', esc(it.r[1])], ['매출', esc(it.r[2])]], status: lsf.status, estimate: true, sources: lsf.sources }) }); }
  if (ok(am)) chart('inAm', { tooltip: { trigger: 'axis', valueFormatter: v => '$' + fmtN(v) }, grid: { top: 20, left: 8, right: 20, bottom: 8, containLabel: true },
    xAxis: axisStyle({ type: 'category', data: (am.perShow || []).map(r => r[0]) }), yAxis: axisStyle({ type: 'value', name: '회당 상각($)', axisLabel: { color: mut, formatter: v => fmtUSD(v, 0) } }),
    series: [{ type: 'line', data: (am.perShow || []).map(r => r[1]), lineStyle: { type: 'dashed', width: 2, color: ACC.estimate.color }, itemStyle: { color: ACC.estimate.color }, areaStyle: { color: 'rgba(244,114,182,.12)' }, label: { show: true, color: mut, formatter: p => fmtUSD(p.value, 0) } }] });
  if (ok(yv)) { const pts = (yv.pass || []).map(r => [parseFloat(r[0]), parseFloat(r[1])]);
    chart('inYv', { tooltip: { trigger: 'axis', formatter: ps => `통과율 ${ps[0].value[0]} → 배수 ${ps[0].value[1]}× (추정)` }, grid: { top: 20, left: 8, right: 20, bottom: 24, containLabel: true },
      xAxis: axisStyle({ type: 'value', name: '30초 통과율', nameLocation: 'middle', nameGap: 22, inverse: true, min: .3, max: .9 }), yAxis: axisStyle({ type: 'value', name: '배수(×)' }),
      series: [{ type: 'line', data: pts, smooth: true, lineStyle: { type: 'dashed', width: 2, color: ACC.estimate.color }, itemStyle: { color: ACC.estimate.color }, label: { show: true, color: mut, formatter: p => p.value[1] + '×' } }] }); }
}

function merchHTML(M, ok) {
  const vis = ok(M);
  return `${card({ title: `${esc(String(M.title || '').replace(/^"|"$/g, ''))} ${badges(M.status, true)} ${srcLinks(M.sources)}`, sub: '투어별 티켓·굿즈 수익(억 원, 그로스) · 해칭 = 추정', cls: 'spanall', body: vis ? chartDiv('inMerch', 'h420') : hiddenNote('굿즈 수익 추정'), foot: esc(M.note || '') })}
    ${card({ title: '투어별 수익 추정 표', cls: 'spanall', body: vis ? simpleTable(M.columns || [], (M.rows || []).map(r => r.map((c, i) => i <= 1 ? `<b>${esc(c)}</b>` : i === 5 ? `<span class="small">${esc(c)}</span>` : i >= 6 ? `<span class="estval">${esc(c)}</span>` : esc(c)))) : '' })}
    ${M.scenarios ? card({ title: '시나리오 범위 (보수–낙관)', sub: '억 원 · 점 = 기본', body: vis ? chartDiv('inMerchSc', 'h300') : '' }) : ''}
    ${M.groups ? card({ title: '그룹 합산 (추정)', body: vis ? simpleTable(['그룹', '투어 수', '총 회차', '누적 관객', '티켓 수익', '굿즈 수익', '총 수익', '인당 총매출', '핵심 시장'], M.groups.map(r => r.map((c, i) => i === 0 ? `<b>${esc(c)}</b>` : esc(c)))) : '' }) : ''}
    ${M.prices ? card({ title: '지역별 단가 가정', body: vis ? simpleTable(['지역', '일반석', 'VIP·프리미엄', '티켓 평균', '인당 굿즈', '인당 합계', '비고'], M.prices.map(r => r.map(esc))) : '' }) : ''}
    ${M.mix ? card({ title: '투어별 지역 구성·혼합 단가', body: vis ? simpleTable(['투어', '그룹', '한국', '일본', '아시아 기타', '북미', '유럽', '혼합 단가'], M.mix.map(r => r.map(esc))) : '' }) : ''}
    ${M.cites ? card({ title: '근거 인용 (Claude 출처표)', cls: 'spanall', body: simpleTable(['항목', '수치', '출처'], M.cites.map(r => r.map(esc))) }) : ''}`;
}
function merchCharts(M) {
  const rows = (M.rows || []).filter(r => !/합계/.test(String(r[0]) + String(r[1]))).map(r => ({ tour: r[0], group: r[1], state: r[2], t: parseKNum(r[8]) / 1e8, m: parseKNum(r[10]) / 1e8, tot: r[11], basis: r[5], att: r[4], shows: r[3] }));
  const mut = themeColors().muted;
  chart('inMerch', { legend: { data: ['티켓 수익', '굿즈 수익'] }, grid: { top: 34, left: 8, right: 10, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return tipHTML({ title: `${r.group} — ${r.tour}`, rows: [['상태', esc(r.state)], ['회차', esc(r.shows)], ['관객', esc(r.att)], ['티켓 수익', fmtN(r.t) + '억'], ['굿즈 수익', fmtN(r.m) + '억'], ['총 수익', esc(r.tot)]], status: M.status, estimate: true, note: '관객 근거: ' + r.basis, sources: M.sources }); } },
    xAxis: axisStyle({ type: 'category', data: rows.map(r => r.group + '\n' + r.tour), axisLabel: { color: mut, fontSize: 10, interval: 0, width: 110, overflow: 'truncate' } }), yAxis: axisStyle({ type: 'value', name: '억 원' }),
    series: [{ name: '티켓 수익', type: 'bar', stack: 'm', barMaxWidth: 46, itemStyle: estStyle(PAL[0]), data: rows.map(r => r.t) }, { name: '굿즈 수익', type: 'bar', stack: 'm', barMaxWidth: 46, itemStyle: estStyle(PAL[1]), data: rows.map(r => r.m), label: { show: true, position: 'top', color: mut, fontSize: 10, formatter: p => rows[p.dataIndex].tot } }] });
  if (M.scenarios && $('#inMerchSc')) {
    const sc = M.scenarios.map(r => ({ l: `${r[1]} ${r[0]}`, lo: parseKNum(r[2]) / 1e8, mid: parseKNum(r[3]) / 1e8, hi: parseKNum(r[4]) / 1e8, v: r[6] }));
    chart('inMerchSc', { grid: { left: 8, right: 30, top: 10, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = sc[ps[0].dataIndex]; return tipHTML({ title: r.l, rows: [['보수', fmtN(r.lo) + '억'], ['기본', fmtN(r.mid) + '억'], ['낙관', fmtN(r.hi) + '억']], status: M.status, estimate: true, note: '주요 변수: ' + r.v }); } },
      xAxis: axisStyle({ type: 'value', name: '억', min: v => Math.floor(v.min / 100) * 100 }), yAxis: axisStyle({ type: 'category', inverse: true, data: sc.map(r => r.l), splitLine: { show: false }, axisLabel: { color: themeColors().text, fontSize: 11 } }),
      series: [{ type: 'bar', stack: 'r', silent: true, itemStyle: { color: 'transparent' }, data: sc.map(r => r.lo) }, { type: 'bar', stack: 'r', barMaxWidth: 14, itemStyle: estStyle(ACC.estimate.color, { borderRadius: 3 }), data: sc.map(r => r.hi - r.lo) },
        { type: 'scatter', symbolSize: 10, itemStyle: { color: '#fff' }, data: sc.map((r, i) => [r.mid, i]), label: { show: true, position: 'top', color: mut, fontSize: 10, formatter: p => fmtN(p.value[0]) + '억' } }] });
  }
}

const RENDER = { overview: renderOverview, boxscore: renderBoxscore, tracker: () => renderTracker(), hybe: () => renderHybe(), social: renderSocial, events: renderEvents, artists: renderArtists, auditions: renderAuditions, rpd: renderRPD, industry: renderIndustry };
