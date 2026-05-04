function goToPage(page) {
  window.location.href = page;
}

function goHome() {
  window.location.href = "index.html";
}

function copyCardNumber() {
  const cardNumber = "XXXX XXXX XXXX XXXX";
  navigator.clipboard.writeText(cardNumber);
  alert("Номер карты скопирован");
}

function submitContractorRequest(event) {
  event.preventDefault();
  alert("Заявка создана. Скоро мы подключим отправку на сервер.");
  window.location.href = "index.html";
}