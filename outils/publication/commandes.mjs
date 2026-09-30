// Commandes de l'outil de publication Nexora — Ref #544.
// Toutes les dépendances externes (API Netlify, Git, HTTP, GitHub, horloge)
// sont injectées : les tests exercent refus, reprises et retours sur des
// doubles, sans jamais toucher la production.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { COMPOSANTS, environnement } from "../../config/environnements.mjs";
import { empreinteComposant, empreinteRecette } from "./lib/empreinte.mjs";
import { deposerBrouillon, retrouverCandidat } from "./lib/depot.mjs";
import { controlesComposant, verifierVersion } from "./lib/verification.mjs";
import { enregistrer, journaliser, lireRegistre, prendreVerrou, serialiser, ecrireRegistreLocal } from "./lib/registre.mjs";
import { verifierMecanisme } from "./lib/construction.mjs";

const REGEX_VERSION = /^\d+\.\d+\.\d+(-rc\.\d+)?$/;
const court = (sha) => sha.slice(0, 12);
export const titrePreproduction = (sha, composant, empreinte) => `preproduction · ${sha} · ${composant} · empreinte:${empreinte.slice(0, 16)}`;
export const titreProduction = (version, sha, composant, empreinte) => `v${version} · ${sha} · ${composant} · empreinte:${empreinte.slice(0, 16)}`;
const urlSite = (def) => `https://${def.netlifyProjet}.netlify.app`;
const urlAlias = (def, alias) => `https://${alias}--${def.netlifyProjet}.netlify.app`;
const urlPermalien = (def, deployId) => `https://${deployId}--${def.netlifyProjet}.netlify.app`;
const urlProduction = (nom) => nom === "application" ? environnement("production").origines.application : environnement("production").origines.mcp;

class Refus extends Error {}
export { Refus };

function composantsDemandes(liste) {
  const noms = (liste || "application,mcp").split(",").map((s) => s.trim()).filter(Boolean);
  const inconnus = noms.filter((n) => !COMPOSANTS[n]);
  if (inconnus.length) throw new Refus(`Composant(s) inconnu(s) : ${inconnus.join(", ")} — attendus : ${Object.keys(COMPOSANTS).join(", ")}.`);
  return noms;
}

// ---------------------------------------------------------------- garde ---
export async function garde(d, { arreter = false, retablir = false } = {}) {
  const lignes = [];
  for (const [nom, def] of Object.entries(COMPOSANTS)) {
    let site = await d.api.site(def.netlifyId);
    if (site.name !== def.netlifyProjet) throw new Refus(`Projet Netlify ${def.netlifyId} : nom « ${site.name} », attendu « ${def.netlifyProjet} ». Cible incohérente.`);
    if (arreter && !site.build_settings?.stop_builds) {
      await d.api.modifierSite(def.netlifyId, { build_settings: { stop_builds: true } });
      site = await d.api.site(def.netlifyId);
    }
    if (retablir) {
      if (d.env.NEXORA_RESTAURER_ANCIEN_FONCTIONNEMENT !== "oui") throw new Refus("Rétablir les builds Git n'est permis que pour un retour explicitement demandé à l'ancien fonctionnement (NEXORA_RESTAURER_ANCIEN_FONCTIONNEMENT=oui).");
      await d.api.modifierSite(def.netlifyId, { build_settings: { stop_builds: false } });
      site = await d.api.site(def.netlifyId);
    }
    lignes.push({ composant: nom, projet: def.netlifyProjet, buildsGitArretes: site.build_settings?.stop_builds === true, brancheAutorisee: site.build_settings?.allowed_branches, deployPreviewsDesactivees: site.build_settings?.skip_prs === true, deployServi: site.published_deploy?.id || null, verrouille: !!site.published_deploy?.locked });
  }
  return lignes;
}

// ----------------------------------------------------------------- etat ---
export async function etat(d) {
  const registre = await lireRegistre(d.racine).catch((e) => ({ erreur: e.message }));
  const gardes = await garde(d);
  const composants = [];
  for (const [nom, def] of Object.entries(COMPOSANTS)) {
    const site = await d.api.site(def.netlifyId);
    const servi = site.published_deploy?.id ? await d.api.deploiement(site.published_deploy.id) : null;
    const liste = await d.api.deploiements(def.netlifyId, { parPage: 50 });
    const preprod = liste.find((x) => x.state === "ready" && String(x.title || "").startsWith("preproduction · "));
    const inscrit = registre.composants?.[nom];
    const divergences = [];
    if (inscrit && servi && inscrit.deployId !== servi.id) divergences.push(`servi ${servi.id} ≠ registre ${inscrit.deployId}`);
    if (!inscrit) divergences.push("absent du registre");
    composants.push({
      composant: nom,
      servi: servi && { deployId: servi.id, commit: servi.commit_ref, contexte: servi.context, publieLe: servi.published_at, titre: String(servi.title || "").split("\n")[0].slice(0, 90) },
      registre: inscrit && { version: inscrit.version, commit: inscrit.commit, deployId: inscrit.deployId, statut: inscrit.statut },
      preproduction: preprod && { deployId: preprod.id, titre: preprod.title, url: urlAlias(def, environnement("preproduction").alias), permalien: urlPermalien(def, preprod.id) },
      divergences,
    });
  }
  return { registre: registre.erreur ? registre.erreur : "lisible", gardes, composants };
}

// ------------------------------------------------------- preproduction ---
export async function preproduction(d, { ref = "main", composants: liste = "application" } = {}) {
  const env = environnement("preproduction");
  const noms = composantsDemandes(liste);
  if (noms.includes("mcp")) throw new Refus("MCP : aucune préproduction possible sur le projet existant — ses fonctions recevraient les secrets de production (servis à tous les contextes). Préparer d'abord le projet de test décrit dans docs/PUBLICATION.md.");
  try { d.git.rafraichir(ref); } catch { /* référence locale ou SHA */ }
  let sha;
  try { sha = d.git.sha(`origin/${ref}`); } catch { sha = d.git.sha(ref); }
  verifierMecanisme(d.git, sha);
  const resultats = [];
  for (const nom of noms) {
    const def = COMPOSANTS[nom];
    const empreinte = empreinteComposant(d.git, sha, nom);
    const titre = titrePreproduction(sha, nom, empreinteRecette(empreinte, env.nom));
    const productionAvant = (await d.api.site(def.netlifyId)).published_deploy?.id;
    const existants = await d.api.deploiements(def.netlifyId, { parPage: 100 });
    let depot = retrouverCandidat(existants, { titre, empreinte: empreinteRecette(empreinte, env.nom) });
    let reutilise = !!depot && depot.state === "ready";
    const aliasCourant = await d.lire(`${urlAlias(def, env.alias)}/version.json`, { tentatives: 1 });
    // Même commit et mêmes entrées déjà servis sous l'alias : aucun nouveau dépôt.
    if (reutilise && aliasCourant.donnees?.commit === sha) {
      d.journal(`${nom} : candidat déjà servi sous l'alias (${depot.id}) — aucun nouveau dépôt`);
    } else {
      if (d.essai) { resultats.push({ composant: nom, sha, plan: reutilise ? "réaliasage nécessaire : redépôt" : "construction et dépôt" }); continue; }
      const construction = await d.construire({ git: d.git, sha, composant: nom, nomEnv: env.nom, avecFonctions: false, journal: d.journal });
      try {
        depot = await deposerBrouillon({ api: d.api, siteId: def.netlifyId, dossier: construction.dossier, fonctions: null, titre, alias: env.alias, journal: d.journal, attendre: d.attendre });
      } finally { await construction.nettoyer(); }
      reutilise = false;
    }
    const attendu = { composant: nom, environnement: env.nom, commit: sha };
    const surAlias = await verifierVersion(d.lire, urlAlias(def, env.alias), attendu);
    const surPermalien = await verifierVersion(d.lire, urlPermalien(def, depot.id), attendu);
    const controles = await controlesComposant(d.lire, nom, urlPermalien(def, depot.id), env.nom);
    const productionApres = (await d.api.site(def.netlifyId)).published_deploy?.id;
    const ok = surAlias.ok && surPermalien.ok && controles.ok && productionAvant === productionApres;
    resultats.push({
      composant: nom, sha, deployId: depot.id, reutilise, url: urlAlias(def, env.alias), permalien: urlPermalien(def, depot.id),
      empreinte, verification: ok ? "vérifiée" : "ÉCHEC", details: [surAlias, surPermalien, ...controles.resultats].filter((x) => !x.ok).map((x) => x.detail || x.nom),
      productionInchangee: productionAvant === productionApres ? productionAvant : `${productionAvant} → ${productionApres}`,
    });
  }
  return resultats;
}

// ------------------------------------------------------------ preparer ---
export async function preparer(d, { version, date = d.maintenant().slice(0, 10) } = {}) {
  if (!REGEX_VERSION.test(version || "")) throw new Refus(`Version « ${version} » invalide : format MAJEUR.MINEUR.CORRECTIF[-rc.N] attendu.`);
  if (d.git.tag(`v${version}`)) throw new Refus(`Le tag v${version} existe déjà : choisir une autre version (un tag ne se déplace jamais).`);
  const cheminChangelog = path.join(d.racine, "CHANGELOG.md");
  const changelog = await readFile(cheminChangelog, "utf8");
  if (changelog.includes(`## [${version}]`)) throw new Refus(`CHANGELOG.md contient déjà une section [${version}].`);
  const aVenir = /## À venir\n([\s\S]*?)(?=\n## |$)/.exec(changelog);
  if (!aVenir || !aVenir[1].trim() || !/^- /m.test(aVenir[1])) throw new Refus("CHANGELOG.md : la section « À venir » est vide. Rien à publier sous une nouvelle version.");
  const vide = "## À venir\n\n### Nouveautés\n\n### Corrections\n\n### Incompatibilités\n";
  const nouveau = changelog.replace(aVenir[0], `${vide}\n## [${version}] — ${date}\n${aVenir[1].replace(/\n### [^\n]+\n(?=\n*(### |$))/g, "\n")}`);
  await writeFile(cheminChangelog, nouveau);
  await writeFile(path.join(d.racine, "publication", "version.json"), JSON.stringify({ version }, null, 2) + "\n");
  return { version, date, fichiers: ["publication/version.json", "CHANGELOG.md"] };
}

// ---------------------------------------------------------- production ---
export async function production(d, { version, commit, composants: liste, essai = false, brouillon = false, sansRecette = null, accord = null } = {}) {
  const refus = [];
  const plan = { version, commit, composants: [], refus };
  if (!REGEX_VERSION.test(version || "")) throw new Refus(`Version « ${version} » invalide.`);
  if (!/^[0-9a-f]{40}$/.test(commit || "")) throw new Refus("--commit doit être un SHA complet de 40 caractères (jamais une branche mobile).");

  // 1. Le SHA doit appartenir à origin/main fraîchement relu.
  d.git.rafraichir("main");
  const main = d.git.sha("origin/main");
  let sha;
  try { sha = d.git.sha(commit); } catch { throw new Refus(`Commit ${court(commit)} inconnu localement après rafraîchissement.`); }
  if (!d.git.contient(sha, main)) refus.push(`le commit ${court(sha)} n'appartient pas à origin/main (${court(main)})`);

  // 2. Version déclarée, changelog, tag.
  const declaree = (() => { try { return JSON.parse(d.git.fichier(sha, "publication/version.json") || "null")?.version; } catch { return null; } })();
  if (declaree !== version) refus.push(`la version déclarée au commit est « ${declaree ?? "absente"} », pas ${version} (lancer « preparer » puis fusionner)`);
  if (!(d.git.fichier(sha, "CHANGELOG.md") || "").includes(`## [${version}]`)) refus.push(`CHANGELOG.md n'a pas de section [${version}] à ce commit`);
  const tag = d.git.tag(`v${version}`);
  if (tag && tag !== sha) refus.push(`le tag v${version} existe déjà sur un autre commit (${court(tag)}) — un tag ne se déplace jamais`);

  // 3. Verdict CI sur le SHA exact.
  const verdict = await d.verdict(sha);
  plan.verdict = verdict;
  if (!verdict.ok) refus.push(`CI : ${verdict.raison}`);

  // 6. Garde-fous : aucune voie de publication automatique active, aucun verrou.
  const gardes = await garde(d);
  plan.gardes = gardes;
  for (const g of gardes) {
    if (!g.buildsGitArretes) refus.push(`${g.projet} : builds Git encore actifs — une fusion dans main pourrait publier (lancer « garde --arreter »)`);
    if (g.verrouille) refus.push(`${g.projet} : déploiement servi verrouillé — déverrouillage explicite requis`);
  }

  // Registre et périmètre : comparaison à la production réellement servie.
  const registre = await lireRegistre(d.racine);
  const demandes = composantsDemandes(liste);
  for (const nom of demandes) {
    const def = COMPOSANTS[nom];
    const empreinte = empreinteComposant(d.git, sha, nom);
    const inscrit = registre.composants[nom];
    const site = await d.api.site(def.netlifyId);
    const serviId = site.published_deploy?.id;
    if (inscrit && serviId !== inscrit.deployId) refus.push(`${nom} : production servie (${serviId}) ≠ registre (${inscrit.deployId}) — relevé et réconciliation nécessaires`);
    const inchange = inscrit?.empreinte === empreinte;
    const entree = { composant: nom, empreinte, decision: inchange ? "inchangé" : (inscrit?.empreinte ? "modifié" : "différence impossible à établir : publication prudente") };
    // 4. Recette : préproduction vérifiée du même contenu.
    if (!inchange) {
      if (sansRecette) entree.recette = { exception: sansRecette };
      else {
        const recette = await chercherRecette(d, nom, empreinte);
        entree.recette = recette;
        if (!recette.ok) refus.push(`${nom} : ${recette.raison}`);
      }
    }
    plan.composants.push(entree);
  }
  const aPublier = plan.composants.filter((c) => c.decision !== "inchangé");
  if (!aPublier.length) refus.push("aucun composant modifié par rapport à la production servie : rien à publier");

  // 7. Accord explicite portant sur version, SHA et composants.
  if (!essai && !brouillon) {
    if (!accord) refus.push("feu vert de Quentin absent (--accord « citation exacte »)");
    else {
      if (!accord.includes(version) || !accord.includes(sha.slice(0, 12))) refus.push("l'accord cité ne mentionne pas la version et le SHA (12 caractères au moins) de ce candidat");
      for (const c of aPublier) if (!accord.toLowerCase().includes(c.composant === "mcp" ? "mcp" : "application")) refus.push(`l'accord cité ne mentionne pas le composant « ${c.composant} »`);
    }
  }
  if (sansRecette && !(typeof sansRecette === "string" && sansRecette.trim().length >= 10)) refus.push("--sans-recette exige une raison explicite (10 caractères au moins)");

  if (essai) return { ...plan, mode: "essai", verdictFinal: refus.length ? "REFUSÉ" : "prêt" };
  // Le brouillon de production est permis sans feu vert, mais jamais sur un
  // candidat refusé pour une autre raison que l'accord.
  const bloquants = refus.filter((r) => !r.startsWith("feu vert") && !r.startsWith("l'accord"));
  if (brouillon ? bloquants.length : refus.length) throw new Refus(`Publication refusée :\n- ${(brouillon ? bloquants : refus).join("\n- ")}`);

  const liberer = await prendreVerrou(d.racine, `production v${version}`);
  try {
    for (const c of aPublier) {
      const def = COMPOSANTS[c.composant];
      const titre = titreProduction(version, sha, c.composant, c.empreinte);
      const existants = await d.api.deploiements(def.netlifyId, { parPage: 100 });
      let depot = retrouverCandidat(existants, { titre, empreinte: c.empreinte });
      if (!depot) {
        const construction = await d.construire({ git: d.git, sha, composant: c.composant, nomEnv: "production", avecFonctions: true, journal: d.journal });
        try {
          depot = await deposerBrouillon({ api: d.api, siteId: def.netlifyId, dossier: construction.dossier, fonctions: construction.fonctions, titre, alias: null, journal: d.journal, attendre: d.attendre });
        } finally { await construction.nettoyer(); }
        await journaliser(d.racine, { operation: "brouillon-production", version, sha, composant: c.composant, deployId: depot.id, empreinte: c.empreinte });
      }
      c.deployId = depot.id;
      const attendu = { composant: c.composant, environnement: "production", commit: sha, version };
      const vVersion = await verifierVersion(d.lire, urlPermalien(def, depot.id), attendu);
      const vControles = await controlesComposant(d.lire, c.composant, urlPermalien(def, depot.id), "production");
      c.brouillon = { ok: vVersion.ok && vControles.ok, details: [vVersion, ...vControles.resultats].filter((x) => !x.ok).map((x) => x.detail || x.nom), permalien: urlPermalien(def, depot.id) };
      if (!c.brouillon.ok) throw new Refus(`${c.composant} : brouillon de production ${depot.id} non conforme (${c.brouillon.details.join(" ; ")}). Aucune promotion.`);
    }
    if (brouillon) return { ...plan, mode: "brouillon", verdictFinal: "brouillons vérifiés, rien promu" };

    // Promotion des MÊMES artefacts vérifiés, composant par composant ; chaque
    // résultat est conservé immédiatement.
    let courant = registre;
    for (const c of aPublier) {
      const def = COMPOSANTS[c.composant];
      await d.api.publier(def.netlifyId, c.deployId);
      await journaliser(d.racine, { operation: "promotion", version, sha, composant: c.composant, deployId: c.deployId });
      const v = await verifierVersion(d.lire, urlProduction(c.composant), { composant: c.composant, environnement: "production", commit: sha, version }, { tentatives: 8 });
      const servi = (await d.api.site(def.netlifyId)).published_deploy?.id;
      const statut = v.ok && servi === c.deployId ? "publie-verifie" : (servi === c.deployId ? "publie-verification-incertaine" : "publie-verification-echouee");
      c.statut = statut;
      courant = enregistrer(courant, {
        date: d.maintenant(), type: "publication", version, composant: c.composant, deployId: c.deployId, commit: sha, statut,
        accord: accord || null, sansRecette: c.recette?.exception || null, recette: c.recette?.deployId || null, verdict: plan.verdict.url || null,
        etat: { version, commit: sha, empreinte: c.empreinte, deployId: c.deployId, publieLe: d.maintenant(), statut, controles: v.ok ? "version.json conforme" : (v.detail || "échec") },
      });
      await ecrireRegistreLocal(d.racine, courant);
      await journaliser(d.racine, { operation: "registre", composant: c.composant, statut });
    }
    for (const c of plan.composants.filter((x) => x.decision === "inchangé")) {
      courant = enregistrer(courant, { date: d.maintenant(), type: "inchange", version, composant: c.composant, commit: sha, statut: "inchange", note: `conserve ${courant.composants[c.composant].version} (${courant.composants[c.composant].deployId})` });
    }
    await ecrireRegistreLocal(d.racine, courant);
    plan.registre = await d.committerRegistre(serialiser(courant), `Registre : v${version} publiée (${aPublier.map((c) => c.composant).join(", ")}) — Ref #544`);
    if (aPublier.every((c) => c.statut === "publie-verifie")) {
      plan.tag = await d.creerTagEtRelease({ version, sha, plan });
    } else {
      plan.tag = "non créé : vérification de production incomplète — voir le registre";
    }
    return { ...plan, mode: "production", verdictFinal: "publié" };
  } finally { await liberer(); }
}

async function chercherRecette(d, nom, empreinte) {
  const def = COMPOSANTS[nom];
  const recette = empreinteRecette(empreinte, "preproduction");
  const liste = await d.api.deploiements(def.netlifyId, { parPage: 100 });
  const candidat = liste.find((x) => x.state === "ready" && String(x.title || "").startsWith("preproduction · ") && String(x.title).includes(`empreinte:${recette.slice(0, 16)}`));
  if (!candidat) return { ok: false, raison: "aucune préproduction du même contenu (lancer « preproduction » sur ce contenu, ou --sans-recette motivé)" };
  const sha = String(candidat.title).split(" · ")[1];
  const v = await verifierVersion(d.lire, urlPermalien(def, candidat.id), { composant: nom, environnement: "preproduction", commit: sha }, { tentatives: 2 });
  return v.ok ? { ok: true, deployId: candidat.id, commit: sha, permalien: urlPermalien(def, candidat.id) } : { ok: false, raison: `préproduction ${candidat.id} non vérifiable (${v.detail})` };
}

// --------------------------------------------------------------- retour ---
export async function retour(d, { version, sites, essai = false } = {}) {
  const registre = await lireRegistre(d.racine);
  const noms = composantsDemandes(sites);
  const cibles = [];
  for (const nom of noms) {
    const candidats = [
      ...registre.historique.filter((e) => e.composant === nom && e.deployId && e.version === version && ["publication", "initial", "retour"].includes(e.type)),
    ];
    const cible = candidats[candidats.length - 1];
    if (!cible) throw new Refus(`${nom} : aucune publication connue de la version « ${version} » dans le registre.`);
    cibles.push({ composant: nom, deployId: cible.deployId, commit: cible.commit, version });
  }
  if (essai) return { mode: "essai", cibles };
  const liberer = await prendreVerrou(d.racine, `retour ${version}`);
  try {
    let courant = registre;
    for (const c of cibles) {
      const def = COMPOSANTS[c.composant];
      await d.api.publier(def.netlifyId, c.deployId);
      await journaliser(d.racine, { operation: "retour", ...c });
      const servi = (await d.api.site(def.netlifyId)).published_deploy?.id;
      const page = await d.lire(`${urlProduction(c.composant)}/${c.composant === "mcp" ? "health" : ""}`, { json: c.composant === "mcp", tentatives: 6 });
      c.statut = servi === c.deployId && page.statut === 200 ? "retour-verifie" : "retour-verification-echouee";
      courant = enregistrer(courant, {
        date: d.maintenant(), type: "retour", version, composant: c.composant, deployId: c.deployId, commit: c.commit, statut: c.statut,
        etat: { ...courant.composants[c.composant], version, commit: c.commit, deployId: c.deployId, publieLe: d.maintenant(), statut: c.statut, empreinte: registre.historique.filter((e) => e.deployId === c.deployId && e.etat?.empreinte).pop()?.etat.empreinte || null },
      });
      await ecrireRegistreLocal(d.racine, courant);
    }
    const registreCommit = await d.committerRegistre(serialiser(courant), `Registre : retour à ${version} (${noms.join(", ")}) — Ref #544`);
    return { mode: "retour", cibles, registre: registreCommit };
  } finally { await liberer(); }
}

export { urlAlias, urlPermalien, urlSite };
