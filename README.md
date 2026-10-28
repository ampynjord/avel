# Avel Browser — MVP

Première brique de la suite **AVEL**, la suite de services souveraine européenne.
Un navigateur épuré intégrant nativement un assistant IA propulsé par **Mistral AI**.

## ✦ Fonctionnalités (MVP)

- 🌐 Navigateur minimaliste (barre d'URL + navigation, recherche intégrée DuckDuckGo)
- 🤖 Panneau latéral **Avel Assistant** (chat IA, connecté à Mistral ou simulé en local)
- 🛡️ Blocage des traqueurs connus, Do Not Track, cookies tiers limités
- 🎨 Design Avel : moderne, épuré, teintes bleues / celtes

## 📁 Arborescence

```
avel/
├── package.json     Dépendances (electron) et scripts
├── config.json      Configuration NON-secrète : modèle, sécurité, anti-traqueurs
├── .env             Secrets locaux (MISTRAL_API_KEY) — ignoré par git
├── .env.example     Modèle de fichier .env
├── main.js          Orchestrateur / point d'entrée Electron
├── preload.js       Pont sécurisé (contextBridge) renderer ↔ main
├── index.html       Page d'accueil locale (UI navigateur + assistant)
├── styles.css       Design Avel
├── renderer.js      Logique UI (navigation + chat assistant en streaming)
└── core/                    Couche de services (réutilisable par toute la suite AVEL)
    ├── config.js            Chargement de la config non-secrète
    ├── ai/
    │   ├── provider.js      Interface abstraite AIProvider
    │   ├── mistral.js       Fournisseur Mistral (streaming SSE)
    │   └── simulator.js     Repli IA local hors-ligne
    ├── security/
    │   ├── secrets.js       Secrets via .env / safeStorage (prod)
    │   └── tracker.js       Blocage des traqueurs
    └── storage/
        └── history.js       Historique de conversation persistant
```

## 🚀 Installation & lancement

```bash
npm install
npm start
```

## 🔑 Activer Mistral AI

Sans clé, l'assistant répond en **mode simulé local** (hors-ligne).
Pour activer les réponses réelles (en streaming) :

```bash
cp .env.example .env
# puis éditez .env :
MISTRAL_API_KEY=votre_clé_ici
```

> ⚠️ Le fichier `.env` est ignoré par git. La clé ne transite jamais
> vers le renderer ni vers `config.json`. En production, elle pourra être
> stockée chiffrée via le `safeStorage` d'Electron (déjà câblé dans
> `core/security/secrets.js`).

## ⚙️ Sécurité

Options modifiables dans `config.json` → `security` :

| Option | Description |
|---|---|
| `blockTrackers` | Bloque les domaines de la `trackerBlocklist` |
| `blockThirdPartyCookies` | Limite les cookies tiers |
| `doNotTrack` | Envoie l'en-tête `DNT: 1` |

## 📜 Licence

© 2026 ampynjord — **Tous droits réservés.** Le code est visible publiquement
à des fins de transparence uniquement ; aucune utilisation, copie, modification
ni redistribution n'est autorisée sans accord écrit préalable. Voir [LICENSE](LICENSE).
