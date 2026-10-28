'use strict';

// ----------------------------------------------------------------------
// Avel — Gestion souveraine des secrets
// ----------------------------------------------------------------------
// Principe : aucun secret ne doit vivre dans le dépôt git.
//  - DÉVELOPPEMENT : lecture depuis un fichier .env à la racine du projet.
//  - PRODUCTION    : lecture depuis un coffre chiffré via le safeStorage
//                    d'Electron (chiffrement lié au système d'exploitation).
// ----------------------------------------------------------------------

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(ROOT, '.env');

let envCache = null;

// --- Parseur .env minimal (sans dépendance externe) ---------------------
function parseEnv(content) {
  const out = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Retire d'éventuels guillemets entourants.
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  });
  return out;
}

// Charge le .env une seule fois en mémoire (idempotent).
function loadEnv() {
  if (envCache) return envCache;
  try {
    envCache = parseEnv(fs.readFileSync(ENV_PATH, 'utf-8'));
  } catch (_) {
    envCache = {}; // pas de .env : ce n'est pas une erreur (mode simulé).
  }
  // Les variables d'environnement système ont priorité sur le .env.
  return envCache;
}

// --- Coffre chiffré de production (safeStorage) -------------------------
// Stub fonctionnel : en production, les secrets seront stockés chiffrés
// dans userData/avel-secrets.enc et déchiffrés à la volée. La bascule se
// fera automatiquement une fois `app.isPackaged === true`.
function getProductionSecret(name) {
  try {
    const { app, safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) return null;
    const vaultPath = path.join(app.getPath('userData'), 'avel-secrets.enc');
    if (!fs.existsSync(vaultPath)) return null;
    const vault = JSON.parse(
      safeStorage.decryptString(fs.readFileSync(vaultPath))
    );
    return vault[name] || null;
  } catch (_) {
    return null;
  }
}

// Écrit/chiffre un secret dans le coffre de production (utilitaire futur).
function setProductionSecret(name, value) {
  const { app, safeStorage } = require('electron');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage indisponible sur ce système.');
  }
  const vaultPath = path.join(app.getPath('userData'), 'avel-secrets.enc');
  let vault = {};
  try {
    vault = JSON.parse(safeStorage.decryptString(fs.readFileSync(vaultPath)));
  } catch (_) { /* coffre inexistant : on en crée un */ }
  vault[name] = value;
  fs.writeFileSync(vaultPath, safeStorage.encryptString(JSON.stringify(vault)));
}

// --- API publique -------------------------------------------------------
// Résout un secret selon l'environnement, par ordre de priorité :
//   1. variable d'environnement système
//   2. coffre chiffré de production (si app packagée)
//   3. fichier .env de développement
function getSecret(name) {
  if (process.env[name]) return process.env[name];

  let isPackaged = false;
  try { isPackaged = require('electron').app?.isPackaged; } catch (_) {}

  if (isPackaged) {
    const prod = getProductionSecret(name);
    if (prod) return prod;
  }

  const env = loadEnv();
  return env[name] || null;
}

function getMistralApiKey() {
  return getSecret('MISTRAL_API_KEY');
}

module.exports = {
  loadEnv,
  getSecret,
  getMistralApiKey,
  setProductionSecret
};
