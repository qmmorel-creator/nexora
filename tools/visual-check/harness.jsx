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
  "kpi", "chart", "list", "minigantt", "bubbles", "criticalPath", "heatmapMonth",
  "milestoneTimeline", "verticalMetroTimeline", "metroDeadline", "blockers",
  "nextBestAction", "dailyBriefing", "dominoEffect", "projectTreemap",
  "deadlineScatter", "heatmapGrid", "embedMetro", "embedTimeline", "embedRadar",
  "customCard",
].map((type, i) => ({ id: `vide-${type}`, type, title: type, layout: { x: (i % 4) * 3, y: Math.floor(i / 4) * 4, w: 3, h: 4 } }))
  // Ceux-là ne se montent qu'avec une cible désignée : c'est justement le cas
  // où le filtre peut la faire disparaître de la liste (issue #72).
  .concat([
    { id: "vide-taskDetail", type: "taskDetail", title: "taskDetail", taskDetailTaskId: "t1", layout: { x: 0, y: 40, w: 3, h: 4 } },
    { id: "vide-countdown-task", type: "countdown", title: "countdown", countdownMode: "task", countdownTaskId: "t1", layout: { x: 3, y: 40, w: 3, h: 4 } },
    { id: "vide-countdown-filtre", type: "countdown", title: "countdown filtre", countdownMode: "filter", layout: { x: 6, y: 40, w: 3, h: 4 } },
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
  const [harnessWorkshops] = useState(() => WORKSHOP_SEED.map((w) => ({ ...w })));
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
  // Nuage des échéances : des dates calculées À PARTIR D'AUJOURD'HUI, pour que
  // les contrôles restent vrais quel que soit le jour où le banc est lancé.
  // « sc5 » n'a pas de date de fin : elle ne doit jamais devenir un point.
  const scatterToday = iso(new Date());
  const scatterTasks = [
    { id: "sc1", projectId: "p1", statusId: "s1", title: "Étude de sol", start: addDays(scatterToday, -20), end: addDays(scatterToday, -6), progress: 0, checklist: [], criticality: "urgent" },
    { id: "sc2", projectId: "p1", statusId: "s1", title: "Permis de construire", start: addDays(scatterToday, -10), end: addDays(scatterToday, -6), progress: 0, checklist: [], criticality: "moyen" },
    { id: "sc3", projectId: "p2", statusId: "s2", title: "Plan de communication", start: scatterToday, end: scatterToday, progress: 0, checklist: [], criticality: "bas" },
    { id: "sc4", projectId: "p2", statusId: "s2", title: "Relance presse", start: scatterToday, end: addDays(scatterToday, 12), progress: 0, checklist: [] },
    { id: "sc5", projectId: "p3", statusId: "s1", title: "Sans échéance", start: scatterToday, progress: 0, checklist: [] },
  ];
  /* Heat map mensuelle (#68) : une échéance passée et une à venir, pour que la
     distinction passé / futur ait de quoi se voir. Les dates sont relatives à
     aujourd'hui, donc le contrôle reste vrai quel que soit le jour. */
  const heatmapMonthTasks = [
    { id: "hm1", projectId: "p1", statusId: "s1", title: "Échéance passée", start: addDays(scatterToday, -20), end: addDays(scatterToday, -10), progress: 0, checklist: [] },
    { id: "hm2", projectId: "p2", statusId: "s2", title: "Échéance à venir", start: scatterToday, end: addDays(scatterToday, 5), progress: 0, checklist: [] },
  ];
  const [scatterWidget, setScatterWidget] = useState({ id: "w5", type: "deadlineScatter", scatterLaneField: "project" });
  const [scatterFormOpen, setScatterFormOpen] = useState(false);
  const [scatterOpenedTaskId, setScatterOpenedTaskId] = useState("");
  // Couloir DENSE : c'est le cas pour lequel le moteur d'étiquettes existe
  // (issue #53). Titres longs, amas serrés, tâches de part et d'autre de
  // l'origine — les conditions réelles d'un tableau de bord chargé.
  const scatterDenseTitres = [
    "Audit SOCOTEC Machine Tournante", "Organisation Réunion sur site le 1/2 Octobre",
    "Revue DOE", "Travaux Levée Réserves", "Point GESCO", "Réunion Sécurité Ingénierie",
    "PCH VA - Suivi Transfert CTEX6", "Réunion expertise amiable", "Chiffrage lot 3",
  ];
  const scatterDenseTasks = Array.from({ length: 36 }, (_, i) => {
    const d = ((i * 31) % 150) - 70;
    return {
      id: `sd${i}`, projectId: ["p1", "p2", "p3"][i % 3], statusId: i % 3 === 0 ? "s1" : "s2",
      title: scatterDenseTitres[i % scatterDenseTitres.length],
      start: addDays(scatterToday, d - 10), end: addDays(scatterToday, d),
      progress: (i * 13) % 101, checklist: [], criticality: ["urgent", "moyen", "bas"][i % 3],
    };
  });
  // Fenêtre fixe étroite (issue #50) : « sc1 » (J-6) et « sc4 » (J+12) sortent
  // d'une fenêtre J-3 → J+5. Ils doivent rester dessinés, rabattus sur le bord
  // et comptés — jamais disparaître.
  const scatterWindowWidget = { id: "w7", type: "deadlineScatter", scatterLaneField: "project",
    scatterWindowMode: "fixed", scatterWindowBefore: 3, scatterWindowAfter: 5 };

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
    fields: ["status"], collapsed: {}, zoomKey: "auto", networkMode: false, deadlineMode: false, showRiskBadges: true,
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
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>RAIL DES VUES</h2>
        {/* Issue #65. Le rail réel vit dans l'application complète, que ce banc
            ne monte pas ; ce qui a changé est ENTIÈREMENT dans la feuille de
            style, et c'est elle qu'on éprouve ici, sur le même balisage et les
            mêmes classes que le rendu réel. */}
        <nav id="harness-view-rail" className="lp-view-rail" aria-label="Espaces de travail" style={{ height: 320, marginBottom: 18 }}>
          {[
            { key: "control", label: "Centre de pilotage", icon: "tabler:affiliate", badge: "" },
            { key: "projects", label: "Planning Projets", icon: "tabler:route", badge: "4" },
            { key: "automations", label: "Automatisations", icon: "tabler:automation", badge: "999+" },
            { key: "notifications", label: "Notifications", icon: "tabler:bell", badge: "12" },
          ].map((v) => (
            <button key={v.key} type="button" className={"lp-view-rail-btn" + (v.key === "projects" ? " active" : "")} title={v.label}>
              <IconGlyph icon={v.icon} size={17} />
              <span className="lp-view-rail-label">{v.label}</span>
              {v.badge && <span className={"lp-view-rail-btn-count" + (v.key === "notifications" ? " is-alert" : "")}>{v.badge}</span>}
            </button>
          ))}
          <div className="lp-view-rail-folders" aria-label="Dossiers de projets">
            <button type="button" className="lp-view-rail-folder" style={{ "--folder-color": "#4F6AF5" }} title="Dossier">
              <IconGlyph icon="tabler:folder" size={14} />
              <span className="lp-view-rail-folder-count">3</span>
            </button>
          </div>
        </nav>
      </div>
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>HEAT MAP MENSUELLE</h2>
        {/* Le MÊME widget à deux largeurs (#68) : large, les trois mois tiennent
            sur une ligne ; étroit, ils doivent passer les uns sous les autres
            plutôt que de déborder derrière une barre de défilement. */}
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
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>NUAGE DES ÉCHÉANCES</h2>
        <button type="button" id="harness-open-scatter-form" onClick={() => setScatterFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche du Nuage
        </button>
        <span id="harness-scatter-opened" style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 12 }}>{scatterOpenedTaskId}</span>
        <div id="harness-scatter" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 760, height: 260, marginBottom: 18 }}>
          <WidgetDeadlineScatter
            widget={scatterWidget} tasks={scatterTasks} ctx={ctx}
            onOpen={(t) => setScatterOpenedTaskId(t ? t.id : "")}
          />
        </div>
        {/* Mêmes tâches, couloirs par criticité : « Urgent » doit se retrouver
            en haut, avant « Moyen » puis « Bas ». */}
        <div id="harness-scatter-crit" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 760, height: 260, marginBottom: 18 }}>
          <WidgetDeadlineScatter widget={{ ...scatterWidget, scatterLaneField: "criticality" }} tasks={scatterTasks} ctx={ctx} onOpen={noop} />
        </div>
        <div id="harness-scatter-dense" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 1000, height: 280, marginBottom: 18 }}>
          <WidgetDeadlineScatter widget={scatterWidget} tasks={scatterDenseTasks} ctx={ctx} onOpen={noop} />
        </div>
        {/* Fenêtre fixe étroite : deux tâches débordent, aucune ne disparaît. */}
        <div id="harness-scatter-window" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 760, height: 200, marginBottom: 18 }}>
          <WidgetDeadlineScatter widget={scatterWindowWidget} tasks={scatterTasks} ctx={ctx} onOpen={noop} />
        </div>
        {/* Aucune tâche datée : le widget doit le dire, pas afficher un axe vide. */}
        <div id="harness-scatter-empty" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 300, height: 120, marginBottom: 18 }}>
          <WidgetDeadlineScatter widget={scatterWidget} tasks={scatterTasks.filter((t) => !t.end)} ctx={ctx} onOpen={noop} />
        </div>
        {scatterFormOpen && (
          <WidgetFormModal
            widget={scatterWidget}
            existingWidgets={[]}
            ctx={ctx}
            pageFilter={null}
            onSave={(data) => { setScatterWidget((w) => ({ ...w, ...data })); setScatterFormOpen(false); }}
            onClose={() => setScatterFormOpen(false)}
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
          <WidgetHeatmapGrid widget={{ ...heatmapWidget, heatmapMetric: "late", heatmapColField: "month" }} tasks={tasks} ctx={ctx} onOpen={noop} />
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
        <div id="harness-staffing-week" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14, height: 300 }}>
          <WidgetStaffing
            widget={{ id: "ws1", type: "staffing", staffingRange: "week", staffingOffset: 0, staffingMembers: [], staffingShowWeekends: true, staffingShowLoad: true }}
            ctx={ctx}
            staffing={staffing}
            onUpdateStaffing={setStaffing}
            onUpdateWidget={noop}
          />
        </div>
        <div id="harness-staffing-month" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 900, marginTop: 14, height: 300 }}>
          <WidgetStaffing
            widget={{ id: "ws2", type: "staffing", staffingRange: "month", staffingOffset: 0, staffingMembers: [], staffingShowWeekends: true, staffingShowLoad: true }}
            ctx={ctx}
            staffing={staffing}
            onUpdateStaffing={setStaffing}
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
  const benchTasks = [...seedTasks, ...seedTasks.map((t, i) => ({ ...t, id: `bench-${i}`, title: `Réunion de chantier ${i}` }))];
  const benchWidgets = [
    "kpi", "chart", "list", "minigantt", "bubbles", "criticalPath", "heatmapMonth",
    "milestoneTimeline", "verticalMetroTimeline", "metroDeadline", "blockers",
    "nextBestAction", "dailyBriefing", "dominoEffect", "projectTreemap",
    "deadlineScatter", "heatmapGrid", "embedMetro", "embedTimeline", "embedRadar",
    "customCard",
  ].map((type, i) => ({ id: `banc-${type}`, type, title: type, layout: { x: (i % 4) * 3, y: Math.floor(i / 4) * 4, w: 3, h: 4 } }));
  benchWidgets.push(
    { id: "banc-taskDetail", type: "taskDetail", title: "taskDetail", taskDetailTaskId: seedTasks[0]?.id, layout: { x: 0, y: 96, w: 3, h: 4 } },
    { id: "banc-countdown", type: "countdown", title: "countdown", countdownMode: "task", countdownTaskId: seedTasks[0]?.id, layout: { x: 3, y: 96, w: 3, h: 4 } },
  );
  const mem = new Map(Object.entries({
    "nexora:tasks": JSON.stringify(benchTasks),
    "nexora:projects": JSON.stringify(seedProjects),
    "nexora:statuses": JSON.stringify(seedStatuses),
    "nexora:taskTypes": JSON.stringify(seedTaskTypes),
    "nexora:teamMembers": JSON.stringify(seedTeamMembers),
    "nexora:dashboards": JSON.stringify([{ id: "banc-d1", name: "Tableau du banc", folderId: null, pages: [{ id: "banc-p1", name: "Page 1", widgets: benchWidgets }], activePageId: "banc-p1" }]),
    "nexora:activeDashboardId": JSON.stringify("banc-d1"),
  }));
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
root.render(React.createElement(benchApp ? () => React.createElement(LePlan, { currentUser: { uid: "banc", email: "banc@local" }, onSignOut: () => {} }) : AnnotationsHarness));
