/* Правовая часть «Лирический склад»: данные владельца из js/config.js и окно
   «Примите пользовательское соглашение».

   Согласие хранится в одном техническом cookie lyr_terms=<версия соглашения> на 365 дней.
   Новая редакция соглашения -> новая TERMS_VERSION -> окно показывается снова.
   Если cookie заблокированы, согласие держится в sessionStorage до закрытия вкладки.
   Окна нет на terms.html и privacy.html — их можно прочитать до принятия.
   Работает и в браузере (window.LSLegal), и в Node для тестов (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.LSLegal = api;
    api.init(root, root.LS_CONFIG || {});
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TERMS_VERSION = "2026-11-07";
  const COOKIE_NAME = "lyr_terms";
  const MAX_AGE = 365 * 24 * 60 * 60;
  const LEAVE_URL = "https://ya.ru";
  const OPEN_PAGES = ["terms", "privacy"];

  function readCookie(cookieString, name) {
    for (const part of String(cookieString || "").split(";")) {
      const i = part.indexOf("=");
      if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
    }
    return null;
  }

  function consentCookie(version, secure) {
    return COOKIE_NAME + "=" + version + "; Max-Age=" + MAX_AGE + "; Path=/; SameSite=Lax" + (secure ? "; Secure" : "");
  }

  function sessionValue(session) {
    try { return session ? session.getItem(COOKIE_NAME) : null; } catch (e) { return null; }
  }

  function hasConsent(doc, session) {
    let fromCookie = null;
    try { fromCookie = readCookie(doc.cookie, COOKIE_NAME); } catch (e) { /* cookie недоступны */ }
    return fromCookie === TERMS_VERSION || sessionValue(session) === TERMS_VERSION;
  }

  /* Ставит cookie; если браузер его не сохранил — запоминает согласие в sessionStorage. */
  function acceptTerms(doc, session, secure) {
    try { doc.cookie = consentCookie(TERMS_VERSION, secure); } catch (e) { /* cookie недоступны */ }
    let saved = false;
    try { saved = readCookie(doc.cookie, COOKIE_NAME) === TERMS_VERSION; } catch (e) { saved = false; }
    if (!saved) {
      try { if (session) session.setItem(COOKIE_NAME, TERMS_VERSION); } catch (e) { /* и это закрыто — окно всё равно закроется */ }
    }
  }

  function sameSite(referrer, origin) {
    try { return !!referrer && new URL(referrer).origin === origin; } catch (e) { return false; }
  }

  /* «Не принимаю»: назад по истории, если пришли с чужого сайта, иначе — на ya.ru. */
  function declineTarget(historyLength, referrer, origin) {
    return historyLength > 1 && !sameSite(referrer, origin) ? "back" : LEAVE_URL;
  }

  function needsGate(page) {
    return OPEN_PAGES.indexOf(page) === -1;
  }

  function dropOldNotice(store) {
    try { if (store) store.removeItem("ls-notice-ok"); } catch (e) { /* хранилище закрыто — не важно */ }
  }

  /* Контакт владельца -> { text, href }: e-mail -> mailto, @ник -> t.me, http(s) -> как есть,
     плейсхолдер в [скобках] и прочее — без ссылки. */
  function contactLink(value) {
    const text = String(value == null ? "" : value).trim();
    let href = null;
    if (/^https?:\/\//i.test(text)) href = text;
    else if (/^@[A-Za-z0-9_]{3,}$/.test(text)) href = "https://t.me/" + text.slice(1);
    else if (/^[^\s@\[\]]+@[^\s@]+\.[^\s@]+$/.test(text)) href = "mailto:" + text;
    return { text: text, href: href };
  }

  function fillOwner(doc, config) {
    doc.querySelectorAll('[data-owner="name"]').forEach((el) => {
      if (config.ownerName) el.textContent = config.ownerName;
    });
    doc.querySelectorAll('[data-owner="contact"]').forEach((el) => {
      if (!config.ownerContact) return;
      const c = contactLink(config.ownerContact);
      el.textContent = "";
      if (c.href) {
        const a = doc.createElement("a");
        a.href = c.href;
        a.textContent = c.text;
        if (/^https?:/.test(c.href)) { a.rel = "noopener"; a.target = "_blank"; }
        el.appendChild(a);
      } else {
        el.textContent = c.text;
      }
    });
  }

  function safeStorage(win, name) {
    try { return win[name]; } catch (e) { return null; }
  }

  /* Модальное окно: остальная страница inert, прокрутка заблокирована, Tab ходит по кругу внутри, Esc не закрывает. */
  function showGate(win, session) {
    const doc = win.document;
    if (doc.getElementById("terms-gate")) return;
    const shade = doc.createElement("div");
    shade.className = "gate";
    shade.id = "terms-gate";
    shade.innerHTML =
      '<div class="gate-box" role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-text" tabindex="-1">' +
        '<h2 class="gate-title" id="gate-title">Пользовательское соглашение</h2>' +
        '<p id="gate-text">Чтобы пользоваться сайтом, примите пользовательское соглашение. ' +
          'Сайт использует один технический cookie, чтобы запомнить ваш выбор.</p>' +
        '<p class="gate-links"><a href="terms.html">Пользовательское соглашение</a> · ' +
          '<a href="privacy.html">Конфиденциальность и cookie</a></p>' +
        '<div class="gate-actions">' +
          '<button type="button" class="btn primary" data-gate="accept">Принимаю</button>' +
          '<button type="button" class="btn" data-gate="decline">Не принимаю</button>' +
        "</div>" +
      "</div>";

    const others = [...doc.body.children];
    others.forEach((el) => el.setAttribute("inert", ""));
    doc.documentElement.classList.add("gate-open");
    doc.body.appendChild(shade);

    const box = shade.querySelector(".gate-box");
    const focusables = () => [...box.querySelectorAll("a[href], button")];

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      const active = doc.activeElement;
      if (e.shiftKey && (active === first || active === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !box.contains(active))) { e.preventDefault(); first.focus(); }
    }
    doc.addEventListener("keydown", onKey, true);

    function close() {
      doc.removeEventListener("keydown", onKey, true);
      others.forEach((el) => el.removeAttribute("inert"));
      doc.documentElement.classList.remove("gate-open");
      shade.remove();
    }

    shade.querySelector('[data-gate="accept"]').addEventListener("click", () => {
      acceptTerms(doc, session, win.location.protocol === "https:");
      close();
    });
    shade.querySelector('[data-gate="decline"]').addEventListener("click", () => {
      const target = declineTarget(win.history.length, doc.referrer, win.location.origin);
      if (target === "back") win.history.back();
      else win.location.replace(target);
    });

    box.focus();
  }

  function init(win, config) {
    const doc = win && win.document;
    if (!doc || !doc.body) return;
    try {
      fillOwner(doc, config);
      dropOldNotice(safeStorage(win, "localStorage"));
      const session = safeStorage(win, "sessionStorage");
      if (needsGate(doc.body.dataset.page) && !hasConsent(doc, session)) showGate(win, session);
    } catch (e) { /* правовой блок не должен ломать остальную страницу */ }
  }

  return { TERMS_VERSION, COOKIE_NAME, readCookie, consentCookie, hasConsent, acceptTerms, declineTarget, needsGate,
    dropOldNotice, contactLink, init };
});
