'use strict';

// ----------------------------------------------------------------------
// Avel Drive — Nœud RÉGIONAL distant (client HTTP)
// ----------------------------------------------------------------------
// Même interface que le nœud local. Ne transmet QUE des blobs chiffrés :
// le nœud régional est aveugle au contenu (zero-knowledge).
// ----------------------------------------------------------------------

function createRemoteNode(baseUrl) {
  const u = String(baseUrl).replace(/\/$/, '');

  return {
    name: 'remote',
    async put(id, blob) {
      const r = await fetch(`${u}/blob/${id}`, { method: 'PUT', body: blob });
      if (!r.ok) throw new Error(`Nœud régional : échec PUT (${r.status})`);
    },
    async get(id) {
      const r = await fetch(`${u}/blob/${id}`);
      if (!r.ok) throw new Error(`Nœud régional : échec GET (${r.status})`);
      return Buffer.from(await r.arrayBuffer());
    },
    async del(id) {
      await fetch(`${u}/blob/${id}`, { method: 'DELETE' }).catch(() => {});
    },
    async health() {
      const r = await fetch(`${u}/health`);
      if (!r.ok) throw new Error(`Nœud injoignable (${r.status})`);
      return r.json();
    }
  };
}

module.exports = { createRemoteNode };
