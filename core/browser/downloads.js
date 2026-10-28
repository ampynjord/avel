'use strict';

// ----------------------------------------------------------------------
// Avel — Gestionnaire de téléchargements (processus principal)
// ----------------------------------------------------------------------
// Intercepte les téléchargements via session.on('will-download'), les
// enregistre dans le dossier Téléchargements local, suit la progression
// et la relaie au renderer. 100 % local et souverain.
// ----------------------------------------------------------------------

const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let seq = 0;
const items = new Map(); // id -> { item, meta }

function meta(id) {
  const entry = items.get(id);
  return entry ? entry.meta : null;
}

function snapshot() {
  return [...items.values()].map((e) => e.meta);
}

// Évite l'écrasement : foo.pdf -> foo (1).pdf si déjà présent.
function uniquePath(dir, filename) {
  let candidate = path.join(dir, filename);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

function install(session, { getWindow }) {
  const sendToUi = (payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('avel:download-update', payload);
  };

  session.on('will-download', (event, item) => {
    const id = ++seq;
    const downloadsDir = app.getPath('downloads');
    const savePath = uniquePath(downloadsDir, item.getFilename());
    item.setSavePath(savePath);

    const m = {
      id,
      filename: path.basename(savePath),
      savePath,
      received: 0,
      total: item.getTotalBytes(),
      state: 'progressing'
    };
    items.set(id, { item, meta: m });
    sendToUi(m);

    item.on('updated', (_e, state) => {
      m.received = item.getReceivedBytes();
      m.total = item.getTotalBytes();
      m.state = state === 'interrupted' ? 'interrupted' : 'progressing';
      sendToUi(m);
    });

    item.on('done', (_e, state) => {
      m.received = item.getReceivedBytes();
      m.state = state; // 'completed' | 'cancelled' | 'interrupted'
      sendToUi(m);
    });
  });
}

function openFile(id) {
  const m = meta(id);
  if (m && m.state === 'completed') return shell.openPath(m.savePath);
  return Promise.resolve('not-ready');
}

function showInFolder(id) {
  const m = meta(id);
  if (m) shell.showItemInFolder(m.savePath);
  return true;
}

function clear() {
  // On ne supprime pas les fichiers, juste la liste affichée.
  for (const [, e] of items) {
    if (e.meta.state === 'progressing') continue; // garde les en-cours
  }
  for (const [id, e] of [...items]) {
    if (e.meta.state !== 'progressing') items.delete(id);
  }
  return snapshot();
}

module.exports = { install, all: snapshot, openFile, showInFolder, clear };
