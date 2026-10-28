'use strict';

// ----------------------------------------------------------------------
// Avel — Historique de navigation souverain
// ----------------------------------------------------------------------
// Enregistre chaque page réellement chargée (URL http/https, titre,
// horodatage) dans userData/avel-history-web.json. Purge en un appel.
// Plafonné pour rester léger.
// ----------------------------------------------------------------------

const fs = require('fs');

const MAX_ENTRIES = 1000;

let filePath = null;
let entries = []; // [{ url, title, visitedAt }]

function init(path) {
  filePath = path;
  load();
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    entries = Array.isArray(data) ? data : [];
  } catch (_) {
    entries = [];
  }
}

function save() {
  if (!filePath) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Avel] Échec de sauvegarde de l\'historique web :', err.message);
  }
}

// Ajoute une visite. Ignore les URLs non web. Fusionne les rechargements
// consécutifs de la même page (met juste à jour l'horodatage / le titre).
function add(url, title) {
  if (!url || !/^https?:\/\//i.test(url)) return;

  const last = entries[entries.length - 1];
  if (last && last.url === url) {
    last.visitedAt = Date.now();
    if (title) last.title = title;
    save();
    return;
  }

  entries.push({ url, title: title || url, visitedAt: Date.now() });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  save();
}

function all() {
  return entries;
}

function clear() {
  entries = [];
  save();
}

module.exports = { init, add, all, clear, MAX_ENTRIES };
