// Мой Ритм v10 — точка входа
import { S, sb, me, partner, prof, loadAll, loadCache, realtime, setOnChange, hooks, flush, add, setOnline } from './data.js';
import { A, toast, sheet, closeSheet, bindActions, confetti, sheetOpen } from './ui.js';
import { $, esc, today, addDays, fmtDate, fmtDay, store, val, daysUntil, nextYearly, rub } from './util.js';
import * as L from './logic.js';
import * as Today from './pages/today.js';
import * as Home from './pages/home.js';
import * as Money from './pages/money.js';
import * as Us from './pages/us.js';
import * as Habits from './pages/habits.js';
import * as Food from './pages/food.js';
import * as Results from './pages/results.js';
import * as Settings from './pages/settings.js';

const PAGES = {
  today: { t: 'Сегодня', ic: '☀', m: Today },
  home: { t: 'Дела и дом', short: 'Дела', ic: '✓', m: Home },
  money: { t: 'Деньги', ic: '₽', m: Money },
  us: { t: 'Мы', ic: '♡', m: Us },
  habits: { t: 'Привычки', ic: '✦', m: Habits },
  food: { t: 'Питание', ic: '◉', m: Food },
  results: { t: 'Итоги', ic: '▥', m: Results },
  settings: { t: 'Настройки', ic: '⚙', m: Settings }
};
const TAB_MAIN = ['today', 'home', 'money', 'us'];
S.ui = { page: store.get('mr10-page', 'today'), date: today(), ...S.ui };

// ---------- тема ----------
function applyTheme() {
  const t = store.get('mr10-theme', 'auto'), pal = store.get('mr10-palette', 'lavender');
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.palette = pal;
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#8970c9';
}
window.__applyTheme = applyTheme;
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
applyTheme();

// ---------- рендер ----------
function badges() {
  return { today: L.overdueTasks().length || 0, home: S.shopping.filter(s => !s.done).length ? 0 : 0, us: L.unreadNotes().length, money: S.payments.filter(p => p.active !== false && daysUntil(p.next_date) <= 0).length };
}
function render() {
  if (!S.user) return;
  const pg = PAGES[S.ui.page] ? S.ui.page : 'today';
  const b = badges();
  $('topTitle').textContent = PAGES[pg].t;
  $('topDate').innerHTML = pg === 'settings' || pg === 'us' ? '' : `<span class="row nw" style="gap:4px"><button class="sm ghost" data-act="shiftDate" data-v="-1">‹</button><span>${S.ui.date === today() ? 'Сегодня, ' : ''}${fmtDate(S.ui.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span><button class="sm ghost" data-act="shiftDate" data-v="1">›</button>${S.ui.date !== today() ? '<button class="sm" data-act="goToday">сегодня</button>' : ''}</span>`;
  $('net').className = 'net' + (S.online ? '' : ' off'); $('net').title = S.online ? 'В сети' : `Офлайн${S.pending ? ' · ждут отправки: ' + S.pending : ''}`;
  $('nav').innerHTML = Object.entries(PAGES).map(([k, p], i) => `${i === 4 ? '<hr>' : ''}<button class="${pg === k ? 'on' : ''}" data-act="go" data-page="${k}"><span class="ic">${p.ic}</span>${p.t}${b[k] ? `<span class="badge">${b[k]}</span>` : ''}</button>`).join('');
  $('tabbar').innerHTML = TAB_MAIN.map(k => `<button class="tab ${pg === k ? 'on' : ''}" data-act="go" data-page="${k}"><span class="ic">${PAGES[k].ic}</span>${PAGES[k].short || PAGES[k].t}${b[k] ? `<span class="badge">${b[k]}</span>` : ''}</button>`).join('')
    + `<button class="tab ${!TAB_MAIN.includes(pg) ? 'on' : ''}" data-act="moreMenu"><span class="ic">☰</span>Ещё</button>`;
  $('sideFoot').innerHTML = `${esc(S.profile?.emoji || '')} ${esc(S.profile?.display_name || '')}${partner() ? ` ♡ ${esc(partner().emoji || '')} ${esc(partner().display_name)}` : ''}<br>v10`;
  // сохранить фокус и прокрутку при перерисовке
  const ae = document.activeElement, focusId = ae && ae.id && $('view').contains(ae) ? ae.id : null, sel = focusId && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
  const keep = focusId ? ae.value : null;
  try { $('view').innerHTML = PAGES[pg].m.render(S.ui.date); }
  catch (e) { console.error(e); $('view').innerHTML = `<div class="card"><div class="msg err">Ошибка отображения: ${esc(e.message)}</div></div>`; }
  if (focusId) { const el = $(focusId); if (el) { if (keep !== null && el.value !== keep && el.tagName !== 'SELECT') el.value = keep; el.focus(); if (sel) try { el.setSelectionRange(...sel); } catch { } } }
  document.title = (b.us ? `(${b.us}) ` : '') + 'Мой Ритм';
}
window.__render = render;
setOnChange(() => { if (!sheetOpen() || !document.activeElement?.closest('#sheet')) render(); else render(); });

// ---------- навигация ----------
A.go = el => { S.ui.page = el.dataset.page; if (el.dataset.tab) S.ui.homeTab = el.dataset.tab; store.set('mr10-page', S.ui.page); closeSheet(); render(); window.scrollTo({ top: 0 }); };
A.setUi = el => { S.ui[el.dataset.k] = el.dataset.v; render(); };
A.shiftDate = el => { S.ui.date = addDays(S.ui.date, Number(el.dataset.v)); render(); };
A.goToday = () => { S.ui.date = today(); render(); };
A.moreMenu = () => sheet(`<h2>Ещё</h2><div class="qa">${['habits', 'food', 'results', 'settings'].map(k => `<button data-act="go" data-page="${k}"><b>${PAGES[k].ic}</b>${PAGES[k].t}</button>`).join('')}</div>`);

// ---------- быстрое добавление (+) ----------
A.quickAdd = () => {
  const glass = S.goals.glass || 250;
  sheet(`<h2>Быстро добавить</h2><div class="qa">
    <button data-act="qaTask"><b>✓</b>Задача</button>
    <button data-act="qaShop"><b>🛒</b>Покупка</button>
    <button data-act="quickTx" data-type="expense"><b>💸</b>Расход</button>
    <button data-act="quickTx" data-type="income"><b>💰</b>Доход</button>
    <button data-act="qaWater" data-v="${glass}"><b>💧</b>+${glass} мл</button>
    <button data-act="sendNeed"><b>💌</b>Записка</button>
    <button data-act="qaMeal"><b>🍽</b>Еда</button>
    <button data-act="qaMemory"><b>📸</b>Момент</button>
  </div>`);
};
A.qaTask = () => sheet(`<h2>✓ Задача</h2><div class="form"><input id="qaT" placeholder="Что сделать?" autofocus data-enter="qaTaskSave"><div class="chips">${[['0', 'Сегодня'], ['1', 'Завтра'], ['', 'Без даты']].map(([v, l], i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-act="qaPick" data-v="${v}">${l}</button>`).join('')}</div><button class="primary" data-act="qaTaskSave">Добавить</button></div>`);
A.qaPick = el => el.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
A.qaTaskSave = async () => { const t = val('qaT'); if (!t) return; const v = document.querySelector('#sheet .chip.on')?.dataset.v; await add('tasks', { text: t, date: v === '' ? null : addDays(today(), Number(v || 0)), done: false, tag: 'other' }); closeSheet(); toast('✓ Добавлено'); };
A.qaShop = () => sheet(`<h2>🛒 В список покупок</h2><div class="form"><input id="shText" placeholder="Молоко, хлеб 2 шт, яблоки…" autofocus data-enter="qaShopSave"><button class="primary" data-act="qaShopSave">Добавить</button></div>`);
A.qaShopSave = async () => { await A.shopAdd(); closeSheet(); toast('🛒 Добавлено'); };
A.qaWater = async el => { const prev = S.ui.date; S.ui.date = today(); await A.water(el); S.ui.date = prev; closeSheet(); toast('💧 +' + el.dataset.v + ' мл'); };
A.qaMeal = () => { S.ui.page = 'food'; S.ui.foodTab = 'day'; closeSheet(); render(); setTimeout(() => $('mlName')?.focus(), 50); };
A.qaMemory = () => { S.ui.page = 'us'; S.ui.usTab = 'mem'; closeSheet(); render(); setTimeout(() => $('mTitle')?.focus(), 50); };

// ---------- поиск ----------
A.openSearch = () => { sheet(`<h2>⌕ Поиск</h2><input id="srchQ" placeholder="Задачи, покупки, траты, записки, воспоминания…" autofocus style="width:100%"><div id="srchRes" class="search-res" style="margin-top:10px"></div>`, () => { $('srchQ').addEventListener('input', doSearch); }); };
function doSearch() {
  const q = $('srchQ').value.trim().toLowerCase(); const out = [];
  if (q.length >= 2) {
    const m = (s) => String(s || '').toLowerCase().includes(q);
    L.visibleTasks().filter(t => m(t.text)).forEach(t => out.push(['✓', t.text, t.date ? fmtDay(t.date) : 'задача', 'home', 'tasks']));
    S.shopping.filter(s => m(s.text)).forEach(s => out.push(['🛒', s.text, s.done ? 'куплено' : 'в списке', 'home', 'shop']));
    S.transactions.filter(t => m(t.note) || m(t.category)).slice(0, 30).forEach(t => out.push(['₽', `${t.category}${t.note ? ' · ' + t.note : ''} — ${rub(t.amount)}`, fmtDay(t.date), 'money', 'ops']));
    S.notes.filter(n => m(n.text)).forEach(n => out.push(['💌', n.text, fmtDay(n.created_at.slice(0, 10)), 'us', 'notes']));
    S.memories.filter(x => m(x.title) || m(x.text)).forEach(x => out.push(['📸', x.title, fmtDate(x.date), 'us', 'mem']));
    S.wishlist.filter(w => m(w.text)).forEach(w => out.push(['🎁', w.text, 'вишлист', 'us', 'wish']));
    S.recipes.filter(r => m(r.name)).forEach(r => out.push(['♧', r.name, 'рецепт', 'food', 'recipes']));
    S.habits.filter(h => m(h.name)).forEach(h => out.push([h.emoji || '✦', h.name, 'привычка', 'habits', '']));
    S.important_dates.filter(d => m(d.title)).forEach(d => out.push([d.emoji || '♡', d.title, fmtDate(nextYearly(d.date)), 'us', 'dates']));
  }
  $('srchRes').innerHTML = out.slice(0, 60).map(([e, t, s, pg, tab]) => `<div class="item" data-act="srchGo" data-page="${pg}" data-tab="${tab}"><span class="emo">${e}</span><div class="body"><div class="t">${esc(t)}</div><div class="s">${esc(s)}</div></div></div>`).join('') || (q.length >= 2 ? '<div class="empty">Ничего не нашлось</div>' : '');
}
A.srchGo = el => { const pg = el.dataset.page, tab = el.dataset.tab; S.ui.page = pg; if (tab) S.ui[{ home: 'homeTab', money: 'moneyTab', us: 'usTab', food: 'foodTab' }[pg]] = tab; closeSheet(); render(); };

// ---------- авторизация ----------
function authView(mode = 'login', msg = '', type = 'err') {
  $('app').classList.add('hidden'); $('auth').classList.remove('hidden'); $('loader').classList.add('off');
  const reg = mode === 'register';
  $('auth').innerHTML = `<div class="auth-box"><h1>Мой Ритм</h1><div class="sub">наш общий ритм ♡</div>
    <div class="seg" style="display:flex;margin-bottom:14px"><button class="${!reg ? 'on' : ''}" style="flex:1" data-act="authMode" data-v="login">Войти</button><button class="${reg ? 'on' : ''}" style="flex:1" data-act="authMode" data-v="register">Создать аккаунт</button></div>
    <div class="form">
      <input id="auEmail" type="email" placeholder="Email" autocomplete="email" value="${esc(store.get('mr10-email', ''))}">
      <input id="auPass" type="password" placeholder="Пароль (мин. 6 символов)" autocomplete="${reg ? 'new-password' : 'current-password'}" data-enter="${reg ? 'register' : 'login'}">
      ${reg ? `<div class="row nw"><input id="auEmoji" placeholder="💜" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="auName" placeholder="Как тебя зовут?"></div><input id="auCode" placeholder="Код партнёра (если есть)" maxlength="6" style="text-transform:uppercase">` : ''}
      ${msg ? `<div class="msg ${type}">${esc(msg)}</div>` : ''}
      <button class="primary" id="auBtn" data-act="${reg ? 'register' : 'login'}">${reg ? 'Создать аккаунт' : 'Войти'}</button>
      ${!reg ? '<button class="ghost sm" data-act="resetPass">Забыли пароль?</button>' : ''}
    </div></div>`;
}
A.authMode = el => authView(el.dataset.v);
const authErr = e => { const m = e?.message || String(e); return /Invalid login/i.test(m) ? 'Неверный email или пароль' : /already/i.test(m) ? 'Такой email уже зарегистрирован — попробуй войти' : /not confirmed/i.test(m) ? 'Подтверди email по ссылке из письма' : /fetch|network/i.test(m) ? 'Нет связи с сервером. Проверь интернет или что база Supabase не на паузе.' : m; };
A.login = async () => {
  const email = val('auEmail').toLowerCase(), password = $('auPass').value; if (!email || !password) return authView('login', 'Введи email и пароль');
  $('auBtn').disabled = true; $('auBtn').textContent = 'Входим…';
  const { error } = await sb.auth.signInWithPassword({ email, password }).catch(e => ({ error: e }));
  if (error) return authView('login', authErr(error));
  store.set('mr10-email', email); boot();
};
A.register = async () => {
  const email = val('auEmail').toLowerCase(), password = $('auPass').value, name = val('auName'), emoji = val('auEmoji') || '💜', code = val('auCode').toUpperCase();
  if (!email || !password || !name) return authView('register', 'Заполни email, пароль и имя');
  if (password.length < 6) return authView('register', 'Пароль — минимум 6 символов');
  $('auBtn').disabled = true; $('auBtn').textContent = 'Создаём…';
  const { data, error } = await sb.auth.signUp({ email, password }).catch(e => ({ error: e }));
  if (error) return authView('register', authErr(error));
  if (!data.session) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) return authView('login', 'Аккаунт создан. ' + authErr(r.error), 'info'); }
  const uid = (await sb.auth.getUser()).data.user.id;
  await sb.from('profiles').upsert({ id: uid, username: email.split('@')[0], display_name: name, emoji, role: '' });
  await sb.from('goals').upsert({ user_id: uid }, { onConflict: 'user_id' });
  if (code) { const { error: je } = await sb.rpc('join_household', { code }); if (je) toast('Код не подошёл: ' + je.message + '. Можно ввести позже в настройках.'); }
  store.set('mr10-email', email); boot();
};
A.resetPass = async () => { const email = val('auEmail'); if (!email) return authView('login', 'Впиши email — пришлём ссылку'); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); authView('login', error ? authErr(error) : 'Ссылка для сброса отправлена на почту', error ? 'err' : 'info'); };

// ---------- запуск ----------
async function boot() {
  let session;
  try { session = (await sb.auth.getSession()).data.session; } catch { }
  if (!session) return authView();
  S.user = { id: session.user.id, email: session.user.email };
  const cached = loadCache();
  if (cached) showApp();
  try {
    await loadAll();
    if (!S.profile) { await sb.from('profiles').upsert({ id: me(), username: (S.user.email || '').split('@')[0], display_name: (S.user.email || '').split('@')[0], emoji: '💜', role: '' }); await loadAll(); }
    setOnline(true); flush();
    showApp(); realtime();
    if (!cached) { const h = new Date().getHours(); toast(`${h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'}, ${S.profile?.display_name || ''} ♡`); }
  } catch (e) {
    console.warn('boot', e); setOnline(false);
    if (cached) toast('Офлайн-режим: показаны сохранённые данные'); else authView('login', authErr(e));
  }
}
function showApp() {
  $('auth').classList.add('hidden'); $('app').classList.remove('hidden'); $('loader').classList.add('off'); render();
  const go = new URLSearchParams(location.search).get('go');
  if (go) { history.replaceState(null, '', location.pathname); if (go === 'shop') { S.ui.page = 'home'; S.ui.homeTab = 'shop'; render(); } if (go === 'expense') A.quickTx({ dataset: { type: 'expense' } }); }
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.user = null; authView(); } if (ev === 'PASSWORD_RECOVERY') { const p = prompt('Новый пароль:'); if (p && p.length >= 6) sb.auth.updateUser({ password: p }).then(() => toast('🔐 Пароль обновлён')); } });

// уведомления о действиях партнёра
hooks.error = m => toast('⚠️ ' + m);
hooks.info = m => toast(m);
hooks.remoteInsert = (t, row) => {
  const p = partner(); if (!p) return;
  const by = row.user_id || row.who || row.added_by || row.from_user || row.created_by;
  if (by === me()) return;
  const name = p.display_name;
  const msgs = { notes: row.to_user === me() ? (row.kind === 'need' ? `${row.text}` : `💌 Записка от ${name}`) : null, shopping: `🛒 ${name}: ${row.text}`, transactions: row.who && row.who !== me() ? `💸 ${name}: ${row.category} ${rub(row.amount)}` : null, wishlist: `🎁 ${name} добавил(а) желание`, memories: `📸 ${name}: ${row.title}`, tasks: row.shared && row.assignee === me() ? `📨 ${name} просит: ${row.text}` : null };
  const m = msgs[t]; if (!m) return;
  toast(m); notify(m, t === 'notes' ? row.text : '');
  if (t === 'notes' && row.to_user === me()) confetti(30);
};

// ---------- локальные уведомления ----------
async function notify(title, body = '') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && !document.hidden && title) { /* уже показан тост */ if (!body) return; }
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) reg.showNotification('Мой Ритм', { body: title + (body ? '\n' + body : ''), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title }); else new Notification('Мой Ритм', { body: title }); } catch { }
}
function tick() {
  if (!S.user) return;
  const now = new Date(), d = today(), hm = now.toTimeString().slice(0, 5);
  const sent = store.get('mr10-notified', {}); const once = (k, msg) => { if (sent[k]) return; sent[k] = 1; notify(msg); toast('🔔 ' + msg); };
  S.reminders.forEach(r => { if (r.done) return; if (String(r.time || '').slice(0, 5) === hm && (r.recurring === 'daily' || r.date === d)) once(`r${r.id}${d}${hm}`, r.text); });
  if (now.getHours() >= 9) {
    const pays = S.payments.filter(p => p.active !== false && daysUntil(p.next_date) >= 0 && daysUntil(p.next_date) <= 1);
    if (pays.length) once('pay' + d, `📅 Платежи: ${pays.map(p => p.name).join(', ')}`);
    const ds = S.important_dates.filter(x => [0, 1, 7].includes(daysUntil(nextYearly(x.date))));
    ds.forEach(x => once('date' + x.id + d, `${x.emoji || '♡'} ${x.title} — ${daysUntil(nextYearly(x.date)) === 0 ? 'сегодня!' : daysUntil(nextYearly(x.date)) === 1 ? 'завтра' : 'через неделю'}`));
  }
  if (now.getHours() === 20 && now.getMinutes() < 2) { const h = L.dayHabitScore(d); if (h.due > h.done) once('hab' + d, `✦ Осталось привычек: ${h.due - h.done}. Ещё не поздно!`); }
  const keys = Object.keys(sent); if (keys.length > 400) keys.slice(0, 200).forEach(k => delete sent[k]);
  store.set('mr10-notified', sent);
  if (S.ui.date !== today() && S.ui.lastToday && S.ui.lastToday !== today()) { S.ui.date = today(); render(); }
  S.ui.lastToday = today();
}
setInterval(tick, 30000);

// ---------- PWA ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__installPrompt = e; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user && navigator.onLine) { loadAll().catch(() => { }); flush(); } });

bindActions(document);
boot();
