'use strict';

// ----------------------------------------------------------------------
// Avel — Gestion des sessions (cache & cookies souverains)
// ----------------------------------------------------------------------

const { session } = require('electron');

// Efface le cache HTTP + toutes les données stockées (cookies, localStorage,
// IndexedDB, service workers…) de la session fournie (défaut : session
// principale). 100 % local, aucune fuite cloud.
async function clearBrowsingData(ses) {
  const s = ses || session.defaultSession;
  try {
    await s.clearCache();
    await s.clearStorageData();
    return true;
  } catch (err) {
    console.error('[Avel] Échec effacement cache/cookies :', err.message);
    return false;
  }
}

module.exports = { clearBrowsingData };
