
// === HUMAN ADMIN LOGS FIX ===
(function(){
  function safeJson(value, fallback){
    try {
      if(typeof value === 'string') return JSON.parse(value);
      return value || fallback;
    } catch(e) {
      return fallback;
    }
  }

  function getLogs(){
    const raw = safeJson(localStorage.getItem('sp_activity_logs'), []);
    if(!Array.isArray(raw)) return [];
    return raw;
  }

  function saveLogs(list){
    localStorage.setItem('sp_activity_logs', JSON.stringify(list));
  }

  function seedLogsIfEmpty(){
    if(getLogs().length) return;
    saveLogs([
      {id:1, action:'register_user', section:'auth', user:'Иван', createdAt:new Date().toISOString(), data:{role:'user', plan:'free'}},
      {id:2, action:'search', section:'blacklist', user:'Гость', createdAt:new Date().toISOString(), data:{q:'7700000000', type:'ИНН'}},
      {id:3, action:'moderation_sent', section:'services', user:'Платон', createdAt:new Date().toISOString(), data:{title:'ООО Монолит', status:'На проверке'}},
      {id:4, action:'profile_update', section:'profile', user:'Админ', createdAt:new Date().toISOString(), data:{role:'owner', plan:'pro'}}
    ]);
  }

  function logType(log){
    const a = String(log.action || '').toLowerCase();
    const s = String(log.section || '').toLowerCase();
    if(a.includes('error') || s.includes('error')) return 'error';
    if(a.includes('moderation') || s.includes('moderation')) return 'moderation';
    if(a.includes('tariff') || a.includes('plan') || s.includes('subscription')) return 'payment';
    if(a.includes('register') || a.includes('login') || a.includes('profile') || s.includes('auth') || s.includes('profile')) return 'user';
    if(a.includes('search')) return 'search';
    return 'system';
  }

  function title(log){
    const a = String(log.action || '').toLowerCase();
    const s = String(log.section || '').toLowerCase();

    if(a.includes('register')) return 'Пользователь зарегистрировался';
    if(a.includes('login_admin')) return 'Администратор вошёл';
    if(a.includes('login')) return 'Пользователь вошёл';
    if(a.includes('logout')) return 'Пользователь вышел';
    if(a.includes('profile')) return 'Пользователь обновил профиль';
    if(a.includes('search') && s.includes('blacklist')) return 'Поиск в черном списке';
    if(a.includes('search')) return 'Пользователь выполнил поиск';
    if(a.includes('moderation') && a.includes('update')) return 'Админ изменил статус публикации';
    if(a.includes('moderation')) return 'Запись отправлена на модерацию';
    if(a.includes('open')) return 'Пользователь открыл раздел';
    if(a.includes('tariff') || a.includes('plan')) return 'Изменён тариф';
    if(a.includes('error')) return 'Ошибка в приложении';
    return log.title || 'Действие пользователя';
  }

  function icon(log){
    const t = logType(log);
    return {
      user:'👤',
      search:'🔎',
      moderation:'🛡️',
      payment:'💰',
      error:'⚠️',
      system:'📌'
    }[t] || '📌';
  }

  function details(log){
    const d = safeJson(log.data, {});
    const out = [];

    if(d.q) out.push('Запрос: ' + d.q);
    if(d.type) out.push('Тип: ' + d.type);
    if(d.role) out.push('Роль: ' + String(d.role).toUpperCase());
    if(d.plan) out.push('Тариф: ' + (d.plan === 'free' ? 'Бесплатный доступ' : String(d.plan).toUpperCase()));
    if(d.status) out.push('Статус: ' + d.status);
    if(d.title) out.push('Запись: ' + d.title);
    if(d.section) out.push('Раздел: ' + d.section);

    if(!out.length && log.section) out.push('Раздел: ' + readableSection(log.section));
    return out.join(' · ') || 'Без дополнительных данных';
  }

  function readableSection(section){
    const s = String(section || '').toLowerCase();
    const map = {
      auth:'Авторизация',
      profile:'Профиль',
      blacklist:'Черный список',
      services:'Презентация услуг',
      chat:'Закрытый чат',
      subscription:'Тарифы',
      admin:'Админка',
      moderation:'Модерация'
    };
    return map[s] || section || 'Система';
  }

  function render(filter='all'){
    const root = document.getElementById('logsList');
    if(!root) return;

    seedLogsIfEmpty();
    let logs = getLogs();

    if(filter !== 'all'){
      logs = logs.filter(log => logType(log) === filter);
    }

    if(!logs.length){
      root.innerHTML = '<div class="admin-empty">Пока нет действий по выбранному фильтру.</div>';
      return;
    }

    root.innerHTML = logs.slice(0,80).map(log => {
      const t = logType(log);
      const time = log.createdAt ? new Date(log.createdAt).toLocaleString('ru-RU') : 'время не указано';
      return `
        <div class="human-log-card ${t}">
          <div class="human-log-icon">${icon(log)}</div>
          <div class="human-log-body">
            <div class="human-log-title">${escapeHtml(title(log))}</div>
            <div class="human-log-meta">${escapeHtml(log.user || 'Пользователь')} · ${escapeHtml(time)}</div>
            <div class="human-log-details">${escapeHtml(details(log))}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function clearLogs(){
    if(confirm('Очистить логи?')){
      saveLogs([]);
      render('all');
    }
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function mount(){
    const logsTab = document.getElementById('tab-logs');
    if(!logsTab || document.getElementById('humanLogsToolbar')) return;

    const oldTitle = logsTab.querySelector('h2');
    if(oldTitle) oldTitle.textContent = 'Понятные логи';

    const oldP = logsTab.querySelector('p');
    if(oldP) oldP.textContent = 'Здесь видно, что делали пользователи и админы, без технического JSON.';

    const toolbar = document.createElement('div');
    toolbar.id = 'humanLogsToolbar';
    toolbar.className = 'human-logs-toolbar';
    toolbar.innerHTML = `
      <button class="human-log-filter active" data-filter="all">Все</button>
      <button class="human-log-filter" data-filter="user">Пользователи</button>
      <button class="human-log-filter" data-filter="search">Поиск</button>
      <button class="human-log-filter" data-filter="moderation">Модерация</button>
      <button class="human-log-filter" data-filter="payment">Тарифы</button>
      <button class="human-log-filter" data-filter="error">Ошибки</button>
      <button class="human-log-clear" id="clearHumanLogs">Очистить логи</button>
    `;

    const list = document.getElementById('logsList');
    if(list) logsTab.insertBefore(toolbar, list);

    toolbar.querySelectorAll('.human-log-filter').forEach(btn => {
      btn.onclick = () => {
        toolbar.querySelectorAll('.human-log-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(btn.dataset.filter);
      };
    });

    document.getElementById('clearHumanLogs').onclick = clearLogs;
    render('all');
  }

  window.HumanLogsFix = { render, mount };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mount, 100);
    setTimeout(mount, 500);
  });

  document.addEventListener('click', e => {
    if(e.target && e.target.dataset && e.target.dataset.tab === 'logs'){
      setTimeout(mount, 50);
      setTimeout(() => render(document.querySelector('.human-log-filter.active')?.dataset.filter || 'all'), 80);
    }
  });
})();
