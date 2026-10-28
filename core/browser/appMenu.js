'use strict';

// ----------------------------------------------------------------------
// Avel — Menu applicatif minimal
// ----------------------------------------------------------------------
// Le menu Electron par défaut lie Ctrl+R (recharger l'hôte), Ctrl+W
// (fermer la fenêtre), etc. — ce qui entrerait en conflit avec nos
// raccourcis d'onglets. On le remplace par un menu minimal qui CONSERVE
// uniquement les rôles presse-papier (sinon Ctrl+C/V/X/A cassent dans les
// champs) + la bascule DevTools, et libère tous les autres raccourcis.
// ----------------------------------------------------------------------

const { Menu } = require('electron');

function install() {
  const template = [
    {
      label: 'Édition',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'toggleDevTools' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { install };
