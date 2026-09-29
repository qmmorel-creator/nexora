// Client minimal de l'API Netlify — Ref #544.
//
// Lectures et PUT idempotents : nouvelles tentatives bornées, avec attente
// croissante, sur 429 et 5xx. Création de déploiement (POST) : JAMAIS rejouée
// à l'aveugle — une réponse perdue se réconcilie en recherchant le titre et
// l'empreinte (voir depot.mjs). Le jeton vient de l'environnement de
// l'assistant (NETLIFY_AUTH_TOKEN), jamais d'un fichier du dépôt.

const API = "https://api.netlify.com/api/v1";
const ATTENTES = [2000, 4000, 8000, 16000];

export class ErreurNetlify extends Error {
  constructor(message, { statut, incertain = false } = {}) {
    super(message);
    this.statut = statut;
    // incertain = la requête a pu aboutir côté Netlify sans que la réponse
    // nous parvienne : ne pas la rejouer sans réconciliation.
    this.incertain = incertain;
  }
}

export function creerClientNetlify({ jeton = process.env.NETLIFY_AUTH_TOKEN, fetchImpl = fetch, attendre = (ms) => new Promise((r) => setTimeout(r, ms)), attentes = ATTENTES } = {}) {
  if (!jeton) throw new ErreurNetlify("NETLIFY_AUTH_TOKEN absent de l'environnement de l'assistant : aucune opération Netlify possible.");

  async function appel(methode, chemin, { corps, brut, typeContenu, rejouable = methode !== "POST" } = {}) {
    for (let essai = 0; ; essai++) {
      let reponse;
      try {
        reponse = await fetchImpl(`${API}${chemin}`, {
          method: methode,
          headers: {
            Authorization: `Bearer ${jeton}`,
            ...(corps !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(brut !== undefined ? { "Content-Type": typeContenu || "application/octet-stream" } : {}),
          },
          body: corps !== undefined ? JSON.stringify(corps) : brut,
          signal: AbortSignal.timeout(120_000),
        });
      } catch (e) {
        if (!rejouable) throw new ErreurNetlify(`${methode} ${chemin} : réponse perdue (${e.message}). Réconciliation nécessaire avant toute relance.`, { incertain: true });
        if (essai >= attentes.length) throw new ErreurNetlify(`${methode} ${chemin} : réseau indisponible après ${essai + 1} tentatives (${e.message}).`);
        await attendre(attentes[essai]);
        continue;
      }
      if (reponse.ok) {
        const texte = await reponse.text();
        return texte ? JSON.parse(texte) : null;
      }
      const temporaire = reponse.status === 429 || reponse.status >= 500;
      if (temporaire && !rejouable) throw new ErreurNetlify(`${methode} ${chemin} : HTTP ${reponse.status}. Résultat incertain, réconciliation nécessaire.`, { statut: reponse.status, incertain: true });
      if (temporaire && essai < attentes.length) { await attendre(attentes[essai]); continue; }
      const detail = (await reponse.text().catch(() => "")).slice(0, 300);
      throw new ErreurNetlify(`${methode} ${chemin} : HTTP ${reponse.status} ${detail}`, { statut: reponse.status });
    }
  }

  return {
    site: (id) => appel("GET", `/sites/${id}`),
    deploiement: (id) => appel("GET", `/deploys/${id}`),
    deploiements: (siteId, { parPage = 50 } = {}) => appel("GET", `/sites/${siteId}/deploys?per_page=${parPage}`),
    creerDeploiement: (siteId, parametres) => appel("POST", `/sites/${siteId}/deploys`, { corps: parametres }),
    envoyerFichier: (deployId, chemin, contenu) => appel("PUT", `/deploys/${deployId}/files${chemin.split("/").map(encodeURIComponent).join("/")}`, { brut: contenu }),
    envoyerFonction: (deployId, nom, zip, { runtime = "js", invocationMode } = {}) =>
      appel("PUT", `/deploys/${deployId}/functions/${encodeURIComponent(nom)}?runtime=${runtime}${invocationMode ? `&invocation_mode=${invocationMode}` : ""}`, { brut: zip }),
    // Publie (ou republie) un déploiement existant, sans reconstruction :
    // c'est le même appel pour la promotion d'un brouillon vérifié et pour un
    // retour arrière. Rejouable : publier deux fois le même Deploy ID est sans effet.
    publier: (siteId, deployId) => appel("POST", `/sites/${siteId}/deploys/${deployId}/restore`, { rejouable: true }),
    // Réglages de construction Git (garde-fou de l'hébergeur).
    modifierSite: (siteId, corps) => appel("PATCH", `/sites/${siteId}`, { corps }),
  };
}
