// Configuration de référence des environnements Nexora — Ref #544.
//
// Source unique des valeurs NON SECRÈTES qui distinguent local, préproduction
// et production : projets Netlify, origines publiques, projet Firebase attendu,
// issuer OAuth du MCP, périmètres publiables. Le build, le serveur local,
// l'outil de publication et les contrôles de fumée lisent tous ce fichier ;
// aucune copie ailleurs. Aucune valeur secrète ne doit jamais y figurer.

export const PRODUIT = "nexora";

// Composants publiables. `chemins` = ce qui entre dans l'empreinte du composant
// (code servi, dépendances, construction, configuration non secrète). Les
// fichiers partagés utilisés par le build figurent dans chaque composant qui
// les consomme. `publication/registre.json` n'y figure jamais : son écriture
// seule ne change ni les fichiers servis ni la validité d'une recette.
export const COMPOSANTS = {
  application: {
    libelle: "Application, API et fonctions planifiées",
    netlifyProjet: "nexora-project",
    netlifyId: "12f7ec79-b8cb-4dd1-a07b-558b236bed4c",
    base: "apps/nexora",
    publie: "dist",
    fonctions: "netlify/functions",
    chemins: ["apps/nexora", "config/environnements.mjs"],
    // Routes réservées aux fonctions : servies en production seulement.
    controles: ["/version.json", "/api/nexora/health", "/openapi.yaml", "/carte/modeles/LICENCE-Kenney.txt"],
  },
  mcp: {
    libelle: "Serveur MCP OAuth (ChatGPT, Claude)",
    netlifyProjet: "nexora-chatgpt-mcp",
    netlifyId: "2c0b2293-8b71-471b-8288-21f641256aa2",
    base: "apps/nexora-mcp",
    publie: "public",
    fonctions: "netlify/functions",
    chemins: ["apps/nexora-mcp", "config/environnements.mjs"],
    controles: ["/version.json", "/health", "/.well-known/oauth-authorization-server"],
  },
};

// Fichiers exclus de toute empreinte de recette ou de republication.
export const EXCLUS_EMPREINTE = ["publication/registre.json"];

export const ENVIRONNEMENTS = {
  local: {
    libelle: "LOCAL",
    bandeau: true,
    indexable: false,
    // Aucune fonction, aucune donnée réelle : stockage fictif dans le navigateur.
    donnees: "demo",
    firebaseProjet: "demo-nexora",
    origines: { application: "http://127.0.0.1:8888", mcp: null },
    hote: "127.0.0.1",
    port: 8888,
  },
  preproduction: {
    libelle: "PRÉPRODUCTION",
    bandeau: true,
    indexable: false,
    donnees: "demo",
    firebaseProjet: "demo-nexora",
    // Alias stable des brouillons Netlify ; distinct de toute branche existante.
    alias: "preprod",
    origines: {
      application: "https://preprod--nexora-project.netlify.app",
      // Aucun MCP de préproduction tant qu'un projet Firebase et des secrets de
      // test distincts n'existent pas (voir docs/PUBLICATION.md).
      mcp: null,
    },
    // Les projets existants servent les secrets de production à TOUS les
    // contextes Netlify (relevé du 29/09/2026) : une préproduction ne dépose
    // donc jamais de fonction sur eux.
    fonctions: false,
  },
  production: {
    libelle: "PRODUCTION",
    bandeau: false,
    indexable: true,
    donnees: "firebase",
    firebaseProjet: "nexora-cb20d",
    origines: {
      application: "https://nexora-project.org",
      // Alias historique conservé : utilisé par les routines ChatGPT.
      applicationHistorique: "https://nexora-project.netlify.app",
      mcp: "https://nexora-chatgpt-mcp.netlify.app",
    },
    mcpIssuer: "https://nexora-chatgpt-mcp.netlify.app",
    fonctions: true,
  },
};

export const NOMS_ENVIRONNEMENTS = Object.keys(ENVIRONNEMENTS);

export function environnement(nom) {
  const env = ENVIRONNEMENTS[nom];
  if (!env) throw new Error(`Environnement inconnu : « ${nom} » — attendus : ${NOMS_ENVIRONNEMENTS.join(", ")}`);
  return { nom, ...env };
}

// Valeurs publiques du SDK Firebase navigateur (déjà servies en production,
// non secrètes). Le mode démo ne les reçoit jamais.
export const FIREBASE_PROJET_PRODUCTION = "nexora-cb20d";

// Motifs qui ne doivent JAMAIS apparaître dans une sortie hors production :
// leur présence signifierait qu'un bundle de test peut joindre les
// ressources réelles.
export const MOTIFS_PRODUCTION_INTERDITS = [
  /nexora-cb20d/,
  /www\.gstatic\.com\/firebasejs/,
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
];
