// Dépôt d'une construction sur Netlify par l'API de hachage — Ref #544.
// Fichiers : SHA-1 ; fonctions : SHA-256 des archives. Seuls les éléments que
// Netlify ne possède pas déjà sont envoyés.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const sha = (algo, contenu) => createHash(algo).update(contenu).digest("hex");

export async function inventaire(dossier) {
  const fichiers = {};
  const contenus = new Map();
  async function parcourir(rep) {
    for (const e of await readdir(rep, { withFileTypes: true })) {
      const cible = path.join(rep, e.name);
      if (e.isDirectory()) { await parcourir(cible); continue; }
      const cle = "/" + path.relative(dossier, cible).split(path.sep).join("/");
      const contenu = await readFile(cible);
      fichiers[cle] = sha("sha1", contenu);
      contenus.set(cle, contenu);
    }
  }
  await parcourir(dossier);
  return { fichiers, contenus };
}

export async function inventaireFonctions(fonctions) {
  const empreintes = {};
  const archives = new Map();
  for (const f of fonctions || []) {
    const zip = await readFile(f.chemin);
    empreintes[f.nom] = sha("sha256", zip);
    archives.set(f.nom, { zip, f });
  }
  return { empreintes, archives };
}

export function parametresFonctions(fonctions) {
  if (!fonctions || !fonctions.length) return {};
  const config = {};
  for (const f of fonctions) {
    config[f.nom] = {
      ...(f.nomAffiche ? { display_name: f.nomAffiche } : {}),
      ...(f.generateur ? { generator: f.generateur } : {}),
      ...(f.donnees ? { build_data: f.donnees } : {}),
      ...(f.priorite !== null ? { priority: f.priorite } : {}),
      ...(f.routes.length ? { routes: f.routes.map((r) => ({ pattern: r.pattern, literal: r.literal, expression: r.expression, methods: r.methods, prefer_static: r.prefer_static })) } : {}),
      ...(f.routesExclues.length ? { excluded_routes: f.routesExclues } : {}),
    };
  }
  return {
    functions_config: config,
    function_schedules: fonctions.filter((f) => f.schedule).map((f) => ({ name: f.nom, cron: f.schedule })),
  };
}

// Crée un brouillon (draft: true) — jamais une publication directe. La
// promotion en production passe par `publier` sur ce même Deploy ID vérifié.
export async function deposerBrouillon({ api, siteId, dossier, fonctions, titre, alias, journal = () => {}, attendre = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const { fichiers, contenus } = await inventaire(dossier);
  const { empreintes, archives } = await inventaireFonctions(fonctions);
  const parametres = {
    draft: true, title: titre, files: fichiers,
    ...(fonctions ? { functions: empreintes, ...parametresFonctions(fonctions) } : {}),
    ...(alias ? { branch: alias } : {}),
  };
  journal(`création du brouillon (${Object.keys(fichiers).length} fichiers, ${Object.keys(empreintes).length} fonctions)`);
  const depot = await api.creerDeploiement(siteId, parametres);
  for (const cle of depot.required || []) {
    const chemin = Object.keys(fichiers).find((k) => fichiers[k] === cle);
    // Plusieurs fichiers identiques partagent un SHA : Netlify n'en demande qu'un.
    await api.envoyerFichier(depot.id, chemin, contenus.get(chemin));
  }
  for (const cle of depot.required_functions || []) {
    const nom = Object.keys(empreintes).find((k) => empreintes[k] === cle);
    const { zip, f } = archives.get(nom);
    await api.envoyerFonction(depot.id, nom, zip, { runtime: f.runtime, invocationMode: f.modeInvocation });
  }
  journal(`envoyés : ${(depot.required || []).length} fichiers, ${(depot.required_functions || []).length} fonctions ; attente de l'état ready`);
  return attendrePret({ api, deployId: depot.id, attendre });
}

export async function attendrePret({ api, deployId, attendre, delais = [1000, 2000, 3000, 5000, 5000, 10000, 10000, 15000, 15000, 30000, 30000, 60000] }) {
  for (const d of [0, ...delais]) {
    if (d) await attendre(d);
    const etat = await api.deploiement(deployId);
    if (etat.state === "ready") return etat;
    if (["error", "rejected"].includes(etat.state)) throw new Error(`Déploiement ${deployId} en état ${etat.state} : ${etat.error_message || "sans détail"}`);
  }
  throw new Error(`Déploiement ${deployId} toujours en cours après attente bornée : état incertain, relancer « etat » avant toute autre action.`);
}

// Retrouve un déploiement déjà créé pour ce candidat (reprise sans doublon).
// Le titre seul ne suffit pas : l'empreinte doit y figurer et le commit du
// titre doit être le SHA complet attendu.
export function retrouverCandidat(deploiements, { titre, empreinte }) {
  return (deploiements || []).find((d) => d.title === titre && typeof d.title === "string" && d.title.includes(empreinte.slice(0, 16)) && ["ready", "uploading", "uploaded", "processing", "prepared", "new"].includes(d.state)) || null;
}
