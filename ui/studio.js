'use strict';

// ----------------------------------------------------------------------
// Avel Studio — bureautique souveraine : documents texte & tableur,
// chiffrés au repos. Vue intégrée au navigateur.
// ----------------------------------------------------------------------

import { $ } from './util.js';

const view = $('studio-view');
let open = false;
let current = null;     // document en cours d'édition
let saveTimer = null;

// --- Collaboration temps réel (Avel Network) ---
const CLIENT_ID = Math.random().toString(36).slice(2);
const meshUrl = () => localStorage.getItem('avel.mesh') || 'http://localhost:4800';
let collab = { on: false, channel: null };
let textEditorEl = null;
let pubTimer = null;

const ROWS = 20;
const COLS = 8; // A → H

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
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
const colName = (i) => String.fromCharCode(65 + i);
function fmtDate(d) { try { return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return ''; } }

function header(title, actions = []) {
  return el('div', { class: 'mail-header' }, [
    el('div', { class: 'mail-brand' }, [el('span', { class: 'mail-logo', text: '📝' }), el('span', { text: title })]),
    el('div', { class: 'mail-actions' }, actions)
  ]);
}

// ---------- Liste ----------
async function showList() {
  stopCollab();
  current = null;
  textEditorEl = null;
  const docs = await window.avel.studio.list().catch(() => []);
  clear();
  view.appendChild(header('Avel Studio', [
    el('button', { class: 'mail-btn', text: '+ Texte', onclick: () => newDoc('text') }),
    el('button', { class: 'mail-btn', text: '+ Tableur', onclick: () => newDoc('sheet') }),
    el('button', { class: 'mail-btn ghost', text: 'Fermer', onclick: toggle })
  ]));

  if (!docs.length) {
    view.appendChild(el('div', { class: 'mail-center', text: 'Aucun document — créez un texte ou un tableur.' }));
    return;
  }
  view.appendChild(el('div', { class: 'drive-list' }, docs.map((d) =>
    el('div', { class: 'drive-row', onclick: () => openDoc(d.id) }, [
      el('div', { class: 'drive-icon', text: d.type === 'sheet' ? '▦' : '📄' }),
      el('div', { class: 'drive-info' }, [
        el('div', { class: 'drive-name', text: d.title }),
        el('div', { class: 'drive-meta', text: `${d.type === 'sheet' ? 'Tableur' : 'Texte'} · ${fmtDate(d.updatedAt)}` })
      ]),
      el('div', { class: 'drive-actions' }, [
        el('button', {
          class: 'mail-btn ghost', text: '🗑', title: 'Supprimer',
          onclick: async (ev) => { ev.stopPropagation(); await window.avel.studio.delete(d.id); showList(); }
        })
      ])
    ])
  )));
}

function newDoc(type) {
  current = { id: null, type, title: type === 'sheet' ? 'Nouveau tableur' : 'Nouveau document', content: type === 'sheet' ? { cells: {} } : { html: '' } };
  if (type === 'sheet') showSheet(); else showText();
}

async function openDoc(id) {
  const doc = await window.avel.studio.get(id);
  if (!doc) return showList();
  current = doc;
  if (doc.type === 'sheet') showSheet(); else showText();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrent, 800);
}

async function saveCurrent(goList) {
  if (!current) return;
  try {
    const saved = await window.avel.studio.save(current);
    current.id = saved.id;
    const badge = $('studio-saved');
    if (badge) { badge.textContent = '✓ Enregistré'; setTimeout(() => { if (badge) badge.textContent = ''; }, 1500); }
  } catch (_) { /* ignore */ }
  if (goList) showList();
}

// ---------- Éditeur texte ----------
function showText() {
  clear();
  view.appendChild(header('Document', [
    el('span', { class: 'studio-collab', id: 'studio-collab' }),
    el('button', { class: 'mail-btn ghost', id: 'studio-collab-btn', text: '👥 Collaborer', onclick: toggleCollab }),
    el('span', { class: 'studio-saved', id: 'studio-saved' }),
    el('button', { class: 'mail-btn', text: 'Enregistrer', onclick: () => saveCurrent() }),
    el('button', { class: 'mail-btn ghost', text: '← Documents', onclick: () => { stopCollab(); saveCurrent(); showList(); } })
  ]));

  const title = el('input', { class: 'studio-title', type: 'text', value: current.title, placeholder: 'Titre du document' });
  title.addEventListener('input', () => { current.title = title.value; scheduleSave(); });

  const fmt = (cmd) => () => { document.execCommand(cmd, false, null); editor.focus(); };
  const toolbar = el('div', { class: 'studio-toolbar' }, [
    el('button', { class: 'studio-tool', text: 'G', title: 'Gras', onclick: fmt('bold') }),
    el('button', { class: 'studio-tool', text: 'I', title: 'Italique', style: 'font-style:italic', onclick: fmt('italic') }),
    el('button', { class: 'studio-tool', text: 'S', title: 'Souligné', style: 'text-decoration:underline', onclick: fmt('underline') }),
    el('button', { class: 'studio-tool', text: '• Liste', onclick: fmt('insertUnorderedList') }),
    el('button', { class: 'studio-tool', text: '1. Liste', onclick: fmt('insertOrderedList') })
  ]);

  const editor = el('div', { class: 'studio-editor', contenteditable: 'true', html: current.content.html || '' });
  textEditorEl = editor;
  editor.addEventListener('input', () => {
    current.content = { html: editor.innerHTML };
    scheduleSave();
    publishCollab();
  });

  view.appendChild(el('div', { class: 'studio-doc' }, [title, toolbar, editor]));
  reflectCollab();
}

// ---------- Collaboration ----------
function reflectCollab() {
  const badge = $('studio-collab');
  const btn = $('studio-collab-btn');
  if (!btn) return;
  btn.classList.toggle('active', collab.on);
  btn.textContent = collab.on ? '👥 En direct' : '👥 Collaborer';
  if (badge) badge.textContent = collab.on ? '● connecté au maillage' : '';
}

async function toggleCollab() {
  if (collab.on) { stopCollab(); reflectCollab(); return; }
  if (!current) return;
  if (!current.id) await saveCurrent(); // besoin d'un id de canal stable
  const badge = $('studio-collab');
  if (badge) badge.textContent = 'connexion…';
  try {
    await window.avel.net.connect(meshUrl());
    await window.avel.net.subscribe(current.id);
    collab = { on: true, channel: current.id };
    publishCollab(); // partage l'état initial
  } catch (e) {
    if (badge) badge.textContent = '⚠ ' + (e.message || 'maillage injoignable');
    collab = { on: false, channel: null };
  }
  reflectCollab();
}

function stopCollab() {
  if (collab.channel) { try { window.avel.net.unsubscribe(collab.channel); } catch (_) { /* ignore */ } }
  collab = { on: false, channel: null };
}

function publishCollab() {
  if (!collab.on || !current) return;
  clearTimeout(pubTimer);
  pubTimer = setTimeout(() => {
    window.avel.net.publish(collab.channel, { from: CLIENT_ID, html: current.content.html || '', title: current.title });
  }, 250);
}

function handleNetMessage(msg) {
  if (!collab.on || !msg || msg.channel !== collab.channel) return;
  const data = msg.data || {};
  if (data.from === CLIENT_ID) return; // ignore ses propres messages
  if (typeof data.title === 'string') { current.title = data.title; const t = view.querySelector('.studio-title'); if (t && t !== document.activeElement) t.value = data.title; }
  if (typeof data.html === 'string' && textEditorEl && textEditorEl !== document.activeElement) {
    current.content = { html: data.html };
    textEditorEl.innerHTML = data.html;
  }
}

// ---------- Éditeur tableur ----------
function showSheet() {
  clear();
  const cells = current.content.cells || {};
  current.content = { cells };

  view.appendChild(header('Tableur', [
    el('span', { class: 'studio-saved', id: 'studio-saved' }),
    el('button', { class: 'mail-btn', text: 'Enregistrer', onclick: () => saveCurrent() }),
    el('button', { class: 'mail-btn ghost', text: '← Documents', onclick: () => { saveCurrent(); showList(); } })
  ]));

  const title = el('input', { class: 'studio-title', type: 'text', value: current.title, placeholder: 'Titre du tableur' });
  title.addEventListener('input', () => { current.title = title.value; scheduleSave(); });

  const table = el('table', { class: 'studio-sheet' });
  // en-tête colonnes
  const head = el('tr', {}, [el('th', { class: 'studio-corner' })]);
  for (let c = 0; c < COLS; c++) head.appendChild(el('th', { text: colName(c) }));
  table.appendChild(head);

  const inputs = {};
  for (let r = 0; r < ROWS; r++) {
    const tr = el('tr', {}, [el('th', { text: String(r + 1) })]);
    for (let c = 0; c < COLS; c++) {
      const ref = colName(c) + (r + 1);
      const inp = el('input', { class: 'studio-cell', 'data-ref': ref, value: '' });
      inputs[ref] = inp;
      inp.addEventListener('focus', () => { inp.value = cells[ref] != null ? cells[ref] : ''; });
      inp.addEventListener('blur', () => { cells[ref] = inp.value; recompute(); scheduleSave(); });
      tr.appendChild(el('td', {}, [inp]));
    }
    table.appendChild(tr);
  }
  view.appendChild(el('div', { class: 'studio-doc' }, [title, el('div', { class: 'studio-sheet-wrap' }, [table])]));

  async function recompute() {
    let computed = {};
    try { computed = await window.avel.studio.evalSheet(cells); } catch (_) { /* ignore */ }
    Object.entries(inputs).forEach(([ref, inp]) => {
      if (inp === document.activeElement) return; // ne pas écraser la saisie en cours
      const v = computed[ref];
      inp.value = (v === '' || v == null) ? '' : String(v);
    });
  }
  recompute();
}

function toggle() {
  open = !open;
  view.classList.toggle('open', open);
  if (open) showList();
  else stopCollab();
}

export function initStudio() {
  $('btn-studio').addEventListener('click', toggle);
  if (window.avel.net && window.avel.net.onMessage) window.avel.net.onMessage(handleNetMessage);
}
