'use strict';

// ----------------------------------------------------------------------
// Avel Network — Service (pont maillage ↔ renderer)
// ----------------------------------------------------------------------

const { createMeshClient } = require('./client');

let client = null;
let meshUrl = null;
let getWindow = () => null;

function init(getWindowFn) { getWindow = getWindowFn; }

function emit(channel, data) {
  const w = getWindow();
  if (w && !w.isDestroyed()) w.webContents.send('avel:net-message', { channel, data });
}

async function connect(url) {
  if (client) client.close();
  client = createMeshClient(url);
  meshUrl = url;
  const health = await client.health(); // valide la joignabilité
  return { ok: true, health };
}

async function subscribe(channel) {
  if (!client) throw new Error('Non connecté au maillage.');
  await client.subscribe(channel, (data) => emit(channel, data));
  return { ok: true };
}

function unsubscribe(channel) {
  if (client) client.unsubscribe(channel);
  return { ok: true };
}

async function publish(channel, data) {
  if (!client) throw new Error('Non connecté au maillage.');
  await client.publish(channel, data);
  return { ok: true };
}

async function peers() { return client ? client.peers() : []; }
function status() { return { connected: !!client, url: meshUrl }; }
function disconnect() { if (client) client.close(); client = null; meshUrl = null; return { ok: true }; }

module.exports = { init, connect, subscribe, unsubscribe, publish, peers, status, disconnect };
