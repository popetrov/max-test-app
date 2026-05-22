let allRequests = [];

function goToPage(page){ window.location.href = page; }

function goHome(){ window.location.href = "/"; }

async function submitContractorRequest(event) {
  event.preventDefault();

  const form = event.target;

  const performers = Array.from(
    form.querySelectorAll('input[name="performers"]:checked')
  ).map((checkbox) => checkbox.value);

  const data = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    city: form.city.value.trim(),
    performers,
    sro: form.sro.value,
    category: form.category.value,
    priceFrom: form.priceFrom.value ? Number(form.priceFrom.value) : null,
    priceTo: form.priceTo.value ? Number(form.priceTo.value) : null,
    contactType: form.contactType.value,
    contact: form.contact.value.trim()
  };

  try {
    const response = await fetch("/api/contractor-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      alert("Заявка успешно опубликована");
      window.location.href = "index.html";
    } else {
      alert(result.message || "Ошибка при сохранении заявки");
    }
  } catch (error) {
    console.error("Ошибка отправки заявки:", error);
    if (window.SP) {
      SP.queueModeration("Заявка на субподряд", data);
      SP.addMaxQueue({ title: data.title, city: data.city, category: data.category, description: data.description });
      alert("Сервер недоступен. Заявка сохранена в демо-очередь модерации и MAX-автопостинга.");
      window.location.href = "index.html";
    } else {
      saveDemoContractorRequest(data);
    alert("Заявка сохранена и отправлена на модерацию. Сервер пока не подключен, поэтому это демо-режим.");
    window.location.href = "/";
    }
  }
}

async function loadContractorRequests() {
  const list = document.getElementById("requestsList");

  if (!list) return;

  try {
    const response = await fetch("/api/contractor-requests");
    const data = await response.json();

    if (!data.success) {
      allRequests = getDemoContractorRequests();
    renderContractorRequests(allRequests);
    if(window.SP) setTimeout(()=>SP.startSoftViewGrowth(),50);
      return;
    }

    allRequests = data.items || [];
    renderContractorRequests(allRequests); if(window.SP) setTimeout(()=>SP.startSoftViewGrowth(),50);
  } catch (error) {
    console.error("Ошибка загрузки заявок:", error);
    allRequests = [
      {id: 9001, title: "Ищу бригаду монолитчиков", description: "Нужна бригада на объект. Контакты заказчика скрыты по тарифу.", city: "Москва", performers:["Монолитчики"], sro:"Не важно", category:"Монолит", priceFrom:500000, priceTo:null, createdAt:new Date().toISOString()},
      {id: 9002, title: "Нужны электрики", description: "Коммерческий объект, старт на следующей неделе.", city: "Санкт-Петербург", performers:["Электрики"], sro:"Не важно", category:"Электромонтаж", priceFrom:null, priceTo:null, createdAt:new Date().toISOString()}
    ];
    renderContractorRequests(allRequests); if(window.SP) setTimeout(()=>SP.startSoftViewGrowth(),50);
  }
}

function renderContractorRequests(items) {
  const list = document.getElementById("requestsList");

  if (!list) return;

  if (!items.length) {
    list.innerHTML = `<div class="empty-text">Пока нет опубликованных заявок</div>`;
    return;
  }

  list.innerHTML = items.map((item) => {
    const budget = formatBudget(item.priceFrom, item.priceTo);
    const date = formatDate(item.createdAt);
    const performers = item.performers && item.performers.length
      ? item.performers.join(", ")
      : "Не указано";

    return `
      <article class="request-card" id="request-${item.id}">
        <h2>${escapeHtml(item.title)}</h2>

        <div class="request-meta">
          <span>${escapeHtml(item.city || "Город не указан")}</span>
          <span>${escapeHtml(item.category || "Категория не указана")}</span>\n          <span data-view-id="request-${item.id}" data-view-base="80">👁 80 просмотров</span>
        </div>

        <div class="request-info">
          <div><strong>Кто нужен:</strong> ${escapeHtml(performers)}</div>
          <div><strong>СРО:</strong> ${escapeHtml(item.sro || "Не важно")}</div>
          <div><strong>Бюджет:</strong> ${budget}</div>
          <div><strong>Дата:</strong> ${date}</div>
        </div>

        <p class="request-short">
          ${escapeHtml(item.description || "Описание не указано")}
        </p>

        <div class="request-details" id="details-${item.id}">
          <p>${escapeHtml(item.description || "Описание не указано")}</p>

          <div class="locked-contacts">
            Контакты заказчика доступны после оплаты доступа.
          </div>

            <button class="details-button" onclick="openSubscriptionModal()">
              Получить контакты
            </button>
        </div>

        <button class="details-button" onclick="toggleRequestDetails(${item.id})">
          Подробнее
        </button>
      </article>
    `;
  }).join("");
}

function applyRequestFilters() {
  const search = document.getElementById("requestSearch")?.value.toLowerCase().trim() || "";
  const city = document.getElementById("requestCity")?.value.toLowerCase().trim() || "";
  const category = document.getElementById("requestCategory")?.value || "";

  const filtered = allRequests.filter((item) => {
    const textMatch =
      (item.title || "").toLowerCase().includes(search) ||
      (item.description || "").toLowerCase().includes(search) ||
      (item.city || "").toLowerCase().includes(search) ||
      (item.category || "").toLowerCase().includes(search);

    const cityMatch = !city || (item.city || "").toLowerCase().includes(city);
    const categoryMatch = !category || item.category === category;

    return textMatch && cityMatch && categoryMatch;
  });

  renderContractorRequests(filtered);
}

function resetRequestFilters() {
  document.getElementById("requestSearch").value = "";
  document.getElementById("requestCity").value = "";
  document.getElementById("requestCategory").value = "";
  renderContractorRequests(allRequests); if(window.SP) setTimeout(()=>SP.startSoftViewGrowth(),50);
}

function toggleRequestDetails(id) {
  const block = document.getElementById(`details-${id}`);
  if (!block) return;

  block.classList.toggle("open");
}

function showContactsLocked() {
  startPayment();
}

function formatBudget(priceFrom, priceTo) {
  if (priceFrom && priceTo) return `от ${formatMoney(priceFrom)} ₽ до ${formatMoney(priceTo)} ₽`;
  if (priceFrom) return `от ${formatMoney(priceFrom)} ₽`;
  if (priceTo) return `до ${formatMoney(priceTo)} ₽`;
  return "Бюджет не указан";
}

function formatMoney(value) {
  return Number(value).toLocaleString("ru-RU");
}

function formatDate(value) {
  if (!value) return "Дата не указана";

  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("DOMContentLoaded", () => {
  loadContractorRequests();
});

async function startPayment() {
  try {
    const response = await fetch("/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: 1,
        description: "Доступ к контактам СТРОЙПОДРЯД"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.error || "Ошибка создания платежа");
      return;
    }

    if (data.payment_url) {
      window.location.href = data.payment_url;
    } else {
      alert("Не удалось получить ссылку оплаты");
    }

  } catch (error) {
    console.error("Ошибка оплаты:", error);
    saveDemoContractorRequest(data);
    alert("Заявка сохранена и отправлена на модерацию. Сервер пока не подключен, поэтому это демо-режим.");
    window.location.href = "/";
  }
}

async function startPayment() {
  try {
    const response = await fetch("/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: 1,
        description: "Доступ к контактам СТРОЙПОДРЯД"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.error || "Ошибка создания платежа");
      return;
    }

    if (data.payment_url) {
      window.location.href = data.payment_url;
    } else {
      alert("Не удалось получить ссылку оплаты");
    }
  } catch (error) {
    console.error("Ошибка оплаты:", error);
    saveDemoContractorRequest(data);
    alert("Заявка сохранена и отправлена на модерацию. Сервер пока не подключен, поэтому это демо-режим.");
    window.location.href = "/";
  }
}

function openSubscriptionModal() {
  const modal = document.getElementById("subscriptionModal");
  if (modal) {
    modal.classList.add("open");
  }
}

function closeSubscriptionModal() {
  const modal = document.getElementById("subscriptionModal");
  if (modal) {
    modal.classList.remove("open");
  }
}

function paySubscription() {
  window.location.href = "/pay-subscription";
}

async function startPayment() {
  let paymentWindow = null;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!isMobile) {
    paymentWindow = window.open("about:blank", "_blank");
  }

  try {
    const response = await fetch("/api/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: 800,
        description: "Подписка СТРОЙПОДРЯД в МАКС на 1 месяц"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.paymentUrl) {
      if (paymentWindow) paymentWindow.close();
      alert(data.error || "Не удалось создать платеж");
      return;
    }

    if (paymentWindow) {
      paymentWindow.location.href = data.paymentUrl;
    } else {
      window.location.href = data.paymentUrl;
    }

  } catch (error) {
    if (paymentWindow) paymentWindow.close();

    console.error("Payment error:", error);
    alert("Ошибка при открытии оплаты");
  }
}

function saveDemoContractorRequest(data) {
  const key = 'sp_demo_contractor_requests';
  const old = JSON.parse(localStorage.getItem(key) || '[]');
  const item = {
    id: Date.now(),
    status: 'На модерации',
    createdAt: new Date().toISOString(),
    ...data
  };
  old.unshift(item);
  localStorage.setItem(key, JSON.stringify(old));
  if (window.SP) {
    SP.queueModeration("Заявка на субподряд", data);
    SP.addMaxQueue({ title: data.title, city: data.city, category: data.category, description: data.description });
  }
  return item;
}

function getDemoContractorRequests() {
  const saved = JSON.parse(localStorage.getItem('sp_demo_contractor_requests') || '[]');
  const base = [
    {id: 9101, title: "Ищу бригаду монолитчиков", description: "Нужна бригада на объект. Контакты заказчика скрыты по тарифу.", city: "Москва", performers:["Монолитчики"], sro:"Не важно", category:"Монолит", priceFrom:500000, priceTo:null, createdAt:new Date().toISOString()},
    {id: 9102, title: "Нужны электрики", description: "Коммерческий объект, старт на следующей неделе.", city: "Санкт-Петербург", performers:["Электрики"], sro:"Не важно", category:"Электромонтаж", priceFrom:null, priceTo:null, createdAt:new Date().toISOString()}
  ];
  return [...saved, ...base];
}


function getCurrentChatName(){
  try{
    const u = SP.user();
    return u.displayName || u.name || getCurrentChatName() || 'Пользователь';
  }catch(e){
    return getCurrentChatName() || 'Пользователь';
  }
}

function getCurrentChatAuthor(){
  try{const u=JSON.parse(localStorage.getItem('sp_user')||'{}');return u.displayName||u.name||'Пользователь'}catch(e){return 'Пользователь'}
}
