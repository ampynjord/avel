'use strict';

// ----------------------------------------------------------------------
// Avel Browser — Point d'entrée & orchestrateur
// ----------------------------------------------------------------------
// Ce fichier ne contient PAS de logique métier : il câble les modules de
// /core (config, secrets, sécurité réseau, IA, stockage) et expose les
// ponts IPC vers le renderer.
// ----------------------------------------------------------------------

const { app, BrowserWindow, ipcMain, session, clipboard } = require('electron');
const path = require('path');

const { loadConfig } = require('./core/config');
const secrets = require('./core/security/secrets');
const { installTrackerBlocking } = require('./core/security/tracker');
const { MistralProvider } = require('./core/ai/mistral');
const history = require('./core/storage/history');
const bookmarks = require('./core/storage/bookmarks');
const webHistory = require('./core/storage/webHistory');
const shortcuts = require('./core/browser/shortcuts');
const guests = require('./core/browser/guests');
const appMenu = require('./core/browser/appMenu');
const downloads = require('./core/browser/downloads');
const dialogs = require('./core/browser/dialogs');
const sessionUtil = require('./core/security/session');
const mail = require('./core/mail/service');
const drive = require('./core/drive/service');
const studioStore = require('./core/studio/store');
const sheet = require('./core/studio/sheet');
const network = require('./core/network/service');

const config = loadConfig();
let aiProvider = null;
let mainWindow = null;

// --- Construction du fournisseur d'IA ------------------------------------
function buildAIProvider() {
  const apiKey = secrets.getMistralApiKey();
  // Demain : un switch sur config.ai.provider pourra instancier un autre
  // fournisseur (Mistral auto-hébergé, nœud régional AVEL, etc.).
  return new MistralProvider({ config: config.ai, apiKey });
}

// --- Construction de la liste de messages envoyée à l'IA -----------------
// `pageContext` (optionnel) = texte brut de la page web active, injecté en
// arrière-plan dans le message système. ÉPHÉMÈRE : jamais persisté dans
// l'historique, pour ne pas saturer les tours suivants ni la facture API.
function buildMessages(pageContext) {
  let system = config.ai.systemPrompt || 'Tu es Avel Assistant.';

  if (pageContext) {
    const max = config.ai.maxPageContextChars || 6000;
    const trimmed = String(pageContext).slice(0, max);
    system +=
      "\n\n[Contexte de la page web actuellement affichée, fourni en arrière-plan " +
      "pour t'aider à répondre. Ne le recopie pas verbatim, appuie-toi dessus :]\n" +
      trimmed;
  }

  return [
    { role: 'system', content: system },
    ...history.all()
  ];
}

// --- Fenêtre principale --------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d1b2a',
    title: config.app.name || 'Avel Browser',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow = win;

  // Raccourcis tapés quand le focus est sur la coque (barre d'URL, etc.).
  shortcuts.attach(win.webContents, (intent) => {
    if (!win.isDestroyed()) win.webContents.send('avel:shortcut', intent);
  });

  // Boutons latéraux physiques de la souris (4/5) → Précédent / Suivant.
  win.on('app-command', (_e, cmd) => {
    if (win.isDestroyed()) return;
    if (cmd === 'browser-backward') win.webContents.send('avel:shortcut', 'back');
    else if (cmd === 'browser-forward') win.webContents.send('avel:shortcut', 'forward');
  });

  win.loadFile(config.app.homepage || 'index.html');
}

// --- Ponts IPC -----------------------------------------------------------
function registerIpc() {
  // Configuration publique (jamais de secret : la clé n'est plus dans config).
  ipcMain.handle('config:get', () => ({
    ...config,
    ai: { ...config.ai, isLive: aiProvider.isLive, providerName: aiProvider.name }
  }));

  // Historique persistant.
  ipcMain.handle('history:get', () => history.all());
  ipcMain.handle('history:clear', () => {
    history.clear();
    return true;
  });

  // Assistant IA en streaming (SSE -> tokens temps réel vers le renderer).
  ipcMain.on('ai:ask-stream', async (event, { id, question, pageContext }) => {
    const sender = event.sender;
    history.push('user', question);

    let answer = '';
    try {
      for await (const token of aiProvider.stream(buildMessages(pageContext))) {
        answer += token;
        if (sender.isDestroyed()) return;
        sender.send('ai:stream-token', { id, token });
      }
      history.push('assistant', answer);
      history.save();
      if (!sender.isDestroyed()) sender.send('ai:stream-end', { id, full: answer });
    } catch (err) {
      history.push('assistant', answer || `⚠️ ${err.message}`);
      history.save();
      if (!sender.isDestroyed()) {
        sender.send('ai:stream-error', { id, message: err.message });
      }
    }
  });

  // Favoris locaux.
  ipcMain.handle('bookmarks:get', () => bookmarks.all());
  ipcMain.handle('bookmarks:toggle', (_e, { url, title }) => ({
    bookmarked: bookmarks.toggle(url, title)
  }));
  ipcMain.handle('bookmarks:clear', () => {
    bookmarks.clear();
    return true;
  });

  // Historique de navigation souverain.
  ipcMain.handle('webhistory:get', () => webHistory.all());
  ipcMain.on('webhistory:add', (_e, { url, title }) => webHistory.add(url, title));
  ipcMain.handle('webhistory:clear', () => {
    webHistory.clear();
    return true;
  });

  // Presse-papier (menu contextuel : copier URL / lien / sélection).
  ipcMain.handle('browser:copy', (_e, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });

  // Téléchargements.
  ipcMain.handle('downloads:get', () => downloads.all());
  ipcMain.handle('downloads:open', (_e, id) => downloads.openFile(id));
  ipcMain.handle('downloads:show', (_e, id) => downloads.showInFolder(id));
  ipcMain.handle('downloads:clear', () => downloads.clear());

  // Effacement cache & cookies (session principale).
  ipcMain.handle('session:clear', () => sessionUtil.clearBrowsingData(session.defaultSession));

  // Avel Mail (IMAP/SMTP réels).
  ipcMain.handle('mail:saveConfig', (_e, cfg) => mail.saveConfig(cfg));
  ipcMain.handle('mail:getConfig', () => mail.getConfig());
  ipcMain.handle('mail:connect', () => mail.connect());
  ipcMain.handle('mail:folders', () => mail.folders());
  ipcMain.handle('mail:list', (_e, { folder, limit }) => mail.list(folder, limit));
  ipcMain.handle('mail:get', (_e, { folder, uid }) => mail.get(folder, uid));
  ipcMain.handle('mail:saveAttachment', (_e, { uid, index }) => mail.saveAttachment(uid, index));
  ipcMain.handle('mail:send', (_e, msg) => mail.send(msg));
  ipcMain.handle('mail:disconnect', () => mail.disconnect());

  // Avel Mail — PGP.
  ipcMain.handle('mail:pgpStatus', () => mail.pgpStatus());
  ipcMain.handle('mail:pgpGenerate', (_e, { name, email }) => mail.pgpGenerate(name, email));
  ipcMain.handle('mail:pgpImportContact', (_e, { email, key }) => mail.pgpImportContact(email, key));
  ipcMain.handle('mail:pgpHasContact', (_e, { to }) => mail.pgpHasContact(to));

  // Avel Drive (stockage chiffré, nœuds local/régional).
  ipcMain.handle('drive:upload', (_e, p) => drive.upload(p));
  ipcMain.handle('drive:list', () => drive.list());
  ipcMain.handle('drive:download', (_e, id) => drive.download(id));
  ipcMain.handle('drive:delete', (_e, id) => drive.remove(id));
  ipcMain.handle('drive:getConfig', () => drive.getConfig());
  ipcMain.handle('drive:setConfig', (_e, c) => drive.setConfig(c));
  ipcMain.handle('drive:testNode', (_e, c) => drive.testNode(c));

  // Avel Studio (documents chiffrés + moteur de tableur).
  ipcMain.handle('studio:list', () => studioStore.list());
  ipcMain.handle('studio:get', (_e, id) => studioStore.get(id));
  ipcMain.handle('studio:save', (_e, doc) => studioStore.save(doc));
  ipcMain.handle('studio:delete', (_e, id) => studioStore.remove(id));
  ipcMain.handle('studio:evalSheet', (_e, cells) => sheet.evaluate(cells || {}));

  // Avel Network (maillage temps réel).
  ipcMain.handle('net:connect', (_e, url) => network.connect(url));
  ipcMain.handle('net:subscribe', (_e, channel) => network.subscribe(channel));
  ipcMain.handle('net:unsubscribe', (_e, channel) => network.unsubscribe(channel));
  ipcMain.handle('net:publish', (_e, { channel, data }) => network.publish(channel, data));
  ipcMain.handle('net:peers', () => network.peers());
  ipcMain.handle('net:status', () => network.status());
  ipcMain.handle('net:disconnect', () => network.disconnect());
}

// --- Cycle de vie --------------------------------------------------------
app.whenReady().then(() => {
  secrets.loadEnv();
  const userData = app.getPath('userData');
  history.init(path.join(userData, 'avel-history.json'));
  bookmarks.init(path.join(userData, 'avel-bookmarks.json'));
  webHistory.init(path.join(userData, 'avel-history-web.json'));
  installTrackerBlocking(session.defaultSession, config.security);
  // Les sessions de partition (onglets privés) héritent du blocage traqueurs.
  app.on('session-created', (s) => installTrackerBlocking(s, config.security));
  aiProvider = buildAIProvider();

  appMenu.install();
  guests.install({ getWindow: () => mainWindow });
  downloads.install(session.defaultSession, { getWindow: () => mainWindow });
  dialogs.init();
  network.init(() => mainWindow);

  registerIpc();
  createWindow();

  console.log(`[Avel] Fournisseur IA : ${aiProvider.name}`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
