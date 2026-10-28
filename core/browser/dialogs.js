'use strict';

// ----------------------------------------------------------------------
// Avel — Interception des dialogs JS (alert / confirm / prompt)
// ----------------------------------------------------------------------
// Via le Chrome DevTools Protocol (webContents.debugger) : on intercepte
// `Page.javascriptDialogOpening`, on affiche une modale custom dans le
// renderer, puis on renvoie la réponse avec `Page.handleJavaScriptDialog`.
//
// Cohabitation DevTools : le debugger est EXCLUSIF. Quand l'inspecteur
// s'ouvre, on détache notre debugger ; on le rattache à sa fermeture.
// `release()` permet un détachement explicite avant un inspectElement().
// ----------------------------------------------------------------------

const { ipcMain } = require('electron');

let seq = 0;
const pending = new Map();      // id -> webContents
const controllers = new Map();  // webContents -> { detach }

function attach(contents, sendToUi) {
  let attached = false;

  const doAttach = () => {
    if (attached || contents.isDestroyed()) return;
    try {
      contents.debugger.attach('1.3');
      attached = true;
      contents.debugger.sendCommand('Page.enable').catch(() => {});
    } catch (_) { /* déjà attaché (DevTools ?) */ }
  };

  const doDetach = () => {
    if (!attached) return;
    try { contents.debugger.detach(); } catch (_) { /* ignore */ }
    attached = false;
  };

  contents.debugger.on('message', (_e, method, params) => {
    if (method !== 'Page.javascriptDialogOpening') return;
    const id = ++seq;
    pending.set(id, contents);
    sendToUi('avel:dialog', {
      id,
      type: params.type,                 // alert | confirm | prompt | beforeunload
      message: params.message || '',
      defaultPrompt: params.defaultPrompt || ''
    });
  });

  contents.debugger.on('detach', () => { attached = false; });

  // Libère le debugger pour l'inspecteur, le récupère ensuite.
  contents.on('devtools-opened', doDetach);
  contents.on('devtools-closed', () => setTimeout(doAttach, 150));
  contents.on('destroyed', () => { doDetach(); controllers.delete(contents); });

  controllers.set(contents, { detach: doDetach });
  doAttach();
}

// Détachement explicite (appelé juste avant inspectElement).
function release(contents) {
  const c = controllers.get(contents);
  if (c) c.detach();
}

function respond(id, accept, text) {
  const contents = pending.get(id);
  if (!contents) return;
  pending.delete(id);
  try {
    contents.debugger.sendCommand('Page.handleJavaScriptDialog', {
      accept: !!accept,
      promptText: text || ''
    });
  } catch (_) { /* ignore */ }
}

function init() {
  ipcMain.on('avel:dialog-response', (_e, { id, accept, text }) => respond(id, accept, text));
}

module.exports = { attach, release, init };
