'use strict';

// ----------------------------------------------------------------------
// Avel Browser — point d'entrée du renderer (ES modules)
// ----------------------------------------------------------------------
// Orchestre l'initialisation : config → assistant → favoris → onglets →
// raccourcis, puis ouvre le premier onglet (page d'accueil).
// ----------------------------------------------------------------------

import { $, loadConfig } from './util.js';
import * as tabs from './tabs.js';
import { initStar, loadBookmarks, initBookmarksBar } from './bookmarks.js';
import { initAssistant } from './assistant.js';
import { initShortcuts } from './shortcuts.js';
import { initContextMenu } from './contextMenu.js';
import { initDownloads } from './downloads.js';
import { initDialogs } from './dialogs.js';
import { initMail } from './mail.js';
import { initDrive } from './drive.js';
import { initStudio } from './studio.js';

(async () => {
  const config = await loadConfig();
  if (config.security?.blockTrackers) {
    $('assistant-status').textContent = 'IA souveraine · Mistral AI · Anti-traqueurs actif';
  }

  initAssistant();
  initStar();
  tabs.initTabBar();
  initShortcuts();
  initContextMenu();
  initDownloads();
  initDialogs();
  initMail();
  initDrive();
  initStudio();

  await loadBookmarks();
  initBookmarksBar();
  tabs.newTab(); // premier onglet : écran d'accueil

  console.log('[Avel] Interface initialisée (ES modules chargés).');
})();
