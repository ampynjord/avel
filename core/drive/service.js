'use strict';

// ----------------------------------------------------------------------
// Avel Drive — Service (processus principal)
// ----------------------------------------------------------------------
// Le MANIFEST (noms de fichiers, tailles, nœud d'origine) reste LOCAL et
// privé. Les BLOBS chiffrés vont sur le nœud actif (local ou régional).
// Conséquence : un nœud régional ne connaît ni les noms ni le contenu.
// ----------------------------------------------------------------------

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const driveCrypto = require('./crypto');
const keystore = require('./keystore');
const { createLocalNode } = require('./nodeLocal');
const { createRemoteNode } = require('./nodeRemote');

function baseDir() {
  const d = path.join(app.getPath('userData'), 'avel-drive');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const manifestPath = () => path.join(baseDir(), 'manifest.json');
const configPath = () => path.join(baseDir(), 'config.json');

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(manifestPath(), 'utf8')); } catch (_) { return []; }
}
function saveManifest(m) { fs.writeFileSync(manifestPath(), JSON.stringify(m, null, 2), 'utf8'); }

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); }
  catch (_) { return { node: 'local', remoteUrl: '' }; }
}
function saveConfig(c) {
  const cfg = { node: c.node === 'remote' ? 'remote' : 'local', remoteUrl: c.remoteUrl || '' };
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

function activeNode() {
  const c = loadConfig();
  if (c.node === 'remote' && c.remoteUrl) return createRemoteNode(c.remoteUrl);
  return createLocalNode(baseDir());
}
// Nœud d'origine d'une entrée (pour récupérer un fichier même après changement de réglage).
function nodeFor(entry) {
  if (entry.node === 'remote' && entry.remoteUrl) return createRemoteNode(entry.remoteUrl);
  return createLocalNode(baseDir());
}

function uniquePath(dir, filename) {
  let candidate = path.join(dir, filename);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let n = 1;
  while (fs.existsSync(candidate)) { candidate = path.join(dir, `${base} (${n})${ext}`); n += 1; }
  return candidate;
}

async function upload(localPath) {
  const data = fs.readFileSync(localPath);
  const blob = driveCrypto.encrypt(data, keystore.getKey());
  const id = crypto.randomUUID().replace(/-/g, '');
  const cfg = loadConfig();
  await activeNode().put(id, blob);

  const entry = {
    id,
    name: path.basename(localPath),
    size: data.length,
    createdAt: Date.now(),
    node: cfg.node,
    remoteUrl: cfg.node === 'remote' ? cfg.remoteUrl : ''
  };
  const m = loadManifest();
  m.unshift(entry);
  saveManifest(m);
  return entry;
}

function list() { return loadManifest(); }

async function download(id) {
  const entry = loadManifest().find((x) => x.id === id);
  if (!entry) throw new Error('Fichier introuvable dans le manifest.');
  const blob = await nodeFor(entry).get(id);
  const data = driveCrypto.decrypt(blob, keystore.getKey());
  const target = uniquePath(app.getPath('downloads'), entry.name);
  fs.writeFileSync(target, data);
  return { ok: true, savePath: target };
}

async function remove(id) {
  const m = loadManifest();
  const entry = m.find((x) => x.id === id);
  if (entry) { try { await nodeFor(entry).del(id); } catch (_) { /* ignore */ } }
  saveManifest(m.filter((x) => x.id !== id));
  return { ok: true };
}

function getConfig() { return loadConfig(); }
function setConfig(c) { return saveConfig(c); }

async function testNode(c) {
  const node = (c.node === 'remote' && c.remoteUrl) ? createRemoteNode(c.remoteUrl) : createLocalNode(baseDir());
  return node.health();
}

module.exports = { upload, list, download, remove, getConfig, setConfig, testNode };
