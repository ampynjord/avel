'use strict';

// ----------------------------------------------------------------------
// Avel Drive — Nœud régional AVEL (serveur)
// ----------------------------------------------------------------------
// Un nœud du maillage fédéral. Il NE stocke QUE des blobs chiffrés par le
// client : il ne peut rien lire. API minimale REST sur des id opaques.
//
// Lancer un nœud :  npm run node-server  [port] [dossier]
// ----------------------------------------------------------------------

const http = require('http');
const fs = require('fs');
const path = require('path');

function createServer(storageDir) {
  fs.mkdirSync(storageDir, { recursive: true });
  const blobPath = (id) => path.join(storageDir, path.basename(id)); // basename → pas de path traversal

  return http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, node: 'avel-regional', storage: storageDir }));
    }

    const m = req.url.match(/^\/blob\/([A-Za-z0-9_-]+)$/);
    if (!m) { res.writeHead(404); return res.end(); }
    const fp = blobPath(m[1]);

    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        fs.writeFileSync(fp, Buffer.concat(chunks));
        res.writeHead(201); res.end('ok');
      });
      return;
    }
    if (req.method === 'GET') {
      if (!fs.existsSync(fp)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return fs.createReadStream(fp).pipe(res);
    }
    if (req.method === 'DELETE') {
      try { fs.rmSync(fp, { force: true }); } catch (_) { /* ignore */ }
      res.writeHead(200); return res.end('ok');
    }
    res.writeHead(405); res.end();
  });
}

// Exécution directe en tant que nœud autonome.
if (require.main === module) {
  const port = Number(process.argv[2]) || Number(process.env.AVEL_NODE_PORT) || 4700;
  const storageDir = process.argv[3] || path.join(process.cwd(), 'avel-node-storage');
  createServer(storageDir).listen(port, () => {
    console.log(`[Avel Node] Nœud régional en écoute sur http://localhost:${port}`);
    console.log(`[Avel Node] Stockage (chiffré, illisible côté nœud) : ${storageDir}`);
  });
}

module.exports = { createServer };
