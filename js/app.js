/* Отрисовка страниц «Лирический склад». Данные — window.LS_DATA (data/reviews.js),
   логика поиска и сортировки — window.LSCore (js/core.js). */
(function () {
  "use strict";

  const C = window.LSCore;
  const DATA = window.LS_DATA;
  const UNKNOWN = "не распознано";
  const PAGE_SIZE = 60;
  const FORMS = {
    review: ["разбор", "разбора", "разборов"],
    track: ["трек", "трека", "треков"],
    album: ["альбом", "альбома", "альбомов"],
    post: ["пост", "поста", "постов"],
  };

  const byId = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function count(n, forms) {
    return Number(n).toLocaleString("ru-RU") + " " + C.plural(n, forms);
  }

  if (!C || !DATA || !Array.isArray(DATA.reviews)) {
    const main = document.querySelector("main") || document.body;
    main.insertAdjacentHTML("afterbegin",
      '<div class="error-box wrap"><h1 class="page-title">Нет данных</h1>' +
      "<p>Не найден файл data/reviews.js. Соберите его командой " +
      "<code>python scripts/parse.py</code> и обновите страницу.</p></div>");
    return;
  }

  const R = DATA.reviews;
  const MEDIA = window.LS_MEDIA || { artists: {}, covers: {} };
  const ARTISTS = DATA.artists || [];
  const ARTIST = new Map(ARTISTS.map((a) => [a.slug, a]));
  const kind = (r) => (r.type === "album" ? "альбом" : "трек");
  const href = (r) => "review.html?id=" + r.id;
  const artistHref = (slug) => "artist.html?slug=" + encodeURIComponent(slug);

  /* Имена артистов ссылками на их страницы; разделители («, », « feat. ») — как в посте. */
  function artistLinks(r) {
    if (r.artist === UNKNOWN) return '<span class="unk">исполнитель не распознан</span>';
    if (!r.artist_parts || !r.artist_parts.length) return esc(r.artist);
    return r.artist_parts.map((p) => (p.slug
      ? '<a class="artist-link" href="' + artistHref(p.slug) + '">' + esc(p.text) + "</a>"
      : esc(p.text))).join("");
  }

  /* Название: из поста, а если там нет — общий альбом треков сессии (scripts/media.py). */
  function titleOf(r) {
    if (r.title !== UNKNOWN) return r.title;
    const found = (MEDIA.album_titles || {})[String(r.id)];
    return found ? found.title : null;
  }

  function names(r) {
    const title = titleOf(r);
    return {
      t: title == null ? '<span class="unk">название не распознано</span>' : esc(title),
      a: artistLinks(r),
      plainA: r.artist === UNKNOWN ? "исполнитель не распознан" : esc(r.artist),
    };
  }

  /* Заглушка без чужих картинок: градиент по имени и инициалы. */
  function initials(text) {
    const words = String(text || "?").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    return esc(((words[0] || "?")[0] + (words[1] ? words[1][0] : "")).toUpperCase());
  }

  function hue(text) {
    let h = 0;
    for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) % 360;
    return h;
  }

  function stub(text, cls) {
    return '<span class="pic stub ' + cls + '" style="--hue:' + hue(text) + '" aria-hidden="true">' +
      initials(text) + "</span>";
  }

  function cover(r, cls) {
    const c = MEDIA.covers[String(r.id)];
    if (c && c.cover) {
      return '<img class="pic ' + cls + '" src="' + esc(c.cover) + '" alt="" loading="lazy" width="300" height="300">';
    }
    return stub(titleOf(r) || r.artist, cls);
  }

  function photo(a, cls) {
    const m = MEDIA.artists[a.slug];
    if (m && m.photo) {
      return '<img class="pic ' + cls + '" src="' + esc(m.photo) + '" alt="" loading="lazy" width="300" height="300">';
    }
    return stub(a.name, cls + " round");
  }

  /* Кружок-кольцо на каждый пункт оценки; у оценки из 10 — один кружок. */
  function eq(r) {
    const parts = r.items && r.items.length
      ? r.items.map((i) => (i.score == null ? 0 : i.score / (i.max || 15)))
      : [Math.min(r.total / r.max, 1)];
    const cls = ["eq", r.type === "album" ? "eq-album" : "", parts.length === 1 ? "eq-single" : ""].join(" ");
    return '<span class="' + cls + '" aria-hidden="true">' +
      parts.map((h) => '<i style="--h:' + Math.round(h * 100) + '%"></i>').join("") + "</span>";
  }

  /* ------------------------------------------------------------ главная */

  function home() {
    const st = DATA.stats;
    byId("facts").textContent =
      count(st.tracks, FORMS.track) + " и " + count(st.albums, FORMS.album) + " с оценками" +
      (st.repeats ? "; ещё " + count(st.repeats, ["оценка", "оценки", "оценок"]) +
        " — повторные разборы тех же песен, они в карточках" : "") + ".";

    const handle = byId("channel-count");
    if (handle) handle.textContent = count(st.tracks + st.albums, ["оценка", "оценки", "оценок"]) +
      ", " + count(ARTISTS.length, ["артист", "артиста", "артистов"]);
    const strip = byId("artist-strip");
    if (strip) {
      strip.innerHTML = C.sortArtists(ARTISTS, "count").slice(0, 12).map((a) =>
        '<li class="artist-card"><a href="' + artistHref(a.slug) + '">' + photo(a, "face") +
        '<span class="name">' + esc(a.name) + '</span><span class="sub">' + count(a.count, FORMS.review) +
        "</span></a></li>").join("");
    }

    wave();
    tops(90);
    document.querySelectorAll(".switch button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".switch button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        tops(Number(btn.dataset.scale));
      });
    });

    const allArtists = byId("all-artists");
    if (allArtists && ARTISTS.length > 12) {
      allArtists.textContent = "Ещё " + count(ARTISTS.length - 12, ["артист", "артиста", "артистов"]);
    }

    // Свежие сверху, без дат: первая запись крупно с обложкой, остальные — номер по порядку и обложка; тип — в подписи.
    byId("fresh").innerHTML = C.sortReviews(R, "new").slice(0, 8).map((r, i) => {
      const n = names(r);
      const lead = i === 0 ? cover(r, "fresh-cover")
        : '<span class="num" aria-hidden="true">' + (i + 1) + "</span>" + cover(r, "thumb");
      return '<li class="' + r.type + '"><div class="line">' + lead +
        '<span class="main"><a class="t stretch" href="' + href(r) + '">' + n.t + '</a><span class="a">' + n.a +
        '<span class="kind">, ' + kind(r) + "</span></span></span>" +
        '<span class="score">' + esc(C.formatScore(r)) + "</span></div></li>";
    }).join("");

    const meta = byId("foot-meta");
    if (meta) {
      meta.textContent = "На " + C.formatDate(DATA.generated_at) + " в канале " + count(DATA.posts_total, FORMS.post) +
        ", каталог собран из них автоматически. Исполнитель и название определены по соседним постам " +
        "с песнями; где их найти не удалось, стоит пометка «не распознано».";
    }
  }

  function tops(scale) {
    renderTop(byId("top-tracks"), C.topReviews(R, { type: "track", scale: scale, limit: 10 }));
    renderTop(byId("top-albums"), C.topReviews(R, { type: "album", scale: scale, limit: 8 }));
  }

  function renderTop(ol, list) {
    ol.innerHTML = list.length ? list.map((r, i) => {
      const n = names(r);
      return '<li><div class="line"><span class="rank">' + (i + 1) + "</span>" +
        '<span class="main"><a class="t stretch" href="' + href(r) + '">' + n.t + '</a><span class="a">' + n.a + "</span></span>" +
        '<span class="score">' + esc(C.formatScore(r)) + "</span></div></li>";
    }).join("") : '<li class="empty">В этой шкале пока нет разборов с распознанным названием.</li>';
  }

  /* «Звуковая дорожка» канала: полоса на каждый день с разборами. */
  function wave() {
    const fig = byId("wave");
    const tip = byId("wave-tip");
    const days = C.dailyWave(R);
    if (!days.length) return;
    const step = 6;
    const H = 120;
    const floor = 3; // шкала от 3 до 11: средние в основном 7–9, так разница заметнее
    const ceiling = 11;
    const y = (v) => H - Math.max(3, ((Math.min(v, ceiling) - floor) / (ceiling - floor)) * H);
    const W = days.length * step;
    const bars = days.map((d, i) => {
      const top = y(d.avg);
      return '<rect class="bar" data-i="' + i + '" x="' + i * step + '" y="' + top.toFixed(1) +
        '" width="4" height="' + (H - top).toFixed(1) + '" style="--i:' + i + '"></rect>';
    }).join("");
    fig.insertAdjacentHTML("afterbegin",
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' +
      esc("Средняя оценка по дням: " + count(days.length, ["день", "дня", "дней"]) + " с разборами") + '">' +
      '<line class="guide" x1="0" x2="' + W + '" y1="' + y(10) + '" y2="' + y(10) + '"></line>' +
      '<line class="base" x1="0" x2="' + W + '" y1="' + H + '" y2="' + H + '"></line>' + bars + "</svg>");
    byId("wave-range").textContent = C.formatDate(days[0].date) + " — " +
      C.formatDate(days[days.length - 1].date) + "; шкала от 3 до 11, пунктир — 10 из 10";

    const svg = fig.querySelector("svg");
    let hot = null;
    const indexAt = (clientX) => {
      const box = svg.getBoundingClientRect();
      return Math.max(0, Math.min(days.length - 1, Math.floor(((clientX - box.left) / box.width) * days.length)));
    };
    svg.addEventListener("mousemove", (e) => {
      const i = indexAt(e.clientX);
      const d = days[i];
      if (hot) hot.classList.remove("is-hot");
      hot = svg.querySelector('rect[data-i="' + i + '"]');
      if (hot) hot.classList.add("is-hot");
      const b = d.best;
      const n = names(b);
      tip.innerHTML = "<b>" + esc(C.formatDate(d.date)) + "</b>: " + count(d.count, FORMS.review) +
        ", в среднем " + esc(C.formatNumber(d.avg)) + " из 10<br>Лучший: " + n.plainA + " — " + n.t +
        " (" + esc(C.formatScore(b)) + ")";
      const box = fig.getBoundingClientRect();
      const x = Math.min(Math.max(0, e.clientX - box.left - tip.offsetWidth / 2), box.width - tip.offsetWidth);
      tip.style.transform = "translate(" + x + "px, calc(-100% - 8px))";
      tip.classList.add("is-on");
      svg.style.cursor = "pointer";
    });
    svg.addEventListener("mouseleave", () => {
      tip.classList.remove("is-on");
      if (hot) hot.classList.remove("is-hot");
    });
    svg.addEventListener("click", (e) => {
      location.href = "catalog.html?date=" + days[indexAt(e.clientX)].date;
    });
  }

  /* ------------------------------------------------------------ каталог */

  function catalog() {
    const p = new URLSearchParams(location.search);
    const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
    const state = {
      q: p.get("q") || "",
      type: pick(p.get("type"), ["all", "track", "album"], "all"),
      sort: pick(p.get("sort"), ["new", "old", "score", "score-asc"], "score"),
      date: /^\d{4}-\d{2}-\d{2}$/.test(p.get("date") || "") ? p.get("date") : "",
      scale: pick(p.get("scale"), ["90", "10", "all"], p.get("date") ? "all" : "90"),
      artist: ARTIST.has(p.get("artist")) ? p.get("artist") : "",
      shown: PAGE_SIZE,
    };
    const artistSel = byId("artist");
    artistSel.insertAdjacentHTML("beforeend", C.sortArtists(ARTISTS, "name").map((a) =>
      '<option value="' + esc(a.slug) + '">' + esc(a.name) + " (" + a.count + ")</option>").join(""));
    artistSel.value = state.artist;
    artistSel.addEventListener("change", () => { state.artist = artistSel.value; apply(); });
    const q = byId("q");
    const sort = byId("sort");
    const rows = byId("rows");
    const more = byId("more");
    const line = byId("result-line");
    q.value = state.q;
    sort.value = state.sort;
    const radio = document.querySelector('input[name="type"][value="' + state.type + '"]');
    if (radio) radio.checked = true;
    const scaleRadio = document.querySelector('input[name="scale"][value="' + state.scale + '"]');
    if (scaleRadio) scaleRadio.checked = true;

    function syncUrl() {
      const out = new URLSearchParams();
      if (state.q) out.set("q", state.q);
      if (state.type !== "all") out.set("type", state.type);
      if (state.scale !== "90") out.set("scale", state.scale);
      if (state.sort !== "score") out.set("sort", state.sort);
      if (state.date) out.set("date", state.date);
      if (state.artist) out.set("artist", state.artist);
      const qs = out.toString();
      history.replaceState(null, "", qs ? "?" + qs : location.pathname);
    }

    function apply(reset) {
      if (reset !== false) state.shown = PAGE_SIZE;
      const list = C.sortReviews(C.filterReviews(R, state), state.sort);
      const n = list.length;
      let text = n ? "Найдено " + count(n, FORMS.review)
        : '<span class="hand">Ничего не нашлось. Попробуйте короче: без feat. и скобок.</span>';
      if (state.date) text += " за " + esc(C.formatDate(state.date)) +
        ' <button type="button" id="clear-date">показать все дни</button>';
      line.innerHTML = text;
      rows.innerHTML = list.slice(0, state.shown).map(row).join("");
      more.hidden = state.shown >= n;
      if (!more.hidden) more.textContent = "Показать ещё " + Math.min(PAGE_SIZE, n - state.shown);
      const clear = byId("clear-date");
      if (clear) clear.addEventListener("click", () => { state.date = ""; apply(); });
      syncUrl();
    }

    let timer = 0;
    q.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = q.value.trim(); apply(); }, 150);
    });
    byId("type").addEventListener("change", (e) => { state.type = e.target.value; apply(); });
    byId("scale").addEventListener("change", (e) => { state.scale = e.target.value; apply(); });
    sort.addEventListener("change", () => { state.sort = sort.value; apply(); });
    more.addEventListener("click", () => { state.shown += PAGE_SIZE; apply(false); });
    apply();
  }

  function row(r) {
    const n = names(r);
    return '<li class="row ' + r.type + '"><div class="line">' + cover(r, "thumb") +
      '<span class="main"><a class="t stretch" href="' + href(r) + '">' + n.t + '</a><span class="a">' + n.a + "</span></span>" +
      '<span class="meta"><span class="tag ' + r.type + '">' + kind(r) + "</span>" + eq(r) + "</span>" +
      '<span class="score">' + esc(C.formatScore(r)) + "</span></div></li>";
  }

  /* ------------------------------------------------------- карточка разбора */

  function review() {
    const box = byId("review");
    const id = Number(new URLSearchParams(location.search).get("id"));
    const found = C.findReview(R, id);
    if (!found) {
      box.innerHTML = '<div class="error-box"><h1 class="page-title">Разбор не найден</h1>' +
        '<p>В каталоге нет разбора с таким номером. Откройте <a href="catalog.html">каталог</a> и выберите разбор из списка.</p></div>';
      return;
    }
    const r = found.review;
    // Открыли старую оценку из истории: показываем актуальный разбор, адрес — на него.
    if (found.old) history.replaceState(null, "", "?id=" + r.id);
    if (r.type === "album") document.body.classList.add("album-page");
    const n = names(r);
    const plainTitle = titleOf(r) == null ? "Название не распознано" : titleOf(r);
    document.title = plainTitle + (r.artist !== UNKNOWN ? " — " + r.artist : "") + " | Лирический склад";

    const kicker = '<span class="tag ' + r.type + '">' + kind(r) + "</span>" +
      '<span>разбор от <time datetime="' + esc(r.date) + '">' + esc(C.formatDate(r.date)) + "</time></span>" +
      (r.reviewer ? "<span>подпись: " + esc(r.reviewer) + "</span>" : "");

    const notes = [];
    if (found.old) {
      notes.push("<p>Вы открыли прежнюю оценку от " + esc(C.formatDate(found.old.date)) + " (" +
        esc(C.formatScore(found.old)) + "). Здесь — последний разбор этого трека.</p>");
    }
    if (r.max === 90) {
      notes.push('<p>По <a href="' + esc(DATA.conversion_table.post) + '" target="_blank" rel="noopener">таблице перевода</a> автора это ' +
        esc(C.formatNumber(r.score10)) + " из 10.</p>");
    }
    if (r.total_source === "sum") notes.push("<p>Итога в посте нет, это сумма баллов по пунктам.</p>");
    if (r.items_sum != null && r.items.every((i) => i.score != null)) {
      notes.push("<p>Сумма баллов по пунктам — " + r.items_sum + ", а в посте итог " + esc(C.formatNumber(r.total)) + ".</p>");
    }
    if (r.correction) {
      notes.push("<p>Оценку поправили следующим постом: было " + esc(C.formatNumber(r.correction.from)) +
        ", стало " + esc(C.formatNumber(r.correction.to)) + '. <a href="' + esc(r.correction.url) +
        '" target="_blank" rel="noopener">Поправка</a>: «' + esc(r.correction.text) + "»</p>");
    }

    // Кольца под общей оценкой: по кольцу на пункт (у оценки из 10 — одно). Каждое кольцо — кнопка:
    // по нажатию под кольцами появляется название пункта, балл и комментарий автора.
    const crits = r.items && r.items.length
      ? r.items.map((it) => ({ name: it.name, score: it.score, max: it.max || (r.max === 90 ? 15 : 10), text: it.text || "" }))
      : [{ name: "Оценка", score: r.total, max: r.max, text: r.comment || r.quote || "" }];
    const rings = '<div class="eq eq-live' + (r.type === "album" ? " eq-album" : "") + (crits.length === 1 ? " eq-single" : "") +
      '" role="group" aria-label="Пункты оценки — нажмите на кружок">' + crits.map((c, i) => {
        const has = c.score != null;
        const h = has ? Math.round(Math.min(c.score / c.max, 1) * 100) : 0;
        const val = has ? C.formatNumber(c.score) + " из " + c.max : "без оценки";
        return '<button type="button" class="ring" data-i="' + i + '" aria-expanded="false" aria-controls="ring-panel" ' +
          'aria-label="' + esc(c.name) + ": " + esc(val) + '. Показать комментарий" title="' + esc(c.name) + " — " + esc(val) + '">' +
          '<i style="--h:' + h + '%"></i></button>';
      }).join("") + "</div>" +
      '<p class="ring-hint hand">' + (crits.length > 1 ? "жми на кружки — листай пункты" : "нажми на кружок") + "</p>";
    // Панель комментария открыта сразу (первый пункт) — кольца переключают текст; на десктопе стоит справа.
    const ringPanel = '<div class="ring-panel" id="ring-panel" role="region" aria-live="polite">' +
      '<p class="ring-step"></p><p class="ring-head"><b class="ring-name"></b> <span class="ring-val"></span></p>' +
      '<p class="ring-text"></p></div>';

    // «Рядом по оценке»: та же шкала, ближайшие баллы — чтобы низ карточки не пустовал и было куда идти дальше.
    const hidden = new Set([r.id].concat((r.history || []).map((h) => h.id)));
    const near = R.filter((x) => !hidden.has(x.id) && x.max === r.max && x.title !== UNKNOWN)
      .map((x) => ({ x, d: Math.abs(x.total - r.total) }))
      .sort((a, b) => a.d - b.d || (a.x.datetime < b.x.datetime ? 1 : -1)).slice(0, 6).map((o) => o.x);
    const nearBlock = near.length ? '<section class="section near" aria-label="Рядом по оценке"><h2>Рядом по оценке</h2>' +
      '<ul class="near-grid">' + near.map((x) => {
        const nx = names(x);
        return '<li class="' + x.type + '"><a href="' + href(x) + '">' + cover(x, "near-cover") +
          '<span class="t">' + nx.t + '</span><span class="a">' + nx.plainA + "</span>" +
          '<span class="score">' + esc(C.formatScore(x)) + "</span></a></li>";
      }).join("") + "</ul></section>" : "";
    let main = r.quote ? '<blockquote class="quote">' + esc(r.quote) + "</blockquote>" : "";
    if (!(r.items && r.items.length)) {
      main = r.comment ? '<p class="comment">' + esc(r.comment) + "</p>"
        : '<p class="comment unk">В посте только оценка, без текста.</p>';
    }

    // Верх боковой колонки (на телефоне — сразу под оценкой): цитата, пометки, кнопки.
    const sideTop = [];
    const derived = r.title === UNKNOWN && titleOf(r);
    if (derived) {
      const info = MEDIA.album_titles[String(r.id)];
      sideTop.push('<p class="note">Названия нет в постах. «' + esc(derived) + "» — общий альбом у " + info.from +
        " из " + info.tracks + " треков, разобранных в эту сессию (по данным Apple Music, Deezer и Яндекс Музыки).</p>");
    } else if (r.unrecognized.length) {
      const what = r.unrecognized.length === 2 ? "Исполнителя и название" : r.unrecognized[0] === "artist" ? "Исполнителя" : "Название";
      sideTop.push('<p class="note">' + what + " не удалось определить по соседним постам. " +
        "Откройте пост в Telegram — там видно, о какой песне речь.</p>");
    } else if (r.subject_source === "series") {
      sideTop.push('<p class="note">Исполнитель альбома определён по трекам, которые разбирали перед этим итогом' +
        (r.title !== UNKNOWN ? ", название — по посту-анонсу разбора." : ".") + "</p>");
    }
    sideTop.push('<p class="actions"><a class="btn primary" href="' + esc(r.url) +
      '" target="_blank" rel="noopener">Читать в Telegram</a>' +
      (r.audio_url ? '<a class="btn" href="' + esc(r.audio_url) + '" target="_blank" rel="noopener">Трек в Telegram</a>' : "") +
      "</p>");
    // Прежние оценки того же трека (от новой к старой) — сам разбор выше всегда последний.
    if (r.history && r.history.length) {
      sideTop.push('<div class="history"><h2>Ранее оценивался</h2><ul class="mini">' + r.history.map((h) =>
        '<li><a href="' + esc(h.url) + '" target="_blank" rel="noopener"><span class="t">' +
        esc(C.formatDate(h.date)) + '<span class="sub">пост в Telegram</span></span>' +
        '<span class="score">' + esc(C.formatScore(h)) + "</span></a></li>").join("") + "</ul></div>");
    }

    // Низ: сравнения и другие разборы того же исполнителя.
    const sideBottom = [];
    if (r.comparisons && r.comparisons.length) {
      sideBottom.push("<div><h2>Сравнения с другими оценками</h2><ul class=\"compare\">" + r.comparisons.map((c) =>
        "<li>" + esc(c.text) + ' <a href="' + esc(c.url) + '" target="_blank" rel="noopener">пост</a></li>').join("") +
        "</ul></div>");
    }
    const artistKey = (r.key || "").split("|")[1];
    if (r.artist !== UNKNOWN && artistKey) {
      const others = C.sortReviews(R.filter((x) => x.id !== r.id && (x.key || "").split("|")[1] === artistKey), "new").slice(0, 8);
      if (others.length) {
        sideBottom.push("<div><h2>Ещё разборы: " + esc(r.artist) + '</h2><ul class="mini">' + others.map((x) =>
          '<li><a href="' + href(x) + '"><span class="t">' + names(x).t + '<span class="sub">' + kind(x) +
          '</span></span><span class="score">' + esc(C.formatScore(x)) + "</span></a></li>").join("") +
          "</ul></div>");
      }
    }

    box.innerHTML =
      '<nav class="crumbs" aria-label="Навигация"><a href="catalog.html">Каталог разборов</a></nav>' +
      '<article><header class="review-head"><p class="kicker">' + kicker + "</p>" +
      '<h1 class="review-title">' + (titleOf(r) == null ? '<span class="unk">Название не распознано</span>' : esc(titleOf(r))) + "</h1>" +
      '<p class="review-artist">' + n.a + "</p>" +
      (C.releaseLine(MEDIA.covers[String(r.id)], r.type)
        ? '<p class="release">' + esc(C.releaseLine(MEDIA.covers[String(r.id)], r.type)) + "</p>" : "") +
      "</header>" +
      '<section class="scorebox" aria-label="Оценка"><div class="score-left"><figure class="cover-box">' + cover(r, "card-cover") +
      (MEDIA.covers[String(r.id)] && MEDIA.covers[String(r.id)].album && r.type === "track"
        ? "<figcaption>" + esc(MEDIA.covers[String(r.id)].kind || "альбом") + " «" +
          esc(MEDIA.covers[String(r.id)].album) + "»</figcaption>" : "") + "</figure>" +
      '<div class="total">' + esc(C.formatNumber(r.total)) +
      "<small>/" + r.max + "</small></div>" + '<div class="rings-box">' + rings + "</div>" +
      '<div class="score-notes">' + notes.join("") + "</div></div>" + ringPanel + "</section>" +
      '<div class="review-body' + (r.items && r.items.length ? "" : " no-items") + '"><div class="review-main">' + main + nearBlock + "</div>" +
      '<div class="side side-top">' + sideTop.join("") + "</div>" +
      (sideBottom.length ? '<aside class="side side-bottom">' + sideBottom.join("") + "</aside>" : "") +
      "</div></article>";

    const panel = byId("ring-panel");
    const ringBtns = box.querySelectorAll(".eq-live .ring");
    function showCrit(i) {
      ringBtns.forEach((b, k) => { b.classList.toggle("picked", k === i); b.setAttribute("aria-expanded", String(k === i)); });
      const c = crits[i];
      panel.querySelector(".ring-step").textContent = crits.length > 1 ? "пункт " + (i + 1) + " из " + crits.length : "оценка";
      panel.querySelector(".ring-name").textContent = c.name;
      panel.querySelector(".ring-val").textContent = c.score != null ? C.formatNumber(c.score) + "/" + c.max : "без оценки";
      panel.querySelector(".ring-text").textContent = c.text || "Комментария к этому пункту в посте нет.";
      panel.classList.remove("pop"); void panel.offsetWidth; panel.classList.add("pop");
    }
    ringBtns.forEach((btn) => btn.addEventListener("click", () => showCrit(Number(btn.dataset.i))));
    if (ringBtns.length) showCrit(0);
  }

  /* ------------------------------------------------------------ артисты */

  function avgText(a) {
    return a.avg10 == null ? "" : "в среднем " + C.formatNumber(a.avg10) + " из 10";
  }

  function artistsPage() {
    const p = new URLSearchParams(location.search);
    const q = byId("aq");
    const sort = byId("asort");
    const grid = byId("agrid");
    const more = byId("amore");
    const state = { q: p.get("q") || "", sort: ["count", "score", "name"].includes(p.get("sort")) ? p.get("sort") : "count", shown: 48 };
    q.value = state.q;
    sort.value = state.sort;

    function apply(reset) {
      if (reset !== false) state.shown = 48;
      const list = C.sortArtists(C.filterArtists(ARTISTS, state.q), state.sort);
      byId("aline").textContent = list.length ? "Артистов: " + list.length.toLocaleString("ru-RU")
        : "Таких артистов нет. Проверьте написание.";
      grid.innerHTML = list.slice(0, state.shown).map((a) =>
        '<li class="artist-card"><a href="' + artistHref(a.slug) + '">' + photo(a, "face") +
        '<span class="name">' + esc(a.name) + "</span>" +
        '<span class="sub">' + count(a.count, FORMS.review) + "</span>" +
        '<span class="sub">' + esc(avgText(a)) + "</span></a></li>").join("");
      more.hidden = state.shown >= list.length;
      const out = new URLSearchParams();
      if (state.q) out.set("q", state.q);
      if (state.sort !== "count") out.set("sort", state.sort);
      history.replaceState(null, "", out.toString() ? "?" + out : location.pathname);
    }

    let timer = 0;
    q.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = q.value.trim(); apply(); }, 150);
    });
    sort.addEventListener("change", () => { state.sort = sort.value; apply(); });
    more.addEventListener("click", () => { state.shown += 48; apply(false); });
    apply();
  }

  function artistPage() {
    const box = byId("artist");
    const a = ARTIST.get(new URLSearchParams(location.search).get("slug"));
    if (!a) {
      box.innerHTML = '<div class="error-box"><h1 class="page-title">Артист не найден</h1>' +
        '<p>Такого артиста нет в каталоге. Откройте <a href="artists.html">список артистов</a>.</p></div>';
      return;
    }
    document.title = a.name + " | Лирический склад";
    const list = C.sortReviews(R.filter((r) => (r.artists || []).includes(a.slug)), "new");
    const section = (title, items) => (items.length ? '<section class="section-lite"><h2>' + title + "</h2>" +
      '<ul class="releases">' + items.map((r) => {
        const c = MEDIA.covers[String(r.id)];
        const album = c && c.album && r.type === "track" ? '<span class="sub">' + esc(c.kind || "альбом") + " «" + esc(c.album) + "»</span>" : "";
        const feat = r.artists.length > 1 ? '<span class="sub">' + artistLinks(r) + "</span>" : "";
        return '<li class="' + r.type + '"><div class="line">' + cover(r, "rel") +
          '<span class="main"><a class="t stretch" href="' + href(r) + '">' + names(r).t + "</a>" + feat + album + "</span>" +
          '<span class="score">' + esc(C.formatScore(r)) + "</span></div></li>";
      }).join("") + "</ul></section>" : "");
    box.innerHTML =
      '<nav class="crumbs" aria-label="Навигация"><a href="artists.html">Все артисты</a></nav>' +
      '<header class="artist-head">' + photo(a, "hero-face") + "<div>" +
      '<h1 class="review-title">' + esc(a.name) + "</h1>" +
      '<p class="kicker"><span>' + count(a.count, FORMS.review) + "</span><span>" + esc(avgText(a)) + "</span>" +
      '<a href="catalog.html?artist=' + encodeURIComponent(a.slug) + '">в каталоге</a></p>' +
      (a.variants.length > 1 ? '<p class="score-notes">Написания в постах: ' + a.variants.map(esc).join(", ") + "</p>" : "") +
      "</div></header>" +
      section("Альбомы", list.filter((r) => r.type === "album")) +
      section("Треки", list.filter((r) => r.type === "track"));
  }

  const page = document.body.dataset.page;
  if (page === "home") home();
  else if (page === "catalog") catalog();
  else if (page === "review") review();
  else if (page === "artists") artistsPage();
  else if (page === "artist") artistPage();
})();
