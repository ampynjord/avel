'use strict';

// ----------------------------------------------------------------------
// Avel — Blocage des traqueurs (couche sécurité réseau)
// ----------------------------------------------------------------------
// Intercepte les requêtes sortantes au niveau de la session Electron et
// annule celles dirigées vers des domaines de pistage connus.
// ----------------------------------------------------------------------

function installTrackerBlocking(ses, security = {}) {
  if (!security.blockTrackers) return;

  const blocklist = (security.trackerBlocklist || []).map((d) => d.toLowerCase());

  if (blocklist.length > 0) {
    ses.webRequest.onBeforeRequest((details, callback) => {
      let host = '';
      try {
        host = new URL(details.url).hostname.toLowerCase();
      } catch (_) {
        return callback({ cancel: false });
      }
      const blocked = blocklist.some(
        (domain) => host === domain || host.endsWith('.' + domain)
      );
      if (blocked) console.log('[Avel] Traqueur bloqué :', host);
      callback({ cancel: blocked });
    });
  }

  // En-tête Do Not Track.
  if (security.doNotTrack) {
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['DNT'] = '1';
      callback({ requestHeaders: details.requestHeaders });
    });
  }
}

module.exports = { installTrackerBlocking };
