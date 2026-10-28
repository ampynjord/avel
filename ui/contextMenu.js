'use strict';

// Menu contextuel custom (clic droit dans une page web), stylé Sci-Fi.
// Les paramètres (position, sélection, lien) viennent du processus principal.

import { $ } from './util.js';
import { activeTab, navigate, newTab } from './tabs.js';

const menu = $('context-menu');
let open = false;

function hide() {
  if (!open) return;
  open = false;
  menu.style.display = 'none';
  menu.innerHTML = '';
}

function item(label, fn, opts = {}) {
  const el = document.createElement('button');
  el.className = 'ctx-item' + (opts.accent ? ' accent' : '');
  el.textContent = label;
  el.addEventListener('click', () => { hide(); fn(); });
  return el;
}

function separator() {
  const s = document.createElement('div');
  s.className = 'ctx-sep';
  return s;
}

function sendSelectionToAssistant(text) {
  $('assistant-panel').classList.remove('collapsed');
  const input = $('chat-input');
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.focus();
}

function show(params) {
  const t = activeTab();
  menu.innerHTML = '';

  menu.appendChild(item('Précédent', () => { if (t && t.webview.canGoBack()) t.webview.goBack(); }));
  menu.appendChild(item('Suivant', () => { if (t && t.webview.canGoForward()) t.webview.goForward(); }));
  menu.appendChild(item('Recharger', () => { if (t) t.webview.reload(); }));
  menu.appendChild(separator());

  if (params.linkURL) {
    menu.appendChild(item('Ouvrir le lien dans un nouvel onglet', () => newTab(params.linkURL)));
    menu.appendChild(item("Copier l'adresse du lien", () => window.avel.copyText(params.linkURL)));
    menu.appendChild(separator());
  }

  if (params.selectionText) {
    menu.appendChild(item('Copier', () => window.avel.copyText(params.selectionText)));
    menu.appendChild(item("✦ Envoyer à l'Assistant Avel",
      () => sendSelectionToAssistant(params.selectionText), { accent: true }));
    menu.appendChild(separator());
  }

  menu.appendChild(item("Copier l'URL de la page",
    () => window.avel.copyText(params.pageURL || (t && t.url) || '')));
  menu.appendChild(item("Inspecter l'élément", () => window.avel.inspectElement()));

  // Positionnement : coordonnées page → coordonnées fenêtre via le rect webview.
  const rect = (t && t.webview) ? t.webview.getBoundingClientRect() : { left: 0, top: 0 };
  menu.style.display = 'block';
  open = true;

  let x = rect.left + params.x;
  let y = rect.top + params.y;
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  if (x + mw > window.innerWidth) x = window.innerWidth - mw - 4;
  if (y + mh > window.innerHeight) y = window.innerHeight - mh - 4;
  menu.style.left = Math.max(4, x) + 'px';
  menu.style.top = Math.max(4, y) + 'px';
}

export function initContextMenu() {
  if (window.avel.onContextMenu) window.avel.onContextMenu(show);
  document.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
}
