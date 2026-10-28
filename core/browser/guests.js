'use strict';

// ----------------------------------------------------------------------
// Avel — Hub central des webContents invités (<webview>)
// ----------------------------------------------------------------------
// Point d'ancrage UNIQUE pour tout comportement de niveau navigateur,
// quel que soit l'onglet : interception des popups (→ nouvel onglet Avel),
// capture des raccourcis depuis l'intérieur des pages, et menu contextuel.
// ----------------------------------------------------------------------

const { app, ipcMain } = require('electron');
const shortcuts = require('./shortcuts');
const dialogs = require('./dialogs');

// Dernier clic droit : on retient le webContents invité + les coordonnées
// pour pouvoir déclencher « Inspecter l'élément » depuis le menu custom.
let lastContext = null;

function install({ getWindow }) {
  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() !== 'webview') return;

    const sendToUi = (channel, payload) => {
      const win = getWindow();
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    };

    // Popups / window.open / cibles _blank → ouverture dans un onglet Avel.
    contents.setWindowOpenHandler(({ url }) => {
      sendToUi('avel:open-tab', url);
      return { action: 'deny' };
    });

    // Raccourcis tapés alors que le focus est dans la page.
    shortcuts.attach(contents, (intent) => sendToUi('avel:shortcut', intent));

    // Interception des dialogs JS (alert/confirm/prompt) → modale custom.
    dialogs.attach(contents, (channel, payload) => sendToUi(channel, payload));

    // Menu contextuel : on bloque le menu natif et on délègue au renderer.
    contents.on('context-menu', (e, params) => {
      e.preventDefault();
      lastContext = { contents, x: params.x, y: params.y };
      sendToUi('avel:context-menu', {
        x: params.x,
        y: params.y,
        selectionText: params.selectionText || '',
        linkURL: params.linkURL || '',
        pageURL: params.pageURL || '',
        canGoBack: contents.canGoBack(),
        canGoForward: contents.canGoForward()
      });
    });
  });

  // Déclenché par le menu custom du renderer.
  ipcMain.handle('browser:inspect-element', () => {
    if (lastContext && !lastContext.contents.isDestroyed()) {
      // On rend le debugger pour éviter le conflit avec l'inspecteur.
      dialogs.release(lastContext.contents);
      lastContext.contents.inspectElement(lastContext.x, lastContext.y);
    }
    return true;
  });
}

module.exports = { install };
