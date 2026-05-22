
let currentCompany = null;
let currentReportExtras = { finances: null, legalCases: null, enforcements: null };

function initAccessBlock() {
  const box = document.getElementById('accessBlock');
  if (SP.can('counterparty_full')) {
    box.innerHTML = `
      <h2>Введите ИНН или ОГРН</h2>
      <p class="small-muted">На тарифе PRO доступна полная проверка: карточка компании, финансы, суды, риск-оценка и история проверок.</p>
      <div class="check-form-grid">
        <div>
          <label>ИНН / ОГРН</label>
          <input id="counterpartyInput" inputmode="numeric" placeholder="Например: 7704382422">
        </div>
        <button class="submit-button" onclick="checkCounterparty()">Проверить</button>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="locked-panel">
        <div class="lock-icon">🔒</div>
        <h2>Проверка контрагентов доступна на PRO</h2>
        <p class="small-muted">Без подписки проверка закрыта. После подключения тарифа PRO отчет будет работать полностью.</p>
        <button class="submit-button" onclick="goToPage('/subscription')">Подключить PRO</button>
      </div>
    `;
  }
}

async function checkCounterparty() {
  if (!SP.requireAccess('counterparty_full', 'Проверка контрагентов доступна по тарифу PRO.')) return;

  const input = document.getElementById('counterpartyInput');
  const value = input ? input.value.trim() : '';
  if (!value) {
    alert('Введите ИНН или ОГРН');
    return;
  }

  SP.log('check_counterparty', 'counterparty', { query: value });
  document.getElementById('counterpartyResult').innerHTML = '<section class="form-card"><div class="analysis-loading">Формируем отчет по компании...</div></section>';

  try {
    const response = await fetch('/api/check-counterparty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: value })
    });
    const result = await response.json();

    if (!result.success) throw new Error(result.error || 'Не удалось получить данные');

    const company = normalizeCompany(result.data, value);
    currentCompany = company;
    renderFullReport(company);
    saveCheckHistory(company);
    renderHistory();
    loadExtraData(company.inn);
  } catch (error) {
    console.error(error);
    document.getElementById('counterpartyResult').innerHTML = `
      <section class="form-card">
        <h2>Не удалось выполнить проверку</h2>
        <p class="small-muted">Проверьте ИНН/ОГРН и попробуйте еще раз. Если ошибка повторяется — проверьте сервер и API-ключ.</p>
      </section>
    `;
  }
}

function normalizeCompany(payload, query) {
  const raw = unwrapPayload(payload);
  const name = pick(raw, ['НаимСокр', 'НаимПолн', 'name', 'shortName', 'fullName', 'Наименование']) || 'Компания';
  const inn = pick(raw, ['ИНН', 'inn']) || (String(query).match(/^\d{10,12}$/) ? query : '—');
  const ogrn = pick(raw, ['ОГРН', 'ОГРНИП', 'ogrn']) || '—';
  const status = pick(raw, ['Статус', 'status', 'СтатусЮЛ']) || '—';
  const director = pick(raw, ['Руководитель.ФИО', 'Руковод.ФИО', 'director', 'Директор', 'ФИОРук']) || getNestedName(raw['Руководитель'] || raw['Руковод']);
  const address = pick(raw, ['ЮрАдрес.АдресРФ', 'Адрес', 'address', 'ЮрАдрес']) || '—';
  const okved = pick(raw, ['ОКВЭД.Наим', 'ОКВЭД', 'okved', 'ОКВЭДОсн.Наим']) || '—';
  const regDate = pick(raw, ['ДатаРег', 'registrationDate', 'ДатаОГРН']) || '—';
  const kpp = pick(raw, ['КПП', 'kpp']) || '—';
  const capital = pick(raw, ['УстКап.Сумма', 'УстКапитал', 'capital']) || '—';

  const baseScore = buildRiskScore({ raw, status, blacklist: isBlacklisted(inn) });

  return { name, inn, ogrn, kpp, status, director, address, okved, regDate, capital, risk: baseScore.risk, score: baseScore.score, scoreReasons: baseScore.reasons, blacklist: isBlacklisted(inn), raw };
}

function unwrapPayload(payload) {
  if (!payload) return {};
  if (payload.data) return unwrapPayload(payload.data);
  if (payload.company) return payload.company;
  if (payload.ЮЛ) return payload.ЮЛ;
  if (payload.ИП) return payload.ИП;
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
  if (Array.isArray(payload['Записи']) && payload['Записи'][0]) return payload['Записи'][0];
  return payload;
}

function pick(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc && acc[key], obj);
    if (value !== undefined && value !== null && value !== '') return typeof value === 'object' ? getNestedName(value) : String(value);
  }
  return '';
}

function getNestedName(value) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  if (value['ФИО']) return value['ФИО'];
  if (value['ФИОПолн']) return value['ФИОПолн'];
  if (value['Наим']) return value['Наим'];
  if (value.name) return value.name;
  if (value.fullName) return value.fullName;
  return '—';
}

function isBlacklisted(inn) {
  return ['500000000000', '7700000000'].includes(String(inn));
}

function buildRiskScore(context) {
  const rawText = JSON.stringify(context.raw || {}).toLowerCase() + ' ' + String(context.status || '').toLowerCase();
  const reasons = [];
  let score = 100;

  const addReason = (type, title, delta, icon) => {
    score += delta;
    reasons.push({ type, title, delta, icon });
  };

  if (context.blacklist) addReason('negative', 'Компания найдена в нашем черном списке', -40, '⛔');
  else addReason('positive', 'В нашем черном списке записей нет', 0, '✅');

  if (rawText.includes('ликвид') || rawText.includes('прекращ')) addReason('negative', 'Есть признаки ликвидации или прекращения деятельности', -35, '🔴');
  else addReason('positive', 'Компания не отмечена как ликвидированная', 0, '✅');

  if (rawText.includes('банкрот')) addReason('negative', 'Есть признаки банкротства', -30, '🔴');
  else addReason('positive', 'Признаки банкротства не найдены', 0, '✅');

  if (rawText.includes('недостовер')) addReason('negative', 'Есть сведения о недостоверности', -25, '🔴');
  if (rawText.includes('дисквал')) addReason('negative', 'Есть признаки дисквалификации', -25, '🔴');
  if (rawText.includes('массов')) addReason('warning', 'Есть массовый адрес или массовый руководитель', -12, '🟡');

  const finances = context.financesSummary;
  if (finances) {
    if (finances.revenue > 0) addReason('positive', 'Есть финансовая отчетность и выручка', 0, '✅');
    else addReason('warning', 'Выручка не найдена или равна нулю', -8, '🟡');

    if (finances.profit < 0) addReason('warning', 'Компания показала убыток', -8, '🟡');
    if (finances.growth !== null && finances.growth < -30) addReason('warning', 'Сильное снижение выручки', -10, '🟡');
    else if (finances.growth !== null && finances.growth >= 0) addReason('positive', 'Выручка не снижается', 0, '✅');
  }

  const cases = context.casesSummary;
  if (cases) {
    if (cases.total >= 20) addReason('warning', 'Высокая судебная активность', -15, '🟡');
    else if (cases.total > 0) addReason('warning', 'Есть судебные дела, стоит изучить детали', -5, '🟡');
    else addReason('positive', 'Судебные дела не найдены', 0, '✅');
  }

  const enforcements = context.enforcementsSummary;
  if (enforcements) {
    if (enforcements.total > 0 || enforcements.sum > 0) addReason('negative', 'Есть исполнительные производства ФССП', -25, '🔴');
    else addReason('positive', 'Исполнительные производства не найдены', 0, '✅');
  }

  score = Math.max(0, Math.min(100, score));
  const risk = score < 50 ? 'Высокий' : score < 75 ? 'Средний' : 'Низкий';
  return { score, risk, reasons };
}

function riskClass(company) {
  if (company.risk === 'Высокий') return 'bad';
  if (company.risk === 'Средний') return 'warn';
  return '';
}

function renderFullReport(company) {
  document.getElementById('counterpartyResult').innerHTML = `
    <section class="form-card">
      <h2>${escapeHtml(company.name)}</h2>
      <div class="risk-score">
        <div id="riskCircle" class="risk-circle ${riskClass(company)}">${company.score}</div>
        <div>
          <div id="riskStatus" class="status-pill ${company.risk === 'Высокий' ? 'bad' : company.risk === 'Низкий' ? 'ok' : 'warn'}">Риск: ${escapeHtml(company.risk)}</div>
          <p class="small-muted">Итоговая оценка строится по статусу компании, признакам риска, черному списку, финансам, судам и ФССП.</p>
        </div>
      </div>
      <div class="score-panel" id="scorePanel"></div>
      <div class="dashboard-grid" id="reportDashboard">
        <div class="dashboard-card"><span>Финансы</span><b>загрузка...</b></div>
        <div class="dashboard-card"><span>Суды</span><b>загрузка...</b></div>
        <div class="dashboard-card"><span>ФССП</span><b>загрузка...</b></div>
        <div class="dashboard-card"><span>Итоговый риск</span><b>${escapeHtml(company.risk)}</b></div>
      </div>
      ${company.blacklist ? '<div class="blacklist-alert">⚠️ Найдена запись в нашем черном списке.</div>' : '<div class="blacklist-ok">✅ В нашем черном списке записей по этому ИНН не найдено.</div>'}

      <div class="report-grid">
        <div class="report-card full">
          <h3>Основная информация</h3>
          <div class="result-grid">
            <div class="result-cell"><span>ИНН</span><b>${escapeHtml(company.inn)}</b></div>
            <div class="result-cell"><span>ОГРН</span><b>${escapeHtml(company.ogrn)}</b></div>
            <div class="result-cell"><span>КПП</span><b>${escapeHtml(company.kpp)}</b></div>
            <div class="result-cell"><span>Статус</span><b>${escapeHtml(company.status)}</b></div>
            <div class="result-cell"><span>Дата регистрации</span><b>${escapeHtml(company.regDate)}</b></div>
            <div class="result-cell"><span>Уставный капитал</span><b>${escapeHtml(String(company.capital))}</b></div>
            <div class="result-cell"><span>Руководитель</span><b>${escapeHtml(company.director)}</b></div>
            <div class="result-cell"><span>ОКВЭД</span><b>${escapeHtml(company.okved)}</b></div>
            <div class="result-cell"><span>Адрес</span><b>${escapeHtml(company.address)}</b></div>
          </div>
        </div>
        <div class="report-card full">
          <h3>Финансы</h3>
          <div id="financesBox" class="analysis-loading">Загружаем финансы...</div>
        </div>
        <div class="report-card full">
          <h3>Суды</h3>
          <div id="legalCasesBox" class="analysis-loading">Загружаем судебные дела...</div>
        </div>
        <div class="report-card full">
          <h3>ФССП</h3>
          <div id="enforcementsBox" class="analysis-loading">Проверяем исполнительные производства...</div>
        </div>
        <div class="report-card full">
          <h3>Риски</h3>
          <div id="riskBadgesBox" class="risk-badges"></div>
        </div>
        <div class="report-card full">
          <h3>Вывод</h3>
          <div id="reportConclusion">${makeConclusion(company)}</div>
        </div>
      </div>
    </section>
  `;
  currentReportExtras = { finances: null, legalCases: null, enforcements: null };
  updateRiskAnalysis();
}

function makeConclusion(company) {
  if (company.blacklist || company.risk === 'Высокий') {
    return '<div class="blacklist-alert">Рекомендуется дополнительная проверка документов, договора, полномочий подписанта и истории оплат перед началом работы.</div>';
  }
  if (company.risk === 'Средний') {
    return '<div class="analysis-empty">Есть признаки, которые стоит изучить подробнее перед сделкой.</div>';
  }
  return '<div class="blacklist-ok">Критичных признаков риска на базовом уровне не найдено.</div>';
}

async function loadExtraData(inn) {
  await Promise.allSettled([loadFinances(inn), loadLegalCases(inn), loadEnforcements(inn)]);
}

async function loadFinances(inn) {
  try {
    const response = await fetch('/api/check-counterparty/finances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn }) });
    const result = await response.json();
    currentReportExtras.finances = result.success ? result.data : null;
    renderFinances(currentReportExtras.finances);
    updateRiskAnalysis();
  } catch (e) {
    console.error(e);
    currentReportExtras.finances = null;
    renderFinances(null);
    updateRiskAnalysis();
  }
}

async function loadLegalCases(inn) {
  try {
    const response = await fetch('/api/check-counterparty/legal-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn }) });
    const result = await response.json();
    currentReportExtras.legalCases = result.success ? result.data : null;
    renderLegalCases(currentReportExtras.legalCases);
    updateRiskAnalysis();
  } catch (e) {
    console.error(e);
    currentReportExtras.legalCases = null;
    renderLegalCases(null);
    updateRiskAnalysis();
  }
}

async function loadEnforcements(inn) {
  try {
    const response = await fetch('/api/check-counterparty/enforcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn }) });
    const result = await response.json();
    currentReportExtras.enforcements = result.success ? result.data : null;
    renderEnforcements(currentReportExtras.enforcements);
    updateRiskAnalysis();
  } catch (e) {
    console.error(e);
    currentReportExtras.enforcements = null;
    renderEnforcements(null);
    updateRiskAnalysis();
  }
}


function summarizeFinances(payload) {
  const data = unwrapFinance(payload);
  const years = Object.keys(data || {}).filter(y => /^\d{4}$/.test(y)).sort();
  if (!years.length) return null;
  const latestYear = years[years.length - 1];
  const latest = data[latestYear] || {};
  const prev = years.length > 1 ? data[years[years.length - 2]] || {} : {};
  const revenue = num(latest['2110'] || latest.revenue || latest['Выручка']);
  const profit = num(latest['2400'] || latest.profit || latest['Прибыль']);
  const prevRevenue = num(prev['2110'] || prev.revenue || prev['Выручка']);
  const growth = prevRevenue ? Math.round(((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100) : null;
  return { year: latestYear, revenue, profit, growth };
}

function summarizeLegalCases(payload) {
  const data = payload && payload.data ? payload.data : payload;
  const records = Array.isArray(data) ? data : (data && (data['Записи'] || data.records || data.items || data.cases)) || [];
  const total = data && (data['ЗапВсего'] || data.total || records.length) || records.length;
  const sum = records.reduce((acc, item) => acc + num(item['Сумма'] || item.price || item.amount), 0);
  return { total: Number(total) || 0, sum, records };
}

function summarizeEnforcements(payload) {
  const data = payload && payload.data ? payload.data : payload;
  const records = Array.isArray(data) ? data : (data && (data['Записи'] || data.records || data.items || data.enforcements)) || [];
  const total = data && (data['ЗапВсего'] || data.total || records.length) || records.length;
  const sum = records.reduce((acc, item) => acc + num(item['Сумма'] || item.amount || item['Остаток'] || item.debt), 0);
  return { total: Number(total) || 0, sum, records };
}

function updateRiskAnalysis() {
  if (!currentCompany) return;
  const financesSummary = summarizeFinances(currentReportExtras.finances);
  const casesSummary = summarizeLegalCases(currentReportExtras.legalCases);
  const enforcementsSummary = summarizeEnforcements(currentReportExtras.enforcements);
  const scoreData = buildRiskScore({
    raw: currentCompany.raw,
    status: currentCompany.status,
    blacklist: currentCompany.blacklist,
    financesSummary,
    casesSummary,
    enforcementsSummary
  });
  currentCompany.score = scoreData.score;
  currentCompany.risk = scoreData.risk;
  currentCompany.scoreReasons = scoreData.reasons;

  const circle = document.getElementById('riskCircle');
  const status = document.getElementById('riskStatus');
  const panel = document.getElementById('scorePanel');
  const conclusion = document.getElementById('reportConclusion');
  const badges = document.getElementById('riskBadgesBox');
  const dash = document.getElementById('reportDashboard');
  if (circle) {
    circle.textContent = currentCompany.score;
    circle.className = 'risk-circle ' + riskClass(currentCompany);
  }
  if (status) {
    status.textContent = 'Риск: ' + currentCompany.risk;
    status.className = 'status-pill ' + (currentCompany.risk === 'Высокий' ? 'bad' : currentCompany.risk === 'Низкий' ? 'ok' : 'warn');
  }
  if (panel) {
    const fillClass = currentCompany.risk === 'Высокий' ? 'bad' : currentCompany.risk === 'Средний' ? 'warn' : '';
    panel.innerHTML = `
      <div class="score-head"><span>Риск-рейтинг</span><b>${currentCompany.score}/100</b></div>
      <div class="score-bar"><div class="score-fill ${fillClass}" style="width:${currentCompany.score}%"></div></div>
      <div class="score-reasons">${currentCompany.scoreReasons.slice(0, 7).map(r => `<div class="reason-row ${r.type}"><span>${r.icon}</span><b>${escapeHtml(r.title)}</b><span>${r.delta ? r.delta : '0'}</span></div>`).join('')}</div>
    `;
  }
  if (badges) badges.innerHTML = renderRiskBadges(financesSummary, casesSummary, enforcementsSummary);
  if (dash) {
    dash.innerHTML = `
      <div class="dashboard-card"><span>Выручка</span><b>${financesSummary ? formatMoney(financesSummary.revenue) : '—'}</b></div>
      <div class="dashboard-card"><span>Суды</span><b>${casesSummary ? casesSummary.total : '—'}</b></div>
      <div class="dashboard-card"><span>ФССП</span><b>${enforcementsSummary ? enforcementsSummary.total : '—'}</b></div>
      <div class="dashboard-card"><span>Итоговый риск</span><b>${escapeHtml(currentCompany.risk)}</b></div>
    `;
  }
  if (conclusion) conclusion.innerHTML = makeConclusion(currentCompany);
}

function renderRiskBadges(finances, cases, enforcements) {
  const baseText = JSON.stringify(currentCompany.raw || {}).toLowerCase() + ' ' + String(currentCompany.status || '').toLowerCase();
  const items = [
    { title: 'Банкротство', value: baseText.includes('банкрот') ? 'Есть признаки' : 'Не найдено', state: baseText.includes('банкрот') ? 'bad' : 'ok' },
    { title: 'Ликвидация', value: baseText.includes('ликвид') || baseText.includes('прекращ') ? 'Есть признаки' : 'Не найдено', state: baseText.includes('ликвид') || baseText.includes('прекращ') ? 'bad' : 'ok' },
    { title: 'Недостоверность', value: baseText.includes('недостовер') ? 'Есть сведения' : 'Не найдено', state: baseText.includes('недостовер') ? 'bad' : 'ok' },
    { title: 'Массовость', value: baseText.includes('массов') ? 'Есть признак' : 'Не найдено', state: baseText.includes('массов') ? 'warn' : 'ok' },
    { title: 'Суды', value: cases ? `${cases.total} дел` : 'Загрузка', state: cases && cases.total >= 20 ? 'warn' : 'ok' },
    { title: 'ФССП', value: enforcements ? `${enforcements.total} производств` : 'Загрузка', state: enforcements && enforcements.total > 0 ? 'bad' : 'ok' },
    { title: 'Финансы', value: finances ? formatMoney(finances.revenue) : 'Загрузка', state: finances && finances.profit < 0 ? 'warn' : 'ok' },
    { title: 'Черный список', value: currentCompany.blacklist ? 'Есть запись' : 'Не найдено', state: currentCompany.blacklist ? 'bad' : 'ok' }
  ];
  return items.map(item => `<div class="risk-badge ${item.state}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.value)}</span></div>`).join('');
}

function renderFinances(payload) {
  const box = document.getElementById('financesBox');
  if (!box) return;
  const data = unwrapFinance(payload);
  const years = Object.keys(data || {}).filter(y => /^\d{4}$/.test(y)).sort();
  if (!years.length) {
    box.innerHTML = '<div class="analysis-empty">Финансовая отчетность не найдена.</div>';
    return;
  }
  const latestYear = years[years.length - 1];
  const latest = data[latestYear] || {};
  const prev = years.length > 1 ? data[years[years.length - 2]] || {} : {};
  const revenue = num(latest['2110'] || latest.revenue || latest['Выручка']);
  const profit = num(latest['2400'] || latest.profit || latest['Прибыль']);
  const assets = num(latest['1600'] || latest.assets || latest['Активы']);
  const debt = num(latest['1520'] || latest.debt || latest['Кредиторка']);
  const prevRevenue = num(prev['2110'] || prev.revenue || prev['Выручка']);
  const growth = prevRevenue ? Math.round(((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100) : null;
  box.innerHTML = `
    <div class="metric-row"><span>Год отчетности</span><b>${latestYear}</b></div>
    <div class="metric-row"><span>Выручка</span><b>${formatMoney(revenue)}</b></div>
    <div class="metric-row"><span>Прибыль / убыток</span><b>${formatMoney(profit)}</b></div>
    <div class="metric-row"><span>Активы</span><b>${formatMoney(assets)}</b></div>
    <div class="metric-row"><span>Кредиторская задолженность</span><b>${formatMoney(debt)}</b></div>
    <div class="metric-row"><span>Динамика выручки</span><b>${growth === null ? '—' : growth + '%'}</b></div>
    <div class="table-scroll"><table class="finance-table"><thead><tr><th>Год</th><th>Выручка</th><th>Прибыль</th></tr></thead><tbody>${years.slice(-4).reverse().map(y => `<tr><td>${y}</td><td>${formatMoney(num(data[y]['2110'] || data[y].revenue || data[y]['Выручка']))}</td><td>${formatMoney(num(data[y]['2400'] || data[y].profit || data[y]['Прибыль']))}</td></tr>`).join('')}</tbody></table></div>
  `;
}

function unwrapFinance(payload) {
  if (!payload) return null;
  if (payload.data) return unwrapFinance(payload.data);
  if (payload['Финансы']) return payload['Финансы'];
  if (payload.finance) return payload.finance;
  return payload;
}


function renderEnforcements(payload) {
  const box = document.getElementById('enforcementsBox');
  if (!box) return;
  const summary = summarizeEnforcements(payload);
  if (!summary || !summary.records.length) {
    box.innerHTML = `<div class="metric-row"><span>Всего производств</span><b>${summary ? summary.total : 0}</b></div><div class="analysis-empty">Исполнительные производства не найдены.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="metric-row"><span>Всего производств</span><b>${summary.total}</b></div>
    <div class="metric-row"><span>Сумма по видимым производствам</span><b>${formatMoney(summary.sum)}</b></div>
    <div class="table-scroll"><table class="cases-table"><thead><tr><th>Дата</th><th>Производство</th><th>Сумма / статус</th></tr></thead><tbody>${summary.records.slice(0, 5).map(item => {
      const number = item['Номер'] || item.number || item['ИспПроизв'] || '—';
      const date = item['Дата'] || item.date || item['ДатаВозбужд'] || '—';
      const amount = item['Сумма'] || item.amount || item['Остаток'] || item.debt || 0;
      const status = item['Статус'] || item.status || item['ПредметИсполнения'] || '—';
      return `<tr><td>${escapeHtml(date)}</td><td>${escapeHtml(number)}</td><td>${formatMoney(amount)}<br><b>${escapeHtml(status)}</b></td></tr>`;
    }).join('')}</tbody></table></div>
  `;
}

function renderLegalCases(payload) {
  const box = document.getElementById('legalCasesBox');
  if (!box) return;
  const data = payload && payload.data ? payload.data : payload;
  const records = Array.isArray(data) ? data : (data && (data['Записи'] || data.records || data.items || data.cases)) || [];
  const total = data && (data['ЗапВсего'] || data.total || records.length) || records.length;
  if (!records.length) {
    box.innerHTML = `<div class="metric-row"><span>Всего дел</span><b>${total || 0}</b></div><div class="analysis-empty">Последние судебные дела не найдены.</div>`;
    return;
  }
  const sum = records.reduce((acc, item) => acc + num(item['Сумма'] || item.price || item.amount), 0);
  box.innerHTML = `
    <div class="metric-row"><span>Всего дел</span><b>${total}</b></div>
    <div class="metric-row"><span>Сумма по видимым делам</span><b>${formatMoney(sum)}</b></div>
    <div class="table-scroll"><table class="cases-table"><thead><tr><th>Дата</th><th>Дело</th><th>Роль / сумма</th></tr></thead><tbody>${records.slice(0, 5).map(item => {
      const number = item['Номер'] || item['№'] || item.case_number || item.number || '—';
      const date = item['Дата'] || item.date || item['ДатаРег'] || '—';
      const role = item['Роль'] || item.role || detectCaseRole(item);
      const amount = item['Сумма'] || item.price || item.amount || 0;
      const url = item['URL'] || item.url || item['Ссылка'] || '';
      const title = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(number)}</a>` : escapeHtml(number);
      return `<tr><td>${escapeHtml(date)}</td><td>${title}</td><td>${escapeHtml(role)}<br><b>${formatMoney(amount)}</b></td></tr>`;
    }).join('')}</tbody></table></div>
  `;
}

function detectCaseRole(item) {
  const text = JSON.stringify(item || {}).toLowerCase();
  if (text.includes('ответ')) return 'Ответчик';
  if (text.includes('истец')) return 'Истец';
  return 'Участник';
}

function num(value) {
  const n = Number(String(value || 0).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  const n = num(value);
  if (!n) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
}

function saveCheckHistory(company) {
  const key = 'sp_counterparty_history';
  const old = JSON.parse(localStorage.getItem(key) || '[]');
  old.unshift({ inn: company.inn, name: company.name, risk: company.risk, blacklist: company.blacklist, time: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(old.slice(0, 10)));
}

function renderHistory() {
  const key = 'sp_counterparty_history';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  const box = document.getElementById('checkHistory');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<p class="small-muted">Пока проверок нет.</p>';
    return;
  }
  box.innerHTML = list.map(item => `<div class="soft-card"><b>${escapeHtml(item.name)}</b><p class="small-muted">ИНН: ${escapeHtml(item.inn)} · Риск: ${escapeHtml(item.risk)} · ${new Date(item.time).toLocaleString('ru-RU')}</p>${item.blacklist ? '<span class="status-pill bad">Есть в черном списке</span>' : '<span class="status-pill ok">Не найдено в черном списке</span>'}</div>`).join('');
}

initAccessBlock();
renderHistory();
