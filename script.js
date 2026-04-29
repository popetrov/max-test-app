const pages = ["page1", "page2", "page3", "page4"];

function hideAllPages() {
  document.getElementById("home").style.display = "none";

  pages.forEach(function(page) {
    document.getElementById(page).style.display = "none";
  });
}

function showPageFromHash() {
  const hash = window.location.hash.replace("#", "");

  hideAllPages();

  if (pages.includes(hash)) {
    document.getElementById(hash).style.display = "block";
  } else {
    document.getElementById("home").style.display = "block";
  }
}

function openPage(id) {
  window.location.hash = id;
}

function goHome() {
  window.location.hash = "home";
}

window.addEventListener("load", showPageFromHash);
window.addEventListener("hashchange", showPageFromHash);