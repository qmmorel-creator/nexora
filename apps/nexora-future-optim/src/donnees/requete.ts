// Requête du Cockpit (Ref #655) : ce que montrent les puces et l'adresse.
// Elle se traduit en `Filtres` de nexora-project (un seul moteur), puis tri et
// regroupement (port de part-001:11610 et part-000:3195).
import { CRITICITES, estTerminee, inactiviteJours, type Catalogues, type Tache } from "./modele";
import { filtresParDefaut, type Condition, type Filtres } from "./filtres";

export type ChampTri = "none" | "title" | "start" | "end" | "progress" | "project" | "status" | "assignee" | "inactivity" | "criticality" | "dependsOn" | "referenceEnd" | "delta" | "delayRisks";
export const TRIS: { cle: ChampTri; libelle: string }[] = [
  { cle: "none", libelle: "Ordre manuel" }, { cle: "title", libelle: "Titre" }, { cle: "start", libelle: "Date de début" }, { cle: "end", libelle: "Date de fin" },
  { cle: "progress", libelle: "Avancement" }, { cle: "project", libelle: "Projet" }, { cle: "status", libelle: "Statut" }, { cle: "assignee", libelle: "Responsable" },
  { cle: "inactivity", libelle: "Durée d'inactivité" }, { cle: "criticality", libelle: "Criticité" }, { cle: "dependsOn", libelle: "Nombre de dépendances" },
  { cle: "referenceEnd", libelle: "Référence" }, { cle: "delta", libelle: "Écart à la référence" }, { cle: "delayRisks", libelle: "Nombre de risques" },
];
export type ChampGroupe = "aucun" | "status" | "project" | "criticality" | "taskType" | "assignee" | "milestone" | "focus" | "period";
export const GROUPES: { cle: ChampGroupe; libelle: string }[] = [
  { cle: "aucun", libelle: "Aucun" }, { cle: "status", libelle: "Statut" }, { cle: "project", libelle: "Projet" }, { cle: "criticality", libelle: "Criticité" },
  { cle: "taskType", libelle: "Type" }, { cle: "assignee", libelle: "Responsable" }, { cle: "milestone", libelle: "Jalon" }, { cle: "focus", libelle: "Focus" }, { cle: "period", libelle: "Mois d'échéance" },
];

export interface Requete {
  projets: string[]; statuts: string[]; responsables: string[]; types: string[]; criticites: string[];
  texte: string; terminees: boolean; retard: boolean; urgent: boolean; focus: "all" | "yes" | "no"; echeance: string;
  tri: { champ: ChampTri; sens: "asc" | "desc" }; groupe: ChampGroupe;
}
export const requeteParDefaut = (): Requete => ({ projets: [], statuts: [], responsables: [], types: [], criticites: [], texte: "", terminees: false, retard: false, urgent: false, focus: "all", echeance: "", tri: { champ: "end", sens: "asc" }, groupe: "status" });

export function versFiltres(r: Requete): Filtres {
  const items: Condition[] = [];
  const liste = (field: string, values: string[]) => { if (values.length) items.push({ field, mode: "is", values }); };
  liste("project", r.projets); liste("status", r.statuts); liste("assignee", r.responsables); liste("taskType", r.types); liste("criticality", r.criticites);
  return { ...filtresParDefaut(), search: r.texte, showDone: r.terminees, lateOnly: r.retard, urgentOnly: r.urgent, focus: r.focus, quickDatePreset: r.echeance, advanced: { op: "and", items } };
}

// Adresse : paramètres courts et lisibles. Réservés au Cockpit (ne jamais
// réutiliser) : « t » = tâche ouverte, « v » = lentille, « m » = mode du fil.
export const PARAMS_RESERVES = ["t", "v", "m"];
const LISTES: [keyof Requete, string][] = [["projets", "p"], ["statuts", "s"], ["responsables", "r"], ["types", "ty"], ["criticites", "c"]];
export function versParams(r: Requete): URLSearchParams {
  const p = new URLSearchParams(); const d = requeteParDefaut();
  for (const [k, n] of LISTES) { const v = r[k] as string[]; if (v.length) p.set(n, v.join(",")); }
  if (r.texte) p.set("q", r.texte);
  if (r.terminees) p.set("fini", "1");
  if (r.retard) p.set("retard", "1");
  if (r.urgent) p.set("urgent", "1");
  if (r.focus !== "all") p.set("focus", r.focus);
  if (r.echeance) p.set("ech", r.echeance);
  if (r.tri.champ !== d.tri.champ || r.tri.sens !== d.tri.sens) p.set("tri", `${r.tri.champ}:${r.tri.sens}`);
  if (r.groupe !== d.groupe) p.set("grp", r.groupe);
  return p;
}
export function depuisParams(p: URLSearchParams): Requete {
  const r = requeteParDefaut();
  for (const [k, n] of LISTES) { const v = p.get(n); if (v) (r[k] as string[]) = v.split(",").filter(Boolean); }
  r.texte = p.get("q") || "";
  r.terminees = p.get("fini") === "1"; r.retard = p.get("retard") === "1"; r.urgent = p.get("urgent") === "1";
  const f = p.get("focus"); r.focus = f === "yes" || f === "no" ? f : "all";
  r.echeance = p.get("ech") || "";
  const tri = (p.get("tri") || "").split(":");
  if (TRIS.some((t) => t.cle === tri[0])) r.tri = { champ: tri[0] as ChampTri, sens: tri[1] === "desc" ? "desc" : "asc" };
  const g = p.get("grp"); if (GROUPES.some((x) => x.cle === g)) r.groupe = g as ChampGroupe;
  return r;
}

const ecart = (t: Tache) => {
  const ref = t.comparison?.referenceEnd;
  if (!ref || !t.end) return 0;
  const v = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  return Math.round(v(t.end) - v(ref));
};

export function valeurTri(t: Tache, champ: ChampTri, cat: Catalogues, maintenant?: Date): string | number {
  switch (champ) {
    case "title": return (t.title || "").toLowerCase();
    case "start": return t.start || ""; case "end": return t.end || "";
    case "progress": return Number(t.progress ?? 0);
    case "project": return (cat.projets.find((p) => p.id === t.projectId)?.name || "").toLowerCase();
    case "status": return (cat.statuts.find((s) => s.id === t.statusId)?.name || "").toLowerCase();
    case "assignee": return t.assignee || "";
    case "inactivity": return inactiviteJours(t, maintenant);
    case "criticality": return CRITICITES.findIndex((c) => c.id === t.criticality);
    case "dependsOn": return t.dependsOn?.length || 0;
    case "referenceEnd": return t.comparison?.referenceEnd || "";
    case "delta": return ecart(t);
    case "delayRisks": return (t.delayRisks as unknown[] | undefined)?.length || 0;
    default: return 0;
  }
}

export function trier(taches: Tache[], tri: Requete["tri"], cat: Catalogues, maintenant?: Date): Tache[] {
  if (tri.champ === "none") return taches;
  const s = tri.sens === "desc" ? -1 : 1;
  return [...taches].sort((a, b) => { const x = valeurTri(a, tri.champ, cat, maintenant), y = valeurTri(b, tri.champ, cat, maintenant); return x < y ? -s : x > y ? s : 0; });
}

export interface Paquet { cle: string; libelle: string; couleur?: string; taches: Tache[]; }
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function grouper(taches: Tache[], champ: ChampGroupe, cat: Catalogues): Paquet[] {
  if (champ === "aucun") return [{ cle: "tout", libelle: "Toutes les tâches", taches }];
  const ordre: { cle: string; libelle: string; couleur?: string }[] = [];
  const cleDe = (t: Tache): string => {
    switch (champ) {
      case "status": return t.statusId || "__none"; case "project": return t.projectId || "__none"; case "criticality": return t.criticality || "__none";
      case "taskType": return t.taskTypeId || "__none"; case "assignee": return (t.assignee || "").trim() || "__none";
      case "milestone": return t.milestone ? "yes" : "no"; case "focus": return t.focus === true ? "yes" : "no";
      case "period": return t.end ? t.end.slice(0, 7) : "__none";
    }
  };
  if (champ === "status") cat.statuts.forEach((s) => ordre.push({ cle: s.id, libelle: s.name || "Sans nom", couleur: s.color }));
  if (champ === "project") cat.projets.forEach((p) => ordre.push({ cle: p.id, libelle: p.name || "Sans nom", couleur: p.color }));
  if (champ === "criticality") CRITICITES.forEach((c) => ordre.push({ cle: c.id, libelle: c.nom, couleur: c.couleur }));
  if (champ === "taskType") cat.types.forEach((t) => ordre.push({ cle: t.id, libelle: t.name || "Sans nom", couleur: t.color }));
  if (champ === "milestone" || champ === "focus") ordre.push({ cle: "yes", libelle: "Oui" }, { cle: "no", libelle: "Non" });
  const paquets = new Map<string, Tache[]>();
  for (const t of taches) { const k = cleDe(t); paquets.set(k, [...(paquets.get(k) || []), t]); }
  const connus = new Set(ordre.map((o) => o.cle));
  const libre = [...paquets.keys()].filter((k) => !connus.has(k) && k !== "__none").sort();
  libre.forEach((k) => ordre.push({ cle: k, libelle: champ === "period" ? `${MOIS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` : k }));
  ordre.push({ cle: "__none", libelle: "Non défini" });
  return ordre.filter((o) => paquets.has(o.cle)).map((o) => ({ ...o, taches: paquets.get(o.cle)! }));
}

// Statut terminé en fin de liste quand on groupe par statut : utile au Cockpit.
export const ouvertesDabord = (p: Paquet[], cat: Catalogues) => [...p].sort((a, b) => Number(estTerminee({ id: "", statusId: a.cle }, cat.statuts)) - Number(estTerminee({ id: "", statusId: b.cle }, cat.statuts)));
