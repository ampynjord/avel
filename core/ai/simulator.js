'use strict';

// ----------------------------------------------------------------------
// Avel — Simulateur IA local hors-ligne (mode MVP sans clé API)
// ----------------------------------------------------------------------
// Génère des réponses plausibles sans réseau, et les diffuse mot par mot
// pour offrir la même expérience de streaming que le fournisseur réel.
// ----------------------------------------------------------------------

function simulateReply(question) {
  const q = (question || '').toLowerCase().trim();

  if (!q) return "Pose-moi une question et j'y répondrai avec plaisir.";

  if (/bonjour|salut|coucou|hello/.test(q)) {
    return 'Bonjour 👋 Je suis Avel Assistant, votre IA souveraine européenne. Comment puis-je vous aider ?';
  }
  if (/qui es-tu|qui est tu|ton nom|t'appelles/.test(q)) {
    return "Je suis Avel Assistant, l'IA intégrée au navigateur Avel, propulsée par Mistral AI. Je respecte votre vie privée : aucune donnée n'est revendue.";
  }
  if (/avel|souverain|europ/.test(q)) {
    return "AVEL est une suite de services souveraine européenne, décentralisée et ancrée localement. Avel Browser en est la première brique : un navigateur épuré, respectueux de la vie privée, avec un assistant IA Mistral intégré.";
  }
  if (/mistral/.test(q)) {
    return "Mistral AI est un laboratoire français de modèles de langage. En mode complet, je m'y connecte via votre MISTRAL_API_KEY (à renseigner dans le fichier .env).";
  }
  if (/traqueur|tracker|cookie|vie privée|privacy|sécurité/.test(q)) {
    return "Avel bloque par défaut les traqueurs connus (Google Analytics, Facebook, etc.), active Do Not Track et limite les cookies tiers. Tout est configurable dans config.json.";
  }
  if (/\?$/.test(q)) {
    return `Bonne question. En mode MVP, je fonctionne en local sans clé API. Renseignez votre MISTRAL_API_KEY dans le fichier .env pour des réponses complètes via Mistral AI.\n\n(Votre question : « ${question} »)`;
  }
  return `J'ai bien reçu : « ${question} ». En mode MVP local, mes réponses sont simulées. Ajoutez votre MISTRAL_API_KEY dans le fichier .env pour activer Mistral AI.`;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Diffuse la réponse simulée par petits fragments (effet "frappe au clavier").
async function* streamSimulatedReply(question) {
  const reply = simulateReply(question);
  const tokens = reply.match(/\S+\s*/g) || [reply];
  for (const token of tokens) {
    yield token;
    await delay(18);
  }
}

module.exports = { simulateReply, streamSimulatedReply };
