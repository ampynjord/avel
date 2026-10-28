'use strict';

// Gestionnaire de téléchargements : icône toolbar + panneau de progression.

import { $ } from './util.js';

const btn = $('btn-downloads');
const panel = $('downloads-panel');
const listEl = $('downloads-list');
const state = new Map(); // id -> meta

function fmtBytes(n) {
  if (!n || n < 0) return '';
  const u = ['o', 'Ko', 'Mo', 'Go'];
  let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
}

function anyActive() {
  for (const m of state.values()) if (m.state === 'progressing') return true;
  return false;
}

function render() {
  btn.style.display = state.size > 0 ? 'inline-flex' : 'none';
  btn.classList.toggle('active', anyActive());

  listEl.innerHTML = '';
  const items = [...state.values()].reverse();
  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'dl-empty';
    e.textContent = 'Aucun téléchargement';
    listEl.appendChild(e);
    return;
  }

  items.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'dl-row';

    const name = document.createElement('div');
    name.className = 'dl-name';
    name.textContent = m.filename;
    name.title = m.savePath;
    row.appendChild(name);

    if (m.state === 'progressing') {
      const pct = m.total > 0 ? Math.round((m.received / m.total) * 100) : 0;
      const bar = document.createElement('div');
      bar.className = 'dl-bar';
      const fill = document.createElement('div');
      fill.className = 'dl-fill' + (m.total > 0 ? '' : ' indeterminate');
      fill.style.width = (m.total > 0 ? pct : 100) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);

      const meta = document.createElement('div');
      meta.className = 'dl-meta';
      meta.textContent = (m.total > 0 ? pct + '% · ' : '') + fmtBytes(m.received);
      row.appendChild(meta);
    } else {
      const meta = document.createElement('div');
      meta.className = 'dl-meta';
      meta.textContent = m.state === 'completed'
        ? fmtBytes(m.received)
        : (m.state === 'cancelled' ? 'Annulé' : 'Interrompu');
      row.appendChild(meta);

      if (m.state === 'completed') {
        const actions = document.createElement('div');
        actions.className = 'dl-actions';
        const open = document.createElement('button');
        open.className = 'dl-act';
        open.textContent = 'Ouvrir';
        open.addEventListener('click', () => window.avel.openDownload(m.id));
        const folder = document.createElement('button');
        folder.className = 'dl-act';
        folder.textContent = 'Dossier';
        folder.addEventListener('click', () => window.avel.showDownload(m.id));
        actions.appendChild(open);
        actions.appendChild(folder);
        row.appendChild(actions);
      }
    }

    listEl.appendChild(row);
  });
}

export function initDownloads() {
  btn.style.display = 'none';

  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) panel.classList.remove('open');
  });

  const clearBtn = $('dl-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try { await window.avel.clearDownloads(); } catch (_) { /* ignore */ }
      for (const [id, m] of [...state]) if (m.state !== 'progressing') state.delete(id);
      render();
    });
  }

  if (window.avel.onDownloadUpdate) {
    window.avel.onDownloadUpdate((m) => {
      const isNew = !state.has(m.id);
      state.set(m.id, m);
      render();
      if (isNew) panel.classList.add('open'); // ouvre le panneau au démarrage d'un dl
    });
  }

  window.avel.getDownloads()
    .then((list) => { list.forEach((m) => state.set(m.id, m)); render(); })
    .catch(() => {});
}
