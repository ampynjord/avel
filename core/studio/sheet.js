'use strict';

// ----------------------------------------------------------------------
// Avel Studio — Moteur de tableur (évaluation de formules)
// ----------------------------------------------------------------------
// Pur (sans dépendance), donc testable. Supporte : nombres, texte,
// formules `=` avec références de cellules (A1), arithmétique (+ - * / ()),
// et SUM(A1:B3). Détection de cycles.
// ----------------------------------------------------------------------

function colToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function indexToCol(n) {
  let s = '';
  n += 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function parseRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return m ? { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 } : null;
}
function indexToRef(c, r) { return indexToCol(c) + (r + 1); }

function evaluate(cells) {
  const out = {};
  const visiting = {};

  function safeArith(expr) {
    if (!/^[0-9+\-*/(). ]*$/.test(expr)) return '#ERR';
    if (expr.trim() === '') return 0;
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${expr});`)();
      return typeof v === 'number' && isFinite(v) ? v : '#ERR';
    } catch (_) { return '#ERR'; }
  }

  function numOf(v) {
    if (typeof v === 'number') return v;
    if (v === '' || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function sumRange(a, b) {
    const A = parseRef(a); const B = parseRef(b);
    if (!A || !B) return 0;
    let s = 0;
    for (let r = Math.min(A.row, B.row); r <= Math.max(A.row, B.row); r++) {
      for (let c = Math.min(A.col, B.col); c <= Math.max(A.col, B.col); c++) {
        s += numOf(resolve(indexToRef(c, r)));
      }
    }
    return s;
  }

  function evalExpr(expr) {
    let e = expr.replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/gi, (_, a, b) => sumRange(a.toUpperCase(), b.toUpperCase()));
    e = e.replace(/[A-Z]+\d+/gi, (ref) => numOf(resolve(ref.toUpperCase())));
    return safeArith(e);
  }

  function resolve(ref) {
    if (out[ref] !== undefined) return out[ref];
    if (visiting[ref]) { out[ref] = '#CYCLE'; return out[ref]; }
    visiting[ref] = true;
    const raw = cells[ref];
    let val;
    if (raw == null || raw === '') val = '';
    else if (typeof raw === 'string' && raw.startsWith('=')) val = evalExpr(raw.slice(1));
    else if (raw !== '' && !isNaN(Number(raw))) val = Number(raw);
    else val = raw;
    visiting[ref] = false;
    // Un cycle détecté plus profond a déjà marqué cette cellule : on le garde.
    if (out[ref] === '#CYCLE') return out[ref];
    out[ref] = val;
    return val;
  }

  Object.keys(cells).forEach(resolve);
  return out;
}

module.exports = { evaluate, parseRef, indexToCol, indexToRef };
