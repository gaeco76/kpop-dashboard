/* ===== 앱 초기화 ===== */
let CUR = (location.hash || '#overview').slice(1);
const RENDERED = new Set();
function renderTab(t, force) {
  if (!RENDER[t]) t = 'overview';
  if (force || !RENDERED.has(t)) {
    try { RENDER[t](); RENDERED.add(t); }
    catch (e) { console.error(e); $('#tab-' + t).innerHTML = `<div class="error">렌더링 오류: ${esc(e.message)}</div>`; }
  }
  requestAnimationFrame(resizeVisible);
}
function showTab(t) {
  if (!RENDER[t]) t = 'overview';
  CUR = t;
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t));
  if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
  renderTab(t);
}
function drawAccChips() {
  const cnt = accCounts();
  $('#accChips').innerHTML = ACC_KEYS.map(k => `<span class="chip ${S.acc.has(k) ? 'on' : ''}" data-k="${k}" title="${k === 'estimate' ? '추정치·전망(forecast)·estimate:true 행, 산업 모델 전체' : ''}"><i style="background:${ACC[k].color}"></i>${ACC[k].label}<span class="cnt">${cnt[k] || 0}</span></span>`).join('');
}
function onAccChange() { drawAccChips(); RENDERED.clear(); renderTab(CUR, true); }
function toggleAcc(k) { S.acc.has(k) ? S.acc.delete(k) : S.acc.add(k); onAccChange(); }

async function init() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
  $('#accChips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) toggleAcc(c.dataset.k); });
  $('#accAll').onclick = () => { S.acc = new Set(ACC_KEYS); onAccChange(); };
  $('#accVerified').onclick = () => { S.acc = new Set(['verified']); onAccChange(); };
  const savedTheme = localStorage.getItem('kpd-theme'); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  $('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('kpd-theme', t); RENDERED.clear(); renderTab(CUR, true); };

  if (!window.echarts) { $('#loading').innerHTML = '<div class="error">차트 라이브러리(ECharts)를 불러오지 못했습니다.</div>'; return; }
  const info = await loadAll();
  $('#loading').remove();
  const REQ = DATA_FILES.filter(f => !OPTIONAL_FILES.includes(f));
  const failed = REQ.filter(f => !info[f]); const optFailed = OPTIONAL_FILES.filter(f => !info[f]);
  const live = REQ.filter(f => info[f] === DATA_BASE).length;
  const usedBases = [...new Set(Object.values(info).filter(Boolean))];
  $('#srcState').innerHTML = (live === REQ.length ? `<span class="dot" style="background:#22c55e"></span>라이브 데이터` : live ? `<span class="dot" style="background:#f59e0b"></span>라이브 ${live}/${REQ.length} · 일부 폴백` : usedBases.length ? (usedBases.includes('embedded') ? `<span class="dot" style="background:#f59e0b"></span>내장 스냅샷(오프라인)` : usedBases.every(x => x === './data/') ? `<span class="dot" style="background:#f59e0b"></span>동봉 스냅샷 데이터(라이브 실패)` : `<span class="dot" style="background:#f59e0b"></span>로컬 폴백 데이터`) : `<span class="dot" style="background:#ef4444"></span>데이터 로드 실패`) + (failed.length ? ` · 실패: ${failed.join(', ')}` : '') + (optFailed.length ? ` · <span title="선택 파일 — 해당 탭만 안내 표시">선택 파일 미로드: ${optFailed.join(', ')}</span>` : '');
  $('#srcState').title = usedBases.join('\n');
  $('#footSrc').textContent = '불러온 위치: ' + usedBases.join(' , ');
  if (!D.meta && !D.tours) { $('#main').insertAdjacentHTML('afterbegin', `<div class="error">데이터를 불러오지 못했습니다. config.js의 DATA_BASE 또는 ?data= 파라미터를 확인하세요. (file:// 로 열면 fetch가 차단됩니다 — 정적 서버로 여세요)</div>`); return; }
  const lu = D.meta?.lastUpdated;
  $('#asOf').textContent = lu ? lu.replace('T', ' ').slice(0, 16) + ' KST' : (D.tours?.asOf || '—');
  $('#asOf').title = '파일별 asOf — ' + ['tours', 'tracker', 'social'].map(f => `${f}: ${D[f]?.asOf || '—'}`).join(', ');
  drawAccChips();
  showTab(CUR);
}
init();
