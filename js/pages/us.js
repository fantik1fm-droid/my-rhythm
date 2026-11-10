// Мы: записки и просьбы, вишлист с бронью, хроника, свидания, важные даты, планы
import { S, me, partner, prof, add, addMany, upd, del } from '../data.js';
import { A, toast, empty, tabs, sheet, closeSheet, confetti, opt, ask } from '../ui.js';
import { esc, today, addDays, fmtDate, fmtDay, inDays, daysUntil, val, num, rub, hashDay, pick, daysBetween, D } from '../util.js';
import * as L from '../logic.js';

export function render(date) {
  const tab = S.ui.usTab || 'notes';
  const p = partner();
  const unread = L.unreadNotes().length;
  const together = S.important_dates.find(d => /знаком|вместе|отношен|свадьб|годовщин/i.test(d.title));
  return (p ? `<div class="card hero"><div class="row nw" style="gap:14px"><span class="av me" style="width:48px;height:48px;font-size:26px">${S.profile?.emoji || '💜'}</span><span style="font-size:22px;color:var(--main)">♡</span><span class="av pt" style="width:48px;height:48px;font-size:26px">${p.emoji || '💜'}</span>
    <div class="sp"><h3>${esc(S.profile?.display_name)} & ${esc(p.display_name)}</h3>${together ? `<div class="small muted">Вместе ${daysBetween(together.date, today()).toLocaleString('ru-RU')} дней ♡</div>` : `<div class="small muted">Добавь дату знакомства в «Даты» — посчитаем дни вместе</div>`}</div></div></div>`
    : `<div class="card soft"><h3>💜 Пригласи партнёра</h3><div class="small" style="margin:6px 0 10px">Раздел «Мы» оживает, когда вас двое. Отправь код из настроек — партнёр введёт его после регистрации.</div><button class="primary" data-act="go" data-page="settings">Получить код</button></div>`)
    + tabs('usTab', tab, [['notes', `💌 Записки${unread ? ' · ' + unread : ''}`], ['wish', '🎁 Вишлист'], ['mem', '📸 Хроника'], ['ideas', '💡 Свидания'], ['dates', '♡ Даты'], ['plans', '✎ Планы']])
    + ({ notes, wish, mem, ideas, dates, plans }[tab])(date);
}

function notes(date) {
  const p = partner();
  const list = S.notes.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
  const q = L.QUESTIONS[((hashDay(date) + (S.ui.qShift || 0)) % L.QUESTIONS.length + L.QUESTIONS.length) % L.QUESTIONS.length];
  return `<div class="cols"><div>
    <div class="card"><h3>Написать ${p ? esc(p.display_name) : ''}</h3>
      <textarea id="nText" placeholder="Тёплые слова, благодарность, «купи хлеба» с сердечком…"></textarea>
      <div class="row" style="margin-top:8px"><button class="primary" data-act="noteSend2">💌 Отправить</button><button data-act="sendNeed">🫂 Просьба…</button></div></div>
    <div class="card">${list.length ? list.map(n => { const mine = n.from_user === me(); return `<div class="item"><span class="av ${mine ? 'me' : 'pt'}">${prof(n.from_user)?.emoji || '♡'}</span><div class="body"><div class="t" style="${n.kind === 'need' ? 'font-weight:700' : 'font-family:var(--f-hand);font-size:19px'}">${esc(n.text)}</div><div class="s">${mine ? 'ты' : esc(prof(n.from_user)?.display_name || '')} · ${fmtDay(n.created_at.slice(0, 10))}${mine ? (n.read_at ? ' · прочитано ♡' : ' · не прочитано') : ''}</div></div>${mine ? `<button class="icon" data-act="noteDel" data-id="${n.id}">×</button>` : (!n.read_at ? `<button class="sm" data-act="readNote" data-id="${n.id}">♡</button>` : '')}</div>`; }).join('') : empty('Здесь будет ваша переписка с сердечками ♡')}</div>
  </div><div>
    <div class="card soft"><h3>💬 Вопрос дня</h3><div class="hand" style="font-size:24px;margin:6px 0">${esc(q)}</div><div class="row"><button class="sm" data-act="qNext">↻ Другой</button><button class="sm" data-act="qSend" data-v="${esc(q)}">Отправить партнёру</button></div></div>
  </div></div>`;
}
A.noteSend2 = async () => { const t = val('nText'); if (!t) return; if (!partner()) return toast('Сначала пригласи партнёра'); await add('notes', { to_user: partner().id, kind: 'note', text: t, from_user: me() }); confetti(25); toast('💌 Отправлено'); };
A.noteDel = async el => del('notes', el.dataset.id);
A.qNext = () => { S.ui.qShift = (S.ui.qShift || 0) + 1; window.__render(); };
A.qSend = async el => { if (!partner()) return toast('Сначала пригласи партнёра'); await add('notes', { to_user: partner().id, kind: 'note', text: '💬 ' + el.dataset.v, from_user: me() }); toast('Вопрос отправлен ♡'); };

function wish() {
  const p = partner();
  const mine = S.wishlist.filter(w => w.who === me() && !w.done), theirs = S.wishlist.filter(w => w.who !== me() && !w.done), done = S.wishlist.filter(w => w.done).slice(0, 10);
  const row = (w, own) => `<div class="item"><span class="emo">🎁</span><div class="body"><div class="t">${esc(w.text)}${w.price ? ` <span class="muted">· ${rub(w.price)}</span>` : ''}</div>${w.link ? `<div class="s"><a href="${esc(w.link)}" target="_blank" rel="noopener">ссылка ↗</a></div>` : ''}${!own && w.reserved_by ? `<div class="s ok">${w.reserved_by === me() ? '🎀 Ты даришь это' : '🎀 Уже кто-то дарит'}</div>` : ''}</div>
    ${own ? `<button class="sm" data-act="wishDone" data-id="${w.id}" title="Сбылось">✓</button><button class="icon" data-act="wishDel" data-id="${w.id}">×</button>` : `<button class="sm ${w.reserved_by === me() ? 'primary' : ''}" data-act="wishReserve" data-id="${w.id}">${w.reserved_by === me() ? '🎀 Моё' : 'Подарю'}</button>`}</div>`;
  return `<div class="card"><h3>Хочу ✨</h3><div class="row"><input id="wText" placeholder="Что бы ты хотел(а)?" style="flex:2 1 180px" data-enter="wishAdd"><input id="wPrice" type="number" placeholder="≈ ₽" style="flex:0 1 100px"><input id="wLink" placeholder="Ссылка"><button class="primary" data-act="wishAdd">+</button></div>
    <div class="small muted" style="margin-top:6px">Партнёр может тайно «забронировать» подарок — ты не увидишь, что именно 🤫</div></div>
  <div class="cols"><div class="card"><h3>Мои желания</h3>${mine.map(w => row(w, true)).join('') || empty('Добавь пару желаний — партнёру будет проще с подарком')}</div>
  <div class="card"><h3>Желания ${p ? esc(p.display_name) : 'партнёра'}</h3>${theirs.map(w => row(w, false)).join('') || empty('Пока пусто')}</div></div>
  ${done.length ? `<div class="card soft"><h3>✓ Сбылось</h3>${done.map(w => `<div class="item done"><span class="emo">🌟</span><div class="body"><div class="t">${esc(w.text)}</div></div></div>`).join('')}</div>` : ''}`;
}
A.wishAdd = async () => { const text = val('wText'); if (!text) return; await add('wishlist', { text, who: me(), done: false, price: num(val('wPrice')) || null, link: val('wLink') || null }); toast('🎁 Добавлено'); };
A.wishDone = async el => { await upd('wishlist', el.dataset.id, { done: true }); confetti(); toast('🌟 Сбылось!'); };
A.wishDel = async el => del('wishlist', el.dataset.id);
A.wishReserve = async el => { const w = S.wishlist.find(x => x.id === el.dataset.id); if (w.reserved_by && w.reserved_by !== me()) return toast('Уже забронировано'); await upd('wishlist', w.id, { reserved_by: w.reserved_by ? null : me() }); toast(w.reserved_by ? '🎀 Забронировано — это секрет' : 'Бронь снята'); };

function mem() {
  const list = S.memories.slice().sort((a, b) => b.date.localeCompare(a.date));
  const md = today().slice(5);
  const onThisDay = list.filter(m => m.date.slice(5) === md && m.date < today());
  return `<div class="card"><h3>Новое воспоминание</h3><div class="row"><input id="mEmoji" placeholder="📸" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="mTitle" placeholder="Что случилось?" style="flex:2 1 180px"><input id="mDate" type="date" value="${today()}" style="flex:0 1 150px"></div>
    <textarea id="mText" placeholder="Пара слов, чтобы через год улыбнуться…" style="margin-top:8px"></textarea><div class="row" style="margin-top:8px"><span class="sp"></span><button class="primary" data-act="memAdd">Сохранить</button></div></div>
  ${onThisDay.length ? `<div class="card hero"><h3>✨ В этот день</h3>${onThisDay.map(m => `<div style="margin-top:8px"><b>${m.emoji || '📸'} ${esc(m.title)}</b> · ${Number(today().slice(0, 4)) - Number(m.date.slice(0, 4))} г. назад<div class="hand">${esc(m.text || '')}</div></div>`).join('')}</div>` : ''}
  <div class="card">${list.length ? `<div class="timeline">${list.map(m => `<div class="mem"><div class="small muted">${fmtDate(m.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div><div class="row nw"><b class="sp">${m.emoji || '📸'} ${esc(m.title)}</b><button class="icon" data-act="memDel" data-id="${m.id}">×</button></div>${m.text ? `<div class="hand" style="font-size:19px">${esc(m.text)}</div>` : ''}</div>`).join('')}</div>` : empty('Ваша история начинается здесь. Запишите первое воспоминание ♡')}</div>`;
}
A.memAdd = async () => { const title = val('mTitle'); if (!title) return toast('Заголовок'); await add('memories', { title, text: val('mText'), emoji: val('mEmoji') || '📸', date: val('mDate') || today(), created_by: me() }); toast('📸 Сохранено'); };
A.memDel = async el => { if (confirm('Удалить воспоминание?')) await del('memories', el.dataset.id); };

function ideas() {
  const open = S.date_ideas.filter(d => !d.done), done = S.date_ideas.filter(d => d.done).sort((a, b) => (b.done_date || '').localeCompare(a.done_date || ''));
  return `<div class="card hero" style="text-align:center"><h3>Чем заняться вместе?</h3><div id="ideaPick" class="hand" style="font-size:26px;margin:10px 0">${esc(S.ui.idea || 'Нажми кнопку ✨')}</div><button class="primary" data-act="ideaRandom">🎲 Случайная идея</button></div>
  <div class="card"><h3>Наш банк идей</h3><div class="row"><input id="iEmoji" placeholder="💡" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="iText" placeholder="Идея для свидания" style="flex:2 1 180px" data-enter="ideaAdd"><select id="iCost" style="flex:0 1 120px">${['', 'Бесплатно', '₽', '₽₽', '₽₽₽'].map(c => opt(c, c || 'Бюджет')).join('')}</select><button class="primary" data-act="ideaAdd">+</button></div>
    ${!S.date_ideas.length ? `<button class="sm ghost" style="margin-top:8px" data-act="ideaSeed">✨ Добавить 12 идей для старта</button>` : ''}
    <div style="margin-top:8px">${open.map(d => `<div class="item"><span class="emo">${d.emoji || '💡'}</span><div class="body"><div class="t">${esc(d.text)}</div>${d.cost ? `<div class="s">${esc(d.cost)}</div>` : ''}</div><button class="sm" data-act="ideaDone" data-id="${d.id}">✓ Были</button><button class="icon" data-act="ideaDel" data-id="${d.id}">×</button></div>`).join('')}</div></div>
  ${done.length ? `<div class="card soft"><h3>✓ Уже были (${done.length})</h3>${done.map(d => `<div class="item"><span class="emo">${d.emoji || '💡'}</span><div class="body"><div class="t">${esc(d.text)}</div><div class="s">${d.done_date ? fmtDate(d.done_date) : ''}</div></div></div>`).join('')}</div>` : ''}`;
}
A.ideaAdd = async () => { const text = val('iText'); if (!text) return; await add('date_ideas', { text, emoji: val('iEmoji') || '💡', cost: val('iCost') || null, done: false, created_by: me() }); };
A.ideaSeed = async () => addMany('date_ideas', L.DATE_IDEAS.map(([e, t]) => ({ emoji: e, text: t, done: false, created_by: me() })));
A.ideaRandom = () => { const open = S.date_ideas.filter(d => !d.done); const src = open.length ? open.map(d => `${d.emoji || '💡'} ${d.text}`) : L.DATE_IDEAS.map(([e, t]) => `${e} ${t}`); S.ui.idea = pick(src); window.__render(); };
A.ideaDone = async el => { const d = S.date_ideas.find(x => x.id === el.dataset.id); await upd('date_ideas', d.id, { done: true, done_date: today() }); if (confirm('Записать это в хронику воспоминаний?')) await add('memories', { title: d.text, emoji: d.emoji || '💡', date: today(), created_by: me() }); toast('♡ Здорово!'); };
A.ideaDel = async el => del('date_ideas', el.dataset.id);

function dates() {
  const list = L.upcomingDates(100);
  return `<div class="card"><h3>Новая дата</h3><div class="row"><input id="dEmoji" placeholder="♡" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="dTitle" placeholder="День знакомства, ДР мамы…" style="flex:2 1 180px"><input id="dDate" type="date" style="flex:0 1 160px"><button class="primary" data-act="dateAdd">+</button></div>
    <div class="small muted" style="margin-top:6px">Даты повторяются каждый год — приложение покажет обратный отсчёт и напомнит заранее.</div></div>
  <div class="card">${list.map(d => { const n = daysUntil(d.next); return `<div class="item"><span class="emo">${d.emoji || '♡'}</span><div class="body"><div class="t">${esc(d.title)}</div><div class="s">${fmtDate(d.next)}${d.years > 0 ? ` · исполнится ${d.years}` : ''}</div></div><span class="pill ${n <= 7 ? 'warn' : ''}">${n === 0 ? '🎉 сегодня!' : inDays(n)}</span><button class="icon" data-act="dateDel" data-id="${d.id}">×</button></div>`; }).join('') || empty('Добавьте дни рождения, годовщины и другие важные даты')}</div>`;
}
A.dateAdd = async () => { const title = val('dTitle'), date = val('dDate'); if (!title || !date) return toast('Название и дата'); await add('important_dates', { title, date, emoji: val('dEmoji') || '♡', note: '' }); };
A.dateDel = async el => { if (confirm('Удалить дату?')) await del('important_dates', el.dataset.id); };

function plans() {
  const list = S.plans.slice().sort((a, b) => (a.done - b.done) || (a.date || '9').localeCompare(b.date || '9'));
  return `<div class="card"><h3>Планы на будущее</h3><div class="row"><input id="pTitle" placeholder="Съездить на море, сделать ремонт…" style="flex:2 1 200px" data-enter="planAdd"><input id="pDate" type="date" style="flex:0 1 160px"><button class="primary" data-act="planAdd">+</button></div></div>
  <div class="card">${list.map(p => `<div class="item ${p.done ? 'done' : ''}"><input type="checkbox" ${p.done ? 'checked' : ''} data-act="planToggle" data-id="${p.id}"><div class="body"><div class="t">${esc(p.title)}</div><div class="s">${p.date ? fmtDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' }) + (daysUntil(p.date) >= 0 && !p.done ? ' · ' + inDays(daysUntil(p.date)) : '') : 'без даты'}${p.who ? ' · ' + (prof(p.who)?.emoji || '') : ''}</div></div><button class="icon" data-act="planDel" data-id="${p.id}">×</button></div>`).join('') || empty('Мечтайте вслух — запишите первый общий план ✎')}</div>`;
}
A.planAdd = async () => { const title = val('pTitle'); if (!title) return; await add('plans', { title, date: val('pDate') || null, done: false, who: me() }); };
A.planToggle = async el => { const p = S.plans.find(x => x.id === el.dataset.id); await upd('plans', p.id, { done: !p.done }); if (!p.done) { } else { confetti(); toast('✨ Сбылось!'); } };
A.planDel = async el => del('plans', el.dataset.id);
