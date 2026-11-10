// Дела и дом: задачи, покупки, уборка, меню на неделю, календарь
import { S, me, partner, prof, add, addMany, upd, del } from '../data.js';
import { A, toast, empty, tabs, sheet, closeSheet, confetti, opt, ask } from '../ui.js';
import { esc, today, addDays, fmtDate, fmtDay, inDays, daysUntil, val, num, weekday, WD, MONTHS, monthStart, D, ymd, groupBy, addMonths } from '../util.js';
import * as L from '../logic.js';
import { taskRow } from './today.js';

export function render(date) {
  const tab = S.ui.homeTab || 'tasks';
  const shopLeft = S.shopping.filter(s => !s.done).length, due = L.choresDue().length;
  return tabs('homeTab', tab, [['tasks', '✓ Задачи'], ['shop', `🛒 Покупки${shopLeft ? ' · ' + shopLeft : ''}`], ['chores', `🏡 Дом${due ? ' · ' + due : ''}`], ['menu', '🍳 Меню'], ['cal', '📅 Календарь']])
    + ({ tasks: tasksView, shop: shopView, chores: choresView, menu: menuView, cal: calView }[tab])(date);
}

// ================= ЗАДАЧИ =================
function tasksView(date) {
  const f = S.ui.taskFilter || 'mine';
  const all = L.visibleTasks();
  const list = all.filter(t => f === 'mine' ? !t.shared && t.user_id === me() : f === 'shared' ? t.shared : true);
  const open = list.filter(t => !t.done);
  const groups = [
    ['⏰ Просрочено', open.filter(t => t.date && t.date < today())],
    ['☀ Сегодня', open.filter(t => t.date === today())],
    ['🌙 Завтра', open.filter(t => t.date === addDays(today(), 1))],
    ['📆 Позже', open.filter(t => t.date > addDays(today(), 1)).sort((a, b) => a.date.localeCompare(b.date))],
    ['📥 Без даты', open.filter(t => !t.date)]];
  const done = list.filter(t => t.done).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 15);
  const p = partner();
  return `<div class="card">
    <div class="row"><input id="tkText" placeholder="Новая задача…" data-enter="taskAdd" style="flex:2 1 200px">
      <input id="tkDate" type="date" value="${date}" style="flex:0 1 150px">
      <select id="tkRep" style="flex:0 1 150px">${Object.entries(L.REPEATS).map(([k, v]) => opt(k, v)).join('')}</select></div>
    <div class="row" style="margin-top:8px">
      ${p ? `<select id="tkWho" style="flex:0 1 200px">${opt('me', 'Только мне')}${opt('shared', 'Общая (кто угодно)')}${opt('partner', 'Попросить ' + p.display_name)}${opt('both', 'Мне, но видно обоим')}</select>` : ''}
      <span class="sp"></span><button class="primary" data-act="taskAdd">+ Добавить</button></div>
  </div>
  <div class="row" style="margin-bottom:10px">${[['mine', 'Мои'], ['shared', 'Общие'], ['all', 'Все']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="setUi" data-k="taskFilter" data-v="${k}">${l}</button>`).join('')}</div>
  ${groups.filter(g => g[1].length).map(([t, ls]) => `<div class="card"><h3>${t}<span class="right pill">${ls.length}</span></h3>${ls.map(taskRow).join('')}</div>`).join('') || `<div class="card">${empty('Все задачи выполнены. Ты молодец ✨')}</div>`}
  ${done.length ? `<div class="card soft"><h3>✓ Сделано недавно</h3>${done.map(taskRow).join('')}</div>` : ''}`;
}
A.taskAdd = async () => {
  const text = val('tkText'); if (!text) return;
  const who = document.getElementById('tkWho')?.value || 'me', p = partner();
  const row = { text, date: val('tkDate') || null, repeat: val('tkRep') || null, tag: 'other', done: false, shared: who !== 'me', assignee: who === 'partner' ? p?.id : who === 'both' ? me() : null };
  await add('tasks', row);
  if (who === 'partner') toast(`📨 Задача для ${p.display_name}`); else toast('✨ Добавлено');
  const el = document.getElementById('tkText'); if (el) { el.value = ''; el.focus(); }
};
A.toggleTask = async el => {
  const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return;
  const done = !t.done; await upd('tasks', t.id, { done });
  if (done && t.repeat) { const nd = L.nextRepeat(t.date || today(), t.repeat); await add('tasks', { text: t.text, date: nd, repeat: t.repeat, tag: t.tag, done: false, shared: t.shared, assignee: t.assignee, user_id: t.user_id === me() ? me() : me() }); toast('↻ Следующая: ' + fmtDay(nd)); }
  if (done) { const rest = L.tasksOn(S.ui.date).filter(x => !x.done); if (!rest.length && L.tasksOn(S.ui.date).length > 1) { confetti(); toast('🎉 Все задачи на день выполнены!'); } }
};
A.editTask = el => {
  const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return;
  sheet(`<h2>Задача</h2><div class="form">
    <input id="etText" value="${esc(t.text)}" autofocus>
    <div class="row"><input id="etDate" type="date" value="${t.date || ''}"><select id="etRep">${Object.entries(L.REPEATS).map(([k, v]) => opt(k, v, (t.repeat || '') === k)).join('')}</select></div>
    <div class="row"><button class="primary" data-act="taskSave" data-id="${t.id}">Сохранить</button><button data-act="taskTomorrow" data-id="${t.id}">→ На завтра</button><span class="sp"></span><button class="danger" data-act="taskDel" data-id="${t.id}">Удалить</button></div></div>`);
};
A.taskSave = async el => { await upd('tasks', el.dataset.id, { text: val('etText'), date: val('etDate') || null, repeat: val('etRep') || null }); closeSheet(); };
A.taskTomorrow = async el => { await upd('tasks', el.dataset.id, { date: addDays(today(), 1) }); closeSheet(); toast('→ На завтра'); };
A.taskDel = async el => { const t = { ...S.tasks.find(x => x.id === el.dataset.id) }; await del('tasks', t.id); closeSheet(); toast('Удалено', () => add('tasks', t)); };

// ================= ПОКУПКИ =================
function shopView() {
  const left = S.shopping.filter(s => !s.done), bought = S.shopping.filter(s => s.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 20);
  const g = groupBy(left, s => s.cat || 'Другое');
  const freq = {}; S.shopping.filter(s => s.done).forEach(s => { const k = s.text.toLowerCase(); freq[k] = (freq[k] || 0) + 1; });
  const sugg = Object.entries(freq).filter(([k]) => !left.some(l => l.text.toLowerCase() === k)).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return `<div class="card"><div class="row nw"><input id="shText" placeholder="Что купить? (можно через запятую)" data-enter="shopAdd" autofocus><button class="primary" data-act="shopAdd">+</button></div>
    ${sugg.length ? `<div class="chips" style="margin-top:10px">${sugg.map(([k]) => `<button class="chip" data-act="shopQuick" data-v="${esc(k)}">+ ${esc(k)}</button>`).join('')}</div>` : ''}</div>
  <div class="card"><h3>🛒 Купить<span class="right pill">${left.length}</span></h3>
    ${left.length ? L.SHOP_CATS.filter(c => g[c]).map(c => `<div class="shop-cat">${c}</div>${g[c].map(shopRow).join('')}`).join('') : empty('Список пуст. Холодильник доволен 🧊')}
  </div>
  ${bought.length ? `<div class="card soft"><h3>✓ Куплено<span class="right"><button class="sm ghost" data-act="shopClear">очистить</button></span></h3>${bought.map(shopRow).join('')}</div>` : ''}`;
}
const shopRow = s => `<div class="item ${s.done ? 'done' : ''}"><input type="checkbox" ${s.done ? 'checked' : ''} data-act="shopToggle" data-id="${s.id}"><div class="body"><div class="t">${esc(s.text)}${s.qty ? ` <span class="muted">· ${esc(s.qty)}</span>` : ''}</div>${s.added_by && s.added_by !== me() ? `<div class="s">добавил(а) ${esc(prof(s.added_by)?.display_name || '')}</div>` : ''}</div><button class="icon" data-act="shopDel" data-id="${s.id}">×</button></div>`;
async function shopAddText(text) {
  const items = text.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  await addMany('shopping', items.map(t => { const m = t.match(/^(.*?)\s+(\d+[.,]?\d*\s*(шт|кг|г|л|мл|уп|пач)?\.?)$/i); const name = m ? m[1] : t; return { text: name, qty: m ? m[2] : null, cat: L.guessShopCat(name), done: false, added_by: me() }; }));
}
A.shopAdd = async () => { const t = val('shText'); if (!t) return; await shopAddText(t); const el = document.getElementById('shText'); if (el) { el.value = ''; el.focus(); } };
A.shopQuick = async el => shopAddText(el.dataset.v);
A.shopToggle = async el => {
  const s = S.shopping.find(x => x.id === el.dataset.id); if (!s) return;
  const done = !s.done; await upd('shopping', s.id, { done, done_by: done ? me() : null, done_at: done ? new Date().toISOString() : null });
  if (done && !S.shopping.some(x => !x.done)) { confetti(40); toast('🎉 Всё куплено!'); setTimeout(() => { if (confirm('Записать расход на покупки?')) A.quickTx({ dataset: { type: 'expense', cat: 'Продукты' } }); }, 400); }
};
A.shopDel = async el => del('shopping', el.dataset.id);
A.shopClear = async () => { for (const s of S.shopping.filter(x => x.done)) await del('shopping', s.id); };

// ================= ДОМ / УБОРКА =================
function choresView() {
  const list = S.chores.slice().sort((a, b) => a.next_date.localeCompare(b.next_date));
  const p = partner();
  const weekAgo = addDays(today(), -6);
  const log = S.chore_log.filter(c => c.date >= weekAgo);
  const mine = log.filter(c => c.user_id === me()).length, theirs = p ? log.filter(c => c.user_id === p.id).length : 0;
  return `<div class="card"><h3>Новое дело по дому</h3>
    <div class="row"><input id="chEmoji" placeholder="🧹" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="chTitle" placeholder="Пропылесосить, полить цветы…" data-enter="choreAdd" style="flex:2 1 180px">
    <select id="chEvery" style="flex:0 1 150px">${[[1, 'Каждый день'], [2, 'Через день'], [3, 'Раз в 3 дня'], [7, 'Раз в неделю'], [14, 'Раз в 2 недели'], [30, 'Раз в месяц']].map(([v, l]) => opt(v, l, v === 7)).join('')}</select>
    ${p ? `<select id="chWho" style="flex:0 1 150px">${opt('', 'Кто свободен')}${opt(me(), 'Я')}${opt(p.id, p.display_name)}</select>` : ''}
    <button class="primary" data-act="choreAdd">+</button></div></div>
  ${p ? `<div class="card soft"><h3>За неделю</h3><div class="duo"><div class="who"><div class="small muted">${esc(S.profile?.display_name)}</div><div class="v" style="font-size:28px;font-family:var(--f-head);font-weight:700">${mine}</div></div><div class="who"><div class="small muted">${esc(p.display_name)}</div><div class="v" style="font-size:28px;font-family:var(--f-head);font-weight:700">${theirs}</div></div></div><div class="small muted" style="margin-top:8px">Не соревнование — просто чтобы видеть вклад друг друга ♡</div></div>` : ''}
  <div class="card"><h3>🏡 Дела</h3>${list.length ? list.map(c => { const n = daysUntil(c.next_date); return `<div class="item"><span class="emo">${c.emoji || '🧹'}</span><div class="body"><div class="t">${esc(c.title)}</div><div class="s"><span class="${n < 0 ? 'bad' : n === 0 ? 'warn' : ''}">${inDays(n)}</span> · раз в ${c.every_days} дн.${c.assignee ? ' · ' + esc(prof(c.assignee)?.display_name || '') : ''}</div></div><button class="sm ${n <= 0 ? 'primary' : ''}" data-act="choreDone" data-id="${c.id}">✓</button><button class="icon" data-act="choreDel" data-id="${c.id}">×</button></div>`; }).join('') : empty('Добавь регулярные дела — приложение само напомнит, когда пора ✨')}</div>
  ${log.length ? `<div class="card soft"><h3>История недели</h3>${log.slice(0, 15).map(c => `<div class="item"><span class="av ${c.user_id === me() ? 'me' : 'pt'}">${prof(c.user_id)?.emoji || '♡'}</span><div class="body"><div class="t">${esc(c.title || '')}</div><div class="s">${fmtDay(c.date)}</div></div></div>`).join('')}</div>` : ''}`;
}
A.choreAdd = async () => { const title = val('chTitle'); if (!title) return; await add('chores', { title, emoji: val('chEmoji') || '🧹', every_days: num(val('chEvery')) || 7, assignee: val('chWho') || null, next_date: today() }); toast('🏡 Добавлено'); };
A.choreDone = async el => {
  const c = S.chores.find(x => x.id === el.dataset.id); if (!c) return;
  await upd('chores', c.id, { next_date: addDays(today(), c.every_days || 7) });
  await add('chore_log', { chore_id: c.id, title: `${c.emoji || ''} ${c.title}`.trim(), user_id: me(), date: today() });
  toast('✨ Готово! Следующий раз ' + fmtDay(addDays(today(), c.every_days || 7)));
};
A.choreDel = async el => { if (confirm('Удалить дело?')) await del('chores', el.dataset.id); };

// ================= МЕНЮ НА НЕДЕЛЮ =================
function menuView(date) {
  const start = addDays(date, -weekday(date));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const slots = ['Завтрак', 'Обед', 'Ужин'];
  return `<div class="card soft"><div class="row"><button class="sm" data-act="menuWeek" data-v="-7">‹</button><b class="sp" style="text-align:center">${fmtDate(days[0])} — ${fmtDate(days[6])}</b><button class="sm" data-act="menuWeek" data-v="7">›</button></div>
    <div class="small muted" style="margin-top:6px">Планируйте блюда на неделю. Кнопка 🛒 отправит ингредиенты рецепта в список покупок.</div></div>
  ${days.map(d => { const ms = S.meal_plan.filter(m => m.date === d); return `<div class="card" style="${d === today() ? 'border-color:var(--main)' : ''}"><h3>${WD[weekday(d)]}, ${fmtDate(d)}${d === today() ? ' <span class="pill">сегодня</span>' : ''}<span class="right"><button class="sm" data-act="menuAdd" data-date="${d}">+</button></span></h3>
    ${ms.length ? slots.concat(['Перекус']).filter(s => ms.some(m => m.slot === s)).map(s => ms.filter(m => m.slot === s).map(m => { const r = S.recipes.find(x => x.id === m.recipe_id); return `<div class="item"><span class="pill">${s}</span><div class="body"><div class="t">${esc(m.title)}</div></div>${r ? `<button class="sm" data-act="menuToShop" data-id="${m.id}" title="Ингредиенты в покупки">🛒</button>` : ''}<button class="icon" data-act="menuDel" data-id="${m.id}">×</button></div>`; }).join('')).join('') : '<div class="small muted">Пока ничего не запланировано</div>'}</div>`; }).join('')}`;
}
A.menuWeek = el => { S.ui.date = addDays(S.ui.date, Number(el.dataset.v)); window.__render(); };
A.menuAdd = el => {
  const d = el.dataset.date;
  sheet(`<h2>🍳 ${WD[weekday(d)]}, ${fmtDate(d)}</h2><div class="form">
    <select id="mpSlot">${['Завтрак', 'Обед', 'Ужин', 'Перекус'].map(s => opt(s, s, s === 'Ужин')).join('')}</select>
    <input id="mpTitle" placeholder="Что готовим?" list="mpRecipes" autofocus>
    <datalist id="mpRecipes">${S.recipes.map(r => `<option value="${esc(r.name)}">`).join('')}</datalist>
    <button class="primary" data-act="menuSave" data-date="${d}">Добавить</button></div>`);
};
A.menuSave = async el => { const title = val('mpTitle'); if (!title) return; const r = S.recipes.find(x => x.name.toLowerCase() === title.toLowerCase()); await add('meal_plan', { date: el.dataset.date, slot: val('mpSlot'), title, recipe_id: r?.id || null }); closeSheet(); };
A.menuDel = async el => del('meal_plan', el.dataset.id);
A.menuToShop = async el => { const m = S.meal_plan.find(x => x.id === el.dataset.id); const r = S.recipes.find(x => x.id === m?.recipe_id); if (!r) return; const have = new Set(S.shopping.filter(s => !s.done).map(s => s.text.toLowerCase())); const items = (r.ingredients || []).map(i => i.name).filter(n => !have.has(n.toLowerCase())); if (!items.length) return toast('Всё уже в списке'); await addMany('shopping', items.map(t => ({ text: t, cat: L.guessShopCat(t), done: false, added_by: me() }))); toast(`🛒 +${items.length} в покупки`); };

// ================= КАЛЕНДАРЬ =================
function calView(date) {
  const m0 = monthStart(S.ui.calMonth || date), d0 = D(m0);
  const first = addDays(m0, -weekday(m0));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const sel = S.ui.calSel || date;
  const items = L.calendarItems(sel);
  return `<div class="card"><div class="row" style="margin-bottom:10px"><button class="sm" data-act="calMonth" data-v="-1">‹</button><h3 class="sp" style="text-align:center;text-transform:capitalize">${MONTHS[d0.getMonth()]} ${d0.getFullYear()}</h3><button class="sm" data-act="calMonth" data-v="1">›</button></div>
    <div class="cal">${WD.map(w => `<div class="wd">${w}</div>`).join('')}${cells.map(c => { const its = L.calendarItems(c); return `<div class="d ${c.slice(0, 7) !== m0.slice(0, 7) ? 'out' : ''} ${c === today() ? 'today' : ''} ${c === sel ? 'sel' : ''}" data-act="calSel" data-v="${c}"><b>${Number(c.slice(8))}</b><div class="dots">${its.slice(0, 6).map(i => `<i style="background:${i.color}"></i>`).join('')}</div></div>`; }).join('')}</div>
    <div class="row small muted" style="margin-top:10px;gap:12px">${[['var(--main)', 'задачи'], ['var(--warn)', 'платежи'], ['var(--partner)', 'даты'], ['var(--me)', 'планы'], ['var(--ok)', 'дом'], ['#f4c06f', 'меню']].map(([c, l]) => `<span><span class="dot" style="background:${c}"></span> ${l}</span>`).join('')}</div></div>
  <div class="card"><h3>${fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' })}<span class="right"><button class="sm" data-act="calAddPlan" data-v="${sel}">+ План</button></span></h3>
    ${items.length ? items.map(i => `<div class="item"><span class="dot" style="background:${i.color}"></span><div class="body"><div class="t">${esc(i.text)}</div></div></div>`).join('') : empty('Свободный день ✿')}</div>`;
}
A.calMonth = el => { S.ui.calMonth = addMonths(monthStart(S.ui.calMonth || S.ui.date), Number(el.dataset.v)); window.__render(); };
A.calSel = el => { S.ui.calSel = el.dataset.v; window.__render(); };
A.calAddPlan = async el => { const t = ask('Что планируем на ' + fmtDate(el.dataset.v) + '?'); if (t && t.trim()) { await add('plans', { title: t.trim(), date: el.dataset.v, done: false, who: me() }); toast('✎ Добавлено'); } };
