'use strict';

// ----------------------------------------------------------------------
// Avel Studio — Stockage des documents (chiffré)
// ----------------------------------------------------------------------
// Les documents (texte, tableur) sont chiffrés au repos avec le MÊME cœur
// cryptographique qu'Avel Drive (clé maître safeStorage) — cohérence de la
// suite souveraine. Les métadonnées (titre, type) restent en index local.
// ----------------------------------------------------------------------

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const driveCrypto = require('../drive/crypto');
const keystore = require('../drive/keystore');

function dir() {
  const d = path.join(app.getPath('userData'), 'avel-studio');
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
  return d;
}
const indexPath = () => path.join(dir(), 'index.json');
const docPath = (id) => path.join(dir(), 'docs', `${id}.enc`);

function loadIndex() {
  try { return JSON.parse(fs.readFileSync(indexPath(), 'utf8')); } catch (_) { return []; }
}
function saveIndex(ix) { fs.writeFileSync(indexPath(), JSON.stringify(ix, null, 2), 'utf8'); }

function list() { return loadIndex(); }

function get(id) {
  try {
    const blob = fs.readFileSync(docPath(id));
    const json = driveCrypto.decrypt(blob, keystore.getKey()).toString('utf8');
    return JSON.parse(json);
  } catch (_) { return null; }
}

function save(doc) {
  const ix = loadIndex();
  const id = doc.id || crypto.randomUUID().replace(/-/g, '');
  const now = Date.now();
  const full = { id, type: doc.type, title: doc.title || 'Sans titre', content: doc.content, updatedAt: now };
  fs.writeFileSync(docPath(id), driveCrypto.encrypt(Buffer.from(JSON.stringify(full)), keystore.getKey()));
  const meta = { id, type: full.type, title: full.title, updatedAt: now };
  const i = ix.findIndex((x) => x.id === id);
  if (i >= 0) ix[i] = meta; else ix.unshift(meta);
  saveIndex(ix);
  return full;
}

function remove(id) {
  try { fs.rmSync(docPath(id), { force: true }); } catch (_) { /* ignore */ }
  saveIndex(loadIndex().filter((x) => x.id !== id));
  return { ok: true };
}

module.exports = { list, get, save, remove };
