'use strict';

// Helpers partagés + état de configuration du renderer.

export const $ = (id) => document.getElementById(id);

export const GREETING =
  "Bonjour 👋 Je suis Avel Assistant. Posez-moi une question sur Avel, la vie privée, ou n'importe quel sujet !";

let config = { app: { defaultSearchEngine: 'https://duckduckgo.com/?q=' } };

export function getConfig() { return config; }

export async function loadConfig() {
  try { config = await window.avel.getConfig(); } catch (_) { /* défaut conservé */ }
  return config;
}

export function isProbablyUrl(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[^\s]+\.[^\s]{2,}/.test(value);
}

export function toUrl(value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  if (isProbablyUrl(v)) return 'https://' + v;
  const engine = config.app?.defaultSearchEngine || 'https://duckduckgo.com/?q=';
  return engine + encodeURIComponent(v);
}
