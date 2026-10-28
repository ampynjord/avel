'use strict';

// Favoris : bouton étoile (barre d'URL), tuiles d'accueil, et barre de
// favoris horizontale (masquable via Ctrl+Shift+B).

import { $ } from './util.js';
import { navigate, newTab, activeTab } from './tabs.js';

const starBtn = $('btn-star');
let bookmarkSet = new Set();

async function fetchBookmarks() {
  let list = [];
  try { list = await window.avel.getBookmarks(); } catch (_) { /* vide */ }
  bookmarkSet = new Set(list.map((b) => b.url));
  return list;
}

export async function loadBookmarks() {
  await fetchBookmarks();
  renderBookmarksBar();
}

export function updateStar() {
  const t = activeTab();
  const has = !!(t && t.url && bookmarkSet.has(t.url));
  starBtn.textContent = has ? '★' : '☆';
  starBtn.classList.toggle('active', has);
  starBtn.disabled = !(t && t.url);
  starBtn.title = !(t && t.url)
    ? 'Aucune page à ajouter'
    : has ? 'Retirer des favoris' : 'Ajouter aux favoris';
}

export async function renderHomeBookmarks() {
  const list = await fetchBookmarks();
  const grid = $('home-bookmarks');
  if (!grid) return;
  grid.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'home-empty';
    empty.textContent = "Aucun favori pour l'instant — cliquez sur ☆ dans la barre d'adresse.";
    grid.appendChild(empty);
    return;
  }
  list.forEach((b) => {
    const tile = document.createElement('button');
    tile.className = 'bm-tile';
    tile.textContent = b.title || b.url;
    tile.title = b.url;
    tile.addEventListener('click', () => navigate(b.url));
    grid.appendChild(tile);
  });
}

export async function renderBookmarksBar() {
  const bar = $('bookmarks-bar');
  if (!bar) return;
  const list = await fetchBookmarks();
  bar.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('span');
    empty.className = 'bmbar-empty';
    empty.textContent = 'Vos favoris apparaîtront ici';
    bar.appendChild(empty);
    return;
  }
  list.forEach((b) => {
    const it = document.createElement('button');
    it.className = 'bmbar-item';
    it.title = b.url;
    it.textContent = b.title || b.url;
    it.addEventListener('click', () => navigate(b.url));
    it.addEventListener('auxclick', (e) => {
      if (e.button === 1) { e.preventDefault(); newTab(b.url); } // clic molette → nouvel onglet
    });
    bar.appendChild(it);
  });
}

export function initStar() {
  starBtn.addEventListener('click', async () => {
    const t = activeTab();
    if (!t || !t.url) return;
    try {
      const res = await window.avel.toggleBookmark(t.url, t.title);
      if (res.bookmarked) bookmarkSet.add(t.url);
      else bookmarkSet.delete(t.url);
      updateStar();
      renderBookmarksBar();
      if (!$('home-screen').classList.contains('hidden')) renderHomeBookmarks();
    } catch (_) { /* ignore */ }
  });
}

// --- Barre de favoris : visibilité (Ctrl+Shift+B) ---
export function initBookmarksBar() {
  const bar = $('bookmarks-bar');
  const hidden = localStorage.getItem('avel.bmbar') === '0';
  bar.classList.toggle('hidden', hidden);
  renderBookmarksBar();
}

export function toggleBookmarksBar() {
  const bar = $('bookmarks-bar');
  const nowHidden = bar.classList.toggle('hidden');
  localStorage.setItem('avel.bmbar', nowHidden ? '0' : '1');
}
