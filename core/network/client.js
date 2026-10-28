'use strict';

// ----------------------------------------------------------------------
// Avel Network — Client de maillage (processus principal)
// ----------------------------------------------------------------------
// Abonnement temps réel via SSE (flux fetch), publication via POST.
// Vit côté main pour ne pas être bridé par la CSP du renderer.
// ----------------------------------------------------------------------

function createMeshClient(baseUrl) {
  const u = String(baseUrl).replace(/\/$/, '');
  const subs = new Map(); // channel -> AbortController

  async function subscribe(channel, onMessage) {
    if (subs.has(channel)) subs.get(channel).abort();
    const controller = new AbortController();
    subs.set(channel, controller);

    (async () => {
      try {
        const res = await fetch(`${u}/channel/${channel}`, {
          signal: controller.signal,
          headers: { accept: 'text/event-stream' }
        });
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = raw.split('\n').find((l) => l.startsWith('data:'));
            if (line) { try { onMessage(JSON.parse(line.slice(5).trim())); } catch (_) { /* ignore */ } }
          }
        }
      } catch (_) { /* fermé / aborté */ }
    })();
  }

  function unsubscribe(channel) {
    const c = subs.get(channel);
    if (c) { c.abort(); subs.delete(channel); }
  }

  async function publish(channel, data) {
    await fetch(`${u}/channel/${channel}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async function peers() {
    const r = await fetch(`${u}/peers`);
    return r.ok ? r.json() : [];
  }
  async function announce(selfUrl) {
    await fetch(`${u}/peers`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: selfUrl }) });
  }
  async function health() {
    const r = await fetch(`${u}/health`);
    if (!r.ok) throw new Error(`Maillage injoignable (${r.status})`);
    return r.json();
  }
  function close() {
    for (const c of subs.values()) c.abort();
    subs.clear();
  }

  return { subscribe, unsubscribe, publish, peers, announce, health, close };
}

module.exports = { createMeshClient };
