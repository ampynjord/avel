'use strict';

// ----------------------------------------------------------------------
// Avel — Gestion des onglets multi-pages + cycle de vie des <webview>
// ----------------------------------------------------------------------

import { $, toUrl } from './util.js';
import { updateStar, renderHomeBookmarks } from './bookmarks.js';

const viewport = $('viewport');
const home = $('home-screen');
const urlInput = $('url-input');
const loadingBar = $('loading-bar');

let tabs = [];
let activeId = null;
let seq = 0;

export function activeTab() { return tabs.find((t) => t.id === activeId) || null; }
function byWebview(wv) { return tabs.find((t) => t.webview === wv) || null; }

function setLoading(tab, on) {
  tab.loading = on;
  if (tab.id === activeId) loadingBar.classList.toggle('active', on);
  renderTabs();
}

function createWebview(isPrivate) {
  const wv = document.createElement('webview');
  wv.setAttribute('autosize', 'on');
  wv.setAttribute('src', 'about:blank');
  // Onglet privé : session en mémoire isolée (préfixe sans "persist:").
  if (isPrivate) wv.setAttribute('partition', 'avel:private');
  wv.style.cssText = 'width:100%;height:100%;flex:1 1 auto;display:none;';

  wv.addEventListener('page-title-updated', (e) => {
    const t = byWebview(wv);
    if (!t) return;
    if (e.title) t.title = e.title;
    renderTabs();
  });

  const onNav = (e) => {
    const t = byWebview(wv);
    if (!t) return;
    const u = e.url || wv.getURL();
    if (u && u !== 'about:blank') t.url = u;
    if (t.id === activeId) { urlInput.value = t.url || ''; updateStar(); }
  };
  wv.addEventListener('did-navigate', onNav);
  wv.addEventListener('did-navigate-in-page', onNav);

  wv.addEventListener('did-start-loading', () => {
    const t = byWebview(wv);
    if (t) setLoading(t, true);
  });
  wv.addEventListener('did-stop-loading', () => {
    const t = byWebview(wv);
    if (t) setLoading(t, false);
  });

  wv.addEventListener('dom-ready', () => {
    const t = byWebview(wv);
    if (!t) return;
    // Réapplique le zoom mémorisé après chaque navigation.
    if (t.zoom && t.zoom !== 1) { try { wv.setZoomFactor(t.zoom); } catch (_) { /* ignore */ } }
  });

  // Historique enregistré uniquement quand la page a fini de charger.
  wv.addEventListener('did-finish-load', () => {
    const t = byWebview(wv);
    if (!t) return;
    const u = wv.getURL();
    if (u && /^https?:\/\//i.test(u)) {
      const title = wv.getTitle() || u;
      t.title = title; t.url = u; t.crashed = false;
      renderTabs();
      if (t.id === activeId) { urlInput.value = u; updateStar(); }
      if (!t.private) window.avel.recordVisit(u, title); // navigation privée = sans historique
    }
  });

  wv.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3) return; // ERR_ABORTED : navigation annulée
    const t = byWebview(wv);
    if (t) setLoading(t, false);
  });

  wv.addEventListener('render-process-gone', () => {
    const t = byWebview(wv);
    if (!t) return;
    t.crashed = true; t.loading = false; t.title = '⚠ Page interrompue';
    if (t.id === activeId) loadingBar.classList.remove('active');
    renderTabs();
  });

  viewport.appendChild(wv);
  return wv;
}

export function newTab(url, opts = {}) {
  const id = ++seq;
  const isPrivate = !!opts.private;
  const tab = {
    id, url: null, title: isPrivate ? 'Onglet privé' : 'Nouvel onglet',
    zoom: 1, loading: false, crashed: false, private: isPrivate,
    webview: createWebview(isPrivate)
  };
  tabs.push(tab);
  activateTab(id);
  if (url) navigateTo(tab, url);
  return tab;
}

function navigateTo(tab, value) {
  const url = toUrl(value);
  if (!url) return;
  tab.url = url;
  tab.webview.src = url;
  if (tab.id === activeId) {
    home.classList.add('hidden');
    tab.webview.style.display = 'flex';
    urlInput.value = url;
    updateStar();
  }
}

export function navigate(value) {
  const t = activeTab() || newTab();
  navigateTo(t, value);
}

export function activateTab(id) {
  activeId = id;
  renderTabs();
  syncView();
  const t = activeTab();
  urlInput.value = (t && t.url) || '';
  loadingBar.classList.toggle('active', !!(t && t.loading));
  updateStar();
}

export function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);
  try { tab.webview.remove(); } catch (_) { /* déjà détachée */ }
  if (activeId === id) {
    const next = tabs[idx] || tabs[idx - 1];
    if (next) activateTab(next.id);
    else newTab();
  } else {
    renderTabs();
  }
}

export function cycleTab(dir) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeId);
  const ni = (idx + dir + tabs.length) % tabs.length;
  activateTab(tabs[ni].id);
}

export function goHome() {
  const t = activeTab();
  if (!t) return;
  t.url = null; t.title = 'Nouvel onglet'; t.crashed = false; t.loading = false;
  t.webview.style.display = 'none';
  t.webview.src = 'about:blank';
  loadingBar.classList.remove('active');
  renderTabs();
  home.classList.remove('hidden');
  renderHomeBookmarks();
  urlInput.value = '';
  updateStar();
}

function renderTabs() {
  const cont = $('tabs');
  cont.innerHTML = '';
  tabs.forEach((t) => {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === activeId ? ' active' : '')
      + (t.crashed ? ' crashed' : '') + (t.private ? ' private' : '');
    el.dataset.id = t.id;
    el.title = t.url || t.title;

    if (t.loading) {
      const sp = document.createElement('span');
      sp.className = 'tab-spinner';
      el.appendChild(sp);
    } else if (t.private) {
      const ic = document.createElement('span');
      ic.className = 'tab-private-icon';
      ic.textContent = '🕶';
      el.appendChild(ic);
    }

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = t.title || 'Nouvel onglet';

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = "Fermer l'onglet";

    el.appendChild(title);
    el.appendChild(close);
    cont.appendChild(el);
  });
}

function syncView() {
  const t = activeTab();
  tabs.forEach((x) => { x.webview.style.display = 'none'; });
  if (t && t.url) {
    home.classList.add('hidden');
    t.webview.style.display = 'flex';
  } else {
    home.classList.remove('hidden');
    renderHomeBookmarks();
  }
}

// Câblage de la barre d'onglets et des boutons de navigation.
export function initTabBar() {
  $('btn-new-tab').addEventListener('click', () => newTab());
  $('tabs').addEventListener('click', (e) => {
    const tabEl = e.target.closest('.tab');
    if (!tabEl) return;
    const id = Number(tabEl.dataset.id);
    if (e.target.classList.contains('tab-close')) closeTab(id);
    else activateTab(id);
  });

  $('btn-back').addEventListener('click', () => {
    const t = activeTab();
    if (t && t.url && t.webview.canGoBack()) t.webview.goBack();
  });
  $('btn-forward').addEventListener('click', () => {
    const t = activeTab();
    if (t && t.url && t.webview.canGoForward()) t.webview.goForward();
  });
  $('btn-reload').addEventListener('click', () => {
    const t = activeTab();
    if (t && t.url) t.webview.reload();
  });
  $('btn-home').addEventListener('click', goHome);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(urlInput.value);
  });

  document.querySelectorAll('.quick a').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.dataset.url); });
  });
}
