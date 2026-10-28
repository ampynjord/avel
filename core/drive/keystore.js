'use strict';

// ----------------------------------------------------------------------
// Avel Drive — Clé de chiffrement maître
// ----------------------------------------------------------------------
// Générée une fois, conservée chiffrée au repos via safeStorage (DPAPI).
// Ne quitte jamais la machine. C'est elle qui rend les nœuds aveugles.
// ----------------------------------------------------------------------

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const driveCrypto = require('./crypto');

function dir() {
  const d = path.join(app.getPath('userData'), 'avel-drive');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const keyFile = () => path.join(dir(), 'master.key');

let cached = null;

function getKey() {
  if (cached) return cached;
  try {
    const buf = fs.readFileSync(keyFile());
    try {
      const maybe = JSON.parse(buf.toString('utf8'));
      if (maybe && maybe.__unencrypted) { cached = Buffer.from(maybe.key, 'base64'); return cached; }
    } catch (_) { /* chiffré */ }
    cached = Buffer.from(safeStorage.decryptString(buf), 'base64');
    return cached;
  } catch (_) { /* première utilisation */ }

  const key = driveCrypto.generateKey();
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(keyFile(), safeStorage.encryptString(key.toString('base64')));
  } else {
    fs.writeFileSync(keyFile(), JSON.stringify({ __unencrypted: true, key: key.toString('base64') }), 'utf8');
  }
  cached = key;
  return key;
}

module.exports = { getKey };
