// Phrase (Ref #708) : copie de apps/nexora-futur/src/donnees/phrase.ts (Ref #679),
// sans changement de règle (seuls les messages d'erreur ne citent plus nexora-project,
// la finance pouvant être lue en direct, #721). La question est une phrase dont chaque mot se change ;
// la réponse (grand chiffre et détail) est recalculée sur les vraies données.
// Fonctions pures : le composant fournit les lectures relayées (budget, sport).
import { ajouterJours, estEnRetard, estProjetCalendrier, estTerminee, type Catalogues, type Tache } from "./modele";
import { capacite, planDeCharge, type MembreEquipe } from "./equipe";
import { etatsDuJour, type EntreeHabitude, type NonApplicable, type ThemeHabitudes } from "./habitudes";
import { couleurSport, filtrer, nomsSports, seriesEmpilees, type Activite, type PeriodeSport } from "./sport";
import { decalerMois, type SyntheseBudget } from "./finance";

export type Quoi = "taches" | "depenses" | "sport" | "charge" | "habitudes";
export type Phrase = Record<string, string> & { quoi: Quoi };
export interface Vue { id: string; nom: string; ph: Phrase; }
export interface PrefsPhrase { vues: Vue[]; tuiles: Phrase[]; }
export const PHRASE_VIDE: PrefsPhrase = { vues: [], tuiles: [] };
export const MAX_TUILES = 6;

type Mot = string | { k: string };
export const MODELES: Record<Quoi, { mots: Mot[]; couleur: string; espace: string }> = {
  taches: { mots: ["Montre", { k: "quoi" }, { k: "etat" }, "de", { k: "qui" }, "sur", { k: "ou" }], couleur: "#2C6BE0", espace: "Chantiers" },
  depenses: { mots: ["Montre", { k: "quoi" }, "en", { k: "cat" }, "sur", { k: "per" }], couleur: "#1F9D6B", espace: "Finances" },
  sport: { mots: ["Montre", { k: "quoi" }, ":", { k: "act" }, "sur", { k: "perS" }], couleur: "#D9822B", espace: "Corps" },
  charge: { mots: ["Montre", { k: "quoi" }, "de", { k: "qui2" }, "sur", { k: "horizon" }], couleur: "#7A5AF8", espace: "Équipe" },
  habitudes: { mots: ["Montre", { k: "quoi" }, "sur", { k: "perH" }], couleur: "#D9822B", espace: "Corps" },
};
export const QUOIS = Object.keys(MODELES) as Quoi[];
export const DEFAUTS: Phrase = { quoi: "taches", etat: "retard", qui: "tous", ou: "tous", cat: "toutes", per: "mois", act: "toutes", perS: "week", qui2: "equipe", horizon: "7", perH: "14" };
export const slots = (ph: Phrase) => MODELES[ph.quoi].mots.filter((m): m is { k: string } => typeof m !== "string").map((m) => m.k);

export interface Contexte extends Catalogues {
  taches: Tache[]; aujourdhui: string; membresEquipe: MembreEquipe[];
  themesHabitudes: ThemeHabitudes[]; journalHabitudes: EntreeHabitude[]; nonApplicables: NonApplicable[];
  sport: Activite[] | null | "erreur";
  budget: (mois: string) => SyntheseBudget | null | "erreur";
}

export type Option = [string, string];
const personnes = (c: Contexte) => [...new Set(c.membres.map((m) => m.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
export function options(k: string, c: Contexte): Option[] {
  switch (k) {
    case "quoi": return [["taches", "les tâches"], ["depenses", "mes dépenses"], ["sport", "mon sport"], ["charge", "la charge"], ["habitudes", "mes habitudes"]];
    case "etat": return [["retard", "en retard"], ["semaine", "à faire cette semaine"], ["ouvertes", "ouvertes"], ["faites", "terminées"]];
    case "qui": return [["tous", "tout le monde"], ...personnes(c).map((n): Option => [n, n])];
    case "ou": return [["tous", "tous les projets"], ...c.projets.filter((p) => !estProjetCalendrier(c.projets, p.id)).map((p): Option => [p.id, p.name || p.id])];
    case "cat": { const b = c.budget(c.aujourdhui.slice(0, 7)); const cats = b && b !== "erreur" ? (b.catalogs?.categories?.map((x) => x.name) || b.tracking.map((x) => x.category)) : [];
      return [["toutes", "toutes catégories"], ...[...new Set(cats)].map((n): Option => [n, n.toLowerCase()])]; }
    case "per": return [["mois", "ce mois"], ["dernier", "le mois dernier"], ["trois", "les 3 derniers mois"]];
    case "act": return [["toutes", "toutes les activités"], ...(Array.isArray(c.sport) ? nomsSports(c.sport) : []).map((n): Option => [n, n.toLowerCase()])];
    case "perS": return [["week", "cette semaine"], ["month", "ce mois"], ["year", "cette année"]];
    case "qui2": return [["equipe", "l'équipe"], ...personnes(c).map((n): Option => [n, n])];
    case "horizon": return [["7", "les 7 prochains jours"], ["14", "les 14 prochains jours"], ["30", "les 30 prochains jours"]];
    case "perH": return [["7", "les 7 derniers jours"], ["14", "les 14 derniers jours"], ["30", "les 30 derniers jours"]];
  }
  return [];
}
export const libelle = (k: string, v: string, c: Contexte) => (options(k, c).find((o) => o[0] === v) || [v, v])[1];
export const texte = (ph: Phrase, c: Contexte) => MODELES[ph.quoi].mots.map((m) => (typeof m === "string" ? m : libelle(m.k, ph[m.k] ?? DEFAUTS[m.k], c))).join(" ");
export const nomPropose = (ph: Phrase, c: Contexte) => { const t = texte(ph, c).replace(/^Montre /, ""); return t.charAt(0).toUpperCase() + t.slice(1); };
// Deux phrases sont la même question si leurs mots utiles coïncident.
export const cle = (ph: Phrase) => [ph.quoi, ...slots(ph).filter((k) => k !== "quoi").map((k) => ph[k] ?? DEFAUTS[k])].join("|");
// Changer « quoi » repart des mots par défaut du nouveau modèle.
export const choisir = (ph: Phrase, k: string, v: string): Phrase => (k === "quoi" ? { ...DEFAUTS, quoi: v as Quoi } : { ...ph, [k]: v });

export type Detail =
  | { type: "attente"; message: string }
  | { type: "taches"; lignes: { id: string; titre: string; projet: string; couleur: string; qui: string; fin: string; ton: "crit" | "ok" | "neutre" }[]; enPlus: number }
  | { type: "categories"; lignes: { nom: string; couleur: string; reel: number; budget: number }[]; total: number; budget: number }
  | { type: "colonnes"; colonnes: { libelle: string; segments: { nom: string; couleur: string; valeur: number }[] }[]; legende: { nom: string; couleur: string }[]; unite: string }
  | { type: "grille"; lignes: { nom: string; couleur: string; cases: { t: number; titre: string }[]; droite: string }[] };
export interface Reponse { couleur: string; chiffre: string; phrase: string; detail: Detail; }

const euros = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`.replace(/^-0 €$/, "0 €");
const heures = (min: number) => { const m = Math.round(min); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
const pluriel = (n: number, s: string) => `${s}${n > 1 ? "s" : ""}`;

export function calcul(ph: Phrase, c: Contexte): Reponse {
  const couleur = MODELES[ph.quoi].couleur; const v = (k: string) => ph[k] ?? DEFAUTS[k]; const jour = c.aujourdhui;
  if (ph.quoi === "taches") {
    const fin7 = ajouterJours(jour, 6);
    const l = c.taches.filter((t) => !estProjetCalendrier(c.projets, t.projectId) && (v("qui") === "tous" || t.assignee === v("qui")) && (v("ou") === "tous" || t.projectId === v("ou")))
      .filter((t) => { const fini = estTerminee(t, c.statuts); const e = v("etat");
        return e === "retard" ? estEnRetard(t, c.statuts, jour) : e === "faites" ? fini : e === "semaine" ? !fini && !!t.end && t.end >= jour && t.end <= fin7 : !fini; })
      .sort((a, b) => (a.end || "9999").localeCompare(b.end || "9999"));
    const parQui = new Map<string, number>(); l.forEach((t) => t.assignee && parQui.set(t.assignee, (parQui.get(t.assignee) || 0) + 1));
    const top = [...parQui.entries()].sort((a, b) => b[1] - a[1])[0];
    const projet = (t: Tache) => c.projets.find((p) => p.id === t.projectId);
    return { couleur, chiffre: String(l.length), phrase: l.length ? `${pluriel(l.length, "tâche")}${top && v("qui") === "tous" && l.length > 1 ? `, dont ${top[1]} pour ${top[0]}` : ""}` : "rien à signaler",
      detail: { type: "taches", enPlus: Math.max(0, l.length - 40), lignes: l.slice(0, 40).map((t) => ({ id: t.id, titre: t.title || "Sans titre", projet: projet(t)?.name || "Sans projet", couleur: projet(t)?.color || "#7A8290", qui: t.assignee || "", fin: t.end || "",
        ton: estEnRetard(t, c.statuts, jour) ? "crit" : estTerminee(t, c.statuts) ? "ok" : "neutre" })) } };
  }
  if (ph.quoi === "depenses") {
    const m0 = jour.slice(0, 7); const mois = v("per") === "mois" ? [m0] : v("per") === "dernier" ? [decalerMois(m0, -1)] : [decalerMois(m0, -2), decalerMois(m0, -1), m0];
    const lus = mois.map((m) => c.budget(m));
    if (lus.some((x) => x === "erreur")) return { couleur, chiffre: "—", phrase: "budget illisible", detail: { type: "attente", message: "Le budget n'a pas pu être lu." } };
    if (lus.some((x) => x === null)) return { couleur, chiffre: "…", phrase: "lecture du budget", detail: { type: "attente", message: "Lecture du budget…" } };
    const cats = new Map<string, { nom: string; couleur: string; reel: number; budget: number }>();
    (lus as SyntheseBudget[]).forEach((s) => s.tracking.forEach((x) => { const y = cats.get(x.category) || { nom: x.category, couleur: x.color || "#7A8290", reel: 0, budget: 0 }; y.reel += x.actual; y.budget += x.budget; cats.set(x.category, y); }));
    const lignes = [...cats.values()].filter((x) => v("cat") === "toutes" || x.nom === v("cat")).filter((x) => x.reel || x.budget).sort((a, b) => b.reel - a.reel);
    const total = lignes.reduce((s, x) => s + x.reel, 0), budget = lignes.reduce((s, x) => s + x.budget, 0);
    return { couleur, chiffre: euros(total), phrase: budget ? `dépensés sur ${euros(budget)} budgétés${total > budget ? ", budget dépassé" : `, il reste ${euros(budget - total)}`}` : "dépensés, sans budget défini",
      detail: { type: "categories", lignes, total, budget } };
  }
  if (ph.quoi === "sport") {
    if (c.sport === "erreur") return { couleur, chiffre: "—", phrase: "journal sportif illisible", detail: { type: "attente", message: "Le journal sportif n'a pas pu être lu." } };
    if (!c.sport) return { couleur, chiffre: "…", phrase: "lecture du sport", detail: { type: "attente", message: "Lecture du journal sportif…" } };
    const per = v("perS") as PeriodeSport; const sports = v("act") === "toutes" ? [] : [v("act")]; const ordre = nomsSports(c.sport);
    const rows = filtrer(c.sport, per, jour, sports); const minutes = rows.reduce((s, r) => s + (typeof r.total === "number" ? r.total : 0), 0);
    const s = seriesEmpilees(c.sport, { periode: per, mesure: "total", regroupement: per === "week" ? "day" : per === "month" ? "week" : "month", sports }, jour, ordre);
    return { couleur, chiffre: heures(minutes), phrase: `${rows.length} ${pluriel(rows.length, "séance")} ${libelle("perS", per, c)}`,
      detail: { type: "colonnes", unite: "h", legende: s.sports.map((x) => ({ nom: x.name, couleur: couleurSport(x.name, ordre) })),
        colonnes: s.barres.map((b) => ({ libelle: b.label, segments: s.sports.map((x) => ({ nom: x.name, couleur: couleurSport(x.name, ordre), valeur: b.values[x.name] || 0 })).filter((x) => x.valeur > 0) })) } };
  }
  if (ph.quoi === "charge") {
    const n = Number(v("horizon")) || 7; const noms = v("qui2") === "equipe" ? personnes(c) : [v("qui2")];
    let depas = 0;
    const lignes = noms.map((nom) => {
      const cap = capacite(c.membresEquipe.find((m) => m.name === nom)?.capacityPerDay);
      const plan = planDeCharge(c.taches, c.statuts, nom, jour, n); const au = plan.filter((x) => x.nb > cap).length; depas += au;
      return { nom, couleur: au ? "#BE2F22" : MODELES.charge.couleur, droite: `${plan.reduce((s, x) => s + x.nb, 0)} tâche-jours`, cases: plan.map((x) => ({ t: x.nb > cap ? -1 : x.nb / cap, titre: `${x.jour} : ${x.nb} / ${cap}` })) };
    });
    return { couleur, chiffre: String(depas), phrase: `${pluriel(depas, "jour")}-personne au-delà de la capacité sur ${n} jours`, detail: { type: "grille", lignes } };
  }
  const n = Number(v("perH")) || 14; const jours = Array.from({ length: n }, (_, i) => ajouterJours(jour, i - n + 1));
  const etats = jours.map((j) => etatsDuJour(c.themesHabitudes, c.journalHabitudes, c.nonApplicables, j));
  let faites = 0, applicables = 0;
  const lignes = c.themesHabitudes.flatMap((th) => th.habits.map((h) => {
    const cases = etats.map((e, i) => { const x = e.parTheme.flatMap((p) => p.habitudes).find((y) => y.h.id === h.id); const et = x?.etat || "a-faire";
      if (et !== "na") { applicables++; if (et === "fait") faites++; }
      return { t: et === "fait" ? 1 : et === "partiel" ? 0.5 : et === "na" ? -2 : 0, titre: `${jours[i]} : ${et === "fait" ? "fait" : et === "partiel" ? "partiel" : et === "na" ? "non applicable" : "à faire"}` }; });
    return { nom: h.name, couleur: h.color, cases, droite: `${cases.filter((x) => x.t === 1).length} / ${cases.filter((x) => x.t !== -2).length}` };
  }));
  return { couleur, chiffre: applicables ? `${Math.round((faites / applicables) * 100)} %` : "—", phrase: `des habitudes tenues sur ${n} jours`, detail: { type: "grille", lignes } };
}

// Préférences (dans Optim : clé nexora:optimPrefs, champ « phrase ») : vues et tuiles.
const valide = (x: unknown): Phrase | null => {
  if (!x || typeof x !== "object") return null; const b = x as Record<string, unknown>;
  if (!QUOIS.includes(b.quoi as Quoi)) return null;
  const ph: Phrase = { ...DEFAUTS, quoi: b.quoi as Quoi };
  Object.keys(DEFAUTS).forEach((k) => { if (typeof b[k] === "string" && b[k]) ph[k] = b[k] as string; });
  return ph;
};
export function normaliserPhrase(v: unknown): PrefsPhrase {
  if (!v || typeof v !== "object") return PHRASE_VIDE; const b = v as Record<string, unknown>;
  const vues = (Array.isArray(b.vues) ? b.vues : []).flatMap((x): Vue[] => { const o = x as Record<string, unknown>; const ph = valide(o?.ph);
    return ph && typeof o.id === "string" && typeof o.nom === "string" && o.nom.trim() ? [{ id: o.id, nom: o.nom.trim().slice(0, 120), ph }] : []; });
  const tuiles = (Array.isArray(b.tuiles) ? b.tuiles : []).map(valide).filter((x): x is Phrase => !!x).slice(-MAX_TUILES);
  return { vues, tuiles };
}
export const epingler = (p: PrefsPhrase, ph: Phrase): PrefsPhrase => (p.tuiles.some((t) => cle(t) === cle(ph)) ? p : { ...p, tuiles: [...p.tuiles, ph].slice(-MAX_TUILES) });
