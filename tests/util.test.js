'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// ui/util.js est un module ES (renderer) → import dynamique.
test('toUrl : URL, domaine et recherche', async () => {
  const { toUrl, isProbablyUrl } = await import('../ui/util.js');

  assert.strictEqual(toUrl('https://mistral.ai'), 'https://mistral.ai');
  assert.strictEqual(toUrl('example.com'), 'https://example.com');
  assert.ok(toUrl('chats mignons').startsWith('https://duckduckgo.com/?q='));
  assert.strictEqual(toUrl('   '), null);

  assert.strictEqual(isProbablyUrl('example.com'), true);
  assert.strictEqual(isProbablyUrl('bonjour le monde'), false);
});
