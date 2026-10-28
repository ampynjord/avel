'use strict';

// ----------------------------------------------------------------------
// Avel Network — Nœud de maillage (mesh)
// ----------------------------------------------------------------------
// Relie les nœuds AVEL : registre de pairs (gossip) + canaux pub/sub en
// temps réel (SSE), avec RELAIS inter-nœuds. Un message publié sur un nœud
// atteint les abonnés des nœuds pairs → maillage fédéral.
// Sans dépendance (http natif). Lancer : npm run mesh-server [port]
// ----------------------------------------------------------------------

const http = require('http');

function readBody(req, cb) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => cb(Buffer.concat(chunks).toString('utf8')));
}

function createMeshServer() {
  const channels = new Map(); // id -> Set(res)
  const peers = new Set();    // base URLs des nœuds pairs
  const seen = new Set();     // ids de messages déjà traités (anti-boucle)

  function fanout(id, payload) {
    const set = channels.get(id);
    if (!set) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) { try { res.write(data); } catch (_) { /* ignore */ } }
  }

  async function relay(id, payload, msgId) {
    for (const p of peers) {
      try {
        await fetch(`${p}/channel/${id}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-avel-msg': msgId },
          body: JSON.stringify(payload)
        });
      } catch (_) { /* pair injoignable : on continue */ }
    }
  }

  return http.createServer((req, res) => {
    const url = req.url;

    if (url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, node: 'avel-mesh', peers: [...peers], channels: [...channels.keys()] }));
    }

    if (url === '/peers') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify([...peers]));
      }
      if (req.method === 'POST') {
        return readBody(req, (b) => {
          try { const { url: purl } = JSON.parse(b); if (purl) peers.add(String(purl).replace(/\/$/, '')); } catch (_) { /* ignore */ }
          res.writeHead(201); res.end('ok');
        });
      }
    }

    const m = url.match(/^\/channel\/([A-Za-z0-9_-]+)$/);
    if (m) {
      const id = m[1];
      if (req.method === 'GET') { // abonnement SSE
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(': connected\n\n');
        if (!channels.has(id)) channels.set(id, new Set());
        channels.get(id).add(res);
        req.on('close', () => { const s = channels.get(id); if (s) { s.delete(res); if (!s.size) channels.delete(id); } });
        return;
      }
      if (req.method === 'POST') { // publication
        return readBody(req, (b) => {
          let payload = null;
          try { payload = JSON.parse(b); } catch (_) { /* ignore */ }
          const msgId = req.headers['x-avel-msg'] || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          res.writeHead(202); res.end('ok');
          if (payload == null) return;
          if (seen.has(msgId)) return; // anti-boucle de relais
          seen.add(msgId);
          if (seen.size > 5000) seen.clear();
          fanout(id, payload);
          relay(id, payload, msgId);
        });
      }
    }

    res.writeHead(404); res.end();
  });
}

if (require.main === module) {
  const port = Number(process.argv[2]) || Number(process.env.AVEL_MESH_PORT) || 4800;
  createMeshServer().listen(port, () => {
    console.log(`[Avel Mesh] Nœud de maillage en écoute sur http://localhost:${port}`);
    console.log('[Avel Mesh] Pub/sub temps réel + relais inter-nœuds prêts.');
  });
}

module.exports = { createMeshServer };
