let allRequests = [];

function goToPage(page) {
  window.location.href = page;
}

function goHome() {
  window.location.href = "index.html";
}

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
    alert("Ошибка подключения к серверу");
  }
}

async function loadContractorRequests() {
  const list = document.getElementById("requestsList");

  if (!list) return;

  try {
    const response = await fetch("/api/contractor-requests");
    const data = await response.json();

    if (!data.success) {
      list.innerHTML = `<div class="empty-text">Не удалось загрузить заявки</div>`;
      return;
    }

    allRequests = data.items || [];
    renderContractorRequests(allRequests);
  } catch (error) {
    console.error("Ошибка загрузки заявок:", error);
    list.innerHTML = `<div class="empty-text">Не удалось загрузить заявки</div>`;
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
          <span>${escapeHtml(item.category || "Категория не указана")}</span>
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

          <button class="details-button" onclick="showContactsLocked()">
            Показать контакты
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
  renderContractorRequests(allRequests);
}

function toggleRequestDetails(id) {
  const block = document.getElementById(`details-${id}`);
  if (!block) return;

  block.classList.toggle("open");
}

function showContactsLocked() {
  alert("Доступ к контактам будет подключен после настройки оплаты.");
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