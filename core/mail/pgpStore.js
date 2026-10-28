'use strict';

// ----------------------------------------------------------------------
// Avel Mail — Trousseau PGP local
// ----------------------------------------------------------------------
// - Identité (clé privée + publique) chiffrée au repos via safeStorage
//   dans userData/avel-pgp.enc.
// - Trousseau de clés publiques des contacts dans userData/avel-pubkeys.json
//   (les clés publiques ne sont pas secrètes).
// ----------------------------------------------------------------------

const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const idFile = () => path.join(app.getPath('userData'), 'avel-pgp.enc');
const ringFile = () => path.join(app.getPath('userData'), 'avel-pubkeys.json');

function saveIdentity(identity) {
  const json = JSON.stringify(identity);
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(idFile(), safeStorage.encryptString(json));
  } else {
    fs.writeFileSync(idFile(), JSON.stringify({ __unencrypted: true, identity }), 'utf8');
  }
}

function loadIdentity() {
  try {
    const buf = fs.readFileSync(idFile());
    try {
      const maybe = JSON.parse(buf.toString('utf8'));
      if (maybe && maybe.__unencrypted) return maybe.identity;
    } catch (_) { /* chiffré */ }
    return JSON.parse(safeStorage.decryptString(buf));
  } catch (_) {
    return null;
  }
}

function loadRing() {
  try { return JSON.parse(fs.readFileSync(ringFile(), 'utf8')); }
  catch (_) { return {}; }
}

function saveRing(ring) {
  fs.writeFileSync(ringFile(), JSON.stringify(ring, null, 2), 'utf8');
}

function addContactKey(email, armoredKey) {
  const ring = loadRing();
  ring[String(email).toLowerCase()] = armoredKey;
  saveRing(ring);
}

function getContactKey(email) {
  return loadRing()[String(email || '').toLowerCase()] || null;
}

module.exports = { saveIdentity, loadIdentity, addContactKey, getContactKey, loadRing };
