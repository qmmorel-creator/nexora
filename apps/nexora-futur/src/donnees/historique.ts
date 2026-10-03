// Historique d'une tâche (Ref #663) : entrées de nexora:activityLog qui la
// concernent, les plus récentes d'abord (onglet Historique de nexora-project).
import type { Activite } from "./projet";

const LIB: Record<string, string> = { created: "créée", statusChanged: "statut changé", completed: "terminée", reopened: "rouverte", reassigned: "réassignée", deadlineChanged: "échéance déplacée", blocked: "bloquée", unblocked: "débloquée", deleted: "supprimée" };
export function journalTache(journal: Activite[], id: string, n = 30, nom: (id: string) => string = (x) => x): { quand: string; texte: string; at: string }[] {
  return journal.filter((a) => a.taskId === id).sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, n).map((a) => {
    const lib = LIB[a.type || ""] || a.type || "modifiée";
    const de = a.type === "deadlineChanged" ? [a.fromDate, a.toDate] : a.type === "statusChanged" ? [a.from && nom(a.from), a.to && nom(a.to)] : [a.from, a.to];
    const detail = de[0] || de[1] ? ` (${de[0] || "—"} → ${de[1] || "—"})` : "";
    return { at: a.at || "", quand: a.at ? new Date(a.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—", texte: `${lib}${detail}` };
  });
}
