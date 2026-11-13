/* Шапка «Лирический склад»: поиск ведёт в каталог через #q= (LSCore.searchHref) — запрос не уходит на сервер.
   Форма в HTML с method="dialog": без JavaScript она ничего не отправляет. На странице каталога запрос
   сразу попадает в поле поиска каталога. */
(function () {
  "use strict";
  const C = window.LSCore;
  if (!C) return;
  document.querySelectorAll("form.search").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector('input[name="q"]');
      const q = input ? input.value : "";
      const field = document.getElementById("q");
      if (document.body.dataset.page === "catalog" && field) {
        field.value = q.trim();
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
        return;
      }
      location.href = C.searchHref(q);
    });
  });
})();
