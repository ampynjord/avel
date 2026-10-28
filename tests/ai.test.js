'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { simulateReply } = require('../core/ai/simulator');
const { MistralProvider, MistralError } = require('../core/ai/mistral');
const { loadConfig } = require('../core/config');

test('simulateur : réponses non vides et contextuelles', () => {
  assert.match(simulateReply('bonjour'), /Avel Assistant/i);
  assert.match(simulateReply('parle-moi de Mistral'), /Mistral/i);
  assert.ok(simulateReply('').length > 0);
});

test('MistralProvider : mode simulé vs live', () => {
  const offline = new MistralProvider({ config: {}, apiKey: null });
  assert.strictEqual(offline.isLive, false);
  assert.match(offline.name, /simulé/);

  const live = new MistralProvider({ config: { model: 'mistral-large-latest' }, apiKey: 'k' });
  assert.strictEqual(live.isLive, true);
  assert.match(live.name, /mistral-large-latest/);
});

test('MistralProvider : erreurs HTTP typées', () => {
  const p = new MistralProvider({ config: {}, apiKey: 'k' });
  assert.strictEqual(p._httpError(401).code, 'auth');
  assert.strictEqual(p._httpError(429).code, 'quota');
  assert.strictEqual(p._httpError(500).code, 'http');
  assert.ok(p._httpError(401) instanceof MistralError);
});

test('config : valeurs par défaut fusionnées', () => {
  const cfg = loadConfig();
  assert.ok(cfg.ai.model);
  assert.ok(Array.isArray(cfg.ai.availableModels));
  assert.strictEqual(typeof cfg.security.blockTrackers, 'boolean');
});
