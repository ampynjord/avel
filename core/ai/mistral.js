'use strict';

// ----------------------------------------------------------------------
// Avel — Fournisseur Mistral AI (implémentation concrète d'AIProvider)
// ----------------------------------------------------------------------
// - Si une clé API est présente : appel réel à l'API Mistral en streaming
//   SSE (Server-Sent Events), fragments émis au fil de l'eau.
// - Si la clé est absente : bascule gracieuse sur le simulateur local.
// - Robustesse : timeout, détection 401 (clé invalide) / 429 (quota).
// ----------------------------------------------------------------------

const { AIProvider } = require('./provider');
const { streamSimulatedReply } = require('./simulator');

const DEFAULT_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';
const DEFAULT_TIMEOUT_MS = 10000;

// Erreur typée : message déjà prêt à être affiché à l'utilisateur.
class MistralError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'MistralError';
    this.code = code; // 'timeout' | 'network' | 'auth' | 'quota' | 'http'
  }
}

class MistralProvider extends AIProvider {
  constructor({ config = {}, apiKey = null } = {}) {
    super({ config, apiKey });
    this.apiKey = apiKey;
    this.endpoint = config.endpoint || DEFAULT_ENDPOINT;
    this.model = config.model || DEFAULT_MODEL;
    this.timeoutMs = config.requestTimeoutMs || DEFAULT_TIMEOUT_MS;
  }

  get name() {
    return this.isLive ? `mistral · ${this.model}` : 'mistral (simulé)';
  }

  get isLive() {
    return Boolean(this.apiKey);
  }

  _lastUserMessage(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return '';
  }

  // Traduit un code HTTP en message clair pour l'utilisateur.
  _httpError(status) {
    switch (status) {
      case 401:
      case 403:
        return new MistralError(
          '🔑 Clé API Mistral invalide ou expirée. Vérifiez MISTRAL_API_KEY dans le fichier .env.',
          'auth'
        );
      case 429:
        return new MistralError(
          '⏳ Quota Mistral dépassé (429). Patientez un instant avant de réessayer.',
          'quota'
        );
      default:
        if (status >= 500) {
          return new MistralError(
            `🛠️ Service Mistral momentanément indisponible (erreur ${status}). Réessayez plus tard.`,
            'http'
          );
        }
        return new MistralError(`⚠️ Erreur API Mistral (${status}).`, 'http');
    }
  }

  async *stream(messages) {
    // Mode hors-ligne : simulateur local.
    if (!this.isLive) {
      yield* streamSimulatedReply(this._lastUserMessage(messages));
      return;
    }

    // Timeout sur l'établissement de la connexion (10 s par défaut).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages
        })
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new MistralError(
          `⏱️ Délai dépassé (${Math.round(this.timeoutMs / 1000)} s) : Mistral n'a pas répondu à temps.`,
          'timeout'
        );
      }
      throw new MistralError(`📡 Connexion à Mistral impossible : ${err.message}`, 'network');
    }

    // En-têtes reçus : on lève le timeout, le streaming peut durer.
    clearTimeout(timer);

    if (!res.ok || !res.body) {
      throw this._httpError(res.status);
    }

    // Lecture et parsing du flux SSE.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // garde la ligne partielle pour le prochain tour

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch (_) {
          // fragment JSON incomplet : ignoré, complété au tour suivant
        }
      }
    }
  }
}

module.exports = { MistralProvider, MistralError };
