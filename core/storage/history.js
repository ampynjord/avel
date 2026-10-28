'use strict';

// ----------------------------------------------------------------------
// Avel — Persistance de l'historique de conversation
// ----------------------------------------------------------------------
// Stocké hors du dépôt (dossier userData). Plafonné pour ne pas saturer
// le contexte envoyé à Mistral ni la facture API.
// NB : itération future prévue — chiffrement au repos via safeStorage.
// ----------------------------------------------------------------------

const fs = require('fs');

const MAX_TURNS = 40; // ~20 échanges conservés

let filePath = null;
let conversation = [];

function init(path) {
  filePath = path;
  load();
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    conversation = Array.isArray(data) ? data : [];
  } catch (_) {
    conversation = [];
  }
}

function save() {
  if (!filePath) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Avel] Échec de sauvegarde de l\'historique :', err.message);
  }
}

function trim() {
  if (conversation.length > MAX_TURNS) {
    conversation = conversation.slice(-MAX_TURNS);
  }
}

function push(role, content) {
  conversation.push({ role, content });
  trim();
}

function all() {
  return conversation;
}

function clear() {
  conversation = [];
  save();
}

module.exports = { init, load, save, push, all, clear, MAX_TURNS };
