'use strict';

// Modales JS internes (alert / confirm / prompt) — stylées Sci-Fi.
// Les demandes proviennent du main (interception CDP) ; on renvoie la
// réponse via window.avel.respondDialog.

import { $ } from './util.js';

const overlay = $('dialog-overlay');
const msgEl = $('dialog-message');
const inputWrap = $('dialog-input-wrap');
const inputEl = $('dialog-input');
const okBtn = $('dialog-ok');
const cancelBtn = $('dialog-cancel');

let current = null;

function close() {
  overlay.classList.remove('open');
  current = null;
}

function respond(accept) {
  if (!current) return;
  const text = current.type === 'prompt' ? inputEl.value : '';
  window.avel.respondDialog(current.id, accept, text);
  close();
}

function show(d) {
  current = d;
  msgEl.textContent = d.message || '';

  const isPrompt = d.type === 'prompt';
  inputWrap.style.display = isPrompt ? 'block' : 'none';
  if (isPrompt) inputEl.value = d.defaultPrompt || '';

  // alert : un seul bouton ; confirm/prompt/beforeunload : OK + Annuler.
  const hasCancel = d.type !== 'alert';
  cancelBtn.style.display = hasCancel ? 'inline-flex' : 'none';

  overlay.classList.add('open');
  setTimeout(() => {
    if (isPrompt) { inputEl.focus(); inputEl.select(); }
    else okBtn.focus();
  }, 30);
}

export function initDialogs() {
  if (window.avel.onDialog) window.avel.onDialog(show);

  okBtn.addEventListener('click', () => respond(true));
  cancelBtn.addEventListener('click', () => respond(false));

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); respond(true); }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); respond(current && current.type === 'alert'); }
    else if (e.key === 'Enter' && current && current.type !== 'prompt') { e.preventDefault(); respond(true); }
  });
}
