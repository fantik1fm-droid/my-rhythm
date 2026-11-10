// Общие помощники
export const $ = id => document.getElementById(id);
export const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
export const num = v => { const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : 0; };
export const val = id => ($(id)?.value ?? '').trim();

// ---- даты (всегда локальные YYYY-MM-DD) ----
export const ymd = d => { const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const today = () => ymd(new Date());
export const D = s => new Date(s + 'T12:00:00');
export const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
export const daysUntil = s => daysBetween(today(), s);
export const weekday = s => (D(s).getDay() + 6) % 7; // 0 = пн
export const monthKey = s => s.slice(0, 7);
export const monthStart = s => s.slice(0, 8) + '01';
export const monthEnd = s => { const d = D(monthStart(s)); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
export const addMonths = (s, n) => { const d = D(s); const day = d.getDate(); const t = new Date(d.getFullYear(), d.getMonth() + n, 1, 12); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); t.setDate(Math.min(day, last)); return ymd(t); };
export const payDateIn = (y, m, day) => { const last = new Date(y, m + 1, 0).getDate(); return ymd(new Date(y, m, Math.min(day, last), 12)); };
export const range = (from, to) => { const out = []; for (let s = from; s <= to; s = addDays(s, 1)) out.push(s); return out; };
export const fmtDate = (s, o = { day: 'numeric', month: 'long' }) => D(s).toLocaleDateString('ru-RU', o);
export const fmtDay = s => { const n = daysUntil(s); return n === 0 ? 'сегодня' : n === 1 ? 'завтра' : n === -1 ? 'вчера' : fmtDate(s, { day: 'numeric', month: 'short', weekday: 'short' }); };
export const inDays = n => n < 0 ? `просрочено на ${-n} дн.` : n === 0 ? 'сегодня' : n === 1 ? 'завтра' : `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// следующая годовщина (для дней рождения и важных дат)
export const nextYearly = s => { const t = today(); const y = Number(t.slice(0, 4)); let c = y + s.slice(4); if (s.slice(5) === '02-29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) c = y + '-02-28'; if (c < t) c = (y + 1) + s.slice(4); return c; };

export const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };
export const rub = (x, sign = false) => { const n = Math.round(Number(x) || 0); return (sign && n > 0 ? '+' : '') + (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ru-RU') + ' ₽'; };
export const kfmt = x => { const n = Math.round(Number(x) || 0); return Math.abs(n) >= 1000 ? (n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace('.0', '') + 'к' : String(n); };
export const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const hashDay = s => Math.floor(D(s) / 864e5);

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};

export function download(text, name, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a');
  a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1500);
}
export function parseCSV(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
