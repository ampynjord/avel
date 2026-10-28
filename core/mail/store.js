'use strict';

// ----------------------------------------------------------------------
// Avel Mail — Stockage chiffré de la configuration de messagerie
// ----------------------------------------------------------------------
// Le mot de passe e-mail est une donnée hautement sensible : on le chiffre
// au repos via le safeStorage d'Electron (DPAPI sous Windows). Aucune
// donnée ne quitte la machine ; rien n'est jamais journalisé.
// ----------------------------------------------------------------------

const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

function filePath() {
  return path.join(app.getPath('userData'), 'avel-mail.enc');
}

function save(config) {
  const json = JSON.stringify(config);
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(filePath(), safeStorage.encryptString(json));
  } else {
    // Repli (rare) : on marque clairement le fichier comme non chiffré.
    fs.writeFileSync(filePath(), JSON.stringify({ __unencrypted: true, config }), 'utf8');
  }
}

function load() {
  try {
    const buf = fs.readFileSync(filePath());
    // Détection du repli non chiffré.
    try {
      const maybe = JSON.parse(buf.toString('utf8'));
      if (maybe && maybe.__unencrypted) return maybe.config;
    } catch (_) { /* contenu chiffré : on continue */ }
    return JSON.parse(safeStorage.decryptString(buf));
  } catch (_) {
    return null;
  }
}

function clear() {
  try { fs.rmSync(filePath(), { force: true }); } catch (_) { /* ignore */ }
}

module.exports = { save, load, clear };
