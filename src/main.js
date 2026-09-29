/* Archway restaurant — drobné skripty bez knihoven (nativní scroll, žádné nekonečné smyčky) */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');

  /* ——— navigace ——— */
  var nav = d.querySelector('[data-nav]');
  var onScroll = function () { nav && nav.classList.toggle('is-scrolled', window.scrollY > 24); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var toggle = d.querySelector('[data-nav-toggle]'), drawer = d.querySelector('[data-drawer]');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
    drawer.hidden = !open;
    d.body.classList.toggle('menu-open', open);
  }
  if (toggle && drawer) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ——— čas v Praze + otevírací doba z _data/site.json ——— */
  function pragueNow() {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { iso: o.year + '-' + o.month + '-' + o.day, dow: wd, min: (+o.hour) * 60 + (+o.minute) };
  }
  var toMin = function (t) { var a = t.split(':'); return (+a[0]) * 60 + (+a[1]); };
  var now = pragueNow();
  var H = {};
  try { H = JSON.parse(d.getElementById('hours-data').textContent); } catch (e) { H = { hours: [], exceptions: [] }; }

  function rangeFor(iso, dow) {
    var ex = (H.exceptions || []).filter(function (x) { return x.date === iso; })[0];
    if (ex) return ex.closed ? null : { from: ex.from, to: ex.to, note: ex.note };
    var r = (H.hours || []).filter(function (x) { return x.days.indexOf(dow) > -1; })[0];
    return r ? { from: r.from, to: r.to } : null;
  }
  function status() {
    var today = rangeFor(now.iso, now.dow);
    if (today) {
      var f = toMin(today.from), t = toMin(today.to);
      if (now.min >= f && now.min < t) return { open: true, text: 'Právě otevřeno · do ' + today.to };
      if (now.min < f) return { open: false, text: 'Dnes otevíráme v ' + today.from };
    }
    // po půlnoci: pátek/sobota do 24:00 → zavřeno; hledáme další otevření
    for (var i = 1; i <= 7; i++) {
      var dt = new Date(Date.UTC(+now.iso.slice(0, 4), +now.iso.slice(5, 7) - 1, +now.iso.slice(8, 10) + i));
      var iso = dt.toISOString().slice(0, 10), r = rangeFor(iso, dt.getUTCDay());
      if (r) return { open: false, text: 'Zavřeno · otevíráme ' + (i === 1 ? 'zítra' : ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'][dt.getUTCDay()]) + ' v ' + r.from };
    }
    return { open: false, text: 'Zavřeno' };
  }
  var st = status();
  d.querySelectorAll('[data-open-status]').forEach(function (el) {
    el.textContent = st.text;
    el.classList.toggle('is-open', st.open);
    var fig = el.closest('.hero__status'); if (fig) fig.classList.toggle('is-open', st.open);
  });
  d.querySelectorAll('[data-hours] [data-days]').forEach(function (row) {
    if (row.getAttribute('data-days').split(',').indexOf(String(now.dow)) > -1) row.classList.add('is-today');
  });

  /* ——— polední menu: dnešní den ——— */
  d.querySelectorAll('.lday[data-day="' + now.iso + '"]').forEach(function (el) { el.classList.add('is-today'); });
  var tabs = d.querySelectorAll('[data-tab]');
  function showDay(iso) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === iso)); });
    d.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== iso; });
  }
  if (tabs.length) {
    tabs.forEach(function (t) {
      if (t.getAttribute('data-tab') === now.iso) t.classList.add('is-today');
      t.addEventListener('click', function () { showDay(t.getAttribute('data-tab')); });
    });
    var has = d.querySelector('[data-tab="' + now.iso + '"]');
    if (has) showDay(now.iso);
    else {
      // mimo týden nabídky → ukážeme nejbližší další den, jinak první
      var next = Array.prototype.filter.call(tabs, function (t) { return t.getAttribute('data-tab') > now.iso; })[0];
      showDay((next || tabs[0]).getAttribute('data-tab'));
    }
  }

  /* ——— reveal ——— */
  var rv = d.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  /* ——— náhled fotky u jídelního lístku (jen myš) ——— */
  var prev = d.querySelector('[data-preview-el]');
  if (prev && window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches) {
    var pimg = prev.querySelector('img'), x = 0, y = 0, raf = 0;
    var move = function () { raf = 0; prev.style.transform = 'translate3d(' + (x + 40) + 'px,' + (y - 170) + 'px,0) scale(' + (prev.classList.contains('is-on') ? 1 : .85) + ')'; };
    d.querySelectorAll('[data-preview]').forEach(function (a) {
      a.addEventListener('mouseenter', function () { pimg.src = a.getAttribute('data-preview'); prev.classList.add('is-on'); });
      a.addEventListener('mouseleave', function () { prev.classList.remove('is-on'); if (!raf) raf = requestAnimationFrame(move); });
      a.addEventListener('mousemove', function (e) { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(move); });
    });
  }

  /* ——— jídelní lístek: CZ / EN + aktivní kategorie ——— */
  var langBtns = d.querySelectorAll('[data-lang]');
  function setLang(l) {
    root.setAttribute('data-lang', l);
    langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l)); });
    try { localStorage.setItem('archway-lang', l); } catch (e) {}
  }
  if (langBtns.length) {
    var q = new URLSearchParams(location.search).get('lang'), saved = null;
    try { saved = localStorage.getItem('archway-lang'); } catch (e) {}
    setLang(q === 'en' || q === 'cs' ? q : (saved || 'cs'));
    langBtns.forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
  }
  var cats = d.querySelectorAll('[data-cat]');
  if (cats.length && 'IntersectionObserver' in window) {
    var links = d.querySelectorAll('[data-cat-link]');
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.getAttribute('data-cat');
        links.forEach(function (l) {
          var on = l.getAttribute('data-cat-link') === id;
          l.classList.toggle('is-active', on);
          if (on && l.parentNode.scrollTo) l.parentNode.scrollTo({ left: l.offsetLeft - 16, behavior: 'smooth' });
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    cats.forEach(function (c) { co.observe(c); });
  }

  /* ——— ukázkové formuláře (návrh — nic neodesílají) ——— */
  d.querySelectorAll('[data-demo-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = f.querySelector('.form__ok');
      if (ok) { ok.hidden = false; ok.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
  });
  var dateIn = d.querySelectorAll('input[type="date"]');
  dateIn.forEach(function (i) { i.min = now.iso; });

  /* ——— lightbox galerie ——— */
  var lb = d.querySelector('[data-lb]'), items = d.querySelectorAll('[data-lightbox] a');
  if (lb && items.length && lb.showModal) {
    var cur = 0, limg = lb.querySelector('img'), cap = lb.querySelector('.lightbox__cap');
    var show = function (i) {
      cur = (i + items.length) % items.length;
      limg.src = items[cur].getAttribute('href');
      limg.alt = items[cur].getAttribute('data-alt') || '';
      cap.textContent = limg.alt;
    };
    items.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); show(i); lb.showModal(); }); });
    lb.querySelector('[data-lb-prev]').addEventListener('click', function () { show(cur - 1); });
    lb.querySelector('[data-lb-next]').addEventListener('click', function () { show(cur + 1); });
    lb.querySelector('[data-lb-close]').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
    var sx = 0;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); });
  }
})();
