// Питание: быстрый ввод калорий, база продуктов (своя + встроенная), рецепты, вес
import { S, me, add, addMany, upd, del, saveGoals } from '../data.js';
import { A, toast, empty, tabs, sheet, closeSheet, opt, bar, stat } from '../ui.js';
import { esc, today, addDays, fmtDate, fmtDay, val, num, range, sum } from '../util.js';
import * as L from '../logic.js';
import { setDay } from './today.js';

const SLOTS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];
const slotNow = () => { const h = new Date().getHours(); return h < 11 ? 'Завтрак' : h < 16 ? 'Обед' : h < 21 ? 'Ужин' : 'Перекус'; };

export function render(date) {
  const tab = S.ui.foodTab || 'day';
  return tabs('foodTab', tab, [['day', '🍽 День'], ['base', '📚 Продукты'], ['recipes', '♧ Рецепты'], ['body', '⚖ Вес']]) + ({ day, base, recipes, body }[tab])(date);
}

function allFoods() {
  const own = S.foods.map(f => ({ id: f.id, name: f.name, k: +f.k, p: +f.p, f: +f.f, c: +f.c, own: true }));
  const names = new Set(own.map(f => f.name.toLowerCase()));
  return [...own, ...L.BASE_FOODS.filter(b => !names.has(b[0].toLowerCase())).map(([name, k, p, f, c]) => ({ id: 'base:' + name, name, k, p, f, c }))];
}
function recent() {
  const seen = new Set(), out = [];
  for (const m of S.meals.filter(m => m.user_id === me())) { const k = m.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(m); if (out.length >= 10) break; }
  return out;
}

function day(date) {
  const t = L.kcalOn(date), g = S.goals, ms = L.mealsOn(date);
  const rc = recent();
  return `<div class="grid g4" style="margin-bottom:14px">
    ${stat('Калории', Math.round(t.k), 'из ' + g.k, t.k / g.k)}${stat('Белки', t.p.toFixed(0) + ' г', 'из ' + g.p, t.p / g.p)}${stat('Жиры', t.f.toFixed(0) + ' г', 'из ' + g.f, t.f / g.f)}${stat('Углеводы', t.c.toFixed(0) + ' г', 'из ' + g.c, t.c / g.c)}</div>
  <div class="cols"><div>
    <div class="card"><h3>Записать</h3>
      <div class="row"><select id="mlSlot" style="flex:0 1 130px">${SLOTS.map(s => opt(s, s, s === slotNow())).join('')}</select>
        <input id="mlName" list="mlFoods" placeholder="Продукт или блюдо" style="flex:2 1 180px" autocomplete="off"><datalist id="mlFoods">${allFoods().map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></div>
      <div class="row" style="margin-top:8px"><input id="mlGrams" type="number" inputmode="numeric" placeholder="Граммы"><span class="muted small">или</span><input id="mlKcal" type="number" inputmode="numeric" placeholder="Сразу ккал" data-enter="mealAdd"><button class="primary" data-act="mealAdd">+</button></div>
      <div class="small muted" style="margin-top:6px">Не хочешь взвешивать? Впиши название и примерные калории — этого достаточно.</div>
      ${rc.length ? `<div class="small muted" style="margin-top:12px">Недавнее — в одно касание:</div><div class="chips" style="margin-top:6px">${rc.map(m => `<button class="chip" data-act="mealRepeat" data-id="${m.id}">${esc(m.name)} · ${Math.round(m.k)}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:10px"><button class="sm ghost" data-act="mealCopyYesterday">↻ Как вчера</button></div>
    </div>
  </div><div>
    <div class="card"><h3>${fmtDay(date)}</h3>${ms.length ? SLOTS.filter(s => ms.some(m => m.type === s)).map(s => `<div class="shop-cat">${s} · ${Math.round(sum(ms.filter(m => m.type === s), m => m.k))} ккал</div>${ms.filter(m => m.type === s).map(m => `<div class="item"><div class="body"><div class="t">${esc(m.name)}</div><div class="s">${m.grams ? m.grams + ' г · ' : ''}Б${(+m.p).toFixed(0)} Ж${(+m.f).toFixed(0)} У${(+m.c).toFixed(0)}</div></div><span class="amt">${Math.round(m.k)}</span><button class="icon" data-act="mealDel" data-id="${m.id}">×</button></div>`).join('')}`).join('') : empty('Пока ничего не записано')}</div>
  </div></div>`;
}
A.mealAdd = async () => {
  const name = val('mlName'); if (!name) return toast('Что съели?');
  const g = num(val('mlGrams')), kc = num(val('mlKcal')), type = val('mlSlot');
  const f = allFoods().find(x => x.name.toLowerCase() === name.toLowerCase());
  let row;
  if (f && g > 0) row = { name: f.name, grams: g, k: f.k * g / 100, p: f.p * g / 100, f: f.f * g / 100, c: f.c * g / 100 };
  else if (kc > 0) row = { name, grams: g || null, k: kc, p: 0, f: 0, c: 0 };
  else if (f) return toast('Укажи граммы');
  else return toast('Укажи граммы или калории');
  await add('meals', { date: S.ui.date, type, ...row });
  ['mlName', 'mlGrams', 'mlKcal'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  toast(`◉ +${Math.round(row.k)} ккал`);
};
A.mealRepeat = async el => { const m = S.meals.find(x => x.id === el.dataset.id); if (!m) return; await add('meals', { date: S.ui.date, type: slotNow(), name: m.name, grams: m.grams, k: m.k, p: m.p, f: m.f, c: m.c }); toast(`◉ ${m.name}`); };
A.mealDel = async el => del('meals', el.dataset.id);
A.mealCopyYesterday = async () => { const src = L.mealsOn(addDays(S.ui.date, -1)); if (!src.length) return toast('Вчера записей нет'); await addMany('meals', src.map(m => ({ date: S.ui.date, type: m.type, name: m.name, grams: m.grams, k: m.k, p: m.p, f: m.f, c: m.c }))); toast('↻ Скопировано'); };

function base() {
  const q = (S.ui.foodQ || '').toLowerCase();
  const list = allFoods().filter(f => !q || f.name.toLowerCase().includes(q));
  return `<div class="card"><h3>Свой продукт (на 100 г)</h3><div class="row"><input id="fdName" placeholder="Название" style="flex:2 1 160px"><input id="fdK" type="number" placeholder="Ккал"><input id="fdP" type="number" placeholder="Б"><input id="fdF" type="number" placeholder="Ж"><input id="fdC" type="number" placeholder="У"><button class="primary" data-act="foodAdd">+</button></div></div>
  <div class="card"><input placeholder="Поиск…" value="${esc(S.ui.foodQ || '')}" data-chg="foodQ" style="width:100%;margin-bottom:8px"><div class="scroll-x"><table class="t"><tr><th>Продукт</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th><th></th></tr>${list.map(f => `<tr><td>${esc(f.name)}${f.own ? '' : ' <span class="muted small">база</span>'}</td><td>${Math.round(f.k)}</td><td>${f.p}</td><td>${f.f}</td><td>${f.c}</td><td>${f.own ? `<button class="icon" data-act="foodDel" data-id="${f.id}">×</button>` : ''}</td></tr>`).join('')}</table></div></div>`;
}
A.foodQ = el => { S.ui.foodQ = el.value; window.__render(); };
A.foodAdd = async () => { const name = val('fdName'); if (!name) return toast('Название'); await add('foods', { name, k: num(val('fdK')), p: num(val('fdP')), f: num(val('fdF')), c: num(val('fdC')) }); toast('Добавлено'); };
A.foodDel = async el => { if (confirm('Удалить продукт?')) await del('foods', el.dataset.id); };

function recipes() {
  return `<div class="card soft"><div class="small">Соберите блюдо из продуктов и укажите вес готового — рецепт появится в продуктах (на 100 г) и в меню на неделю, а ингредиенты можно одной кнопкой отправить в покупки.</div></div>
  <div class="card"><h3>Новый рецепт</h3><div class="row"><input id="rcName" placeholder="Название блюда" style="flex:2 1 180px"><input id="rcYield" type="number" placeholder="Вес готового, г"></div>
    <div id="rcIng" style="margin-top:8px">${ingRow()}</div><div class="row" style="margin-top:8px"><button data-act="ingAdd">+ Ингредиент</button><span class="sp"></span><button class="primary" data-act="recipeSave">Сохранить</button></div></div>
  <div class="card"><h3>Мои рецепты</h3>${S.recipes.map(r => `<div class="item"><span class="emo">♧</span><div class="body"><div class="t">${esc(r.name)}</div><div class="s">${(r.ingredients || []).map(i => esc(i.name) + ' ' + i.grams + ' г').join(' · ')} · выход ${r.yield} г</div></div><button class="sm" data-act="recipeShop" data-id="${r.id}" title="В покупки">🛒</button><button class="icon" data-act="recipeDel" data-id="${r.id}">×</button></div>`).join('') || empty('Пока рецептов нет')}</div>`;
}
const ingRow = () => `<div class="row ing" style="margin-top:6px"><input list="mlFoods2" placeholder="Ингредиент" style="flex:2 1 160px"><input type="number" placeholder="г" style="flex:0 1 90px"><button class="icon" data-act="ingDel">×</button><datalist id="mlFoods2">${allFoods().map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></div>`;
A.ingAdd = () => document.getElementById('rcIng').insertAdjacentHTML('beforeend', ingRow());
A.ingDel = el => el.closest('.ing').remove();
A.recipeSave = async () => {
  const name = val('rcName'), y = num(val('rcYield')); if (!name || y <= 0) return toast('Название и вес готового');
  const fs = allFoods(), ing = [], tot = { k: 0, p: 0, f: 0, c: 0 };
  for (const r of document.querySelectorAll('#rcIng .ing')) { const [n, g] = r.querySelectorAll('input'); const nm = n.value.trim(), gr = num(g.value); if (!nm) continue; const f = fs.find(x => x.name.toLowerCase() === nm.toLowerCase()); if (!f || gr <= 0) return toast(`Нет в базе или без веса: ${nm}`); ing.push({ name: f.name, grams: gr }); ['k', 'p', 'f', 'c'].forEach(k => tot[k] += f[k] * gr / 100); }
  if (!ing.length) return toast('Добавь ингредиенты');
  await add('recipes', { name, yield: Math.round(y), ingredients: ing });
  await add('foods', { name, k: tot.k / y * 100, p: tot.p / y * 100, f: tot.f / y * 100, c: tot.c / y * 100 });
  toast('♧ Рецепт сохранён'); window.__render();
};
A.recipeDel = async el => { if (confirm('Удалить рецепт?')) await del('recipes', el.dataset.id); };
A.recipeShop = async el => { const r = S.recipes.find(x => x.id === el.dataset.id); const have = new Set(S.shopping.filter(s => !s.done).map(s => s.text.toLowerCase())); const items = (r.ingredients || []).map(i => i.name).filter(n => !have.has(n.toLowerCase())); if (!items.length) return toast('Всё уже в списке'); await addMany('shopping', items.map(t => ({ text: t, cat: L.guessShopCat(t), done: false, added_by: me() }))); toast(`🛒 +${items.length}`); };

function body(date) {
  const ws = S.days.filter(d => d.user_id === me() && d.weight).sort((a, b) => a.date.localeCompare(b.date));
  const last = ws[ws.length - 1], first = ws[0];
  const pts = ws.slice(-60); let svg = '';
  if (pts.length > 1) { const vs = pts.map(p => +p.weight), mn = Math.min(...vs) - .5, mx = Math.max(...vs) + .5; svg = `<svg class="spark" viewBox="0 0 300 80" preserveAspectRatio="none"><polyline fill="none" stroke="var(--main)" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((p, i) => `${i / (pts.length - 1) * 300},${80 - (p.weight - mn) / (mx - mn) * 76 - 2}`).join(' ')}"/></svg>`; }
  return `<div class="cols"><div class="card"><h3>Вес</h3><div class="row nw"><input id="wtVal" type="number" step="0.1" inputmode="decimal" placeholder="кг" value="${L.dayOf(date)?.weight || ''}" data-enter="weightSave"><button class="primary" data-act="weightSave">Сохранить за ${fmtDay(date)}</button></div>
    ${last ? `<div class="grid g3" style="margin-top:12px">${stat('Сейчас', (+last.weight).toFixed(1) + ' кг')}${stat('Старт', (+first.weight).toFixed(1) + ' кг', fmtDate(first.date))}${stat('Изменение', ((last.weight - first.weight) > 0 ? '+' : '') + (last.weight - first.weight).toFixed(1) + ' кг')}</div>${svg}` : '<div class="small muted" style="margin-top:8px">Взвешивайся раз в неделю в одно время — график появится здесь.</div>'}</div>
  <div class="card"><h3>Цели</h3><div class="grid g2">${Object.entries({ k: 'Калории', p: 'Белки, г', f: 'Жиры, г', c: 'Углеводы, г', water: 'Вода, мл', glass: 'Стакан, мл' }).map(([k, l]) => `<label class="f">${l}<input type="number" value="${S.goals[k]}" data-chg="goalSet" data-k="${k}"></label>`).join('')}</div></div></div>`;
}
A.weightSave = async () => { const w = num(val('wtVal')); if (w <= 0) return; await setDay('weight', w); toast('⚖ Сохранено'); };
A.goalSet = async el => { await saveGoals({ [el.dataset.k]: Math.max(1, num(el.value)) }); toast('Цель сохранена'); };
