// Opérations sur les tâches (Ref #655) : fonctions pures sur le tableau de
// nexora:tasks, port fidèle de nexora-project. Elles sont rejouables sur la
// version la plus récente en cas de conflit (voir ecriture-firebase.ts).
import {
  ajouterJours, ecartJours, estProjetCalendrier, estTerminee, nouvelId, statutImpose, statutParDefaut, statutsDuProjet, typeParDefaut,
  type Catalogues, type Tache,
} from "./modele";

export class RefusOperation extends Error { constructor(m: string) { super(m); this.name = "RefusOperation"; } }

// part-001:8283 : toute tâche créée ou modifiée reçoit lastInteraction ;
// passage à Terminé → completedAt ; réouverture → completedAt retiré.
export function horodater(avant: Tache[], apres: Tache[], cat: Catalogues, maintenant: string): Tache[] {
  const parId = new Map(avant.map((t) => [t.id, t]));
  return apres.map((t) => {
    const b = parId.get(t.id);
    if (!b) return { ...t, lastInteraction: t.lastInteraction || maintenant };
    if (b === t) return t;
    const etait = estTerminee(b, cat.statuts), est = estTerminee(t, cat.statuts);
    if (!etait && est) return { ...t, completedAt: maintenant, lastInteraction: maintenant };
    if (etait && !est) { const { completedAt: _retire, ...r } = t; return { ...r, lastInteraction: maintenant }; }
    return { ...t, lastInteraction: maintenant };
  });
}

// part-002:5295
export function normaliserHeures<T extends Pick<Tache, "startTime" | "endTime" | "start" | "end">>(t: T): T {
  const ok = (h?: string) => !!h && /^\d{2}:\d{2}$/.test(h);
  if (!ok(t.startTime)) return { ...t, startTime: "", endTime: "" };
  let fin = t.endTime;
  if (!ok(fin) || ((t.start === t.end || !t.end) && (fin as string) <= (t.startTime as string))) {
    const [h, m] = (t.startTime as string).split(":").map(Number);
    const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
    fin = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  return { ...t, endTime: fin };
}

// part-001:11643 : recalage en une passe sur les dépendances directes.
export function recalerDependances(taches: Tache[]): Tache[] {
  const parId = Object.fromEntries(taches.map((t) => [t.id, t]));
  let change = false;
  const r = taches.map((t) => {
    if (!t.dependsOn?.length || !t.start) return t;
    const fins = t.dependsOn.map((id) => parId[id]?.end).filter((x): x is string => !!x);
    if (!fins.length) return t;
    const requis = fins.reduce((m, d) => (d > m ? d : m), fins[0]);
    if (requis <= t.start) return t;
    change = true;
    const decal = ecartJours(t.start, requis);
    return { ...t, start: requis, end: t.milestone ? requis : t.end ? ajouterJours(t.end, decal) : requis };
  });
  return change ? r : taches;
}

export interface Brouillon extends Partial<Tache> { title: string; }

export function creerTache(taches: Tache[], b: Brouillon, cat: Catalogues, aujourdhui: string, id = nouvelId()): { taches: Tache[]; tache: Tache } {
  const titre = b.title.trim();
  if (!titre) throw new RefusOperation("Le titre est obligatoire.");
  const projectId = b.projectId ?? cat.projets[0]?.id ?? "";
  const taskTypeId = b.taskTypeId ?? typeParDefaut(cat.types, cat.projets, projectId)?.id;
  const impose = statutImpose(cat.types, cat.statuts, taskTypeId);
  const start = b.start || b.end || aujourdhui;
  const end = b.milestone ? start : b.end || (b.start ? b.start : ajouterJours(aujourdhui, 5));
  let t: Tache = {
    progress: 0, checklist: [], dependsOn: [], attachments: [], desc: "", criticality: null, recurrence: null,
    ...b, id, title: titre, projectId, taskTypeId,
    statusId: impose?.id ?? b.statusId ?? statutParDefaut(cat.statuts, cat.projets, projectId)?.id,
    start, end: end < start ? start : end,
    secondaryProjectId: b.secondaryProjectId && b.secondaryProjectId !== projectId ? b.secondaryProjectId : "",
  };
  if (b.startTime) t = normaliserHeures(t);
  t.comparison = { enabled: true, referenceStart: t.milestone ? null : t.start ?? null, referenceEnd: t.end ?? null };
  return { taches: recalerDependances([...taches, t]), tache: t };
}

export function modifierTache(taches: Tache[], id: string, patch: Partial<Tache>, cat: Catalogues): Tache[] {
  const i = taches.findIndex((t) => t.id === id);
  if (i < 0) throw new RefusOperation("Tâche introuvable : elle a peut-être été archivée depuis une autre session.");
  const avant = taches[i];
  if (estProjetCalendrier(cat.projets, avant.projectId)) throw new RefusOperation("Une tâche Google Calendar se modifie dans Google Calendar.");
  let t: Tache = { ...avant, ...patch };
  const impose = statutImpose(cat.types, cat.statuts, t.taskTypeId);
  if (impose) t.statusId = impose.id;
  if (t.milestone && t.start) t.end = t.start;
  if (t.start && t.end && t.end < t.start) t.end = t.start;
  if (t.secondaryProjectId && t.secondaryProjectId === t.projectId) t.secondaryProjectId = "";
  if ("startTime" in patch || "endTime" in patch) t = normaliserHeures(t);
  const r = [...taches]; r[i] = t;
  return recalerDependances(r);
}

// part-001:11852 (marquer terminé, avec récurrence) ; renvoie aussi la
// prochaine occurrence éventuelle.
export function basculerTerminee(taches: Tache[], id: string, cat: Catalogues): { taches: Tache[]; occurrence?: Tache } {
  const cible = taches.find((t) => t.id === id);
  if (!cible) throw new RefusOperation("Tâche introuvable.");
  if (estProjetCalendrier(cat.projets, cible.projectId)) throw new RefusOperation("Le statut d'une tâche Google Calendar est calculé à partir de ses dates.");
  if (statutImpose(cat.types, cat.statuts, cible.taskTypeId)) throw new RefusOperation("Le statut de ce type de tâche est automatique : il ne peut pas être marqué terminé.");
  const permis = statutsDuProjet(cat.statuts, cat.projets, cible.projectId, cible.statusId);
  const fini = permis.find((s) => /termin/i.test(s.name || ""));
  const enCours = permis.find((s) => /en\s*cours/i.test(s.name || ""));
  const deja = estTerminee(cible, cat.statuts);
  const r = taches.map((t) => (t.id !== id ? t : deja ? { ...t, progress: 50, statusId: enCours?.id ?? t.statusId } : { ...t, progress: 100, statusId: fini?.id ?? t.statusId }));
  if (deja || !cible.recurrence || !cible.start || !cible.end) return { taches: r };
  const { unit, interval } = cible.recurrence;
  const decal = unit === "day" ? interval : unit === "week" ? interval * 7 : interval * 30;
  const debut = ajouterJours(cible.start, decal);
  const relance = statutsDuProjet(cat.statuts, cat.projets, cible.projectId).find((s) => /planifier|nouveau|backlog|attente/i.test(s.name || "")) || statutsDuProjet(cat.statuts, cat.projets, cible.projectId)[0];
  const occurrence: Tache = {
    ...cible, id: nouvelId(), start: debut, end: cible.milestone ? debut : ajouterJours(cible.end, decal), progress: 0,
    statusId: relance?.id ?? cible.statusId, checklist: (cible.checklist || []).map((x) => ({ ...x, done: false })),
  };
  delete occurrence.completedAt;
  return { taches: [...r, occurrence], occurrence };
}

// part-001:11950 : statut suivant non terminé du projet, en boucle.
export function statutSuivant(t: Tache, cat: Catalogues): string | undefined {
  if (statutImpose(cat.types, cat.statuts, t.taskTypeId)) return t.statusId;
  const ouverts = statutsDuProjet(cat.statuts, cat.projets, t.projectId).filter((s) => !/termin/i.test(s.name || ""));
  if (!ouverts.length) return t.statusId;
  const i = ouverts.findIndex((s) => s.id === t.statusId);
  return ouverts[(i + 1) % ouverts.length].id;
}

// part-001:11834 / 12029 : archiver = retirer des tâches, ajouter à l'archive.
export function archiver(taches: Tache[], archive: Tache[], id: string, maintenant: string): { taches: Tache[]; archive: Tache[] } {
  const t = taches.find((x) => x.id === id);
  if (!t) throw new RefusOperation("Tâche introuvable.");
  return { taches: taches.filter((x) => x.id !== id), archive: [...archive.filter((x) => x.id !== id), { ...t, archivedAt: maintenant }] };
}
export function restaurer(taches: Tache[], archive: Tache[], id: string): { taches: Tache[]; archive: Tache[] } {
  const a = archive.find((x) => x.id === id);
  if (!a) throw new RefusOperation("Tâche absente de l'archive.");
  const { archivedAt: _a, ...t } = a;
  return { taches: taches.some((x) => x.id === id) ? taches : [...taches, t], archive: archive.filter((x) => x.id !== id) };
}

// part-002:9344
export function dupliquer(taches: Tache[], id: string, cat: Catalogues): { taches: Tache[]; tache: Tache } {
  const s = taches.find((x) => x.id === id);
  if (!s) throw new RefusOperation("Tâche introuvable.");
  const c: Tache = {
    ...s, id: nouvelId(), title: `${s.title || ""} (copie)`, progress: 0,
    statusId: statutImpose(cat.types, cat.statuts, s.taskTypeId)?.id ?? statutParDefaut(cat.statuts, cat.projets, s.projectId)?.id ?? s.statusId,
    checklist: (s.checklist || []).map((x) => ({ ...x, id: nouvelId(), done: false })),
    comparison: null, source: null, sourceUrl: null, sourceSender: null,
  };
  delete c.completedAt; delete c.lastInteraction;
  return { taches: [...taches, c], tache: c };
}
