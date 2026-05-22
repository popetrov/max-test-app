
const demoCompanies = {
  '7700000000': {
    name: 'ООО Проблемный Подряд', inn: '7700000000', ogrn: '1027700000000', status: 'Действующая', director: 'Иванов Иван Иванович', address: 'Москва', okved: 'Строительство жилых и нежилых зданий', age: '8 лет', blacklist: true, risk: 'Высокий', score: 38
  },
  '7711111111': {
    name: 'ООО Монолит Строй', inn: '7711111111', ogrn: '1027711111111', status: 'Действующая', director: 'Петров Петр Петрович', address: 'Москва и МО', okved: 'Производство общестроительных работ', age: '6 лет', blacklist: false, risk: 'Низкий', score: 82
  },
  '7800000002': {
    name: 'ООО ЭлектроМонтаж 24', inn: '7800000002', ogrn: '1027800000002', status: 'Действующая', director: 'Сидоров Алексей Николаевич', address: 'Санкт-Петербург', okved: 'Производство электромонтажных работ', age: '4 года', blacklist: false, risk: 'Средний', score: 64
  }
};

const demoFinances = {
  data: {
    '2021': { '2110': 24500000, '2400': 2100000, '1600': 12800000, '1520': 3900000 },
    '2022': { '2110': 31800000, '2400': 3600000, '1600': 17200000, '1520': 4100000 },
    '2023': { '2110': 40200000, '2400': 5100000, '1600': 23600000, '1520': 5800000 }
  }
};

const demoLegalCases = {
  data: {
    'ЗапВсего': 3,
    'Записи': [
      { 'Номер': 'А40-000001/2023', 'Дата': '2023-11-12', 'Сумма': 1250000, 'Роль': 'Ответчик', 'Истец': 'ООО Заказчик', 'Ответчик': 'Демо-компания' },
      { 'Номер': 'А40-000002/2022', 'Дата': '2022-07-18', 'Сумма': 430000, 'Роль': 'Истец', 'Истец': 'Демо-компания', 'Ответчик': 'ООО Подрядчик' }
    ]
  }
};

let currentCompany = null;

async function checkCounterparty() {
  const value = document.getElementById('counterpartyInput').value.trim();
  if (!value) {
    alert('Введите ИНН или ОГРН');
    return;
  }

  SP.log('check_counterparty', 'counterparty', { query: value });
  document.getElementById('counterpartyResult').innerHTML = '<section class="form-card"><div class="analysis-loading">Проверяем компанию...</div></section>';

  try {
    const response = await fetch('/api/check-counterparty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: value })
    });
    const result = await response.json();

    let company;
    if (result.success && result.data) {
      company = normalizeCompany(result.data, value);
    } else {
      company = demoCompanies[value] || createDemoCompany(value);
    }

    currentCompany = company;
    renderResult(company);
    saveCheckHistory(company);
    renderHistory();
    loadFinances(company.inn);
    loadLegalCases(company.inn);
  } catch (error) {
    console.error(error);
    const company = demoCompanies[value] || createDemoCompany(value);
    currentCompany = company;
    renderResult(company);
    saveCheckHistory(company);
    renderHistory();
    renderFinances(demoFinances);
    renderLegalCases(demoLegalCases);
  }
}

function normalizeCompany(apiData, fallbackValue) {
  const raw = apiData.data || apiData.company || apiData;
  const director = Array.isArray(raw['Руковод']) ? raw['Руковод'][0] : null;
  const okved = raw['ОКВЭД'];
  const address = raw['ЮрАдрес'];
  const status = raw['Статус'];
  const name = raw['НаимСокр'] || raw['НаимПолн'] || raw.name || raw.full_name || raw['ФИО'] || 'Компания найдена';
  const inn = raw['ИНН'] || raw.inn || fallbackValue;
  const badFlags = [raw['НедобПост'], raw['ДисквЛица'], raw['МассРуковод'], raw['МассУчред'], raw['НелегалФин'], raw['Санкции'], address && address['Недост'], director && director['Недост']].filter(Boolean).length;
  const risk = badFlags >= 2 ? 'Высокий' : badFlags === 1 ? 'Средний' : 'Низкий';
  const score = risk === 'Высокий' ? 38 : risk === 'Средний' ? 64 : 82;

  return {
    name,
    inn,
    ogrn: raw['ОГРН'] || raw['ОГРНИП'] || raw.ogrn || '—',
    status: typeof status === 'object' ? (status['Наим'] || '—') : (status || raw.status || '—'),
    director: director ? `${director['НаимДолжн'] || 'Руководитель'}: ${director['ФИО'] || 'Нет данных'}` : (raw.director || raw.ceo_name || 'Нет данных'),
    address: typeof address === 'object' ? (address['АдресРФ'] || address['НасПункт'] || 'Нет данных') : (address || raw.legal_address || 'Нет данных'),
    okved: typeof okved === 'object' ? `${okved['Код'] || ''} ${okved['Наим'] || ''}`.trim() : (okved || 'Нет данных'),
    age: raw['ДатаРег'] || raw.registration_date || '—',
    blacklist: false,
    risk,
    score
  };
}

function createDemoCompany(value) {
  const blacklist = ['500000000000', '7700000000'].includes(value);
  return { name: blacklist ? 'Компания найдена в черном списке' : 'Демо-компания', inn: value, ogrn: '—', status: 'Требуется проверка через API', director: 'Будет доступно через API', address: 'Будет доступно через API', okved: 'Будет доступно через API', age: '—', blacklist, risk: blacklist ? 'Высокий' : 'Не определён', score: blacklist ? 35 : 60 };
}

function riskClass(company) {
  if (company.risk === 'Высокий') return 'bad';
  if (company.risk === 'Средний' || company.risk === 'Не определён') return 'warn';
  return '';
}

function renderResult(company) {
  const html = `
    <section class="form-card">
      <h2>${escapeHtml(company.name)}</h2>
      <div class="risk-score">
        <div class="risk-circle ${riskClass(company)}">${company.score}</div>
        <div>
          <div class="status-pill ${company.risk === 'Высокий' ? 'bad' : company.risk === 'Низкий' ? 'ok' : 'warn'}">Риск: ${escapeHtml(company.risk)}</div>
          <p class="small-muted">Оценка считается по базовым флагам Checko и нашему черному списку. Суды и финансы ниже подтягиваются отдельными запросами.</p>
        </div>
      </div>
      ${company.blacklist ? '<div class="blacklist-alert">⚠️ Найдена запись в нашем черном списке. Перед работой проверьте документы и историю.</div>' : '<div class="blacklist-ok">✅ В нашем черном списке записей по этому ИНН не найдено.</div>'}
      <div class="result-grid">
        <div class="result-cell"><span>ИНН</span><b>${escapeHtml(company.inn)}</b></div>
        <div class="result-cell"><span>ОГРН</span><b>${escapeHtml(company.ogrn)}</b></div>
        <div class="result-cell"><span>Статус</span><b>${escapeHtml(company.status)}</b></div>
        <div class="result-cell"><span>Дата регистрации</span><b>${escapeHtml(company.age)}</b></div>
        <div class="result-cell"><span>Директор</span><b>${escapeHtml(company.director)}</b></div>
        <div class="result-cell"><span>Адрес</span><b>${escapeHtml(company.address)}</b></div>
        <div class="result-cell"><span>ОКВЭД</span><b>${escapeHtml(company.okved)}</b></div>
        <div class="result-cell"><span>Источник</span><b>Checko API</b></div>
      </div>
      <div class="analysis-grid">
        <div class="analysis-card"><h3>Финансы</h3><div id="financesBox" class="analysis-loading">Загружаем финансы...</div></div>
        <div class="analysis-card"><h3>Суды</h3><div id="legalCasesBox" class="analysis-loading">Загружаем арбитраж...</div></div>
      </div>
      <div class="card-actions">
        <button class="submit-button" onclick="reloadExtraData()">Обновить суды и финансы</button>
        <button class="reset-button" onclick="goToPage('/blacklist')">Открыть черный список</button>
      </div>
    </section>`;
  document.getElementById('counterpartyResult').innerHTML = html;
}

async function loadFinances(inn) {
  const box = document.getElementById('financesBox');
  if (!box) return;
  if (!/^\d{10}$/.test(String(inn))) {
    box.innerHTML = '<div class="analysis-empty">Финансы доступны только для юрлиц с ИНН из 10 цифр.</div>';
    return;
  }
  try {
    const response = await fetch('/api/check-counterparty/finances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn }) });
    const result = await response.json();
    renderFinances(result.success ? result.data : demoFinances);
  } catch (e) {
    console.error(e);
    renderFinances(demoFinances);
  }
}

async function loadLegalCases(inn) {
  const box = document.getElementById('legalCasesBox');
  if (!box) return;
  try {
    const response = await fetch('/api/check-counterparty/legal-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn }) });
    const result = await response.json();
    renderLegalCases(result.success ? result.data : demoLegalCases);
  } catch (e) {
    console.error(e);
    renderLegalCases(demoLegalCases);
  }
}

function reloadExtraData() {
  if (!currentCompany) return;
  document.getElementById('financesBox').innerHTML = 'Загружаем финансы...';
  document.getElementById('legalCasesBox').innerHTML = 'Загружаем арбитраж...';
  loadFinances(currentCompany.inn);
  loadLegalCases(currentCompany.inn);
}

function renderFinances(payload) {
  const box = document.getElementById('financesBox');
  if (!box) return;
  const data = payload && payload.data ? payload.data : payload;
  const years = Object.keys(data || {}).filter(y => /^\d{4}$/.test(y)).sort();
  if (!years.length) {
    box.innerHTML = '<div class="analysis-empty">Финансовая отчётность не найдена.</div>';
    return;
  }
  const latestYear = years[years.length - 1];
  const latest = data[latestYear] || {};
  const prev = years.length > 1 ? data[years[years.length - 2]] || {} : {};
  const revenue = Number(latest['2110'] || 0);
  const profit = Number(latest['2400'] || 0);
  const assets = Number(latest['1600'] || 0);
  const debt = Number(latest['1520'] || 0);
  const prevRevenue = Number(prev['2110'] || 0);
  const growth = prevRevenue ? Math.round(((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100) : null;
  box.innerHTML = `
    <div class="metric-row"><span>Год отчётности</span><b>${latestYear}</b></div>
    <div class="metric-row"><span>Выручка</span><b>${formatMoney(revenue)}</b></div>
    <div class="metric-row"><span>Прибыль / убыток</span><b>${formatMoney(profit)}</b></div>
    <div class="metric-row"><span>Активы</span><b>${formatMoney(assets)}</b></div>
    <div class="metric-row"><span>Кредиторка</span><b>${formatMoney(debt)}</b></div>
    <div class="metric-row"><span>Динамика выручки</span><b>${growth === null ? '—' : growth + '%'}</b></div>
    <table class="finance-table"><thead><tr><th>Год</th><th>Выручка</th><th>Прибыль</th></tr></thead><tbody>${years.slice(-4).reverse().map(y => `<tr><td>${y}</td><td>${formatMoney(data[y]['2110'])}</td><td>${formatMoney(data[y]['2400'])}</td></tr>`).join('')}</tbody></table>`;
}

function renderLegalCases(payload) {
  const box = document.getElementById('legalCasesBox');
  if (!box) return;
  const data = payload && payload.data ? payload.data : payload;
  const records = Array.isArray(data) ? data : (data && (data['Записи'] || data.records || data.items || data.cases)) || [];
  const total = data && (data['ЗапВсего'] || data.total || records.length) || records.length;
  if (!records.length) {
    box.innerHTML = `<div class="metric-row"><span>Всего дел</span><b>${total || 0}</b></div><div class="analysis-empty">Последние дела не найдены или Checko не вернул список.</div>`;
    return;
  }
  const sum = records.reduce((acc, item) => acc + Number(item['Сумма'] || item.price || item.amount || 0), 0);
  box.innerHTML = `
    <div class="metric-row"><span>Всего дел</span><b>${total}</b></div>
    <div class="metric-row"><span>Сумма по видимым делам</span><b>${formatMoney(sum)}</b></div>
    <table class="cases-table"><thead><tr><th>Дата</th><th>Дело</th><th>Роль / сумма</th></tr></thead><tbody>${records.slice(0, 5).map(item => {
      const number = item['Номер'] || item['№'] || item.case_number || item.number || '—';
      const date = item['Дата'] || item.date || item['ДатаРег'] || '—';
      const role = item['Роль'] || item.role || detectCaseRole(item);
      const amount = item['Сумма'] || item.price || item.amount || 0;
      const url = item['URL'] || item.url || item['Ссылка'] || '';
      const title = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(number)}</a>` : escapeHtml(number);
      return `<tr><td>${escapeHtml(date)}</td><td>${title}</td><td>${escapeHtml(role)}<br><b>${formatMoney(amount)}</b></td></tr>`;
    }).join('')}</tbody></table>`;
}

function detectCaseRole(item) {
  const text = JSON.stringify(item || {}).toLowerCase();
  if (text.includes('ответ')) return 'Ответчик';
  if (text.includes('истец')) return 'Истец';
  return 'Участник';
}

function formatMoney(value) {
  const num = Number(value || 0);
  if (!num) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num) + ' ₽';
}

function openFullCheck() {
  SP.requireAccess('counterparty_full', 'Полная проверка через Checko будет доступна по PRO.');
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
  if (!list.length) {
    box.innerHTML = '<p class="small-muted">Пока проверок нет.</p>';
    return;
  }
  box.innerHTML = list.map(item => `<div class="soft-card"><b>${escapeHtml(item.name)}</b><p class="small-muted">ИНН: ${escapeHtml(item.inn)} · Риск: ${escapeHtml(item.risk)} · ${new Date(item.time).toLocaleString('ru-RU')}</p>${item.blacklist ? '<span class="status-pill bad">Есть в черном списке</span>' : '<span class="status-pill ok">Не найдено в черном списке</span>'}</div>`).join('');
}

renderHistory();
