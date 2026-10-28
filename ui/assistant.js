'use strict';

// Panneau Avel Assistant : chat Markdown streamé, analyse de page,
// purge d'historique de navigation.

import { $, GREETING } from './util.js';
import { activeTab, navigate } from './tabs.js';

const panel = $('assistant-panel');
const messages = $('messages');
const chatInput = $('chat-input');
const sendBtn = $('chat-send');
const analyzeBtn = $('btn-analyze');

let streaming = false;

if (window.marked && typeof marked.setOptions === 'function') {
  marked.setOptions({ breaks: true, gfm: true });
}

function setBubble(el, text, asMarkdown) {
  if (asMarkdown && window.marked && typeof marked.parse === 'function') {
    el.innerHTML = marked.parse(text || '');
  } else {
    el.textContent = text || '';
  }
}

export function addMessage(text, role) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  setBubble(el, text, /\bbot\b/.test(role));
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  return el;
}

async function purgeWebHistory() {
  try { await window.avel.clearWebHistory(); } catch (_) { /* ignore */ }
  addMessage('🧹 Historique de navigation effacé.', 'bot');
}

async function clearBrowsingData() {
  try { await window.avel.clearBrowsingData(); } catch (_) { /* ignore */ }
  addMessage('🧽 Cache et cookies effacés.', 'bot');
}

function runAssistant(displayText, question, pageContext) {
  if (streaming) return;

  addMessage(displayText, 'user');
  streaming = true;
  sendBtn.disabled = true;
  analyzeBtn.disabled = true;

  const bot = addMessage('', 'bot streaming');
  let buffer = '';

  const finish = () => {
    bot.classList.remove('streaming');
    streaming = false;
    sendBtn.disabled = false;
    analyzeBtn.disabled = false;
    chatInput.focus();
  };

  window.avel.askAssistantStream(question, {
    onToken: (token) => {
      buffer += token;
      setBubble(bot, buffer, true);
      messages.scrollTop = messages.scrollHeight;
    },
    onDone: (full) => {
      setBubble(bot, full || buffer, true);
      finish();
    },
    onError: (message) => {
      bot.textContent = buffer
        ? buffer + `\n\n⚠️ Flux interrompu : ${message}`
        : message;
      finish();
    }
  }, { pageContext });
}

async function extractPageText() {
  const t = activeTab();
  if (!t || !t.url) return null;
  try {
    const text = await t.webview.executeJavaScript(
      'document.body ? document.body.innerText : ""'
    );
    return (text || '').replace(/\n{3,}/g, '\n\n').trim();
  } catch (_) {
    return null;
  }
}

async function analyzePage(question) {
  if (streaming) return;
  const pageContext = await extractPageText();
  if (!pageContext) {
    addMessage('✦ Analyser la page', 'user');
    addMessage(
      "Aucune page web n'est chargée dans cet onglet. Saisissez une adresse, puis relancez l'analyse.",
      'bot'
    );
    return;
  }
  const prompt = question || 'Résume cette page web de manière concise.';
  runAssistant(`✦ ${prompt}`, prompt, pageContext);
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || streaming) return;

  chatInput.value = '';
  chatInput.style.height = '44px';

  if (/(efface|effacer|supprime|vide|purge).{0,25}historique.{0,15}(de\s+)?navigation/i.test(text)) {
    addMessage(text, 'user');
    purgeWebHistory();
    return;
  }

  if (/(efface|effacer|supprime|vide|purge).{0,20}(cache|cookies?)/i.test(text)) {
    addMessage(text, 'user');
    clearBrowsingData();
    return;
  }

  if (/(résume|resume|analyse|résumé).{0,15}(cette\s+)?(page|site)/i.test(text)) {
    analyzePage(text);
    return;
  }

  runAssistant(text, text, null);
}

async function restoreConversation() {
  try {
    const conv = await window.avel.getHistory();
    if (Array.isArray(conv) && conv.length > 0) {
      conv.forEach((m) => addMessage(m.content, m.role === 'user' ? 'user' : 'bot'));
    } else {
      addMessage(GREETING, 'bot');
    }
  } catch (_) {
    addMessage(GREETING, 'bot');
  }
}

export function initAssistant() {
  $('btn-toggle-assistant').addEventListener('click', () => panel.classList.toggle('collapsed'));

  $('btn-clear-history').addEventListener('click', async () => {
    try { await window.avel.clearHistory(); } catch (_) { /* on vide l'écran quand même */ }
    messages.innerHTML = '';
    addMessage(GREETING, 'bot');
  });

  $('btn-clear-web-history').addEventListener('click', purgeWebHistory);
  $('btn-clear-data').addEventListener('click', clearBrowsingData);

  sendBtn.addEventListener('click', sendMessage);
  analyzeBtn.addEventListener('click', () => analyzePage());

  messages.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) navigate(href);
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = '44px';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  restoreConversation();
}
