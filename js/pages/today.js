// Сегодня — главный экран: самое важное за 10 секунд
import { S, me, partner, prof, add, upd, del } from '../data.js';
import { A, toast, empty, bar, confetti, sheet, closeSheet } from '../ui.js';
import { esc, today, addDays, fmtDate, inDays, daysUntil, rub, hashDay, val, num } from '../util.js';
import * as L from '../logic.js';

export function render(date) {
  const p = partner(), my = L.dayOf(date) || {}, pd = p ? L.dayOf(date, p.id) || {} : {};
  const h = new Date().getHours();
  const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const prog = L.dayProgress(date);
  const unread = L.unreadNotes();
  const tasks = L.tasksOn(date).sort((a, b) => a.done - b.done);
  const overdue = date === today() ? L.overdueTasks() : [];
  const habits = [...L.myHabits(), ...L.partnerShared()].filter(x => L.habitDue(x, date));
  const pays = S.payments.filter(x => x.active !== false && daysUntil(x.next_date) <= 3).sort((a, b) => a.next_date.localeCompare(b.next_date));
  const chores = L.choresDue(date);
  const shopLeft = S.shopping.filter(s => !s.done).length;
  const dates = L.upcomingDates(3).filter(d => daysUntil(d.next) <= 14);
  const meals = S.meal_plan.filter(m => m.date === date);
  const q = L.QUESTIONS[((hashDay(date) % L.QUESTIONS.length) + L.QUESTIONS.length) % L.QUESTIONS.length];
  const glass = S.goals.glass || 250, goalW = S.goals.water || 2000, water = my.water || 0;

  return `
  <div class="card hero"><div class="hero-in"><div class="txt">
    <div class="muted small">${S.profile?.emoji || '💜'} ${esc(S.profile?.display_name || '')}</div>
    <h2>${greet}!</h2>
    <div class="hand" style="margin-top:4px">${esc(q)}</div>
    <div class="chips" style="margin-top:10px">
      ${L.bestStreak() ? `<span class="pill">🔥 ${L.bestStreak()} дн.</span>` : ''}
      <span class="pill">💰 ${rub(L.balance())}</span>
      ${shopLeft ? `<span class="pill" data-act="go" data-page="home" data-tab="shop">🛒 ${shopLeft} в списке</span>` : ''}
    </div>
  </div><div class="ring" style="--p:${prog}"><span><div>${prog}%<small>день</small></div></span></div></div></div>

  ${unread.map(n => `<div class="card" style="padding:12px"><div class="row nw"><div class="body" style="flex:1"><div class="small muted">${n.kind === 'need' ? 'Просьба' : 'Записка'} от ${esc(prof(n.from_user)?.display_name || p?.display_name || 'партнёра')} · ${fmtDate(n.created_at.slice(0, 10))}</div>
    <div class="note-card ${n.kind === 'need' ? 'need' : ''}" style="margin-top:6px">${esc(n.text)}</div></div></div>
    <div class="row" style="margin-top:8px"><button class="sm primary" data-act="readNote" data-id="${n.id}">💜 Прочитано</button><button class="sm" data-act="replyNote" data-id="${n.id}">Ответить</button></div></div>`).join('')}

  <div class="cols"><div>
    <div class="card">
      <h3>Как ты?<span class="right small muted">${date === today() ? 'сегодня' : fmtDate(date)}</span></h3>
      <div class="mood-pick">${L.MOODS.map(([e, t]) => `<button class="${my.mood === e ? 'on' : ''}" title="${t}" data-act="setDay" data-k="mood" data-v="${e}">${e}</button>`).join('')}</div>
      <div class="mood-pick" style="margin-top:6px">${L.ENERGY.map(([e, t], i) => `<button class="${my.energy === i + 1 ? 'on' : ''}" title="${t}" data-act="setDay" data-k="energy" data-v="${i + 1}">${e}</button>`).join('')}</div>
      ${p ? `<div class="duo" style="margin-top:12px">
        <div class="who"><div class="small muted">${esc(p.display_name)}</div><div style="font-size:24px">${pd.mood || '·'} ${pd.energy ? L.ENERGY[pd.energy - 1][0] : ''}</div><div class="small muted">${pd.mood ? (L.MOODS.find(m => m[0] === pd.mood)?.[1] || '') : 'ещё не отметил(а)'}</div></div>
        <div class="who" style="display:flex;flex-direction:column;gap:6px;justify-content:center"><button class="sm" data-act="sendNeed">💌 Записка / просьба</button></div>
      </div>` : `<div class="msg info" style="margin-top:12px">Пригласи партнёра в «Наш дом» — в настройках есть код ♡ <button class="sm" data-act="go" data-page="settings">Открыть</button></div>`}
    </div>

    <div class="card">
      <h3>Задачи<span class="right"><button class="sm ghost" data-act="go" data-page="home" data-tab="tasks">все →</button></span></h3>
      <div class="row nw"><input id="tdTask" placeholder="Что сделать?" data-enter="todayTask"><button class="primary" data-act="todayTask">+</button></div>
      ${overdue.length ? `<div class="row" style="margin-top:10px"><span class="pill warn">⏰ Просрочено: ${overdue.length}</span><button class="sm" data-act="moveOverdue">Перенести на сегодня</button></div>` : ''}
      <div style="margin-top:6px">${tasks.length ? tasks.slice(0, 8).map(taskRow).join('') : empty('На сегодня задач нет — можно выдохнуть ✿')}</div>
      ${tasks.length > 8 ? `<div class="small muted">и ещё ${tasks.length - 8}…</div>` : ''}
    </div>

    <div class="card">
      <h3>Привычки<span class="right"><button class="sm ghost" data-act="go" data-page="habits">все →</button></span></h3>
      ${habits.length ? habits.map(x => habitBtn(x, date)).join('') : empty('Добавь первую привычку — маленькую, на 2 минуты ✦')}
    </div>
  </div><div>
    <div class="card">
      <h3>Вода 💧<span class="right small muted">${water} / ${goalW} мл</span></h3>
      <div class="glasses">${Array.from({ length: Math.min(16, Math.ceil(goalW / glass)) }, (_, i) => `<button class="glass ${water >= (i + 1) * glass ? 'full' : ''}" data-act="setDay" data-k="water" data-v="${water >= (i + 1) * glass ? i * glass : (i + 1) * glass}" aria-label="стакан ${i + 1}"></button>`).join('')}</div>
      <div class="row"><button data-act="water" data-v="${glass}">+ ${glass}</button><button class="ghost" data-act="water" data-v="${-glass}">− ${glass}</button></div>
    </div>

    ${pays.length ? `<div class="card"><h3>📅 Скоро платить</h3>${pays.map(x => `<div class="item"><span class="emo">${x.emoji || '📅'}</span><div class="body"><div class="t">${esc(x.name)}</div><div class="s ${daysUntil(x.next_date) < 0 ? 'bad' : ''}">${inDays(daysUntil(x.next_date))}</div></div><span class="amt">${rub(x.amount)}</span><button class="sm primary" data-act="payPaid" data-id="${x.id}">✓</button></div>`).join('')}</div>` : ''}

    ${chores.length ? `<div class="card"><h3>🏡 По дому</h3>${chores.map(c => `<div class="item"><span class="emo">${c.emoji || '🧹'}</span><div class="body"><div class="t">${esc(c.title)}</div><div class="s">${c.assignee ? (c.assignee === me() ? 'твоё' : esc(prof(c.assignee)?.display_name || 'партнёр')) : 'кто свободен'} · ${inDays(daysUntil(c.next_date))}</div></div><button class="sm primary" data-act="choreDone" data-id="${c.id}">✓ Сделано</button></div>`).join('')}</div>` : ''}

    ${meals.length ? `<div class="card"><h3>🍳 Сегодня едим</h3>${meals.map(m => `<div class="item"><span class="emo">🍽</span><div class="body"><div class="t">${esc(m.title)}</div><div class="s">${esc(m.slot)}</div></div></div>`).join('')}</div>` : ''}

    ${dates.length ? `<div class="card soft"><h3>♡ Скоро</h3>${dates.map(d => `<div class="item"><span class="emo">${d.emoji || '♡'}</span><div class="body"><div class="t">${esc(d.title)}</div><div class="s">${fmtDate(d.next)}${d.years > 0 ? ` · ${d.years}-я годовщина` : ''}</div></div><span class="pill">${inDays(daysUntil(d.next))}</span></div>`).join('')}</div>` : ''}

    <div class="card">
      <h3>Победа дня ♡</h3>
      <textarea id="tdNote" placeholder="Даже маленькая важна…" data-chg="saveDayNote">${esc(my.note || '')}</textarea>
    </div>
  </div></div>`;
}

export function taskRow(t) {
  const who = t.shared ? (t.assignee ? (t.assignee === me() ? '<span class="pill me">мне</span>' : `<span class="pill pt">${esc(prof(t.assignee)?.emoji || '♡')}</span>`) : '<span class="pill">общая</span>') : '';
  return `<div class="item ${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} data-act="toggleTask" data-id="${t.id}"><div class="body" data-act="editTask" data-id="${t.id}"><div class="t">${esc(t.text)}</div>${t.repeat || t.shared || t.date !== today() ? `<div class="s">${t.repeat ? '↻ ' + L.REPEATS[t.repeat] + ' ' : ''}${t.date && t.date !== today() ? fmtDate(t.date) : ''}</div>` : ''}</div>${who}</div>`;
}
export function habitBtn(h, date) {
  const mine = h.user_id === me();
  const v = L.habitValue(h, date), done = L.habitDone(h, date);
  const cnt = h.kind === 'count' ? `${v}/${h.target}${h.unit ? ' ' + esc(h.unit) : ''}` : (L.habitStreak(h) ? '🔥 ' + L.habitStreak(h) : '');
  const pDone = !mine || h.shared ? (() => { const other = mine ? partner()?.id : h.user_id; return other ? L.habitDone(h, date, other) : null; })() : null;
  return `<button class="hbtn ${done ? 'done' : ''}" data-act="markHabit" data-id="${h.id}" data-date="${date}"><span class="chk">${done ? '✓' : ''}</span><span>${h.emoji || '✦'} ${esc(h.name)}</span>${pDone !== null ? `<span class="pill ${pDone ? 'ok' : ''}" title="партнёр">${pDone ? '♡✓' : '♡'}</span>` : ''}<span class="cnt">${cnt}</span></button>`;
}

// ---------- действия ----------
A.setDay = async el => { await setDay(el.dataset.k, el.dataset.k === 'energy' ? Number(el.dataset.v) : el.dataset.k === 'water' ? Number(el.dataset.v) : el.dataset.v); };
A.water = async el => { const d = L.dayOf(S.ui.date) || {}; const w = Math.max(0, (d.water || 0) + Number(el.dataset.v)); await setDay('water', w); if (w >= (S.goals.water || 2000) && (d.water || 0) < (S.goals.water || 2000)) { confetti(40); toast('💧 Норма воды выполнена!'); } };
A.saveDayNote = async el => { await setDay('note', el.value.trim()); toast('♡ Сохранено'); };
export async function setDay(k, v) {
  const d = L.dayOf(S.ui.date);
  if (d) return upd('days', d.id, { [k]: v });
  return add('days', { date: S.ui.date, [k]: v });
}
A.todayTask = async () => { const text = val('tdTask'); if (!text) return; await add('tasks', { date: S.ui.date, text, tag: 'other', done: false }); const el = document.getElementById('tdTask'); if (el) { el.value = ''; el.focus(); } };
A.moveOverdue = async () => { for (const t of L.overdueTasks()) await upd('tasks', t.id, { date: today() }); toast('→ Перенесено на сегодня'); };
A.readNote = async el => { await upd('notes', el.dataset.id, { read_at: new Date().toISOString() }); };
A.replyNote = async el => { await A.readNote(el); A.sendNeed(); };
A.sendNeed = () => {
  const p = partner(); if (!p) return toast('Сначала пригласи партнёра ♡');
  sheet(`<h2>💌 Для ${esc(p.display_name)}</h2>
  <div class="small muted" style="margin-bottom:8px">Быстрая просьба — партнёр увидит её сразу:</div>
  <div class="chips">${L.NEEDS.map(([e, t]) => `<button class="chip" data-act="needSend" data-v="${e} ${t}">${e} ${t}</button>`).join('')}</div>
  <div class="form" style="margin-top:14px"><textarea id="noteText" placeholder="Или напиши записку…" autofocus></textarea><button class="primary" data-act="noteSend">Отправить записку</button></div>`);
};
A.needSend = async el => { await add('notes', { to_user: partner()?.id, kind: 'need', text: el.dataset.v, from_user: me() }); closeSheet(); toast('💌 Отправлено'); };
A.noteSend = async () => { const t = val('noteText'); if (!t) return; await add('notes', { to_user: partner()?.id, kind: 'note', text: t, from_user: me() }); closeSheet(); confetti(30); toast('💌 Записка отправлена'); };
