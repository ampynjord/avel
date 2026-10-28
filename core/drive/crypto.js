'use strict';

// ----------------------------------------------------------------------
// Avel Drive — Chiffrement côté client (AES-256-GCM)
// ----------------------------------------------------------------------
// Les fichiers sont chiffrés AVANT d'atteindre le moindre nœud. Un nœud
// régional ne stocke donc que du ciphertext opaque (zero-knowledge).
// Format du blob : [ iv(12) | authTag(16) | ciphertext ].
// ----------------------------------------------------------------------

const crypto = require('crypto');

function generateKey() {
  return crypto.randomBytes(32); // clé AES-256
}

function encrypt(buffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

function decrypt(blob, key) {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

module.exports = { generateKey, encrypt, decrypt };
