'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// API sécurisée exposée au renderer. Aucune clé secrète n'y transite :
// tout passe par le processus principal et ses modules /core.
contextBridge.exposeInMainWorld('avel', {
  // Configuration publique (sans secrets).
  getConfig: () => ipcRenderer.invoke('config:get'),

  // Historique de conversation persistant.
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Favoris locaux.
  getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
  toggleBookmark: (url, title) => ipcRenderer.invoke('bookmarks:toggle', { url, title }),
  clearBookmarks: () => ipcRenderer.invoke('bookmarks:clear'),

  // Historique de navigation souverain.
  getWebHistory: () => ipcRenderer.invoke('webhistory:get'),
  recordVisit: (url, title) => ipcRenderer.send('webhistory:add', { url, title }),
  clearWebHistory: () => ipcRenderer.invoke('webhistory:clear'),

  // Événements de niveau navigateur (émis par le hub guests / main).
  onShortcut: (cb) => {
    const fn = (_e, intent) => cb(intent);
    ipcRenderer.on('avel:shortcut', fn);
    return () => ipcRenderer.removeListener('avel:shortcut', fn);
  },
  onOpenTab: (cb) => {
    const fn = (_e, url) => cb(url);
    ipcRenderer.on('avel:open-tab', fn);
    return () => ipcRenderer.removeListener('avel:open-tab', fn);
  },

  // Menu contextuel.
  onContextMenu: (cb) => {
    const fn = (_e, params) => cb(params);
    ipcRenderer.on('avel:context-menu', fn);
    return () => ipcRenderer.removeListener('avel:context-menu', fn);
  },
  inspectElement: () => ipcRenderer.invoke('browser:inspect-element'),
  copyText: (text) => ipcRenderer.invoke('browser:copy', text),

  // Téléchargements.
  onDownloadUpdate: (cb) => {
    const fn = (_e, item) => cb(item);
    ipcRenderer.on('avel:download-update', fn);
    return () => ipcRenderer.removeListener('avel:download-update', fn);
  },
  getDownloads: () => ipcRenderer.invoke('downloads:get'),
  openDownload: (id) => ipcRenderer.invoke('downloads:open', id),
  showDownload: (id) => ipcRenderer.invoke('downloads:show', id),
  clearDownloads: () => ipcRenderer.invoke('downloads:clear'),

  // Dialogs JS internes (alert / confirm / prompt).
  onDialog: (cb) => {
    const fn = (_e, d) => cb(d);
    ipcRenderer.on('avel:dialog', fn);
    return () => ipcRenderer.removeListener('avel:dialog', fn);
  },
  respondDialog: (id, accept, text) => ipcRenderer.send('avel:dialog-response', { id, accept, text }),

  // Cache & cookies.
  clearBrowsingData: () => ipcRenderer.invoke('session:clear'),

  // Chemin absolu d'un fichier choisi (pièces jointes) — API Electron moderne.
  getFilePath: (file) => {
    try { return webUtils.getPathForFile(file); }
    catch (_) { return file && file.path ? file.path : ''; }
  },

  // Avel Mail (IMAP/SMTP + PGP).
  mail: {
    saveConfig: (cfg) => ipcRenderer.invoke('mail:saveConfig', cfg),
    getConfig: () => ipcRenderer.invoke('mail:getConfig'),
    connect: () => ipcRenderer.invoke('mail:connect'),
    folders: () => ipcRenderer.invoke('mail:folders'),
    list: (folder, limit) => ipcRenderer.invoke('mail:list', { folder, limit }),
    get: (folder, uid) => ipcRenderer.invoke('mail:get', { folder, uid }),
    saveAttachment: (uid, index) => ipcRenderer.invoke('mail:saveAttachment', { uid, index }),
    send: (msg) => ipcRenderer.invoke('mail:send', msg),
    disconnect: () => ipcRenderer.invoke('mail:disconnect'),
    pgpStatus: () => ipcRenderer.invoke('mail:pgpStatus'),
    pgpGenerate: (name, email) => ipcRenderer.invoke('mail:pgpGenerate', { name, email }),
    pgpImportContact: (email, key) => ipcRenderer.invoke('mail:pgpImportContact', { email, key }),
    pgpHasContact: (to) => ipcRenderer.invoke('mail:pgpHasContact', { to })
  },

  // Avel Drive (stockage souverain chiffré).
  drive: {
    upload: (filePath) => ipcRenderer.invoke('drive:upload', filePath),
    list: () => ipcRenderer.invoke('drive:list'),
    download: (id) => ipcRenderer.invoke('drive:download', id),
    delete: (id) => ipcRenderer.invoke('drive:delete', id),
    getConfig: () => ipcRenderer.invoke('drive:getConfig'),
    setConfig: (c) => ipcRenderer.invoke('drive:setConfig', c),
    testNode: (c) => ipcRenderer.invoke('drive:testNode', c)
  },

  // Avel Studio (bureautique souveraine).
  studio: {
    list: () => ipcRenderer.invoke('studio:list'),
    get: (id) => ipcRenderer.invoke('studio:get', id),
    save: (doc) => ipcRenderer.invoke('studio:save', doc),
    delete: (id) => ipcRenderer.invoke('studio:delete', id),
    evalSheet: (cells) => ipcRenderer.invoke('studio:evalSheet', cells)
  },

  // Avel Network (maillage temps réel).
  net: {
    connect: (url) => ipcRenderer.invoke('net:connect', url),
    subscribe: (channel) => ipcRenderer.invoke('net:subscribe', channel),
    unsubscribe: (channel) => ipcRenderer.invoke('net:unsubscribe', channel),
    publish: (channel, data) => ipcRenderer.invoke('net:publish', { channel, data }),
    peers: () => ipcRenderer.invoke('net:peers'),
    status: () => ipcRenderer.invoke('net:status'),
    disconnect: () => ipcRenderer.invoke('net:disconnect'),
    onMessage: (cb) => {
      const fn = (_e, m) => cb(m);
      ipcRenderer.on('avel:net-message', fn);
      return () => ipcRenderer.removeListener('avel:net-message', fn);
    }
  },

  // Assistant IA en STREAMING.
  // `handlers` = { onToken(text), onDone(full), onError(message) }.
  // `options`  = { pageContext } — contexte de page injecté en arrière-plan.
  // Renvoie une fonction de désabonnement.
  askAssistantStream: (question, handlers = {}, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const onToken = (_e, msg) => {
      if (msg.id === id && handlers.onToken) handlers.onToken(msg.token);
    };
    const onEnd = (_e, msg) => {
      if (msg.id !== id) return;
      cleanup();
      if (handlers.onDone) handlers.onDone(msg.full);
    };
    const onError = (_e, msg) => {
      if (msg.id !== id) return;
      cleanup();
      if (handlers.onError) handlers.onError(msg.message);
    };

    function cleanup() {
      ipcRenderer.removeListener('ai:stream-token', onToken);
      ipcRenderer.removeListener('ai:stream-end', onEnd);
      ipcRenderer.removeListener('ai:stream-error', onError);
    }

    ipcRenderer.on('ai:stream-token', onToken);
    ipcRenderer.on('ai:stream-end', onEnd);
    ipcRenderer.on('ai:stream-error', onError);

    ipcRenderer.send('ai:ask-stream', { id, question, pageContext: options.pageContext || null });
    return cleanup;
  }
});
