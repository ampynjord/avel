'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const bookmarks = require('../core/storage/bookmarks');
const webHistory = require('../core/storage/webHistory');

function tmp(name) {
  const p = path.join(os.tmpdir(), `avel-test-${name}-${Date.now()}.json`);
  fs.rmSync(p, { force: true });
  return p;
}

test('favoris : toggle / has / persistance', () => {
  const file = tmp('bm');
  bookmarks.init(file);
  assert.strictEqual(bookmarks.toggle('https://mistral.ai', 'Mistral'), true);
  assert.strictEqual(bookmarks.has('https://mistral.ai'), true);
  assert.strictEqual(bookmarks.toggle('https://mistral.ai', 'Mistral'), false);
  assert.strictEqual(bookmarks.has('https://mistral.ai'), false);

  // persistance disque
  bookmarks.add('https://a.fr', 'A');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(raw.length, 1);
  assert.strictEqual(raw[0].url, 'https://a.fr');
  fs.rmSync(file, { force: true });
});

test('historique : dédup, filtre non-web, purge', () => {
  const file = tmp('wh');
  webHistory.init(file);
  webHistory.add('https://a.fr', 'A');
  webHistory.add('https://a.fr', 'A rechargé'); // dédup consécutif
  webHistory.add('https://b.fr', 'B');
  webHistory.add('about:blank', 'x');            // filtré
  webHistory.add('', 'vide');                    // filtré

  const all = webHistory.all();
  assert.strictEqual(all.length, 2);
  assert.deepStrictEqual(all.map((e) => e.url), ['https://a.fr', 'https://b.fr']);
  assert.strictEqual(all[0].title, 'A rechargé'); // titre mis à jour au rechargement

  webHistory.clear();
  assert.strictEqual(webHistory.all().length, 0);
  fs.rmSync(file, { force: true });
});
