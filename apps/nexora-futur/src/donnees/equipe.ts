// Équipe (Ref #660, lot 7) : port de nexora-project, en LECTURE seule
// (décision de Quentin, 2026-10-03). Charge du personnel : part-002:3338-4321
// (NEXORA:STAFFING) ; organigramme : part-002:3401-3761 (NEXORA:TEAMS).
// Futur n'écrit ni nexora:staffing, ni nexora:workshops, ni nexora:teams.
import type { Membre, Statut, Tache } from "./modele";
import { estTerminee } from "./modele";

export interface Atelier { id: string; name: string; color: string; custom: boolean; }
export interface Affectation { id: string; member: string; date: string; workshops: string[]; }
export interface Equipe {
  id: string; name: string; color: string; leadName: string; parentTeamId: string; parentLinkType: "hierarchique" | "transverse";
  leadTitle: string; parentMemberName: string;
}
export interface MembreEquipe extends Membre { capacityPerDay?: number; managerName?: string; teamRoles?: Record<string, string>; teamId?: string | null; inactive?: boolean; avatarDataUrl?: string | null; }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;
type Brut = Record<string, unknown>;
const objets = (l: unknown): Brut[] => (Array.isArray(l) ? l.filter((x): x is Brut => !!x && typeof x === "object") : []);

export const ATELIERS_DEPART: Atelier[] = [
  { id: "ws-usine", name: "Usine", color: "#2C6BE0", custom: false },
  { id: "ws-bureau", name: "Bureau", color: "#7A5AF8", custom: false },
  { id: "ws-chantier", name: "Chantier", color: "#FF7A3D", custom: false },
  { id: "ws-atelier", name: "Atelier", color: "#1FA971", custom: false },
  { id: "ws-formation", name: "Formation", color: "#E2A63B", custom: false },
  { id: "ws-absence", name: "Absence", color: "#7A8290", custom: false },
];
const COULEURS_EQUIPE = ["#2C6BE0", "#7A5AF8", "#FF7A3D", "#1FA971", "#E2A63B", "#D64545", "#EC4899", "#14B8A6", "#0EA5E9", "#7A8290"];

// normalizeWorkshops : un catalogue vide retombe sur les valeurs de départ.
export function normaliserAteliers(liste: unknown): Atelier[] {
  const vus = new Set<string>();
  const out = objets(liste).filter((w) => w.id && String(w.name || "").trim()).filter((w) => { const id = String(w.id); if (vus.has(id)) return false; vus.add(id); return true; })
    .map((w) => ({ id: String(w.id), name: String(w.name).trim(), color: typeof w.color === "string" && HEX.test(w.color) ? w.color : ATELIERS_DEPART[0].color, custom: w.custom === true }));
  return out.length ? out : ATELIERS_DEPART.map((w) => ({ ...w }));
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// workshopCode : deux lettres dérivées du nom.
export function codeAtelier(nom: string) { const c = sansAccents(String(nom || "")).replace(/[^a-z0-9]/g, ""); return c ? c.slice(0, 2).toUpperCase() : "··"; }
export const idCase = (membre: string, date: string) => `${String(membre || "").trim()}|${String(date || "").trim()}`;

// normalizeStaffingEntries : une case vide n'est pas stockée ; un atelier
// inconnu disparaît des affectations ; tri par date puis personne.
export function normaliserAffectations(liste: unknown, idsConnus?: string[]): Affectation[] {
  const connus = idsConnus ? new Set(idsConnus) : null;
  const parId = new Map<string, Affectation>();
  objets(liste).forEach((e) => {
    const member = String(e.member || "").trim(); const date = String(e.date || "").trim();
    if (!member || !ISO.test(date)) return;
    const workshops: string[] = [];
    (Array.isArray(e.workshops) ? e.workshops : []).forEach((x) => { const id = String(x || ""); if (!id || workshops.includes(id) || (connus && !connus.has(id))) return; workshops.push(id); });
    if (!workshops.length) return;
    const id = idCase(member, date);
    parId.set(id, { id, member, date, workshops });
  });
  return [...parId.values()].sort((a, b) => (a.date === b.date ? a.member.localeCompare(b.member, "fr") : a.date.localeCompare(b.date)));
}
export const parCase = (affectations: Affectation[]) => new Map(affectations.map((e) => [e.id, e.workshops]));

const decaler = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoUtc = (y: number, m: number, j: number) => new Date(Date.UTC(y, m, j, 12)).toISOString().slice(0, 10);

export type Plage = "month" | "twoWeeks" | "week";
// staffingWindow (plages de calendrier ; la plage libre n'est pas reprise).
export function fenetre(plage: Plage, decalage: number, jour: string): { start: string; end: string } {
  const n = Math.max(-24, Math.min(24, Math.round(decalage) || 0));
  const y = +jour.slice(0, 4); const m = +jour.slice(5, 7) - 1;
  if (plage === "month") return { start: isoUtc(y, m + n, 1), end: isoUtc(y, m + n + 1, 0) };
  const span = plage === "twoWeeks" ? 14 : 7;
  const dow = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = decaler(jour, -dow + n * span);
  return { start, end: decaler(start, span - 1) };
}
export interface JourGrille { iso: string; dow: number; weekend: boolean; num: string; monthStart: boolean; today: boolean; }
// staffingDays
export function joursGrille(f: { start: string; end: string }, jour: string, weekEnds = true): JourGrille[] {
  const out: JourGrille[] = [];
  if (!ISO.test(f.start) || !ISO.test(f.end)) return out;
  for (let cur = f.start, g = 0; cur <= f.end && g < 400; cur = decaler(cur, 1), g++) {
    const d = new Date(`${cur}T12:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; const weekend = dow >= 5;
    if (weekEnds || !weekend) out.push({ iso: cur, dow, weekend, num: String(d.getUTCDate()), monthStart: d.getUTCDate() === 1, today: cur === jour });
  }
  return out;
}
// staffingCellFill : un atelier = aplat, plusieurs = quartiers coniques.
export function remplissage(ids: string[], ateliers: Atelier[]): { background: string; shops: Atelier[]; single: Atelier | null } | null {
  const shops = (ids || []).map((id) => ateliers.find((w) => w.id === String(id))).filter((x): x is Atelier => !!x);
  if (!shops.length) return null;
  if (shops.length === 1) return { background: shops[0].color, shops, single: shops[0] };
  const seg = 360 / shops.length;
  return { background: `conic-gradient(from 45deg, ${shops.map((w, i) => `${w.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ")})`, shops, single: null };
}
// staffingMemberLoad : nombre de POSTES sur la fenêtre.
export const chargeMembre = (cases: Map<string, string[]>, membre: string, jours: JourGrille[]) => jours.reduce((s, j) => s + (cases.get(idCase(membre, j.iso)) || []).length, 0);
// staffingDayCount : PERSONNES affectées ce jour-là.
export const compteJour = (cases: Map<string, string[]>, membres: string[], jour: string) => membres.filter((m) => (cases.get(idCase(m, jour)) || []).length > 0).length;
// staffingWorkshopTotalsInWindow : jours-personnes par atelier.
export function totauxAteliers(cases: Map<string, string[]>, membres: string[], jours: JourGrille[]) {
  const t = new Map<string, number>();
  membres.forEach((m) => jours.forEach((j) => (cases.get(idCase(m, j.iso)) || []).forEach((id) => t.set(id, (t.get(id) || 0) + 1))));
  return t;
}
// staffingActiveTasksIndex / ForCell : tâches non jalons, non terminées, datées.
export function tachesActives(taches: Tache[], statuts: Statut[]) {
  const map = new Map<string, Tache[]>();
  taches.forEach((t) => {
    if (t.milestone || !t.start || !t.end) return;
    const m = String(t.assignee || "").trim();
    if (!m || estTerminee(t, statuts)) return;
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(t);
  });
  return map;
}
export const tachesDuJour = (index: Map<string, Tache[]>, membre: string, jour: string) => (index.get(membre) || []).filter((t) => t.start! <= jour && jour <= t.end!);
// normalizeMemberCapacity
export const capacite = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 1; };
// staffingMemberColor : teinte d'une personne hors annuaire, par hachage du nom.
const PALETTE = ["#4F6AF5", "#22B07D", "#F2A93B", "#8B5CF6", "#0EA5E9", "#D64545", "#EC4899", "#14B8A6", "#6366F1", "#F97316"];
export function couleurPersonne(nom: string) { let h = 0; for (let i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) % 100000007; return PALETTE[h % PALETTE.length]; }

// Personnes de la grille : l'annuaire, puis les noms qui n'apparaissent que
// dans les affectations (Futur n'a pas le réglage par widget de l'original).
export function personnesGrille(membres: MembreEquipe[], affectations: Affectation[]) {
  const noms = membres.filter((m) => m.name && !m.inactive).map((m) => m.name);
  affectations.forEach((a) => { if (!noms.includes(a.member)) noms.push(a.member); });
  return noms;
}

// --- Organigramme -----------------------------------------------------------

// normalizeTeams (champs utiles à l'arbre) : parent inexistant ou cycle → vidé.
export function normaliserEquipes(liste: unknown): Equipe[] {
  const vus = new Set<string>();
  const base: Equipe[] = objets(liste).filter((t) => t.id && String(t.name || "").trim()).filter((t) => { const id = String(t.id); if (vus.has(id)) return false; vus.add(id); return true; })
    .map((t) => ({
      id: String(t.id), name: String(t.name).trim(), color: typeof t.color === "string" && HEX.test(t.color) ? t.color : COULEURS_EQUIPE[0],
      leadName: String(t.leadName || "").trim(), parentTeamId: t.parentTeamId ? String(t.parentTeamId) : "",
      parentLinkType: t.parentLinkType === "transverse" ? "transverse" : "hierarchique", leadTitle: String(t.leadTitle || "").trim().slice(0, 80),
      parentMemberName: t.parentTeamId && t.parentLinkType !== "transverse" ? String(t.parentMemberName || "").trim() : "",
    }));
  const parId = new Map(base.map((t) => [t.id, t]));
  return base.map((t) => {
    if (!t.parentTeamId || !parId.has(t.parentTeamId)) return { ...t, parentTeamId: "", parentMemberName: "" };
    const chaine = new Set([t.id]);
    let cur = parId.get(t.parentTeamId);
    while (cur) {
      if (chaine.has(cur.id)) return { ...t, parentTeamId: "", parentMemberName: "" };
      chaine.add(cur.id);
      cur = cur.parentTeamId ? parId.get(cur.parentTeamId) : undefined;
    }
    return t;
  });
}
// memberTeamIds : teamIds, sinon l'ancien teamId.
export function equipesDe(m: MembreEquipe | undefined): string[] {
  if (!m) return [];
  if (Array.isArray(m.teamIds)) return [...new Set(m.teamIds.filter(Boolean).map(String))];
  return m.teamId ? [String(m.teamId)] : [];
}
export const posteDans = (m: MembreEquipe | undefined, teamId: string | null) => (m && teamId && m.teamRoles && typeof m.teamRoles[teamId] === "string" ? m.teamRoles[teamId].trim() : "");
const responsable = (m: MembreEquipe) => (typeof m.managerName === "string" ? m.managerName.trim() : "");
// memberDescendantAndSelfNames
function subordonnesEtSoi(nom: string, membres: MembreEquipe[]) {
  const out = new Set([nom]);
  for (let grandit = true; grandit;) { grandit = false; membres.forEach((m) => { const r = responsable(m); if (r && out.has(r) && !out.has(m.name)) { out.add(m.name); grandit = true; } }); }
  return out;
}

export type Noeud =
  | { type: "equipe"; equipe: Equipe | null; responsable: MembreEquipe | null; enfants: Noeud[] }
  | { type: "personne"; membre: MembreEquipe; enfants: Noeud[]; equipeRole: string | null; doublon?: boolean };

// buildOrgHierarchyTree : équipes imbriquées (sauf transverses, en racine),
// une personne sous son responsable direct s'il est résolvable sans cycle,
// sinon sous sa première équipe (copie dans les autres), sinon « Sans équipe ».
export function arbreOrganisation(equipesBrutes: unknown, membres: MembreEquipe[]): Noeud[] {
  const equipes = normaliserEquipes(equipesBrutes);
  const noeudsEquipe = new Map(equipes.map((t) => [t.id, { type: "equipe" as const, equipe: t, responsable: t.leadName ? membres.find((m) => m.name === t.leadName) || null : null, enfants: [] as Noeud[] }]));
  const noeudsPersonne = new Map(membres.map((m) => [m.name, { type: "personne" as const, membre: m, enfants: [] as Noeud[], equipeRole: null as string | null }]));
  const racines: Noeud[] = [];
  equipes.forEach((t) => {
    const n = noeudsEquipe.get(t.id)!;
    if (t.parentTeamId && t.parentLinkType !== "transverse" && noeudsEquipe.has(t.parentTeamId)) noeudsEquipe.get(t.parentTeamId)!.enfants.push(n); else racines.push(n);
  });
  const sansEquipe = { type: "equipe" as const, equipe: null, responsable: null, enfants: [] as Noeud[] };
  membres.forEach((m) => {
    const n = noeudsPersonne.get(m.name)!;
    const r = responsable(m);
    const nr = r && r !== m.name ? noeudsPersonne.get(r) : undefined;
    const sur = nr && !subordonnesEtSoi(m.name, membres).has(r) ? nr : null;
    const ids = equipesDe(m).filter((id) => noeudsEquipe.has(id));
    n.equipeRole = ids[0] || null;
    if (sur) { sur.enfants.push(n); return; }
    if (ids.length) {
      noeudsEquipe.get(ids[0])!.enfants.push(n);
      ids.slice(1).forEach((id) => noeudsEquipe.get(id)!.enfants.push({ type: "personne", membre: m, enfants: [], equipeRole: id, doublon: true }));
      return;
    }
    sansEquipe.enfants.push(n);
  });
  if (sansEquipe.enfants.length) racines.push(sansEquipe);
  return racines;
}
// Liens transverses (transverseTeamLinks), affichés en texte sous l'équipe.
export function liensTransverses(equipesBrutes: unknown) {
  const equipes = normaliserEquipes(equipesBrutes); const parId = new Map(equipes.map((t) => [t.id, t]));
  return equipes.filter((t) => t.parentTeamId && t.parentLinkType === "transverse" && parId.has(t.parentTeamId)).map((t) => ({ de: t, vers: parId.get(t.parentTeamId)! }));
}

// Plan de charge d'une fiche personne (WidgetUserProfile) : tâches actives
// par jour sur 30 jours.
export function planDeCharge(taches: Tache[], statuts: Statut[], nom: string, jour: string, n = 30) {
  const index = tachesActives(taches, statuts);
  return Array.from({ length: n }, (_, i) => { const d = decaler(jour, i); return { jour: d, nb: tachesDuJour(index, nom, d).length }; });
}
