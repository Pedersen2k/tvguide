(function () {
  'use strict';
  var TZ = 'Europe/Oslo';
  var app = document.getElementById('app');
  var guide = window.GUIDE || null;
  var lastKey = '';
  var slotChoice = null;

  /* ---------- tid ---------- */
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function parts(sec) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(sec * 1000)).forEach(function (x) { p[x.type] = parseInt(x.value, 10); });
    return p;
  }
  // Sekunder for et klokkeslett (Oslo-tid) på samme dato som `sec`.
  function osloAt(sec, hh, mm) {
    var p = parts(sec);
    var guess = Date.UTC(p.year, p.month - 1, p.day, hh, mm) / 1000;
    var g = parts(guess), back = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute) / 1000;
    return guess - (back - guess);
  }
  function hhmm(sec) {
    var p = parts(sec);
    return pad(p.hour) + '.' + pad(p.minute);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateText(sec) {
    return new Date(sec * 1000).toLocaleDateString('nb-NO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- data ---------- */
  function at(ch, t) {
    var l = ch.programs;
    for (var i = 0; i < l.length; i++) if (l[i][0] <= t && t < l[i][1]) return { p: l[i], next: l[i + 1] || null };
    return null;
  }
  function findChannel(id) {
    return guide.channels.filter(function (c) { return c.id === id; })[0] || guide.channels[0];
  }

  /* ---------- visninger ---------- */
  function topbar(t) {
    return '<div class="top"><div class="clock">' + hhmm(t) + '</div><div class="date">' + esc(dateText(t)) + '</div></div>';
  }
  function rowHtml(ch, hit, opts) {
    var tag = ch.demo ? '<em>eksempel</em>' : '';
    var head = '<div class="ch">' + esc(ch.name) + tag + '</div>';
    if (!hit) {
      return '<a class="row empty" style="--c:' + ch.color + '" href="#kanal-' + ch.id + '" role="button">' + head +
        '<div class="now">Programoversikten er ikke tilgjengelig akkurat nå</div></a>';
    }
    var p = hit.p, h = head + '<div class="now">' + esc(p[2]) + '</div><div class="t">' + hhmm(p[0]) + ' – ' + hhmm(p[1]) + '</div>';
    if (opts.progress) {
      var pct = Math.max(2, Math.min(100, Math.round((opts.t - p[0]) / (p[1] - p[0]) * 100)));
      h += '<div class="bar" role="img" aria-label="' + pct + ' prosent ferdig"><i style="width:' + pct + '%"></i></div>';
    }
    if (opts.next && hit.next) h += '<div class="next"><b>' + hhmm(hit.next[0]) + '</b> ' + esc(hit.next[2]) + '</div>';
    return '<a class="row" style="--c:' + ch.color + '" href="#kanal-' + ch.id + '" role="button">' + h + '</a>';
  }
  function demoNote() {
    return guide.channels.some(function (c) { return c.demo; }) ? '<p class="note">Kanaler merket «eksempel» viser oppdiktede programmer.</p>' : '';
  }

  function viewHome(t) {
    var rows = guide.channels.map(function (c) {
      return rowHtml(c, at(c, t), { progress: true, next: true, t: t });
    }).join('');
    return topbar(t) +
      '<div class="head">Nå på tv</div>' +
      '<div class="rows">' + rows + '</div>' +
      '<div class="actions">' +
      '<a class="btn solid" href="#tid" role="button" style="text-align:center;display:block">Se senere i kveld</a></div>' + demoNote();
  }

  function viewTime(t) {
    var slots = [['na', 'Nå'], ['19.00', '19.00'], ['20.00', '20.00'], ['21.00', '21.00'], ['22.00', '22.00'], ['23.00', '23.00']];
    var choice = slotChoice || (parts(t).hour < 20 ? '20.00' : 'na');
    var target = choice === 'na' ? t : osloAt(t, parseInt(choice, 10), 0);
    var chips = slots.map(function (s) {
      return '<button type="button" data-slot="' + s[0] + '" aria-pressed="' + (s[0] === choice) + '">' + s[1] + '</button>';
    }).join('');
    var rows = guide.channels.map(function (c) { return rowHtml(c, at(c, target), {}); }).join('');
    return '<a class="back" href="#hjem" role="button">‹ Tilbake</a>' + topbar(t) +
      '<div class="chips" id="chips" role="group" aria-label="Velg klokkeslett">' + chips + '</div>' +
      '<div class="head">' + (choice === 'na' ? 'Nå, kl. ' + hhmm(t) : 'Kl. ' + choice) + '</div>' +
      '<div class="rows">' + rows + '</div>' + demoNote();
  }

  function viewChannel(t, id) {
    var ch = findChannel(id);
    var from = osloAt(t, 18, 0), main = osloAt(t, 20, 0);
    if (parts(t).hour < 5) { from -= 86400; main -= 86400; }
    var list = ch.programs.filter(function (p) { return p[1] > from && p[0] < from + 7 * 3600; });
    var tabs = guide.channels.map(function (c) {
      return '<button type="button" data-ch="' + c.id + '" style="--c:' + c.color + '" aria-pressed="' + (c.id === ch.id) + '">' + esc(c.name) + '</button>';
    }).join('');
    var body = list.length ? list.map(function (p) {
      var cls = 'ev' + (p[0] <= main && main < p[1] ? ' main' : '') + (p[0] <= t && t < p[1] ? ' on' : '');
      var tag = (p[0] <= t && t < p[1]) ? '<small>Går nå</small>' : '';
      return '<div class="' + cls + '"><b>' + hhmm(p[0]) + '</b><span>' + esc(p[2]) + tag + '</span></div>';
    }).join('') : '<div class="ev"><span>Programoversikten for denne kanalen er ikke tilgjengelig akkurat nå.</span></div>';
    return '<a class="back" href="#hjem" role="button">‹ Tilbake</a>' + topbar(t) +
      '<div class="tabs" id="tabs" role="group" aria-label="Velg kanal">' + tabs + '</div>' +
      '<div class="head">I kveld på ' + esc(ch.name) + '</div><div class="eve">' + body + '</div>' + demoNote();
  }

  /* ---------- ruting og tegning ---------- */
  function render(force) {
    if (!guide) return;
    var t = nowSec(), h = location.hash.replace('#', '') || 'hjem';
    var key = h + '|' + hhmm(t) + '|' + slotChoice + '|' + guide.updated;
    if (!force && key === lastKey) return;
    lastKey = key;
    var html;
    if (h === 'tid') html = viewTime(t);
    else if (h.indexOf('kanal-') === 0) html = viewChannel(t, h.slice(6));
    else html = viewHome(t);
    app.innerHTML = html;
  }

  app.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-slot]');
    if (chip) { slotChoice = chip.dataset.slot; render(true); return; }
    var tab = e.target.closest('[data-ch]');
    if (tab) { location.hash = 'kanal-' + tab.dataset.ch; }
  });
  window.addEventListener('hashchange', function () { render(true); window.scrollTo(0, 0); });

  /* ---------- tekststørrelse ---------- */
  function setSize(s) {
    document.documentElement.dataset.size = s;
    document.querySelectorAll('.sizes button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === String(s))); });
    try { localStorage.setItem('tvguide-size', s); } catch (e) {}
  }
  var saved = '2';
  try { saved = localStorage.getItem('tvguide-size') || '2'; } catch (e) {}
  setSize(saved);
  document.querySelector('.sizes').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (b) setSize(b.dataset.size);
  });

  /* ---------- last data ---------- */
  function load() {
    if (window.GUIDE) { guide = window.GUIDE; render(true); return; }
    fetch('data/guide.json?v=' + Math.floor(Date.now() / 600000), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (g) { guide = g; render(true); })
      .catch(function () {
        if (!guide) app.innerHTML = '<div class="top"><div class="clock">Tv-guide</div></div><p>Fikk ikke hentet programmene. Sjekk nettforbindelsen og prøv igjen om litt.</p>';
      });
  }
  load();
  setInterval(function () { render(false); }, 15000);
  setInterval(load, 30 * 60 * 1000);
})();
