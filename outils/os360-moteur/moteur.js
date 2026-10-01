/* === NEXORA:OS360-MOTEUR:START ===
   Point d'entrée du « moteur de graphiques OS360 » servi par Nexora (#573).

   Ce code est INJECTÉ dans une copie du bundle OS360 par generer.mjs : il vit
   dans la portée du module OS360 et utilise donc ses noms minifiés (stables
   pour un commit donné, vérifiés par generer.mjs). Il remplace le montage de
   l'application OS360 (gCe) : la séquence de démarrage d'OS360, avec toutes
   ses surcouches (osDensityUpgrade, osRefine… qui redéfinissent Nf, lCe, te,
   Lf…), s'exécute à l'identique ; seul ce qui est affiché change — le contenu
   d'UN widget, sans le cadre ni l'en-tête OS360, que Nexora fournit.

   Protocole (postMessage, page isolée par sandbox="allow-scripts") :
     parent → moteur  { type: "nx-data", rows }          lignes brutes KDM360
                      { type: "nx-widget", widget }      { type, title, config }
                      { type: "nx-options" }             ouvre les Options OS360
     moteur → parent  { source, type: "nx-ready", catalogue }
                      { source, type: "nx-widget-change", widget }
   Tables attendues dans `rows` : celles que lit OS360 (transactions, accounts,
   categories, subcategories, banks, accountTypes, budgets, balances). */

var nxMoteurSource = "nx-os360-moteur";
var nxMoteurWidgetId = "nx-widget";
var nxMoteurNodeId = "nx-node";

function nxMoteurPost(message) {
  window.parent.postMessage(Object.assign({ source: nxMoteurSource }, message), "*");
}

// Widgets Budget du catalogue OS360, tel que ses surcouches l'ont arrangé.
function nxMoteurCatalogue() {
  return gl.filter(function (d) { return d.domain === "budget"; }).map(function (d) {
    return { type: d.type, label: d.label, category: d.category || "", description: d.description || "" };
  });
}

// Pose (ou remplace) l'unique widget dans un tableau de bord dédié du store
// OS360 : les contrôles d'OS360 (barre de période, variante, Options)
// écrivent dans ce store, et ses changements repartent vers Nexora.
function nxMoteurPoseWidget(widget) {
  Z9.commit(function (state) {
    var node = state.nodes.find(function (n) { return n.id === nxMoteurNodeId; });
    var nodes = state.nodes;
    if (!node) {
      var model = state.nodes.find(function (n) { return n.kind === "dashboard"; });
      node = Object.assign({}, model, { id: nxMoteurNodeId, title: "Nexora", example: false });
      nodes = nodes.concat([node]);
    }
    var base = ul(widget.type, node.id, state.settings);
    var next = Object.assign({}, base, {
      id: nxMoteurWidgetId, dashboardId: node.id, x: 0, y: 0,
      title: widget.title || base.title,
      config: Object.assign({}, base.config, widget.config || {}),
    });
    return Object.assign({}, state, {
      nodes: nodes, activeId: node.id,
      widgets: state.widgets.filter(function (w) { return w.id !== nxMoteurWidgetId; }).concat([next]),
    });
  });
}

function nxMoteur() {
  var R = X9, J = $9;
  var state = R.useSyncExternalStore(Z9.subscribe, Z9.snapshot);
  var budgetState = R.useState(null), budget = budgetState[0], setBudget = budgetState[1];
  var errorState = R.useState(""), error = errorState[0], setError = errorState[1];
  var optionsState = R.useState(false), options = optionsState[0], setOptions = optionsState[1];
  var last = R.useRef("");

  R.useEffect(function () {
    function on(event) {
      if (event.source !== window.parent) return;
      var d = event.data || {};
      try {
        if (d.type === "nx-data") { setBudget(osBudgetCategoryColors(Fc(d.rows))); setError(""); }
        else if (d.type === "nx-widget" && d.widget && d.widget.type) { last.current = JSON.stringify(d.widget); nxMoteurPoseWidget(d.widget); }
        else if (d.type === "nx-options") setOptions(true);
      } catch (e) { setError(D(e)); }
    }
    addEventListener("message", on);
    nxMoteurPost({ type: "nx-ready", catalogue: nxMoteurCatalogue() });
    return function () { removeEventListener("message", on); };
  }, []);

  var widget = state.widgets.find(function (w) { return w.id === nxMoteurWidgetId; });

  // Un réglage changé dans OS360 (barre de période, Options…) repart vers Nexora.
  R.useEffect(function () {
    if (!widget) return;
    var out = { type: widget.type, title: widget.title, config: widget.config };
    var key = JSON.stringify(out);
    if (key === last.current) return;
    last.current = key;
    nxMoteurPost({ type: "nx-widget-change", widget: out });
  }, [widget]);

  if (error) return J.jsx("div", { className: "nx-moteur-message", role: "alert", children: error });
  if (!budget || !widget) return J.jsx("div", { className: "nx-moteur-message", children: "Chargement…" });

  var health = nl.snapshot(), sport = rl.snapshot();
  var data = {
    health: health.data, sport: sport.data, budget: budget,
    healthStatus: health, sportStatus: sport,
    budgetStatus: { phase: "ready", origin: "remote", updatedAt: new Date().toISOString(), error: "" },
  };
  var node = osTabNode(state.nodes.find(function (n) { return n.id === nxMoteurNodeId; }));
  return J.jsxs("div", { className: "nx-moteur", children: [
    J.jsx("article", { className: "widget " + (widget.domain || "budget"), children:
      J.jsx("div", { className: "widget-content", children:
        J.jsx(W9, { widgetTitle: widget.title, widgetType: widget.type, children:
          J.jsx(lCe, { widget: widget, node: node, data: data, settings: state.settings, onTransaction: function () {}, onPoint: function () {} }) }) }) }),
    // Réglages : le panneau latéral d'OS360 (osSidebarSettings), que son
    // bouton Options ouvre dans l'application — ici en surimpression.
    options && J.jsxs("aside", { className: "nx-moteur-options", "aria-label": "Réglages OS360", children: [
      J.jsxs("header", { children: [
        J.jsx("strong", { children: "Réglages · " + widget.title }),
        J.jsx("button", { type: "button", onClick: function () { setOptions(false); }, children: "Fermer" }),
      ] }),
      J.jsx("div", { className: "nx-moteur-options-body", children:
        J.jsx(osSidebarSettings, { selected: nxMoteurWidgetId, onSelect: function () {}, node: node, data: data }) }),
    ] }),
  ] });
}
/* === NEXORA:OS360-MOTEUR:END === */
