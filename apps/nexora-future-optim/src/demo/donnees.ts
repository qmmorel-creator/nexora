// Données FICTIVES de démonstration (Ref #655). Chargées uniquement quand
// VITE_DEMO=1 (développement local et tests de parcours), jamais en production.
import { ajouterJours, aujourdhuiParis } from "../donnees/modele";

export function donneesDemo(j = aujourdhuiParis()): Record<string, unknown> {
  const J = (n: number) => ajouterJours(j, n);
  return {
    "nexora:projectFolders": [{ id: "f-chantiers", name: "Chantiers", parentId: null, order: 0 }, { id: "f-com", name: "Communication", parentId: null, order: 1 }, { id: "folder-a-trier", name: "À trier", parentId: null }],
    "nexora:projects": [
      { id: "p-ctex6", name: "CTEX6", color: "#d64545", folderId: "f-chantiers", budgetInitial: 50000 },
      { id: "p-lot2b", name: "Lot 2B", color: "#7c5cd6", folderId: "f-chantiers", disabledStatusIds: ["s2"] },
      { id: "p-com", name: "Communication", color: "#d99a2b", folderId: "f-com" },
      { id: "p-agenda", name: "Agenda Google", color: "#3b82f6", folderId: "folder-a-trier", gcalSource: true },
    ],
    "nexora:statuses": [{ id: "s1", name: "À planifier", color: "#64748b" }, { id: "s2", name: "Attente tiers", color: "#d97706" }, { id: "s3", name: "En cours", color: "#0ea5e9" }, { id: "s5", name: "Terminé", color: "#16a34a" }, { id: "s6", name: "Information", color: "#94a3b8" }],
    "nexora:taskTypes": [{ id: "tt1", name: "Tâches", locked: true }, { id: "tt2", name: "Planning", locked: true }, { id: "tt3", name: "Réunions", locked: true }, { id: "tt4", name: "Information", locked: true, restrictedStatusId: "s6" }],
    "nexora:teamMembers": [
      { id: "m1", name: "Quentin Morel", teamIds: ["eq0"], capacityPerDay: 2, teamRoles: { eq0: "Gérant" }, email: "quentin@exemple.invalid" },
      { id: "m2", name: "Vincent Bernard", teamIds: ["eq1"], managerName: "Quentin Morel", teamRoles: { eq1: "Conducteur de travaux" } },
      { id: "m3", name: "Maïa Sonnier", teamIds: ["eq1", "eq2"], managerName: "Vincent Bernard", teamRoles: { eq1: "Cheffe d'équipe", eq2: "Photos de chantier" } },
      { id: "m4", name: "Anne-Laure Masson", teamIds: ["eq2"], teamRoles: { eq2: "Chargée de communication" } },
    ],
    "nexora:teams": [{ id: "eq0", name: "Direction", color: "#203246", leadName: "Quentin Morel" }, { id: "eq1", name: "Travaux", color: "#FF7A3D", leadName: "Vincent Bernard", parentTeamId: "eq0" }, { id: "eq2", name: "Communication", color: "#D99A2B", leadName: "Anne-Laure Masson", parentTeamId: "eq0" }, { id: "eq3", name: "Bureau d'études (externe)", color: "#7A5AF8", parentTeamId: "eq1", parentLinkType: "transverse" }],
    "nexora:workshops": [{ id: "ws-chantier", name: "Chantier", color: "#FF7A3D" }, { id: "ws-bureau", name: "Bureau", color: "#7A5AF8" }, { id: "ws-atelier", name: "Atelier", color: "#1FA971" }, { id: "ws-formation", name: "Formation", color: "#E2A63B" }, { id: "ws-absence", name: "Absence", color: "#7A8290" }],
    "nexora:staffing": [
      ...Array.from({ length: 14 }, (_, i) => ({ member: "Vincent Bernard", date: J(i - 3), workshops: i % 7 === 4 ? ["ws-bureau"] : i % 7 >= 5 ? [] : ["ws-chantier"] })),
      ...Array.from({ length: 14 }, (_, i) => ({ member: "Maïa Sonnier", date: J(i - 3), workshops: i === 6 ? ["ws-absence"] : i % 7 >= 5 ? [] : i % 3 === 0 ? ["ws-chantier", "ws-atelier"] : ["ws-chantier"] })),
      ...Array.from({ length: 14 }, (_, i) => ({ member: "Anne-Laure Masson", date: J(i - 3), workshops: i % 7 >= 5 ? [] : i === 2 ? ["ws-formation"] : ["ws-bureau"] })),
      { member: "Karim (intérim)", date: J(1), workshops: ["ws-chantier"] }, { member: "Karim (intérim)", date: J(2), workshops: ["ws-chantier"] },
    ],
    "nexora:sportGoals": { weeklyHours: 5, yearlyKm: [{ id: "g1", label: "Course", sports: ["Course à pied"], km: 800 }, { id: "g2", label: "", sports: [], km: 3000 }] },
    "nexora:expenses": [{ id: "x1", projectId: "p-ctex6", amount: 22500, status: "payee", date: J(-60) }, { id: "x2", projectId: "p-ctex6", amount: 8700, status: "facturee", date: J(-20) }],
    "nexora:quoteClients": [{ id: "cl1", name: "Mairie de Valence" }, { id: "cl2", name: "SCI Les Tilleuls" }],
    "nexora:quotes": [
      { id: "q1", number: "2026-004", status: "accepted", clientId: "cl1", title: "Mission AMO bâtiment", issueDate: J(-80), validUntil: J(-50), lines: [{ id: "l1", kind: "forfait", description: "Phase études", amount: 8000 }, { id: "l2", kind: "regie", description: "Suivi", quantity: 10, unit: "day", unitRate: 550 }] },
      { id: "q2", number: "2026-005", status: "sent", clientId: "cl2", title: "Diagnostic", issueDate: J(-40), validUntil: J(-10), lines: [{ id: "l3", kind: "forfait", amount: 1800 }] },
      { id: "q3", number: "2026-006", status: "draft", clientId: "cl2", title: "Extension", issueDate: J(-2), validUntil: J(28), lines: [{ id: "l4", kind: "forfait", amount: 4200 }] },
    ],
    "nexora:invoices": [
      { id: "f1", number: "F-2026-007", quoteId: "q1", clientId: "cl1", title: "Acompte AMO", issueDate: J(-60), dueDate: J(-30), status: "paid", paidAt: new Date(Date.now() - 35 * 86400000).toISOString(), lines: [{ kind: "forfait", amount: 4000 }] },
      { id: "f2", number: "F-2026-008", quoteId: "q1", clientId: "cl1", title: "Phase études", issueDate: J(-20), dueDate: J(-5), status: "issued", lines: [{ kind: "forfait", amount: 4000 }] },
    ],
    "nexora:proMissions": [{ id: "m1", clientId: "cl1", projectId: "p-ctex6", quoteId: "q1", billingMode: "forfait", status: "en_cours" }],
    "nexora:proBillingSchedule": [
      { id: "b1", missionId: "m1", type: "acompte", libelle: "Acompte 30 %", montantPrevu: 4000, dateCible: J(-60), statut: "encaisse" },
      { id: "b2", missionId: "m1", type: "jalon", libelle: "Fin des études", montantPrevu: 4000, dateCible: J(-20), statut: "facture" },
      { id: "b3", missionId: "m1", type: "solde", libelle: "Solde du suivi", montantPrevu: 5500, dateCible: J(25), statut: "prevu" },
    ],
    "nexora:proPayments": [{ id: "pa1", billingScheduleId: "b1", montant: 4000, date: J(-35), statutRapprochement: "rapproche" }],
    "nexora:proTimeEntries": [{ id: "te1", missionId: "m1", billable: true, status: "validee", durationMinutes: 480, rateApplied: 550, rateType: "journalier" }],
    "nexora:financeProSettings": { tresorerieDisponible: 12000, tauxProvisionSocialesFiscales: 0.22 },
    "nexora:activityLog": [{ id: "l1", type: "reassigned", taskId: "t1", taskTitle: "Documents FOR-0129", projectId: "p-ctex6", to: "Vincent Bernard", at: new Date(Date.now() - 86400000).toISOString() }, { id: "l2", type: "deadlineChanged", taskId: "t3", taskTitle: "Visite DREAL", projectId: "p-ctex6", toDate: J(4), at: new Date(Date.now() - 3 * 86400000).toISOString() }],
    "nexora:habitThemes": [
      { id: "th1", name: "Santé", color: "#16a34a", selectionMode: "multi", habits: [{ id: "h1", name: "Eau 2 L", color: "#0EA5E9" }, { id: "h2", name: "Lecture", color: "#8B5CF6" }, { id: "h3", name: "Méditation", color: "#EC4899" }, { id: "h4", name: "Pas (milliers)", kind: "numeric", min: 0, max: 10, step: 2, color: "#14B8A6" }] },
      { id: "th2", name: "Lieu", color: "#2563eb", selectionMode: "single", habits: [{ id: "h5", name: "Bureau", color: "#2C6BE0" }, { id: "h6", name: "Télétravail", color: "#7A5AF8" }] },
    ],
    "nexora:habitSkips": [],
    "nexora:habitLog": Array.from({ length: 60 }, (_, i) => ({ habitId: ["h1", "h2", "h3"][i % 3], date: J(-Math.floor(i / 2)) })).filter((e, i, a) => a.findIndex((x) => x.habitId === e.habitId && x.date === e.date) === i),
    "nexora:tasks": [
      // Cas réel (#688) : date corrompue venue d'un import Todoist ; aucun écran ne doit tomber.
      { id: "t-nan", title: "Informations centre aéré", projectId: "p-ctex6", statusId: "s1", taskTypeId: "tt1", start: "", end: "NaN-NaN-NaN" },
      { id: "t1", title: "Documents FOR-0129", projectId: "p-ctex6", statusId: "s3", taskTypeId: "tt1", start: J(-70), end: J(-44), assignee: "Vincent Bernard", criticality: "urgent", progress: 60, checklist: [{ id: "c1", text: "Plan de contrôle", done: true }, { id: "c2", text: "Notes de calcul", done: false }] },
      { id: "t2", title: "PV Contrôles DREAL", projectId: "p-ctex6", statusId: "s1", taskTypeId: "tt1", start: J(-44), end: J(-30), assignee: "Vincent Bernard", criticality: "urgent", dependsOn: ["t1"], desc: "Compiler les PV des contrôles réglementaires avant la visite DREAL." },
      { id: "t3", title: "Visite DREAL", projectId: "p-ctex6", statusId: "s1", taskTypeId: "tt3", start: J(4), end: J(4), milestone: true, assignee: "Quentin Morel", startTime: "09:00", endTime: "11:00" },
      { id: "t4", title: "Revue DOE", projectId: "p-lot2b", statusId: "s3", taskTypeId: "tt1", start: J(-20), end: J(7), assignee: "Quentin Morel", criticality: "moyen", progress: 35, comparison: { enabled: true, referenceStart: J(-22), referenceEnd: J(2), capturedAt: J(-10), history: [{ start: J(-25), end: J(0), capturedAt: J(-30), label: "Initiale" }] }, attachments: [{ id: "a1", type: "link", name: "DOE Lot 2B", url: "https://drive.google.com/drive/folders/demo", provider: "google-drive", addedAt: J(-10) }] },
      { id: "t5", title: "Demande lame pour piste d'accès", projectId: "p-lot2b", statusId: "s1", taskTypeId: "tt1", start: J(-63), end: J(-61), assignee: "Maïa Sonnier" },
      { id: "t6", title: "Réunion Expert", projectId: "p-lot2b", statusId: "s5", taskTypeId: "tt3", start: J(-15), end: J(-15), assignee: "Quentin Morel", meetingReport: "", completedAt: new Date(Date.now() - 9 * 86400000).toISOString() },
      { id: "t7", title: "Point hebdo chantier", projectId: "p-lot2b", statusId: "s3", taskTypeId: "tt3", start: J(0), end: J(0), startTime: "08:30", endTime: "09:00", recurrence: { unit: "week", interval: 1 }, assignee: "Quentin Morel", focus: true },
      { id: "t8", title: "Confirmer les personnes CNR aux PI", projectId: "p-com", statusId: "s2", taskTypeId: "tt1", start: J(-20), end: J(-13), assignee: "Anne-Laure Masson" },
      { id: "t9", title: "Deadline MAJ Octopus complète", projectId: "p-com", statusId: "s1", taskTypeId: "tt2", start: J(2), end: J(2), milestone: true, assignee: "Quentin Morel", criticality: "bas" },
      { id: "t10", title: "Newsletter d'octobre", projectId: "p-com", statusId: "s1", taskTypeId: "tt1", start: J(5), end: J(12), assignee: "", dependsOn: ["t9"] },
      { id: "t11", title: "Congés scolaires (zone A)", projectId: "p-com", statusId: "s6", taskTypeId: "tt4", start: J(14), end: J(28) },
      { id: "t12", title: "Copil mensuel", projectId: "p-agenda", statusId: "s1", taskTypeId: "tt3", start: J(3), end: J(3), startTime: "14:00", endTime: "15:30" },
      { id: "t13", title: "Rappeler le plombier", projectId: "p-lot2b", statusId: "s1", taskTypeId: "tt1", assignee: "Maïa Sonnier" },
      { id: "t14", title: "Relancer le bureau d'études sur CTEX6", statusId: "s1", taskTypeId: "tt1", start: J(1), end: J(2), source: "assistant", assignee: "Vincent Bernard", lastInteraction: new Date().toISOString() },
    ],
    "nexora:dashboards": [{ id: "db1", name: "Pilotage chantiers", pages: [{ id: "pg1", name: "Semaine", widgets: [
      { id: "w1", type: "note", title: "Consignes de la semaine", content: "## Priorités\n- [x] Relancer le bureau de contrôle\n- [ ] Préparer la visite **DREAL**\n:::callout-warning Attention\nAccès chantier fermé jeudi.\n:::\nVoir [le plan](https://example.invalid/plan)." },
      { id: "w2", type: "chart", title: "Statuts" },
    ] }] }],
    "nexora:taskBaselines": { t10: { start: J(3), end: J(10), capturedAt: J(-20) } },
    "nexora:taskArchive": [
      { id: "t0", title: "Ancienne relance fournisseur", projectId: "p-ctex6", statusId: "s5", taskTypeId: "tt1", start: J(-90), end: J(-85), archivedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: "t0b", title: "Réunion de lancement (doublon)", projectId: "p-lot2b", statusId: "s1", taskTypeId: "tt1", start: J(-40), end: J(-40), archivedAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "t0c", title: "Brouillon de newsletter de septembre", projectId: "p-com", statusId: "s5", taskTypeId: "tt1", start: J(-30), end: J(-25), archivedAt: new Date(Date.now() - 12 * 86400000).toISOString() },
    ],
    "nexora:favorites": [{ type: "project", id: "p-ctex6" }],
    "nexora:metaFilters": { showDone: true },
    "nexora:taskDefaults": { assignee: "Quentin Morel", assigneeDefaulted: true },
  };
}

// Rapports FICTIFS de l'assistant pour la démonstration.
export function rapportsDemo(jour: string) {
  return {
    matin: {
      reportId: `${jour}-morning`,
      summary: { emailsAnalyzed: 23, emailsMarkedImportant: 4, tasksCreated: 3, tasksUpdated: 2, duplicatesAvoided: 1, errors: 0 },
      rows: [{ occurredAt: `${jour}T05:12:00Z`, treatment: "Relance du bureau de contrôle (e-mail de M. Durand)", result: "task_created" }],
      budget: { ok: true, remaining: 412, expenses: 1688, overBudget: [{ category: "Restaurants" }], toCategorize: 2 },
    },
    soir: null,
  };
}
