'use strict';

// ----------------------------------------------------------------------
// Avel Mail — Service IMAP/SMTP réel + PGP (processus principal)
// ----------------------------------------------------------------------

const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const store = require('./store');
const pgp = require('./pgp');
const pgpStore = require('./pgpStore');

let client = null;
let config = null;
const attachmentCache = new Map(); // uid -> [{ filename, content, ... }]

function loadConfig() {
  if (!config) config = store.load();
  return config;
}

function fmtAddress(list) {
  if (!list || !list.length) return '';
  const a = list[0];
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

function extractEmail(str) {
  const m = String(str || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(str || '')).trim().toLowerCase();
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

// --- IMAP ---
async function connect() {
  const cfg = loadConfig();
  if (!cfg) throw new Error('Aucune configuration de messagerie enregistrée.');
  if (client && client.usable) return { ok: true };
  client = new ImapFlow({
    host: cfg.imapHost,
    port: Number(cfg.imapPort) || 993,
    secure: cfg.imapSecure !== false,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false
  });
  await client.connect();
  return { ok: true };
}

async function folders() {
  await connect();
  const list = await client.list();
  return list.map((f) => ({ path: f.path, name: f.name || f.path, specialUse: f.specialUse || '' }));
}

async function list(folder = 'INBOX', limit = 30) {
  await connect();
  const lock = await client.getMailboxLock(folder);
  try {
    const total = client.mailbox.exists;
    if (!total) return [];
    const start = Math.max(1, total - limit + 1);
    const out = [];
    for await (const msg of client.fetch(`${start}:*`, { envelope: true, uid: true, flags: true })) {
      out.push({
        uid: msg.uid,
        subject: msg.envelope.subject || '(sans objet)',
        from: fmtAddress(msg.envelope.from),
        date: msg.envelope.date,
        seen: msg.flags ? msg.flags.has('\\Seen') : false
      });
    }
    return out.reverse();
  } finally {
    lock.release();
  }
}

async function get(folder = 'INBOX', uid) {
  await connect();
  const lock = await client.getMailboxLock(folder);
  try {
    const msg = await client.fetchOne(uid, { source: true }, { uid: true });
    if (!msg || !msg.source) return null;
    const parsed = await simpleParser(msg.source);
    try { await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }); } catch (_) { /* ignore */ }

    // Pièces jointes : on garde les buffers en cache pour l'enregistrement.
    const attachments = parsed.attachments || [];
    attachmentCache.set(uid, attachments);
    const attMeta = attachments.map((a, i) => ({
      index: i,
      filename: a.filename || `piece-jointe-${i + 1}`,
      size: a.size || 0,
      contentType: a.contentType || ''
    }));

    // Déchiffrement PGP si le corps contient un bloc chiffré.
    let text = parsed.text || '';
    let encrypted = false;
    if (pgp.isPgpMessage(text)) {
      const identity = pgpStore.loadIdentity();
      const block = pgp.extractPgpBlock(text);
      if (identity && block) {
        try {
          text = await pgp.decrypt(block, identity.privateKey);
          encrypted = true;
        } catch (e) {
          text = `🔒 Message chiffré PGP — déchiffrement impossible (${e.message}).`;
        }
      } else {
        text = '🔒 Message chiffré PGP — aucune identité PGP configurée pour le déchiffrer.';
      }
    }

    return {
      uid,
      subject: parsed.subject || '(sans objet)',
      from: parsed.from ? parsed.from.text : '',
      to: parsed.to ? parsed.to.text : '',
      date: parsed.date || null,
      text,
      encrypted,
      hasHtml: !!parsed.html,
      attachments: attMeta
    };
  } finally {
    lock.release();
  }
}

async function saveAttachment(uid, index) {
  const atts = attachmentCache.get(uid);
  if (!atts || !atts[index]) throw new Error('Pièce jointe introuvable — rouvrez le message.');
  const a = atts[index];
  const dir = app.getPath('downloads');
  const target = uniquePath(dir, a.filename || `piece-jointe-${index + 1}`);
  fs.writeFileSync(target, a.content);
  shell.showItemInFolder(target);
  return { ok: true, savePath: target };
}

// --- SMTP ---
async function send({ to, subject, text, attachments, encrypt }) {
  const cfg = loadConfig();
  if (!cfg) throw new Error('Aucune configuration de messagerie enregistrée.');

  let body = text || '';
  if (encrypt) {
    const rcpt = extractEmail(to);
    const pub = pgpStore.getContactKey(rcpt);
    if (!pub) throw new Error(`Aucune clé publique PGP pour ${rcpt}. Importez-la dans « Clés ».`);
    const keys = [pub];
    const self = pgpStore.loadIdentity(); // chiffrer aussi pour soi (copie lisible)
    if (self && self.publicKey) keys.push(self.publicKey);
    body = await pgp.encrypt(body, keys);
  }

  const port = Number(cfg.smtpPort) || 587;
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port,
    secure: cfg.smtpSecure === true || port === 465,
    auth: { user: cfg.user, pass: cfg.pass }
  });

  const mailOptions = { from: cfg.user, to, subject, text: body };
  if (Array.isArray(attachments) && attachments.length) {
    mailOptions.attachments = attachments
      .filter((p) => p)
      .map((p) => ({ path: p }));
  }
  const info = await transporter.sendMail(mailOptions);
  return { ok: true, messageId: info.messageId };
}

async function disconnect() {
  try { if (client) await client.logout(); } catch (_) { /* ignore */ }
  client = null;
  attachmentCache.clear();
  return { ok: true };
}

// --- Configuration ---
function saveConfig(cfg) {
  if (cfg.pass === undefined || cfg.pass === '') {
    const existing = store.load();
    if (existing && existing.pass) cfg = { ...cfg, pass: existing.pass };
  }
  config = cfg;
  store.save(cfg);
  return { ok: true };
}

function getConfig() {
  const cfg = loadConfig();
  if (!cfg) return null;
  const { pass, ...rest } = cfg;
  return { ...rest, hasPassword: !!pass };
}

// --- PGP ---
async function pgpGenerate(name, email) {
  const { privateKey, publicKey } = await pgp.generateKeyPair(name, email);
  pgpStore.saveIdentity({ email, privateKey, publicKey });
  return { ok: true, publicKey };
}

function pgpStatus() {
  const id = pgpStore.loadIdentity();
  return { hasIdentity: !!id, email: id ? id.email : null, publicKey: id ? id.publicKey : null };
}

function pgpImportContact(email, armoredKey) {
  if (!email || !armoredKey || !armoredKey.includes('BEGIN PGP PUBLIC KEY')) {
    throw new Error('Clé publique invalide.');
  }
  pgpStore.addContactKey(extractEmail(email), armoredKey);
  return { ok: true };
}

function pgpHasContact(to) {
  return { has: !!pgpStore.getContactKey(extractEmail(to)) };
}

module.exports = {
  connect, folders, list, get, saveAttachment, send, disconnect,
  saveConfig, getConfig,
  pgpGenerate, pgpStatus, pgpImportContact, pgpHasContact
};
