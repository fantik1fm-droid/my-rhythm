// Деньги: обзор, бюджеты, операции, счета, регулярные платежи, цели, импорт
import { S, me, partner, prof, add, addMany, upd, del } from '../data.js';
import { A, toast, empty, tabs, sheet, closeSheet, confetti, opt, bar, stat, ask } from '../ui.js';
import { esc, today, addDays, fmtDate, fmtDay, inDays, daysUntil, val, num, rub, kfmt, sum, monthStart, monthEnd, addMonths, MONTHS, D, groupBy, payDateIn, parseCSV, pct } from '../util.js';
import * as L from '../logic.js';

export function render(date) {
  const tab = S.ui.moneyTab || 'overview';
  return tabs('moneyTab', tab, [['overview', '📊 Обзор'], ['ops', '📋 Операции'], ['budget', '🎯 Бюджет'], ['regular', '🔁 Регулярные'], ['goals', '🌊 Копилки'], ['accounts', '💳 Счета']])
    + ({ overview, ops, budget, regular, goals, accounts }[tab])(date);
}

function overview(date) {
  const m = L.monthTotals(date), prev = L.monthTotals(addMonths(date, -1));
  const cats = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]);
  const tot = m.expense || 1;
  let acc = 0; const donut = cats.length ? cats.map(([c, s], i) => { const a = acc; acc += s / tot * 100; return `${L.CAT_COLORS[i % L.CAT_COLORS.length]} ${a}% ${acc}%`; }).join(',') : 'var(--line) 0 100%';
  const monthName = MONTHS[D(date).getMonth()];
  const upcoming = S.payments.filter(p => p.active !== false && daysUntil(p.next_date) >= 0 && daysUntil(p.next_date) <= 14);
  const dayOfMonth = Number(date.slice(8)), daysInMonth = Number(monthEnd(date).slice(8));
  const forecast = date.slice(0, 7) === today().slice(0, 7) && dayOfMonth > 3 ? m.expense / dayOfMonth * daysInMonth : null;
  const insights = [];
  for (const [c, s] of cats.slice(0, 5)) { const ps = prev.byCat[c] || 0; if (ps > 0 && s > ps * 1.25 && s - ps > 1000) insights.push(`📈 На «${c}» уже на ${pct(s - ps, ps)}% больше, чем в прошлом месяце`); }
  const overB = S.budgets.filter(b => (m.byCat[b.category] || 0) > Number(b.amount));
  overB.forEach(b => insights.push(`⚠️ Бюджет «${b.category}» превышен на ${rub((m.byCat[b.category] || 0) - b.amount)}`));
  if (prev.expense && m.expense < prev.expense * .8 && dayOfMonth > 20) insights.push('🌱 Тратите заметно меньше, чем в прошлом месяце — так держать!');
  return `<div class="card wallet">
    <div class="muted small">Всего на счетах</div><div class="big">${rub(L.balance())}</div>
    <div class="grid g3" style="margin-top:14px">
      ${stat('Доходы · ' + monthName, rub(m.income))}${stat('Расходы', rub(m.expense), prev.expense ? `прошлый: ${rub(prev.expense)}` : '')}${stat('Итог месяца', rub(m.net, true), forecast ? `прогноз трат: ${rub(forecast)}` : '')}
    </div>
    <div class="row" style="margin-top:14px"><button class="primary" data-act="quickTx" data-type="expense">− Расход</button><button data-act="quickTx" data-type="income">+ Доход</button><button data-act="quickTx" data-type="transfer">⇄ Перевод</button></div>
  </div>
  ${insights.length ? `<div class="card soft">${insights.map(i => `<div style="padding:4px 0">${esc(i)}</div>`).join('')}</div>` : ''}
  <div class="cols"><div class="card"><h3>Расходы по категориям</h3>
    ${cats.length ? `<div class="row nw" style="gap:18px;align-items:center;flex-wrap:wrap"><div class="donut" style="background:conic-gradient(${donut})"><div>${kfmt(m.expense)}<br><small class="muted small">₽</small></div></div>
    <div style="flex:1;min-width:180px">${cats.slice(0, 9).map(([c, s], i) => { const b = S.budgets.find(x => x.category === c); return `<div class="item" style="padding:6px 0" data-act="catDetail" data-v="${esc(c)}"><span class="dot" style="background:${L.CAT_COLORS[i % L.CAT_COLORS.length]}"></span><div class="body"><div class="t">${L.CAT_EMO[c] || ''} ${esc(c)}</div>${b ? bar(s / b.amount, s > b.amount ? 'bad' : s > b.amount * .8 ? 'warn' : 'ok') : ''}</div><span class="nowrap small"><b>${rub(s)}</b>${b ? ` / ${kfmt(b.amount)}` : ''}</span></div>`; }).join('')}</div></div>` : empty('В этом месяце расходов пока нет')}
  </div><div>
    <div class="card"><h3>Ближайшие платежи</h3>${upcoming.length ? upcoming.map(payRow).join('') : empty('В ближайшие 2 недели платежей нет')}</div>
    <div class="card"><h3>Последние операции<span class="right"><button class="sm ghost" data-act="setUi" data-k="moneyTab" data-v="ops">все →</button></span></h3>${S.transactions.slice(0, 6).map(txRow).join('') || empty('Пока пусто')}</div>
  </div></div>`;
}

const txRow = t => {
  const who = prof(t.who);
  const isT = t.type === 'transfer';
  return `<div class="item" data-act="txEdit" data-id="${t.id}"><span class="emo">${isT ? '⇄' : L.CAT_EMO[t.category] || '•'}</span><div class="body"><div class="t">${isT ? `${esc(L.accountName(t.account_id))} → ${esc(L.accountName(t.to_account_id))}` : esc(t.category)}${t.note ? ` <span class="muted">· ${esc(t.note)}</span>` : ''}</div><div class="s">${fmtDay(t.date)}${who ? ' · ' + (who.emoji || '') : ''}</div></div><span class="amt ${t.type === 'income' ? 'in' : isT ? '' : 'out'}">${t.type === 'income' ? '+' : isT ? '' : '−'}${rub(t.amount)}</span></div>`;
};
function ops(date) {
  const f = S.ui.txF || 'all', q = (S.ui.txQ || '').toLowerCase(), mon = S.ui.txMonth || date.slice(0, 7);
  let list = S.transactions.filter(t => t.date.slice(0, 7) === mon);
  if (f === 'expense' || f === 'income' || f === 'transfer') list = list.filter(t => t.type === f);
  if (f === 'me') list = list.filter(t => t.who === me()); if (f === 'partner') list = list.filter(t => t.who && t.who !== me());
  if (q) list = list.filter(t => (t.category + ' ' + (t.note || '')).toLowerCase().includes(q));
  const g = groupBy(list, t => t.date);
  const months = [...new Set([today().slice(0, 7), ...S.transactions.map(t => t.date.slice(0, 7))])].sort().reverse();
  return `<div class="card"><div class="row"><select data-chg="txMonth">${months.map(m => opt(m, MONTHS[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4), m === mon)).join('')}</select>
    <select data-chg="txF">${[['all', 'Все'], ['expense', 'Расходы'], ['income', 'Доходы'], ['transfer', 'Переводы'], ['me', 'Мои'], ['partner', 'Партнёра']].map(([k, l]) => opt(k, l, k === f)).join('')}</select>
    <input placeholder="Поиск…" value="${esc(S.ui.txQ || '')}" data-chg="txQ"></div>
    <div class="row small muted" style="margin-top:8px"><span>Найдено: ${list.length}</span><span>−${rub(sum(list.filter(t => t.type === 'expense'), t => t.amount))}</span><span>+${rub(sum(list.filter(t => t.type === 'income'), t => t.amount))}</span><span class="sp"></span><button class="sm" data-act="importCsv">⇪ Импорт выписки</button><button class="sm" data-act="exportCsv">⇩ CSV</button></div></div>
  <div class="card">${Object.keys(g).sort().reverse().map(d => `<div class="tx-day">${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</div>${g[d].map(txRow).join('')}`).join('') || empty('Операций нет')}</div>`;
}
A.txMonth = el => { S.ui.txMonth = el.value; window.__render(); };
A.txF = el => { S.ui.txF = el.value; window.__render(); };
A.txQ = el => { S.ui.txQ = el.value; window.__render(); };
A.catDetail = el => { S.ui.moneyTab = 'ops'; S.ui.txQ = el.dataset.v; S.ui.txF = 'expense'; window.__render(); };

// ---------- быстрая операция ----------
A.quickTx = (el) => {
  const type = el.dataset.type || 'expense', presetCat = el.dataset.cat;
  if (!S.accounts.length) { toast('Сначала добавь счёт 💳'); S.ui.moneyTab = 'accounts'; S.ui.page = 'money'; window.__render(); return; }
  const cats = type === 'income' ? L.INC_CATS : L.EXP_CATS;
  const lastAcc = localStorage.getItem('mr10-last-acc');
  const accSel = id => S.accounts.map(a => opt(a.id, `${a.emoji || '💳'} ${a.name} · ${rub(a.balance)}`, a.id === id)).join('');
  sheet(`<h2>${type === 'income' ? '+ Доход' : type === 'transfer' ? '⇄ Перевод' : '− Расход'}</h2><div class="form">
    <input id="qtAmount" type="number" inputmode="decimal" placeholder="Сумма, ₽" autofocus style="font-size:24px;font-family:var(--f-head);font-weight:700" data-enter="txSave">
    ${type === 'transfer' ? `<label class="f">Откуда<select id="qtAcc">${accSel(lastAcc)}</select></label><label class="f">Куда<select id="qtTo">${accSel(S.accounts.find(a => a.id !== lastAcc)?.id)}</select></label>`
      : `<div class="chips" id="qtCats">${cats.map((c, i) => `<button class="chip ${(presetCat ? c === presetCat : i === 0) ? 'on' : ''}" data-act="pickCat" data-v="${c}">${L.CAT_EMO[c] || ''} ${c}</button>`).join('')}</div>
      <label class="f">Счёт<select id="qtAcc">${accSel(lastAcc)}</select></label>`}
    <div class="row"><input id="qtNote" placeholder="Заметка (необязательно)"><input id="qtDate" type="date" value="${S.ui.date}" style="flex:0 1 150px"></div>
    <button class="primary" data-act="txSave" data-type="${type}">Сохранить</button></div>`);
};
A.pickCat = el => { document.querySelectorAll('#qtCats .chip').forEach(c => c.classList.toggle('on', c === el)); };
A.txSave = async el => {
  const type = el.dataset.type || document.querySelector('[data-act="txSave"][data-type]')?.dataset.type || 'expense';
  const amount = num(val('qtAmount')); if (amount <= 0) return toast('Укажи сумму');
  const acc = val('qtAcc'), to = val('qtTo'), note = val('qtNote'), date = val('qtDate') || today();
  if (type === 'transfer' && acc === to) return toast('Выбери разные счета');
  const category = type === 'transfer' ? 'Перевод' : document.querySelector('#qtCats .chip.on')?.dataset.v || 'Другое';
  const a = S.accounts.find(x => x.id === acc);
  if (type === 'expense' && a && amount > Number(a.balance) && !confirm(`На счёте «${a.name}» только ${rub(a.balance)}. Записать всё равно?`)) return;
  localStorage.setItem('mr10-last-acc', acc);
  await add('transactions', { date, type, amount, category, account_id: acc, to_account_id: type === 'transfer' ? to : null, note, who: me() });
  await applyBalance(type, amount, acc, to, +1);
  closeSheet();
  const b = S.budgets.find(x => x.category === category);
  if (type === 'expense' && b) { const spent = L.monthTotals(date).byCat[category] || 0; if (spent > b.amount) toast(`⚠️ Бюджет «${category}» превышен: ${rub(spent)} из ${rub(b.amount)}`); else if (spent > b.amount * .8) toast(`Осталось по «${category}»: ${rub(b.amount - spent)}`); else toast('Записано'); }
  else toast(type === 'income' ? `💰 +${rub(amount)}` : 'Записано');
};
async function applyBalance(type, amount, acc, to, sign) {
  const a = S.accounts.find(x => x.id === acc);
  if (a) await upd('accounts', a.id, { balance: Number(a.balance || 0) + sign * (type === 'income' ? amount : -amount) });
  if (type === 'transfer') { const b = S.accounts.find(x => x.id === to); if (b) await upd('accounts', b.id, { balance: Number(b.balance || 0) + sign * amount }); }
}
A.txEdit = el => {
  const t = S.transactions.find(x => x.id === el.dataset.id); if (!t) return;
  sheet(`<h2>${t.type === 'income' ? 'Доход' : t.type === 'transfer' ? 'Перевод' : 'Расход'} · ${rub(t.amount)}</h2>
  <div class="small muted">${fmtDate(t.date)} · ${esc(L.accountName(t.account_id))} · ${esc(t.category)}${t.note ? ' · ' + esc(t.note) : ''}</div>
  <div class="row" style="margin-top:14px"><button class="danger" data-act="txDel" data-id="${t.id}">Удалить (баланс вернётся)</button></div>`);
};
A.txDel = async el => { const t = S.transactions.find(x => x.id === el.dataset.id); if (!t) return; await del('transactions', t.id); await applyBalance(t.type, Number(t.amount), t.account_id, t.to_account_id, -1); closeSheet(); toast('Удалено'); };

// ---------- бюджет ----------
function budget(date) {
  const m = L.monthTotals(date);
  const totalB = sum(S.budgets, b => b.amount), spentB = sum(S.budgets, b => m.byCat[b.category] || 0);
  const dayOf = Number(date.slice(8)), dim = Number(monthEnd(date).slice(8));
  const free = L.EXP_CATS.filter(c => !S.budgets.some(b => b.category === c));
  return `<div class="card hero"><h3>Бюджет на ${MONTHS[D(date).getMonth()]}</h3>
    <div class="row" style="margin-top:8px"><div class="sp"><div class="small muted">Потрачено по бюджетам</div><div style="font-family:var(--f-head);font-size:30px;font-weight:700">${rub(spentB)} <span class="muted" style="font-size:18px">из ${rub(totalB)}</span></div></div></div>
    ${totalB ? bar(spentB / totalB, spentB > totalB ? 'bad' : spentB / totalB > dayOf / dim + .1 ? 'warn' : 'ok') : ''}
    ${totalB ? `<div class="small muted" style="margin-top:6px">Прошло ${pct(dayOf, dim)}% месяца · можно тратить ≈ ${rub(Math.max(0, totalB - spentB) / Math.max(1, dim - dayOf + 1))} в день</div>` : ''}</div>
  <div class="card"><h3>Лимиты по категориям</h3>
    ${S.budgets.length ? S.budgets.map(b => { const s = m.byCat[b.category] || 0; return `<div class="item"><span class="emo">${L.CAT_EMO[b.category] || '•'}</span><div class="body"><div class="row nw"><span class="t sp">${esc(b.category)}</span><span class="small nowrap">${rub(s)} / <b>${rub(b.amount)}</b></span></div>${bar(s / b.amount, s > b.amount ? 'bad' : s > b.amount * .8 ? 'warn' : 'ok')}<div class="s">${s > b.amount ? `перерасход ${rub(s - b.amount)}` : `осталось ${rub(b.amount - s)}`}</div></div><button class="icon" data-act="budgetEdit" data-id="${b.id}">✎</button></div>`; }).join('') : empty('Поставь лимиты на главные категории — например, «Кафе 5 000 ₽». Приложение предупредит, когда подойдёте к краю.')}
    ${free.length ? `<div class="row" style="margin-top:12px"><select id="bgCat">${free.map(c => opt(c, (L.CAT_EMO[c] || '') + ' ' + c)).join('')}</select><input id="bgAmt" type="number" placeholder="Лимит ₽/мес" style="flex:0 1 140px"><button class="primary" data-act="budgetAdd">+</button></div>
    ${Object.keys(L.monthTotals(addMonths(date, -1)).byCat).length ? `<button class="sm ghost" style="margin-top:8px" data-act="budgetAuto">✨ Предложить по прошлому месяцу</button>` : ''}` : ''}
  </div>`;
}
A.budgetAdd = async () => { const c = val('bgCat'), a = num(val('bgAmt')); if (!c || a <= 0) return toast('Укажи лимит'); await add('budgets', { category: c, amount: a }); };
A.budgetEdit = async el => { const b = S.budgets.find(x => x.id === el.dataset.id); const v = ask(`Лимит для «${b.category}» (0 — удалить):`, b.amount); if (v === null) return; const n = num(v); if (n <= 0) await del('budgets', b.id); else await upd('budgets', b.id, { amount: n }); };
A.budgetAuto = async () => { const prev = L.monthTotals(addMonths(S.ui.date, -1)).byCat; const rows = Object.entries(prev).filter(([c]) => !S.budgets.some(b => b.category === c) && c !== 'Перевод').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, s]) => ({ category: c, amount: Math.ceil(s / 500) * 500 })); if (!rows.length) return; if (confirm(`Добавить лимиты:\n${rows.map(r => `${r.category}: ${rub(r.amount)}`).join('\n')}`)) await addMany('budgets', rows); };

// ---------- регулярные платежи ----------
function payRow(p) {
  const n = daysUntil(p.next_date);
  return `<div class="item"><span class="emo">${p.emoji || '📅'}</span><div class="body"><div class="t">${esc(p.name)}</div><div class="s"><span class="${n < 0 ? 'bad' : n <= 3 ? 'warn' : ''}">${inDays(n)}</span> · ${p.day_of_month} числа${p.kind === 'debt' && p.remaining ? ` · осталось ${rub(p.remaining)}` : ''}</div></div><span class="amt">${rub(p.amount)}</span><button class="sm primary" data-act="payPaid" data-id="${p.id}">✓</button></div>`;
}
function regular() {
  const by = k => S.payments.filter(p => (p.kind || 'bill') === k);
  const monthly = sum(S.payments.filter(p => p.active !== false), p => p.amount);
  const subs = sum(by('subscription'), p => p.amount);
  return `<div class="grid g3" style="margin-bottom:14px">${stat('В месяц обязательных', rub(monthly))}${stat('Подписки в год', rub(subs * 12))}${stat('Долги осталось', rub(sum(by('debt'), p => p.remaining || 0)))}</div>
  <div class="card"><h3>Добавить</h3><div class="row"><select id="pyKind" style="flex:0 1 160px">${Object.entries(L.PAY_KINDS).map(([k, v]) => opt(k, v)).join('')}</select><input id="pyEmoji" placeholder="📅" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="pyName" placeholder="Название" style="flex:2 1 160px"></div>
    <div class="row" style="margin-top:8px"><input id="pyAmt" type="number" placeholder="Сумма ₽"><input id="pyDay" type="number" min="1" max="31" placeholder="Число месяца"><input id="pyRem" type="number" placeholder="Остаток долга (для кредита)"><select id="pyAcc">${S.accounts.map(a => opt(a.id, `${a.emoji || '💳'} ${a.name}`)).join('')}</select><button class="primary" data-act="payAdd">+</button></div></div>
  ${Object.entries(L.PAY_KINDS).map(([k, l]) => by(k).length ? `<div class="card"><h3>${l}<span class="right pill">${rub(sum(by(k), p => p.amount))}/мес</span></h3>${by(k).sort((a, b) => a.next_date.localeCompare(b.next_date)).map(p => payRow(p).replace('</div></div><span class="amt">', `</div></div><button class="icon" data-act="payDel" data-id="${p.id}">×</button><span class="amt">`)).join('')}</div>` : '').join('') || `<div class="card">${empty('Добавь аренду, коммуналку, подписки и кредиты — приложение напомнит заранее и посчитает, сколько уходит в год')}</div>`}`;
}
A.payAdd = async () => {
  const name = val('pyName'), amount = num(val('pyAmt')), day = Math.round(num(val('pyDay'))) || 1;
  if (!name || amount <= 0) return toast('Название и сумма'); if (day < 1 || day > 31) return toast('Число 1–31');
  const now = new Date(); let next = payDateIn(now.getFullYear(), now.getMonth(), day); if (next < today()) next = payDateIn(now.getFullYear(), now.getMonth() + 1, day);
  const kind = val('pyKind');
  await add('payments', { name, amount, day_of_month: day, emoji: val('pyEmoji') || (kind === 'subscription' ? '🔁' : kind === 'debt' ? '🏦' : '📅'), account_id: val('pyAcc') || null, next_date: next, active: true, who: me(), kind, remaining: kind === 'debt' ? num(val('pyRem')) || null : null });
  toast('📅 Добавлено');
};
A.payDel = async el => { if (confirm('Удалить платёж?')) await del('payments', el.dataset.id); };
A.payPaid = async el => {
  const p = S.payments.find(x => x.id === el.dataset.id); if (!p) return;
  const acc = S.accounts.find(a => a.id === p.account_id);
  if (!confirm(`Оплачено «${p.name}» — ${rub(p.amount)}?${acc ? `\nСпишется со счёта «${acc.name}».` : ''}`)) return;
  await add('transactions', { date: today(), type: 'expense', amount: p.amount, category: p.kind === 'subscription' ? 'Подписки' : p.kind === 'debt' ? 'Кредиты' : 'Коммуналка', account_id: p.account_id, note: p.name, who: me() });
  if (acc) await upd('accounts', acc.id, { balance: Number(acc.balance || 0) - Number(p.amount) });
  const cur = D(p.next_date); const next = payDateIn(cur.getFullYear(), cur.getMonth() + 1, Number(p.day_of_month) || cur.getDate());
  const patch = { next_date: next };
  if (p.kind === 'debt' && p.remaining) { patch.remaining = Math.max(0, Number(p.remaining) - Number(p.amount)); if (!patch.remaining) { patch.active = false; confetti(); toast('🎉 Долг закрыт!'); } }
  await upd('payments', p.id, patch);
  toast('✅ Оплачено. Следующий: ' + fmtDate(next));
};

// ---------- копилки ----------
function goals() {
  return `<div class="card"><h3>Новая цель</h3><div class="row"><input id="fgEmoji" placeholder="🌊" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="fgName" placeholder="Отпуск, подушка, ремонт…" style="flex:2 1 160px"><input id="fgTarget" type="number" placeholder="Сумма ₽"><input id="fgDl" type="date" title="К какой дате"><button class="primary" data-act="goalAdd">+</button></div></div>
  ${S.fin_goals.map(g => { const s = Number(g.saved || 0), t = Number(g.target) || 1, left = Math.max(0, t - s); const dl = g.deadline ? daysUntil(g.deadline) : null; const per = dl && dl > 0 && left ? left / Math.max(1, dl / 30.4) : 0;
    return `<div class="card"><div class="row nw"><span style="font-size:34px">${g.emoji || '🎯'}</span><div class="sp"><h3>${esc(g.name)}</h3><div class="small muted">${rub(s)} из ${rub(t)} · ${pct(s, t)}%${g.deadline ? ` · до ${fmtDate(g.deadline)}` : ''}</div></div><button class="icon" data-act="goalDel" data-id="${g.id}">×</button></div>
    ${bar(s / t, s >= t ? 'ok' : '')}
    <div class="row" style="margin-top:10px">${per ? `<span class="small muted sp">Нужно ≈ ${rub(per)} в месяц</span>` : '<span class="sp"></span>'}<button class="sm" data-act="goalMove" data-id="${g.id}" data-sign="-1">− Взять</button><button class="sm primary" data-act="goalMove" data-id="${g.id}" data-sign="1">+ Отложить</button></div></div>`; }).join('') || `<div class="card">${empty('Копите вместе на мечту: отпуск, подушку безопасности, подарок ✨')}</div>`}`;
}
A.goalAdd = async () => { const name = val('fgName'), target = num(val('fgTarget')); if (!name || target <= 0) return toast('Название и сумма'); await add('fin_goals', { name, target, emoji: val('fgEmoji') || '🎯', deadline: val('fgDl') || null, saved: 0 }); };
A.goalDel = async el => { if (confirm('Удалить цель?')) await del('fin_goals', el.dataset.id); };
A.goalMove = async el => {
  const g = S.fin_goals.find(x => x.id === el.dataset.id); const sign = Number(el.dataset.sign);
  const v = num(ask(sign > 0 ? 'Сколько отложить?' : 'Сколько взять из копилки?', '1000')); if (v <= 0) return;
  const saved = Math.max(0, Number(g.saved || 0) + sign * v); await upd('fin_goals', g.id, { saved });
  if (sign > 0 && saved >= Number(g.target)) { confetti(); toast('🎉 Цель достигнута!'); } else toast(sign > 0 ? `💜 Отложено ${rub(v)}` : `Взято ${rub(v)}`);
};

// ---------- счета ----------
function accounts() {
  return `<div class="grid g3" style="margin-bottom:14px">${S.accounts.map(a => `<div class="stat"><div class="row nw"><span class="l sp">${a.emoji || '💳'} ${esc(a.name)}</span><button class="icon" data-act="accEdit" data-id="${a.id}">✎</button></div><div class="v ${Number(a.balance) < 0 ? 'bad' : ''}">${rub(a.balance)}</div></div>`).join('')}</div>
  <div class="card"><h3>Новый счёт</h3><div class="row"><input id="acEmoji" placeholder="💳" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="acName" placeholder="Карта, наличные, вклад…"><input id="acBal" type="number" placeholder="Остаток ₽"><button class="primary" data-act="accAdd">+</button></div></div>`;
}
A.accAdd = async () => { const name = val('acName'); if (!name) return toast('Название'); await add('accounts', { name, emoji: val('acEmoji') || '💳', balance: num(val('acBal')), created_by: me() }); };
A.accEdit = el => { const a = S.accounts.find(x => x.id === el.dataset.id); sheet(`<h2>${a.emoji || '💳'} ${esc(a.name)}</h2><div class="form"><label class="f">Название<input id="aeName" value="${esc(a.name)}"></label><label class="f">Фактический остаток (корректировка)<input id="aeBal" type="number" value="${Number(a.balance || 0)}"></label><div class="row"><button class="primary" data-act="accSave" data-id="${a.id}">Сохранить</button><span class="sp"></span><button class="danger" data-act="accDel" data-id="${a.id}">Удалить счёт</button></div></div>`); };
A.accSave = async el => { await upd('accounts', el.dataset.id, { name: val('aeName'), balance: num(val('aeBal')) }); closeSheet(); };
A.accDel = async el => { if (confirm('Удалить счёт? Операции останутся.')) { await del('accounts', el.dataset.id); closeSheet(); } };

// ---------- импорт/экспорт ----------
A.exportCsv = () => { const rows = [['Дата', 'Тип', 'Категория', 'Сумма', 'Счёт', 'Заметка', 'Кто'], ...S.transactions.map(t => [t.date, t.type, t.category, t.amount, L.accountName(t.account_id), t.note || '', prof(t.who)?.display_name || ''])]; const csv = '﻿' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n'); import('../util.js').then(u => u.download(csv, 'Операции.csv', 'text/csv;charset=utf-8')); };
A.importCsv = () => {
  if (!S.accounts.length) return toast('Сначала добавь счёт');
  sheet(`<h2>⇪ Импорт выписки</h2><div class="small muted">Выгрузи из банка CSV-выписку (Сбер, Т-Банк, Альфа и др.). Нужны колонки с датой и суммой; описание — по возможности. Расходы — отрицательные суммы.</div>
  <div class="form" style="margin-top:12px"><input type="file" id="csvFile" accept=".csv,text/csv"><label class="f">На какой счёт<select id="csvAcc">${S.accounts.map(a => opt(a.id, a.name)).join('')}</select></label>
  <label class="row"><input type="checkbox" id="csvBal"> Менять баланс счёта</label><button class="primary" data-act="csvGo">Загрузить</button><div id="csvOut"></div></div>`);
};
A.csvGo = async () => {
  const f = document.getElementById('csvFile').files[0]; if (!f) return toast('Выбери файл');
  let text = await f.text(); if (/�/.test(text)) text = new TextDecoder('windows-1251').decode(await f.arrayBuffer());
  const rows = parseCSV(text); if (rows.length < 2) return toast('Пустой файл');
  const head = rows[0].map(h => h.toLowerCase());
  const iD = head.findIndex(h => /дата/.test(h)), iS = head.findIndex(h => /сумма/.test(h)), iN = head.findIndex(h => /описан|назнач|категор|контрагент/.test(h));
  if (iD < 0 || iS < 0) return document.getElementById('csvOut').innerHTML = '<div class="msg err">Не нашёл колонки «Дата» и «Сумма»</div>';
  const parseDate = s => { const m = s.match(/(\d{2})[./-](\d{2})[./-](\d{4})/) || s.match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return null; return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`; };
  const acc = val('csvAcc');
  const exist = new Set(S.transactions.map(t => `${t.date}|${Math.round(t.amount)}|${t.type}`));
  const list = rows.slice(1).map(r => { const d = parseDate(r[iD] || ''); const a = num((r[iS] || '').replace(/[^\d,.\-]/g, '')); const note = iN >= 0 ? (r[iN] || '').slice(0, 80) : ''; if (!d || !a) return null; const type = a < 0 ? 'expense' : 'income'; return { date: d, type, amount: Math.abs(a), category: type === 'income' ? 'Другое' : guessTxCat(note), account_id: acc, note, who: me() }; }).filter(Boolean).filter(t => !exist.has(`${t.date}|${Math.round(t.amount)}|${t.type}`));
  if (!list.length) return document.getElementById('csvOut').innerHTML = '<div class="msg info">Новых операций не найдено</div>';
  if (!confirm(`Импортировать ${list.length} операций?`)) return;
  await addMany('transactions', list);
  if (document.getElementById('csvBal').checked) { const a = S.accounts.find(x => x.id === acc); await upd('accounts', acc, { balance: Number(a.balance || 0) + sum(list, t => t.type === 'income' ? t.amount : -t.amount) }); }
  closeSheet(); toast(`⇪ Импортировано: ${list.length}`);
};
function guessTxCat(s) {
  const t = s.toLowerCase();
  const r = [['Продукты', /пятёроч|пятероч|магнит|перекр|ашан|лента|вкусвилл|дикси|продукт|супермарк|окей|metro|самокат|лавка/], ['Кафе', /кафе|ресторан|кофе|coffee|бургер|kfc|макдон|вкусно|додо|пицц|суши|яндекс еда|delivery/], ['Транспорт', /метро|такси|taxi|uber|яндекс go|азс|лукойл|газпромнефть|роснефть|транспорт|тройка|парков/], ['Здоровье', /аптек|клиник|врач|стомат|анализ/], ['Связь', /мтс|билайн|мегафон|теле2|tele2|интернет|ростелеком/], ['Подписки', /подписк|яндекс плюс|кинопоиск|ivi|okko|spotify|apple|google/], ['Одежда', /zara|h&m|wildberries|ozon|lamoda|одежд|обув/], ['Развлечения', /кино|театр|концерт|билет/], ['Коммуналка', /жкх|жку|коммун|электроэн|мосэнерго|водоканал/]];
  for (const [c, re] of r) if (re.test(t)) return c;
  return 'Другое';
}
