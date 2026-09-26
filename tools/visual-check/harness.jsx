// ---- Banc d'essai local (scratchpad, jamais committé) : monte le Mini-Gantt
// sur les données de démonstration, sans Firebase.
// Un PNG transparent de 1×1, en ligne : aucune requête réseau, donc un contrôle
// qui donne le même résultat partout (issue #70).
const HARNESS_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/* Un widget de chaque type qui consomme des tâches (issue #72). Ils sont montés
   AVEC UNE LISTE VIDE : c'est le cas que le filtre texte de la barre du haut a
   rendu possible sur les tableaux de bord, et qu'aucun d'eux ne rencontrait
   avant. */
const EMPTY_DASHBOARD_WIDGETS = [
  "chart", "list", "minigantt", "bubbles", "criticalPath", "heatmapMonth",
  "nextBestAction", "dailyBriefing", "dominoEffect", "projectTreemap",
  "heatmapGrid", "embedMetro", "embedTimeline", "embedRadar", "embedCarte", "embedCosmos",
  "customCard",
].map((type, i) => ({ id: `vide-${type}`, type, title: type, layout: { x: (i % 4) * 3, y: Math.floor(i / 4) * 4, w: 3, h: 4 } }))
  // Ceux-là ne se montent qu'avec une cible désignée : c'est justement le cas
  // où le filtre peut la faire disparaître de la liste (issue #72).
  .concat([
    { id: "vide-taskDetail", type: "taskDetail", title: "taskDetail", taskDetailTaskId: "t1", layout: { x: 0, y: 40, w: 3, h: 4 } },
    { id: "vide-countdown-task", type: "customCard", title: "countdown", cardBlocks: [{ id: "cdb1", kind: "daysRemaining", countdownMode: "task", countdownTaskId: "t1" }], layout: { x: 3, y: 40, w: 3, h: 4 } },
    { id: "vide-countdown-filtre", type: "customCard", title: "countdown filtre", cardBlocks: [{ id: "cdb2", kind: "daysRemaining", countdownMode: "filter" }], layout: { x: 6, y: 40, w: 3, h: 4 } },
    // #439 : Cosmos (complet) à sa taille d'exploration, sans bandeau.
    { id: "vide-cosmos-large", type: "embedCosmos", title: "Cosmos (complet)", layout: { x: 0, y: 48, w: 12, h: 14 } },
    // #515 : Fleuve du temps (complet), vide : message « fleuve calme ».
    { id: "vide-fleuve-large", type: "embedFleuve", title: "Fleuve du temps (complet)", layout: { x: 0, y: 76, w: 12, h: 14 } },
    // #454 : Timeline 3D (complet), même taille d'exploration.
    { id: "vide-t3d-large", type: "embedTimeline3d", title: "Timeline 3D (complet)", layout: { x: 0, y: 62, w: 12, h: 14 } },
  ]);

function AnnotationsHarness() {
  // Les risques de délai vivent sur la tâche : ils doivent apparaître dans
  // TOUS les Mini-Gantt qui affichent cette tâche, quelle que soit la
  // configuration de chaque widget.
  const seedWithRisks = seedTasks.map((t) => {
    if (t.id === "t1") return { ...t, delayRisks: [
      { id: "rk1", title: "Fournisseur", severity: "high", style: "hatched", },
      { id: "rk2", title: "Météo", severity: "low", style: "dashed", color: "#F2A93B" },
    ] };
    // Deux risques qui SE CHEVAUCHENT dans le temps : leurs couloirs s'empilent
    // sur deux niveaux. Leurs étiquettes, elles, doivent rester lisibles.
    if (t.id === "t4") return { ...t, delayRisks: [
      { id: "rk3", title: "Validation tardive", severity: "medium", style: "solid", color: "#8B5CF6", startOffset: 0, endOffset: 6 },
      { id: "rk4", title: "Reprise dossier", severity: "high", style: "hatched", startOffset: 0, endOffset: 6 },
    ] };
    return t;
  }).map((t) => {
    /* Mode Comparaison : des dates de référence portées par la TÂCHE. Elles ne
       doivent rien changer tant qu'un widget n'est pas réglé sur
       « Comparaison » — les contrôles des autres Mini-Gantt ci-dessous le
       vérifient en restant à l'identique. */
    if (t.id === "t1") return { ...t, comparison: { enabled: true, referenceStart: "2026-07-20", referenceEnd: "2026-08-28" } };   // retard de 13 j
    if (t.id === "t2") return { ...t, comparison: { enabled: true, referenceStart: "2026-07-30", referenceEnd: "2026-08-08" } };   // avance au début et à la fin
    if (t.id === "t4") return { ...t, comparison: { enabled: true, referenceStart: "2026-07-13", referenceEnd: "2026-08-20" } };   // conforme
    if (t.id === "t6") return { ...t, comparison: { enabled: true, referenceStart: "2026-07-20", referenceEnd: "2026-08-10" } };   // décalage intégral
    // Démarrée à l'heure, TERMINÉE PLUS TÔT : la seule avance visible est celle
    // de la fin. C'est ce cas qui ne montrait rien de vert à l'écran.
    // …et TERMINÉE : à 100 %, la poignée d'avancement devient une pastille de
    // validation au lieu du rond blanc.
    if (t.id === "t5") return { ...t, progress: 100, comparison: { enabled: true, referenceStart: "2026-08-01", referenceEnd: "2026-09-02" } };
    if (t.id === "t3") return { ...t, comparison: { enabled: true, referenceEnd: "2026-09-10" } };                                 // jalon en retard
    // t7 : jalon SANS référence — il doit garder le rendu standard dans le
    // même widget, sans erreur et sans changer de hauteur.
    return t;
  });
  // Projet adossé à Google Calendar : sa tâche porte le réglage « méta bloc »
  // coché depuis la fiche de tâche. Le bloc doit apparaître dans les Mini-Gantt
  // sans être déclaré nulle part ailleurs.
  const calendarProject = { id: "p4", name: "Agenda perso", icon: "📅", color: "#0EA5E9", gcalSource: true, gcalCalendarId: "cal-perso" };
  const calendarTask = {
    id: "t8", projectId: "p4", statusId: "s1", title: "Congés d'août", desc: "",
    start: "2026-08-05", end: "2026-08-19", progress: 0, milestone: false, assignee: "Quentin", checklist: [],
    googleEventId: "ev-conges", gcalImported: true, gcalCalendarId: "cal-perso",
    metaBlock: { enabled: true, kind: "phase", color: "#8B5CF6", borderStyle: "solid", dashboardIds: null },
  };
  /* Jalon PRÉCOCE, volontairement placé entre deux barres : tant que les jalons
     étaient rendus après toutes les barres, il se retrouvait en bas du widget.
     C'est lui qui prouve que l'ordre mêle bien les deux. */
  const earlyMilestone = {
    id: "t9", projectId: "p1", statusId: "s1", title: "Ordre de service", desc: "",
    start: "2026-07-15", end: "2026-07-15", progress: 0, milestone: true, assignee: "Quentin", checklist: [],
  };
  const [tasks, setTasks] = useState([...seedWithRisks, calendarTask, earlyMilestone]);
  /* Scénario « tâches en retard » de la Heat map croisée : les tâches de
     démonstration ont des dates FIXES, que le calendrier finit par dépasser —
     elles deviennent toutes en retard et la case à zéro disparaît (#298). Deux
     tâches à échéance FUTURE, calculée depuis aujourd'hui, garantissent un
     croisement qui porte des tâches sans qu'aucune soit en retard. */
  const lateScenarioTasks = useMemo(() => {
    const dansJours = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
    const modele = tasks.find((t) => t.id === "t2") || tasks[0];
    return [
      ...tasks,
      { ...modele, id: "hm-futur-1", title: "Livraison à venir", start: dansJours(35), end: dansJours(40), progress: 0, delayRisks: [], comparison: undefined },
      { ...modele, id: "hm-futur-2", title: "Réception à venir", start: dansJours(38), end: dansJours(42), progress: 0, delayRisks: [], comparison: undefined },
    ];
  }, [tasks]);
  /* Colonne d'étiquettes calée sur son contenu (retour de test). Des titres
     COURTS dans un diagramme LARGE : c'est le cas où les 26 % figés laissaient
     cent cinquante pixels de blanc entre le dernier mot et la piste. Le projet
     n'est pas affiché à côté du titre — il compterait dans la mesure et
     masquerait le défaut. */
  const shortTitleTasks = seedWithRisks
    .filter((t) => ["t1", "t2", "t4", "t5"].includes(t.id))
    .map((t, i) => ({ ...t, projectId: "p1", title: ["Étude", "Appel d'offres", "Chantier", "Réception"][i], delayRisks: [], comparison: null }));
  /* Dernière ligne coupée (retour de test). Une ligne peint SOUS sa boîte — rail
     de comparaison, couloir de risque, étiquette de risque — dans l'interligne
     de la suivante ; la dernière n'en a pas, et le widget coupe à son bord. Ce
     jeu-là met donc tout cela sur la ligne du BAS : c'est le seul moyen de voir
     si la réserve de pied la rattrape. */
  const tailTasks = [
    ...seedWithRisks.filter((t) => t.id === "t1" || t.id === "t2").map((t) => ({ ...t, delayRisks: [], comparison: null })),
    // Calée AVANT la fin de l'axe (que « t1 » tient au 10 septembre) : une
    // étiquette de risque qui déborderait de la piste ne serait pas placée du
    // tout, et le cas d'espèce s'évaporerait.
    { ...seedWithRisks.find((t) => t.id === "t4"), start: "2026-08-18", end: "2026-08-24" },
  ];
  const [projects, setProjects] = useState([...seedProjects, calendarProject]);
  const [statuses, setStatuses] = useState(seedStatuses);
  const [harnessMilestoneTypes, setHarnessMilestoneTypes] = useState([
    ...MILESTONE_TYPE_SEED,
    { id: "custom-essais", name: "Essais de mise en eau", symbol: "droplet", color: "#0EA5E9" },
  ]);
  /* Widget « Charge personnel » (#124) : le catalogue d'ateliers entre dans le
     contexte partagé, comme les statuts ou les types de jalon, et les
     affectations restent un état à part — c'est exactement le partage de
     l'application. */
  const [harnessWorkshops, setHarnessWorkshops] = useState(() => WORKSHOP_SEED.map((w) => ({ ...w })));
  const [staffing, setStaffing] = useState(() => {
    const [usine, bureau, chantier, atelier, formation, absence] = WORKSHOP_SEED.map((w) => w.id);
    const jour = (n) => "2026-09-" + String(n).padStart(2, "0");
    return [
      { member: seedTeamMembers[0].name, date: jour(14), workshops: [bureau] },
      { member: seedTeamMembers[0].name, date: jour(15), workshops: [bureau, chantier] },
      { member: seedTeamMembers[0].name, date: jour(17), workshops: [formation, chantier, usine, bureau] },
      { member: seedTeamMembers[1].name, date: jour(14), workshops: [usine] },
      { member: seedTeamMembers[1].name, date: jour(16), workshops: [bureau, usine] },
      { member: seedTeamMembers[1].name, date: jour(19), workshops: [chantier] },
      { member: seedTeamMembers[2 % seedTeamMembers.length].name, date: jour(16), workshops: [atelier] },
      { member: seedTeamMembers[2 % seedTeamMembers.length].name, date: jour(18), workshops: [absence] },
    ];
  });
  /* Organigramme « Métro » (#295) : jeu d'équipes et de personnes FICTIF,
     propre au banc — lignes racines, sous-équipes sur trois niveaux, une
     équipe transverse, une chaîne de managers, une personne multi-équipe, un
     nom long et une personne sans équipe. */
  const [orgTeams, setOrgTeams] = useState(() => [
    { id: "o-prod", name: "Produit", color: "#E2A63B", leadName: "Camille Aubert" },
    { id: "o-core", name: "Cœur produit", color: "#E2A63B", parentTeamId: "o-prod", leadName: "Hugo Lemaire" },
    { id: "o-disc", name: "Exploration", color: "#E2A63B", parentTeamId: "o-prod", leadName: "Inès Garnier" },
    { id: "o-tech", name: "Technique", color: "#2C6BE0", leadName: "Paul Mercier" },
    { id: "o-plat", name: "Plateforme", color: "#2C6BE0", parentTeamId: "o-tech", leadName: "Zoé Faure", leadTitle: "Responsable de lot" },
    { id: "o-secu", name: "Sécurité", color: "#2C6BE0", parentTeamId: "o-plat" },
    { id: "o-apps", name: "Applications", color: "#2C6BE0", parentTeamId: "o-tech", leadName: "Nora Vidal" },
    { id: "o-data", name: "Données", color: "#D64545", parentTeamId: "o-tech", parentLinkType: "transverse", transverseSide: "right", extraLinkTeamIds: ["o-ops", "o-disc"], extraLinkTypes: { "o-disc": "hierarchique" } },
    { id: "o-ops", name: "Opérations", color: "#1FA971", leadName: "Luc Perrin" },
    // Équipe rattachée à un UTILISATEUR : Sacha Morin, occurrence Applications.
    { id: "o-lab", name: "Laboratoire", color: "#8B5CF6", parentTeamId: "o-apps", parentMemberName: "Sacha Morin", leadName: "Ilan Roy" },
  ]);
  const [orgMembers, setOrgMembers] = useState(() => [
    { id: "om1", name: "Camille Aubert", teamIds: ["o-prod"], teamRoles: { "o-prod": "Directrice produit" } },
    { id: "om2", name: "Hugo Lemaire", teamIds: ["o-core"], teamRoles: { "o-core": "Lead produit" } },
    { id: "om3", name: "Emma Roux", teamIds: ["o-core"] },
    { id: "om4", name: "Inès Garnier", teamIds: ["o-disc"] },
    { id: "om5", name: "Jules Brun", teamIds: ["o-disc"] },
    { id: "om6", name: "Nora Vidal", teamIds: ["o-disc"], teamRoles: { "o-disc": "Chercheuse UX" } },
    { id: "om7", name: "Adam Colin", managerName: "Nora Vidal", teamIds: ["o-disc"] },
    { id: "om8", name: "Lina Masson", managerName: "Nora Vidal" },
    { id: "om9", name: "Rayan Noël", managerName: "Adam Colin" },
    { id: "om10", name: "Paul Mercier", teamIds: ["o-tech"], teamRoles: { "o-tech": "Directeur technique" } },
    { id: "om11", name: "Zoé Faure", teamIds: ["o-plat"] },
    { id: "om12", name: "Marie-Charlotte de La Rochefoucauld-Montmorency", teamIds: ["o-plat"], teamRoles: { "o-plat": "Ingénieure fiabilité et observabilité des services" } },
    { id: "om13", name: "Théo Lambert", teamIds: ["o-secu"] },
    { id: "om14", name: "Sacha Morin", teamIds: ["o-apps", "o-data"] },
    { id: "om15", name: "Léna Robin", teamIds: ["o-apps"] },
    { id: "om16", name: "Yanis Petit", teamIds: ["o-data"] },
    { id: "om17", name: "Luc Perrin", teamIds: ["o-ops"] },
    { id: "om18", name: "Eva Moulin", teamIds: ["o-ops"] },
    { id: "om19", name: "Sans rattachement", teamIds: [] },
    { id: "om20", name: "Ilan Roy", teamIds: ["o-lab"] },
  ]);
  const [orgWidget, setOrgWidget] = useState({
    id: "w-orgmetro", type: "orgchart",
    // Utilisateurs inactifs propres au widget.
    orgChartInactiveMembers: ["om5"],
    // Équipe Opérations en disposition horizontale.
    orgMetroHorizontalTeams: ["o-ops"],
    // Relations propres au widget : équipe → équipe, personne → personne,
    // équipe → personne (sans légende).
    orgChartRelations: [
      { id: "r1", from: "team:o-ops", to: "team:o-prod", label: "Support" },
      { id: "r2", from: "person:Paul Mercier", to: "person:Camille Aubert", label: "Binôme" },
      { id: "r3", from: "team:o-data", to: "person:Hugo Lemaire" },
      // Sacha Morin apparaît dans Applications et dans Données : la relation
      // vise son occurrence dans Applications.
      { id: "r4", from: "person:Luc Perrin", to: "person:Sacha Morin", toAt: "o-apps", label: "Astreinte" },
    ],
  });
  const orgCtx = { teams: orgTeams, teamMembers: orgMembers, teamFolders: [], tasks: [], workshops: [], statuses };
  // Fiche du 3e widget Organigramme : réglage « Disposition des équipes ».
  const [stackWidget, setStackWidget] = useState({ id: "w-orgmetro-3", type: "orgchart", title: "Organigramme", orgMetroStackedTeams: ["o-tech"], orgMetroHorizontalTeams: [] });
  const [stackFormOpen, setStackFormOpen] = useState(false);
  const ctx = { projects, statuses, taskTypes: seedTaskTypes, milestoneTypes: harnessMilestoneTypes, workshops: harnessWorkshops, tasks, teamMembers: seedTeamMembers, projectFolders: [], expenses: [], myName: null };
  const appearance = { gradient: { enabled: true, from: "#FF7A3D", to: "#1FA971" }, ganttBg: "#EAEDF3", barBg: "#C7CED9", progressColorByStatus: false, accentColor: "#FF7A3D", density: "comfortable", milestoneStyle: "flag", radiusStyle: "sharp", progressTexture: false, ganttShowSubtasks: false, viewIcons: {} };
  const annotations = {
    temporalBlocks: [
      { id: "b1", title: "Études", startDate: "2026-07-13", endDate: "2026-08-20", color: "#4F6AF5", borderStyle: "dashed" },
      { id: "b2", title: "Gros œuvre", startDate: "2026-08-21", endDate: "2026-09-20", color: "#22B07D", borderStyle: "solid", borderWidth: 4 },
    ],
    highlightFrames: [
      { id: "f1", label: "Lot critique", taskIds: ["t1", "t2"], color: "#D64545", borderStyle: "dashed", padding: 4 },
      { id: "f2", label: "Jalons clés", taskIds: ["t4", "t6"], color: "#8B5CF6", borderStyle: "solid", padding: 3 },
    ],
  };
  // Pilotage : fenêtre de décision, jalons typés, risques successifs, annotation.
  const miniAnnotations = {
    ...annotations,
    temporalBlocks: [
      ...annotations.temporalBlocks,
      { id: "b3", title: "Validation budget", startDate: "2026-08-24", endDate: "2026-08-28", kind: "decision" },
    ],
    /* `rule` : le trait vertical pleine hauteur, propre à CHAQUE jalon (#95).
       Deux repères sur quatre le portent — dont « Essais en eau », que la
       bande range sur un second couloir : son trait doit partir de SON losange,
       pas du premier couloir. L'un des deux porte une épaisseur propre — elle
       aussi se règle jalon par jalon —, l'autre garde le défaut. */
    milestones: [
      { id: "ms1", title: "Décision CODIR", date: "2026-08-18", type: "decision", rule: true, ruleThickness: 4 },
      { id: "ms2", title: "Mise en service", date: "2026-09-22", type: "commissioning" },
      // Type venu des Réglages, pas du catalogue de départ (#94), et jalon dont
      // le type a été SUPPRIMÉ : il doit retomber sur le premier, pas disparaître.
      { id: "ms3", title: "Essais en eau", date: "2026-08-28", type: "custom-essais", rule: true },
      { id: "ms4", title: "Type disparu", date: "2026-07-18", type: "type-supprime" },
    ],
    notes: [
      { id: "n1", title: "Relance hebdo", text: "Point fournisseur le lundi.", anchor: { kind: "task", id: "t2" } },
    ],
    /* Annotations horizontales (#93) : un trait d'une date à une autre, calé en
       hauteur sur une tâche. « sp2 » vise une tâche qui n'est PAS affichée : il
       ne doit rien dessiner, et surtout rien faire tomber. */
    spans: [
      { id: "sp1", label: "Fenêtre de tirage", startDate: "2026-08-03", endDate: "2026-09-04", taskId: "t2", color: "#0EA5E9", borderStyle: "solid", thickness: 2, position: "above", capStart: "bar", capEnd: "arrow" },
      { id: "sp2", label: "Tâche absente", startDate: "2026-08-03", endDate: "2026-08-20", taskId: "disparue" },
    ],
  };
  const [prefs, setPrefsState] = useState({ ganttGroupBy: "project", bubbleFields: ["status", "project"], ganttCols: ["status", "start", "end"], zoomKey: "week", ...annotations });
  const setPrefs = (patch) => setPrefsState((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const [miniWidget, setMiniWidget] = useState({ id: "w1", type: "minigantt", colorBy: "status", miniGanttFields: ["assignee", "status", "taskType", "end", "progress"], ganttAnnotations: miniAnnotations });
  // Second widget SANS aucune annotation propre : seuls les risques portés par
  // les tâches doivent y apparaître.
  const [otherWidget, setOtherWidget] = useState({ id: "w2", type: "minigantt", colorBy: "status", miniGanttFields: ["end"] });
  /* Widget « Bulles » (#92). Les deux macro-bulles sont volontairement
     imbriquées sur « t1 » : la seconde doit s'écarter de la première plutôt
     que de confondre son trait avec le sien. « m2 » porte des tâches non
     successives — deux enveloppes attendues. */
  const [bubbleWidget, setBubbleWidget] = useState({
    id: "wb1", type: "bubbles",
    bubbleColorBy: "status",
    bubbleFields: ["assignee", "status", "end"],
    bubbleFieldsLayout: "under",
    bubbleSize: "normal",
    bubbleShowDates: true,
    bubbleShowProgress: true,
    bubbleMacroGrouping: false,
    bubbleMacros: [
      { id: "m1", label: "Phase essais", color: "#245EDB", opacity: 14, borderStyle: "solid", borderWidth: 1.5, taskIds: ["t1", "t2"], showProgress: true },
      { id: "m2", label: "Marche probatoire", color: "#22B07D", opacity: 10, borderStyle: "dashed", borderWidth: 1.5, taskIds: ["t1", "t4"], showProgress: true },
    ],
  });
  // Méta blocs des Réglages : définis hors des widgets, ils doivent apparaître
  // dans le second Mini-Gantt qui n'a pourtant aucune annotation propre.
  const settingsMetaBlocks = [
    { id: "meta1", title: "Fermeture", startDate: "2026-08-24", endDate: "2026-08-31", color: "#F2A93B", borderStyle: "dashed" },
  ];
  // Source unique : les blocs des Réglages PLUS ceux portés par les tâches
  // calendrier — c'est ce que fait l'application avant d'appeler DashboardView.
  const metaBlocks = mergeMetaTemporalBlocks(settingsMetaBlocks, tasks);
  const dashboards = [{ id: "d1", name: "Chantier" }, { id: "d2", name: "Communication" }];
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  // Fiche de CRÉATION : c'est la seule qui cale la référence sur les dates
  // demandées. Le banc garde aussi ce que la fiche enregistre, pour vérifier
  // que la référence figée est bien celle qu'on voyait à l'écran.
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [createdTask, setCreatedTask] = useState(null);
  // Treemap projets : surface = tâches non terminées, couleur = tâches en
  // retard (second filtre), donc deux comptages réellement différents.
  const [treemapWidget, setTreemapWidget] = useState({
    id: "w3", type: "projectTreemap",
    treemapSizeFilter: { ...widgetDefaultFilter(), excludeDone: true },
    treemapColorFilter: { ...widgetDefaultFilter(), onlyLate: true },
    treemapColorMode: "secondaryFilterGradient",
    treemapFields: ["projectName", "sizeCount", "progress", "averageCriticality", "lateTaskCount", "dominantStatus"],
    treemapShowZeroProjects: true,
    treemapShowUpcoming: true,
  });
  const [treemapFormOpen, setTreemapFormOpen] = useState(false);
  /* Changer de tableau de bord (issue #58). Deux plans, dont un à deux pages :
     c'est ce qui distingue « Aujourd'hui » (page unique, nommée par son plan)
     de « Chantiers › Suivi ». Le banc n'écrit rien, il enregistre l'intention
     transmise par la fiche — c'est elle qui doit être juste. */
  const transferBoards = [
    { id: "today", name: "Aujourd'hui", pages: [{ id: "tp", name: "Aujourd'hui", widgets: [] }] },
    { id: "d1", name: "Chantiers", pages: [{ id: "p1", name: "Page 1", widgets: [treemapWidget] }, { id: "p2", name: "Suivi", widgets: [] }] },
    /* Au-delà de cinq destinations, la liste porte une recherche rapide — même
       seuil que les autres listes de Nexora (retour de Quentin sur #58). Le banc
       en compte donc sept, dont une accentuée pour éprouver la recherche sans
       accents. */
    { id: "d2", name: "Préfecture", pages: [{ id: "p3", name: "Réserves", widgets: [] }] },
    { id: "d3", name: "Communication", pages: [{ id: "p4", name: "Presse", widgets: [] }] },
    { id: "d4", name: "Budget", pages: [{ id: "p5", name: "Engagements", widgets: [] }, { id: "p6", name: "Factures", widgets: [] }] },
  ];
  const [transferDone, setTransferDone] = useState("");
  // Dates calculées À PARTIR D'AUJOURD'HUI, pour que les contrôles restent
  // vrais quel que soit le jour où le banc est lancé.
  const harnessToday = iso(new Date());
  /* Heat map mensuelle (#68) : une échéance passée et une à venir, pour que la
     distinction passé / futur ait de quoi se voir. Les dates sont relatives à
     aujourd'hui, donc le contrôle reste vrai quel que soit le jour. */
  const heatmapMonthTasks = [
    { id: "hm1", projectId: "p1", statusId: "s1", title: "Échéance passée", start: addDays(harnessToday, -20), end: addDays(harnessToday, -10), progress: 0, checklist: [] },
    { id: "hm2", projectId: "p2", statusId: "s2", title: "Échéance à venir", start: harnessToday, end: addDays(harnessToday, 5), progress: 0, checklist: [] },
  ];
  // Mêmes tâches, mais une tuile = un STATUT (issue #47) : c'est le câblage du
  // champ qui porte les tuiles, pas le pavage, qui est contrôlé ici.
  const [statusTreemapWidget, setStatusTreemapWidget] = useState({
    id: "w6", type: "projectTreemap", treemapTileBy: "status",
    treemapSizeFilter: widgetDefaultFilter(),
    treemapFields: ["projectName", "sizeCount", "progress", "budget", "folder"],
    treemapGroupBy: "folder",
    treemapShowLegend: false, treemapShowSearch: false,
  });
  const [statusTreemapFormOpen, setStatusTreemapFormOpen] = useState(false);
  // Heat map (issue #51) : projet × statut. « sc5 » n'a pas de statut renseigné
  // ici, mais toutes les tâches du jeu en ont un : ce qui compte, c'est que la
  // case vide et la case à zéro ne se ressemblent pas.
  const [heatmapWidget, setHeatmapWidget] = useState({
    id: "w8", type: "heatmapGrid", heatmapRowField: "project", heatmapColField: "status", heatmapMetric: "count",
  });
  const [heatmapFormOpen, setHeatmapFormOpen] = useState(false);
  const [heatmapOpenedTaskId, setHeatmapOpenedTaskId] = useState("");
  // Vue Métro : mêmes annotations que le Gantt, plus un encadré qui saute une
  // ligne de projet (p1 et p3) — il doit produire DEUX cadres, jamais un seul.
  const [metroPrefs, setMetroPrefs] = useState({
    fields: ["status"], collapsed: {}, zoomKey: "auto", networkMode: false, showRiskBadges: true,
    temporalBlocks: annotations.temporalBlocks,
    highlightFrames: [
      { id: "mf1", label: "Lot critique", taskIds: ["t1", "t4"], color: "#D64545", borderStyle: "dashed", padding: 4 },
      { id: "mf2", label: "Communication", taskIds: ["t6"], color: "#8B5CF6", borderStyle: "solid", padding: 3 },
    ],
    milestones: [{ id: "mms1", title: "Décision CODIR", date: "2026-08-18", type: "decision" }],
    notes: [{ id: "mn1", title: "Relance hebdo", text: "Point fournisseur le lundi.", anchor: { kind: "task", id: "t2" } }],
  });
  const [openedProjectId, setOpenedProjectId] = useState("");
  const [toolbar, setToolbar] = useState(null);
  const [metroWidgetToolbar, setMetroWidgetToolbar] = useState(null);
  // Fiche du widget, montée à la demande : elle sert à vérifier que les listes
  // déroulantes des annotations ne proposent que les tâches retenues par le
  // filtre du widget. Ici, le filtre ne garde que le projet « p2 ».
  const [formOpen, setFormOpen] = useState(false);
  /* Parité des réglages du Gantt (#86) : la fiche du widget et les réglages de
     la vue pleine page doivent proposer EXACTEMENT les mêmes commandes
     d'affichage. Les deux sont montés côte à côte sur un contexte qui porte un
     champ personnalisé — le regroupement doit le proposer des deux côtés. */
  const [ganttViewSettingsOpen, setGanttViewSettingsOpen] = useState(false);
  const [ganttWidgetFormOpen, setGanttWidgetFormOpen] = useState(false);
  const [ganttViewPrefs, setGanttViewPrefs] = useState(() => normalizeMiniGanttViewPrefs({ groupBy: "project" }));
  const parityCtx = ctx;
  const parityWidget = { id: "parite", type: "minigantt", title: "Mini-Gantt", groupBy: "project", colorBy: "status", miniGanttFields: ["end"] };
  const noop = () => {};
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 22 }}>
      <GlobalStyles />
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>VUE MÉTRO</h2>
        <div id="harness-metro" style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", width: 1100, height: 620, overflow: "hidden", marginBottom: 18 }}>
          <ProjectMetroView
            tasks={tasks}
            ctx={ctx}
            onOpen={noop}
            toolbarSlot={null}
            appearance={appearance}
            prefs={metroPrefs}
            setPrefs={(patch) => setMetroPrefs((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }))}
            setTasks={setTasks}
            pushToast={noop}
            expenses={[]}
            metaTemporalBlocks={settingsMetaBlocks}
            isHomepage={false}
            onSelectProject={noop}
            selectedProjectIds={[]}
            onToggleProject={noop}
          />
        </div>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>TABLEAU DE BORD SANS AUCUNE TÂCHE</h2>
        {/* Issue #72. Le filtre texte de la barre du haut peut réduire la liste
            des tâches à RIEN, ce qui n'arrivait jamais avant lui sur ces
            surfaces. Chaque widget doit le supporter : un seul qui suppose une
            liste non vide fait tomber la page entière, et c'est exactement ce
            que Quentin a vu en tapant dans la barre. */}
        <div id="harness-empty-dashboard" style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", width: 1200, height: 420, position: "relative", overflow: "auto", marginBottom: 18 }}>
          <DashboardView
            tasks={[]}
            ctx={ctx}
            widgets={EMPTY_DASHBOARD_WIDGETS}
            setWidgets={noop}
            onOpen={noop}
            toolbarSlot={null}
            tabsSlot={null}
            expenses={[]}
            expenseCategories={[]}
            dashboardName="Banc"
            appearance={appearance}
            momentumSnapshots={[]}
            onViewDay={noop}
            activityLog={[]}
            myName={null}
            pages={[{ id: "p1", name: "Page 1", widgets: EMPTY_DASHBOARD_WIDGETS }]}
            activePageId="p1"
            onSwitchPage={noop}
            onAddPage={noop}
            onRenamePage={noop}
            onDeletePage={noop}
            onDuplicatePage={noop}
            onUpdatePageFilter={noop}
            onUpdatePageMeta={noop}
            taskBaselines={{}}
            setTasks={noop}
            pushToast={noop}
            shortcutPrefs={{}}
            metaTemporalBlocks={[]}
            dashboardId="d1"
            onOpenProject={noop}
            onEditProject={noop}
            boardId="d1"
            transferBoards={[]}
            onTransferWidget={noop}
          />
        </div>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>HEAT MAP MENSUELLE</h2>
        {/* Le MÊME widget à deux largeurs (#68) : les mois se replient dans
            le volet calendrier (#286 : calendrier | liste | détail) plutôt que
            de déborder derrière une barre de défilement. */}
        <div id="harness-heatmap-month-large" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 1200, height: 320, marginBottom: 14 }}>
          <WidgetHeatmapMonth tasks={heatmapMonthTasks} ctx={ctx} onOpen={noop} appearance={appearance} />
        </div>
        <div id="harness-heatmap-month-etroit" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 420, height: 520, marginBottom: 18 }}>
          <WidgetHeatmapMonth tasks={heatmapMonthTasks} ctx={ctx} onOpen={noop} appearance={appearance} />
        </div>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>ICÔNES PAR URL</h2>
        {/* Issue #70. Des images EN LIGNE (data:), pour que le contrôle reste
            hors réseau et déterministe : ce qu'on vérifie n'est pas qu'un CDN
            répond, mais que la reconnaissance de l'URL ne dépend ni de la casse
            ni des espaces, et qu'un chargement raté tombe sur un repli. */}
        <div id="harness-icon-urls" style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
          <span data-icon="minuscule"><IconGlyph icon={HARNESS_PNG} size={16} /></span>
          <span data-icon="majuscule"><IconGlyph icon={HARNESS_PNG.replace("data:image/png", "DATA:IMAGE/PNG")} size={16} /></span>
          <span data-icon="espaces"><IconGlyph icon={"   " + HARNESS_PNG + "  "} size={16} /></span>
          {/* Servie en 404 par le serveur du banc : le repli ne peut s'éprouver
              qu'avec un chargement qui échoue POUR DE VRAI. */}
          <span data-icon="casse"><IconGlyph icon={location.origin + "/icone-volontairement-cassee.png"} size={16} /></span>
        </div>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>MÉTRO EN WIDGET</h2>
        {/* La MÊME vue, mais embarquée dans la structure réelle d'un widget de
            tableau de bord : carte, bandeau de paramètres, corps défilant. Les
            en-têtes collants du planning se calent sur la barre d'onglets de la
            page — qui n'existe pas ici. Sans repli à zéro, l'axe des dates se
            fige 82 px sous le bandeau et les lignes défilent à découvert dans
            cette bande (issue #56). */}
        <div id="harness-metro-widget" className="lp-widget-card" style={{ position: "relative", width: 760, height: 320, marginBottom: 18 }}>
          <div className="lp-widget-head">
            <span className="lp-widget-title">Métro (complet) 1</span>
            <span className="lp-view-toolbar-slot" ref={setMetroWidgetToolbar} />
          </div>
          <div className="lp-widget-body">
            <div className="lp-widget-embed">
              <div className="lp-widget-embed-body">
                <ProjectMetroView
                  tasks={tasks} ctx={ctx} onOpen={noop} toolbarSlot={metroWidgetToolbar} appearance={appearance}
                  prefs={metroPrefs}
                  setPrefs={(patch) => setMetroPrefs((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }))}
                  setTasks={setTasks} pushToast={noop} expenses={[]} metaTemporalBlocks={settingsMetaBlocks}
                  embedded isHomepage={false} onSelectProject={noop} selectedProjectIds={[]} onToggleProject={noop}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>ORGANIGRAMME MÉTRO (#295)</h2>
        <div id="harness-orgmetro" style={{ width: 1200, height: 720, marginBottom: 18 }}>
          <WidgetOrgChart
            widget={orgWidget} ctx={orgCtx} staffing={[]} onFilterPerson={noop}
            setTeams={setOrgTeams} setTeamMembers={setOrgMembers} setTeamFolders={noop} setTasks={noop} pushToast={noop}
            onUpdateWidget={(patch) => setOrgWidget((w) => ({ ...w, ...patch }))}
          />
        </div>
        <div id="harness-orgmetro-narrow" style={{ width: 380, height: 560, marginBottom: 18 }}>
          <WidgetOrgChart widget={{ id: "w-orgmetro-2", type: "orgchart" }} ctx={orgCtx} staffing={[]} onFilterPerson={noop} />
        </div>
        <div id="harness-orgmetro-stacked" style={{ width: 1200, height: 900, marginBottom: 18 }}>
          <WidgetOrgChart widget={stackWidget} ctx={orgCtx} staffing={[]} onFilterPerson={noop} />
        </div>
        <button type="button" id="harness-open-orgchart-form" onClick={() => setStackFormOpen(true)} style={{ marginBottom: 8 }}>Ouvrir la fiche de l'Organigramme</button>
        <div>
          {stackFormOpen && (
            <WidgetFormModal
              widget={stackWidget}
              existingWidgets={[]}
              ctx={{ ...ctx, ...orgCtx }}
              pageFilter={null}
              onSave={(data) => { setStackWidget((w) => ({ ...w, ...data })); setStackFormOpen(false); }}
              onClose={() => setStackFormOpen(false)}
            />
          )}
        </div>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>TREEMAP PROJETS</h2>
        <button type="button" id="harness-open-treemap-form" onClick={() => setTreemapFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche du Treemap
        </button>
        <span id="harness-treemap-opened" style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 12 }}>{openedProjectId}</span>
        <div id="harness-treemap" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, height: 340, marginBottom: 18 }}>
          <WidgetProjectTreemap
            widget={treemapWidget}
            tasks={tasks}
            ctx={ctx}
            expenses={[]}
            onOpenProject={(id) => setOpenedProjectId(id)}
            onEditProject={noop}
            onFilterProject={noop}
          />
        </div>
        {/* Le même widget, réduit à une bande : les tuiles doivent rester dans
            le cadre et se simplifier au lieu de déborder. */}
        <div id="harness-treemap-narrow" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 8, background: "var(--surface)", width: 300, height: 150, marginBottom: 18 }}>
          <WidgetProjectTreemap
            widget={{ ...treemapWidget, treemapShowSearch: false, treemapShowLegend: false, treemapCompact: true }}
            tasks={tasks} ctx={ctx} expenses={[]} onOpenProject={noop} onEditProject={noop} onFilterProject={noop}
          />
        </div>
        <span id="harness-transfer-done" style={{ fontFamily: "monospace", fontSize: 12 }}>{transferDone}</span>
        {treemapFormOpen && (
          <WidgetFormModal
            widget={treemapWidget}
            existingWidgets={[]}
            ctx={ctx}
            pageFilter={null}
            onSave={(data) => { setTreemapWidget((w) => ({ ...w, ...data })); setTreemapFormOpen(false); }}
            onClose={() => setTreemapFormOpen(false)}
            transferBoards={transferBoards}
            boardId="d1"
            currentPageId="p1"
            onTransfer={({ data, target, mode }) => {
              setTransferDone(`${mode}|${target.boardId}|${target.pageId}|${data.title}|${data.treemapShowUpcoming}`);
              setTreemapFormOpen(false);
            }}
          />
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>TREEMAP PAR STATUT</h2>
        <button type="button" id="harness-open-status-treemap-form" onClick={() => setStatusTreemapFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche du Treemap par statut
        </button>
        <div id="harness-treemap-status" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, height: 300, marginBottom: 18 }}>
          <WidgetProjectTreemap
            widget={statusTreemapWidget}
            tasks={tasks} ctx={ctx} expenses={[]}
            onOpenProject={noop} onEditProject={noop} onFilterProject={noop}
          />
        </div>
        {statusTreemapFormOpen && (
          <WidgetFormModal
            widget={statusTreemapWidget}
            existingWidgets={[]}
            ctx={ctx}
            pageFilter={null}
            onSave={(data) => { setStatusTreemapWidget((w) => ({ ...w, ...data })); setStatusTreemapFormOpen(false); }}
            onClose={() => setStatusTreemapFormOpen(false)}
          />
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>HEAT MAP</h2>
        <button type="button" id="harness-open-heatmap-form" onClick={() => setHeatmapFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche de la Heat map
        </button>
        <span id="harness-heatmap-opened" style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 12 }}>{heatmapOpenedTaskId}</span>
        <div id="harness-heatmap" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 760, height: 260, marginBottom: 18 }}>
          <WidgetHeatmapGrid widget={heatmapWidget} tasks={tasks} ctx={ctx} onOpen={(t) => setHeatmapOpenedTaskId(t ? t.id : "")} />
        </div>
        {/* Métrique « tâches en retard » : des croisements portent des tâches
            sans qu'aucune soit en retard. Ces cases-là valent 0 — elles ne
            doivent pas se confondre avec les croisements sans aucune tâche. */}
        <div id="harness-heatmap-late" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 760, height: 260, marginBottom: 18 }}>
          <WidgetHeatmapGrid widget={{ ...heatmapWidget, heatmapMetric: "late", heatmapColField: "month" }} tasks={lateScenarioTasks} ctx={ctx} onOpen={noop} />
        </div>
        {heatmapFormOpen && (
          <WidgetFormModal
            widget={heatmapWidget}
            existingWidgets={[]}
            ctx={ctx}
            pageFilter={null}
            onSave={(data) => { setHeatmapWidget((w) => ({ ...w, ...data })); setHeatmapFormOpen(false); }}
            onClose={() => setHeatmapFormOpen(false)}
          />
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>RÉGLAGES GANTT — PARITÉ</h2>
        <button type="button" id="harness-open-gantt-view-settings" onClick={() => setGanttViewSettingsOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir les réglages de la vue Gantt
        </button>
        <button type="button" id="harness-open-gantt-widget-form" onClick={() => setGanttWidgetFormOpen(true)} style={{ marginBottom: 8, marginLeft: 8 }}>
          Ouvrir la fiche du widget Mini-Gantt
        </button>
        {ganttViewSettingsOpen && (
          <MiniGanttViewSettings
            prefs={ganttViewPrefs}
            setPrefs={(patch) => setGanttViewPrefs((p) => normalizeMiniGanttViewPrefs({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }))}
            tasks={tasks}
            ctx={parityCtx}
            onClose={() => setGanttViewSettingsOpen(false)}
          />
        )}
        {ganttWidgetFormOpen && (
          <WidgetFormModal
            widget={parityWidget}
            existingWidgets={[]}
            ctx={parityCtx}
            pageFilter={null}
            onSave={() => setGanttWidgetFormOpen(false)}
            onClose={() => setGanttWidgetFormOpen(false)}
          />
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>MINI-GANTT</h2>
        <button type="button" id="harness-open-widget-form" onClick={() => setFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche du widget (filtre projet p2)
        </button>
        <button type="button" id="harness-open-task-modal" onClick={() => setTaskModalOpen(true)} style={{ marginBottom: 8, marginLeft: 8 }}>
          Ouvrir la fiche de la tâche Google Calendar
        </button>
        <button type="button" id="harness-open-task-create" onClick={() => { setCreatedTask(null); setTaskCreateOpen(true); }} style={{ marginBottom: 8, marginLeft: 8 }}>
          Créer une tâche
        </button>
        <span id="harness-created-comparison" style={{ display: "none" }}>{JSON.stringify(createdTask ? createdTask.comparison || null : null)}</span>
        {taskCreateOpen && (
          <TaskModal
            task={{}}
            defaults={{ projectId: "p1", title: "" }}
            projects={projects}
            dashboards={dashboards}
            statuses={statuses}
            taskTypes={seedTaskTypes}
            tasks={tasks}
            teamMembers={seedTeamMembers}
            gradient={appearance.gradient}
            progressColorByStatus={false}
            shortcutPrefs={{}}
            onClose={() => setTaskCreateOpen(false)}
            onSave={(data) => { setCreatedTask(data); setTaskCreateOpen(false); }}
            onDelete={noop}
          />
        )}
        {taskModalOpen && (
          <TaskModal
            task={tasks.find((t) => t.id === "t8")}
            defaults={null}
            projects={projects}
            dashboards={dashboards}
            statuses={statuses}
            taskTypes={seedTaskTypes}
            tasks={tasks}
            teamMembers={seedTeamMembers}
            gradient={appearance.gradient}
            progressColorByStatus={false}
            shortcutPrefs={{}}
            onClose={() => setTaskModalOpen(false)}
            onSave={() => setTaskModalOpen(false)}
            onDelete={noop}
          />
        )}
        {/* Widget « Charge personnel » (#124). Deux montages, parce que c'est la
            DENSITÉ qui décide de ce qu'une bande peut écrire : en semaine, une
            case fait plus de cent pixels et porte un nom ; en mois, une
            quinzaine, et il ne reste que la couleur. Un widget qui ne serait
            éprouvé qu'en semaine laisserait passer des lettres coupées. */}
        {/* Granularite « Plage » (#124) : deux dates a la main. Le banc la monte
            parce que le defaut precedent n'etait visible qu'ICI — la fonction
            rendait la bonne fenetre, c'est l'enregistrement qui perdait les
            dates. */}
        <div id="harness-staffing-plage" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14, height: 240 }}>
          <WidgetStaffing
            widget={{
              id: "wsP", type: "staffing", staffingRange: "custom",
              staffingStart: "2026-09-21", staffingEnd: "2026-10-02",
              staffingOffset: 0,
              staffingMembers: seedTeamMembers.slice(0, 2).map((m) => m.name),
              staffingShowWeekends: true, staffingShowLoad: false,
            }}
            ctx={ctx}
            staffing={staffing}
            onUpdateStaffing={setStaffing}
            onUpdateWorkshops={setHarnessWorkshops}
            onUpdateWidget={noop}
          />
        </div>
        <div id="harness-staffing-week" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14, height: 300 }}>
          <WidgetStaffing
            widget={{ id: "ws1", type: "staffing", staffingRange: "week", staffingOffset: 0, staffingMembers: seedTeamMembers.map((m) => m.name), staffingExtraMembers: [{ name: "Intérim — Sofiane", color: "#EC4899" }], staffingShowWeekends: true, staffingShowLoad: true }}
            ctx={ctx}
            staffing={staffing}
            onUpdateStaffing={setStaffing}
            onUpdateWorkshops={setHarnessWorkshops}
            onUpdateWidget={noop}
          />
        </div>
        <div id="harness-staffing-month" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14, height: 300 }}>
          <WidgetStaffing
            widget={{ id: "ws2", type: "staffing", staffingRange: "month", staffingOffset: 0, staffingMembers: seedTeamMembers.map((m) => m.name), staffingExtraMembers: [{ name: "Intérim — Sofiane", color: "#EC4899" }], staffingShowWeekends: true, staffingShowLoad: true }}
            ctx={ctx}
            staffing={staffing}
            onUpdateStaffing={setStaffing}
            onUpdateWorkshops={setHarnessWorkshops}
            onUpdateWidget={noop}
          />
        </div>
        {/* Widget « Bulles » (#92) : le MÊME diagramme, lu en bulles. Deux
            macro-bulles, dont une posée sur des tâches NON SUCCESSIVES pour
            vérifier qu'elle produit bien deux enveloppes distinctes, et une
            seconde qui partage une tâche avec la première pour éprouver
            l'imbrication. */}
        <div id="harness-bubbles" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={bubbleWidget}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={(patch) => setBubbleWidget((w) => ({ ...w, ...patch }))}
            onUpdateTask={(id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))}
            groupBy="none"
          />
        </div>
        {/* Macro-bulle contenant une tâche COURTE et deux JALONS (#104) :
            une bulle a une largeur minimale en pixels et la bulle d'un jalon
            est centrée sur sa date, donc toutes trois sortent d'une enveloppe
            calculée sur les seules dates. Regroupement actif pour que les trois
            lignes se suivent et ne donnent qu'une enveloppe. */}
        <div id="harness-bubbles-macro-edge" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={{
              ...bubbleWidget, id: "wb4",
              bubbleMacroGrouping: true,
              bubbleFields: ["status", "assignee"],
              bubbleMacros: [
                { id: "m9", label: "Jalons et tâche courte", color: "#8B5CF6", opacity: 14, borderStyle: "solid", borderWidth: 1.5, taskIds: ["t2", "t3", "t7"], showProgress: true },
              ],
            }}
            /* Seules les tâches de la macro-bulle : le contrôle de contenance
               peut alors exiger que TOUTE bulle du widget soit dans le cadre. */
            tasks={tasks.filter((t) => ["t2", "t3", "t7"].includes(t.id))} ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={noop}
            onUpdateTask={(id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))}
            groupBy="none"
          />
        </div>
        {/* Couloirs réservés des annotations en mode bulles (#93). Le trait
            rattaché à une tâche lui passait en plein milieu : une tâche est ici
            une BOÎTE, pas une ligne fine. Jalons et traits se rangent donc dans
            leurs propres couloirs, en tête du diagramme. */}
        <div id="harness-bubbles-annot" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={{
              ...bubbleWidget, id: "wb6", bubbleMacros: [],
              bubbleLayout: "lanes",
              ganttAnnotations: {
                temporalBlocks: [], highlightFrames: [], risks: [], notes: [],
                milestones: [
                  { id: "bm1", title: "Ordre de service", date: "2026-07-15", type: MILESTONE_TYPE_SEED[0].id, color: "", taskId: null, rule: false },
                  { id: "bm2", title: "Mise en service", date: "2026-09-18", type: MILESTONE_TYPE_SEED[0].id, color: "", taskId: null, rule: false },
                ],
                spans: [
                  { id: "bs1", label: "Fenêtre de tirage", startDate: "2026-08-03", endDate: "2026-09-04", taskId: "t2", color: "#0EA5E9", borderStyle: "solid", thickness: 2, position: "above", capStart: "bar", capEnd: "arrow" },
                  { id: "bs2", label: "Période d'essais", startDate: "2026-07-20", endDate: "2026-08-14", taskId: "t1", color: "#22B07D", borderStyle: "dashed", thickness: 2, position: "above", capStart: "dot", capEnd: "dot" },
                ],
              },
            }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* BEAUCOUP de champs sous la bulle (#122). Le bandeau condensé tenait
            sur une ligne et coupait ce qui dépassait : il ne restait qu'un
            « Quentin · À pla… » qui ne disait plus rien. Il passe à la ligne, et
            toutes les bulles du widget adoptent la MÊME hauteur — sans quoi, en
            couloirs, la hauteur d'une ligne serait impossible à poser. */}
        {/* Titres ENTIERS (#122) : en couloirs, une ligne porte plusieurs
            bulles, et c'est la mesure du titre le plus long qui doit donner sa
            hauteur a TOUTES. Un titre a rallonge est monte expres. */}
        <div id="harness-bubbles-title-full" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={{
              ...bubbleWidget, id: "wb9", bubbleMacros: [],
              bubbleLayout: "lanes",
              bubbleTruncateTitles: false,
              bubbleFields: [],
            }}
            tasks={tasks.map((t, i) => (i === 0
              ? { ...t, title: "Reprise complete du genie civil du poste de relevage, y compris reseaux enterres et remise en etat des acces" }
              : t))}
            ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        <div id="harness-bubbles-fields" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={{
              ...bubbleWidget, id: "wb5", bubbleMacros: [],
              bubbleLayout: "lanes",
              bubbleFieldsLayout: "compact",
              bubbleFields: ["project", "status", "criticality", "taskType", "assignee", "start", "end", "period", "progress"],
            }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Description sur TROIS lignes (#97) : la bulle doit gagner la
            hauteur des lignes demandées, sinon son pied — statut et
            avancement — disparaît sous `overflow:hidden`. */}
        <div id="harness-bubbles-desc" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={{
              ...bubbleWidget, id: "wb3", bubbleMacros: [],
              bubbleShowDescription: true, bubbleDescriptionLines: 3,
              bubbleFields: ["status"],
            }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Bulles GROUPÉES par projet et colorées par responsable : un champ
            dont les valeurs n'ont pas de couleur à elles, donc le cas de la
            palette de repli, avec sa légende. */}
        <div id="harness-bubbles-grouped" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14 }}>
          <WidgetBubbles
            widget={{
              ...bubbleWidget, id: "wb2", bubbleColorBy: "assignee", bubbleShowLegend: true,
              bubbleSize: "compact", bubbleFields: ["status", "end"], bubbleMacros: [],
            }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={[]}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="project"
          />
        </div>
        {/* Aucun champ à droite (issue #66) : la colonne doit disparaître
            complètement et la piste aller jusqu'au bord du widget. */}
        <div id="harness-nofields-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{ id: "w9", type: "minigantt", colorBy: "status", miniGanttFields: [], miniGanttSort: "title" }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Échelle ANNUELLE : neuf ans à dates fixes. C'est le cas où l'axe
            n'offrait que neuf traits et rien entre eux — la sous-grille par
            trimestres lui rend son contexte temporel. */}
        <div id="harness-years-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{
              id: "w12", type: "minigantt", colorBy: "status", miniGanttFields: ["end"],
              miniGanttRange: { mode: "fixed" },
              miniGanttWindow: { start: "2019-01-01", end: "2027-12-31" },
            }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Cadrage « Fenêtre glissante » : l'axe ne dépend plus des tâches mais du
            calendrier. Les tâches hors fenêtre ne sont pas dessinées du tout —
            elles étaient écrasées contre le bord en une barre de 2 %. */}
        <div id="harness-rolling-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{ id: "w11", type: "minigantt", colorBy: "status", miniGanttFields: ["end"], miniGanttRange: { mode: "rolling", beforeMonths: 1, afterMonths: 1 } }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Titres courts, diagramme large : la colonne d'étiquettes doit se caler
            sur son contenu au lieu de réserver 26 % de la largeur. */}
        <div id="harness-labels-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 1100, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{ id: "w15", type: "minigantt", colorBy: "status", miniGanttFields: ["end"] }}
            tasks={shortTitleTasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Dernière ligne à fleur du bord : elle porte deux couloirs de risque,
            leurs étiquettes et un rail de comparaison, tous peints sous sa
            boîte. Rien de tout cela ne doit sortir du widget. */}
        <div id="harness-tail-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{ id: "w14", type: "minigantt", colorBy: "status", miniGanttFields: ["end"], miniGanttComparisonEnabled: true }}
            tasks={tailTasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        {/* Mode Comparaison : JUMEAU du second Mini-Gantt (mêmes tâches, mêmes
            champs, même regroupement), au mode près. C'est ce qui permet de
            comparer les hauteurs de ligne des deux et de vérifier que la
            superposition des barres ne fait grandir aucune ligne. */}
        <div id="harness-comparison-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{ ...otherWidget, id: "w10", miniGanttComparisonEnabled: true }}
            tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={noop}
            onUpdateTask={noop}
            groupBy="none"
          />
        </div>
        <div id="harness-second-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={otherWidget} tasks={tasks} ctx={ctx} onOpen={noop} metaBlocks={metaBlocks}
            onUpdateWidget={(patch) => setOtherWidget((w) => ({ ...w, ...patch }))}
            onUpdateTask={(id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))}
            groupBy="none"
          />
        </div>
        {formOpen && (
          <WidgetFormModal
            widget={{ ...miniWidget, filter: { ...widgetDefaultFilter(), projectIds: ["p2"] } }}
            existingWidgets={[]}
            ctx={ctx}
            pageFilter={null}
            onSave={() => setFormOpen(false)}
            onClose={() => setFormOpen(false)}
          />
        )}
        <div id="harness-first-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700 }}>
          <WidgetMiniGantt
            widget={miniWidget} tasks={tasks} ctx={ctx} onOpen={noop}
            onUpdateWidget={(patch) => setMiniWidget((w) => ({ ...w, ...patch }))}
            onUpdateTask={(id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))}
            groupBy="project"
          />
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>RÉGLAGES — TYPES DE JALON</h2>
        {/* Le catalogue réglé ici est celui que le Mini-Gantt ci-dessus dessine :
            un symbole choisi dans la grille doit être exactement celui qui
            apparaît dans le diagramme (#94). */}
        <div id="harness-milestone-types" style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", width: 560, padding: 12 }}>
          <MilestoneTypeManager
            embedded
            milestoneTypes={harnessMilestoneTypes}
            setMilestoneTypes={setHarnessMilestoneTypes}
            pushToast={noop}
          />
        </div>
      </div>
    </div>
  );
}
/* Avec « ?app=1 », le banc monte l'APPLICATION ENTIÈRE au lieu du scénario
   d'annotations, en court-circuitant l'écran d'authentification. C'est le seul
   moyen d'éprouver ce qui ne vit que dans l'application assemblée : la barre du
   haut, le rail, la navigation entre vues. Le contrôle visuel habituel n'en est
   pas affecté — il n'ouvre jamais cette adresse. */
const root = createRoot(document.getElementById('root'));
const benchApp = new URLSearchParams(location.search).get("app") === "1";

/* Base de données EN MÉMOIRE pour le banc application (issue #72).

   Sans elle, l'application se monte sans aucune tâche : tout filtre y est alors
   un coup d'épée dans l'eau, et le banc ne peut rien éprouver. La passerelle
   Netlify n'existe pas ici, on la remplace donc par une carte clé → valeur,
   exactement l'interface que window.storage expose (get/set/delete/watch).

   Le tableau de bord monté porte un widget de CHAQUE type qui consomme des
   tâches : un seul qui ne supporte pas une liste réduite à rien fait tomber la
   page entière, et c'est ce qu'il s'agit d'attraper ici. */
if (benchApp) {
  // #136 : une VRAIE réunion (taskTypeId de type "Réunions"), hier, sans
  // compte rendu — doit remonter dans le Daily Briefing et porter le champ
  // dédié dans sa fiche, jamais une tâche dont le titre contient "Réunion".
  const yesterdayIso = addDaysIso(iso(new Date()), -1);
  const realMeetingTask = { id: "bench-real-meeting", title: "Point budget hebdo", projectId: seedProjects[0]?.id, statusId: seedStatuses.find((s) => /termin/i.test(s.name))?.id || seedStatuses[0]?.id, taskTypeId: "tt3", start: yesterdayIso, end: yesterdayIso, progress: 100, milestone: false, assignee: "", checklist: [], desc: "Ordre du jour : budget Q3" };
  const benchTasks = [
    // #141 : completedAt réparti sur plusieurs semaines distinctes, sans
    // muter les objets seedTasks partagés (AnnotationsHarness les réutilise).
    ...seedTasks.map((t, i) => (i % 3 === 0 ? { ...t, completedAt: addDaysIso(iso(new Date()), -(i % 40)) + "T10:00:00Z" } : t)),
    ...seedTasks.map((t, i) => ({ ...t, id: `bench-${i}`, title: `Réunion de chantier ${i}` })),
    realMeetingTask,
  ];
  const benchWidgets = [
    "chart", "list", "minigantt", "bubbles", "criticalPath", "heatmapMonth",
    "nextBestAction", "dailyBriefing", "dominoEffect", "projectTreemap",
    "heatmapGrid", "embedMetro", "embedTimeline", "embedRadar", "embedCarte", "embedCosmos",
    "customCard",
    // #193 : monter la VRAIE DashboardView avec ces deux types placés est ce
    // qui a attrapé le `ReferenceError: habitLog is not defined` — un widget
    // isolé ne l'aurait jamais reproduit (habitLog manquait dans la signature
    // de DashboardView elle-même, pas dans le widget).
    "habitQuick", "habitHeatmap",
    // #294 : grille continue + frise horaire — monté dans la vraie
    // DashboardView comme les autres types qui consomment des tâches.
    "calendar",
  ].map((type, i) => ({ id: `banc-${type}`, type, title: type, layout: { x: (i % 4) * 3, y: Math.floor(i / 4) * 4, w: 3, h: 4 } }));
  benchWidgets.push(
    { id: "banc-taskDetail", type: "taskDetail", title: "taskDetail", taskDetailTaskId: seedTasks[0]?.id, layout: { x: 0, y: 96, w: 3, h: 4 } },
    { id: "banc-countdown", type: "customCard", title: "countdown", cardBlocks: [{ id: "cdb3", kind: "daysRemaining", countdownMode: "task", countdownTaskId: seedTasks[0]?.id }], layout: { x: 3, y: 96, w: 3, h: 4 } },
    // Vue annuelle + vue 3 mois du widget Heatmap habitudes (#193 v2) : deux
    // widgets séparés pour voir les deux bascules sans clic dans le banc.
    { id: "banc-habitHeatmap-year", type: "habitHeatmap", title: "habitHeatmap année", habitHeatmapView: "year", layout: { x: 6, y: 96, w: 6, h: 5 } },
    { id: "banc-habitHeatmap-quarter", type: "habitHeatmap", title: "habitHeatmap 3 mois", habitHeatmapView: "quarter", layout: { x: 0, y: 104, w: 6, h: 6 } },
    // #141 : style "Terminées par semaine" du widget Graphique, sur des
    // tâches réellement `completedAt` sur plusieurs semaines distinctes.
    { id: "banc-chart-completed", type: "chart", title: "chart completedPerWeek", chartStyle: "completedPerWeek", layout: { x: 6, y: 110, w: 4, h: 4 } },
    // #353 : Pixel des habitudes, pleine largeur (trois jours + semaine).
    { id: "banc-habitPixel", type: "habitPixel", title: "Pixel des habitudes", layout: { x: 0, y: 120, w: 12, h: 13 } },
  );
  const benchHabitThemes = [
    { id: "theme-job", name: "Job", color: "#2C6BE0", selectionMode: "single", habits: [
      { id: "habit-bureau", name: "Bureau", color: "#2C6BE0", kind: "check" },
      { id: "habit-teletravail", name: "Télétravail", color: "#1FA971", kind: "check" },
    ] },
    { id: "theme-sante", name: "Santé", color: "#E2483E", selectionMode: "multi", habits: [
      { id: "habit-eau", name: "Verres d'eau", color: "#0EA5E9", kind: "numeric", min: 0, max: 8, step: 2 },
      { id: "habit-sommeil", name: "Sommeil (h)", color: "#8B5CF6", kind: "numeric", min: 3, max: 9 },
    ] },
    // #353 : une catégorie plus longue, pour des rangées de tailles différentes.
    { id: "theme-sport", name: "Sport", color: "#1FA971", selectionMode: "multi", habits: [
      { id: "habit-course", name: "Course", color: "#1FA971", kind: "check" },
      { id: "habit-velo", name: "Vélo", color: "#F2A93B", kind: "check" },
      { id: "habit-natation", name: "Natation", color: "#0EA5E9", kind: "check" },
      { id: "habit-competition", name: "Compétition", color: "#D64545", kind: "check" },
      { id: "habit-etirements", name: "Étirements", color: "#EC4899", kind: "check" },
    ] },
  ];
  const benchDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const benchHabitLog = [
    { habitId: "habit-bureau", date: "2026-09-14" },
    { habitId: "habit-teletravail", date: "2026-09-15" },
    { habitId: "habit-eau", date: "2026-09-15", value: 6 },
    { habitId: "habit-sommeil", date: "2026-09-15", value: 8 },
    { habitId: "habit-eau", date: "2026-09-05", value: 2 }, // week-end coché -> ne doit PAS rester grisé
    // #353 : hier et aujourd'hui, relatifs à la date du banc.
    { habitId: "habit-bureau", date: benchDay(-1) },
    { habitId: "habit-course", date: benchDay(-1) },
    { habitId: "habit-eau", date: benchDay(-1), value: 8 },
    { habitId: "habit-teletravail", date: benchDay(0) },
    { habitId: "habit-eau", date: benchDay(0), value: 3 },
  ];
  const benchHabitSkips = [{ habitId: "habit-competition", date: benchDay(0) }];
  const mem = new Map(Object.entries({
    "nexora:tasks": JSON.stringify(benchTasks),
    "nexora:projects": JSON.stringify(seedProjects),
    "nexora:statuses": JSON.stringify(seedStatuses),
    "nexora:taskTypes": JSON.stringify(seedTaskTypes),
    "nexora:teamMembers": JSON.stringify(seedTeamMembers),
    "nexora:habitThemes": JSON.stringify(benchHabitThemes),
    "nexora:habitLog": JSON.stringify(benchHabitLog),
    "nexora:habitSkips": JSON.stringify(benchHabitSkips),
    "nexora:dashboards": JSON.stringify([{ id: "banc-d1", name: "Tableau du banc", folderId: null, pages: [{ id: "banc-p1", name: "Page 1", widgets: benchWidgets }], activePageId: "banc-p1" }]),
    "nexora:activeDashboardId": JSON.stringify("banc-d1"),
  }));
  // Vue Carte (#361) : `?app=1&view=carte` ouvre directement une vue ;
  // `carte=demo` range les projets dans des dossiers (régions à thème) et
  // `carte=volume` charge 300 projets et 12 000 tâches pour éprouver le rendu ;
  // `carte=sync` reprend la démo avec un calendrier public synchronisé ;
  // `carte=totems` montre un totem par thème (#488).
  const benchParams = new URLSearchParams(location.search);
  if (benchParams.get("view")) mem.set("nexora:startupPref", JSON.stringify({ mode: "view", value: benchParams.get("view") }));
  // `carteFx=0` coupe les effets avancés de la Carte (#496 à #498) : sous rendu
  // logiciel, ils ralentissent tant les images que l'arpenteur (pas plafonné à
  // 0,05 s par image) n'atteint plus sa tâche dans le délai du parcours.
  if (benchParams.get("carteFx") === "0") mem.set("nexora:viewPrefs", JSON.stringify({ carte: { fx: false } }));
  if (benchParams.get("carte") === "demo" || benchParams.get("carte") === "sync") {
    const folders = [{ id: "banc-f1", name: "Chantiers", color: "#E07A3F", mapTheme: "cyberpunk" }, { id: "banc-f2", name: "Ingénierie", color: "#245EDB" }, { id: "banc-f3", name: "Perso", color: "#2A9D8F" }];
    const projects = [
      ...seedProjects.map((p, i) => ({ ...p, folderId: folders[i % 2].id, priority: i === 0 ? "high" : "normal" })),
      { id: "banc-p4", name: "Passerelle quai Nord", icon: "🌉", color: "#B45309", folderId: "banc-f1" },
      { id: "banc-p5", name: "Audit structure", icon: "iconify:thesvg-color/gmail", color: "#245EDB", folderId: "banc-f2" },
      { id: "banc-p6", name: "Jardin", icon: "🌻", color: "#2A9D8F", folderId: "banc-f3" },
      { id: "banc-p7", name: "Idées en vrac", icon: "💡", color: "#8B5CF6", folderId: "folder-a-trier" },
    ];
    const extra = [];
    projects.slice(3).forEach((p, j) => {
      for (let i = 0; i < 9; i++) {
        const st = seedStatuses[(i + j) % seedStatuses.length];
        extra.push({ id: `banc-c${j}-${i}`, title: `${p.name} · étape ${i + 1}`, projectId: p.id, statusId: st.id, taskTypeId: ["tt1", "tt2", "tt3", "tt1"][i % 4], criticality: [null, "bas", "moyen", "urgent"][i % 4], milestone: i === 8, start: addDaysIso(iso(new Date()), i * 4 - 14), end: addDaysIso(iso(new Date()), i * 4 - 8), progress: (i * 23) % 101, assignee: seedTeamMembers[i % seedTeamMembers.length].name, checklist: i % 3 ? [] : [{ id: "k1", text: "a", done: true }, { id: "k2", text: "b", done: false }], dependsOn: i > 0 && i % 2 === 0 ? [`banc-c${j}-${i - 1}`] : [], recurrence: i === 5 ? { unit: "week", interval: 1 } : null, attachments: i === 2 ? [{ id: "a1", name: "plan.pdf" }] : [] });
      }
    });
    // Mode focus (#512) : deux tâches ouvertes de la passerelle passent en
    // focus ; la Carte les coiffe d'un halo, le filtre rapide les isole.
    extra.filter((t) => t.projectId === "banc-p4" && !/termin|info/i.test((seedStatuses.find((s) => s.id === t.statusId) || {}).name || "")).slice(0, 2).forEach((t) => { t.focus = true; });
    // Le moteur de la Carte s'expose au banc (compteurs d'effets, #512).
    window.__carteBench = window.__carteBench || {};
    if (benchParams.get("carte") === "sync") {
      projects.push({ id: "banc-psync", name: "Jours fériés", color: "#64748B", folderId: "folder-a-trier", syncedCalendarSource: true, syncedCalendarId: "fr-feries" });
      extra.push({ id: "banc-tsync", title: "Toussaint", projectId: "banc-psync", statusId: seedStatuses[0].id, taskTypeId: "tt1", milestone: true, start: addDaysIso(iso(new Date()), 20), end: addDaysIso(iso(new Date()), 20), progress: 0, assignee: "", checklist: [], syncedCalendarImported: true, syncedCalendarId: "fr-feries", syncedCalendarKey: "toussaint" });
    }
    mem.set("nexora:projectFolders", JSON.stringify(folders));
    mem.set("nexora:projects", JSON.stringify(projects));
    // Hologramme (#494) : une description et un compte rendu d'exemple.
    // Markdown (#502) : titre, gras, italique, cases, citation et call-outs.
    const holo = (t) => t.title === "Revue DOE" ? { ...t, desc: "## Revue DOE du lot 2B\nRevue documentaire des **dossiers d'ouvrages exécutés** avant réception, *version provisoire*.\n- [x] Plans de récolement reçus\n- [ ] Contrôler les notices de fonctionnement\n- Lister les réserves documentaires\n> [!WARNING] Réception le **15 octobre**\n> Sans DOE complet, la levée des réserves est bloquée.\n> [!TIP] Astuce\n> Demander l'index `DOE-2B.xlsx` à l'entreprise." }
      : t.title === "Réunion de chantier 2" ? { ...t, desc: "Réunion hebdomadaire avec l'entreprise de gros œuvre.", meetingReport: "Présents : MOE, entreprise GO, bureau de contrôle.\nPoints traités :\n- Planning : retard de 5 j sur le coulage du tablier\n- Réserves : 3 levées, 2 en cours\n- Sécurité : garde-corps provisoires à reposer\nActions : entreprise GO, nouveau planning sous 48 h." } : t;
    mem.set("nexora:tasks", JSON.stringify([...benchTasks, ...extra].map(holo)));
  } else if (benchParams.get("carte") === "totems" || benchParams.get("carte") === "fleaux") {
    window.__carteBench = {};
    // Vitrine des totems (#488) : un dossier par thème, un projet par
    // dossier, avancement étagé de 0 à 100 % (paliers 0 à 5).
    // `carte=fleaux` (#509) : en plus, une tâche urgente ET en retard par
    // thème, pour voir le fléau de chaque thème.
    const fleaux = benchParams.get("carte") === "fleaux";
    const themes = ["ville", "campagne", "foret", "desert", "mer", "lac", "montagne", "hautemontagne", "grandnord", "canyon", "marais", "jungle", "volcan", "ile", "cyberpunk"];
    const colors = ["#E07A3F", "#245EDB", "#2A9D8F", "#8B5CF6", "#DC2626", "#0EA5E9", "#B45309", "#16A34A", "#DB2777", "#CA8A04"];
    const folders = themes.map((t, i) => ({ id: `banc-tf${i}`, name: t, color: colors[i % colors.length], mapTheme: t }));
    const projects = themes.map((t, i) => ({ id: `banc-tp${i}`, name: `Totem ${t}`, icon: "", color: colors[i % colors.length], folderId: folders[i].id }));
    const tasks = [];
    themes.forEach((t, i) => {
      const done = [0, 1, 2, 3, 4, 5][i % 6];
      for (let k = 0; k < 5; k++) tasks.push({ id: `banc-tt${i}-${k}`, title: `${t} · ${k + 1}`, projectId: projects[i].id, statusId: k < done ? "s5" : k % 2 ? "s3" : "s1", taskTypeId: "tt1", start: addDaysIso(iso(new Date()), k * 3 - 6), end: addDaysIso(iso(new Date()), k * 3 + 4), progress: k < done ? 100 : 30 + k * 10, assignee: seedTeamMembers[k % seedTeamMembers.length].name, checklist: [] });
      if (fleaux) tasks.push({ id: `banc-tt${i}-fl`, title: `${t} · critique`, projectId: projects[i].id, statusId: "s3", taskTypeId: "tt1", criticality: "urgent", start: addDaysIso(iso(new Date()), -20), end: addDaysIso(iso(new Date()), -5), progress: 40, assignee: seedTeamMembers[0].name, checklist: [] });
    });
    mem.set("nexora:projectFolders", JSON.stringify(folders));
    mem.set("nexora:projects", JSON.stringify(projects));
    mem.set("nexora:tasks", JSON.stringify(tasks));
  } else if (benchParams.get("cosmos") === "demo") {
    // Vue Cosmos (#402) : données d'EXEMPLE — dossiers, un sous-dossier (amas),
    // un dossier vide, un projet vide, « À trier » et une tâche sans projet.
    const folders = [
      { id: "banc-cf1", name: "Vallabrègues", color: "#2F7FD8", mapTheme: "campagne" },
      { id: "banc-cf1b", name: "Lot aval", color: "#2F7FD8", parentId: "banc-cf1" },
      { id: "banc-cf2", name: "Avignon Nord", color: "#8B5CF6" },
      { id: "banc-cf3", name: "Perso", color: "#E0902F" },
      { id: "banc-cf4", name: "Archives", color: "#7A8699", mapTheme: "grandnord" },
      { id: "banc-cf5", name: "Nouveaux chantiers", color: "#94A3B8" },
    ];
    const projects = [
      { id: "banc-cp1", name: "Passe amont", color: "#1F9D8F", folderId: "banc-cf1" },
      { id: "banc-cp2", name: "Machine", color: "#2F5FB3", folderId: "banc-cf1" },
      { id: "banc-cp3", name: "Canal", color: "#D99A2B", folderId: "banc-cf1b" },
      { id: "banc-cp4", name: "Digue", color: "#6D5BD0", folderId: "banc-cf2" },
      { id: "banc-cp5", name: "Écluse", color: "#B05BB8", folderId: "banc-cf2" },
      { id: "banc-cp6", name: "Maison", color: "#E0782F", folderId: "banc-cf3" },
      { id: "banc-cp7", name: "Jardin", color: "#3AA35A", folderId: "banc-cf3" },
      { id: "banc-cp8", name: "Références", color: "#8391A6", folderId: "banc-cf4" },
      { id: "banc-cp9", name: "Veille", color: "#94A3B8", folderId: "folder-a-trier" },
      { id: "banc-cp10", name: "Projet à lancer", color: "#0EA5E9", folderId: "banc-cf2" },
      { id: "banc-cp11", name: "Jours fériés", color: "#64748B", folderId: "folder-a-trier", syncedCalendarSource: true, syncedCalendarId: "fr-feries" },
    ];
    const st = (n) => (seedStatuses.find((s) => new RegExp(n, "i").test(s.name)) || seedStatuses[0]).id;
    const d = (n) => addDaysIso(iso(new Date()), n);
    const T = (id, title, projectId, status, extra = {}) => ({ id, title, projectId, statusId: st(status), taskTypeId: "tt1", start: d(-7), end: d(5), progress: 0, assignee: "", checklist: [], ...extra });
    const tasks = [
      T("banc-ct1", "Vérifier les vannes", "banc-cp1", "cours", { progress: 50, criticality: "moyen", assignee: seedTeamMembers[0]?.name || "", desc: "Contrôler le bon fonctionnement des vannes de la passe amont et relever les mesures de débit.", checklist: [{ id: "k1", text: "Relever la pression amont", done: true }, { id: "k2", text: "Tester l'ouverture", done: true }, { id: "k3", text: "Vérifier l'étanchéité", done: false }, { id: "k4", text: "Consigner les mesures", done: false }] }),
      T("banc-ct2", "Relever la pression", "banc-cp1", "termin", { progress: 100, end: d(-3) }),
      T("banc-ct3", "Tester l'ouverture", "banc-cp1", "termin", { progress: 100, end: d(-2) }),
      T("banc-ct4", "Consigner les mesures", "banc-cp1", "planifier", { end: d(9) }),
      T("banc-ct5", "Nettoyer la grille", "banc-cp1", "planifier", { end: d(14) }),
      T("banc-ct6", "Devis vérins", "banc-cp1", "attente", { progress: 20 }),
      T("banc-ct7", "Remplacer le capteur", "banc-cp1", "planifier", { end: d(-4), criticality: "urgent" }),
      T("banc-ct8", "Rapport d'intervention", "banc-cp1", "information"),
      ...["Graissage turbine", "Alignement arbre", "Contrôle alternateur", "Relevé vibrations", "Pièces de rechange", "Essai à vide"].map((t, i) => T("banc-cm" + i, t, "banc-cp2", ["cours", "planifier", "termin", "cours", "attente", "planifier"][i], { progress: i * 15 })),
      ...["Curage", "Berges", "Signalétique", "Pont levant"].map((t, i) => T("banc-cc" + i, t, "banc-cp3", ["planifier", "cours", "termin", "attente"][i], i === 0 ? { end: d(-6) } : {})),
      ...Array.from({ length: 5 }, (_, i) => T("banc-cd" + i, "Digue · étape " + (i + 1), "banc-cp4", ["planifier", "cours", "termin", "planifier", "attente"][i])),
      ...Array.from({ length: 4 }, (_, i) => T("banc-ce" + i, "Écluse · étape " + (i + 1), "banc-cp5", ["planifier", "cours", "termin", "termin"][i])),
      ...Array.from({ length: 3 }, (_, i) => T("banc-cma" + i, "Maison · " + ["Peinture", "Toiture", "Devis cuisine"][i], "banc-cp6", ["planifier", "cours", "termin"][i])),
      ...Array.from({ length: 5 }, (_, i) => T("banc-cj" + i, "Jardin · " + ["Taille", "Semis", "Arrosage", "Clôture", "Compost"][i], "banc-cp7", ["planifier", "planifier", "termin", "cours", "termin"][i])),
      ...Array.from({ length: 6 }, (_, i) => T("banc-cr" + i, "Référence " + (i + 1), "banc-cp8", "termin", { progress: 100 })),
      ...Array.from({ length: 3 }, (_, i) => T("banc-ci" + i, "Idée " + (i + 1), "banc-cp9", "planifier")),
      T("banc-corphan", "Note sans projet", null, "planifier"),
      T("banc-csync", "Toussaint", "banc-cp11", "planifier", { milestone: true, start: d(20), end: d(20), syncedCalendarImported: true, syncedCalendarId: "fr-feries", syncedCalendarKey: "toussaint" }),
    ];
    mem.set("nexora:projectFolders", JSON.stringify(folders));
    mem.set("nexora:projects", JSON.stringify(projects));
    mem.set("nexora:tasks", JSON.stringify(tasks));
    mem.set("nexora:favorites", JSON.stringify([{ type: "project", id: "banc-cp1" }, { type: "task", id: "banc-ct7" }]));
  } else if (benchParams.get("t3d") === "demo") {
    // Vue Timeline 3D (#454) : données d'EXEMPLE reprises des maquettes du
    // réseau du temps — huit projets en trois dossiers, jalons, réunions,
    // actions longues, retards, attentes et deux dépendances entre projets.
    const folders = [{ id: "banc-tf1", name: "Chantiers", color: "#E07A3F", order: 1 }, { id: "banc-tf2", name: "Ingénierie", color: "#245EDB", order: 2 }, { id: "banc-tf3", name: "Perso", color: "#2A9D8F", order: 3 }];
    const projects = [
      { id: "banc-tp1", name: "Lot 2B — Gros œuvre", color: "#F2A900", folderId: "banc-tf1" },
      { id: "banc-tp2", name: "Réhabilitation école", color: "#1F6FD1", folderId: "banc-tf1" },
      { id: "banc-tp3", name: "Passerelle quai Nord", color: "#00A88F", folderId: "banc-tf1" },
      { id: "banc-tp4", name: "Audit structure halle", color: "#C04191", folderId: "banc-tf2" },
      { id: "banc-tp5", name: "Devis & facturation", color: "#F07C2B", folderId: "banc-tf2" },
      { id: "banc-tp6", name: "Formation BIM", color: "#7A4FC9", folderId: "banc-tf2" },
      { id: "banc-tp7", name: "Ruches du jardin", color: "#5DAE3A", folderId: "banc-tf3" },
      { id: "banc-tp8", name: "Randonnée GR20", color: "#9A6431", folderId: "banc-tf3" },
    ];
    const st = (n) => (seedStatuses.find((s) => new RegExp(n, "i").test(s.name)) || seedStatuses[0]).id;
    const meeting = (seedTaskTypes.find((t) => /r[ée]union/i.test(t.name)) || {}).id || "tt3";
    const d = (n) => addDaysIso(iso(new Date()), n);
    const raw = [
      ["1", "Implantation et terrassement", -42, -28, "a", "termin"], ["1", "Fondations superficielles", -26, -9, "a", "termin"], ["1", "Réception des fonds de fouille", -8, -8, "m", "termin"],
      ["1", "Coulage dalle basse", -4, 3, "a", "cours"], ["1", "Réunion de chantier n° 14", 7, 7, "r", "planifier"], ["1", "Élévation murs RDC", 4, 24, "a", "planifier"], ["1", "Dalle haute R+1", 22, 38, "a", "planifier"], ["1", "Hors d'eau", 60, 60, "m", "planifier"],
      ["2", "Diagnostic amiante", -30, -18, "a", "termin"], ["2", "Comité de pilotage", 12, 12, "r", "planifier"], ["2", "DCE lots techniques", 5, 30, "a", "planifier"], ["2", "Retour d'instruction du permis", 18, 18, "m", "attente"], ["2", "Consultation des entreprises", 32, 62, "a", "planifier"],
      ["3", "Note de calcul du tablier", -20, -3, "a", "termin"], ["3", "Visa du bureau de contrôle", -1, 6, "a", "attente"], ["3", "Réunion de synthèse réseaux", 4, 4, "r", "planifier"], ["3", "Commande de l'acier", 9, 9, "m", "planifier"], ["3", "Fabrication en atelier", 12, 48, "a", "planifier"], ["3", "Mise en service", 88, 88, "m", "planifier"],
      ["4", "Carottages béton", -25, -15, "a", "termin"], ["4", "Rapport préliminaire", -12, -5, "a", "cours"], ["4", "Restitution au client", 8, 8, "r", "planifier"], ["4", "Rapport final", 10, 26, "a", "planifier"], ["4", "Clôture de mission", 38, 38, "m", "planifier"],
      ["5", "Devis passerelle", -9, -2, "a", "termin"], ["5", "Relance impayé école", -3, 1, "a", "cours"], ["5", "Facture de situation n° 4", 1, 2, "a", "planifier"], ["5", "Point trésorerie", 15, 15, "r", "planifier"], ["5", "Facture de situation n° 5", 31, 32, "a", "planifier"],
      ["6", "Inscription validée", 2, 2, "m", "planifier"], ["6", "Module 1 · Revit", 14, 18, "a", "planifier"], ["6", "Projet fil rouge", 20, 80, "a", "planifier"], ["6", "Certification", 98, 98, "m", "planifier"],
      ["7", "Traitement varroa", -6, 10, "a", "cours"], ["7", "Nourrissement d'automne", 14, 28, "a", "planifier"], ["7", "Hivernage des ruches", 45, 45, "m", "planifier"],
      ["8", "Réserver les refuges", -10, 5, "a", "cours"], ["8", "Billets de ferry", 3, 6, "a", "planifier"], ["8", "Préparation physique", 10, 80, "a", "planifier"], ["8", "Départ GR20", 115, 115, "m", "planifier"],
    ];
    const tasks = raw.map(([p, title, s, e, type, status], i) => ({ id: "banc-tt" + i, title, projectId: "banc-tp" + p, statusId: st(status), taskTypeId: type === "r" ? meeting : "tt1", milestone: type === "m", start: d(s), end: d(e), progress: /termin/.test(status) ? 100 : /cours/.test(status) ? 40 : 0, assignee: "", checklist: [], criticality: i % 7 === 3 ? "urgent" : null }));
    tasks.push({ id: "banc-tt-undated", title: "Idée sans date", projectId: "banc-tp7", statusId: st("planifier"), taskTypeId: "tt1", progress: 0, assignee: "", checklist: [] });
    const byTitle = (t) => tasks.find((x) => x.title === t).id;
    tasks.find((x) => x.title === "Facture de situation n° 4").dependsOn = [byTitle("Coulage dalle basse")];
    tasks.find((x) => x.title === "Commande de l'acier").dependsOn = [byTitle("Devis passerelle")];
    mem.set("nexora:projectFolders", JSON.stringify(folders));
    mem.set("nexora:projects", JSON.stringify(projects));
    mem.set("nexora:tasks", JSON.stringify(tasks));
  } else if (benchParams.get("fleuve") === "demo") {
    // Vue « Fleuve du temps » (#515) : données d'EXEMPLE reprises de la
    // maquette validée — quatre projets, 28 tâches sur six semaines, trois
    // retards, deux critiques, trois jalons, trois dépendances, deux tâches en
    // focus et une semaine S+2 surchargée.
    const projects = [
      { id: "banc-fp1", name: "Lot 2B", color: "#8b5cf6" },
      { id: "banc-fp2", name: "Passerelle quai Nord", color: "#e07b1a" },
      { id: "banc-fp3", name: "Jardin", color: "#22a06b" },
      { id: "banc-fp4", name: "Communication", color: "#2e86ab" },
    ];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const monday = -((now.getDay() + 6) % 7);
    // Jours de la maquette (samedi = J0, lundi = J-5) recalés sur la semaine du banc.
    const shift = monday + 5;
    const d = (n) => addDaysIso(iso(new Date()), n);
    const P = { lot: "banc-fp1", pass: "banc-fp2", jardin: "banc-fp3", com: "banc-fp4" };
    const who = (i) => seedTeamMembers[i % seedTeamMembers.length].name;
    // [id, titre, projet, échéance (jour de la maquette), charge : "HH:MM-HH:MM" ou nombre de jours, options]
    const raw = [
      ["reserves", "Réserves Lot 2B", "lot", -5, 2, { late: true }],
      ["gc", "Commande garde-corps", "pass", -3, "09:00-12:00", { late: true }],
      ["devis", "Devis arrosage", "jardin", -2, 4, { late: true }],
      ["reunion", "Réunion de chantier", "lot", 2, "08:30-10:30", {}],
      ["doe", "Revue DOE", "lot", 3, "09:00-15:00", { crit: true, focus: true }],
      ["plantations", "Plantations", "jardin", 5, 2, { focus: true }],
      ["presse", "Point presse", "com", 6, "10:00-12:00", {}],
      ["arrosage", "Arrosage auto", "jardin", 6, "08:00-10:00", {}],
      ["levage", "Levage passerelle", "pass", 7, 4, { crit: true }],
      ["news", "Lettre de chantier", "com", 9, "14:00-18:00", {}],
      ["essais", "Essais garde-corps", "pass", 10, 2, {}],
      ["eclairage", "Mise en service éclairage", "pass", 11, 3, {}],
      ["cloisons", "Cloisons R+2", "lot", 11, 5, {}],
      ["opc", "Visite OPC", "lot", 11, "10:00-12:00", {}],
      ["levee", "Levée des réserves", "lot", 12, 3, {}],
      ["elus", "Visite des élus", "com", 12, "09:00-15:00", {}],
      ["paillage", "Paillage massifs", "jardin", 12, "13:00-17:00", {}],
      ["recolement", "Plan de récolement", "lot", 17, 2, {}],
      ["bilanpresse", "Revue de presse", "com", 18, "09:00-12:00", {}],
      ["engazon", "Engazonnement", "jardin", 20, 4, {}],
      ["charge", "Essais de charge", "pass", 23, 3, {}],
      ["haies", "Taille des haies", "jardin", 24, "09:00-12:00", {}],
      ["inaug", "Inauguration", "com", 27, "09:00-18:00", {}],
      ["dossier", "Dossier DOE final", "lot", 31, 5, {}],
      ["film", "Film du chantier", "com", 32, "13:00-18:00", {}],
      ["hiver", "Hivernage arrosage", "jardin", 34, "09:00-12:00", {}],
      ["nettoyage", "Repli de chantier", "lot", 38, 4, {}],
      ["bilan", "Bilan de projet", "com", 41, "14:00-18:00", {}],
    ];
    const tasks = raw.map(([id, title, p, day, load, o], i) => {
      const due = o.late ? day : day + shift;
      const slot = typeof load === "string" ? load.split("-") : null;
      return {
        id: "banc-f-" + id, title, projectId: P[p], statusId: o.late || i % 3 === 0 ? "s3" : "s1", taskTypeId: id === "reunion" || id === "opc" ? "tt3" : "tt1",
        start: d(slot ? due : due - load + 1), end: d(due), ...(slot ? { startTime: slot[0], endTime: slot[1] } : {}),
        progress: o.late ? 40 : 0, assignee: who(i), checklist: [], criticality: o.crit ? "urgent" : i % 5 === 1 ? "moyen" : null,
        ...(o.focus ? { focus: true } : {}),
      };
    });
    [["Réception Lot 2B", "lot", 13], ["Mise en service passerelle", "pass", 26], ["Ouverture du jardin", "jardin", 41]].forEach(([title, p, day], i) => {
      tasks.push({ id: "banc-f-ms" + i, title, projectId: P[p], statusId: "s1", taskTypeId: "tt1", milestone: true, start: d(day + shift), end: d(day + shift), progress: 0, assignee: who(i), checklist: [] });
    });
    // Une tâche terminée : elle ne navigue pas.
    tasks.push({ id: "banc-f-done", title: "Piquetage", projectId: P.lot, statusId: "s5", taskTypeId: "tt1", start: d(-9), end: d(-6), progress: 100, assignee: who(0), checklist: [] });
    const dep = (a, b) => { tasks.find((t) => t.id === "banc-f-" + b).dependsOn = ["banc-f-" + a]; };
    dep("reunion", "doe"); dep("plantations", "arrosage"); dep("cloisons", "elus");
    mem.set("nexora:projectFolders", JSON.stringify([]));
    mem.set("nexora:projects", JSON.stringify(projects));
    mem.set("nexora:tasks", JSON.stringify(tasks));
    // Le moteur du Fleuve s'expose au banc (positions des bateaux, compteurs).
    window.__fleuveBench = {};
    if (benchParams.get("fleuveQ")) mem.set("nexora:viewPrefs", JSON.stringify({ fleuve: { quality: benchParams.get("fleuveQ") } }));
  } else if (benchParams.get("cosmos") === "empty") {
    mem.set("nexora:projectFolders", JSON.stringify([]));
    mem.set("nexora:projects", JSON.stringify([]));
    mem.set("nexora:tasks", JSON.stringify([]));
  } else if (benchParams.get("carte") === "volume" || benchParams.get("cosmos") === "volume") {
    const folders = Array.from({ length: 12 }, (_, i) => ({ id: `banc-vf${i}`, name: `Dossier ${i + 1}`, color: "#94A3B8" }));
    const projects = Array.from({ length: 300 }, (_, i) => ({ id: `banc-vp${i}`, name: `Projet ${i + 1}`, icon: "", color: ["#E07A3F", "#245EDB", "#2A9D8F", "#8B5CF6", "#E0A21A"][i % 5], folderId: folders[i % 12].id }));
    const tasks = [];
    for (let i = 0; i < 12000; i++) tasks.push({ id: `banc-vt${i}`, title: `Tâche ${i + 1}`, projectId: projects[i % 300].id, statusId: seedStatuses[i % seedStatuses.length].id, taskTypeId: "tt1", criticality: [null, "bas", "moyen", "urgent"][i % 4], start: addDaysIso(iso(new Date()), (i % 40) - 20), end: addDaysIso(iso(new Date()), (i % 50) - 15), progress: i % 101, assignee: "", checklist: [] });
    mem.set("nexora:projectFolders", JSON.stringify(folders));
    mem.set("nexora:projects", JSON.stringify(projects));
    mem.set("nexora:tasks", JSON.stringify(tasks));
  }
  window.storage = {
    async get(key) {
      if (!mem.has(key)) throw new Error("Key not found: " + key);
      return { value: mem.get(key), revision: "banc" };
    },
    async set(key, value) { mem.set(key, String(value ?? "")); return { revision: "banc", value }; },
    async delete(key) { mem.delete(key); return {}; },
    watch() { return () => {}; },
  };
}
/* `<GlobalStyles/>` ne vit normalement que dans AuthGate (habillage de l'écran
   de connexion) : LePlan monté seul, comme ici, ne l'embarque jamais — sans
   ce rendu explicite, TOUTES les classes .lp-* du banc application restent
   sans styles (découvert en vérifiant #193 v2 : les widgets Habitudes
   rendaient en display:block faute de feuille de style, masquant le vrai
   comportement CSS derrière une mise en page accidentellement cassée). */
function BenchApp() {
  return (
    <>
      <GlobalStyles />
      <LePlan currentUser={{ uid: "banc", email: "banc@local" }} onSignOut={() => {}} />
    </>
  );
}
root.render(React.createElement(benchApp ? BenchApp : AnnotationsHarness));
