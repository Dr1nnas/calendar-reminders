/* Calendar & Reminders: vanilla JS, data in localStorage */
window.whenUnlocked(() => {
  'use strict';

  // ---------- Storage ----------
  const KEY = 'calrem.v1';
  const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
  const defaultState = () => ({ events: [], reminders: [], fired: {}, view: 'month' });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return {
        events: Array.isArray(s.events) ? s.events : [],
        reminders: Array.isArray(s.reminders) ? s.reminders : [],
        fired: s.fired && typeof s.fired === 'object' ? s.fired : {},
        view: s.view === 'week' ? 'week' : 'month',
      };
    } catch (e) {
      console.warn('Could not read saved data', e);
      return defaultState();
    }
  }
  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save', 'Your browser storage may be full or disabled.'); }
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  // ---------- Date helpers ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }; // Monday
  const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const at = (dateStr, timeStr) => { const d = parseYmd(dateStr); const m = toMin(timeStr); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
  const nowMinutes = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const fmtTime = (t) => t || '';
  const locale = navigator.language || 'en-GB';
  const fmtDue = (d) => d.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ---------- DOM helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  // ---------- View state ----------
  let cursor = new Date();
  let view = state.view;

  const calEl = $('#calendar');
  const labelEl = $('#period-label');

  function eventsOn(dateStr) {
    return state.events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => (b.allDay - a.allDay) || toMin(a.start) - toMin(b.start) || a.title.localeCompare(b.title));
  }

  function render() {
    $('#view-month').classList.toggle('active', view === 'month');
    $('#view-week').classList.toggle('active', view === 'week');
    calEl.replaceChildren(view === 'month' ? renderMonth() : renderWeek());
    renderReminders();
  }

  function dowLabels() {
    const base = startOfWeek(new Date(2024, 0, 1));
    return Array.from({ length: 7 }, (_, i) => addDays(base, i).toLocaleDateString(locale, { weekday: 'short' }));
  }

  function chip(ev) {
    const timed = !ev.allDay;
    return h('button', {
      class: 'chip' + (timed ? ' timed' : ''),
      style: timed ? `--dot:${ev.color}` : `background:${ev.color}`,
      title: ev.title + (timed ? ` (${ev.start}–${ev.end})` : ''),
      onclick: (e) => { e.stopPropagation(); openEvent(ev); },
    }, timed ? h('span', { class: 't' }, fmtTime(ev.start)) : null, ev.title);
  }

  function renderMonth() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    labelEl.textContent = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const start = startOfWeek(first);
    const today = ymd(new Date());
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7);
    const maxChips = window.innerWidth < 600 ? 2 : 3;

    const grid = h('div', { class: 'month-grid', style: `--weeks:${weeks}` });
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i);
      const ds = ymd(d);
      const evs = eventsOn(ds);
      const cell = h('div', {
        class: 'day' + (d.getMonth() !== cursor.getMonth() ? ' other' : '') + (ds === today ? ' today' : ''),
        'data-date': ds,
        onclick: () => openEvent(null, { date: ds }),
      }, h('span', { class: 'day-num' }, d.getDate()));
      evs.slice(0, maxChips).forEach((ev) => cell.append(chip(ev)));
      if (evs.length > maxChips) {
        cell.append(h('button', {
          class: 'more chip timed', style: '--dot:transparent',
          onclick: (e) => { e.stopPropagation(); cursor = d; setView('week'); },
        }, `+${evs.length - maxChips} more`));
      }
      grid.append(cell);
    }
    return h('div', { class: 'month' },
      h('div', { class: 'dow-row' }, dowLabels().map((l) => h('div', {}, l))),
      grid);
  }

  // Place overlapping timed events side by side
  function layoutDay(evs) {
    const items = evs.map((e) => {
      const s = toMin(e.start); let en = toMin(e.end);
      if (en <= s) en = Math.min(s + 30, 24 * 60);
      return { e, s, en, lane: 0, lanes: 1 };
    }).sort((a, b) => a.s - b.s || b.en - a.en);
    let cluster = []; let clusterEnd = -1;
    const flush = () => { const n = Math.max(1, ...cluster.map((c) => c.lane + 1)); cluster.forEach((c) => (c.lanes = n)); cluster = []; };
    for (const it of items) {
      if (it.s >= clusterEnd && cluster.length) flush();
      const used = new Set(cluster.filter((c) => c.en > it.s).map((c) => c.lane));
      let lane = 0; while (used.has(lane)) lane++;
      it.lane = lane; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.en);
    }
    if (cluster.length) flush();
    return items;
  }

  function renderWeek() {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    labelEl.textContent = sameMonth
      ? `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`
      : `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const today = ymd(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const hourH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-h')) || 48;

    const head = h('div', { class: 'week-head' }, h('div'),
      days.map((d) => h('div', { class: ymd(d) === today ? 'today' : '' },
        d.toLocaleDateString(locale, { weekday: 'short' }), h('span', { class: 'wd-num' }, d.getDate()))));

    const allday = h('div', { class: 'week-allday' }, h('div', {}, 'all-day'),
      days.map((d) => {
        const ds = ymd(d);
        return h('div', { onclick: () => openEvent(null, { date: ds, allDay: true }) },
          eventsOn(ds).filter((e) => e.allDay).map(chip));
      }));

    const body = h('div', { class: 'week-body' });
    body.append(h('div', { class: 'hours' }, Array.from({ length: 24 }, (_, i) => h('div', {}, i === 0 ? '' : `${pad(i)}:00`))));
    days.forEach((d) => {
      const ds = ymd(d);
      const col = h('div', { class: 'col' + (ds === today ? ' today' : ''), 'data-date': ds });
      for (let s = 0; s < 48; s++) {
        const t = `${pad(Math.floor(s / 2))}:${s % 2 ? '30' : '00'}`;
        const endM = Math.min(s * 30 + 60, 23 * 60 + 59);
        col.append(h('div', { class: 'slot', onclick: () => openEvent(null, { date: ds, start: t, end: `${pad(Math.floor(endM / 60))}:${pad(endM % 60)}` }) }));
      }
      layoutDay(eventsOn(ds).filter((e) => !e.allDay)).forEach(({ e, s, en, lane, lanes }) => {
        const w = 100 / lanes;
        col.append(h('div', {
          class: 'wevent',
          style: `top:${(s / 60) * hourH}px;height:${Math.max(((en - s) / 60) * hourH - 2, 18)}px;background:${e.color};left:calc(${lane * w}% + 2px);width:calc(${w}% - 4px);right:auto`,
          title: `${e.title} (${e.start}–${e.end})`,
          onclick: (ev) => { ev.stopPropagation(); openEvent(e); },
        }, h('b', {}, e.title), `${e.start}–${e.end}`));
      });
      if (ds === today) col.append(h('div', { class: 'now-line', style: `top:${(nowMinutes() / 60) * hourH}px` }));
      body.append(col);
    });

    const wrap = h('div', { class: 'week' }, head, allday, body);
    // Scroll to ~1h before now (or 07:00)
    requestAnimationFrame(() => {
      const hasToday = days.some((d) => ymd(d) === today);
      const target = hasToday ? Math.max(0, nowMinutes() / 60 - 1.5) : 7;
      body.scrollTop = target * hourH;
    });
    return wrap;
  }

  function setView(v) { view = v; state.view = v; save(); render(); }

  // ---------- Event modal ----------
  const evDlg = $('#event-dialog');
  const evForm = $('#event-form');
  let editingEvent = null;

  const colorWrap = $('#color-choices');
  COLORS.forEach((c, i) => colorWrap.append(h('input', { type: 'radio', name: 'color', value: c, style: `--c:${c}`, 'aria-label': `Color ${i + 1}` })));

  function syncAllDay() { $('.times', evForm).classList.toggle('hidden', evForm.allDay.checked); }
  evForm.allDay.addEventListener('change', syncAllDay);

  function openEvent(ev, preset = {}) {
    editingEvent = ev;
    const d = ev || {
      title: '', date: preset.date || ymd(cursor), allDay: !!preset.allDay,
      start: preset.start || '09:00', end: preset.end || '10:00', description: '', color: COLORS[0], reminder: '',
    };
    $('#event-dialog-title').textContent = ev ? 'Edit event' : 'New event';
    evForm.title.value = d.title;
    evForm.date.value = d.date;
    evForm.allDay.checked = !!d.allDay;
    evForm.start.value = d.start || '09:00';
    evForm.end.value = d.end || '10:00';
    evForm.description.value = d.description || '';
    evForm.reminder.value = d.reminder == null ? '' : String(d.reminder);
    const radio = [...evForm.querySelectorAll('input[name=color]')].find((r) => r.value === d.color) || evForm.querySelector('input[name=color]');
    radio.checked = true;
    $('#event-delete').hidden = !ev;
    $('#event-error').hidden = true;
    syncAllDay();
    evDlg.showModal();
    evForm.title.focus();
  }

  evForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const allDay = evForm.allDay.checked;
    const start = evForm.start.value || '09:00';
    let end = evForm.end.value || start;
    if (!allDay && toMin(end) <= toMin(start)) {
      const err = $('#event-error'); err.textContent = 'End time must be after start time.'; err.hidden = false; return;
    }
    const data = {
      title: evForm.title.value.trim() || '(untitled)',
      date: evForm.date.value,
      allDay, start: allDay ? '' : start, end: allDay ? '' : end,
      description: evForm.description.value.trim(),
      color: (evForm.querySelector('input[name=color]:checked') || {}).value || COLORS[0],
      reminder: evForm.reminder.value === '' ? null : Number(evForm.reminder.value),
    };
    if (editingEvent) Object.assign(editingEvent, data);
    else state.events.push({ id: uid(), ...data });
    save(); evDlg.close(); render(); checkDue();
  });

  $('#event-delete').addEventListener('click', () => {
    if (!editingEvent || !confirm(`Delete “${editingEvent.title}”?`)) return;
    state.events = state.events.filter((x) => x !== editingEvent);
    save(); evDlg.close(); render();
  });

  // ---------- Reminders ----------
  const remDlg = $('#reminder-dialog');
  const remForm = $('#reminder-form');
  let editingRem = null;
  const remDue = (r) => at(r.date, r.time);

  function openReminder(r) {
    editingRem = r;
    const soon = new Date(Date.now() + 60 * 60 * 1000); soon.setMinutes(0, 0, 0);
    $('#reminder-dialog-title').textContent = r ? 'Edit reminder' : 'New reminder';
    remForm.title.value = r ? r.title : '';
    remForm.date.value = r ? r.date : ymd(soon);
    remForm.time.value = r ? r.time : `${pad(soon.getHours())}:00`;
    remForm.note.value = r ? r.note || '' : '';
    $('#reminder-delete').hidden = !r;
    remDlg.showModal();
    remForm.title.focus();
  }

  remForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = { title: remForm.title.value.trim() || '(untitled)', date: remForm.date.value, time: remForm.time.value, note: remForm.note.value.trim() };
    if (editingRem) Object.assign(editingRem, data);
    else state.reminders.push({ id: uid(), done: false, ...data });
    save(); remDlg.close(); renderReminders(); checkDue();
  });

  $('#reminder-delete').addEventListener('click', () => {
    if (editingRem && confirm(`Delete “${editingRem.title}”?`)) deleteReminder(editingRem);
    remDlg.close();
  });

  function deleteReminder(r) { state.reminders = state.reminders.filter((x) => x !== r); save(); renderReminders(); }

  function renderReminders() {
    const list = $('#reminder-list');
    const now = Date.now();
    const sorted = [...state.reminders].sort((a, b) => (a.done - b.done) || remDue(a) - remDue(b));
    let overdue = 0;
    list.replaceChildren(...sorted.map((r) => {
      const due = remDue(r);
      const isOver = !r.done && due.getTime() < now;
      if (isOver) overdue++;
      return h('li', { class: 'rem' + (isOver ? ' overdue' : '') + (r.done ? ' done' : '') },
        h('input', {
          type: 'checkbox', checked: r.done, 'aria-label': 'Done',
          onchange: (e) => { r.done = e.target.checked; save(); renderReminders(); },
        }),
        h('div', {},
          h('div', { class: 'r-title' }, r.title),
          h('div', { class: 'r-due' }, (isOver ? 'Overdue · ' : '') + fmtDue(due))),
        h('div', { class: 'r-actions' },
          h('button', { title: 'Edit', 'aria-label': 'Edit', onclick: () => openReminder(r) }, '✎'),
          h('button', { title: 'Delete', 'aria-label': 'Delete', onclick: () => { if (confirm(`Delete “${r.title}”?`)) deleteReminder(r); } }, '🗑')),
        r.note ? h('div', { class: 'r-note' }, r.note) : null);
    }));
    $('#reminder-empty').hidden = sorted.length > 0;
    const badge = $('#badge');
    badge.hidden = overdue === 0; badge.textContent = overdue;
  }

  // ---------- Notifications ----------
  let swReg = null;
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((r) => (swReg = r)).catch((e) => console.info('SW not registered:', e.message));
  }

  function toast(title, body) {
    const t = h('div', { class: 'toast', role: 'status' },
      h('div', {}, h('b', {}, title), body ? h('small', {}, body) : null),
      h('button', { 'aria-label': 'Dismiss', onclick: () => t.remove() }, '×'));
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 15000);
  }

  async function notify(title, body, tag) {
    const canNotify = 'Notification' in window && Notification.permission === 'granted';
    if (canNotify) {
      const opts = { body, tag, icon: 'icon.svg', badge: 'icon.svg', requireInteraction: true };
      try {
        const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
        if (reg && reg.showNotification) await reg.showNotification(title, opts);
        else new Notification(title, opts);
      } catch (e) {
        try { new Notification(title, opts); } catch (_) { /* ignore */ }
      }
    }
    toast(title, body); // in-page too, so nothing is missed
    try { beep(); } catch (_) { /* audio optional */ }
  }

  function beep() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.5);
  }

  function offsetLabel(m) { return m >= 1440 ? `${m / 1440} day` : m >= 60 ? `${m / 60} h` : `${m} min`; }

  function checkDue() {
    const now = Date.now();
    let changed = false;
    // Plain reminders: fire once per (id, due time) while not done.
    for (const r of state.reminders) {
      if (r.done) continue;
      const due = remDue(r).getTime();
      const key = `r:${r.id}@${r.date}T${r.time}`;
      if (due <= now && !state.fired[key]) {
        state.fired[key] = now; changed = true;
        notify(`⏰ ${r.title}`, r.note || `Due ${fmtDue(remDue(r))}`, key);
      }
    }
    // Event reminders: fire between (start - offset) and event end.
    for (const e of state.events) {
      if (e.reminder == null || e.reminder === '') continue;
      const start = at(e.date, e.allDay ? '09:00' : e.start).getTime();
      const end = e.allDay ? at(e.date, '23:59').getTime() : at(e.date, e.end).getTime();
      const trigger = start - Number(e.reminder) * 60000;
      const key = `e:${e.id}@${e.date}T${e.start}-${e.reminder}`;
      if (now >= trigger && now <= end && !state.fired[key]) {
        state.fired[key] = now; changed = true;
        const when = e.allDay ? 'All day' : `${e.start}–${e.end}`;
        notify(`📅 ${e.title}`, `${when} · ${fmtDue(new Date(start)).split(',')[0]} (reminder ${offsetLabel(Number(e.reminder))} before)`, key);
      }
    }
    // Drop fired markers older than 60 days
    for (const [k, t] of Object.entries(state.fired)) if (now - t > 60 * 864e5) { delete state.fired[k]; changed = true; }
    if (changed) save();
    renderReminders();
  }

  function updateNotifyUi() {
    const btn = $('#btn-notify'); const hint = $('#notify-hint');
    if (!('Notification' in window)) {
      btn.textContent = 'Notifications unsupported'; btn.disabled = true;
      hint.hidden = false; hint.textContent = 'This browser does not support notifications. Reminders will appear inside the page while it is open.';
      return;
    }
    const p = Notification.permission;
    btn.textContent = p === 'granted' ? 'Notifications enabled ✓' : p === 'denied' ? 'Notifications blocked' : 'Enable notifications';
    hint.hidden = p === 'granted';
    hint.replaceChildren();
    if (p === 'default') hint.append('Get alerts when reminders are due. ', h('button', { class: 'btn small primary', onclick: requestNotify }, 'Enable notifications'));
    else if (p === 'denied') hint.textContent = 'Notifications are blocked in your browser settings, so reminders will show as pop-ups inside this page while it is open.';
  }

  async function requestNotify() {
    if (!('Notification' in window)) return toast('Not supported', 'This browser cannot show notifications.');
    try {
      const p = await Notification.requestPermission();
      updateNotifyUi();
      if (p === 'granted') notify('Notifications enabled', 'You will be alerted when reminders are due.', 'enabled');
      else toast('Notifications not enabled', 'Reminders will appear inside this page instead.');
    } catch (e) { toast('Could not enable notifications', e.message); }
    $('.menu').open = false;
  }

  // ---------- Export / Import ----------
  function exportJson() {
    const data = { app: 'calendar-reminders', version: 1, exportedAt: new Date().toISOString(), events: state.events, reminders: state.reminders };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: `calendar-backup-${ymd(new Date())}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('.menu').open = false;
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.events) || !Array.isArray(data.reminders)) throw new Error('Missing events or reminders');
        const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        const events = data.events.filter((e) => e && validDate(e.date)).map((e) => ({
          id: String(e.id || uid()), title: String(e.title || '(untitled)'), date: e.date, allDay: !!e.allDay,
          start: e.allDay ? '' : String(e.start || '09:00'), end: e.allDay ? '' : String(e.end || '10:00'),
          description: String(e.description || ''), color: /^#[0-9a-f]{3,8}$/i.test(e.color) ? e.color : COLORS[0],
          reminder: e.reminder == null || e.reminder === '' ? null : Number(e.reminder),
        }));
        const reminders = data.reminders.filter((r) => r && validDate(r.date)).map((r) => ({
          id: String(r.id || uid()), title: String(r.title || '(untitled)'), date: r.date, time: String(r.time || '09:00'),
          note: String(r.note || ''), done: !!r.done,
        }));
        const replace = confirm(`Import ${events.length} events and ${reminders.length} reminders.\n\nOK = replace current data\nCancel = merge with current data`);
        if (replace) { state.events = events; state.reminders = reminders; }
        else {
          const evIds = new Set(state.events.map((e) => e.id)); const rIds = new Set(state.reminders.map((r) => r.id));
          state.events.push(...events.filter((e) => !evIds.has(e.id)));
          state.reminders.push(...reminders.filter((r) => !rIds.has(r.id)));
        }
        save(); render(); toast('Import complete', `${events.length} events, ${reminders.length} reminders`);
      } catch (e) { toast('Import failed', e.message); }
    };
    reader.readAsText(file);
  }

  // ---------- Wiring ----------
  function shift(dir) {
    if (view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    else cursor = addDays(cursor, dir * 7);
    render();
  }
  $('#btn-prev').addEventListener('click', () => shift(-1));
  $('#btn-next').addEventListener('click', () => shift(1));
  $('#btn-today').addEventListener('click', () => { cursor = new Date(); render(); });
  $('#view-month').addEventListener('click', () => setView('month'));
  $('#view-week').addEventListener('click', () => setView('week'));
  $('#btn-new-event').addEventListener('click', () => openEvent(null, { date: ymd(view === 'month' && cursor.getMonth() !== new Date().getMonth() ? cursor : new Date()) }));
  $('#btn-new-reminder').addEventListener('click', () => openReminder(null));
  $('#btn-notify').addEventListener('click', requestNotify);
  $('#btn-export').addEventListener('click', exportJson);
  $('#btn-import').addEventListener('click', () => { $('#import-file').click(); $('.menu').open = false; });
  $('#import-file').addEventListener('change', (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
  $('#btn-lock').addEventListener('click', () => window.lockApp());
  $('#btn-toggle-panel').addEventListener('click', () => $('#panel').classList.toggle('open'));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  document.addEventListener('click', (e) => { const m = $('.menu'); if (m.open && !m.contains(e.target)) m.open = false; });
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') shift(-1);
    else if (e.key === 'ArrowRight') shift(1);
    else if (e.key === 't') { cursor = new Date(); render(); }
    else if (e.key === 'm') setView('month');
    else if (e.key === 'w') setView('week');
    else if (e.key === 'n') $('#btn-new-event').click();
  });
  // Sync across tabs
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); render(); } });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if ((lastW < 600) !== (window.innerWidth < 600)) render(); lastW = window.innerWidth; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDue(); });

  // Re-render periodically so "today", overdue and now-line stay fresh
  let lastDay = ymd(new Date());
  setInterval(() => {
    checkDue();
    if (ymd(new Date()) !== lastDay) { lastDay = ymd(new Date()); render(); }
    else if (view === 'week') { const nl = $('.now-line'); if (nl) nl.style.top = `${(nowMinutes() / 60) * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-h')) || 48)}px`; }
  }, 30000);

  updateNotifyUi();
  render();
  checkDue();
});
