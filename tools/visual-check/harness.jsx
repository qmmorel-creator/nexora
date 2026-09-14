// ---- Banc d'essai local (scratchpad, jamais committé) : monte le Gantt
// complet et le Mini-Gantt sur les données de démonstration, sans Firebase.
function AnnotationsHarness() {
  // Les risques de délai vivent sur la tâche : ils doivent apparaître dans
  // TOUS les Mini-Gantt qui affichent cette tâche, quelle que soit la
  // configuration de chaque widget.
  const seedWithRisks = seedTasks.map((t) => {
    if (t.id === "t1") return { ...t, delayRisks: [
      { id: "rk1", title: "Fournisseur", severity: "high", style: "hatched" },
      { id: "rk2", title: "Météo", severity: "low", style: "dashed", color: "#F2A93B" },
    ] };
    if (t.id === "t4") return { ...t, delayRisks: [{ id: "rk3", title: "Validation tardive", severity: "medium", style: "solid", color: "#8B5CF6" }] };
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
  const [miniWidget, setMiniWidget] = useState({ id: "w1", type: "minigantt", colorBy: "status", miniGanttFields: ["status", "end"], ganttAnnotations: miniAnnotations });
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
  const [openedProjectId, setOpenedProjectId] = useState("");
  const [toolbar, setToolbar] = useState(null);
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
        {treemapFormOpen && (
          <WidgetFormModal
            widget={treemapWidget}
            existingWidgets={[]}
            ctx={ctx}
            pageFilter={null}
            onSave={(data) => { setTreemapWidget((w) => ({ ...w, ...data })); setTreemapFormOpen(false); }}
            onClose={() => setTreemapFormOpen(false)}
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
