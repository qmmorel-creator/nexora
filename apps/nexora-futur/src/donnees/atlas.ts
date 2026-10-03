// Atlas (Ref #662, lot 9) : PROTOTYPE MESURÉ. Décision de Quentin (2026-10-03) :
// l'Atlas (îlots en relief 2,5D, calques, dépendances) fusionne avec la Carte
// (premier niveau par espaces : Chantiers, Finances, Corps, Équipe).
// Ce module ne fait que la DISPOSITION, pure et déterministe ; le rendu SVG
// isométrique est dans cockpit/Atlas.tsx.
import { ajouterJours, estEnRetard, estProjetCalendrier, estReunion, estTerminee, type Catalogues, type Dossier, type Projet, type Tache } from "./modele";
import type { MembreEquipe } from "./equipe";
import { capacite, tachesActives, tachesDuJour } from "./equipe";

export type RegionId = "chantiers" | "finances" | "corps" | "equipe";
export type EtatCube = "retard" | "ouvert" | "jalon" | "fait";
export interface Cube { id: string; etat: EtatCube; x: number; y: number; }
export interface Ilot {
  id: string; region: RegionId; nom: string; couleur: string; x: number; y: number; w: number; d: number; h: number;
  cubes: Cube[]; enPlus: number; ouvertes: number; retards: number; avancement: number;
  budget: number | null; equipe: string[]; reunion: string | null; lien: string | null; projetId?: string; personne?: string; metrique: string;
}
export interface Region { id: RegionId; nom: string; couleur: string; x: number; y: number; w: number; d: number; metrique: string; }
export interface Zone { nom: string; couleur: string; x: number; y: number; w: number; d: number; }
export interface Lien { de: string; vers: string; nb: number; }
export interface Atlas { regions: Region[]; zones: Zone[]; ilots: Ilot[]; liens: Lien[]; largeur: number; profondeur: number; }

export interface Extras {
  budgetMois?: { reste: number; budget: number; aCategoriser: number } | null;
  habitudes?: { faites: number; total: number } | null;
  sport?: { fait: number; cible: number | null } | null;
  depenses?: { projectId?: string; amount?: number | string; status?: string }[];
}
export const COULEURS_REGIONS: Record<RegionId, string> = { chantiers: "#C9581F", finances: "#23805A", corps: "#B8336F", equipe: "#3A5FC2" };
const NOMS: Record<RegionId, string> = { chantiers: "Chantiers", finances: "Finances", corps: "Corps", equipe: "Équipe" };

const GAP = 1.2, MARGE = 1.4, ENTETE = 1.6;
const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
export const initialesDe = (n: string) => n.split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase();

// Emprise d'un îlot : proportionnelle à la racine du nombre de tâches (bornée).
export function emprise(n: number) { const c = Math.min(7, Math.max(2.6, 2.2 + Math.sqrt(n) * 0.85)); return { w: Math.round(c * 1.25 * 10) / 10, d: Math.round(c * 10) / 10 }; }
export const hauteur = (ouvertes: number) => Math.round((0.5 + Math.min(4, ouvertes * 0.16)) * 100) / 100;

// Rangement en étagères dans une largeur donnée ; renvoie les positions et la profondeur utilisée.
function etageres<T extends { w: number; d: number }>(elements: T[], largeur: number, x0: number, y0: number) {
  let x = x0, y = y0, haut = 0; const places: (T & { x: number; y: number })[] = [];
  for (const e of elements) {
    if (x > x0 && x + e.w > x0 + largeur) { x = x0; y += haut + GAP; haut = 0; }
    places.push({ ...e, x, y }); x += e.w + GAP; haut = Math.max(haut, e.d);
  }
  return { places, profondeur: places.length ? y + haut - y0 : 0, largeur: places.length ? Math.max(...places.map((p) => p.x + p.w)) - x0 : 0 };
}
// Blocs posés sur un îlot : retards d'abord, puis ouvertes par échéance, jalons, puis quelques faites.
function cubes(ts: Tache[], cat: Catalogues, jour: string, w: number, d: number) {
  const cols = Math.max(1, Math.floor((w - 0.5) / 1.0)), rangs = Math.max(1, Math.floor((d - 1.4) / 1.0));
  const etat = (t: Tache): EtatCube => (estTerminee(t, cat.statuts) ? "fait" : estEnRetard(t, cat.statuts, jour) ? "retard" : t.milestone ? "jalon" : "ouvert");
  const rang = { retard: 0, ouvert: 1, jalon: 2, fait: 3 } as const;
  const tri = ts.map((t) => ({ t, e: etat(t) })).sort((a, b) => rang[a.e] - rang[b.e] || (a.t.end || "9").localeCompare(b.t.end || "9"));
  const place = cols * rangs;
  return { cubes: tri.slice(0, place).map(({ t, e }, i) => ({ id: t.id, etat: e, x: 0.35 + (i % cols) * 1.0, y: 1.2 + Math.floor(i / cols) * 1.0 })), enPlus: Math.max(0, tri.length - place) };
}

export interface EntreeAtlas extends Catalogues { taches: Tache[]; dossiers: Dossier[]; membres: MembreEquipe[]; jour: string; }

export function construireAtlas(e: EntreeAtlas, x: Extras = {}): Atlas {
  const { jour } = e;
  const projets = e.projets.filter((p) => !estProjetCalendrier(e.projets, p.id));
  const parProjet = new Map<string, Tache[]>();
  e.taches.forEach((t) => { if (t.projectId) { if (!parProjet.has(t.projectId)) parProjet.set(t.projectId, []); parProjet.get(t.projectId)!.push(t); } });
  const actives = tachesActives(e.taches, e.statuts);

  // --- Chantiers : un îlot par projet, regroupés par dossier (zones au sol) ---
  const dossierDe = (p: Projet) => e.dossiers.find((f) => f.id === p.folderId) || null;
  const groupes = new Map<string, Projet[]>();
  projets.forEach((p) => { const k = dossierDe(p)?.id || ""; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k)!.push(p); });
  const ordreDossiers = [...groupes.keys()].sort((a, b) => (e.dossiers.find((f) => f.id === a)?.order ?? 99) - (e.dossiers.find((f) => f.id === b)?.order ?? 99) || a.localeCompare(b));
  const totalAire = projets.reduce((s, p) => { const m = emprise((parProjet.get(p.id) || []).length); return s + (m.w + GAP) * (m.d + GAP); }, 0);
  const largeurCh = Math.max(16, Math.round(Math.sqrt(totalAire) * 1.5));
  const ilots: Ilot[] = []; const zones: Zone[] = [];
  // Chaque dossier est d'abord rangé dans son propre bloc (largeur ∝ racine de son aire),
  // puis les blocs sont rangés côte à côte : la région reste compacte quel que soit le nombre de dossiers.
  const blocs = ordreDossiers.map((k) => {
    const f = e.dossiers.find((z) => z.id === k);
    const membres = groupes.get(k)!.map((p) => ({ p, ...emprise((parProjet.get(p.id) || []).length) })).sort((a, b) => b.d - a.d || (a.p.name || "").localeCompare(b.p.name || ""));
    const aire = membres.reduce((s2, m) => s2 + (m.w + GAP) * (m.d + GAP), 0);
    const largeurBloc = Math.min(largeurCh - 2 * MARGE - 1, Math.max(Math.max(...membres.map((m) => m.w)) + 0.1, Math.sqrt(aire) * 1.3));
    const r = etageres(membres, largeurBloc, 0, 0);
    return { f, r, w: r.largeur + 1, d: r.profondeur + 1.8 };
  });
  const rangement = etageres(blocs.map((b2) => ({ ...b2, d: b2.d + 0.7 })), largeurCh - 2 * MARGE, MARGE, ENTETE); // + place du nom du dossier devant
  for (const { f, r, x: bx, y: by, w: bw, d: bd } of rangement.places) {
    zones.push({ nom: f?.name || "Sans dossier", couleur: f?.color || COULEURS_REGIONS.chantiers, x: bx - 0.5, y: by, w: Math.max(4, bw), d: bd - 0.7 });
    r.places.forEach(({ p, x: rx, y: ry, w, d }) => {
      const ix = bx + rx, iy = by + 1.1 + ry;
      const ts = parProjet.get(p.id) || [];
      const ouvertes = ts.filter((t) => !estTerminee(t, e.statuts));
      const retards = ouvertes.filter((t) => estEnRetard(t, e.statuts, jour)).length;
      const c = cubes(ts, e, jour, w, d);
      const avancement = ts.length ? Math.round(ts.reduce((s2, t) => s2 + (estTerminee(t, e.statuts) ? 100 : Number(t.progress ?? 0)), 0) / ts.length) : 0;
      const bp = p as unknown as Record<string, unknown>; const initial = Number(bp.budgetActuel ?? bp.budgetInitial) || 0;
      const consomme = (x.depenses || []).filter((dp) => dp.projectId === p.id).reduce((s2, dp) => s2 + (Number(dp.amount) || 0), 0);
      const equipe = [...new Set(ouvertes.map((t) => t.assignee).filter((a): a is string => !!a))].slice(0, 4);
      const reu = ts.filter((t) => estReunion(t, e.types) && (t.end || "") >= jour && !estTerminee(t, e.statuts)).sort((a, b) => (a.end || "").localeCompare(b.end || ""))[0];
      ilots.push({ id: `p:${p.id}`, region: "chantiers", nom: p.name || p.id, couleur: p.color || COULEURS_REGIONS.chantiers, x: ix, y: iy, w, d, h: hauteur(ouvertes.length),
        cubes: c.cubes, enPlus: c.enPlus, ouvertes: ouvertes.length, retards, avancement, budget: initial > 0 ? consomme / initial : null, equipe, reunion: reu ? dm(reu.end) : null,
        lien: `/projets/${encodeURIComponent(p.id)}`, projetId: p.id, metrique: `${ouvertes.length} ouverte${ouvertes.length > 1 ? "s" : ""}${retards ? ` · ${retards} en retard` : ""}` });
    });
  }
  const profCh = Math.max(10, ENTETE + rangement.profondeur + MARGE);
  const regions: Region[] = [{ id: "chantiers", nom: NOMS.chantiers, couleur: COULEURS_REGIONS.chantiers, x: 0, y: 0, w: largeurCh, d: profCh,
    metrique: `${projets.length} projets · ${ilots.reduce((s, i) => s + i.retards, 0)} en retard` }];

  // --- Finances, Corps : îlots de synthèse ; Équipe : un îlot par personne ---
  const simple = (region: RegionId, id: string, nom: string, valeur: number, metrique: string, lien: string, couleur = COULEURS_REGIONS[region]): Omit<Ilot, "x" | "y"> =>
    ({ id, region, nom, couleur, w: 4.2, d: 3, h: hauteur(valeur), cubes: [], enPlus: 0, ouvertes: valeur, retards: 0, avancement: 0, budget: null, equipe: [], reunion: null, lien, metrique });
  const b = x.budgetMois;
  const fin = [
    { ...simple("finances", "f:budget", "Budget du mois", b ? Math.round((1 - Math.max(0, b.reste) / Math.max(1, b.budget)) * 20) : 0, b ? `${Math.round(b.reste).toLocaleString("fr-FR")} € restants` : "lecture…", "/finances"), budget: b && b.budget > 0 ? (b.budget - b.reste) / b.budget : null },
    simple("finances", "f:acat", "À catégoriser", b?.aCategoriser ?? 0, b ? `${b.aCategoriser} opération${b.aCategoriser > 1 ? "s" : ""}` : "lecture…", "/finances"),
  ];
  const hab = x.habitudes; const sp = x.sport;
  const corps = [
    { ...simple("corps", "c:hab", "Habitudes", hab?.faites ?? 0, hab ? `${hab.faites}/${hab.total} aujourd'hui` : "—", "/corps"), avancement: hab && hab.total ? Math.round((hab.faites / hab.total) * 100) : 0 },
    simple("corps", "c:sport", "Sport", Math.round((sp?.fait ?? 0) * 3), sp ? `${sp.fait.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h cette semaine${sp.cible ? ` / ${sp.cible} h` : ""}` : "—", "/corps"),
  ];
  const personnes = e.membres.filter((m) => m.name && !m.inactive).map((m) => {
    const ouvertes = e.taches.filter((t) => t.assignee === m.name && !estTerminee(t, e.statuts));
    const surcharge = [0, 1, 2, 3, 4].some((i) => tachesDuJour(actives, m.name, ajouterJours(jour, i)).length > capacite(m.capacityPerDay));
    const em = emprise(ouvertes.length); const w = Math.min(4.5, em.w), d = Math.min(3.6, em.d);
    const c = cubes(ouvertes, e, jour, w, d);
    return { id: `m:${m.name}`, region: "equipe" as RegionId, nom: m.name, couleur: surcharge ? "#BE2F22" : COULEURS_REGIONS.equipe, w, d, h: hauteur(ouvertes.length), cubes: c.cubes, enPlus: c.enPlus,
      ouvertes: ouvertes.length, retards: ouvertes.filter((t) => estEnRetard(t, e.statuts, jour)).length, avancement: 0, budget: null, equipe: [], reunion: null, lien: "/equipe", personne: m.name,
      metrique: `${ouvertes.length} ouverte${ouvertes.length > 1 ? "s" : ""}${surcharge ? " · au-delà de sa capacité" : ""}` };
  });
  const bas = profCh + 3.2; // le nom de la région est posé dans cet intervalle
  const ranger = (liste: Omit<Ilot, "x" | "y">[], x0: number, y0: number, largeur: number) => {
    const r = etageres(liste, largeur - 2 * MARGE, x0 + MARGE, y0 + ENTETE);
    r.places.forEach((i) => ilots.push(i as Ilot));
    return { w: Math.max(largeur, r.largeur + 2 * MARGE), d: ENTETE + r.profondeur + MARGE };
  };
  const rf = ranger(fin, largeurCh + 3, 0, 12);
  regions.push({ id: "finances", nom: NOMS.finances, couleur: COULEURS_REGIONS.finances, x: largeurCh + 3, y: 0, w: rf.w, d: Math.max(rf.d, 8), metrique: b ? `${Math.round(b.reste).toLocaleString("fr-FR")} € restants · ${b.aCategoriser} à classer` : "budget en lecture" });
  const rc = ranger(corps, 0, bas, 12);
  regions.push({ id: "corps", nom: NOMS.corps, couleur: COULEURS_REGIONS.corps, x: 0, y: bas, w: rc.w, d: Math.max(rc.d, 7), metrique: hab ? `habitudes ${hab.faites}/${hab.total}` : "" });
  const re = ranger(personnes, rc.w + 3, bas, Math.max(14, largeurCh + 3 + rf.w - rc.w - 3));
  regions.push({ id: "equipe", nom: NOMS.equipe, couleur: COULEURS_REGIONS.equipe, x: rc.w + 3, y: bas, w: re.w, d: Math.max(re.d, 7), metrique: `${personnes.length} personnes` });

  // --- Dépendances entre projets (une flèche par paire, avec le nombre) ---
  const projetDe = new Map(e.taches.map((t) => [t.id, t.projectId]));
  const liens = new Map<string, Lien>();
  e.taches.forEach((t) => (t.dependsOn || []).forEach((dep) => {
    const a = projetDe.get(dep), bb = t.projectId;
    if (!a || !bb || a === bb || !parProjet.has(a) || !parProjet.has(bb)) return;
    const k = `${a}>${bb}`; const l = liens.get(k) || { de: `p:${a}`, vers: `p:${bb}`, nb: 0 }; l.nb++; liens.set(k, l);
  }));
  return { regions, zones, ilots, liens: [...liens.values()], largeur: Math.max(...regions.map((r) => r.x + r.w)), profondeur: Math.max(...regions.map((r) => r.y + r.d)) };
}

// --- Charge d'essai (mesure seulement, jamais écrite) ---------------------------
export function chargeEssai(nProjets: number, tachesParProjet: number, jour: string): { projets: Projet[]; taches: Tache[]; dossiers: Dossier[] } {
  let g = 7; const a = () => (g = (g * 16807) % 2147483647) / 2147483647;
  const dossiers: Dossier[] = Array.from({ length: Math.max(1, Math.round(nProjets / 25)) }, (_, i) => ({ id: `essai-f${i}`, name: `Dossier d'essai ${i + 1}`, order: i }));
  const projets: Projet[] = Array.from({ length: nProjets }, (_, i) => ({ id: `essai-p${i}`, name: `Projet d'essai ${i + 1}`, color: ["#C9581F", "#3A5FC2", "#23805A", "#B8336F", "#A86A12"][i % 5], folderId: dossiers[i % dossiers.length].id }));
  const taches: Tache[] = [];
  projets.forEach((p, i) => { const n = Math.max(1, Math.round(tachesParProjet * (0.3 + a() * 1.4))); for (let k = 0; k < n; k++) { const fin = ajouterJours(jour, Math.round((a() - 0.4) * 60)); taches.push({ id: `essai-t${i}-${k}`, title: `Tâche ${k + 1}`, projectId: p.id, statusId: a() < 0.25 ? "__fait" : "__ouvert", start: ajouterJours(fin, -3), end: fin, assignee: `Personne ${1 + (k % 6)}`, ...(a() < 0.05 && i > 0 ? { dependsOn: [`essai-t${i - 1}-0`] } : {}) }); } });
  return { projets, taches, dossiers };
}
