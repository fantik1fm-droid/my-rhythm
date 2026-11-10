// Настройки: профиль, «Наш дом», оформление, уведомления, напоминания, данные
import { S, sb, me, partner, prof, add, del, upd, loadAll, saveProfile, TABLES, clearLocal, stopRealtime } from '../data.js';
import { A, toast, empty, sheet, closeSheet, opt } from '../ui.js';
import { esc, today, val, store, download, fmtDate } from '../util.js';

export function render() {
  const p = partner(), h = S.household;
  const others = S.members.filter(m => m.user_id !== me()).map(m => prof(m.user_id)).filter(Boolean);
  const notif = 'Notification' in window ? Notification.permission : 'unsupported';
  const pal = document.documentElement.dataset.palette || 'lavender';
  const theme = store.get('mr10-theme', 'auto');
  const rem = S.reminders.filter(r => !r.done && (r.recurring === 'daily' || r.date >= today()));
  return `<div class="cols"><div>
    <div class="card"><h3>👤 Профиль</h3><div class="form" style="display:flex;flex-direction:column;gap:8px">
      <div class="row nw"><input id="pfEmoji" value="${esc(S.profile?.emoji || '')}" maxlength="4" style="flex:0 0 60px;text-align:center"><input id="pfName" value="${esc(S.profile?.display_name || '')}" placeholder="Имя"></div>
      <div class="small muted">${esc(S.user?.email || '')}</div>
      <div class="row"><button class="primary" data-act="profileSave">Сохранить</button><button data-act="changePass">Сменить пароль</button><span class="sp"></span><button class="ghost" data-act="logout">Выйти</button></div></div></div>

    <div class="card"><h3>🏠 ${esc(h?.name || 'Наш дом')}<span class="right"><button class="icon" data-act="houseRename">✎</button></span></h3>
      ${others.length ? others.map(o => `<div class="item"><span class="av pt">${o.emoji || '💜'}</span><div class="body"><div class="t">${esc(o.display_name)}</div><div class="s">${o.id === p?.id ? 'партнёр' : 'участник'}</div></div></div>`).join('') : '<div class="small muted">Пока ты здесь один(одна).</div>'}
      ${others.length > 1 ? `<div class="msg info small" style="margin-top:8px">В доме больше двух участников. Если один из аккаунтов лишний — удалите его в Supabase → Authentication → Users.</div>` : ''}
      <div class="card soft" style="margin:12px 0 0"><div class="small muted">Код приглашения</div><div style="font-family:var(--f-head);font-size:34px;font-weight:700;letter-spacing:4px">${esc(h?.invite_code || '······')}</div>
        <div class="row"><button class="sm primary" data-act="shareInvite">Отправить</button><button class="sm" data-act="newCode">Новый код</button></div></div>
      <div class="row" style="margin-top:12px"><input id="joinCode" placeholder="Код партнёра" maxlength="6" style="text-transform:uppercase"><button data-act="joinHouse">Присоединиться</button></div>
      <div class="small muted" style="margin-top:6px">Общими будут деньги, покупки, дела по дому, вишлист, даты, хроника и записки. Задачи, привычки, питание — личные, если не отметить «общая».</div></div>

    <div class="card"><h3>🔔 Напоминания</h3>
      <div class="row"><input id="rmText" placeholder="О чём напомнить?" style="flex:2 1 160px"><input id="rmTime" type="time" style="flex:0 1 110px"><select id="rmRec" style="flex:0 1 140px">${opt('daily', 'Каждый день')}${opt('none', 'Один раз')}</select><input id="rmDate" type="date" value="${today()}" style="flex:0 1 150px"><button class="primary" data-act="remAdd">+</button></div>
      ${rem.map(r => `<div class="item"><span class="emo">🔔</span><div class="body"><div class="t">${esc(r.text)}</div><div class="s">${String(r.time || '').slice(0, 5)} · ${r.recurring === 'daily' ? 'каждый день' : fmtDate(r.date)}</div></div><button class="icon" data-act="remDel" data-id="${r.id}">×</button></div>`).join('')}
      <div class="row" style="margin-top:10px"><span class="small muted sp">Уведомления: ${notif === 'granted' ? '✅ включены' : notif === 'denied' ? '🚫 запрещены в браузере' : notif === 'unsupported' ? 'не поддерживаются' : 'выключены'}</span>${notif === 'default' ? '<button class="sm primary" data-act="notifOn">Включить</button>' : ''}</div>
      <div class="small muted">Приложение напомнит о задачах, платежах, делах по дому и важных датах, пока оно открыто или свёрнуто.</div></div>
  </div><div>
    <div class="card"><h3>🎨 Оформление</h3>
      <div class="small muted">Тема</div><div class="chips" style="margin:6px 0 12px">${[['auto', '🌗 Как в системе'], ['light', '☀ Светлая'], ['dark', '🌙 Тёмная']].map(([k, l]) => `<button class="chip ${theme === k ? 'on' : ''}" data-act="setTheme" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="small muted">Цвет</div><div class="chips" style="margin-top:6px">${[['lavender', '💜 Лаванда'], ['rose', '🌸 Роза'], ['mint', '🌿 Мята'], ['sky', '💙 Небо']].map(([k, l]) => `<button class="chip ${pal === k ? 'on' : ''}" data-act="setPalette" data-v="${k}">${l}</button>`).join('')}</div></div>

    <div class="card"><h3>📲 Приложение</h3><div class="small">${matchMedia('(display-mode: standalone)').matches ? '✅ Установлено как приложение' : 'Установи «Мой Ритм» на главный экран — откроется без браузера, будет работать без интернета.'}</div>
      ${window.__installPrompt ? '<button class="primary" style="margin-top:10px" data-act="install">Установить</button>' : (matchMedia('(display-mode: standalone)').matches ? '' : '<div class="small muted" style="margin-top:8px">Android (Chrome): меню ⋮ → «Установить приложение» / «Добавить на главный экран».<br>iPhone (Safari): кнопка «Поделиться» → «На экран Домой».</div>')}
      <div class="small muted" style="margin-top:8px">Офлайн: ${S.pending ? `ждут отправки ${S.pending} изменений` : 'все изменения сохранены в облаке'}.</div></div>

    <div class="card"><h3>💾 Данные</h3><div class="row"><button data-act="backup">⇩ Резервная копия (JSON)</button><button data-act="reload">↻ Обновить данные</button></div></div>
    <div class="card soft"><div class="small muted">Мой Ритм v10 · наш общий ритм ♡</div></div>
  </div></div>`;
}

A.profileSave = async () => { await saveProfile({ display_name: val('pfName') || S.profile.display_name, emoji: val('pfEmoji') || '💜' }); toast('Сохранено'); };
A.changePass = async () => { const p = prompt('Новый пароль (мин. 6 символов):'); if (!p) return; if (p.length < 6) return toast('Слишком короткий'); const { error } = await sb.auth.updateUser({ password: p }); toast(error ? 'Ошибка: ' + error.message : '🔐 Пароль изменён'); };
A.logout = async () => { if (!confirm('Выйти из аккаунта?')) return; stopRealtime(); clearLocal(); await sb.auth.signOut().catch(() => { }); location.reload(); };
A.houseRename = async () => { const n = prompt('Название дома:', S.household?.name || 'Наш дом'); if (!n) return; const { error } = await sb.from('households').update({ name: n.trim() }).eq('id', S.household.id); if (error) return toast('Ошибка: ' + error.message); S.household.name = n.trim(); window.__render(); };
A.newCode = async () => { const { data, error } = await sb.rpc('new_invite_code'); if (error) return toast('Ошибка: ' + error.message); S.household.invite_code = data; window.__render(); };
A.shareInvite = async () => {
  const text = `💜 Присоединяйся к нашему дому в «Мой Ритм»!\n1) Открой ${location.origin + location.pathname}\n2) Зарегистрируйся\n3) Настройки → «Код партнёра»: ${S.household?.invite_code}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Приглашение скопировано'); } } catch { }
};
A.joinHouse = async () => {
  const code = val('joinCode').toUpperCase(); if (code.length < 4) return toast('Введи код');
  if (!confirm('Присоединиться к дому партнёра? Твои общие записи из текущего дома останутся там.')) return;
  const { error } = await sb.rpc('join_household', { code }); if (error) return toast(error.message);
  toast('💜 Добро пожаловать домой!'); await loadAll();
};
A.setTheme = el => { store.set('mr10-theme', el.dataset.v); window.__applyTheme(); window.__render(); };
A.setPalette = el => { store.set('mr10-palette', el.dataset.v); window.__applyTheme(); window.__render(); };
A.install = async () => { const p = window.__installPrompt; if (!p) return; p.prompt(); await p.userChoice; window.__installPrompt = null; window.__render(); };
A.remAdd = async () => { const text = val('rmText'), time = val('rmTime'); if (!text || !time) return toast('Текст и время'); await add('reminders', { text, time, recurring: val('rmRec'), date: val('rmDate') || today(), done: false }); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); toast('🔔 Добавлено'); };
A.remDel = async el => del('reminders', el.dataset.id);
A.notifOn = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? '🔔 Уведомления включены' : 'Не разрешено'); window.__render(); };
A.backup = () => { const data = { app: 'my-rhythm', version: 10, exported: new Date().toISOString(), profile: S.profile, goals: S.goals }; TABLES.forEach(t => data[t] = S[t]); download(JSON.stringify(data, null, 1), `Мой-ритм-${today()}.json`); toast('⇩ Копия сохранена'); };
A.reload = async () => { await loadAll(); toast('↻ Обновлено'); };
