'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const sheet = require('../core/studio/sheet');

test('tableur : valeurs, références, arithmétique', () => {
  const r = sheet.evaluate({ A1: '2', A2: '3', A3: '=A1+A2', A4: '=A1*A2+1' });
  assert.strictEqual(r.A3, 5);
  assert.strictEqual(r.A4, 7);
});

test('tableur : SUM sur une plage', () => {
  const r = sheet.evaluate({ A1: '1', A2: '2', A3: '3', A4: '=SUM(A1:A3)' });
  assert.strictEqual(r.A4, 6);
});

test('tableur : chaîne de dépendances', () => {
  const r = sheet.evaluate({ A1: '10', B1: '=A1*2', C1: '=B1+5' });
  assert.strictEqual(r.B1, 20);
  assert.strictEqual(r.C1, 25);
});

test('tableur : détection de cycle et texte', () => {
  const cyc = sheet.evaluate({ A1: '=A2', A2: '=A1' });
  assert.strictEqual(cyc.A1, '#CYCLE');
  const txt = sheet.evaluate({ A1: 'bonjour', A2: '=A1+1' });
  assert.strictEqual(txt.A1, 'bonjour');
  assert.strictEqual(txt.A2, 1); // texte → 0 dans l'arithmétique
});

test('tableur : références de colonnes', () => {
  assert.strictEqual(sheet.indexToCol(0), 'A');
  assert.strictEqual(sheet.indexToCol(7), 'H');
  assert.deepStrictEqual(sheet.parseRef('C5'), { col: 2, row: 4 });
});
