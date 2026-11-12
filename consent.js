// =========================================================
// BUDGETBASE - cookie banner + Google Analytics
// Google Analytics is loaded ONLY after the visitor clicks Accept.
// If the visitor clicks Decline, nothing from Google Analytics loads.
// Put this file in the same folder as your HTML files and add
//   <script src="consent.js"></script>
// inside the <head> of every page (this replaces the old Analytics code).
// =========================================================

// 1) GOOGLE ANALYTICS 
const GA_ID = "G-2EFX2G5P3M";

// ----- Settings -----
const CONSENT_KEY = "budgetbase_cookie_choice";
const CONSENT_DAYS = 365; // ask again after this many days

const CONSENT_LANG = (document.documentElement.lang || "en").toLowerCase().startsWith("es") ? "es" : "en";

const CONSENT_TEXTS = {
  en: {
    label: "Cookie choices",
    message: "We would like to use Google Analytics cookies to see how people use BudgetBase. You choose, and you can browse the whole website either way. Temu may also set its own cookies if you click a product.",
    accept: "Accept",
    decline: "Decline",
    privacy: "Privacy policy",
    privacyUrl: "privacy.html",
    settings: "Cookie settings"
  },
  es: {
    label: "Opciones de cookies",
    message: "Nos gustaría usar cookies de Google Analytics para ver cómo se usa BudgetBase. Tú eliges, y puedes navegar por todo el sitio en cualquier caso. Temu también puede colocar sus propias cookies si haces clic en un producto.",
    accept: "Aceptar",
    decline: "Rechazar",
    privacy: "Política de privacidad",
    privacyUrl: "privacy-es.html",
    settings: "Configuración de cookies"
  }
};
const CT = CONSENT_TEXTS[CONSENT_LANG];

// ----- Saving the choice (stays in this browser only) -----
function readChoice() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (!saved || (saved.value !== "granted" && saved.value !== "denied")) return null;
    const ageDays = (Date.now() - saved.time) / 86400000;
    if (ageDays > CONSENT_DAYS) return null;
    return saved.value;
  } catch (error) {
    return null;
  }
}

function saveChoice(value) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ value: value, time: Date.now() }));
  } catch (error) {
    // Private mode or blocked storage: the banner will simply ask again next time
  }
}

// ----- Google Analytics -----
let analyticsLoaded = false;

function analyticsIdIsSet() {
  // Valid IDs look like G-ABC123XYZ9; the placeholder contains a run of X's
  return /^G-[A-Z0-9]{4,}$/i.test(GA_ID) && GA_ID.indexOf("XXXX") === -1;
}

function loadAnalytics() {
  if (analyticsLoaded) return;
  if (!analyticsIdIsSet()) {
    console.warn("consent.js: set your Google Analytics ID in GA_ID (top of the file).");
    return;
  }
  analyticsLoaded = true;
  window["ga-disable-" + GA_ID] = false;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

// Used when someone declines after having accepted before
function stopAnalytics() {
  window["ga-disable-" + GA_ID] = true;
  document.cookie.split(";").forEach(function (cookie) {
    const name = cookie.split("=")[0].trim();
    if (name === "_ga" || name === "_gid" || name.indexOf("_ga_") === 0) {
      const host = window.location.hostname;
      const expired = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie = expired;
      document.cookie = expired + "; domain=" + host;
      document.cookie = expired + "; domain=." + host;
    }
  });
}

// ----- Banner -----
function removeBanner() {
  const banner = document.getElementById("cookie-banner");
  if (banner) banner.remove();
}

function choose(value) {
  saveChoice(value);
  if (value === "granted") {
    loadAnalytics();
  } else {
    stopAnalytics();
  }
  removeBanner();
}

function showBanner() {
  if (document.getElementById("cookie-banner")) return;

  const banner = document.createElement("div");
  banner.id = "cookie-banner";
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", CT.label);

  const text = document.createElement("p");
  text.className = "cookie-text";
  text.textContent = CT.message + " ";

  const link = document.createElement("a");
  link.href = CT.privacyUrl;
  link.textContent = CT.privacy;
  text.appendChild(link);

  const actions = document.createElement("div");
  actions.className = "cookie-actions";

  const decline = document.createElement("button");
  decline.type = "button";
  decline.className = "cookie-btn cookie-btn-decline";
  decline.textContent = CT.decline;
  decline.addEventListener("click", function () { choose("denied"); });

  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "cookie-btn cookie-btn-accept";
  accept.textContent = CT.accept;
  accept.addEventListener("click", function () { choose("granted"); });

  actions.appendChild(decline);
  actions.appendChild(accept);
  banner.appendChild(text);
  banner.appendChild(actions);
  document.body.appendChild(banner);
}

// "Cookie settings" link in the footer so people can change their mind
function addSettingsLink() {
  const footerLinks = document.querySelector(".footer-links");
  if (!footerLinks || footerLinks.querySelector(".cookie-settings-link")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cookie-settings-link";
  button.textContent = CT.settings;
  button.addEventListener("click", showBanner);
  footerLinks.appendChild(button);
}

// ----- Start -----
(function start() {
  const choice = readChoice();
  if (choice === "granted") loadAnalytics();

  function setupPage() {
    addSettingsLink();
    if (choice === null) showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPage);
  } else {
    setupPage();
  }
})();