// Предметная логика: привычки, задачи, деньги, достижения
import { S, me, partner } from './data.js';
import { today, addDays, weekday, sum, monthStart, monthEnd, range, D, nextYearly, daysUntil, addMonths } from './util.js';

// ---------- день ----------
export const dayOf = (date, user = me()) => S.days.find(d => d.date === date && d.user_id === user) || null;

// ---------- привычки ----------
export const myHabits = () => S.habits.filter(h => h.user_id === me() && !h.archived);
export const partnerShared = () => S.habits.filter(h => h.user_id !== me() && h.shared && !h.archived);
export const habitDue = (h, date) => {
  if (h.start_date && date < h.start_date) return false;
  if (h.challenge_days && h.start_date && date > addDays(h.start_date, h.challenge_days - 1)) return false;
  if (Array.isArray(h.weekdays) && h.weekdays.length) return h.weekdays.includes(weekday(date));
  return true;
};
export const markOf = (hid, date, user = me()) => S.habit_marks.find(m => m.habit_id === hid && m.date === date && m.user_id === user);
export const habitValue = (h, date, user = me()) => { const m = markOf(h.id, date, user); return m ? (m.done === false ? 0 : Number(m.value ?? 1)) : 0; };
export const habitDone = (h, date, user = me()) => h.kind === 'count' ? habitValue(h, date, user) >= Number(h.target || 1) : habitValue(h, date, user) > 0;
export function habitStreak(h, user = me()) {
  let s = 0, d = today(), guard = 0;
  if (!habitDone(h, d, user)) d = addDays(d, -1); // сегодня ещё не поздно
  while (guard++ < 2000) {
    if (h.start_date && d < h.start_date) break;
    if (habitDue(h, d)) { if (habitDone(h, d, user)) s++; else break; }
    d = addDays(d, -1);
  }
  return s;
}
export function habitRate(h, days = 30, user = me()) {
  const from = addDays(today(), -days + 1); let due = 0, done = 0;
  for (const d of range(from, today())) if (habitDue(h, d)) { due++; if (habitDone(h, d, user)) done++; }
  return due ? done / due : 0;
}
export function dayHabitScore(date, user = me()) {
  const hs = S.habits.filter(h => (h.user_id === user || (h.shared && user === me())) && !h.archived && habitDue(h, date));
  return { due: hs.length, done: hs.filter(h => habitDone(h, date, user)).length };
}
export function bestStreak() { return Math.max(0, ...myHabits().map(h => habitStreak(h))); }

// ---------- задачи ----------
export const visibleTasks = () => S.tasks.filter(t => t.user_id === me() || t.shared);
export const tasksOn = date => visibleTasks().filter(t => t.date === date);
export const overdueTasks = () => visibleTasks().filter(t => !t.done && t.date && t.date < today());
export const nextRepeat = (date, rep) => rep === 'daily' ? addDays(date, 1) : rep === 'weekdays' ? (() => { let d = addDays(date, 1); while (weekday(d) > 4) d = addDays(d, 1); return d; })() : rep === 'weekly' ? addDays(date, 7) : rep === 'monthly' ? addMonths(date, 1) : null;
export const REPEATS = { '': 'Не повторять', daily: 'Каждый день', weekdays: 'По будням', weekly: 'Каждую неделю', monthly: 'Каждый месяц' };

// ---------- уборка ----------
export const choresDue = (date = today()) => S.chores.filter(c => c.next_date <= date);

// ---------- деньги ----------
export const EXP_CATS = ['Продукты', 'Кафе', 'Транспорт', 'Дом', 'Коммуналка', 'Здоровье', 'Красота', 'Одежда', 'Развлечения', 'Подарки', 'Связь', 'Подписки', 'Учёба', 'Дети', 'Животные', 'Кредиты', 'Другое'];
export const INC_CATS = ['Зарплата', 'Подработка', 'Подарок', 'Кэшбэк', 'Возврат', 'Другое'];
export const CAT_EMO = { 'Продукты': '🛒', 'Кафе': '☕', 'Транспорт': '🚇', 'Дом': '🏠', 'Коммуналка': '💡', 'Здоровье': '💊', 'Красота': '💅', 'Одежда': '👗', 'Развлечения': '🎬', 'Подарки': '🎁', 'Связь': '📱', 'Подписки': '🔁', 'Учёба': '📚', 'Дети': '🧸', 'Животные': '🐾', 'Кредиты': '🏦', 'Платежи': '📅', 'Зарплата': '💼', 'Подработка': '🛠', 'Подарок': '🎁', 'Кэшбэк': '💳', 'Возврат': '↩', 'Перевод': '⇄', 'Другое': '•' };
export const CAT_COLORS = ['#b8a1ed', '#e8a3c6', '#f4c06f', '#8fcfb0', '#a1c8ed', '#f0a8a8', '#c8a8f0', '#f0c8a8', '#a8e8c8', '#e8d8a8', '#d8a8e8', '#a8d8e8', '#e8a8d8', '#9fb4d8', '#d8b49f', '#b4d89f', '#ccc'];
export const balance = () => sum(S.accounts, a => a.balance);
export const txIn = (from, to) => S.transactions.filter(t => t.date >= from && t.date <= to);
export function monthTotals(anyDateInMonth = today()) {
  const list = txIn(monthStart(anyDateInMonth), monthEnd(anyDateInMonth));
  const income = sum(list.filter(t => t.type === 'income'), t => t.amount);
  const expense = sum(list.filter(t => t.type === 'expense'), t => t.amount);
  const byCat = {}; list.filter(t => t.type === 'expense').forEach(t => byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount));
  return { list, income, expense, net: income - expense, byCat };
}
export const accountName = id => { const a = S.accounts.find(x => x.id === id); return a ? `${a.emoji || '💳'} ${a.name}` : '—'; };
export const PAY_KINDS = { bill: '📅 Платёж', subscription: '🔁 Подписка', debt: '🏦 Кредит/долг' };

// ---------- даты ----------
export function upcomingDates(limit = 20) {
  const list = S.important_dates.map(d => ({ ...d, next: nextYearly(d.date), years: Number(nextYearly(d.date).slice(0, 4)) - Number(d.date.slice(0, 4)) }));
  return list.sort((a, b) => a.next.localeCompare(b.next)).slice(0, limit);
}
export function calendarItems(date) {
  const out = [];
  visibleTasks().filter(t => t.date === date).forEach(t => out.push({ kind: 'task', color: 'var(--main)', text: (t.done ? '✓ ' : '') + t.text, ref: t }));
  S.payments.filter(p => p.active !== false && p.next_date === date).forEach(p => out.push({ kind: 'pay', color: 'var(--warn)', text: `${p.emoji || '📅'} ${p.name} · ${Math.round(p.amount)} ₽`, ref: p }));
  S.important_dates.filter(d => nextYearly(d.date) === date || d.date === date).forEach(d => out.push({ kind: 'date', color: 'var(--partner)', text: `${d.emoji || '♡'} ${d.title}`, ref: d }));
  S.plans.filter(p => p.date === date).forEach(p => out.push({ kind: 'plan', color: 'var(--me)', text: `✎ ${p.title}`, ref: p }));
  S.chores.filter(c => c.next_date === date).forEach(c => out.push({ kind: 'chore', color: 'var(--ok)', text: `${c.emoji || '🧹'} ${c.title}`, ref: c }));
  S.meal_plan.filter(m => m.date === date).forEach(m => out.push({ kind: 'meal', color: '#f4c06f', text: `🍳 ${m.slot}: ${m.title}`, ref: m }));
  return out;
}

// ---------- записки ----------
export const unreadNotes = () => S.notes.filter(n => n.to_user === me() && !n.read_at);

// ---------- питание ----------
export const mealsOn = (date, user = me()) => S.meals.filter(m => m.date === date && m.user_id === user);
export const kcalOn = (date, user = me()) => { const ms = mealsOn(date, user); return { k: sum(ms, m => m.k), p: sum(ms, m => m.p), f: sum(ms, m => m.f), c: sum(ms, m => m.c) }; };

// ---------- прогресс дня ----------
export function dayProgress(date = today()) {
  const parts = [];
  const ts = tasksOn(date).filter(t => t.user_id === me() || t.assignee === me()); if (ts.length) parts.push(ts.filter(t => t.done).length / ts.length);
  const h = dayHabitScore(date); if (h.due) parts.push(h.done / h.due);
  const d = dayOf(date); parts.push(Math.min(1, (d?.water || 0) / (S.goals.water || 2000)));
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
}

// ---------- достижения ----------
export function achievements() {
  const tasksDone = S.tasks.filter(t => t.user_id === me() && t.done).length;
  const marks = S.habit_marks.filter(m => m.user_id === me() && m.done !== false).length;
  const waterDays = S.days.filter(d => d.user_id === me() && (d.water || 0) >= (S.goals.water || 2000)).length;
  const notesSent = S.notes.filter(n => n.from_user === me()).length;
  const mems = S.memories.length, ideas = S.date_ideas.filter(d => d.done).length;
  const shop = S.shopping.filter(s => s.done_by === me()).length;
  const chores = S.chore_log.filter(c => c.user_id === me()).length;
  const goalsDone = S.fin_goals.filter(g => Number(g.saved) >= Number(g.target)).length;
  const streak = bestStreak();
  const m = monthTotals(addMonths(today(), -1));
  const budgetsOk = S.budgets.length && S.budgets.every(b => (m.byCat[b.category] || 0) <= Number(b.amount));
  return [
    ['🌱', 'Первый шаг', 'Выполнить задачу', tasksDone >= 1],
    ['✅', 'Деловой', '100 задач', tasksDone >= 100],
    ['✦', 'Ритуал', '7 дней подряд', streak >= 7],
    ['🔥', 'Огонь', '30 дней подряд', streak >= 30],
    ['💯', 'Сотня', '100 отметок привычек', marks >= 100],
    ['💧', 'Водохлёб', '7 дней нормы воды', waterDays >= 7],
    ['💌', 'Романтик', '10 записок', notesSent >= 10],
    ['📸', 'Летописец', '10 воспоминаний', mems >= 10],
    ['💡', 'Свидание', '5 идей воплощено', ideas >= 5],
    ['🛒', 'Добытчик', '50 покупок', shop >= 50],
    ['🧹', 'Чистюля', '30 дел по дому', chores >= 30],
    ['🎯', 'Мечта', 'Закрыть цель накоплений', goalsDone >= 1],
    ['💰', 'В рамках', 'Месяц в бюджете', !!budgetsOk],
  ].map(([e, t, d, ok]) => ({ e, t, d, ok }));
}

export const MOODS = [['😄', 'Отлично'], ['🙂', 'Хорошо'], ['😐', 'Так себе'], ['😔', 'Грустно'], ['😣', 'Тяжело']];
export const ENERGY = [['🔋', 'Полон сил'], ['🪫', 'Устал(а)'], ['😴', 'Хочу спать']];
export const NEEDS = [['🫂', 'Обними меня'], ['🤫', 'Нужна тишина'], ['🍫', 'Хочу вкусняшку'], ['☕', 'Сделай чай'], ['💬', 'Давай поговорим'], ['🚶', 'Пойдём гулять'], ['🆘', 'Мне тяжело, нужна поддержка'], ['😘', 'Скучаю']];
export const SHOP_CATS = ['Овощи и фрукты', 'Молочное', 'Мясо и рыба', 'Хлеб', 'Бакалея', 'Сладкое', 'Напитки', 'Заморозка', 'Бытовое', 'Аптека', 'Другое'];
export function guessShopCat(text) {
  const t = text.toLowerCase();
  const rules = [['Овощи и фрукты', /яблок|банан|огур|помид|картош|лук|морков|капуст|фрукт|овощ|зелен|лимон|апельсин|ягод|чеснок|перец|авокад|груш|мандарин/],
  ['Молочное', /молок|кефир|сыр|творог|сметан|йогурт|масло сл|ряженк|сливк|яйц/], ['Мясо и рыба', /мяс|кур|говяд|свин|фарш|рыб|колбас|сосис|ветчин|индейк|лосос|креветк/],
  ['Хлеб', /хлеб|батон|лаваш|булк|багет/], ['Бакалея', /круп|рис|гречк|макарон|мук|сахар|соль|масло раст|чай|кофе|овсян|консерв|соус|кетчуп|майонез|специ/],
  ['Сладкое', /шокол|конфет|печень|торт|мороже|зефир|сладк/], ['Напитки', /вод|сок|лимонад|пиво|вино|кола|минерал/], ['Заморозка', /пельмен|заморож|вареник|наггет/],
  ['Бытовое', /порош|мыл|шампун|бумаг|салфет|губк|пакет|средств|зубн|гель|туалет/], ['Аптека', /таблет|витамин|лекарств|пластыр|аптек/]];
  for (const [c, r] of rules) if (r.test(t)) return c;
  return 'Другое';
}
// Небольшая встроенная база продуктов (на 100 г)
export const BASE_FOODS = [['Гречка варёная', 110, 4.2, 1.1, 21], ['Рис варёный', 130, 2.7, 0.3, 28], ['Овсянка на воде', 88, 3, 1.7, 15], ['Макароны варёные', 112, 3.5, 0.4, 23],
['Картофель варёный', 82, 2, 0.4, 17], ['Хлеб белый', 265, 8, 3, 49], ['Хлеб ржаной', 210, 7, 1.2, 40], ['Яйцо куриное (1 шт ≈ 55 г)', 155, 13, 11, 1],
['Куриная грудка', 165, 31, 3.6, 0], ['Говядина', 250, 26, 15, 0], ['Свинина', 260, 25, 18, 0], ['Лосось', 208, 20, 13, 0], ['Творог 5%', 121, 17, 5, 1.8],
['Молоко 2.5%', 52, 2.8, 2.5, 4.7], ['Кефир 1%', 40, 3, 1, 4], ['Йогурт натуральный', 66, 5, 3.2, 3.5], ['Сыр твёрдый', 360, 25, 28, 0], ['Сметана 15%', 160, 2.6, 15, 3.6],
['Банан', 89, 1.1, 0.3, 23], ['Яблоко', 52, 0.3, 0.2, 14], ['Апельсин', 47, 0.9, 0.1, 12], ['Огурец', 15, 0.7, 0.1, 3], ['Помидор', 18, 0.9, 0.2, 3.9], ['Авокадо', 160, 2, 15, 9],
['Орехи грецкие', 654, 15, 65, 14], ['Шоколад молочный', 535, 7.6, 30, 59], ['Сахар', 400, 0, 0, 100], ['Масло растительное', 884, 0, 100, 0], ['Масло сливочное', 717, 0.9, 81, 0.1],
['Пельмени', 275, 12, 13, 29], ['Пицца', 266, 11, 10, 33], ['Борщ', 50, 1.5, 2.5, 5.5], ['Плов', 180, 6, 8, 22], ['Салат овощной с маслом', 90, 1.2, 7, 5]];
export const QUESTIONS = ['О чём ты мечтаешь в этом году?', 'Какой момент этой недели был самым тёплым?', 'Куда бы ты поехал(а) с нами прямо завтра?', 'Что я могу сделать, чтобы твой день стал легче?', 'Какую привычку нам стоит завести вместе?', 'Твоё самое любимое наше воспоминание?', 'Чему ты научился(-ась) за последний месяц?', 'Какой идеальный выходной ты себе представляешь?', 'За что ты сегодня благодарен(-на)?', 'Что нас рассмешило больше всего за последнее время?', 'Какую новую традицию нам придумать?', 'Что бы ты хотел(а) попробовать впервые вместе?', 'Какая песня у тебя ассоциируется с нами?', 'О чём ты давно хотел(а) поговорить?', 'Какой маленький подарок тебя бы порадовал?', 'Где мы будем через 5 лет?', 'Что во мне тебя удивило недавно?', 'Какой у тебя сейчас главный страх и чем я могу помочь?', 'Что для тебя значит «уют»?', 'Как ты понимаешь, что я тебя люблю?'];
export const DATE_IDEAS = [['🎬', 'Киновечер дома с пледом и попкорном'], ['🍳', 'Готовим новое блюдо вместе'], ['🌅', 'Встретить рассвет'], ['🧺', 'Пикник в парке'], ['🎲', 'Вечер настольных игр'], ['🖼', 'Сходить в музей или на выставку'], ['🚲', 'Велопрогулка'], ['💆', 'Домашний СПА-вечер'], ['📷', 'Фотопрогулка по городу'], ['⭐', 'Смотреть на звёзды'], ['🍜', 'Попробовать кухню новой страны'], ['💌', 'Написать письма друг другу в будущее']];
export { D };
