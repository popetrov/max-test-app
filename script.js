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