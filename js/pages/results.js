// Итоги: неделя/месяц/год, графики, достижения, отчёт для отправки
import { S, me, partner } from '../data.js';
import { A, toast, empty, seg, stat, sheet } from '../ui.js';
import { esc, today, addDays, fmtDate, range, sum, rub, kfmt, monthStart, monthEnd, addMonths, MONTHS, D, pct } from '../util.js';
import * as L from '../logic.js';

function period(date) {
  const p = S.ui.resP || 'week';
  if (p === 'week') return { p, from: addDays(date, -6), to: date, label: 'неделю' };
  if (p === 'month') return { p, from: monthStart(date), to: monthEnd(date) < today() ? monthEnd(date) : date, label: MONTHS[D(date).getMonth()] };
  return { p, from: addDays(date, -364), to: date, label: 'год' };
}
export function stats(date) {
  const { from, to } = period(date), days = range(from, to);
  const tasks = S.tasks.filter(t => t.user_id === me() && t.date >= from && t.date <= to);
  const hs = days.map(d => L.dayHabitScore(d)), hd = sum(hs, h => h.done), hdue = sum(hs, h => h.due);
  const dd = S.days.filter(d => d.user_id === me() && d.date >= from && d.date <= to);
  const water = sum(dd, d => d.water), waterOk = dd.filter(d => (d.water || 0) >= (S.goals.water || 2000)).length;
  const sleep = dd.filter(d => d.sleep > 0);
  const tx = L.txIn(from, to), inc = sum(tx.filter(t => t.type === 'income'), t => t.amount), exp = sum(tx.filter(t => t.type === 'expense'), t => t.amount);
  const cats = {}; tx.filter(t => t.type === 'expense').forEach(t => cats[t.category] = (cats[t.category] || 0) + Number(t.amount));
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const moods = dd.filter(d => d.mood).map(d => d.mood); const moodTop = Object.entries(moods.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])[0];
  const wins = dd.filter(d => d.note).sort((a, b) => b.date.localeCompare(a.date));
  const kcal = days.map(d => L.kcalOn(d).k);
  const kDays = kcal.filter(k => k > 0);
  const best = days.map(d => ({ d, p: L.dayProgress(d) })).sort((a, b) => b.p - a.p)[0];
  const chores = S.chore_log.filter(c => c.user_id === me() && c.date >= from && c.date <= to).length;
  const notes = S.notes.filter(n => n.from_user === me() && n.created_at.slice(0, 10) >= from && n.created_at.slice(0, 10) <= to).length;
  return { days, tasksDone: tasks.filter(t => t.done).length, tasksAll: tasks.length, hd, hdue, water, waterOk, sleepAvg: sleep.length ? sum(sleep, d => d.sleep) / sleep.length : 0, inc, exp, top, moodTop, wins, kcal, kAvg: kDays.length ? sum(kDays) / kDays.length : 0, best, chores, notes, dd };
}

export function render(date) {
  const per = period(date), s = stats(date);
  const max = Math.max(1, ...s.kcal);
  const spend = s.days.map(d => sum(L.txIn(d, d).filter(t => t.type === 'expense'), t => t.amount)), smax = Math.max(1, ...spend);
  const showBars = s.days.length <= 31;
  const ach = L.achievements();
  return `<div class="row" style="margin-bottom:14px">${seg('resP', per.p, [['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']])}<span class="sp"></span><button class="sm primary" data-act="shareReport">💌 Поделиться итогами</button></div>
  <div class="grid g4" style="margin-bottom:14px">
    ${stat('✓ Задачи', `${s.tasksDone}/${s.tasksAll}`, `${pct(s.tasksDone, s.tasksAll)}%`, s.tasksAll ? s.tasksDone / s.tasksAll : 0)}
    ${stat('✦ Привычки', `${pct(s.hd, s.hdue)}%`, `${s.hd} из ${s.hdue}`, s.hdue ? s.hd / s.hdue : 0)}
    ${stat('💧 Вода', (s.water / 1000).toFixed(1) + ' л', `норма ${s.waterOk} дн.`)}
    ${stat('💸 Расходы', rub(s.exp), `доходы ${rub(s.inc)}`)}
  </div>
  <div class="cols"><div>
    ${showBars ? `<div class="card"><h3>Траты по дням</h3><div class="bars">${s.days.map((d, i) => `<div data-act="dayDetail" data-v="${d}" title="${d}: ${Math.round(spend[i])} ₽"><small>${spend[i] ? kfmt(spend[i]) : ''}</small><i style="height:${spend[i] / smax * 95}%"></i><small>${d.slice(8)}</small></div>`).join('')}</div></div>
    <div class="card"><h3>Калории по дням</h3><div class="bars">${s.days.map((d, i) => `<div class="${s.kcal[i] && Math.abs(s.kcal[i] - S.goals.k) < S.goals.k * .1 ? 'hit' : ''}" data-act="dayDetail" data-v="${d}"><small>${s.kcal[i] ? kfmt(s.kcal[i]) : ''}</small><i style="height:${s.kcal[i] / max * 95}%"></i><small>${d.slice(8)}</small></div>`).join('')}</div><div class="small muted">Среднее ${Math.round(s.kAvg)} ккал · тёмные — в пределах ±10% от цели</div></div>` : ''}
    <div class="card"><h3>🏅 Достижения<span class="right pill">${ach.filter(a => a.ok).length}/${ach.length}</span></h3><div class="ach">${ach.map(a => `<div class="${a.ok ? '' : 'lock'}" title="${esc(a.d)}"><b>${a.e}</b>${esc(a.t)}<div class="muted" style="font-size:10.5px">${esc(a.d)}</div></div>`).join('')}</div></div>
  </div><div>
    <div class="card hero"><h3>Главное за ${per.label}</h3>
      ${s.best && s.best.p ? `<div style="margin-top:8px">🌟 Лучший день — <b>${fmtDate(s.best.d)}</b> (${s.best.p}%)</div>` : ''}
      ${s.moodTop ? `<div>Чаще всего настроение: <span style="font-size:20px">${s.moodTop[0]}</span></div>` : ''}
      ${s.sleepAvg ? `<div>😴 Сон в среднем: ${s.sleepAvg.toFixed(1)} ч</div>` : ''}
      ${s.top.length ? `<div>💸 Больше всего ушло на: ${s.top.map(([c, v]) => `${esc(c)} (${rub(v)})`).join(', ')}</div>` : ''}
      ${s.chores ? `<div>🏡 Дел по дому: ${s.chores}</div>` : ''}${s.notes ? `<div>💌 Записок партнёру: ${s.notes}</div>` : ''}
    </div>
    <div class="card"><h3>♡ Победы</h3>${s.wins.length ? s.wins.slice(0, 12).map(d => `<div class="item"><div class="body"><div class="t hand" style="font-size:19px">${esc(d.note)}</div><div class="s">${fmtDate(d.date)}</div></div></div>`).join('') : empty('Записывай «победу дня» на главной — здесь соберётся твой список гордости')}</div>
  </div></div>`;
}
A.shareReport = async () => {
  const s = stats(S.ui.date), per = period(S.ui.date);
  const text = `💜 Мой Ритм — итоги за ${per.label}\n\n✓ Задачи: ${s.tasksDone}/${s.tasksAll}\n✦ Привычки: ${pct(s.hd, s.hdue)}%\n💧 Вода: ${(s.water / 1000).toFixed(1)} л\n💸 Расходы: ${rub(s.exp)} · доходы ${rub(s.inc)}${s.best?.p ? `\n🌟 Лучший день: ${fmtDate(s.best.d)}` : ''}${s.wins[0] ? `\n♡ Победа: ${s.wins[0].note}` : ''}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Скопировано — можно вставить в мессенджер'); } } catch { }
};
A.dayDetail = el => {
  const d = el.dataset.v, dd = L.dayOf(d) || {}, ms = L.mealsOn(d), ts = L.tasksOn(d), tx = L.txIn(d, d);
  sheet(`<h2>${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
  <div class="grid g3">${stat('Настроение', dd.mood || '—')}${stat('Вода', (dd.water || 0) + ' мл')}${stat('Ккал', Math.round(L.kcalOn(d).k))}</div>
  <h3 style="margin-top:14px">Задачи</h3>${ts.map(t => `<div class="item ${t.done ? 'done' : ''}"><div class="body"><div class="t">${t.done ? '✓' : '○'} ${esc(t.text)}</div></div></div>`).join('') || '<div class="small muted">—</div>'}
  <h3 style="margin-top:14px">Еда</h3>${ms.map(m => `<div class="item"><div class="body"><div class="t">${esc(m.type)} · ${esc(m.name)}</div></div><span class="amt">${Math.round(m.k)}</span></div>`).join('') || '<div class="small muted">—</div>'}
  <h3 style="margin-top:14px">Деньги</h3>${tx.map(t => `<div class="item"><div class="body"><div class="t">${esc(t.category)} ${t.note ? '· ' + esc(t.note) : ''}</div></div><span class="amt ${t.type === 'income' ? 'in' : 'out'}">${rub(t.amount)}</span></div>`).join('') || '<div class="small muted">—</div>'}
  ${dd.note ? `<h3 style="margin-top:14px">Победа дня</h3><div class="hand">${esc(dd.note)}</div>` : ''}`);
};
