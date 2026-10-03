// Données FICTIVES de démonstration (Ref #655). Chargées uniquement quand
// VITE_DEMO=1 (développement local et tests de parcours), jamais en production.
import { ajouterJours, aujourdhuiParis } from "../donnees/modele";

export function donneesDemo(j = aujourdhuiParis()): Record<string, unknown> {
  const J = (n: number) => ajouterJours(j, n);
  return {
    "nexora:projectFolders": [{ id: "f-chantiers", name: "Chantiers", parentId: null, order: 0 }, { id: "f-com", name: "Communication", parentId: null, order: 1 }, { id: "folder-a-trier", name: "À trier", parentId: null }],
    "nexora:projects": [
      { id: "p-ctex6", name: "CTEX6", color: "#d64545", folderId: "f-chantiers" },
      { id: "p-lot2b", name: "Lot 2B", color: "#7c5cd6", folderId: "f-chantiers", disabledStatusIds: ["s2"] },
      { id: "p-com", name: "Communication", color: "#d99a2b", folderId: "f-com" },
      { id: "p-agenda", name: "Agenda Google", color: "#3b82f6", folderId: "folder-a-trier", gcalSource: true },
    ],
    "nexora:statuses": [{ id: "s1", name: "À planifier", color: "#64748b" }, { id: "s2", name: "Attente tiers", color: "#d97706" }, { id: "s3", name: "En cours", color: "#0ea5e9" }, { id: "s5", name: "Terminé", color: "#16a34a" }, { id: "s6", name: "Information", color: "#94a3b8" }],
    "nexora:taskTypes": [{ id: "tt1", name: "Tâches", locked: true }, { id: "tt2", name: "Planning", locked: true }, { id: "tt3", name: "Réunions", locked: true }, { id: "tt4", name: "Information", locked: true, restrictedStatusId: "s6" }],
    "nexora:teamMembers": [{ id: "m1", name: "Quentin Morel" }, { id: "m2", name: "Vincent Bernard" }, { id: "m3", name: "Maïa Sonnier" }, { id: "m4", name: "Anne-Laure Masson" }],
    "nexora:tasks": [
      { id: "t1", title: "Documents FOR-0129", projectId: "p-ctex6", statusId: "s3", taskTypeId: "tt1", start: J(-70), end: J(-44), assignee: "Vincent Bernard", criticality: "urgent", progress: 60, checklist: [{ id: "c1", text: "Plan de contrôle", done: true }, { id: "c2", text: "Notes de calcul", done: false }] },
      { id: "t2", title: "PV Contrôles DREAL", projectId: "p-ctex6", statusId: "s1", taskTypeId: "tt1", start: J(-44), end: J(-30), assignee: "Vincent Bernard", criticality: "urgent", dependsOn: ["t1"], desc: "Compiler les PV des contrôles réglementaires avant la visite DREAL." },
      { id: "t3", title: "Visite DREAL", projectId: "p-ctex6", statusId: "s1", taskTypeId: "tt3", start: J(4), end: J(4), milestone: true, assignee: "Quentin Morel", startTime: "09:00", endTime: "11:00" },
      { id: "t4", title: "Revue DOE", projectId: "p-lot2b", statusId: "s3", taskTypeId: "tt1", start: J(-20), end: J(7), assignee: "Quentin Morel", criticality: "moyen", progress: 35, attachments: [{ id: "a1", type: "link", name: "DOE Lot 2B", url: "https://drive.google.com/drive/folders/demo", provider: "google-drive", addedAt: J(-10) }] },
      { id: "t5", title: "Demande lame pour piste d'accès", projectId: "p-lot2b", statusId: "s1", taskTypeId: "tt1", start: J(-63), end: J(-61), assignee: "Maïa Sonnier" },
      { id: "t6", title: "Réunion Expert", projectId: "p-lot2b", statusId: "s5", taskTypeId: "tt3", start: J(-15), end: J(-15), assignee: "Quentin Morel", meetingReport: "" },
      { id: "t7", title: "Point hebdo chantier", projectId: "p-lot2b", statusId: "s3", taskTypeId: "tt3", start: J(0), end: J(0), startTime: "08:30", endTime: "09:00", recurrence: { unit: "week", interval: 1 }, assignee: "Quentin Morel", focus: true },
      { id: "t8", title: "Confirmer les personnes CNR aux PI", projectId: "p-com", statusId: "s2", taskTypeId: "tt1", start: J(-20), end: J(-13), assignee: "Anne-Laure Masson" },
      { id: "t9", title: "Deadline MAJ Octopus complète", projectId: "p-com", statusId: "s1", taskTypeId: "tt2", start: J(2), end: J(2), milestone: true, assignee: "Quentin Morel", criticality: "bas" },
      { id: "t10", title: "Newsletter d'octobre", projectId: "p-com", statusId: "s1", taskTypeId: "tt1", start: J(5), end: J(12), assignee: "" },
      { id: "t11", title: "Congés scolaires (zone A)", projectId: "p-com", statusId: "s6", taskTypeId: "tt4", start: J(14), end: J(28) },
      { id: "t12", title: "Copil mensuel", projectId: "p-agenda", statusId: "s1", taskTypeId: "tt3", start: J(3), end: J(3), startTime: "14:00", endTime: "15:30" },
    ],
    "nexora:taskArchive": [{ id: "t0", title: "Ancienne relance fournisseur", projectId: "p-ctex6", statusId: "s5", taskTypeId: "tt1", start: J(-90), end: J(-85), archivedAt: new Date(Date.now() - 3 * 86400000).toISOString() }],
    "nexora:favorites": [{ type: "project", id: "p-ctex6" }],
    "nexora:metaFilters": { showDone: true },
    "nexora:taskDefaults": { assignee: "Quentin Morel", assigneeDefaulted: true },
  };
}
