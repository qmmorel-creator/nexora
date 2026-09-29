// Vérifications HTTP d'un déploiement servi — Ref #544.
// Lectures seules : aucune opération métier, aucune écriture. Cache contourné
// par un paramètre unique, tentatives bornées.
import { environnement } from "../../../config/environnements.mjs";

export function creerLecteurHttp({ fetchImpl = fetch, attendre = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  return async function lire(url, { tentatives = 6, json = true } = {}) {
    let derniere;
    for (let i = 0; i < tentatives; i++) {
      if (i) await attendre(Math.min(2000 * 2 ** (i - 1), 20000));
      try {
        const sep = url.includes("?") ? "&" : "?";
        const r = await fetchImpl(`${url}${sep}_nexora=${Date.now()}${i}`, { redirect: "manual", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(20_000) });
        const texte = await r.text();
        derniere = { statut: r.status, texte, entetes: Object.fromEntries(r.headers) };
        if (r.status === 200) return { ...derniere, donnees: json ? JSON.parse(texte) : null };
      } catch (e) { derniere = { statut: 0, erreur: e.message }; }
    }
    return { ...derniere, donnees: null };
  };
}

// Contrôle version.json d'une URL : composant, environnement et commit attendus.
export async function verifierVersion(lire, base, attendu, options) {
  const r = await lire(`${base}/version.json`, options);
  if (r.statut !== 200 || !r.donnees) return { ok: false, detail: `${base}/version.json : HTTP ${r.statut}${r.erreur ? ` (${r.erreur})` : ""}` };
  for (const [cle, valeur] of Object.entries(attendu)) {
    if (r.donnees[cle] !== valeur) return { ok: false, detail: `${base}/version.json : ${cle} = ${r.donnees[cle]}, attendu ${valeur}`, servi: r.donnees };
  }
  return { ok: true, servi: r.donnees };
}

// Contrôles propres à chaque composant, sans écriture.
export async function controlesComposant(lire, composant, base, nomEnv) {
  const env = environnement(nomEnv);
  const resultats = [];
  const ajouter = (nom, ok, detail = "") => resultats.push({ nom, ok, detail });
  const page = await lire(`${base}/`, { json: false, tentatives: 3 });
  if (composant === "application") {
    ajouter("page d'accueil", page.statut === 200 && /<script type="module">/.test(page.texte || ""), `HTTP ${page.statut}`);
    const modele = await lire(`${base}/carte/modeles/LICENCE-Kenney.txt`, { json: false, tentatives: 3 });
    ajouter("ressources 3D /carte/", modele.statut === 200, `HTTP ${modele.statut}`);
    const openapi = await lire(`${base}/openapi.yaml`, { json: false, tentatives: 3 });
    ajouter("contrat openapi.yaml", openapi.statut === 200 && /openapi:/.test(openapi.texte || ""), `HTTP ${openapi.statut}`);
    if (env.bandeau) {
      ajouter("bandeau d'environnement", /nexora-bandeau-environnement/.test(page.texte || ""));
      ajouter("noindex", /noindex/.test(page.texte || "") && /noindex/.test(page.entetes?.["x-robots-tag"] || ""), page.entetes?.["x-robots-tag"] || "en-tête absent");
      ajouter("aucune référence Firebase de production", !/nexora-cb20d|gstatic\.com\/firebasejs/.test(page.texte || ""));
      const api = await lire(`${base}/api/nexora/health`, { tentatives: 1 });
      ajouter("aucune fonction servie (isolation)", api.statut === 404 || api.statut === 503, `HTTP ${api.statut}`);
    } else {
      ajouter("pas de bandeau en production", !/nexora-bandeau-environnement/.test(page.texte || ""));
      const sante = await lire(`${base}/api/nexora/health`, { tentatives: 3 });
      ajouter("santé API", sante.statut === 200 && sante.donnees?.ok === true && sante.donnees?.projectId === env.firebaseProjet, `HTTP ${sante.statut}`);
    }
  } else {
    const sante = await lire(`${base}/health`, { tentatives: 3 });
    ajouter("santé MCP", sante.statut === 200 && sante.donnees?.ok === true && sante.donnees?.service === "nexora-mcp", `HTTP ${sante.statut}`);
    const oauth = await lire(`${base}/.well-known/oauth-authorization-server`, { tentatives: 3 });
    ajouter("métadonnées OAuth (issuer)", oauth.statut === 200 && oauth.donnees?.issuer === env.mcpIssuer, oauth.donnees?.issuer || `HTTP ${oauth.statut}`);
  }
  return { ok: resultats.every((r) => r.ok), resultats };
}
