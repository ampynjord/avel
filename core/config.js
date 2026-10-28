'use strict';

const path = require('path');
const fs = require('fs');

// Chargement de la configuration NON-SECRÈTE de l'application.
// Les secrets (clés API) ne transitent JAMAIS par ce fichier :
// ils sont gérés par core/security/secrets.js.
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULTS = {
  app: {
    name: 'Avel Browser',
    homepage: 'index.html',
    defaultSearchEngine: 'https://duckduckgo.com/?q='
  },
  ai: {
    provider: 'mistral',
    model: 'mistral-small-latest',
    availableModels: ['mistral-small-latest', 'mistral-large-latest'],
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    requestTimeoutMs: 10000,
    maxPageContextChars: 6000,
    systemPrompt: 'Tu es Avel Assistant.'
  },
  security: { blockTrackers: true, trackerBlocklist: [] },
  privacy: { telemetry: false }
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    // Fusion superficielle avec les valeurs par défaut.
    return {
      app: { ...DEFAULTS.app, ...(raw.app || {}) },
      ai: { ...DEFAULTS.ai, ...(raw.ai || {}) },
      security: { ...DEFAULTS.security, ...(raw.security || {}) },
      privacy: { ...DEFAULTS.privacy, ...(raw.privacy || {}) }
    };
  } catch (err) {
    console.error('[Avel] config.json illisible, valeurs par défaut utilisées :', err.message);
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

module.exports = { loadConfig };
