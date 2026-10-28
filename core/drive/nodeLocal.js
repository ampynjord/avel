'use strict';

// ----------------------------------------------------------------------
// Avel Drive — Nœud LOCAL
// ----------------------------------------------------------------------
// Implémente l'interface de nœud (put/get/del/health) sur le disque local.
// Factory paramétrée par un dossier → testable hors Electron.
// ----------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

function createLocalNode(baseDir) {
  const blobs = path.join(baseDir, 'blobs');
  fs.mkdirSync(blobs, { recursive: true });
  const blobPath = (id) => path.join(blobs, path.basename(id));

  return {
    name: 'local',
    async put(id, blob) { fs.writeFileSync(blobPath(id), blob); },
    async get(id) { return fs.readFileSync(blobPath(id)); },
    async del(id) { try { fs.rmSync(blobPath(id), { force: true }); } catch (_) { /* ignore */ } },
    async health() { return { ok: true, node: 'local', storage: blobs }; }
  };
}

module.exports = { createLocalNode };
