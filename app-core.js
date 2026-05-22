
/* СТРОЙПОДРЯД — общий frontend-фундамент.
   В будущем эти функции заменяются backend/API, но имена и логика уже заложены. */

const SP = (() => {
  const keys = {
    user: 'sp_user',
    moderation: 'sp_moderation_queue',
    logs: 'sp_activity_logs',
    views: 'sp_views',
    partnerRequests: 'sp_partner_requests',
    maxQueue: 'sp_max_repost_queue'
  };

  const defaultUser = {
    role: 'guest',
    plan: 'free',
    name: 'Гость',
    displayName: 'Гость',
    phone: '',
    email: ''
  };

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function user() {
    return get(keys.user, defaultUser);
  }

  function saveUser(nextUser) {
    const current = user();
    set(keys.user, { ...current, ...nextUser });
    log('profile_update', 'profile', nextUser);
  }

  function isAdmin() {
    const u = user();
    return ['admin', 'owner'].includes(u.role);
  }

  function can(permission) {
    const u = user();
    if (['admin', 'owner'].includes(u.role)) return true;
    if (permission === 'view_open_contacts') return true;

    const matrix = {
      publish_presentation: ['presentation', 'orders', 'pro'],
      view_customer_contacts: ['orders', 'pro'],
      download_order_files: ['orders', 'pro'],
      use_closed_chat: ['orders', 'pro'],
      tender_search: ['pro'],
      tender_winners: ['pro'],
      lpr: ['pro'],
      counterparty_full: ['pro']
    };

    return (matrix[permission] || []).includes(u.plan);
  }

  function requireAccess(permission, message) {
    if (can(permission)) return true;
    showPaywall(message || 'Функция доступна по тарифу');
    log('try_locked_feature', permission, { plan: user().plan });
    return false;
  }

  function showPaywall(message) {
    const modal = document.getElementById('subscriptionModal');
    if (modal) {
      const text = modal.querySelector('[data-paywall-text]');
      if (text) text.textContent = message;
      modal.classList.add('open');
    } else {
      alert(message + '\n\nОткройте раздел «Тарифы» для подключения доступа.');
    }
  }

  function queueModeration(type, payload) {
    const list = get(keys.moderation, seedModeration());
    const item = {
      id: Date.now(),
      type,
      status: 'На проверке',
      createdAt: new Date().toISOString(),
      author: user().displayName || user().name || 'Гость',
      payload
    };
    list.unshift(item);
    set(keys.moderation, list);
    log('submit_moderation', type, payload);
    return item;
  }

  function moderationList() {
    return get(keys.moderation, seedModeration());
  }

  function updateModeration(id, status) {
    const list = moderationList().map(item => item.id === id ? { ...item, status, reviewedAt: new Date().toISOString() } : item);
    set(keys.moderation, list);
    log('moderation_status', 'admin', { id, status });
  }

  function seedModeration() {
    return [
      {
        id: 1001,
        type: 'Черный список',
        status: 'На проверке',
        createdAt: new Date().toISOString(),
        author: 'Иван',
        payload: {
          title: 'ООО Ромашка Строй',
          inn: '7700000000',
          city: 'Москва',
          description: 'Спорная ситуация по оплате выполненных работ.',
          files: '2 файла'
        }
      },
      {
        id: 1002,
        type: 'Презентация услуг',
        status: 'На проверке',
        createdAt: new Date().toISOString(),
        author: 'Алексей',
        payload: {
          title: 'Бригада монолитчиков',
          inn: '7711111111',
          city: 'Москва и МО',
          description: 'Монолитные работы, опалубка, армирование.',
          files: '3 фото'
        }
      },
      {
        id: 1003,
        type: 'Заявка на субподряд',
        status: 'На проверке',
        createdAt: new Date().toISOString(),
        author: 'Сергей',
        payload: {
          title: 'Ищу электриков на объект',
          inn: '',
          city: 'Санкт-Петербург',
          description: 'Коммерческий объект, старт на следующей неделе.',
          files: '1 ТЗ'
        }
      }
    ];
  }

  function log(action, section, data = {}) {
    const logs = get(keys.logs, []);
    logs.unshift({
      id: Date.now() + Math.random(),
      action,
      section,
      data,
      user: user().displayName || user().name || 'Гость',
      createdAt: new Date().toISOString()
    });
    set(keys.logs, logs.slice(0, 300));
  }

  function logs() {
    return get(keys.logs, []);
  }

  function views(id, base = 0) {
    const all = get(keys.views, {});
    if (!all[id]) {
      all[id] = {
        value: base + Math.floor(Math.random() * 40),
        lastBump: Date.now()
      };
      set(keys.views, all);
    }
    return all[id].value;
  }

  function bumpViews(id, base = 0) {
    const all = get(keys.views, {});
    const current = all[id] || { value: base, lastBump: 0 };
    const now = Date.now();
    if (now - current.lastBump > 1000 * 60 * 15) {
      current.value += 1 + Math.floor(Math.random() * 4);
      current.lastBump = now;
      all[id] = current;
      set(keys.views, all);
    }
    return current.value;
  }

  function startSoftViewGrowth(selector = '[data-view-id]') {
    document.querySelectorAll(selector).forEach(el => {
      const id = el.dataset.viewId;
      const base = Number(el.dataset.viewBase || 0);
      el.textContent = '👁 ' + views(id, base) + ' просмотров';
    });
    setInterval(() => {
      document.querySelectorAll(selector).forEach(el => {
        const id = el.dataset.viewId;
        const base = Number(el.dataset.viewBase || 0);
        if (Math.random() > 0.55) {
          el.textContent = '👁 ' + bumpViews(id, base) + ' просмотров';
        }
      });
    }, 25000);
  }

  function partnerRequest(section, payload) {
    const list = get(keys.partnerRequests, []);
    const item = {
      id: Date.now(),
      section,
      status: 'Новая',
      createdAt: new Date().toISOString(),
      payload
    };
    list.unshift(item);
    set(keys.partnerRequests, list);
    log('submit_partner_request', section, payload);
    return item;
  }

  function partnerRequests() {
    return get(keys.partnerRequests, []);
  }

  function addMaxQueue(payload) {
    const list = get(keys.maxQueue, []);
    list.unshift({
      id: Date.now(),
      status: 'Ожидает отправки',
      createdAt: new Date().toISOString(),
      payload
    });
    set(keys.maxQueue, list);
  }

  function maxQueue() {
    return get(keys.maxQueue, []);
  }

  return {
    user, saveUser, can, requireAccess, isAdmin,
    queueModeration, moderationList, updateModeration,
    log, logs, views, bumpViews, startSoftViewGrowth,
    partnerRequest, partnerRequests, addMaxQueue, maxQueue
  };
})();


window.SPAuth = window.SPAuth || (() => {
  const KEY = 'sp_demo_accounts';
  const getAccounts = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } };
  const setAccounts = list => localStorage.setItem(KEY, JSON.stringify(list));

  function register(data) {
    const list = getAccounts();
    const email = String(data.email || '').trim().toLowerCase();
    if (!data.name) throw new Error('Укажите имя');
    if (!data.displayName) throw new Error('Укажите имя в чатах');
    if (!data.phone) throw new Error('Укажите телефон');
    if (!email) throw new Error('Укажите почту');
    if (!data.password) throw new Error('Укажите пароль');
    if (list.some(x => x.email === email)) throw new Error('Такой email уже зарегистрирован');

    const acc = {
      id: Date.now(),
      role: 'user',
      plan: 'free',
      name: data.name,
      surname: data.surname || '',
      displayName: data.displayName,
      phone: data.phone,
      email,
      inn: data.inn || '',
      password: data.password,
      createdAt: new Date().toISOString()
    };
    list.push(acc);
    setAccounts(list);
    SP.saveUser(acc);
    return acc;
  }

  function login(email, password) {
    const acc = getAccounts().find(x => x.email === String(email || '').trim().toLowerCase() && x.password === password);
    if (!acc) throw new Error('Неверная почта или пароль');
    SP.saveUser(acc);
    return acc;
  }

  function adminLogin(code) {
    if (!['admin2026','owner2026','1234'].includes(String(code || '').trim())) {
      throw new Error('Неверный админ-код');
    }
    const admin = {
      role: 'admin',
      plan: 'pro',
      name: 'Администратор',
      displayName: 'Админ',
      phone: '',
      email: 'admin@stroypodryad.local',
      inn: ''
    };
    SP.saveUser(admin);
    return admin;
  }

  function logout() {
    localStorage.removeItem('sp_user');
  }

  return { register, login, adminLogin, logout, list:getAccounts };
})();
