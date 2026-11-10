// Данные: Supabase, состояние, офлайн-кэш, очередь изменений, realtime
import { uid, store, today } from './util.js';

const SUPABASE_URL = 'https://kmsbtmkqbllacfnerpya.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wnodCkT4BDMpGmqiH9Dg0Q_24qd7Cx1';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

export const TABLES = ['tasks', 'habits', 'habit_marks', 'foods', 'meals', 'recipes', 'days', 'reminders',
  'accounts', 'transactions', 'fin_goals', 'payments', 'wishlist', 'important_dates', 'plans',
  'shopping', 'chores', 'chore_log', 'budgets', 'notes', 'memories', 'date_ideas', 'meal_plan'];
const NO_CREATED = new Set(['days', 'habit_marks']);
const ORDER = { days: ['date', false], habit_marks: ['date', false], transactions: ['date', false], meals: ['date', false], notes: ['created_at', false], chore_log: ['date', false], memories: ['date', false] };

export const S = {
  user: null, profile: null, profiles: [], household: null, members: [],
  goals: { k: 2000, p: 100, f: 70, c: 250, water: 2000, glass: 250 },
  online: navigator.onLine, synced: false, pending: 0,
  ui: {}
};
TABLES.forEach(t => S[t] = []);

export const me = () => S.user?.id;
export const partner = () => S.profiles.find(p => p.id !== me() && S.members.some(m => m.user_id === p.id)) || null;
export const prof = id => S.profiles.find(p => p.id === id) || null;
export const isMe = id => id === me();

let onChange = () => { };
export const setOnChange = f => { onChange = f; };
let changeTimer = null;
function changed() { clearTimeout(changeTimer); changeTimer = setTimeout(() => { onChange(); saveCache(); }, 30); }

// ---------- кэш для офлайна ----------
const cacheKey = () => 'mr10-cache-' + me();
function saveCache() {
  if (!me()) return;
  const snap = { at: Date.now(), profile: S.profile, profiles: S.profiles, household: S.household, members: S.members, goals: S.goals };
  TABLES.forEach(t => snap[t] = S[t]);
  store.set(cacheKey(), snap);
}
export function loadCache() {
  const c = store.get(cacheKey());
  if (!c) return false;
  Object.assign(S, { profile: c.profile, profiles: c.profiles || [], household: c.household, members: c.members || [], goals: c.goals || S.goals });
  TABLES.forEach(t => S[t] = c[t] || []);
  return true;
}

// ---------- очередь офлайн-изменений ----------
const qKey = () => 'mr10-outbox-' + me();
const outbox = () => store.get(qKey(), []);
const isNetErr = e => !navigator.onLine || /fetch|network|Failed|Load failed|timeout/i.test(e?.message || String(e));
function enqueue(job) { const q = outbox(); q.push(job); store.set(qKey(), q); S.pending = q.length; }
async function run(job) {
  const q = sb.from(job.table);
  if (job.op === 'insert') return q.insert(job.rows);
  if (job.op === 'update') return q.update(job.patch).eq('id', job.id);
  if (job.op === 'delete') return q.delete().eq('id', job.id);
  if (job.op === 'upsert') return q.upsert(job.rows, job.opts || {});
}
async function exec(job) {
  try {
    const { error } = await run(job);
    if (error) throw error;
    return true;
  } catch (e) {
    if (isNetErr(e)) { enqueue(job); setOnline(false); return true; }
    console.error(job, e);
    hooks.error?.(e.message || 'Ошибка сохранения');
    return false;
  }
}
export async function flush() {
  const q = outbox(); if (!q.length) return;
  const rest = [];
  for (const job of q) {
    try { const { error } = await run(job); if (error && !isNetErr(error)) console.warn('drop', job, error); else if (error) rest.push(job); }
    catch (e) { rest.push(job); }
  }
  store.set(qKey(), rest); S.pending = rest.length;
  if (q.length !== rest.length) hooks.info?.(`☁ Синхронизировано: ${q.length - rest.length}`);
  changed();
}
export const hooks = {};

// ---------- CRUD (оптимистично) ----------
export async function add(table, row) {
  const r = { id: uid(), ...row };
  if (needsUser(table) && !r.user_id) r.user_id = me();
  if (!r.created_at && !NO_CREATED.has(table)) r.created_at = new Date().toISOString();
  S[table] = [r, ...S[table].filter(x => x.id !== r.id)];
  changed();
  const ok = await exec({ op: 'insert', table, rows: [r] });
  if (!ok) { S[table] = S[table].filter(x => x.id !== r.id); changed(); return null; }
  return r;
}
export async function addMany(table, rows) {
  const rs = rows.map(row => ({ id: uid(), ...(needsUser(table) ? { user_id: me() } : {}), ...(NO_CREATED.has(table) ? {} : { created_at: new Date().toISOString() }), ...row }));
  S[table] = [...rs, ...S[table]]; changed();
  const ok = await exec({ op: 'insert', table, rows: rs });
  if (!ok) { const ids = new Set(rs.map(r => r.id)); S[table] = S[table].filter(x => !ids.has(x.id)); changed(); }
  return ok ? rs : null;
}
export async function upd(table, id, patch) {
  const r = S[table].find(x => x.id === id); const old = r ? { ...r } : null;
  if (r) Object.assign(r, patch); changed();
  const ok = await exec({ op: 'update', table, id, patch });
  if (!ok && r) { Object.assign(r, old); changed(); }
  return ok;
}
export async function del(table, id) {
  const old = S[table]; S[table] = old.filter(x => x.id !== id); changed();
  const ok = await exec({ op: 'delete', table, id });
  if (!ok) { S[table] = old; changed(); }
  return ok;
}
const needsUser = t => ['tasks', 'habits', 'habit_marks', 'foods', 'meals', 'recipes', 'days', 'reminders'].includes(t);

// ---------- загрузка ----------
export async function loadAll() {
  const id = me();
  const safe = async (p, fb) => { try { const r = await p; if (r.error) throw r.error; return r.data ?? fb; } catch (e) { if (isNetErr(e)) throw e; console.warn(e); return fb; } };
  try { await sb.rpc('ensure_household'); } catch (e) { if (isNetErr(e)) throw e; }
  const [profiles, members, households, goals, ...rest] = await Promise.all([
    safe(sb.from('profiles').select('*'), []),
    safe(sb.from('household_members').select('*'), []),
    safe(sb.from('households').select('*'), []),
    safe(sb.from('goals').select('*').eq('user_id', id).maybeSingle(), null),
    ...TABLES.map(t => { let q = sb.from(t).select('*'); const o = ORDER[t] || ['created_at', false]; q = q.order(o[0], { ascending: o[1] }); return safe(q.limit(5000), null); })
  ]);
  S.profiles = profiles; S.members = members; S.household = households[0] || null;
  S.profile = profiles.find(p => p.id === id) || S.profile;
  if (goals) S.goals = { ...S.goals, ...goals };
  TABLES.forEach((t, i) => { if (rest[i]) S[t] = rest[i]; });
  S.synced = true;
  changed();
}

// ---------- realtime ----------
let channel = null;
export function realtime() {
  stopRealtime();
  const ch = sb.channel('mr10-' + me());
  TABLES.forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => onRt(t, p)));
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, () => loadAll().catch(() => { }));
  ch.subscribe(s => { if (s === 'SUBSCRIBED') setOnline(true); if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setOnline(false); });
  channel = ch;
}
export function stopRealtime() { if (channel) { try { sb.removeChannel(channel); } catch { } channel = null; } }
function onRt(t, { eventType, new: row, old }) {
  const arr = S[t];
  if (eventType === 'DELETE') S[t] = arr.filter(x => x.id !== old.id);
  else {
    const i = arr.findIndex(x => x.id === row.id);
    if (i >= 0) arr[i] = { ...arr[i], ...row };
    else { S[t] = [row, ...arr]; if (eventType === 'INSERT') hooks.remoteInsert?.(t, row); }
  }
  changed();
}

export function setOnline(v) {
  if (S.online === v) return; S.online = v; changed();
  if (v) flush();
}
window.addEventListener('online', () => { setOnline(true); flush(); if (me()) loadAll().catch(() => { }); });
window.addEventListener('offline', () => setOnline(false));

// ---------- цели (одна строка на пользователя) ----------
export async function saveGoals(patch) {
  Object.assign(S.goals, patch); changed();
  const { id, ...rest } = S.goals;
  return exec({ op: 'upsert', table: 'goals', rows: [{ ...rest, user_id: me() }], opts: { onConflict: 'user_id' } });
}
export async function saveProfile(patch) {
  Object.assign(S.profile, patch); const p = S.profiles.find(x => x.id === me()); if (p) Object.assign(p, patch); changed();
  return exec({ op: 'update', table: 'profiles', id: me(), patch });
}
export function clearLocal() { store.del(cacheKey()); }
export const todayStr = today;
