'use strict';

// ----------------------------------------------------------------------
// Avel Mail — Chiffrement PGP (OpenPGP.js)
// ----------------------------------------------------------------------
// Chiffrement de bout en bout inline (blocs ASCII-armored dans le corps).
// La clé privée est générée sans phrase de passe mais stockée chiffrée au
// repos (safeStorage) — voir pgpStore.js. Compromis assumé : pas de
// re-saisie de passphrase à chaque lecture, protection assurée par l'OS.
// ----------------------------------------------------------------------

const openpgp = require('openpgp');

async function generateKeyPair(name, email) {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: name || email, email }],
    format: 'armored'
  });
  return { privateKey, publicKey };
}

async function encrypt(text, armoredPublicKeys) {
  const encryptionKeys = await Promise.all(
    armoredPublicKeys.map((a) => openpgp.readKey({ armoredKey: a }))
  );
  const message = await openpgp.createMessage({ text });
  return openpgp.encrypt({ message, encryptionKeys });
}

async function decrypt(armoredMessage, armoredPrivateKey) {
  const decryptionKeys = await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey });
  const message = await openpgp.readMessage({ armoredMessage });
  const { data } = await openpgp.decrypt({ message, decryptionKeys });
  return data;
}

function isPgpMessage(text) {
  return typeof text === 'string' && text.includes('-----BEGIN PGP MESSAGE-----');
}

function extractPgpBlock(text) {
  const m = String(text).match(/-----BEGIN PGP MESSAGE-----[\s\S]*?-----END PGP MESSAGE-----/);
  return m ? m[0] : null;
}

module.exports = { generateKeyPair, encrypt, decrypt, isPgpMessage, extractPgpBlock };
