// Привычки: гибкий график, количественные, челленджи вдвоём, тепловая карта
import { S, me, partner, prof, add, upd, del } from '../data.js';
import { A, toast, empty, sheet, closeSheet, confetti, opt, bar } from '../ui.js';
import { esc, today, addDays, fmtDate, val, num, weekday, WD, range, pct, plural } from '../util.js';
import * as L from '../logic.js';
import { habitBtn } from './today.js';

export function render(date) {
  const mine = L.myHabits(), shared = L.partnerShared(), p = partner();
  const due = [...mine, ...shared].filter(h => L.habitDue(h, date));
  const from = addDays(today(), -83);
  const days = range(addDays(from, -weekday(from)), today());
  const heat = days.map(d => { const s = L.dayHabitScore(d); const r = s.due ? s.done / s.due : 0; const lvl = !s.done ? 0 : r < .34 ? 1 : r < .67 ? 2 : r < 1 ? 3 : 4; return `<i class="l${lvl}" title="${d}: ${s.done}/${s.due}"></i>`; }).join('');
  const challenges = [...mine, ...shared].filter(h => h.challenge_days);
  return `<div class="cols"><div>
    <div class="card"><h3>${date === today() ? 'Сегодня' : fmtDate(date)}<span class="right"><button class="sm primary" data-act="habitNew">+ Привычка</button></span></h3>
      ${due.length ? due.map(h => habitBtn(h, date)).join('') : empty('На этот день привычек нет')}</div>
    ${challenges.length ? `<div class="card hero"><h3>🏆 Челленджи</h3>${challenges.map(h => { const end = addDays(h.start_date, h.challenge_days - 1); const ds = range(h.start_date, today() < end ? today() : end); const me1 = ds.filter(d => L.habitDone(h, d)).length; const other = h.user_id === me() ? p?.id : h.user_id; const pt = h.shared && other ? ds.filter(d => L.habitDone(h, d, other)).length : null;
      return `<div style="margin-top:10px"><div class="row nw"><b class="sp">${h.emoji || '✦'} ${esc(h.name)}</b><span class="small muted">${today() > end ? 'завершён' : 'до ' + fmtDate(end)}</span></div>
      <div class="small">Ты: ${me1}/${h.challenge_days}</div>${bar(me1 / h.challenge_days)}${pt !== null ? `<div class="small" style="margin-top:4px">${esc(prof(other)?.display_name || 'Партнёр')}: ${pt}/${h.challenge_days}</div>${bar(pt / h.challenge_days, 'warn')}` : ''}</div>`; }).join('')}</div>` : ''}
    <div class="card"><h3>Все привычки</h3>${[...mine, ...shared].map(h => { const st = L.habitStreak(h), r = L.habitRate(h, 30); const wk = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
      return `<div class="item"><span class="emo">${h.emoji || '✦'}</span><div class="body"><div class="t">${esc(h.name)} ${h.shared ? `<span class="pill ${h.user_id === me() ? '' : 'pt'}">${h.user_id === me() ? 'общая' : 'от ' + esc(prof(h.user_id)?.display_name || '')}</span>` : ''}</div>
        <div class="s">${schedText(h)} · 🔥 ${st} · ${Math.round(r * 100)}% за 30 дн.</div><div class="week-dots" style="margin-top:4px">${wk.map(d => `<i class="${L.habitDone(h, d) ? 'on' : ''} ${L.habitDue(h, d) ? '' : 'off'}" title="${d}"></i>`).join('')}</div></div>
        ${h.user_id === me() ? `<button class="icon" data-act="habitEdit" data-id="${h.id}">✎</button>` : ''}</div>`; }).join('') || empty('Начни с одной маленькой привычки: «стакан воды утром», «10 минут чтения» ✦')}</div>
  </div><div>
    <div class="card"><h3>12 недель</h3><div class="heat">${WD.map(w => `<span class="small muted" style="text-align:center">${w[0]}</span>`).join('')}${heat}</div>
      <div class="small muted" style="margin-top:8px">Чем темнее — тем больше привычек выполнено в этот день</div></div>
    <div class="card soft"><h3>Почему это работает</h3><div class="small">Не нужно быть идеальным. Пропустил день — не страшно, главное не пропускать два подряд. Маленькие шаги каждый день сильнее больших рывков раз в месяц ✦</div></div>
  </div></div>`;
}
const schedText = h => { const w = h.weekdays; let s = !w || !w.length || w.length === 7 ? 'каждый день' : w.length === 5 && !w.includes(5) && !w.includes(6) ? 'по будням' : w.map(i => WD[i]).join(', '); if (h.kind === 'count') s += ` · цель ${h.target}${h.unit ? ' ' + h.unit : ''}`; if (h.challenge_days) s += ` · челлендж ${h.challenge_days} дн.`; return esc(s); };

A.markHabit = async el => {
  const h = S.habits.find(x => x.id === el.dataset.id), date = el.dataset.date; if (!h) return;
  const m = L.markOf(h.id, date);
  if (h.kind === 'count') {
    const v = (m ? Number(m.value || 0) : 0) + 1, wasDone = L.habitDone(h, date);
    if (m) await upd('habit_marks', m.id, { value: v, done: true }); else await add('habit_marks', { habit_id: h.id, date, done: true, value: 1 });
    if (!wasDone && L.habitDone(h, date)) { confetti(30); toast(`${h.emoji || '✦'} Цель на день выполнена!`); }
    return;
  }
  if (m) await upd('habit_marks', m.id, { done: !(m.done !== false), value: 1 });
  else { await add('habit_marks', { habit_id: h.id, date, done: true, value: 1 }); const st = L.habitStreak(h); if ([7, 21, 30, 66, 100].includes(st)) { confetti(); toast(`🔥 ${st} ${plural(st, 'день', 'дня', 'дней')} подряд!`); } }
};
function habitForm(h = {}) {
  const w = h.weekdays || [];
  return `<h2>${h.id ? 'Привычка' : 'Новая привычка'}</h2><div class="form">
    <div class="row nw"><input id="hbEmoji" value="${esc(h.emoji || '')}" placeholder="✦" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="hbName" value="${esc(h.name || '')}" placeholder="Например: 10 минут чтения" autofocus></div>
    <label class="f">Тип<select id="hbKind">${opt('check', 'Да / нет', h.kind !== 'count')}${opt('count', 'Количество (стаканы, страницы…)', h.kind === 'count')}</select></label>
    <div class="row"><input id="hbTarget" type="number" value="${h.target || ''}" placeholder="Цель в день (для количества)"><input id="hbUnit" value="${esc(h.unit || '')}" placeholder="ед. (стак., стр.)"></div>
    <div class="small muted">Дни недели (не выбрано = каждый день)</div>
    <div class="chips" id="hbDays">${WD.map((d, i) => `<button class="chip ${w.includes(i) ? 'on' : ''}" data-act="toggleChip" data-v="${i}">${d}</button>`).join('')}</div>
    <label class="f">Челлендж<select id="hbCh">${[['', 'Без срока'], [7, '7 дней'], [21, '21 день'], [30, '30 дней'], [66, '66 дней'], [100, '100 дней']].map(([v, l]) => opt(v, l, String(h.challenge_days || '') === String(v))).join('')}</select></label>
    ${partner() ? `<label class="row"><input type="checkbox" id="hbShared" ${h.shared ? 'checked' : ''}> Общая — ${esc(partner().display_name)} тоже сможет отмечать</label>` : ''}
    <div class="row"><button class="primary" data-act="habitSave" data-id="${h.id || ''}">Сохранить</button>${h.id ? `<span class="sp"></span><button data-act="habitArchive" data-id="${h.id}">В архив</button><button class="danger" data-act="habitDel" data-id="${h.id}">Удалить</button>` : ''}</div></div>`;
}
A.toggleChip = el => el.classList.toggle('on');
A.habitNew = () => sheet(habitForm());
A.habitEdit = el => sheet(habitForm(S.habits.find(x => x.id === el.dataset.id)));
A.habitSave = async el => {
  const name = val('hbName'); if (!name) return toast('Название');
  const kind = val('hbKind');
  const weekdays = [...document.querySelectorAll('#hbDays .chip.on')].map(c => Number(c.dataset.v));
  const row = { name, emoji: val('hbEmoji') || '✦', kind, target: kind === 'count' ? Math.max(1, num(val('hbTarget')) || 1) : 1, unit: val('hbUnit') || null, weekdays: weekdays.length && weekdays.length < 7 ? weekdays : null, challenge_days: num(val('hbCh')) || null, shared: !!document.getElementById('hbShared')?.checked };
  if (el.dataset.id) await upd('habits', el.dataset.id, row); else await add('habits', { ...row, start_date: today(), archived: false });
  closeSheet(); toast('✦ Сохранено');
};
A.habitArchive = async el => { await upd('habits', el.dataset.id, { archived: true }); closeSheet(); toast('В архиве'); };
A.habitDel = async el => { if (!confirm('Удалить привычку и все отметки?')) return; await del('habits', el.dataset.id); S.habit_marks = S.habit_marks.filter(m => m.habit_id !== el.dataset.id); closeSheet(); };
