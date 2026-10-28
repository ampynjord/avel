'use strict';

// Zoom de page appliqué dynamiquement à la <webview> de l'onglet actif.

import { activeTab } from './tabs.js';

const STEP = 0.1;
const MIN = 0.3;
const MAX = 3;
const round = (v) => Math.round(v * 10) / 10;

function apply(fn) {
  const t = activeTab();
  if (!t || !t.url) return;
  const current = t.zoom || 1;
  const next = Math.min(MAX, Math.max(MIN, fn(current)));
  t.zoom = next;
  try { t.webview.setZoomFactor(next); } catch (_) { /* ignore */ }
}

export function zoomIn() { apply((f) => round(f + STEP)); }
export function zoomOut() { apply((f) => round(f - STEP)); }
export function zoomReset() { apply(() => 1); }
