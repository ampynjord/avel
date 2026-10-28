'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { matchIntent } = require('../core/browser/shortcuts');

const K = (key, m = {}) => ({
  type: 'keyDown',
  key,
  control: !!m.c,
  shift: !!m.s,
  alt: !!m.a,
  meta: !!m.meta
});

test('raccourcis onglets', () => {
  assert.strictEqual(matchIntent(K('t', { c: 1 })), 'new-tab');
  assert.strictEqual(matchIntent(K('w', { c: 1 })), 'close-tab');
  assert.strictEqual(matchIntent(K('Tab', { c: 1 })), 'next-tab');
  assert.strictEqual(matchIntent(K('Tab', { c: 1, s: 1 })), 'prev-tab');
  assert.strictEqual(matchIntent(K('n', { c: 1, s: 1 })), 'new-private-tab');
  assert.strictEqual(matchIntent(K('b', { c: 1, s: 1 })), 'toggle-bookmarks-bar');
});

test('raccourcis navigation', () => {
  assert.strictEqual(matchIntent(K('l', { c: 1 })), 'focus-url');
  assert.strictEqual(matchIntent(K('F6')), 'focus-url');
  assert.strictEqual(matchIntent(K('r', { c: 1 })), 'reload');
  assert.strictEqual(matchIntent(K('F5')), 'reload');
  assert.strictEqual(matchIntent(K('ArrowLeft', { a: 1 })), 'back');
  assert.strictEqual(matchIntent(K('ArrowRight', { a: 1 })), 'forward');
});

test('raccourcis zoom', () => {
  assert.strictEqual(matchIntent(K('+', { c: 1 })), 'zoom-in');
  assert.strictEqual(matchIntent(K('=', { c: 1 })), 'zoom-in');
  assert.strictEqual(matchIntent(K('-', { c: 1 })), 'zoom-out');
  assert.strictEqual(matchIntent(K('0', { c: 1 })), 'zoom-reset');
});

test('négatifs : frappe normale et presse-papier non interceptés', () => {
  assert.strictEqual(matchIntent(K('t')), null);          // frappe simple
  assert.strictEqual(matchIntent(K('c', { c: 1 })), null); // Ctrl+C → presse-papier
  assert.strictEqual(matchIntent(K('v', { c: 1 })), null);
  assert.strictEqual(matchIntent(K('a', { c: 1 })), null);
  assert.strictEqual(matchIntent(K('Backspace')), null);   // effacement
  assert.strictEqual(matchIntent(K('n', { c: 1 })), null); // Ctrl+N seul
});
