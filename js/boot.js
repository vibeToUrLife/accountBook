// Runs before app.js, which has to wait for the Firebase SDK to download:
// puts the page in the saved language as soon as the dictionary is in, sets the
// header toggles to their final state, and reveals the page that the <head>
// script hid to avoid a flash of English. app.js repeats these steps later
// (they're idempotent).
import { initLang, getLang, translateDom } from "./i18n.js?v=2"; // same URL as app.js: one shared module

initLang();
translateDom();

const zhActive = getLang() === "zh";
const langBtn = document.getElementById("langToggleBtn");
if (langBtn) {
  const label = langBtn.querySelector(".lang-toggle-label");
  if (label) label.textContent = zhActive ? "EN" : "中文";
  langBtn.title = zhActive ? "Switch to English" : "切换到中文";
  langBtn.setAttribute("aria-label", langBtn.title);
}

const themeBtn = document.getElementById("themeToggleBtn");
if (themeBtn && document.documentElement.dataset.theme === "dark") {
  themeBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-sun"></use></svg>';
}

document.documentElement.classList.remove("i18n-pending");
