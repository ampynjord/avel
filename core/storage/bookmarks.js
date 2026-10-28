'use strict';

// ----------------------------------------------------------------------
// Avel — Gestionnaire de favoris locaux & souverains
// ----------------------------------------------------------------------
// Persistance dans userData/avel-bookmarks.json. Aucune synchronisation
// cloud : les favoris restent 100 % sur la machine de l'utilisateur.
// ----------------------------------------------------------------------

const fs = require('fs');

let filePath = null;
let list = []; // [{ url, title, addedAt }]

function init(path) {
  filePath = path;
  load();
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    list = Array.isArray(data) ? data : [];
  } catch (_) {
    list = [];
  }
}

function save() {
  if (!filePath) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Avel] Échec de sauvegarde des favoris :', err.message);
  }
}

function all() {
  return list;
}

function has(url) {
  return list.some((b) => b.url === url);
}

function add(url, title) {
  if (!url || has(url)) return false;
  list.unshift({ url, title: title || url, addedAt: Date.now() });
  save();
  return true;
}

function remove(url) {
  const before = list.length;
  list = list.filter((b) => b.url !== url);
  if (list.length !== before) {
    save();
    return true;
  }
  return false;
}

// Bascule l'état du favori : renvoie true si désormais en favori, sinon false.
function toggle(url, title) {
  if (has(url)) {
    remove(url);
    return false;
  }
  add(url, title);
  return true;
}

function clear() {
  list = [];
  save();
}

module.exports = { init, all, has, add, remove, toggle, clear };
