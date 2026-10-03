// Concept 3 — Partition : le temps en colonnes, les domaines de vie en portées.
(function () {
  const K = window.K, D = K.D, e = K.esc;
  const H0 = 7, H1 = 22;
  const hh = (t) => { const [a, b] = t.split(":").map(Number); return a + b / 60; };
  const pos = (h) => (((Math.max(H0, Math.min(H1, h)) - H0) / (H1 - H0)) * 100).toFixed(2) + "%";
  const lanes = () => [
    ...D.projects.map((p) => ({ id: p.id, label: p.name, sub: D.folders.find((f) => f.id === p.folderId).name, color: p.color, kind: "projet" })),
    { id: "corps", label: "Corps", sub: "santé · sport", color: "#0f9d76", kind: "corps" },
    { id: "argent", label: "Argent", sub: "budget", color: "#6d28d9", kind: "argent" },
  ];
  const laneHead = (l, S) => {
    const late = l.kind === "projet" ? K.projectStats(l.id).late : 0;
    const go = l.kind === "projet" ? `data-go="projet" data-project="${l.id}"` : `data-go="${l.kind}"`;
    const cur = (l.kind === "projet" && S.view === "projet" && S.projectId === l.id) || S.view === l.kind;
    return `<button type="button" class="pt-lh" style="--c:${l.color}" ${go} aria-current="${cur}"><b>${e(l.label)}</b><small>${e(l.sub)}${late ? ` · <em>${late} en retard</em>` : ""}</small></button>`;
  };
  const note = (t, style) => `<button type="button" class="pt-note ${K.isDone(t) ? "is-done" : ""} ${K.isLate(t) ? "is-late" : ""}" data-task="${t.id}" style="--c:${K.project(t.projectId).color};${style || ""}" title="${e(t.title)}">${t.milestone ? "◆ " : ""}${e(t.title)}</button>`;

  function top(S) {
    const v = S.view;
    return `<header class="pt-top"><span class="pt-brand">Nexora</span>
      <nav class="pt-zoom" aria-label="Échelle de temps"><button type="button" data-go="jour" aria-current="${v === "jour"}">Aujourd'hui</button><button type="button" data-go="planning" aria-current="${v === "planning"}">Semaine</button><button type="button" disabled title="Même principe, colonnes par semaine">Mois</button></nav>
      <span class="pt-where">${v === "projet" ? e(K.project(S.projectId).name) + " · 6 semaines" : v === "corps" ? "Corps · 14 jours" : v === "argent" ? "Argent · " + D.budget.month : v === "planning" ? "Du samedi 3 au dimanche 11 octobre" : "Lundi 5 octobre · 10:40"}</span>
      <span class="pt-search">Chercher <kbd>/</kbd></span></header>`;
  }

  function composeBar(S) {
    return `<form class="pt-compose ${S.composer ? "is-open" : ""}" data-compose aria-label="Ajouter une tâche"><span class="pt-plus" aria-hidden="true">+</span>
      <input id="pt-draft" data-draft ${S.composer ? "data-autofocus" : ""} value="${e(S.composer ? S.draft : "")}" placeholder="Ajouter à la partition : « Relancer BC vendredi 14h #CTEX6 @Vincent »" autocomplete="off" aria-label="Nouvelle tâche">
      <span class="pt-prev" data-preview>${S.composer ? K.previewHtml(S.draft) : ""}</span><button type="submit" class="pt-btn is-primary">Ajouter</button></form>`;
  }

  function jour(S) {
    const L = lanes();
    const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
    const today = K.todayTasks();
    const laneBody = (l) => {
      if (l.kind === "projet") {
        const ts = today.filter((t) => t.projectId === l.id);
        const timed = ts.filter((t) => t.startTime), untimed = ts.filter((t) => !t.startTime);
        return { side: untimed.map((t) => note(t)).join("") || `<span class="pt-empty">—</span>`, track: timed.map((t) => note(t, `left:${pos(hh(t.startTime))};width:calc(${pos(hh(t.endTime || t.startTime) + (t.endTime ? 0 : .5))} - ${pos(hh(t.startTime))})`)).join("") };
      }
      if (l.kind === "corps") {
        const sp = D.sport.planned.find((s) => s.date === D.today);
        return { side: `<span class="pt-fact">Nuit ${String(K.last(D.health.sleep)).replace(".", ",")} h · récup. <b>${K.last(D.health.recovery)} %</b></span>${S.habits[0].items.slice(0, 3).map((h, i) => `<button type="button" class="pt-hab ${h.done ? "is-on" : ""}" data-habit="0:${i}" aria-pressed="${h.done}">${h.done ? "✓" : "○"} ${e(h.name)}</button>`).join("")}`, track: sp ? `<span class="pt-note is-sport" style="left:${pos(hh(sp.time))};width:calc(${pos(hh(sp.time) + sp.minutes / 60)} - ${pos(hh(sp.time))})">${e(sp.title)}</span>` : "" };
      }
      return { side: `<span class="pt-fact">Reste <b>${K.euro(K.budgetPace().left)}</b> · ${D.budget.toCategorize.filter((x) => !S.categorized[x.id]).length} à classer</span><span class="pt-tick">Aujourd'hui : Boulangerie −6,40 €</span>`, track: "" };
    };
    const rows = L.map((l) => { const b = laneBody(l); return `<div class="pt-lane" style="--c:${l.color}">${laneHead(l, S)}<div class="pt-side">${b.side}</div><div class="pt-track">${b.track}</div></div>`; }).join("");
    const late = K.late();
    const mobile = L.map((l) => { const b = laneBody(l); const items = l.kind === "projet" ? today.filter((t) => t.projectId === l.id) : []; return `<section class="pt-ml" style="--c:${l.color}">${laneHead(l, S)}${l.kind === "projet" ? (items.length ? `<ul>${items.map((t) => `<li><time>${t.startTime || "—"}</time>${note(t)}</li>`).join("")}</ul>` : `<p class="pt-empty">Rien aujourd'hui</p>`) : `<div class="pt-mside">${b.side}${l.kind === "corps" ? `<span class="pt-fact">18:30 Footing 45 min</span>` : ""}</div>`}</section>`; }).join("");
    return `<div class="pt-score" data-scroll>
      <div class="pt-grid is-day"><div class="pt-axis"><span class="pt-ax0">Portée</span><span class="pt-ax1">Sans heure</span><div class="pt-hours">${hours.map((h) => `<span style="left:${pos(h)}">${h}h</span>`).join("")}</div></div>
      <div class="pt-lanes">${rows}<div class="pt-now" style="--xf:${((hh(D.now) - H0) / (H1 - H0)).toFixed(4)}"><span>${D.now}</span></div></div></div>
      <div class="pt-mobile">${mobile}</div>
      <section class="pt-late"><h2>À rattraper <span>${late.length}</span></h2><div class="pt-latelist">${late.map((t) => `<button type="button" class="pt-lcard" data-task="${t.id}" style="--c:${K.project(t.projectId).color}"><b>${e(t.title)}</b><small>${e(K.project(t.projectId).name)} · ${K.lateDays(t)} j de retard · ${e(K.first(t.assignee))}</small></button>`).join("")}</div></section>
    </div>`;
  }

  function semaine(S) {
    const start = K.addDays(D.today, -2), N = 9, days = Array.from({ length: N }, (_, i) => K.addDays(start, i));
    const col = (iso) => Math.max(0, Math.min(N, K.days(start, iso)));
    const L = lanes();
    const body = (l) => {
      if (l.kind === "projet") {
        const ts = K.byProject(l.id).filter((t) => !K.isDone(t) && t.statusId !== "s6" && t.end >= start && t.start <= days[N - 1]);
        return ts.map((t, i) => { const a = col(t.start), b = col(t.end) + 1; return note(t, `grid-column:${a + 1}/${b + 1};grid-row:${i + 1}`); }).join("") + K.byProject(l.id).filter((t) => K.isLate(t)).slice(0, 1).map(() => `<span class="pt-lateflag" style="grid-column:1/3;grid-row:${ts.length + 1}">◂ ${K.projectStats(l.id).late} en retard, voir « À rattraper »</span>`).join("");
      }
      if (l.kind === "corps") {
        return days.map((d, i) => { const hi = 13 - K.days(d, D.today); const sl = D.health.sleep[hi], rc = D.health.recovery[hi]; const ses = D.sport.sessions.concat(D.sport.planned).filter((s) => s.date === d); return `<span class="pt-dcell" style="grid-column:${i + 1}">${sl != null && hi <= 13 && d <= D.today ? `<i class="pt-sleep" style="--h:${(sl / 9) * 100}%"></i><small>${String(sl).replace(".", ",")} h · ${rc} %</small>` : ""}${ses.map((s) => `<em class="${s.date >= D.today && !s.km && !s.hr ? "is-plan" : ""}">${e(s.sport)} ${K.hm(s.minutes)}</em>`).join("")}</span>`; }).join("");
      }
      return days.map((d, i) => { const sp = D.budget.transactions.filter((x) => x.date === d && x.amount < 0).reduce((a, x) => a + x.amount, 0); return `<span class="pt-dcell" style="grid-column:${i + 1}">${d <= D.today ? (sp ? `<b class="pt-spend">${K.euro(sp)}</b>` : "<small>—</small>") : `<small class="pt-allow">${K.euro(K.budgetPace().perDay)} possibles</small>`}</span>`; }).join("");
    };
    return `<div class="pt-score" data-scroll><div class="pt-wscroll"><div class="pt-week" style="--n:${N}">
      <div class="pt-whead"><span></span>${days.map((d) => `<span class="${d === D.today ? "is-today" : ""}">${K.dayShort(d)} <b>${Number(d.slice(8))}</b></span>`).join("")}</div>
      ${L.map((l) => `<div class="pt-wlane" style="--c:${l.color}">${laneHead(l, S)}<div class="pt-wtrack" style="--today:${K.days(start, D.today) + 1}">${body(l)}</div></div>`).join("")}
    </div></div><p class="pt-hint">Glisser une tâche d'une colonne à l'autre change son échéance ; d'une portée à l'autre, son projet. Les vues Gantt, Calendrier et Tableur restent accessibles par « Afficher en… » dans chaque portée.</p></div>`;
  }

  function projet(S) {
    const p = K.project(S.projectId), st = K.projectStats(p.id);
    const start = K.addDays(D.today, -21), N = 42, weeks = Array.from({ length: 6 }, (_, i) => K.addDays(start, i * 7));
    const x = (iso) => ((Math.max(0, Math.min(N, K.days(start, iso))) / N) * 100).toFixed(2) + "%";
    const ts = K.byProject(p.id).filter((t) => t.statusId !== "s6").sort((a, b) => (K.isDone(a) - K.isDone(b)) || a.end.localeCompare(b.end));
    return `<div class="pt-score" data-scroll><div class="pt-proj" style="--c:${p.color}">
      <header class="pt-ph"><div><p>${e(D.folders.find((f) => f.id === p.folderId).name)} › portée</p><h1>${e(p.name)}</h1></div><div class="pt-kpi"><span><b>${st.progress} %</b>avancement</span><span><b class="${st.late ? "is-late" : ""}">${st.late}</b>en retard</span><span><b>${st.open}</b>ouvertes</span>${p.budget ? `<span><b>${Math.round((p.spent / p.budget) * 100)} %</b>budget</span>` : ""}</div><button type="button" class="pt-btn is-primary" data-new>+ Tâche</button></header>
      <div class="pt-gantt"><div class="pt-gh"><span>Tâche</span><div>${weeks.map((w) => `<span style="left:${x(w)}">${K.dateShort(w)}</span>`).join("")}</div></div>
      ${ts.map((t) => { const late = K.isLate(t); return `<div class="pt-gr ${K.state.taskId === t.id ? "is-sel" : ""}"><span class="pt-gl"><button type="button" class="pt-ck ${K.isDone(t) ? "is-on" : ""}" data-done="${t.id}" aria-label="Terminer ${e(t.title)}">${K.isDone(t) ? "✓" : ""}</button><button type="button" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button></span><div class="pt-gt">${t.milestone ? `<i class="pt-ms" style="left:${x(t.end)}"></i>` : `<button type="button" data-task="${t.id}" class="pt-bar ${K.isDone(t) ? "is-done" : ""}" style="left:${x(t.start)};width:calc(${x(K.addDays(t.end, 1))} - ${x(t.start)})" aria-label="${e(t.title)}"></button>`}${late ? `<span class="pt-overdue" style="left:${x(K.addDays(t.end, 1))};width:calc(${x(D.today)} - ${x(K.addDays(t.end, 1))})"></span>` : ""}</div></div>`; }).join("")}
      <div class="pt-gnow" style="left:calc(220px + (100% - 220px) * ${(K.days(start, D.today) / N).toFixed(3)})"></div></div>
      <p class="pt-hint">Hachures rouges : retard accumulé depuis l'échéance. Losange : jalon.</p>
    </div></div>`;
  }

  function corps(S) {
    const H = D.health, N = 14, days = Array.from({ length: N }, (_, i) => K.addDays(D.today, i - N + 1));
    const max = (a) => Math.max(...a);
    const lane = (label, sub, color, cells) => `<div class="pt-clane" style="--c:${color}"><span class="pt-lh is-static"><b>${label}</b><small>${sub}</small></span><div class="pt-ccells">${cells}</div></div>`;
    const sw = K.sportWeek();
    return `<div class="pt-score" data-scroll><div class="pt-wscroll"><div class="pt-corps">
      <div class="pt-chead"><span></span><div class="pt-ccells">${days.map((d) => `<span class="${d === D.today ? "is-today" : ""}">${K.dayShort(d).slice(0, 2)}<b>${Number(d.slice(8))}</b></span>`).join("")}</div></div>
      ${lane("Sommeil", "heures", "#5b7bd8", H.sleep.map((v) => `<span class="pt-cbar"><i style="height:${(v / 9) * 100}%"></i><small>${String(v).replace(".", ",")}</small></span>`).join(""))}
      ${lane("Récupération", "%", "#0f9d76", H.recovery.map((v) => `<span class="pt-cdot" style="--k:${v >= 67 ? "#0f9d76" : v >= 34 ? "#d99a2b" : "#dc2626"}">${v}</span>`).join(""))}
      ${lane("HRV · FC repos", "ms · bpm", "#d64545", H.hrv.map((v, i) => `<span class="pt-cnum"><b>${v}</b><small>${H.restingHr[i]}</small></span>`).join(""))}
      ${lane("Sport", `${K.hm(sw.done)} / ${D.sport.goalHours} h`, "#0e7490", days.map((d) => { const s = D.sport.sessions.concat(D.sport.planned).filter((x) => x.date === d); return `<span class="pt-csport">${s.map((x) => `<i class="${d >= D.today ? "is-plan" : ""}" style="height:${Math.min(100, x.minutes)}%" title="${e(x.sport + " " + x.title)}"></i><small>${e(x.sport.slice(0, 5))}</small>`).join("")}</span>`; }).join(""))}
      ${lane("Pas", "milliers", "#7c5cd6", H.steps.map((v) => `<span class="pt-cbar is-steps"><i style="height:${(v / max(H.steps)) * 100}%"></i><small>${(v / 1000).toFixed(1).replace(".", ",")}</small></span>`).join(""))}
      ${lane("Poids", "kg", "#475569", `<span class="pt-cspark">${K.spark(H.weight, { w: 560, h: 40, color: "#475569" })}<b>${String(K.last(H.weight)).replace(".", ",")} kg</b></span>`)}
    </div></div>
    <section class="pt-habrow"><h2>Habitudes du jour</h2>${S.habits.map((g, gi) => g.items.map((h, i) => h.max != null ? `<span class="pt-hab is-num"><button type="button" data-habit="${gi}:${i}:-1" aria-label="Moins">−</button>${e(h.name)} ${h.value}/${h.max}<button type="button" data-habit="${gi}:${i}:1" aria-label="Plus">+</button></span>` : `<button type="button" class="pt-hab ${h.done ? "is-on" : ""}" data-habit="${gi}:${i}" aria-pressed="${h.done}">${h.done ? "✓" : "○"} ${e(h.name)}</button>`).join("")).join("")}</section></div>`;
  }

  function argent(S) {
    const b = D.budget, N = b.daysInMonth, days = Array.from({ length: N }, (_, i) => "2026-10-" + String(i + 1).padStart(2, "0"));
    const spendOn = (cat, d) => b.transactions.filter((x) => x.date === d && (x.cat === cat || (x.cat == null && Object.entries(S.categorized).some(([id, c]) => c === cat && (b.toCategorize.find((y) => y.id === id) || {}).label === x.label)))).reduce((a, x) => a - x.amount, 0);
    const todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    return `<div class="pt-score" data-scroll>
      ${todo.length ? `<section class="pt-classer"><b>À classer</b>${todo.map((x) => `<span>${e(x.label)} · ${K.euro(x.amount, true)} <button type="button" class="pt-btn" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></span>`).join("")}</section>` : ""}
      <div class="pt-wscroll"><div class="pt-money" style="--n:${N}">
      <div class="pt-mhead"><span></span><div>${days.map((d, i) => `<span class="${d === D.today ? "is-today" : ""} ${i + 1 > b.dayOfMonth ? "is-future" : ""}">${i + 1}</span>`).join("")}</div><span>Mois</span></div>
      ${b.categories.map((c) => { const pct = Math.round((c.spent / c.limit) * 100); return `<div class="pt-mlane ${pct > 100 ? "is-over" : ""}" style="--c:${c.color}"><span class="pt-lh is-static"><b>${e(c.name)}</b><small>${pct} % du budget</small></span><div>${days.map((d, i) => { const v = i + 1 <= b.dayOfMonth ? spendOn(c.name, d) : 0; return `<span class="${i + 1 > b.dayOfMonth ? "is-future" : ""}">${v ? `<i style="--s:${Math.min(1, v / 60)}" title="${K.euro(v, true)}"></i>` : ""}</span>`; }).join("")}</div><span class="pt-mtot"><b>${K.euro(c.spent)}</b><small>/ ${K.euro(c.limit)}</small><em><i style="width:${Math.min(100, pct)}%"></i></em></span></div>`; }).join("")}
      </div></div>
      <div class="pt-msum"><div><small>Reste à dépenser</small><b>${K.euro(K.budgetPace().left)}</b><span>${K.euro(K.budgetPace().perDay)} par jour jusqu'au 31</span></div><div><small>Patrimoine</small><b>${K.euro(D.wealth.total)}</b>${K.spark(D.wealth.series, { w: 160, h: 36, color: "#0f766e" })}</div><div><small>Pro</small><b>${K.euro(D.pro.unpaid)}</b><span>à encaisser · ${D.pro.invoices} factures</span></div></div>
    </div>`;
  }

  function panel(S) {
    const t = K.task(S.taskId); if (!t) return "";
    const cl = t.checklist || [], deps = K.deps(t);
    return `<aside class="pt-panel" aria-label="Fiche de la tâche"><button type="button" class="pt-x" data-close aria-label="Fermer">×</button>
      <p class="pt-pk" style="--c:${K.project(t.projectId).color}">${e(K.project(t.projectId).name)}</p><h2>${e(t.title)}</h2>
      ${K.isLate(t) ? `<p class="pt-alert">${K.lateDays(t)} jours de retard${K.blocked(t) ? " · attend « " + e(deps[0].title) + " »" : ""}</p>` : ""}
      <dl>${K.fields(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${cl.length ? `<h3>Sous-tâches ${cl.filter((x) => x.done).length}/${cl.length}</h3><ul class="pt-cl">${cl.map((x) => `<li class="${x.done ? "is-done" : ""}">${x.done ? "✓" : "○"} ${e(x.text)}</li>`).join("")}</ul>` : ""}
      ${t.desc ? `<h3>Description</h3><p>${e(t.desc)}</p>` : ""}
      ${deps.length ? `<h3>Dépend de</h3>${deps.map((d) => `<button type="button" class="pt-link" data-task="${d.id}">${e(d.title)}</button>`).join("")}` : ""}
      <details><summary>Tous les champs</summary><dl>${K.more(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></details>
      <footer><button type="button" class="pt-btn is-primary" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Terminer"}</button><button type="button" class="pt-btn">+1 jour</button><button type="button" class="pt-btn">Lundi prochain</button><button type="button" class="pt-btn is-ghost">Archiver</button></footer></aside>`;
  }

  window.CONCEPTS.partition = {
    id: "partition",
    nom: "Partition",
    idee: "Une seule grille à deux axes : le temps en colonnes (aujourd'hui heure par heure, ou la semaine jour par jour) et les domaines en portées (chaque projet, puis Corps et Argent). On lit sa vie comme une partition ; un clic sur une portée l'agrandit.",
    render(S) {
      const v = S.view;
      const body = v === "projet" ? projet(S) : v === "planning" ? semaine(S) : v === "corps" ? corps(S) : v === "argent" ? argent(S) : jour(S);
      return `<div class="pt-shell ${S.taskId ? "has-panel" : ""}">${top(S)}<div class="pt-body">${body}${panel(S)}</div>${composeBar(S)}</div>`;
    },
    css: `
.k-partition { --ink:#151b26; --dim:#5f6b7c; --line:#e6e9ef; --staff:#d7dce5; --soft:#f6f7f9; --acc:#245edb; font-family:"Instrument Sans",system-ui,sans-serif; font-size:14.5px; color:var(--ink); background:#fff; }
.k-partition button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; padding:0; text-align:left; }
.pt-shell { display:flex; flex-direction:column; height:100%; }
.pt-top { display:flex; align-items:center; gap:18px; padding:12px 20px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
.pt-brand { font-weight:700; letter-spacing:.02em; }
.pt-zoom { display:flex; background:var(--soft); border-radius:9px; padding:3px; }
.pt-zoom button { padding:6px 14px!important; border-radius:7px; font-weight:600; color:var(--dim)!important; }
.pt-zoom button[aria-current="true"] { background:#fff!important; color:var(--ink)!important; box-shadow:0 1px 2px rgba(0,0,0,.08); }
.pt-zoom button:disabled { opacity:.45; cursor:default; }
.pt-where { font-family:"DM Mono",monospace; font-size:13px; color:var(--dim); }
.pt-search { margin-left:auto; color:var(--dim); font-size:13px; } .pt-search kbd { border:1px solid var(--line); border-radius:4px; padding:0 5px; }
.pt-body { flex:1; min-height:0; display:flex; position:relative; }
.pt-score { flex:1; min-width:0; overflow:auto; padding:16px 20px 30px; }
.pt-lh { display:flex!important; flex-direction:column; justify-content:center; padding:8px 12px!important; border-left:4px solid var(--c)!important; min-width:0; }
.pt-lh b { font-weight:700; } .pt-lh small { color:var(--dim); font-size:12.5px; } .pt-lh em { font-style:normal; color:#c42727; font-weight:600; }
.pt-lh:not(.is-static):hover, .pt-lh[aria-current="true"] { background:var(--soft)!important; }
.pt-grid { min-width:900px; }
.pt-axis, .pt-lane { display:grid; grid-template-columns:170px 220px 1fr; }
.pt-axis { font-family:"DM Mono",monospace; font-size:11.5px; color:var(--dim); height:24px; align-items:end; }
.pt-ax0, .pt-ax1 { padding:0 12px 4px; text-transform:uppercase; letter-spacing:.08em; }
.pt-hours { position:relative; height:100%; } .pt-hours span { position:absolute; bottom:4px; transform:translateX(-50%); }
.pt-lanes { position:relative; }
.pt-lane { min-height:62px; border-top:1px solid var(--staff); }
.pt-lane:last-of-type { border-bottom:1px solid var(--staff); }
.pt-side { display:flex; flex-wrap:wrap; align-content:center; gap:5px; padding:8px 10px; border-right:1px dashed var(--staff); background:var(--soft); }
.pt-track { position:relative; background-image:repeating-linear-gradient(90deg,transparent 0 calc(100% / 15 - 1px),#eef0f4 calc(100% / 15 - 1px) calc(100% / 15)); }
.pt-track .pt-note, .pt-track .pt-tick { position:absolute; top:50%; transform:translateY(-50%); }
.pt-track .pt-note { min-width:190px; max-width:260px; z-index:1; }
.pt-note { display:inline-block; max-width:100%; padding:5px 10px!important; border-radius:99px; background:color-mix(in srgb,var(--c) 14%,#fff)!important; border:1.5px solid var(--c)!important; font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:color-mix(in srgb,var(--c) 70%,#000)!important; }
.pt-note:hover { background:color-mix(in srgb,var(--c) 26%,#fff)!important; }
.pt-note.is-late { border-style:dashed!important; }
.pt-note.is-done { opacity:.5; text-decoration:line-through; }
.pt-note.is-sport { --c:#0f9d76; }
.pt-tick { font-family:"DM Mono",monospace; font-size:12px; color:#6d28d9; border-left:2px solid #6d28d9; padding-left:6px; }
.pt-empty { color:#a3adbb; }
.pt-fact { font-size:13px; color:var(--dim); width:100%; } .pt-fact b { color:var(--ink); }
.pt-hab { font-size:12.5px; border:1px solid var(--line)!important; border-radius:99px; padding:3px 9px!important; background:#fff!important; display:inline-flex!important; gap:5px; align-items:center; }
.pt-hab.is-on { background:#e6f6f0!important; border-color:#9fd9c2!important; color:#0b6b4f!important; font-weight:600; }
.pt-hab.is-num button { width:20px; height:20px; border-radius:50%; background:var(--soft)!important; text-align:center!important; }
.pt-now { position:absolute; top:-6px; bottom:0; pointer-events:none; }
.pt-now { left:calc(390px + (100% - 390px) * var(--xf, 0)); }
.pt-now::before { content:""; position:absolute; top:0; bottom:0; left:0; width:2px; background:#c42727; }
.pt-now span { position:absolute; top:-14px; left:-18px; font-family:"DM Mono",monospace; font-size:11px; color:#fff; background:#c42727; border-radius:4px; padding:0 4px; }
.pt-late h2, .pt-habrow h2 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:22px 0 8px; }
.pt-late h2 span { color:#c42727; }
.pt-latelist { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:8px; }
.pt-lcard { display:flex!important; flex-direction:column; gap:3px; border:1px solid var(--line)!important; border-left:4px solid var(--c)!important; border-radius:10px; padding:10px 12px!important; }
.pt-lcard small { color:var(--dim); } .pt-lcard:hover { background:var(--soft)!important; }
.pt-mobile { display:none; }
.pt-wscroll { overflow-x:auto; }
.pt-week { min-width:980px; }
.pt-whead, .pt-wlane { display:grid; grid-template-columns:170px 1fr; }
.pt-whead { grid-template-columns:170px repeat(var(--n),1fr); font-size:13px; color:var(--dim); padding-bottom:6px; }
.pt-whead span { text-transform:capitalize; padding:0 6px; } .pt-whead b { color:var(--ink); font-size:16px; }
.pt-whead .is-today { color:var(--acc); } .pt-whead .is-today b { color:#fff; background:var(--acc); border-radius:6px; padding:0 6px; }
.pt-wlane { border-top:1px solid var(--staff); min-height:58px; } .pt-wlane:last-child { border-bottom:1px solid var(--staff); }
.pt-wtrack { display:grid; grid-template-columns:repeat(var(--n),minmax(0,1fr)); grid-auto-rows:minmax(30px,auto); gap:4px 0; padding:6px 0; position:relative; background:linear-gradient(90deg,transparent calc((var(--today) - 1) / var(--n) * 100%),#f1f6ff calc((var(--today) - 1) / var(--n) * 100%),#f1f6ff calc(var(--today) / var(--n) * 100%),transparent calc(var(--today) / var(--n) * 100%)); }
.pt-wtrack .pt-note { margin:0 3px; border-radius:7px; align-self:center; }
.pt-lateflag { font-size:12px; color:#c42727; font-weight:600; align-self:center; padding-left:4px; white-space:nowrap; }
.pt-dcell { display:flex; flex-direction:column; gap:3px; padding:2px 6px; font-size:12px; color:var(--dim); position:relative; grid-row:1; }
.pt-sleep { display:block; width:60%; height:20px; background:linear-gradient(90deg,#c9d4f5 var(--h),#eef1f6 var(--h)); border-radius:4px; }
.pt-dcell em { font-style:normal; color:#0b6b4f; background:#e6f6f0; border-radius:5px; padding:1px 5px; font-weight:600; }
.pt-dcell em.is-plan { background:#fff; border:1px dashed #0f9d76; }
.pt-spend { color:#6d28d9; font-family:"DM Mono",monospace; font-size:12.5px; } .pt-allow { color:#a3adbb; }
.pt-hint { color:var(--dim); font-size:12.5px; margin-top:14px; max-width:90ch; }
.pt-ph { display:flex; align-items:center; gap:24px; flex-wrap:wrap; margin-bottom:14px; }
.pt-ph p { margin:0; font-size:12.5px; color:var(--dim); text-transform:uppercase; letter-spacing:.08em; }
.pt-ph h1 { margin:2px 0 0; font-size:28px; border-left:6px solid var(--c); padding-left:10px; }
.pt-kpi { display:flex; gap:22px; } .pt-kpi span { display:flex; flex-direction:column; font-size:12.5px; color:var(--dim); } .pt-kpi b { font-size:20px; color:var(--ink); font-variant-numeric:tabular-nums; } .pt-kpi .is-late { color:#c42727; }
.pt-ph .pt-btn { margin-left:auto; }
.pt-gantt { position:relative; border-top:1px solid var(--staff); overflow-x:auto; }
.pt-gh, .pt-gr { display:grid; grid-template-columns:220px 1fr; min-width:760px; }
.pt-gh { font-family:"DM Mono",monospace; font-size:11.5px; color:var(--dim); height:28px; align-items:center; }
.pt-gh > div { position:relative; height:100%; } .pt-gh > div span { position:absolute; top:7px; }
.pt-gr { border-top:1px solid var(--line); min-height:40px; align-items:center; }
.pt-gr.is-sel { background:#f1f6ff; }
.pt-gl { display:flex; gap:8px; align-items:center; padding:0 8px; font-weight:600; min-width:0; }
.pt-gl button:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-ck { width:18px; height:18px; flex:none; border:1.6px solid #9aa6b6!important; border-radius:50%!important; display:grid!important; place-items:center; font-size:11px; color:#fff!important; text-align:center!important; }
.pt-ck.is-on { background:#16a34a!important; border-color:#16a34a!important; }
.pt-gt { position:relative; height:100%; background-image:repeating-linear-gradient(90deg,transparent 0 calc(100% / 6 - 1px),#eef0f4 calc(100% / 6 - 1px) calc(100% / 6)); }
.pt-bar { position:absolute; top:11px; height:18px; border-radius:6px; background:var(--c)!important; opacity:.85; }
.pt-bar.is-done { opacity:.3; }
.pt-overdue { position:absolute; top:15px; height:10px; background:repeating-linear-gradient(135deg,#f5b4b4 0 4px,#fff 4px 7px); border-radius:0 5px 5px 0; }
.pt-ms { position:absolute; top:12px; width:16px; height:16px; background:var(--c); transform:translateX(-8px) rotate(45deg); border-radius:2px; }
.pt-gnow { position:absolute; top:0; bottom:0; width:2px; background:#c42727; pointer-events:none; }
.pt-corps { min-width:900px; }
.pt-chead, .pt-clane { display:grid; grid-template-columns:170px 1fr; }
.pt-ccells { display:grid; grid-template-columns:repeat(14,minmax(0,1fr)); align-items:end; }
.pt-chead .pt-ccells span { font-size:12px; color:var(--dim); text-align:center; display:flex; flex-direction:column; text-transform:capitalize; } .pt-chead b { color:var(--ink); font-size:14px; }
.pt-chead .is-today b { color:var(--acc); }
.pt-clane { border-top:1px solid var(--staff); min-height:64px; } .pt-clane:last-child { border-bottom:1px solid var(--staff); }
.pt-cbar { height:56px; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:2px; }
.pt-cbar i { width:46%; background:var(--c); border-radius:3px 3px 0 0; opacity:.75; } .pt-cbar small { font-size:11px; color:var(--dim); font-family:"DM Mono",monospace; }
.pt-cdot { justify-self:center; align-self:center; width:30px; height:30px; border-radius:50%; background:color-mix(in srgb,var(--k) 18%,#fff); border:2px solid var(--k); display:grid; place-items:center; font-size:11.5px; font-weight:700; font-family:"DM Mono",monospace; }
.pt-cnum { align-self:center; text-align:center; display:flex; flex-direction:column; font-family:"DM Mono",monospace; font-size:12.5px; } .pt-cnum small { color:var(--dim); }
.pt-csport { height:56px; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:2px; }
.pt-csport i { width:56%; background:var(--c); border-radius:3px; } .pt-csport i.is-plan { background:#fff; border:1.5px dashed var(--c); } .pt-csport small { font-size:10.5px; color:var(--dim); }
.pt-cspark { grid-column:1/-1; display:flex; align-items:center; gap:10px; } .pt-cspark svg { flex:1; height:40px; width:100%; }
.pt-habrow { display:flex; flex-wrap:wrap; gap:6px; align-items:center; } .pt-habrow h2 { width:100%; }
.pt-classer { display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; background:#f5f0ff; border-radius:10px; padding:10px 14px; margin-bottom:14px; }
.pt-classer > span { display:flex; gap:8px; align-items:center; font-size:13.5px; }
.pt-money { min-width:980px; }
.pt-mhead, .pt-mlane { display:grid; grid-template-columns:170px 1fr 150px; align-items:center; }
.pt-mhead > div, .pt-mlane > div { display:grid; grid-template-columns:repeat(var(--n),minmax(0,1fr)); height:100%; }
.pt-mhead > div span { font-family:"DM Mono",monospace; font-size:11px; color:var(--dim); text-align:center; } .pt-mhead .is-today { color:#fff; background:var(--acc); border-radius:4px; }
.pt-mhead > span:last-child { font-size:12px; color:var(--dim); padding-left:12px; }
.pt-mlane { border-top:1px solid var(--staff); min-height:46px; } .pt-mlane:last-child { border-bottom:1px solid var(--staff); }
.pt-mlane > div span { display:grid; place-items:center; border-left:1px solid #f1f3f6; } .pt-mlane > div span.is-future { background:#fafbfc; }
.pt-mlane > div i { width:calc(10px + 18px * var(--s)); height:calc(10px + 18px * var(--s)); border-radius:50%; background:var(--c); opacity:.85; }
.pt-mtot { display:grid; grid-template-columns:auto 1fr; gap:0 6px; padding-left:12px; font-variant-numeric:tabular-nums; align-items:baseline; } .pt-mtot small { color:var(--dim); }
.pt-mtot em { grid-column:1/-1; height:5px; background:#eef0f4; border-radius:99px; overflow:hidden; margin-top:3px; } .pt-mtot em i { display:block; height:100%; background:var(--c); }
.pt-mlane.is-over .pt-lh b, .pt-mlane.is-over .pt-mtot b { color:#c42727; } .pt-mlane.is-over .pt-mtot em i { background:#c42727; }
.pt-msum { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:18px; }
.pt-msum > div { border:1px solid var(--line); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:2px; } .pt-msum small { color:var(--dim); font-size:12.5px; } .pt-msum b { font-size:22px; } .pt-msum span { color:var(--dim); font-size:13px; }
.pt-panel { width:400px; flex:none; border-left:1px solid var(--line); padding:18px 20px 30px; overflow:auto; position:relative; background:#fff; animation:pt-in .2s ease-out; }
@keyframes pt-in { from { opacity:0; transform:translateX(16px); } }
.pt-x { position:absolute; right:12px; top:10px; font-size:24px!important; width:34px; height:34px; border-radius:50%; text-align:center!important; color:var(--dim)!important; }
.pt-pk { margin:0; font-size:12.5px; font-weight:700; color:var(--c); text-transform:uppercase; letter-spacing:.08em; }
.pt-panel h2 { margin:4px 0 10px; font-size:21px; line-height:1.25; }
.pt-alert { background:#fdecec; color:#a61b1b; border-radius:8px; padding:7px 10px; font-weight:600; font-size:13.5px; }
.pt-panel dl { margin:0; } .pt-panel dl div { display:grid; grid-template-columns:105px 1fr; gap:8px; padding:7px 0; border-bottom:1px solid var(--line); }
.pt-panel dt { color:var(--dim); } .pt-panel dd { margin:0; display:flex; align-items:center; flex-wrap:wrap; }
.pt-panel h3 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:16px 0 4px; }
.pt-cl { list-style:none; margin:0; padding:0; display:grid; gap:4px; } .pt-cl .is-done { color:var(--dim); text-decoration:line-through; }
.pt-link { color:var(--acc)!important; font-weight:600; }
.pt-panel details { margin-top:14px; } .pt-panel summary { cursor:pointer; color:var(--acc); font-weight:600; }
.pt-panel footer { display:flex; flex-wrap:wrap; gap:6px; margin-top:16px; }
.pt-btn { border:1px solid var(--line)!important; border-radius:8px; padding:7px 12px!important; font-weight:600; background:#fff!important; white-space:nowrap; font-size:13.5px!important; }
.pt-btn.is-primary { background:var(--acc)!important; color:#fff!important; border-color:var(--acc)!important; }
.pt-btn.is-ghost { border-color:transparent!important; color:var(--dim)!important; }
.pt-compose { display:flex; align-items:center; gap:10px; padding:10px 20px calc(10px + env(safe-area-inset-bottom,0px)); border-top:1px solid var(--line); background:#fbfcfd; flex-wrap:wrap; }
.pt-compose.is-open { background:#eef4ff; box-shadow:0 -6px 20px rgba(36,94,219,.12); }
.pt-plus { width:26px; height:26px; border-radius:50%; background:var(--acc); color:#fff; display:grid; place-items:center; font-weight:700; }
.pt-compose input { flex:1; min-width:200px; font:inherit; border:1px solid var(--line); border-radius:9px; padding:9px 12px; background:#fff; }
.pt-compose input:focus { outline:2px solid var(--acc); border-color:transparent; }
.pt-prev { display:flex; flex-wrap:wrap; gap:5px; } .pt-prev:empty { display:none; }
@container app (max-width: 1100px) { .pt-panel { position:absolute; right:0; top:0; bottom:0; z-index:20; box-shadow:-10px 0 30px rgba(0,0,0,.1); } }
@container app (max-width: 700px) {
  .pt-top { padding:10px 14px; gap:10px; } .pt-where, .pt-search { display:none; }
  .pt-score { padding:12px 12px 20px; }
  .pt-grid.is-day { display:none; } .pt-mobile { display:grid; gap:8px; }
  .pt-ml { border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .pt-ml ul { list-style:none; margin:0; padding:4px 10px 10px; display:grid; gap:6px; } .pt-ml li { display:flex; gap:10px; align-items:center; } .pt-ml time { font-family:"DM Mono",monospace; font-size:12px; color:var(--dim); width:40px; flex:none; }
  .pt-ml .pt-empty { margin:0; padding:0 12px 10px; font-size:13px; } .pt-mside { display:flex; flex-wrap:wrap; gap:5px; padding:0 12px 10px; }
  .pt-lh { width:100%; }
  .pt-panel { width:100%; }
  .pt-compose { padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px)); } .pt-compose input { min-width:0; font-size:14px; } .pt-compose .pt-btn { display:none; }
  .pt-msum { grid-template-columns:1fr; }
  .pt-ph h1 { font-size:23px; } .pt-ph .pt-btn { margin-left:0; }
  .pt-gh, .pt-gr { grid-template-columns:150px 1fr; min-width:600px; }
  .pt-gnow { display:none; }
}`,
  };
})();
