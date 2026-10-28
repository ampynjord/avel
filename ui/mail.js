'use strict';

// ----------------------------------------------------------------------
// Avel Mail — vue intégrée : dossiers, lecture, pièces jointes,
// composition, et chiffrement PGP de bout en bout.
// ----------------------------------------------------------------------

import { $ } from './util.js';

const view = $('mail-view');
let open = false;
let currentFolder = 'INBOX';
let folderCache = [];

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

function header(title, actions = []) {
  return el('div', { class: 'mail-header' }, [
    el('div', { class: 'mail-brand' }, [el('span', { class: 'mail-logo', text: '✉' }), el('span', { text: title })]),
    el('div', { class: 'mail-actions' }, actions)
  ]);
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch (_) { return ''; }
}
function fmtBytes(n) {
  if (!n) return '';
  const u = ['o', 'Ko', 'Mo', 'Go']; let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
}

function showLoading(msg) {
  clear();
  view.appendChild(header('Avel Mail', [el('button', { class: 'mail-btn ghost', text: 'Fermer', onclick: toggle })]));
  view.appendChild(el('div', { class: 'mail-center', text: msg || 'Chargement…' }));
}

// ---------- Connexion / configuration ----------
function showLogin(cfg, errorMsg) {
  clear();
  cfg = cfg || {};
  const field = (id, label, value, type = 'text', ph = '') => el('label', { class: 'mail-field' }, [
    el('span', { text: label }),
    el('input', { id, type, value: value != null ? value : '', placeholder: ph, spellcheck: 'false', autocomplete: 'off' })
  ]);

  view.appendChild(header('Avel Mail'));
  view.appendChild(el('div', { class: 'mail-login' }, [
    el('h2', { text: 'Configurer la messagerie' }),
    el('p', { class: 'mail-hint', text: 'Connexion à votre serveur IMAP/SMTP. Identifiants chiffrés localement (safeStorage), utilisés uniquement pour ce serveur en TLS.' }),
    errorMsg ? el('div', { class: 'mail-error', text: '⚠ ' + errorMsg }) : null,
    el('div', { class: 'mail-grid' }, [
      field('m-user', 'Adresse e-mail', cfg.user, 'email', 'vous@exemple.eu'),
      field('m-pass', cfg.hasPassword ? 'Mot de passe (vide = inchangé)' : 'Mot de passe', '', 'password'),
      field('m-imap-host', 'Serveur IMAP', cfg.imapHost, 'text', 'imap.exemple.eu'),
      field('m-imap-port', 'Port IMAP', cfg.imapPort || 993, 'number'),
      field('m-smtp-host', 'Serveur SMTP', cfg.smtpHost, 'text', 'smtp.exemple.eu'),
      field('m-smtp-port', 'Port SMTP', cfg.smtpPort || 587, 'number')
    ]),
    el('div', { class: 'mail-row-actions' }, [
      el('button', { class: 'mail-btn ghost', text: 'Fermer', onclick: toggle }),
      el('button', { class: 'mail-btn primary', text: 'Se connecter', onclick: () => submitLogin(cfg) })
    ])
  ]));
}

async function submitLogin(prev) {
  const cfg = {
    user: $('m-user').value.trim(),
    imapHost: $('m-imap-host').value.trim(),
    imapPort: Number($('m-imap-port').value) || 993,
    imapSecure: true,
    smtpHost: $('m-smtp-host').value.trim(),
    smtpPort: Number($('m-smtp-port').value) || 587
  };
  const pass = $('m-pass').value;
  if (pass) cfg.pass = pass;
  const hadPassword = prev && prev.hasPassword;

  if (!cfg.user || !cfg.imapHost || (!pass && !hadPassword)) {
    return showLogin({ ...cfg, hasPassword: hadPassword }, 'Adresse, serveur IMAP et mot de passe sont requis.');
  }
  showLoading('Connexion au serveur…');
  try {
    await window.avel.mail.saveConfig(cfg);
    await window.avel.mail.connect();
    await showList('INBOX');
  } catch (e) {
    showLogin({ ...cfg, hasPassword: !!pass || hadPassword }, e.message || 'Connexion impossible.');
  }
}

// ---------- Liste (avec dossiers) ----------
async function showList(folder) {
  if (folder) currentFolder = folder;
  showLoading('Chargement…');

  let messages = [];
  try {
    if (!folderCache.length) folderCache = await window.avel.mail.folders().catch(() => []);
    messages = await window.avel.mail.list(currentFolder, 30);
  } catch (e) {
    return showLogin(await window.avel.mail.getConfig().catch(() => null), e.message);
  }

  clear();
  view.appendChild(header('Avel Mail', [
    el('button', { class: 'mail-btn', text: '✎ Écrire', onclick: () => showCompose() }),
    el('button', { class: 'mail-btn ghost', text: '🔑 Clés', onclick: showKeys }),
    el('button', { class: 'mail-btn ghost', text: '↻', title: 'Rafraîchir', onclick: () => showList() }),
    el('button', { class: 'mail-btn ghost', text: 'Fermer', onclick: toggle })
  ]));

  // corps : rail dossiers + liste
  const rail = el('div', { class: 'mail-rail' },
    (folderCache.length ? folderCache : [{ path: 'INBOX', name: 'INBOX' }]).map((f) =>
      el('button', {
        class: 'mail-folder' + (f.path === currentFolder ? ' active' : ''),
        text: f.name,
        title: f.path,
        onclick: () => showList(f.path)
      })
    )
  );

  let listEl;
  if (!messages.length) {
    listEl = el('div', { class: 'mail-center', text: 'Aucun message dans ce dossier.' });
  } else {
    listEl = el('div', { class: 'mail-list' }, messages.map((m) =>
      el('div', { class: 'mail-item' + (m.seen ? '' : ' unread'), onclick: () => showRead(m.uid) }, [
        el('div', { class: 'mail-item-from', text: m.from || '(inconnu)' }),
        el('div', { class: 'mail-item-subject', text: m.subject }),
        el('div', { class: 'mail-item-date', text: fmtDate(m.date) })
      ])
    ));
  }

  view.appendChild(el('div', { class: 'mail-body' }, [rail, el('div', { class: 'mail-main' }, [listEl])]));
}

// ---------- Lecture (avec pièces jointes) ----------
async function showRead(uid) {
  showLoading('Ouverture du message…');
  let msg;
  try { msg = await window.avel.mail.get(currentFolder, uid); }
  catch (_) { return showList(); }
  if (!msg) return showList();

  clear();
  view.appendChild(header('Message', [
    el('button', { class: 'mail-btn', text: '↩ Répondre', onclick: () => showCompose({ to: msg.from, subject: 'Re: ' + msg.subject }) }),
    el('button', { class: 'mail-btn ghost', text: '← Retour', onclick: () => showList() })
  ]));

  const atts = msg.attachments || [];
  const attBlock = atts.length ? el('div', { class: 'mail-attachments' }, [
    el('div', { class: 'mail-att-label', text: `Pièces jointes (${atts.length})` }),
    el('div', { class: 'mail-att-list' }, atts.map((a) =>
      el('button', {
        class: 'mail-att',
        title: 'Enregistrer dans Téléchargements',
        onclick: async (ev) => {
          ev.currentTarget.textContent = '⬇ ' + a.filename;
          try { await window.avel.mail.saveAttachment(uid, a.index); ev.currentTarget.textContent = '✓ ' + a.filename; }
          catch (e) { ev.currentTarget.textContent = '⚠ ' + a.filename; }
        }
      }, `📎 ${a.filename}${a.size ? ' · ' + fmtBytes(a.size) : ''}`)
    ))
  ]) : null;

  view.appendChild(el('div', { class: 'mail-read' }, [
    el('div', { class: 'mail-read-subject' }, [
      msg.encrypted ? el('span', { class: 'mail-badge', text: '🔒 Déchiffré' }) : null,
      el('span', { text: msg.subject })
    ]),
    el('div', { class: 'mail-read-meta', text: `De : ${msg.from}` }),
    el('div', { class: 'mail-read-meta', text: fmtDate(msg.date) }),
    msg.hasHtml && !msg.encrypted ? el('div', { class: 'mail-hint', text: '(Le HTML est affiché en texte brut par sécurité.)' }) : null,
    attBlock,
    el('div', { class: 'mail-read-body', text: msg.text || '(corps vide)' })
  ]));
}

// ---------- Composition (pièces jointes + chiffrement) ----------
let composeAttachments = [];

function showCompose(prefill = {}) {
  composeAttachments = [];
  clear();
  view.appendChild(header('Nouveau message', [el('button', { class: 'mail-btn ghost', text: '← Retour', onclick: () => showList() })]));

  const fileInput = el('input', { type: 'file', multiple: 'true', id: 'c-files', style: 'display:none' });
  fileInput.addEventListener('change', () => {
    for (const f of fileInput.files) {
      const p = window.avel.getFilePath(f);
      if (p) composeAttachments.push({ name: f.name, path: p });
    }
    renderChips();
    fileInput.value = '';
  });

  const chips = el('div', { class: 'mail-chips', id: 'c-chips' });
  function renderChips() {
    chips.innerHTML = '';
    composeAttachments.forEach((a, i) => {
      chips.appendChild(el('span', { class: 'mail-chip' }, [
        el('span', { text: '📎 ' + a.name }),
        el('button', { class: 'mail-chip-x', text: '×', onclick: () => { composeAttachments.splice(i, 1); renderChips(); } })
      ]));
    });
  }

  view.appendChild(el('div', { class: 'mail-compose' }, [
    el('label', { class: 'mail-field' }, [el('span', { text: 'À' }), el('input', { id: 'c-to', type: 'email', value: prefill.to || '', spellcheck: 'false' })]),
    el('label', { class: 'mail-field' }, [el('span', { text: 'Objet' }), el('input', { id: 'c-subject', type: 'text', value: prefill.subject || '', spellcheck: 'false' })]),
    el('textarea', { id: 'c-body', class: 'mail-textarea', placeholder: 'Votre message…' }),
    chips,
    el('div', { class: 'mail-compose-bar' }, [
      el('button', { class: 'mail-btn ghost', text: '📎 Joindre', onclick: () => fileInput.click() }),
      el('label', { class: 'mail-check' }, [
        el('input', { type: 'checkbox', id: 'c-encrypt' }),
        el('span', { text: '🔒 Chiffrer (PGP)' })
      ]),
      el('span', { class: 'mail-compose-status', id: 'c-status' }),
      el('button', { class: 'mail-btn primary', text: 'Envoyer', onclick: sendCompose })
    ]),
    fileInput
  ]));
}

async function sendCompose() {
  const to = $('c-to').value.trim();
  const subject = $('c-subject').value.trim();
  const text = $('c-body').value;
  const encrypt = $('c-encrypt').checked;
  const status = $('c-status');
  if (!to) { status.textContent = '⚠ Destinataire requis.'; return; }

  status.textContent = encrypt ? 'Chiffrement et envoi…' : 'Envoi…';
  try {
    await window.avel.mail.send({ to, subject, text, attachments: composeAttachments.map((a) => a.path), encrypt });
    status.textContent = '✓ Message envoyé.';
    setTimeout(() => showList(), 900);
  } catch (e) {
    status.textContent = '⚠ ' + (e.message || 'Échec de l’envoi.');
  }
}

// ---------- Gestion des clés PGP ----------
async function showKeys() {
  showLoading('Chiffrement…');
  const status = await window.avel.mail.pgpStatus().catch(() => ({ hasIdentity: false }));
  const cfg = await window.avel.mail.getConfig().catch(() => null);

  clear();
  view.appendChild(header('Clés PGP', [el('button', { class: 'mail-btn ghost', text: '← Retour', onclick: () => showList() })]));

  const sections = [];

  // Identité
  if (status.hasIdentity) {
    sections.push(el('div', { class: 'mail-keys-section' }, [
      el('h3', { text: 'Mon identité PGP' }),
      el('p', { class: 'mail-hint', text: `Clé active pour ${status.email}. Partagez votre clé publique pour recevoir des messages chiffrés.` }),
      el('textarea', { class: 'mail-key-box', readonly: 'true', text: status.publicKey }),
      el('div', { class: 'mail-row-actions' }, [
        el('button', { class: 'mail-btn', text: 'Copier ma clé publique', onclick: () => window.avel.copyText(status.publicKey) })
      ])
    ]));
  } else {
    sections.push(el('div', { class: 'mail-keys-section' }, [
      el('h3', { text: 'Créer mon identité PGP' }),
      el('p', { class: 'mail-hint', text: 'Génère une paire de clés (Curve25519) pour chiffrer et déchiffrer vos e-mails. La clé privée est stockée chiffrée localement.' }),
      el('div', { class: 'mail-row-actions' }, [
        el('button', {
          class: 'mail-btn primary',
          text: 'Générer ma clé PGP',
          onclick: async (ev) => {
            if (!cfg || !cfg.user) { return; }
            ev.currentTarget.textContent = 'Génération…';
            try { await window.avel.mail.pgpGenerate(cfg.user, cfg.user); showKeys(); }
            catch (e) { ev.currentTarget.textContent = '⚠ ' + e.message; }
          }
        })
      ])
    ]));
  }

  // Import clé contact
  sections.push(el('div', { class: 'mail-keys-section' }, [
    el('h3', { text: 'Importer la clé publique d’un contact' }),
    el('label', { class: 'mail-field' }, [el('span', { text: 'E-mail du contact' }), el('input', { id: 'k-email', type: 'email', spellcheck: 'false' })]),
    el('textarea', { id: 'k-key', class: 'mail-key-box', placeholder: '-----BEGIN PGP PUBLIC KEY BLOCK-----' }),
    el('div', { class: 'mail-row-actions' }, [
      el('span', { class: 'mail-compose-status', id: 'k-status' }),
      el('button', {
        class: 'mail-btn',
        text: 'Importer',
        onclick: async () => {
          const email = $('k-email').value.trim();
          const key = $('k-key').value.trim();
          const st = $('k-status');
          try { await window.avel.mail.pgpImportContact(email, key); st.textContent = '✓ Clé importée pour ' + email; $('k-email').value = ''; $('k-key').value = ''; }
          catch (e) { st.textContent = '⚠ ' + e.message; }
        }
      })
    ])
  ]));

  view.appendChild(el('div', { class: 'mail-keys' }, sections));
}

// ---------- ouverture / fermeture ----------
async function boot() {
  showLoading('Avel Mail…');
  let cfg = null;
  try { cfg = await window.avel.mail.getConfig(); } catch (_) { /* aucune config */ }
  if (cfg && cfg.hasPassword) {
    try { await window.avel.mail.connect(); folderCache = []; await showList('INBOX'); }
    catch (e) { showLogin(cfg, e.message); }
  } else {
    showLogin(cfg);
  }
}

function toggle() {
  open = !open;
  view.classList.toggle('open', open);
  if (open) boot();
}

export function initMail() {
  $('btn-mail').addEventListener('click', toggle);
}
