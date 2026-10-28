'use strict';

// Client des raccourcis : reçoit les intentions émises par le main et les
// route vers les actions onglets / navigation / zoom.

import * as tabs from './tabs.js';
import { zoomIn, zoomOut, zoomReset } from './zoom.js';
import { toggleBookmarksBar } from './bookmarks.js';
import { $ } from './util.js';

function handle(intent) {
  const t = tabs.activeTab();
  switch (intent) {
    case 'new-tab': tabs.newTab(); break;
    case 'new-private-tab': tabs.newTab(undefined, { private: true }); break;
    case 'close-tab': if (t) tabs.closeTab(t.id); break;
    case 'next-tab': tabs.cycleTab(1); break;
    case 'prev-tab': tabs.cycleTab(-1); break;
    case 'focus-url': { const u = $('url-input'); u.focus(); u.select(); break; }
    case 'reload': if (t && t.url) t.webview.reload(); break;
    case 'back': if (t && t.url && t.webview.canGoBack()) t.webview.goBack(); break;
    case 'forward': if (t && t.url && t.webview.canGoForward()) t.webview.goForward(); break;
    case 'zoom-in': zoomIn(); break;
    case 'zoom-out': zoomOut(); break;
    case 'zoom-reset': zoomReset(); break;
    case 'toggle-bookmarks-bar': toggleBookmarksBar(); break;
    default: break;
  }
}

export function initShortcuts() {
  if (window.avel.onShortcut) window.avel.onShortcut(handle);
  if (window.avel.onOpenTab) window.avel.onOpenTab((url) => tabs.newTab(url));
}
