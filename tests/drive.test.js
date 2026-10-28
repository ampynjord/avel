'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const driveCrypto = require('../core/drive/crypto');
const { createLocalNode } = require('../core/drive/nodeLocal');
const { createRemoteNode } = require('../core/drive/nodeRemote');
const { createServer } = require('../core/drive/server');

function tmpdir(name) {
  const d = path.join(os.tmpdir(), `avel-drive-${name}-${Date.now()}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

test('crypto AES-256-GCM : roundtrip', () => {
  const key = driveCrypto.generateKey();
  const data = Buffer.from('Document souverain — secret régional 🔐');
  const blob = driveCrypto.encrypt(data, key);
  assert.notStrictEqual(blob.toString('utf8'), data.toString('utf8'));
  assert.strictEqual(driveCrypto.decrypt(blob, key).toString('utf8'), data.toString('utf8'));
});

test('crypto : mauvaise clé → déchiffrement rejeté (authentifié)', () => {
  const key = driveCrypto.generateKey();
  const bad = driveCrypto.generateKey();
  const blob = driveCrypto.encrypt(Buffer.from('secret'), key);
  assert.throws(() => driveCrypto.decrypt(blob, bad));
});

test('nœud local : put / get / del', async () => {
  const node = createLocalNode(tmpdir('local'));
  await node.put('abc', Buffer.from('hello'));
  assert.strictEqual((await node.get('abc')).toString(), 'hello');
  await node.del('abc');
  await assert.rejects(() => node.get('abc'));
});

test('nœud régional réel : chiffrer → stocker → récupérer → déchiffrer (zero-knowledge)', async () => {
  const storage = tmpdir('node');
  const server = createServer(storage);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const node = createRemoteNode(`http://localhost:${port}`);
    assert.strictEqual((await node.health()).ok, true);

    const key = driveCrypto.generateKey();
    const original = Buffer.from('Fichier confidentiel sur nœud régional 🌐 — Bretagne.');
    const blob = driveCrypto.encrypt(original, key);

    await node.put('file1', blob);

    // Le nœud ne stocke QUE du chiffré : vérification sur disque.
    const stored = fs.readFileSync(path.join(storage, 'file1'));
    assert.notStrictEqual(stored.toString('utf8'), original.toString('utf8'));

    const fetched = await node.get('file1');
    assert.strictEqual(driveCrypto.decrypt(fetched, key).toString('utf8'), original.toString('utf8'));

    await node.del('file1');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
