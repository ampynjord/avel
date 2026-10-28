'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const pgp = require('../core/mail/pgp');

test('PGP : génération → chiffrement → déchiffrement (roundtrip réel)', async () => {
  const { privateKey, publicKey } = await pgp.generateKeyPair('Gwen', 'gwen@avel.eu');
  assert.match(publicKey, /BEGIN PGP PUBLIC KEY/);
  assert.match(privateKey, /BEGIN PGP PRIVATE KEY/);

  const secret = 'Message souverain à chiffrer 🔒 — Bretagne libre.';
  const armored = await pgp.encrypt(secret, [publicKey]);
  assert.ok(pgp.isPgpMessage(armored), 'le résultat doit être un message PGP');

  const block = pgp.extractPgpBlock(armored);
  assert.ok(block, 'le bloc PGP doit être extractible');

  const decrypted = await pgp.decrypt(block, privateKey);
  assert.strictEqual(decrypted, secret);
});

test('PGP : détection de bloc', () => {
  assert.strictEqual(pgp.isPgpMessage('texte normal'), false);
  assert.strictEqual(pgp.extractPgpBlock('rien ici'), null);
});
