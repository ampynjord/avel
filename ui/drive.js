'use strict';

// ----------------------------------------------------------------------
// Avel Drive — vue intégrée : fichiers chiffrés, import, choix du nœud.
// ----------------------------------------------------------------------

import { $ } from './util.js';

const view = $('drive-view');
let open = false;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}
const clear = () => { view.innerHTML = ''; };

function fmtBytes(n) {
  if (!n) return '0 o';
  const u = ['o', 'Ko', 'Mo', 'Go']; let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
}
function fmtDate(d) {
  try { return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch (_) { return ''; }
}

function header(title, actions = []) {
  return el('div', { class: 'mail-header' }, [
    el('div', { class: 'mail-brand' }, [el('span', { class: 'mail-logo', text: '☁' }), el('span', { text: title })]),
    el('div', { class: 'mail-actions' }, actions)
  ]);
}

function showLoading(msg) {
  clear();
  view.appendChild(header('Avel Drive', [el('button', { class: 'mail-btn ghost', text: 'Fermer', onclick: toggle })]));
  view.appendChild(el('div', { class: 'mail-center', text: msg || 'Chargement…' }));
}

async function showList() {
  showLoading('Chargement du coffre…');
  const [files, cfg] = await Promise.all([
    window.avel.drive.list().catch(() => []),
    window.avel.drive.getConfig().catch(() => ({ node: 'local' }))
  ]);

  const fileInput = el('input', { type: 'file', multiple: 'true', style: 'display:none' });
  fileInput.addEventListener('change', async () => {
    const paths = [...fileInput.files].map((f) => window.avel.getFilePath(f)).filter(Boolean);
    fileInput.value = '';
    if (!paths.length) return;
    showLoading('Chiffrement et envoi…');
    try { for (const p of paths) await window.avel.drive.upload(p); }
    catch (e) { /* affiché ci-dessous au reload */ }
    showList();
  });

  clear();
  const nodeLabel = cfg.node === 'remote' ? `Nœud régional : ${cfg.remoteUrl || '?'}` : 'Nœud local';
  view.appendChild(header('Avel Drive', [
    el('button', { class: 'mail-btn', text: '⬆ Importer', onclick: () => fileInput.click() }),
    el('button', { class: 'mail-btn ghost', text: '🌐 Nœud', onclick: showNode }),
    el('button', { class: 'mail-btn ghost', text: '↻', title: 'Rafraîchir', onclick: showList }),
    el('button', { class: 'mail-btn ghost', text: 'Fermer', onclick: toggle })
  ]));

  view.appendChild(fileInput);
  view.appendChild(el('div', { class: 'drive-status' }, [
    el('span', { class: 'drive-node-badge', text: '● ' + nodeLabel }),
    el('span', { class: 'mail-hint', text: 'Fichiers chiffrés (AES-256) sur votre machine avant tout stockage.' })
  ]));

  if (!files.length) {
    view.appendChild(el('div', { class: 'mail-center', text: 'Coffre vide — importez un fichier pour commencer.' }));
    return;
  }

  view.appendChild(el('div', { class: 'drive-list' }, files.map((f) =>
    el('div', { class: 'drive-row' }, [
      el('div', { class: 'drive-icon', text: '🔒' }),
      el('div', { class: 'drive-info' }, [
        el('div', { class: 'drive-name', text: f.name }),
        el('div', { class: 'drive-meta', text: `${fmtBytes(f.size)} · ${fmtDate(f.createdAt)} · ${f.node === 'remote' ? 'nœud régional' : 'local'}` })
      ]),
      el('div', { class: 'drive-actions' }, [
        el('button', {
          class: 'mail-btn ghost', text: '⬇',
          title: 'Télécharger et déchiffrer',
          onclick: async (ev) => {
            ev.currentTarget.textContent = '…';
            try { await window.avel.drive.download(f.id); ev.currentTarget.textContent = '✓'; }
            catch (e) { ev.currentTarget.textContent = '⚠'; }
          }
        }),
        el('button', {
          class: 'mail-btn ghost', text: '🗑',
          title: 'Supprimer',
          onclick: async () => { await window.avel.drive.delete(f.id); showList(); }
        })
      ])
    ])
  )));
}

async function showNode() {
  const cfg = await window.avel.drive.getConfig().catch(() => ({ node: 'local', remoteUrl: '' }));
  clear();
  view.appendChild(header('Nœud de stockage', [el('button', { class: 'mail-btn ghost', text: '← Retour', onclick: showList })]));

  const remoteInput = el('input', { id: 'd-remote', type: 'text', value: cfg.remoteUrl || '', placeholder: 'http://localhost:4700', spellcheck: 'false' });
  const status = el('span', { class: 'mail-compose-status', id: 'd-node-status' });

  const choose = (node) => {
    document.querySelectorAll('.drive-node-opt').forEach((o) => o.classList.toggle('active', o.dataset.node === node));
  };

  view.appendChild(el('div', { class: 'mail-keys' }, [
    el('p', { class: 'mail-hint', text: 'Choisissez où sont stockés vos blobs chiffrés. Un nœud régional ne voit jamais le contenu ni les noms : il ne stocke que du chiffré (zero-knowledge). Lancez-en un avec « npm run node-server ».' }),
    el('div', { class: 'drive-node-opts' }, [
      el('button', { class: 'drive-node-opt' + (cfg.node === 'local' ? ' active' : ''), 'data-node': 'local', onclick: () => choose('local') }, [
        el('div', { class: 'drive-node-title', text: '🖥 Nœud local' }),
        el('div', { class: 'mail-hint', text: 'Stockage sur cette machine.' })
      ]),
      el('button', { class: 'drive-node-opt' + (cfg.node === 'remote' ? ' active' : ''), 'data-node': 'remote', onclick: () => choose('remote') }, [
        el('div', { class: 'drive-node-title', text: '🌐 Nœud régional' }),
        el('div', { class: 'mail-hint', text: 'Stockage sur un nœud du maillage AVEL.' })
      ])
    ]),
    el('label', { class: 'mail-field', style: 'margin-top:14px' }, [el('span', { text: 'Adresse du nœud régional' }), remoteInput]),
    el('div', { class: 'mail-row-actions' }, [
      status,
      el('button', {
        class: 'mail-btn', text: 'Tester',
        onclick: async () => {
          const node = document.querySelector('.drive-node-opt.active')?.dataset.node || 'local';
          status.textContent = 'Test…';
          try { const h = await window.avel.drive.testNode({ node, remoteUrl: remoteInput.value.trim() }); status.textContent = h.ok ? `✓ ${h.node} joignable` : '⚠ injoignable'; }
          catch (e) { status.textContent = '⚠ ' + e.message; }
        }
      }),
      el('button', {
        class: 'mail-btn primary', text: 'Enregistrer',
        onclick: async () => {
          const node = document.querySelector('.drive-node-opt.active')?.dataset.node || 'local';
          await window.avel.drive.setConfig({ node, remoteUrl: remoteInput.value.trim() });
          showList();
        }
      })
    ])
  ]));
}

function toggle() {
  open = !open;
  view.classList.toggle('open', open);
  if (open) showList();
}

export function initDrive() {
  $('btn-drive').addEventListener('click', toggle);
}
