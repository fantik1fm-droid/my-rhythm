// Интерфейс: тосты, нижние листы, конфетти, реестр действий
import { $, esc } from './util.js';

export const A = {}; // действия: data-act="имя"

export function toast(msg, undo) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  if (undo) { const b = document.createElement('button'); b.textContent = 'Отменить'; b.onclick = () => { undo(); t.remove(); }; t.appendChild(b); }
  $('toasts').appendChild(t); setTimeout(() => t.remove(), undo ? 5000 : 2600);
}
export function sheet(html, onOpen) {
  $('sheet').innerHTML = html; $('sheet').classList.add('on'); $('sheetBack').classList.add('on');
  setTimeout(() => { const f = $('sheet').querySelector('[autofocus]'); if (f) f.focus(); onOpen?.(); }, 60);
}
export function closeSheet() { $('sheet').classList.remove('on'); $('sheetBack').classList.remove('on'); }
export const sheetOpen = () => $('sheet').classList.contains('on');
A.closeSheet = closeSheet;

export function confetti(n = 70) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
  const cs = ['#b8a1ed', '#e8a3c6', '#f4c06f', '#8fcfb0', '#a1c8ed', '#8970c9'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.style.left = Math.random() * 100 + 'vw'; c.style.background = cs[i % cs.length];
    c.style.borderRadius = Math.random() > .5 ? '50%' : '2px'; c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's'; c.style.animationDelay = Math.random() * .3 + 's';
    box.appendChild(c);
  }
  setTimeout(() => box.remove(), 3800);
}

export const empty = t => `<div class="empty">${t}</div>`;
export const bar = (ratio, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, ratio * 100))}%"></i></div>`;
export const stat = (l, v, sub = '', ratio) => `<div class="stat"><div class="l">${l}</div><div class="v">${v}</div>${sub ? `<div class="l">${sub}</div>` : ''}${ratio === undefined ? '' : bar(ratio)}</div>`;
export const tabs = (key, cur, list) => `<div class="tabs">${list.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="setUi" data-k="${key}" data-v="${k}">${l}</button>`).join('')}</div>`;
export const seg = (key, cur, list) => `<div class="seg">${list.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="setUi" data-k="${key}" data-v="${k}">${l}</button>`).join('')}</div>`;
export const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(l)}</option>`;
export const confirmAsk = msg => window.confirm(msg);
export const ask = (msg, def = '') => window.prompt(msg, def);

// Делегирование событий: click / change / Enter
export function bindActions(root = document) {
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'button')) return;
    if (el.type === 'checkbox') return; // обрабатывается в change
    const f = A[el.dataset.act]; if (!f) return console.warn('no action', el.dataset.act);
    e.preventDefault(); f(el, e);
  });
  root.addEventListener('change', e => {
    const el = e.target.closest('[data-act],[data-chg]'); if (!el) return;
    const name = el.dataset.chg || (el.type === 'checkbox' ? el.dataset.act : null);
    if (name && A[name]) A[name](el, e);
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheetOpen()) closeSheet();
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = e.target.closest('[data-enter]'); if (!el) return;
    e.preventDefault(); A[el.dataset.enter]?.(el, e);
  });
}
