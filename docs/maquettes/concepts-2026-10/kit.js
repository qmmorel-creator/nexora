// Socle commun des maquettes « Concepts Nexora » (octobre 2026).
// DONNÉES DE DÉMONSTRATION uniquement : aucune connexion à Firebase, à l'API
// ni au MCP. Tout reste en mémoire dans la page et disparaît au rechargement.
// La forme des données reprend celle de Nexora (nexora:tasks, nexora:projects,
// nexora:projectFolders, habitudes, santé, sport, budget) pour que chaque
// concept montre exactement les mêmes informations.
(function () {
  "use strict";

  const TODAY = "2026-10-05"; // lundi fictif, fixé pour comparer les concepts
  const NOW = "10:40";

  function addDays(iso, n) {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const J = (n) => addDays(TODAY, n);

  const D = {
    today: TODAY,
    now: NOW,
    user: "Quentin (démo)",
    folders: [
      { id: "f-chantiers", name: "Chantiers" },
      { id: "f-com", name: "Communication" },
      { id: "folder-a-trier", name: "À trier" },
    ],
    projects: [
      { id: "p-ctex6", name: "CTEX6", color: "#d64545", folderId: "f-chantiers", budget: 50000, spent: 31200, next: "Visite DREAL" },
      { id: "p-lot2b", name: "Lot 2B", color: "#7c5cd6", folderId: "f-chantiers", budget: 18000, spent: 6100, next: "Revue DOE" },
      { id: "p-com", name: "Communication", color: "#d99a2b", folderId: "f-com", budget: 0, spent: 0, next: "Deadline MAJ Octopus" },
      { id: "p-agenda", name: "Agenda Google", color: "#3b82f6", folderId: "folder-a-trier", budget: 0, spent: 0, gcal: true },
    ],
    statuses: [
      { id: "s1", name: "À planifier", color: "#64748b" },
      { id: "s2", name: "Attente tiers", color: "#d97706" },
      { id: "s3", name: "En cours", color: "#0284c7" },
      { id: "s5", name: "Terminé", color: "#16a34a" },
      { id: "s6", name: "Information", color: "#94a3b8" },
    ],
    types: [
      { id: "tt1", name: "Tâche" }, { id: "tt2", name: "Planning" },
      { id: "tt3", name: "Réunion" }, { id: "tt4", name: "Information" },
    ],
    members: ["Quentin Morel", "Vincent Bernard", "Maïa Sonnier", "Anne-Laure Masson"],
    tasks: [
      { id: "t1", title: "Documents FOR-0129", projectId: "p-ctex6", statusId: "s3", typeId: "tt1", start: J(-70), end: J(-44), assignee: "Vincent Bernard", crit: "urgent", progress: 60, checklist: [{ text: "Plan de contrôle", done: true }, { text: "Notes de calcul", done: false }] },
      { id: "t2", title: "PV Contrôles DREAL", projectId: "p-ctex6", statusId: "s1", typeId: "tt1", start: J(-44), end: J(-30), assignee: "Vincent Bernard", crit: "urgent", progress: 0, dependsOn: ["t1"], desc: "Compiler les PV des contrôles réglementaires avant la visite DREAL.", checklist: [{ text: "PV levage", done: true }, { text: "PV électrique", done: false }, { text: "PV incendie", done: false }], attachments: ["Trame PV — Drive"] },
      { id: "t3", title: "Visite DREAL", projectId: "p-ctex6", statusId: "s1", typeId: "tt3", start: J(3), end: J(3), milestone: true, assignee: "Quentin Morel", startTime: "09:00", endTime: "11:00" },
      { id: "t13", title: "Relancer le bureau de contrôle", projectId: "p-ctex6", statusId: "s3", typeId: "tt1", start: J(0), end: J(0), assignee: "Quentin Morel", crit: "moyen", startTime: "11:00", endTime: "11:30", estimate: 30 },
      { id: "t15", title: "Commande garde-corps", projectId: "p-ctex6", statusId: "s2", typeId: "tt1", start: J(-3), end: J(6), assignee: "Maïa Sonnier", progress: 20 },
      { id: "t4", title: "Revue DOE", projectId: "p-lot2b", statusId: "s3", typeId: "tt1", start: J(-20), end: J(5), assignee: "Quentin Morel", crit: "moyen", progress: 35, attachments: ["DOE Lot 2B — Drive"] },
      { id: "t5", title: "Demande lame pour piste d'accès", projectId: "p-lot2b", statusId: "s1", typeId: "tt1", start: J(-63), end: J(-61), assignee: "Maïa Sonnier" },
      { id: "t7", title: "Point hebdo chantier", projectId: "p-lot2b", statusId: "s3", typeId: "tt3", start: J(0), end: J(0), startTime: "08:30", endTime: "09:00", recurrence: "Chaque semaine", assignee: "Quentin Morel", focus: true },
      { id: "t14", title: "Valider le devis échafaudage", projectId: "p-lot2b", statusId: "s1", typeId: "tt1", start: J(0), end: J(0), assignee: "Quentin Morel", crit: "urgent", estimate: 45 },
      { id: "t6", title: "Réunion Expert", projectId: "p-lot2b", statusId: "s5", typeId: "tt3", start: J(-15), end: J(-15), assignee: "Quentin Morel" },
      { id: "t8", title: "Confirmer les personnes CNR aux PI", projectId: "p-com", statusId: "s2", typeId: "tt1", start: J(-20), end: J(-13), assignee: "Anne-Laure Masson" },
      { id: "t9", title: "Deadline MAJ Octopus complète", projectId: "p-com", statusId: "s1", typeId: "tt2", start: J(2), end: J(2), milestone: true, assignee: "Quentin Morel", crit: "bas" },
      { id: "t10", title: "Newsletter d'octobre", projectId: "p-com", statusId: "s1", typeId: "tt1", start: J(5), end: J(12), assignee: "", dependsOn: ["t9"] },
      { id: "t11", title: "Congés scolaires (zone A)", projectId: "p-com", statusId: "s6", typeId: "tt4", start: J(12), end: J(26) },
      { id: "t12", title: "Copil mensuel", projectId: "p-agenda", statusId: "s1", typeId: "tt3", start: J(1), end: J(1), startTime: "14:00", endTime: "15:30", gcal: true },
    ],
    // Santé : mêmes mesures que HEALTH_METRICS (Whoop, balance), 14 derniers jours.
    health: {
      sleep: [6.4, 7.1, 6.8, 7.5, 6.2, 7.9, 8.1, 6.9, 7.3, 6.6, 7.0, 7.8, 8.0, 7.2],
      recovery: [55, 62, 48, 71, 44, 78, 83, 60, 66, 51, 58, 74, 80, 68],
      hrv: [48, 52, 45, 58, 42, 61, 64, 50, 55, 47, 49, 59, 62, 54],
      restingHr: [54, 53, 56, 52, 57, 51, 50, 53, 52, 55, 54, 51, 50, 52],
      weight: [79.6, 79.5, 79.4, 79.4, 79.2, 79.1, 79.0, 78.9, 78.9, 78.8, 78.7, 78.6, 78.5, 78.4],
      steps: [8200, 10400, 6100, 12800, 5400, 9800, 14200, 7600, 9100, 6800, 11200, 13900, 15100, 3200],
    },
    // Sport : séances (SPORT_COLUMNS) et objectif hebdomadaire (nexora:sportGoals).
    sport: {
      goalHours: 5,
      lastWeekMinutes: 220,
      sessions: [
        { date: J(-5), sport: "Renforcement", title: "Gainage + haut du corps", minutes: 35, km: 0, dplus: 0, hr: 118 },
        { date: J(-2), sport: "Course", title: "Footing Confluence", minutes: 42, km: 8.2, dplus: 60, hr: 148 },
        { date: J(-1), sport: "Vélo", title: "Monts d'Or", minutes: 70, km: 32.4, dplus: 320, hr: 136 },
        { date: J(-8), sport: "Course", title: "Fractionné 6 × 400", minutes: 38, km: 7.1, dplus: 25, hr: 156 },
        { date: J(-10), sport: "Natation", title: "Piscine Garibaldi", minutes: 35, km: 1.6, dplus: 0, hr: 128 },
      ],
      planned: [{ date: J(0), time: "18:30", sport: "Course", title: "Footing 45 min", minutes: 45 }, { date: J(2), time: "07:00", sport: "Renforcement", title: "Gainage", minutes: 30 }, { date: J(5), time: "09:30", sport: "Vélo", title: "Sortie longue", minutes: 120 }],
    },
    habits: [
      { theme: "Santé", items: [{ name: "Eau 2 L", done: true }, { name: "Lecture", done: true }, { name: "Méditation", done: false }, { name: "Pas (milliers)", value: 3, max: 10 }] },
      { theme: "Lieu", single: true, items: [{ name: "Bureau", done: true }, { name: "Télétravail", done: false }] },
    ],
    // Budget personnel (KDM360) : mois d'octobre, au 5.
    budget: {
      month: "Octobre 2026", total: 2100, spent: 688, dayOfMonth: 5, daysInMonth: 31,
      categories: [
        { name: "Courses", spent: 210, limit: 450, color: "#16a34a" },
        { name: "Maison", spent: 150, limit: 400, color: "#0284c7" },
        { name: "Restaurants", spent: 112, limit: 100, color: "#dc2626" },
        { name: "Transport", spent: 96, limit: 180, color: "#7c5cd6" },
        { name: "Abonnements", spent: 60, limit: 90, color: "#64748b" },
        { name: "Loisirs", spent: 60, limit: 200, color: "#d99a2b" },
        { name: "Santé", spent: 0, limit: 80, color: "#db2777" },
      ],
      toCategorize: [
        { id: "x1", date: J(-1), label: "CARREFOUR CITY LYON 2", amount: -46.2, suggest: "Courses" },
        { id: "x2", date: J(-2), label: "SNCF CONNECT", amount: -38, suggest: "Transport" },
      ],
      transactions: [
        { date: J(0), label: "Boulangerie Paul", amount: -6.4, cat: "Restaurants" },
        { date: J(-1), label: "CARREFOUR CITY LYON 2", amount: -46.2, cat: null },
        { date: J(-2), label: "SNCF CONNECT", amount: -38, cat: null },
        { date: J(-2), label: "Decathlon", amount: -54.99, cat: "Loisirs" },
        { date: J(-3), label: "Le Bouchon des Filles", amount: -58, cat: "Restaurants" },
        { date: J(-4), label: "Spotify", amount: -11.99, cat: "Abonnements" },
        { date: J(-4), label: "Salaire octobre", amount: 3250, cat: "Revenus" },
      ],
    },
    wealth: {
      total: 84300,
      parts: [
        { name: "Assurance-vie", value: 41150, color: "#0f766e" },
        { name: "Livret A", value: 22950, color: "#0284c7" },
        { name: "PEA", value: 14000, color: "#7c5cd6" },
        { name: "Comptes courants", value: 6200, color: "#94a3b8" },
      ],
      series: [76.1, 76.8, 77.0, 77.9, 78.4, 79.2, 79.0, 80.3, 81.1, 82.0, 83.2, 84.3],
    },
    pro: { quotes: 2, invoices: 3, unpaid: 4800 },
  };

  // ------------------------------------------------------------------ outils
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const days = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const dow = (iso) => new Date(iso + "T12:00:00Z").getUTCDay();
  const K = {
    D, J, esc, days, addDays,
    project: (id) => D.projects.find((p) => p.id === id) || { name: "Sans projet", color: "#94a3b8" },
    status: (id) => D.statuses.find((s) => s.id === id) || D.statuses[0],
    type: (id) => D.types.find((t) => t.id === id) || D.types[0],
    isDone: (t) => t.statusId === "s5",
    isLate: (t) => t.statusId !== "s5" && t.statusId !== "s6" && t.end < TODAY,
    lateDays: (t) => days(t.end, TODAY),
    initials: (n) => (n || "").split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "·",
    first: (n) => (n || "").split(" ")[0] || "Personne",
    dayName: (iso) => JOURS[dow(iso)],
    dayShort: (iso) => JOURS[dow(iso)].slice(0, 3) + ".",
    dateShort: (iso) => { const d = new Date(iso + "T12:00:00Z"); return d.getUTCDate() + " " + MOIS[d.getUTCMonth()]; },
    dateLong: (iso) => { const d = new Date(iso + "T12:00:00Z"); return JOURS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MOIS_LONG[d.getUTCMonth()]; },
    rel(iso) {
      const n = days(TODAY, iso);
      if (n === 0) return "aujourd'hui";
      if (n === 1) return "demain";
      if (n === -1) return "hier";
      if (n < 0) return Math.abs(n) + " j de retard";
      if (n < 7) return JOURS[dow(iso)];
      return K.dateShort(iso);
    },
    euro: (v, dec) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("fr-FR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }) + " €",
    hm: (min) => (min >= 60 ? Math.floor(min / 60) + " h " + String(min % 60).padStart(2, "0") : min + " min"),
    last: (arr) => arr[arr.length - 1],
    critLabel: { urgent: "Urgent", moyen: "Moyen", bas: "Bas" },
    critColor: { urgent: "#dc2626", moyen: "#d97706", bas: "#16a34a" },
    week: () => Array.from({ length: 7 }, (_, i) => J(i)),

    // Requêtes communes, pour que tous les concepts montrent la même chose.
    tasks: () => K.state.tasks,
    open: () => K.state.tasks.filter((t) => !K.isDone(t) && t.statusId !== "s6"),
    late: () => K.open().filter(K.isLate).sort((a, b) => a.end.localeCompare(b.end)),
    todayTasks: () => K.open().filter((t) => t.start <= TODAY && t.end >= TODAY).sort((a, b) => (a.startTime || "99").localeCompare(b.startTime || "99")),
    upcoming: (n = 7) => K.open().filter((t) => t.end > TODAY && t.end <= J(n)).sort((a, b) => a.end.localeCompare(b.end)),
    byProject: (pid) => K.state.tasks.filter((t) => t.projectId === pid),
    projectStats(pid) {
      const all = K.byProject(pid).filter((t) => t.statusId !== "s6");
      const done = all.filter(K.isDone).length;
      const prog = all.length ? Math.round(all.reduce((s, t) => s + (K.isDone(t) ? 100 : t.progress || 0), 0) / all.length) : 0;
      return { total: all.length, open: all.length - done, done, late: all.filter(K.isLate).length, progress: prog };
    },
    blocked: (t) => (t.dependsOn || []).some((id) => { const d = K.state.tasks.find((x) => x.id === id); return d && !K.isDone(d); }),
    sportWeek() {
      const mon = TODAY; const sun = J(6);
      const done = D.sport.sessions.filter((s) => s.date >= mon && s.date <= sun).reduce((a, s) => a + s.minutes, 0);
      return { done, goal: D.sport.goalHours * 60, last: D.sport.lastWeekMinutes };
    },
    budgetPace() {
      const b = D.budget; const expected = Math.round(b.total * b.dayOfMonth / b.daysInMonth);
      return { left: b.total - b.spent, expected, ahead: b.spent - expected, perDay: Math.round((b.total - b.spent) / (b.daysInMonth - b.dayOfMonth + 1)) };
    },

    // --------------------------------------------------------- graphiques SVG
    spark(values, { w = 120, h = 32, color = "currentColor", fill = true, dot = true, min, max } = {}) {
      const lo = min ?? Math.min(...values), hi = max ?? Math.max(...values), r = hi - lo || 1;
      const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - lo) / r) * (h - 6)]);
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      const lp = pts[pts.length - 1];
      return `<svg class="k-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${fill ? `<path d="${d} L${lp[0].toFixed(1)} ${h} L2 ${h} Z" fill="${color}" opacity=".12"/>` : ""}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>${dot ? `<circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="2.6" fill="${color}"/>` : ""}</svg>`;
    },
    ring(pct, { size = 64, stroke = 7, color = "currentColor", track = "rgba(0,0,0,.08)", label = "" } = {}) {
      const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct));
      return `<svg class="k-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label || v + " %")}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
    },
    bars(values, { w = 140, h = 40, color = "currentColor", gap = 2, hi = -1 } = {}) {
      const max = Math.max(...values) || 1, bw = (w - gap * (values.length - 1)) / values.length;
      return `<svg class="k-bars" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${values.map((v, i) => { const bh = Math.max(1.5, (v / max) * (h - 2)); return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="${color}" opacity="${i === hi || (hi < 0 && i === values.length - 1) ? 1 : 0.35}"/>`; }).join("")}</svg>`;
    },

    // ------------------------------------------------------------------ état
    state: null,
    reset() {
      K.state = {
        concept: "cadran", screen: "jour", device: "desktop",
        projectId: "p-ctex6", taskId: null, composer: false, toast: "",
        tasks: JSON.parse(JSON.stringify(D.tasks)),
        habits: JSON.parse(JSON.stringify(D.habits)),
        categorized: {},
        draft: "Relancer BC vendredi 14h #CTEX6 @Vincent !urgent",
      };
    },
    // Analyse la saisie rapide, avec les mêmes préfixes que Nexora Futur
    // (src/donnees/saisie.ts) : #projet, @personne, !criticité, jour, heure.
    parse(text) {
      const out = { title: [], projectId: null, assignee: "", crit: "", end: TODAY, startTime: "", tokens: [] };
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      const joursIdx = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
      for (const w of words) {
        const lw = w.toLowerCase();
        if (w.startsWith("#")) { const p = D.projects.find((x) => x.name.replace(/\s/g, "").toLowerCase() === lw.slice(1)); if (p) { out.projectId = p.id; out.tokens.push(["projet", p.name]); continue; } }
        if (w.startsWith("@")) { const m = D.members.find((x) => x.toLowerCase().startsWith(lw.slice(1))); if (m) { out.assignee = m; out.tokens.push(["responsable", m]); continue; } }
        if (w.startsWith("!")) { const c = { urgent: "urgent", u: "urgent", moyen: "moyen", m: "moyen", bas: "bas", b: "bas" }[lw.slice(1)]; if (c) { out.crit = c; out.tokens.push(["criticité", K.critLabel[c]]); continue; } }
        if (lw === "demain") { out.end = J(1); out.tokens.push(["fin", "demain"]); continue; }
        if (lw === "aujourd'hui" || lw === "auj") { out.end = TODAY; out.tokens.push(["fin", "aujourd'hui"]); continue; }
        if (lw in joursIdx) { let n = (joursIdx[lw] - dow(TODAY) + 7) % 7 || 7; out.end = J(n); out.tokens.push(["fin", lw + " " + K.dateShort(J(n))]); continue; }
        if (/^\d{1,2}h(\d{2})?$/.test(lw)) { const [h, m] = lw.split("h"); out.startTime = h.padStart(2, "0") + ":" + (m || "00"); out.tokens.push(["heure", out.startTime]); continue; }
        out.title.push(w);
      }
      out.title = out.title.join(" ");
      return out;
    },
    createFromDraft(text) {
      const p = K.parse(text);
      if (!p.title) return null;
      const t = { id: "n" + Date.now(), title: p.title, projectId: p.projectId || K.state.projectId, statusId: "s1", typeId: "tt1", start: p.end < TODAY ? p.end : TODAY, end: p.end, assignee: p.assignee || "Quentin Morel", crit: p.crit, startTime: p.startTime, isNew: true };
      K.state.tasks.push(t);
      return t;
    },
    task: (id) => K.state.tasks.find((t) => t.id === id),
  };

  // Champs de la fiche tâche : l'essentiel d'abord, le reste replié.
  K.fields = (t) => {
    const p = K.project(t.projectId), s = K.status(t.statusId);
    return [
      ["Projet", `<span class="k-dot" style="--c:${p.color}"></span>${K.esc(p.name)}`],
      ["Statut", `<span class="k-st" style="--c:${s.color}">${K.esc(s.name)}</span>`],
      ["Échéance", `${K.dateShort(t.end)}${t.startTime ? " · " + t.startTime + (t.endTime ? "–" + t.endTime : "") : ""} <span class="k-rel ${K.isLate(t) ? "is-late" : ""}">${K.rel(t.end)}</span>`],
      ["Responsable", t.assignee ? `<span class="k-av">${K.initials(t.assignee)}</span>${K.esc(t.assignee)}` : `<span class="k-muted">Personne</span>`],
      ["Criticité", t.crit ? `<span class="k-crit" style="--c:${K.critColor[t.crit]}">${K.critLabel[t.crit]}</span>` : `<span class="k-muted">Non définie</span>`],
    ];
  };
  K.more = (t) => [
    ["Type", K.type(t.typeId).name + (t.milestone ? " · jalon" : "") + (t.focus ? " · focus" : "")],
    ["Début", K.dateShort(t.start)],
    ["Récurrence", t.recurrence || "Aucune"],
    ["Projet secondaire", "Aucun"],
    ["Référence de planning", "Non figée"],
    ["Risques de délai", "Aucun"],
    ["Historique", "2 modifications · voir le journal"],
  ];
  K.deps = (t) => (t.dependsOn || []).map((id) => K.task(id)).filter(Boolean);
  K.previewHtml = (text) => {
    const p = K.parse(text);
    const chips = p.tokens.map(([k, v]) => `<span class="k-tok"><b>${K.esc(k)}</b> ${K.esc(v)}</span>`).join("");
    return `<span class="k-tok k-tok-title"><b>titre</b> ${K.esc(p.title || "…")}</span>${chips}`;
  };

  window.K = K;
  window.CONCEPTS = window.CONCEPTS || {};
})();
