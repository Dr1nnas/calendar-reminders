/* Simple client-side PIN lock. Not real security: the hash below is public and
   the check runs in the browser. It only keeps casual visitors out. */
(() => {
  'use strict';
  const SALT = 'calrem-lock-v1:';
  const HASH = '21ce8223b4daf60900f4e7c8fcdd02fd5e96534f58db11da47aca7493a4afab4'; // SHA-256(SALT + PIN)
  const MAX_TRIES = 3;
  const LOCKOUT_MS = 15 * 60 * 1000;
  const SESSION_KEY = 'calrem.unlocked';
  const STATE_KEY = 'calrem.lock';

  const root = document.documentElement;
  const form = document.getElementById('lock-form');
  const input = document.getElementById('lock-input');
  const submit = document.getElementById('lock-submit');
  const msg = document.getElementById('lock-msg');

  let callbacks = [];
  let unlocked = false;
  try { unlocked = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { /* ignore */ }

  const readState = () => {
    try { const s = JSON.parse(localStorage.getItem(STATE_KEY)) || {}; return { fails: s.fails | 0, until: Number(s.until) || 0 }; }
    catch (e) { return { fails: 0, until: 0 }; }
  };
  const writeState = (s) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } };

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  let timer = null;
  function refresh() {
    const s = readState();
    const left = s.until - Date.now();
    if (left > 0) {
      const m = Math.floor(left / 60000); const sec = Math.ceil((left % 60000) / 1000);
      const mm = sec === 60 ? m + 1 : m; const ss = sec === 60 ? 0 : sec;
      msg.textContent = `Too many wrong attempts. Try again in ${mm}:${String(ss).padStart(2, '0')}.`;
      input.disabled = submit.disabled = true;
      if (!timer) timer = setInterval(refresh, 1000);
      return;
    }
    if (s.until) writeState({ fails: 0, until: 0 }); // lockout expired
    if (timer) { clearInterval(timer); timer = null; }
    const wasDisabled = input.disabled;
    input.disabled = submit.disabled = false;
    if (wasDisabled) { msg.textContent = ''; input.focus(); }
  }

  function doUnlock() {
    unlocked = true;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ }
    writeState({ fails: 0, until: 0 });
    root.classList.remove('locked');
    if (timer) { clearInterval(timer); timer = null; }
    const cbs = callbacks; callbacks = [];
    cbs.forEach((cb) => cb());
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (input.disabled) return;
    const s = readState();
    if (s.until > Date.now()) return refresh();
    const ok = (await sha256(SALT + input.value.trim())) === HASH;
    input.value = '';
    if (ok) return doUnlock();
    const fails = s.fails + 1;
    if (fails >= MAX_TRIES) writeState({ fails: 0, until: Date.now() + LOCKOUT_MS });
    else {
      writeState({ fails, until: 0 });
      const left = MAX_TRIES - fails;
      msg.textContent = `Wrong PIN. ${left} attempt${left === 1 ? '' : 's'} left.`;
    }
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    refresh();
  });

  // Keep other tabs' lockout in sync
  window.addEventListener('storage', (e) => { if (e.key === STATE_KEY && !unlocked) refresh(); });

  window.whenUnlocked = (cb) => { if (unlocked) cb(); else callbacks.push(cb); };
  window.lockApp = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } location.reload(); };

  if (unlocked) root.classList.remove('locked');
  else { root.classList.add('locked'); refresh(); if (!input.disabled) input.focus(); }
})();
