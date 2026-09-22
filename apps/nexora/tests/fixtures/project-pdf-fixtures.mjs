/* Jeux de données de la « Fiche projet PDF » (#291).

   maiaCatalogs : instantané du projet réel « Médiation Maïa Sonnier », lu en
   lecture seule via le connecteur Nexora le 2026-09-22 (catalogues statuts,
   types, criticités et membres concernés). Seuls les champs lus par l'export
   sont conservés ; les descriptions, absentes de la fiche projet, sont
   omises. Ce n'est PAS une source de vérité : la recette relit les données au
   moment de l'exécution, cet instantané ne sert qu'aux tests hors ligne.

   longCatalogs : projet synthétique volontairement chargé (titres longs,
   dépendances, correspondance inter-projets, tâche partagée, avatars) pour
   éprouver la pagination et l'absence de chevauchement. */

export const MAIA_TODAY = "2026-09-22";

export const statuses = [
  { id: "s3", name: "En cours", color: "#0EA5E9" },
  { id: "s1", name: "À planifier", color: "#F2A93B" },
  { id: "s2", name: "Attente tiers", color: "#8B5CF6" },
  { id: "s5", name: "Terminé", color: "#22B07D" },
  { id: "g03vvqgk", name: "Attente CNR", color: "#D64545" },
  { id: "rghlhivf", name: "Suivi", color: "#EC4899" },
  { id: "32ubbqws", name: "OK", color: "#22B07D" },
  { id: "hz9o5j2s", name: "Planifié", color: "#64748B" },
];

export const taskTypes = [
  { id: "tt1", name: "Tâches", color: "#4F6AF5", locked: true },
  { id: "tt2", name: "Planning", color: "#F2A93B", locked: true },
  { id: "tt3", name: "Réunions", color: "#8B5CF6", locked: true },
  { id: "tt-information", name: "Information", color: "#8B5CF6", locked: true },
];

export const teamMembers = [
  { id: "u1", name: "Quentin", color: "#869afe", avatarDataUrl: null },
  { id: "jq67emdh", name: "Externes", color: "#adfe16", avatarDataUrl: "🚧" },
  { id: "jhrypbsw", name: "Alexis", color: "#4F6AF5", avatarDataUrl: "tabler:world|#7C5CFF" },
  { id: "1i0ff26i", name: "Eric L.", color: "#F97316", avatarDataUrl: null },
];

const maiaProject = { id: "qjah9det", name: "Médiation Maïa Sonnier", icon: "tabler:route", color: "#14B8A6", folderId: "6mn3w42z", disabledStatusIds: [] };

export const maiaTasks = [
  { id: "mcp-785ed246-fcf3-4603-97c6-539add5f644d", projectId: "qjah9det", secondaryProjectId: null, title: "Réunion expertise amiable Maïa-CNR", taskTypeId: "tt3", statusId: "s5", criticality: null, milestone: true, progress: 100, start: "2026-09-18", end: "2026-09-18", assignee: "Quentin", dependsOn: [] },
  { id: "otuvnuln", projectId: "qjah9det", secondaryProjectId: null, title: "Envoyer la dernière note PN", taskTypeId: "tt1", statusId: "s3", criticality: "urgent", milestone: true, progress: 0, start: "2026-09-18", end: "2026-09-18", assignee: "", dependsOn: [] },
  { id: "he4fp0a2", projectId: "qjah9det", secondaryProjectId: null, title: "Fournir Note de Synthèse des bétons", taskTypeId: "tt1", statusId: "s3", criticality: null, milestone: false, progress: 0, start: "2026-09-18", end: "2026-09-30", assignee: "Quentin", dependsOn: [] },
  { id: "sht38kle", projectId: "qjah9det", secondaryProjectId: null, title: "Deadline Envois Docs Expertise", taskTypeId: "tt1", statusId: "s3", criticality: null, milestone: true, progress: 0, start: "2026-09-30", end: "2026-09-30", assignee: "", dependsOn: [] },
  { id: "hcibn9if", projectId: "qjah9det", secondaryProjectId: null, title: "Rapport des Experts", taskTypeId: "tt1", statusId: "s2", criticality: "moyen", milestone: true, progress: 0, start: "2026-11-30", end: "2026-11-30", assignee: "", dependsOn: [] },
];

const otherProject = { id: "odal4s58", name: "Comparaison DREAL", icon: "tabler:route", color: "#6ea5f2" };

export const maiaCatalogs = {
  projects: [maiaProject, otherProject],
  statuses, taskTypes, teamMembers,
  tasks: [...maiaTasks, { id: "x1", projectId: "odal4s58", title: "Tâche d'un autre projet", taskTypeId: "tt1", statusId: "s3", milestone: false, start: "2026-09-01", end: "2026-09-10", dependsOn: [] }],
};

// --- Projet long ------------------------------------------------------------
const PX = "#1x9";
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPI+SmAFTEMLQkAhuRdQW1asMwAAAAASUVORK5CYII=";

export function makeLongCatalogs() {
  const project = { id: PX, name: "Réhabilitation de l'usine hydroélectrique — Lot génie civil & équipements", icon: "tabler:route", color: "#EC4899", disabledStatusIds: [] };
  const partner = { id: "partner", name: "Bouclage DREAL", icon: "tabler:route", color: "#F97316" };
  const members = [...teamMembers, { id: "m-av", name: "Chiara Bellini", color: "#6df910", avatarDataUrl: TINY_PNG }];
  const titles = [
    "Lancement", "Revue des pièces contractuelles et du planning directeur", "Relevés topographiques", "Diagnostic structure",
    "Note d'hypothèses géotechniques complémentaire pour les parois moulées et les tirants d'ancrage", "Réunion de cadrage avec l'exploitant",
    "Plan d'installation de chantier", "Validation DREAL du dossier d'autorisation environnementale", "Consultation des entreprises",
    "Analyse des offres", "Attribution", "Préparation de chantier", "Démolition des ouvrages annexes", "Terrassements généraux",
    "Coulage radier", "Voiles et poteaux niveau 0", "Contrôle extérieur béton", "Pose des vannes", "Essais à vide des groupes",
    "Réception partielle", "Levée des réserves", "Dossier des ouvrages exécutés", "Mise en service industrielle", "Réception finale",
    "Rapport de synthèse d'exploitation et retour d'expérience pour les futurs lots", "Clôture administrative",
  ];
  const assignees = ["Quentin", "Chiara Bellini", "Alexis", "Externes", "Eric L.", ""];
  const tasks = titles.map((title, i) => {
    const start = addDays("2026-06-01", i * 9);
    const milestone = /Lancement|Attribution|Réception|Clôture|Validation/.test(title);
    const end = milestone ? start : addDays(start, 12 + (i % 4) * 6);
    const statusId = end < "2026-09-01" ? "s5" : i % 7 === 0 ? "s2" : i % 5 === 0 ? "g03vvqgk" : end < "2026-11-15" ? "s3" : "s1";
    return {
      id: `L${i}`, projectId: PX, secondaryProjectId: i === 7 ? "partner" : null, title,
      taskTypeId: ["tt1", "tt2", "tt3", "tt-information"][i % 4], statusId,
      criticality: i % 6 === 0 ? "urgent" : i % 6 === 2 ? "moyen" : i % 6 === 4 ? "bas" : null,
      milestone, progress: statusId === "s5" ? 100 : (i * 13) % 90, start, end,
      assignee: assignees[i % assignees.length], dependsOn: i > 0 && i % 3 === 0 ? [`L${i - 1}`] : [],
    };
  });
  tasks.push({ id: "P1", projectId: "partner", title: "Arrêté préfectoral", taskTypeId: "tt1", statusId: "s3", milestone: true, start: "2026-07-20", end: "2026-07-20", dependsOn: [] });
  tasks[9].dependsOn = ["P1"];
  return { projects: [project, partner], statuses, taskTypes, teamMembers: members, tasks };
}

export const LONG_PROJECT_ID = PX;

// --- Fiche mémo (#289) --------------------------------------------------------
// Tâche synthétique complète : toutes les sections de la fiche mémo.
export const memoRichTask = {
  id: "memo-1", projectId: "qjah9det", title: "Préparer le dossier de réponse aux experts",
  taskTypeId: "tt1", statusId: "s3", criticality: "urgent", milestone: false,
  start: "2026-09-14", end: "2026-10-09", progress: 35, assignee: "Quentin",
  desc: [
    "## Objectif",
    "Consolider les **pièces contractuelles** et la note de synthèse avant l'envoi aux experts.",
    "",
    "> [!warning] Point d'attention",
    "> Les annexes béton doivent être *signées* avant envoi.",
    "",
    "- Rassembler les PV de réunion",
    "- Vérifier la cohérence avec le planning directeur",
    "- [x] Relire la note PN",
    "- [ ] Joindre les photos du chantier",
    "",
    "| Pièce | Responsable | État |",
    "| --- | --- | --- |",
    "| Note de synthèse | Quentin | En cours |",
    "| Annexes béton | Externes | À faire |",
  ].join("\n"),
  checklist: [
    { id: "c1", text: "Collecter les PV des trois dernières réunions", done: true, end: "2026-09-18" },
    { id: "c2", text: "Rédiger la note de synthèse des bétons", done: false, end: "2026-09-30" },
    { id: "c3", text: "Faire valider le dossier par la direction juridique avant l'envoi définitif aux experts", done: false, end: "2026-10-07" },
  ],
  attachments: [{ name: "Protocole d'expertise.pdf", type: "file" }, { name: "Planning directeur", type: "link" }],
  dependsOn: ["he4fp0a2"],
};

export const memoCatalogs = {
  projects: maiaCatalogs.projects, statuses, taskTypes, teamMembers, tasks: maiaTasks,
  criticalities: [
    { id: "bas", name: "Bas", color: "#1FA971" },
    { id: "moyen", name: "Moyen", color: "#D97706" },
    { id: "urgent", name: "Urgent", color: "#DC2626" },
  ],
};
