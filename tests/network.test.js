'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createMeshServer } = require('../core/network/server');
const { createMeshClient } = require('../core/network/client');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
}
function close(server) { return new Promise((r) => server.close(r)); }

test('maillage : pub/sub temps réel sur un nœud', async () => {
  const server = createMeshServer();
  const port = await listen(server);
  const client = createMeshClient(`http://localhost:${port}`);
  try {
    const received = [];
    await client.subscribe('doc1', (m) => received.push(m));
    await delay(80); // laisse l'abonnement SSE s'établir
    await client.publish('doc1', { hello: 'monde' });
    await delay(120);
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].hello, 'monde');
  } finally {
    client.close();
    await close(server);
  }
});

test('maillage : relais inter-nœuds (publié sur A, reçu sur un abonné de B)', async () => {
  const A = createMeshServer();
  const B = createMeshServer();
  const portA = await listen(A);
  const portB = await listen(B);

  const clientA = createMeshClient(`http://localhost:${portA}`);
  const clientB = createMeshClient(`http://localhost:${portB}`);
  try {
    // On apparie A → B (A relaiera vers B).
    await clientA.announce(`http://localhost:${portB}`);

    const onB = [];
    await clientB.subscribe('canal', (m) => onB.push(m));
    await delay(80);

    await clientA.publish('canal', { ping: 1 });
    await delay(200);

    assert.strictEqual(onB.length, 1, 'le message publié sur A doit atteindre l’abonné de B');
    assert.strictEqual(onB[0].ping, 1);
  } finally {
    clientA.close(); clientB.close();
    await close(A); await close(B);
  }
});

test('maillage : registre de pairs (gossip)', async () => {
  const server = createMeshServer();
  const port = await listen(server);
  const client = createMeshClient(`http://localhost:${port}`);
  try {
    await client.announce('http://localhost:9999');
    const peers = await client.peers();
    assert.ok(peers.includes('http://localhost:9999'));
  } finally {
    client.close();
    await close(server);
  }
});
