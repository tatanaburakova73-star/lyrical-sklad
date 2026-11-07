/* Логика каталога «Лирический склад»: поиск, фильтры, сортировка, топы.
   Работает и в браузере (window.LSCore), и в Node для тестов (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LSCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
    "августа", "сентября", "октября", "ноября", "декабря"];

  function norm(s) {
    return String(s || "").toLowerCase().replace(/ё/g, "е");
  }

  function pct(r) {
    return r.max ? r.total / r.max : 0;
  }

  function isRecognized(r) {
    return !r.unrecognized || r.unrecognized.length === 0;
  }

  function filterReviews(list, opts) {
    const o = opts || {};
    const words = norm(o.q).split(/\s+/).filter(Boolean);
    return list.filter((r) => {
      if (o.type && o.type !== "all" && r.type !== o.type) return false;
      if (o.scale === "90" && r.max !== 90) return false;
      if (o.scale === "10" && r.max === 90) return false;
      if (o.date && r.date !== o.date) return false;
      if (o.artist && !(r.artists || []).includes(o.artist)) return false;
      if (!words.length) return true;
      const hay = norm(r.artist + " " + r.title);
      return words.every((w) => hay.includes(w));
    });
  }

  const byDateDesc = (a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : b.id - a.id);

  function sortReviews(list, mode) {
    const out = list.slice();
    if (mode === "old") return out.sort((a, b) => -byDateDesc(a, b));
    if (mode === "score") {
      return out.sort((a, b) => pct(b) - pct(a) || b.score10 - a.score10 || byDateDesc(a, b));
    }
    if (mode === "score-asc") {
      return out.sort((a, b) => pct(a) - pct(b) || a.score10 - b.score10 || byDateDesc(a, b));
    }
    return out.sort(byDateDesc);
  }

  /* Топ в одной шкале: по треку берётся самый свежий разбор (переразборы
     вытесняют старую оценку), нераспознанные не участвуют. */
  function topReviews(list, opts) {
    const o = opts || {};
    const seen = new Set();
    const latest = [];
    for (const r of sortReviews(list, "new")) {
      if ((o.type && r.type !== o.type) || !isRecognized(r) || seen.has(r.key)) continue;
      seen.add(r.key);
      latest.push(r);
    }
    return latest
      .filter((r) => !o.scale || r.max === o.scale)
      .sort((a, b) => b.total - a.total || pct(b) - pct(a) || byDateDesc(a, b))
      .slice(0, o.limit || 10);
  }

  /* Разбор по id поста. Старый id (оценка ушла в history) ведёт к актуальной записи:
     { review, old } — old = та прежняя оценка или null. */
  function findReview(list, id) {
    for (const r of list) {
      if (r.id === id) return { review: r, old: null };
    }
    for (const r of list) {
      const old = (r.history || []).find((h) => h.id === id);
      if (old) return { review: r, old: old };
    }
    return null;
  }

  /* Артисты: поиск по имени и всем вариантам написания */
  function filterArtists(list, q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return list.slice();
    return list.filter((a) => {
      const hay = norm([a.name].concat(a.variants || []).join(" "));
      return words.every((w) => hay.includes(w));
    });
  }

  function sortArtists(list, mode) {
    const byName = (a, b) => norm(a.name).localeCompare(norm(b.name), "ru");
    const out = list.slice();
    if (mode === "score") return out.sort((a, b) => (b.avg10 || 0) - (a.avg10 || 0) || b.count - a.count || byName(a, b));
    if (mode === "name") return out.sort(byName);
    return out.sort((a, b) => b.count - a.count || byName(a, b));
  }

  /* Шкала из кружков для пункта: count кружков (= максимум), full закрашено,
     half — половинка (7,5/10), extra — сверх максимума (11/10, 12/10). */
  function dots(score, max) {
    const s = Number(score) || 0;
    const whole = Math.floor(Math.min(s, max));
    return { count: max, full: whole, half: s < max && s - whole >= 0.5 ? 1 : 0, extra: Math.max(0, Math.round(s - max)) };
  }

  /* forms: [«разбор», «разбора», «разборов»] */
  function plural(n, forms) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  function formatNumber(n) {
    return String(n).replace(".", ",");
  }

  function formatScore(r) {
    return formatNumber(r.total) + "/" + r.max;
  }

  function formatDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return "";
    return d + " " + MONTHS[m - 1] + " " + y;
  }

  /* Дата выхода релиза из media.json: { date: "2021-03-12", precision: "day" } или { date: "2019", precision: "year" }. */
  function formatRelease(rel) {
    if (!rel || !rel.date) return "";
    if (rel.precision === "year") return /^\d{4}$/.test(rel.date) ? rel.date : "";
    return formatDate(rel.date);
  }

  const IN_RELEASE = { "альбом": "в альбоме", "сингл": "в сингле", "EP": "в EP" };

  /* «Вышел: 12 марта 2021, в альбоме «…»» для карточки разбора; без даты — пустая строка (ничего не выдумываем). */
  function releaseLine(cover, type) {
    const when = formatRelease(cover && cover.release);
    if (!when) return "";
    const where = type === "track" && cover.album ? ", " + (IN_RELEASE[cover.kind] || "в релизе") + " «" + cover.album + "»" : "";
    return "Вышел: " + when + where;
  }

  /* Разборы по дням: число и средняя оценка из 10 — для «звуковой дорожки» канала. */
  function dailyWave(list) {
    const days = new Map();
    for (const r of list) {
      const day = days.get(r.date) || { date: r.date, count: 0, sum: 0, best: null };
      day.count += 1;
      day.sum += r.score10;
      if (!day.best || r.score10 > day.best.score10) day.best = r;
      days.set(r.date, day);
    }
    return [...days.values()]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => ({ date: d.date, count: d.count, avg: Math.round((d.sum / d.count) * 10) / 10, best: d.best }));
  }

  return { norm, pct, isRecognized, filterReviews, sortReviews, topReviews, findReview, filterArtists, sortArtists, dots, plural,
    formatNumber, formatScore, formatDate, formatRelease, releaseLine, dailyWave };
});
