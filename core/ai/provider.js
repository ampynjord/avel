'use strict';

// ----------------------------------------------------------------------
// Avel — Interface abstraite d'un fournisseur d'IA
// ----------------------------------------------------------------------
// L'application ne dépend JAMAIS directement de Mistral : elle parle à
// cette abstraction. Cela prépare :
//   - le multi-modèle (Mistral cloud, Mistral auto-hébergé, etc.) ;
//   - la fédération AVEL (un nœud régional pourra exposer son propre
//     fournisseur conforme à cette interface).
// ----------------------------------------------------------------------

class AIProvider {
  constructor(options = {}) {
    this.options = options;
  }

  // Identifiant lisible du fournisseur (à surcharger).
  get name() {
    return 'abstract';
  }

  // Indique si le fournisseur est en mode réel (clé présente) ou simulé.
  get isLive() {
    return false;
  }

  // Diffusion en flux : générateur asynchrone qui émet des fragments de texte.
  // À implémenter par chaque fournisseur concret.
  async *stream(_messages) {
    throw new Error('AIProvider.stream() doit être implémenté par une sous-classe.');
  }

  // Réponse complète : par défaut, agrège le flux. Les sous-classes peuvent
  // surcharger pour un appel non-streamé natif.
  async ask(messages) {
    let full = '';
    for await (const chunk of this.stream(messages)) {
      full += chunk;
    }
    return full;
  }
}

module.exports = { AIProvider };
