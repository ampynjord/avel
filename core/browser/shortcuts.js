'use strict';

// ----------------------------------------------------------------------
// Avel — Raccourcis clavier universels (processus principal)
// ----------------------------------------------------------------------
// Capté via `before-input-event` sur CHAQUE webContents (hôte + invités).
// Avantage décisif : fonctionne même quand le focus est dans la page web
// (un keydown du renderer ne voit jamais les touches tapées dans le guest).
// On `preventDefault()` puis on émet une intention au renderer via IPC.
// ----------------------------------------------------------------------

// Traduit une frappe en intention applicative, ou null si non gérée.
function matchIntent(input) {
  const k = (input.key || '').toLowerCase();
  const ctrl = input.control || input.meta;
  const { shift, alt } = input;

  if (ctrl && !alt) {
    if (k === '+' || k === '=') return 'zoom-in';
    if (k === '-' || k === '_') return 'zoom-out';
    if (k === '0') return 'zoom-reset';
    if (k === 'tab') return shift ? 'prev-tab' : 'next-tab';
    if (shift && k === 'b') return 'toggle-bookmarks-bar';
    if (shift && k === 'n') return 'new-private-tab';
    if (!shift) {
      if (k === 't') return 'new-tab';
      if (k === 'w') return 'close-tab';
      if (k === 'l') return 'focus-url';
      if (k === 'r') return 'reload';
    }
  }

  if (!ctrl && !alt && !shift) {
    if (k === 'f5') return 'reload';
    if (k === 'f6') return 'focus-url';
  }

  if (alt && !ctrl && !shift) {
    if (k === 'arrowleft') return 'back';
    if (k === 'arrowright') return 'forward';
  }

  return null;
}

// Branche la capture sur un webContents donné. `send` reçoit l'intention.
function attach(contents, send) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const intent = matchIntent(input);
    if (intent) {
      event.preventDefault();
      send(intent);
    }
  });
}

module.exports = { attach, matchIntent };
