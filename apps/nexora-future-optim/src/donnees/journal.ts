// Journal d'activité (Ref #669) : port de nexora-project part-001:11405-11451.
// Compare les tâches avant et après une écriture de Futur et n'enregistre que
// des événements réellement survenus. Contrat de nexora:activityLog inchangé :
// entrées les plus récentes en tête, plafond de 2 000.
//
// Dédoublonnage (décision de Quentin, #652) : Nexora actuel, s'il est ouvert,
// journalise aussi les changements qu'il reçoit de Futur. Une entrée identique
// (même tâche, même type, mêmes valeurs) à moins de 5 minutes n'est pas
// ajoutée une seconde fois.
import { estTerminee, nouvelId, type Statut, type Tache } from "./modele";

export const PLAFOND_JOURNAL = 2000;
export const FENETRE_DOUBLON_MS = 5 * 60 * 1000;

export interface EntreeJournal {
  id: string; type: string; taskId: string; taskTitle?: string; projectId?: string; at: string;
  milestone?: boolean; from?: string | null; to?: string | null; fromDate?: string; toDate?: string;
  [autre: string]: unknown;
}

function bloquees(liste: Tache[], statuts: Statut[]): Set<string> {
  const finies = new Set(liste.filter((t) => estTerminee(t, statuts)).map((t) => t.id));
  return new Set(liste.filter((t) => (t.dependsOn || []).some((id) => !finies.has(id))).map((t) => t.id));
}

export function entreesJournal(avant: Tache[], apres: Tache[], statuts: Statut[], at: string, id: () => string = nouvelId): EntreeJournal[] {
  const parId = new Map(avant.map((t) => [t.id, t]));
  const ids = new Set(apres.map((t) => t.id));
  const bAvant = bloquees(avant, statuts); const bApres = bloquees(apres, statuts);
  const e: EntreeJournal[] = [];
  apres.forEach((t) => {
    const b = parId.get(t.id);
    const base = { taskId: t.id, taskTitle: t.title, projectId: t.projectId, at };
    if (!b) { e.push({ id: id(), type: "created", ...base }); return; }
    if (b.statusId !== t.statusId) {
      const etait = estTerminee(b, statuts); const est = estTerminee(t, statuts);
      e.push({ id: id(), type: etait === est ? "statusChanged" : est ? "completed" : "reopened", ...base, milestone: !!t.milestone });
    }
    if ((b.assignee || "") !== (t.assignee || "")) e.push({ id: id(), type: "reassigned", ...base, from: b.assignee || null, to: t.assignee || null });
    if (b.end !== t.end) e.push({ id: id(), type: "deadlineChanged", ...base, fromDate: b.end, toDate: t.end, milestone: !!t.milestone });
    if (!bAvant.has(t.id) && bApres.has(t.id)) e.push({ id: id(), type: "blocked", ...base });
    else if (bAvant.has(t.id) && !bApres.has(t.id)) e.push({ id: id(), type: "unblocked", ...base });
  });
  avant.forEach((t) => { if (!ids.has(t.id)) e.push({ id: id(), type: "deleted", taskId: t.id, taskTitle: t.title, projectId: t.projectId, at }); });
  // L'ordre de nexora-project : les entrées d'un même changement sont
  // ajoutées en bloc, en tête du journal.
  return e;
}

const signature = (x: EntreeJournal) => [x.taskId, x.type, x.from ?? "", x.to ?? "", x.fromDate ?? "", x.toDate ?? ""].join("\u0001");

export function estDoublon(x: EntreeJournal, journal: EntreeJournal[]): boolean {
  const s = signature(x); const t = Date.parse(x.at);
  return journal.some((y) => signature(y) === s && Math.abs(Date.parse(y.at) - t) < FENETRE_DOUBLON_MS);
}

export function ajouterAuJournal(journal: unknown, nouvelles: EntreeJournal[]): EntreeJournal[] {
  const actuel = Array.isArray(journal) ? (journal as EntreeJournal[]) : [];
  const neuves = nouvelles.filter((x) => !estDoublon(x, actuel));
  return [...neuves, ...actuel].slice(0, PLAFOND_JOURNAL);
}
