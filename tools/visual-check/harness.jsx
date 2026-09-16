// ---- Banc d'essai local (scratchpad, jamais committé) : monte le Gantt
// complet et le Mini-Gantt sur les données de démonstration, sans Firebase.
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
  const [tasks, setTasks] = useState([...seedWithRisks, calendarTask]);
  const [projects, setProjects] = useState([...seedProjects, calendarProject]);
  const [statuses, setStatuses] = useState(seedStatuses);
  const ctx = { projects, statuses, taskTypes: seedTaskTypes, tasks, teamMembers: seedTeamMembers, projectFolders: [], customFieldDefs: [], expenses: [], risks: [], myName: null };
  const appearance = { gradient: { enabled: true, from: "#FF7A3D", to: "#1FA971" }, ganttBg: "#EAEDF3", barBg: "#C7CED9", progressColorByStatus: false, accentColor: "#FF7A3D", density: "comfortable", milestoneStyle: "flag", radiusStyle: "sharp", progressTexture: false, ganttShowSubtasks: false, viewIcons: {} };
  const annotations = {
    temporalBlocks: [
      { id: "b1", title: "Études", startDate: "2026-07-13", endDate: "2026-08-20", color: "#4F6AF5", borderStyle: "dashed" },
      { id: "b2", title: "Gros œuvre", startDate: "2026-08-21", endDate: "2026-09-20", color: "#22B07D", borderStyle: "solid" },
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
    milestones: [
      { id: "ms1", title: "Décision CODIR", date: "2026-08-18", type: "decision" },
      { id: "ms2", title: "Mise en service", date: "2026-09-22", type: "commissioning" },
    ],
    notes: [
      { id: "n1", title: "Relance hebdo", text: "Point fournisseur le lundi.", anchor: { kind: "task", id: "t2" } },
    ],
  };
  const [prefs, setPrefsState] = useState({ ganttGroupBy: "project", bubbleFields: ["status", "project"], ganttCols: ["status", "start", "end"], zoomKey: "week", ...annotations });
  const setPrefs = (patch) => setPrefsState((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const [miniWidget, setMiniWidget] = useState({ id: "w1", type: "minigantt", colorBy: "status", miniGanttFields: ["assignee", "status", "taskType", "end", "progress"], ganttAnnotations: miniAnnotations });
  // Second widget SANS aucune annotation propre : seuls les risques portés par
  // les tâches doivent y apparaître.
  const [otherWidget, setOtherWidget] = useState({ id: "w2", type: "minigantt", colorBy: "status", miniGanttFields: ["end"] });
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
  const noop = () => {};
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 22 }}>
      <GlobalStyles />
      <div>
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>GANTT COMPLET</h2>
        <div className="lp-gantt-toolbar" ref={setToolbar} />
        <GanttView
          tasks={tasks} ctx={ctx} appearance={appearance} setAppearance={noop}
          setTasks={setTasks} setProjects={setProjects} setStatuses={setStatuses}
          onOpen={noop} onAdd={noop} onDelete={noop} onMarkDone={noop} onCycleStatus={noop} onBulkDelete={noop}
          prefs={prefs} setPrefs={setPrefs} toolbarSlot={toolbar}
        />
      </div>
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
            risks={[{ id: "r1", projectId: "p1", status: "open" }, { id: "r2", projectId: "p1", status: "closed" }]}
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
            tasks={tasks} ctx={ctx} risks={[]} expenses={[]} onOpenProject={noop} onEditProject={noop} onFilterProject={noop}
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
            tasks={tasks} ctx={ctx} risks={[]} expenses={[]}
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
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>MINI-GANTT</h2>
        <button type="button" id="harness-open-widget-form" onClick={() => setFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche du widget (filtre projet p2)
        </button>
        <button type="button" id="harness-open-task-modal" onClick={() => setTaskModalOpen(true)} style={{ marginBottom: 8, marginLeft: 8 }}>
          Ouvrir la fiche de la tâche Google Calendar
        </button>
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
            customFieldDefs={[]}
            shortcutPrefs={{}}
            onClose={() => setTaskModalOpen(false)}
            onSave={() => setTaskModalOpen(false)}
            onDelete={noop}
          />
        )}
        {/* Aucun champ à droite (issue #66) : la colonne doit disparaître
            complètement et la piste aller jusqu'au bord du widget. */}
        <div id="harness-nofields-minigantt" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700, marginTop: 14 }}>
          <WidgetMiniGantt
            widget={{ id: "w9", type: "minigantt", colorBy: "status", miniGanttFields: [] }}
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
    </div>
  );
}
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(AnnotationsHarness));
