// ---- Banc d'essai local (scratchpad, jamais committé) : monte le Gantt
// complet et le Mini-Gantt sur les données de démonstration, sans Firebase.
function AnnotationsHarness() {
  const [tasks, setTasks] = useState(seedTasks);
  const [projects, setProjects] = useState(seedProjects);
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
    risks: [
      { id: "rk1", taskId: "t1", title: "Fournisseur", severity: "high", style: "hatched" },
      { id: "rk2", taskId: "t1", title: "Météo", severity: "low", style: "dashed", color: "#F2A93B" },
      { id: "rk3", taskId: "t4", title: "Validation tardive", severity: "medium", style: "solid", color: "#8B5CF6" },
      { id: "rk4", taskId: "disparue", title: "Tâche supprimée", severity: "critical" },
    ],
    notes: [
      { id: "n1", title: "Relance hebdo", text: "Point fournisseur le lundi.", anchor: { kind: "task", id: "t2" } },
    ],
  };
  const [prefs, setPrefsState] = useState({ ganttGroupBy: "project", bubbleFields: ["status", "project"], ganttCols: ["status", "start", "end"], zoomKey: "week", ...annotations });
  const setPrefs = (patch) => setPrefsState((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const [miniWidget, setMiniWidget] = useState({ id: "w1", type: "minigantt", colorBy: "status", miniGanttFields: ["status", "end"], ganttAnnotations: miniAnnotations });
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
        <h2 style={{ fontSize: 13, margin: "0 0 6px", fontFamily: "monospace" }}>MINI-GANTT</h2>
        <button type="button" id="harness-open-widget-form" onClick={() => setFormOpen(true)} style={{ marginBottom: 8 }}>
          Ouvrir la fiche du widget (filtre projet p2)
        </button>
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
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", width: 700 }}>
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
