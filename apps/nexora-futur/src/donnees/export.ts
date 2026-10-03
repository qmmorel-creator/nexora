// Exports (Ref #663) : tâches en CSV (séparateur « ; » et BOM pour Excel en
// français) et sauvegarde complète en JSON des clés lues.
import { estTerminee, type Catalogues, type Tache } from "./modele";

const cellule = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function tachesCsv(taches: Tache[], cat: Catalogues): string {
  const nom = <T extends { id: string; name?: string }>(l: T[], id?: string | null) => (id ? l.find((x) => x.id === id)?.name || id : "");
  const entete = ["id", "titre", "projet", "statut", "type", "responsable", "criticité", "début", "fin", "heure début", "heure fin", "jalon", "focus", "avancement", "terminée", "description"];
  const lignes = taches.map((t) => [t.id, t.title, nom(cat.projets, t.projectId), nom(cat.statuts, t.statusId), nom(cat.types, t.taskTypeId), t.assignee, t.criticality,
    t.start, t.end, t.startTime, t.endTime, t.milestone ? "oui" : "", t.focus ? "oui" : "", t.progress ?? "", estTerminee(t, cat.statuts) ? "oui" : "", t.desc]);
  return "﻿" + [entete, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
}
// Sauvegarde : chaque clé avec son texte brut et sa révision, telles que lues.
export function sauvegarde(lectures: Record<string, { cle: string; texte: string; revision?: string | null } | null>, le = new Date().toISOString()) {
  const cles: Record<string, unknown> = {};
  Object.values(lectures).forEach((l) => { if (!l) return; let v: unknown = l.texte; try { v = JSON.parse(l.texte); } catch { /* texte brut */ } cles[l.cle] = { revision: l.revision ?? null, valeur: v }; });
  return JSON.stringify({ format: "nexora-futur-sauvegarde", version: 1, le, cles }, null, 2);
}
