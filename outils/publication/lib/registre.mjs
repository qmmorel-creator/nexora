// Registre des publications officielles — Ref #544.
//
// `publication/registre.json` est écrit UNIQUEMENT par l'outil. Il indique la
// production réellement servie, composant par composant ; `main` peut contenir
// du code pas encore publié. Les préproductions n'y figurent pas : leur
// historique est celui de Netlify. Aucun jeton, aucune donnée personnelle,
// aucune valeur de variable.
import { readFile, writeFile, mkdir, appendFile, open, rm } from "node:fs/promises";
import path from "node:path";

export const CHEMIN_REGISTRE = "publication/registre.json";
export const DOSSIER_JOURNAL = "publication/.journal";

const STATUTS = ["publie-verifie", "inchange", "publie-verification-echouee", "publie-verification-incertaine", "retour-verifie", "retour-verification-echouee", "initial-non-versionne"];

export function validerRegistre(r) {
  const erreurs = [];
  if (!r || r.format !== 1) erreurs.push("format absent ou inconnu");
  for (const [nom, c] of Object.entries(r?.composants || {})) {
    if (!/^[0-9a-f]{40}$/.test(c.commit || "")) erreurs.push(`${nom} : commit invalide`);
    if (!/^[0-9a-f]{24}$/.test(c.deployId || "")) erreurs.push(`${nom} : Deploy ID invalide`);
    if (!STATUTS.includes(c.statut)) erreurs.push(`${nom} : statut inconnu « ${c.statut} »`);
  }
  if (!Array.isArray(r?.historique)) erreurs.push("historique absent");
  const texte = JSON.stringify(r || {});
  if (/nfp_|Bearer |PRIVATE KEY|"token"|@gmail\.com/i.test(texte)) erreurs.push("contenu interdit (jeton, clé ou adresse personnelle)");
  if (erreurs.length) throw new Error(`Registre incohérent : ${erreurs.join(" ; ")}. Aucune publication tant qu'il n'est pas réconcilié.`);
  return r;
}

export async function lireRegistre(racine) {
  let brut;
  try { brut = await readFile(path.join(racine, CHEMIN_REGISTRE), "utf8"); }
  catch { throw new Error(`${CHEMIN_REGISTRE} absent : aucune publication ne se fait sans registre (jamais de repli silencieux sur main).`); }
  return validerRegistre(JSON.parse(brut));
}

export function registreDepuisTexte(texte) { return validerRegistre(JSON.parse(texte)); }

// Mise à jour ciblée d'un composant + ajout à l'historique.
export function enregistrer(registre, evenement) {
  const r = structuredClone(registre);
  r.historique.push(evenement);
  if (evenement.composant && evenement.etat) {
    r.composants[evenement.composant] = { ...evenement.etat, precedent: registre.composants[evenement.composant] ? {
      version: registre.composants[evenement.composant].version,
      commit: registre.composants[evenement.composant].commit,
      deployId: registre.composants[evenement.composant].deployId,
    } : null };
  }
  return validerRegistre(r);
}

export const serialiser = (r) => JSON.stringify(r, null, 2) + "\n";

// Journal de reprise local (hors Git) : chaque résultat y est conservé AVANT
// toute écriture distante, pour qu'un échec réseau ne fasse jamais croire que
// rien n'a été publié.
export async function journaliser(racine, entree) {
  const dossier = path.join(racine, DOSSIER_JOURNAL);
  await mkdir(dossier, { recursive: true });
  await appendFile(path.join(dossier, "reprise.jsonl"), JSON.stringify({ date: new Date().toISOString(), ...entree }) + "\n");
}

export async function lireJournal(racine) {
  try {
    return (await readFile(path.join(racine, DOSSIER_JOURNAL, "reprise.jsonl"), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

// Verrou exclusif : production, retour et écritures du registre sont sérialisés.
export async function prendreVerrou(racine, operation) {
  const dossier = path.join(racine, DOSSIER_JOURNAL);
  await mkdir(dossier, { recursive: true });
  const chemin = path.join(dossier, "verrou");
  let fd;
  try { fd = await open(chemin, "wx"); }
  catch {
    const detenteur = await readFile(chemin, "utf8").catch(() => "?");
    throw new Error(`Une opération de publication est déjà en cours (${detenteur.trim()}). Attendre sa fin ; ne jamais forcer. Si elle est morte, vérifier « etat » puis supprimer ${path.relative(racine, chemin)}.`);
  }
  await fd.writeFile(`${operation} pid=${process.pid} ${new Date().toISOString()}\n`);
  await fd.close();
  return async () => { await rm(chemin, { force: true }); };
}

export async function ecrireRegistreLocal(racine, registre) {
  await writeFile(path.join(racine, CHEMIN_REGISTRE), serialiser(registre));
}
