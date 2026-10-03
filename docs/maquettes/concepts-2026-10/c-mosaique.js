// Concept 4 — Mosaïque : des tuiles vivantes qui s'agrandissent en espaces.
(function () {
  const K = window.K, D = K.D, e = K.esc;
  const C = { travail: "#245edb", late: "#d63c3c", corps: "#0f9d76", sport: "#0e7490", argent: "#7c3aed", wealth: "#0f766e" };
  const tile = (cls, go, title, body, color, extra = "") => `<section class="mz-tile ${cls}" style="--t:${color}" ${extra}><header>${go ? `<button type="button" class="mz-th" ${go}><span>${title}</span><i aria-hidden="true">↗</i></button>` : `<span class="mz-th"><span>${title}</span></span>`}</header>${body}</section>`;
  const check = (t) => `<li class="mz-item ${K.isDone(t) ? "is-done" : ""}"><button type="button" class="mz-ck" data-done="${t.id}" aria-label="${K.isDone(t) ? "Rouvrir" : "Terminer"} ${e(t.title)}">${K.isDone(t) ? "✓" : ""}</button><button type="button" class="mz-it" data-task="${t.id}"><b>${t.milestone ? "◆ " : ""}${e(t.title)}</b><small><span class="k-dot" style="--c:${K.project(t.projectId).color}"></span>${e(K.project(t.projectId).name)}${t.startTime ? " · " + t.startTime : ""}${K.isLate(t) ? ` · <em>${K.lateDays(t)} j de retard</em>` : ""}</small></button></li>`;

  function crumbs(S) {
    if (S.view === "jour") return `<span class="mz-hello">Bonjour Quentin <small>· lundi 5 octobre, 10:40</small></span>`;
    const names = { projet: "Projets", planning: "Semaine", corps: "Corps", argent: "Argent" };
    return `<nav class="mz-crumbs" aria-label="Fil d'Ariane"><button type="button" data-go="jour">‹ Mosaïque</button><span>/</span>${S.view === "projet" ? `<button type="button" data-go="projet" data-project="${S.projectId}">Projets</button><span>/</span><b>${e(K.project(S.projectId).name)}</b>` : `<b>${names[S.view]}</b>`}</nav>`;
  }

  function home(S) {
    const today = K.todayTasks(), late = K.late(), sw = K.sportWeek(), bp = K.budgetPace(), r = K.last(D.health.recovery);
    const next = today.filter((t) => t.startTime && t.startTime >= D.now).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    const wk = K.week();
    return `<div class="mz-grid is-home">
      ${tile("mz-now", "", "Maintenant", `<div class="mz-next">${next ? `<time>${next.startTime}</time><button type="button" data-task="${next.id}"><b>${e(next.title)}</b><small>${e(K.project(next.projectId).name)} · dans ${Math.round((Number(next.startTime.slice(0, 2)) * 60 + Number(next.startTime.slice(3)) - 640))} min</small></button>` : "<b>Rien d'horodaté</b>"}</div><h3>Aujourd'hui · ${today.length}</h3><ul class="mz-list">${today.map(check).join("")}</ul><button type="button" class="mz-add" data-new>+ Ajouter une tâche</button>`, C.travail)}
      ${tile("mz-late", 'data-go="projet" data-project="p-lot2b"', "En retard", `<b class="mz-huge">${late.length}</b><p>La plus ancienne : <button type="button" class="mz-link" data-task="${late[0].id}">${e(late[0].title)}</button>, ${K.lateDays(late[0])} jours.</p>`, C.late)}
      ${tile("mz-rec", 'data-go="corps"', "Récupération", `<div class="mz-ringwrap">${K.ring(r, { size: 92, stroke: 10, color: C.corps, track: "#e3f2ec" })}<b>${r} %</b></div><p>Sommeil ${String(K.last(D.health.sleep)).replace(".", ",")} h · HRV ${K.last(D.health.hrv)} ms</p>`, C.corps)}
      ${tile("mz-proj", 'data-go="projet" data-project="p-ctex6"', "Projets", `<ul class="mz-plist">${D.projects.map((p) => { const s = K.projectStats(p.id); return `<li><button type="button" data-go="projet" data-project="${p.id}"><span><span class="k-dot" style="--c:${p.color}"></span>${e(p.name)}</span><span class="mz-pbar"><i style="width:${s.progress}%;background:${p.color}"></i></span><small>${s.open} ouvertes${s.late ? ` · <em>${s.late} retard</em>` : ""}</small></button></li>`; }).join("")}</ul>`, C.travail)}
      ${tile("mz-sport", 'data-go="corps"', "Sport", `<b class="mz-big">${K.hm(sw.done)} <small>/ ${D.sport.goalHours} h</small></b><p>Semaine dernière ${K.hm(sw.last)}. Prévu ce soir : footing 45 min à 18:30.</p>${K.bars([42, 0, 35, 0, 0, 42, 70, 45], { w: 180, h: 36, color: C.sport })}`, C.sport)}
      ${tile("mz-money", 'data-go="argent"', "Budget d'octobre", `<b class="mz-big">${K.euro(bp.left)}</b><p>restent, soit ${K.euro(bp.perDay)} par jour. <em>Restaurants dépassé</em> (112 €/100 €).</p><span class="mz-meter"><i style="width:${Math.round((D.budget.spent / D.budget.total) * 100)}%"></i><b style="left:${Math.round((D.budget.dayOfMonth / D.budget.daysInMonth) * 100)}%"></b></span>`, C.argent)}
      ${tile("mz-week", 'data-go="planning"', "Cette semaine", `<ol class="mz-days">${wk.map((d) => { const n = K.open().filter((t) => t.end === d).length; const ms = K.open().find((t) => t.end === d && t.milestone); return `<li class="${d === D.today ? "is-today" : ""}"><span>${K.dayShort(d).slice(0, 3)}</span><b>${Number(d.slice(8))}</b><i>${"•".repeat(Math.min(n, 4))}</i>${ms ? `<em title="${e(ms.title)}">◆</em>` : ""}</li>`; }).join("")}</ol><p>Jalons : Deadline MAJ Octopus (mer.), Visite DREAL (jeu. 9:00).</p>`, C.travail)}
      ${tile("mz-habits", 'data-go="corps"', "Habitudes", `<div class="mz-habs">${S.habits[0].items.slice(0, 3).map((h, i) => `<button type="button" class="${h.done ? "is-on" : ""}" data-habit="0:${i}" aria-pressed="${h.done}">${h.done ? "✓" : "○"} ${e(h.name)}</button>`).join("")}</div>`, C.corps)}
      ${tile("mz-wealth", 'data-go="argent"', "Patrimoine", `<b class="mz-big">${K.euro(D.wealth.total)}</b>${K.spark(D.wealth.series, { w: 180, h: 44, color: C.wealth })}<p>+10,8 % sur 12 mois</p>`, C.wealth)}
    </div>`;
  }

  function projet(S) {
    const p = K.project(S.projectId), st = K.projectStats(p.id), ts = K.byProject(p.id);
    const open = ts.filter((t) => !K.isDone(t) && t.statusId !== "s6").sort((a, b) => a.end.localeCompare(b.end));
    const ms = ts.filter((t) => t.milestone || t.typeId === "tt3");
    return `<div class="mz-split"><nav class="mz-plist2" aria-label="Projets">${D.folders.map((f) => `<h4>${e(f.name)}</h4>${D.projects.filter((x) => x.folderId === f.id).map((x) => { const s = K.projectStats(x.id); return `<button type="button" data-go="projet" data-project="${x.id}" aria-current="${x.id === p.id}" style="--t:${x.color}">${K.ring(s.progress, { size: 30, stroke: 4, color: x.color, track: "#eceff4" })}<span>${e(x.name)}<small>${s.open} ouvertes${s.late ? ` · ${s.late} en retard` : ""}</small></span></button>`; }).join("")}`).join("")}</nav>
      <div class="mz-grid is-project">
        ${tile("mz-phead", "", e(p.name), `<div class="mz-kpis"><span><b>${st.progress} %</b>avancement</span><span><b class="${st.late ? "is-late" : ""}">${st.late}</b>en retard</span><span><b>${st.open}</b>ouvertes</span><span><b>${p.next ? e(p.next) : "—"}</b>prochain jalon</span></div><button type="button" class="mz-add is-solid" data-new>+ Tâche dans ${e(p.name)}</button>`, p.color)}
        ${tile("mz-ptasks", "", `Tâches ouvertes · ${open.length}`, `<ul class="mz-list">${open.map(check).join("")}</ul><p class="mz-foot">Afficher en tableau, Gantt ou tableur : bouton ⋯ de la tuile.</p>`, p.color)}
        ${tile("mz-pmiles", "", "Jalons et réunions", `<ol class="mz-tl">${ms.map((t) => `<li><time>${K.dateShort(t.end)}</time><button type="button" data-task="${t.id}">${t.milestone ? "◆" : "◎"} ${e(t.title)}</button></li>`).join("") || "<li>Aucun</li>"}</ol>`, p.color)}
        ${p.budget ? tile("mz-pbudget", "", "Budget", `<b class="mz-big">${Math.round((p.spent / p.budget) * 100)} %</b><p>${K.euro(p.spent)} engagés sur ${K.euro(p.budget)}</p><span class="mz-meter is-p"><i style="width:${Math.round((p.spent / p.budget) * 100)}%;background:${p.color}"></i></span>`, p.color) : ""}
        ${tile("mz-pteam", "", "Équipe et documents", `<p>${[...new Set(ts.map((t) => t.assignee).filter(Boolean))].map((n) => `<span class="k-av">${K.initials(n)}</span>`).join("")}</p><p>${ts.flatMap((t) => t.attachments || []).map((a) => "📎 " + e(a)).join("<br>") || "Aucun document"}</p>`, p.color)}
      </div></div>`;
  }

  function planning(S) {
    const wk = K.week();
    return `<div class="mz-grid is-week">${wk.map((d) => { const ts = K.open().filter((t) => t.end === d || (t.startTime && t.start <= d && t.end >= d)); const sp = D.sport.planned.filter((s) => s.date === d); return tile(`mz-day ${d === D.today ? "is-today" : ""}`, "", `${K.dayName(d)} ${Number(d.slice(8))}`, `<ul class="mz-dlist">${ts.map((t) => `<li><button type="button" data-task="${t.id}" style="--c:${K.project(t.projectId).color}">${t.startTime ? `<time>${t.startTime}</time>` : ""}${t.milestone ? "◆ " : ""}${e(t.title)}</button></li>`).join("")}${sp.map((s) => `<li class="mz-sp"><time>${s.time}</time>${e(s.title)}</li>`).join("")}</ul>${!ts.length && !sp.length ? `<p class="mz-free">Journée libre</p>` : ""}`, d === D.today ? C.travail : "#94a3b8"); }).join("")}
      ${tile("mz-later", "", "Ensuite", `<ul class="mz-dlist">${K.open().filter((t) => t.end > K.addDays(D.today, 6)).sort((a, b) => a.end.localeCompare(b.end)).map((t) => `<li><button type="button" data-task="${t.id}" style="--c:${K.project(t.projectId).color}"><time>${K.dateShort(t.end)}</time>${e(t.title)}</button></li>`).join("")}</ul>`, "#94a3b8")}</div>`;
  }

  function corps(S) {
    const H = D.health, sw = K.sportWeek();
    const m = (cls, t, val, unit, arr, col, note) => tile(cls, "", t, `<b class="mz-big">${val}<small> ${unit}</small></b>${K.spark(arr, { w: 220, h: 50, color: col })}<p>${note}</p>`, col);
    return `<div class="mz-grid is-body">
      ${tile("mz-rec2", "", "Récupération", `<div class="mz-ringwrap is-xl">${K.ring(K.last(H.recovery), { size: 150, stroke: 14, color: C.corps, track: "#e3f2ec" })}<b>${K.last(H.recovery)} %</b></div><p>Zone verte au-dessus de 67 %. Effort modéré conseillé par vos propres seuils.</p>`, C.corps)}
      ${tile("mz-sleep", "", "Sommeil · 14 nuits", `<b class="mz-big">${String(K.last(H.sleep)).replace(".", ",")}<small> h cette nuit</small></b>${K.bars(H.sleep, { w: 300, h: 70, color: "#5b7bd8" })}<p>Moyenne ${(H.sleep.reduce((a, b) => a + b) / H.sleep.length).toFixed(1).replace(".", ",")} h</p>`, "#5b7bd8")}
      ${m("mz-hrv", "HRV", K.last(H.hrv), "ms", H.hrv, "#0f9d76", "Tendance en hausse sur 14 jours")}
      ${m("mz-hr", "FC repos", K.last(H.restingHr), "bpm", H.restingHr, C.late, "Stable")}
      ${m("mz-weight", "Poids", String(K.last(H.weight)).replace(".", ","), "kg", H.weight, "#475569", "−1,2 kg en 14 jours")}
      ${tile("mz-sport2", "", "Sport cette semaine", `<b class="mz-big">${K.hm(sw.done)}<small> / ${D.sport.goalHours} h</small></b><ul class="mz-ses">${D.sport.planned.slice(0, 1).map((s) => `<li class="is-plan"><b>Ce soir ${s.time}</b> ${e(s.title)}</li>`).join("")}${D.sport.sessions.slice(0, 3).map((s) => `<li><b>${K.dayShort(s.date)}</b> ${e(s.sport)} · ${K.hm(s.minutes)}${s.km ? " · " + String(s.km).replace(".", ",") + " km" : ""}${s.dplus ? " · D+ " + s.dplus : ""}</li>`).join("")}</ul>`, C.sport)}
      ${tile("mz-habits2", "", "Habitudes du jour", S.habits.map((g, gi) => `<h4>${e(g.theme)}</h4><div class="mz-habs">${g.items.map((h, i) => h.max != null ? `<span class="mz-num"><button type="button" data-habit="${gi}:${i}:-1" aria-label="Moins">−</button>${e(h.name)} <b>${h.value}/${h.max}</b><button type="button" data-habit="${gi}:${i}:1" aria-label="Plus">+</button></span>` : `<button type="button" class="${h.done ? "is-on" : ""}" data-habit="${gi}:${i}" aria-pressed="${h.done}">${h.done ? "✓" : "○"} ${e(h.name)}</button>`).join("")}</div>`).join(""), C.corps)}
    </div>`;
  }

  function argent(S) {
    const b = D.budget, bp = K.budgetPace(), todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    return `<div class="mz-grid is-money">
      ${tile("mz-left", "", "Reste à dépenser", `<b class="mz-huge is-money">${K.euro(bp.left)}</b><p>${K.euro(b.spent)} dépensés sur ${K.euro(b.total)}. À ce stade du mois, l'attendu est ${K.euro(bp.expected)} : vous êtes ${bp.ahead > 0 ? "au-dessus de" : "sous"} le rythme de ${K.euro(Math.abs(bp.ahead))}.</p><span class="mz-meter"><i style="width:${Math.round((b.spent / b.total) * 100)}%"></i><b style="left:${Math.round((b.dayOfMonth / b.daysInMonth) * 100)}%"></b></span><small class="mz-cap">Trait : aujourd'hui dans le mois</small>`, C.argent)}
      ${tile("mz-cats", "", "Catégories", `<ul class="mz-cl">${b.categories.map((c) => { const pct = Math.round((c.spent / c.limit) * 100); return `<li class="${pct > 100 ? "is-over" : ""}"><span>${e(c.name)}</span><span class="mz-pbar"><i style="width:${Math.min(100, pct)}%;background:${pct > 100 ? C.late : c.color}"></i></span><b>${K.euro(c.spent)}</b><small>/ ${K.euro(c.limit)}</small></li>`; }).join("")}</ul>`, C.argent)}
      ${tile("mz-todo", "", `À classer · ${todo.length}`, todo.map((x) => `<div class="mz-tx"><span><b>${e(x.label)}</b><small>${K.dateShort(x.date)} · ${K.euro(x.amount, true)}</small></span><button type="button" class="mz-add is-solid" data-cat="${x.id}:${x.suggest}">${e(x.suggest)} ✓</button></div>`).join("") || "<p>Tout est classé.</p>", C.argent)}
      ${tile("mz-ops", "", "Dernières opérations", `<ul class="mz-ops">${b.transactions.slice(0, 6).map((x) => `<li><span>${e(x.label)}<small>${K.dateShort(x.date)}</small></span><b class="${x.amount > 0 ? "is-in" : ""}">${K.euro(x.amount, true)}</b></li>`).join("")}</ul>`, C.argent)}
      ${tile("mz-wealth2", "", "Patrimoine", `<b class="mz-big">${K.euro(D.wealth.total)}</b><div class="mz-stack">${D.wealth.parts.map((x) => `<span style="flex:${x.value};background:${x.color}" title="${e(x.name)}"></span>`).join("")}</div><ul class="mz-legend">${D.wealth.parts.map((x) => `<li><i style="background:${x.color}"></i>${e(x.name)} <b>${K.euro(x.value)}</b></li>`).join("")}</ul>`, C.wealth)}
      ${tile("mz-pro", "", "Pro", `<b class="mz-big">${K.euro(D.pro.unpaid)}</b><p>à encaisser · ${D.pro.invoices} factures, ${D.pro.quotes} devis en cours</p>`, "#475569")}
    </div>`;
  }

  function detail(S) {
    const t = K.task(S.taskId); if (!t) return "";
    const cl = t.checklist || [], deps = K.deps(t), p = K.project(t.projectId);
    return `<div class="mz-scrim" data-close></div><article class="mz-detail" style="--t:${p.color}" aria-label="Tâche ${e(t.title)}">
      <header><span class="mz-chip">${e(p.name)}</span><button type="button" class="mz-x" data-close aria-label="Fermer">×</button></header><h2>${e(t.title)}</h2>
      ${K.isLate(t) || K.blocked(t) ? `<p class="mz-warn">${K.isLate(t) ? K.lateDays(t) + " jours de retard" : ""}${K.blocked(t) ? " · attend « " + e(deps[0].title) + " »" : ""}</p>` : ""}
      <div class="mz-dgrid">${K.fields(t).map(([l, v]) => `<div><small>${l}</small><span>${v}</span></div>`).join("")}</div>
      ${cl.length ? `<h3>Sous-tâches ${cl.filter((x) => x.done).length}/${cl.length}</h3><ul class="mz-cl2">${cl.map((x) => `<li class="${x.done ? "is-done" : ""}">${x.done ? "✓" : "○"} ${e(x.text)}</li>`).join("")}</ul>` : ""}
      ${t.desc ? `<h3>Description</h3><p>${e(t.desc)}</p>` : ""}
      ${deps.length ? `<h3>Dépend de</h3>${deps.map((d) => `<button type="button" class="mz-link" data-task="${d.id}">${e(d.title)}</button>`).join("")}` : ""}
      <details><summary>Autres champs</summary><div class="mz-dgrid">${K.more(t).map(([l, v]) => `<div><small>${l}</small><span>${e(v)}</span></div>`).join("")}</div></details>
      <footer><button type="button" class="mz-add is-solid" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Terminer"}</button><button type="button" class="mz-add">Reporter à demain</button><button type="button" class="mz-add">Dupliquer</button><button type="button" class="mz-add is-ghost">Archiver</button></footer></article>`;
  }

  function composer(S) {
    if (!S.composer) return "";
    const people = D.members.slice(0, 4);
    return `<div class="mz-scrim" data-close></div><form class="mz-detail mz-compose" data-compose aria-label="Nouvelle tâche" style="--t:${C.travail}">
      <header><span class="mz-chip">Nouvelle tâche</span><button type="button" class="mz-x" data-close aria-label="Fermer">×</button></header>
      <input id="mz-draft" data-draft data-autofocus value="${e(S.draft)}" aria-label="Titre et détails" autocomplete="off">
      <p class="mz-prev" data-preview>${K.previewHtml(S.draft)}</p>
      <h3>Projet</h3><div class="mz-pick">${D.projects.map((p) => `<button type="button" data-append="#${p.name.replace(/\s/g, "")}"><span class="k-dot" style="--c:${p.color}"></span>${e(p.name)}</button>`).join("")}</div>
      <h3>Quand</h3><div class="mz-pick">${["aujourd'hui", "demain", "vendredi", "lundi"].map((d) => `<button type="button" data-append="${d}">${d}</button>`).join("")}</div>
      <h3>Qui</h3><div class="mz-pick">${people.map((n) => `<button type="button" data-append="@${n.split(" ")[0]}"><span class="k-av">${K.initials(n)}</span>${e(n.split(" ")[0])}</button>`).join("")}</div>
      <footer><button type="button" class="mz-add is-ghost" data-close>Annuler</button><button type="submit" class="mz-add is-solid">Créer</button></footer></form>`;
  }

  window.CONCEPTS.mosaique = {
    id: "mosaique",
    nom: "Mosaïque",
    idee: "Pas de menu : l'accueil est une mosaïque de tuiles vivantes (maintenant, retards, projets, récupération, sport, budget, semaine, habitudes, patrimoine). Toucher une tuile l'agrandit en espace complet, lui-même en tuiles ; un fil d'Ariane ramène en arrière.",
    render(S) {
      const v = S.view;
      const body = v === "projet" ? projet(S) : v === "planning" ? planning(S) : v === "corps" ? corps(S) : v === "argent" ? argent(S) : home(S);
      return `<div class="mz-shell"><header class="mz-top">${crumbs(S)}<span class="mz-search">Rechercher…</span><button type="button" class="mz-add is-solid" data-new>+ Nouvelle tâche</button></header><main class="mz-stage" data-scroll><div class="mz-zoom is-${v}">${body}</div></main>${detail(S)}${composer(S)}</div>`;
    },
    css: `
.k-mosaique { --ink:#141a26; --dim:#5d6a7d; --bg:#eef1f6; --line:#e3e7ee; font-family:"Onest",system-ui,sans-serif; font-size:14.5px; color:var(--ink); background:var(--bg); }
.k-mosaique button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; padding:0; text-align:left; }
.mz-shell { display:flex; flex-direction:column; height:100%; }
.mz-top { display:flex; align-items:center; gap:16px; padding:14px 22px; flex-wrap:wrap; }
.mz-hello { font-family:"Bricolage Grotesque",system-ui,sans-serif; font-size:24px; font-weight:700; letter-spacing:-.01em; }
.mz-hello small { font-family:"Onest",sans-serif; font-size:14px; font-weight:500; color:var(--dim); }
.mz-crumbs { display:flex; align-items:center; gap:8px; font-family:"Bricolage Grotesque",sans-serif; font-size:20px; }
.mz-crumbs button { color:var(--dim)!important; font-weight:600; } .mz-crumbs button:hover { color:var(--ink)!important; } .mz-crumbs span { color:#b4bdca; } .mz-crumbs b { font-weight:800; }
.mz-search { margin-left:auto; background:#fff; border-radius:99px; padding:8px 16px; color:#8a95a6; min-width:200px; }
.mz-stage { flex:1; overflow:auto; padding:0 22px 28px; }
.mz-zoom { animation:mz-zoom .32s cubic-bezier(.2,.8,.2,1); transform-origin:50% 0; }
@keyframes mz-zoom { from { opacity:0; transform:scale(.965); } }
.mz-grid { display:grid; gap:14px; grid-template-columns:repeat(4,minmax(0,1fr)); grid-auto-flow:dense; }
.mz-tile { background:#fff; border-radius:20px; padding:16px 18px; min-width:0; position:relative; display:flex; flex-direction:column; gap:8px; box-shadow:0 1px 2px rgba(20,30,50,.04); }
.mz-tile header { display:flex; }
.mz-th { display:flex!important; align-items:center; gap:8px; width:100%; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--t)!important; }
.mz-th i { margin-left:auto; font-style:normal; width:26px; height:26px; border-radius:50%; background:color-mix(in srgb,var(--t) 10%,#fff); display:grid; place-items:center; font-size:13px; transition:transform .2s; }
button.mz-th:hover i { transform:scale(1.12); }
.mz-tile p { margin:0; color:var(--dim); line-height:1.45; } .mz-tile p em { color:#c62f2f; font-style:normal; font-weight:600; }
.mz-huge { font-family:"Bricolage Grotesque",sans-serif; font-size:64px; line-height:1; font-weight:800; color:var(--t); }
.mz-huge.is-money { font-size:48px; }
.mz-big { font-family:"Bricolage Grotesque",sans-serif; font-size:30px; font-weight:800; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
.mz-big small { font-family:"Onest",sans-serif; font-size:14px; color:var(--dim); font-weight:500; }
.is-home .mz-now { grid-column:span 2; grid-row:span 2; }
.is-home .mz-proj, .is-home .mz-week, .is-home .mz-habits, .is-home .mz-wealth { grid-column:span 2; }
.mz-next { display:flex; gap:14px; align-items:center; background:color-mix(in srgb,var(--t) 8%,#fff); border-radius:14px; padding:12px 14px; }
.mz-next time { font-family:"Bricolage Grotesque",sans-serif; font-size:30px; font-weight:800; color:var(--t); }
.mz-next button { display:flex!important; flex-direction:column; } .mz-next b { font-size:17px; } .mz-next small { color:var(--dim); }
.mz-tile h3 { font-size:13px; color:var(--dim); margin:6px 0 0; font-weight:600; }
.mz-list { list-style:none; margin:0; padding:0; display:grid; }
.mz-item { display:grid; grid-template-columns:26px 1fr; gap:10px; align-items:center; padding:7px 0; border-bottom:1px solid var(--line); }
.mz-item:last-child { border-bottom:0; }
.mz-ck { width:22px; height:22px; border-radius:7px!important; border:2px solid #c3ccd8!important; display:grid!important; place-items:center; color:#fff!important; font-size:12px; text-align:center!important; }
.mz-item.is-done .mz-ck { background:#16a34a!important; border-color:#16a34a!important; } .mz-item.is-done b { text-decoration:line-through; color:var(--dim); }
.mz-it { display:flex!important; flex-direction:column; min-width:0; } .mz-it small { color:var(--dim); font-size:12.5px; } .mz-it em { color:#c62f2f; font-style:normal; font-weight:600; }
.mz-add { border-radius:99px; padding:8px 14px!important; font-weight:600; color:var(--t,#245edb)!important; background:color-mix(in srgb,var(--t,#245edb) 9%,#fff)!important; white-space:nowrap; align-self:flex-start; }
.mz-add.is-solid { background:#245edb!important; color:#fff!important; } .mz-tile .mz-add.is-solid { background:var(--t)!important; }
.mz-add.is-ghost { background:transparent!important; color:var(--dim)!important; }
.mz-link { color:#245edb!important; font-weight:600; text-decoration:underline; text-underline-offset:2px; }
.mz-ringwrap { position:relative; width:92px; height:92px; } .mz-ringwrap b { position:absolute; inset:0; display:grid; place-items:center; font-family:"Bricolage Grotesque",sans-serif; font-size:22px; font-weight:800; }
.mz-ringwrap.is-xl { width:150px; height:150px; margin:0 auto; } .mz-ringwrap.is-xl b { font-size:34px; }
.mz-plist { list-style:none; margin:0; padding:0; display:grid; gap:4px; }
.mz-plist button { display:grid!important; grid-template-columns:140px 1fr 140px; gap:12px; align-items:center; width:100%; padding:6px 4px!important; border-radius:8px; }
.mz-plist button:hover { background:#f5f7fa!important; } .mz-plist small { color:var(--dim); text-align:right; } .mz-plist em { color:#c62f2f; font-style:normal; }
.mz-pbar { height:7px; background:#eef1f5; border-radius:99px; overflow:hidden; display:block; } .mz-pbar i { display:block; height:100%; border-radius:99px; }
.mz-meter { position:relative; display:block; height:10px; background:#efeafd; border-radius:99px; } .mz-meter i { display:block; height:100%; border-radius:99px; background:var(--t); } .mz-meter b { position:absolute; top:-4px; width:2px; height:18px; background:var(--ink); }
.mz-cap { color:var(--dim); font-size:12px; }
.mz-days { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
.mz-days li { display:flex; flex-direction:column; align-items:center; padding:8px 0; border-radius:12px; background:#f5f7fa; position:relative; }
.mz-days li.is-today { background:#245edb; color:#fff; } .mz-days span { font-size:12px; text-transform:capitalize; opacity:.8; } .mz-days b { font-size:18px; } .mz-days i { font-style:normal; letter-spacing:2px; min-height:14px; color:#245edb; } .mz-days .is-today i { color:#fff; }
.mz-days em { position:absolute; top:4px; right:6px; font-style:normal; color:#d99a2b; font-size:11px; }
.mz-habs { display:flex; flex-wrap:wrap; gap:6px; }
.mz-habs > button, .mz-num { border-radius:99px; padding:6px 12px!important; background:#f3f5f8!important; font-weight:500; display:inline-flex!important; gap:6px; align-items:center; }
.mz-habs > button.is-on { background:#e0f4ec!important; color:#0b6b4f!important; font-weight:600; }
.mz-num button { width:22px; height:22px; border-radius:50%; background:#fff!important; text-align:center!important; }
.k-spark, .k-bars { max-width:100%; height:auto; }
.mz-split { display:grid; grid-template-columns:220px 1fr; gap:14px; align-items:start; }
.mz-plist2 { background:#fff; border-radius:20px; padding:12px; display:flex; flex-direction:column; gap:2px; position:sticky; top:0; }
.mz-plist2 h4 { margin:8px 8px 2px; font-size:12px; text-transform:uppercase; letter-spacing:.07em; color:var(--dim); }
.mz-plist2 button { display:flex!important; gap:10px; align-items:center; padding:7px 8px!important; border-radius:12px; }
.mz-plist2 button span { display:flex; flex-direction:column; font-weight:600; } .mz-plist2 small { font-weight:400; color:var(--dim); font-size:12px; }
.mz-plist2 button[aria-current="true"] { background:color-mix(in srgb,var(--t) 10%,#fff)!important; }
.is-project { grid-template-columns:repeat(3,minmax(0,1fr)); }
.is-project .mz-phead { grid-column:1/-1; flex-direction:row; align-items:center; flex-wrap:wrap; gap:20px; }
.is-project .mz-phead header { width:auto; } .is-project .mz-phead .mz-th { font-family:"Bricolage Grotesque",sans-serif; font-size:30px; text-transform:none; letter-spacing:-.01em; color:var(--ink)!important; border-left:6px solid var(--t); padding-left:12px; }
.is-project .mz-phead .mz-add { margin-left:auto; align-self:center; }
.mz-kpis { display:flex; gap:24px; flex-wrap:wrap; } .mz-kpis span { display:flex; flex-direction:column; color:var(--dim); font-size:12.5px; } .mz-kpis b { font-size:19px; color:var(--ink); } .mz-kpis .is-late { color:#c62f2f; }
.is-project .mz-ptasks { grid-column:span 2; grid-row:span 3; }
.mz-foot { font-size:12.5px; }
.mz-tl { list-style:none; margin:0; padding:0 0 0 12px; border-left:2px solid var(--line); display:grid; gap:10px; }
.mz-tl li { display:flex; flex-direction:column; } .mz-tl time { font-size:12px; color:var(--dim); } .mz-tl button { font-weight:600; }
.is-week { grid-template-columns:repeat(4,minmax(0,1fr)); }
.mz-day.is-today { box-shadow:0 0 0 2px #245edb; } .mz-day .mz-th { text-transform:capitalize; letter-spacing:0; font-size:16px; }
.mz-dlist { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
.mz-dlist button { width:100%; display:flex!important; gap:8px; padding:7px 10px!important; border-radius:10px; background:color-mix(in srgb,var(--c) 10%,#fff)!important; border-left:4px solid var(--c)!important; font-weight:600; font-size:13.5px; }
.mz-dlist time { color:var(--dim); font-weight:500; font-variant-numeric:tabular-nums; }
.mz-sp { padding:7px 10px; border-radius:10px; background:#e5f4f6; color:#0e5b6b; font-weight:600; font-size:13.5px; display:flex; gap:8px; }
.mz-free { font-size:13px; }
.is-body { grid-template-columns:repeat(4,minmax(0,1fr)); }
.is-body .mz-rec2, .is-body .mz-hrv { grid-row:span 2; } .is-body .mz-sleep { grid-column:span 2; } .is-body .mz-sport2, .is-body .mz-habits2 { grid-column:span 2; }
.mz-ses { list-style:none; margin:0; padding:0; display:grid; gap:6px; } .mz-ses li { background:#f3f6f8; border-radius:10px; padding:7px 10px; font-size:13.5px; } .mz-ses .is-plan { background:#e5f4f6; }
.mz-habits2 h4 { margin:2px 0; font-size:12.5px; color:var(--dim); }
.is-money { grid-template-columns:repeat(3,minmax(0,1fr)); } .is-money .mz-cats { grid-row:span 2; }
.mz-cl { list-style:none; margin:0; padding:0; display:grid; gap:9px; }
.mz-cl li { display:grid; grid-template-columns:100px 1fr auto auto; gap:8px; align-items:center; font-variant-numeric:tabular-nums; } .mz-cl small { color:var(--dim); } .mz-cl .is-over span:first-child, .mz-cl .is-over b { color:#c62f2f; }
.mz-tx { display:flex; justify-content:space-between; gap:10px; align-items:center; padding:6px 0; } .mz-tx span { display:flex; flex-direction:column; } .mz-tx small { color:var(--dim); }
.mz-ops { list-style:none; margin:0; padding:0; } .mz-ops li { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line); } .mz-ops li span { display:flex; flex-direction:column; } .mz-ops small { color:var(--dim); font-size:12px; } .mz-ops .is-in { color:#0f7a5c; }
.mz-stack { display:flex; height:14px; border-radius:99px; overflow:hidden; gap:2px; }
.mz-legend { list-style:none; margin:0; padding:0; display:grid; gap:3px; font-size:13px; } .mz-legend i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:6px; } .mz-legend b { float:right; font-variant-numeric:tabular-nums; }
.mz-scrim { position:absolute; inset:0; background:rgba(20,26,38,.3); z-index:25; backdrop-filter:blur(2px); }
.mz-detail { position:absolute; z-index:30; right:18px; top:18px; bottom:18px; width:min(440px,calc(100% - 36px)); background:#fff; border-radius:24px; padding:18px 22px; overflow:auto; box-shadow:0 30px 70px rgba(20,30,50,.25); animation:mz-pop .28s cubic-bezier(.2,.8,.2,1); }
@keyframes mz-pop { from { opacity:0; transform:scale(.94); } }
.mz-detail header { display:flex; align-items:center; }
.mz-chip { background:color-mix(in srgb,var(--t) 12%,#fff); color:color-mix(in srgb,var(--t) 75%,#000); font-weight:700; font-size:12.5px; border-radius:99px; padding:4px 10px; }
.mz-x { margin-left:auto; width:34px; height:34px; border-radius:50%; background:#f3f5f8!important; font-size:22px!important; text-align:center!important; }
.mz-detail h2 { font-family:"Bricolage Grotesque",sans-serif; font-size:26px; margin:10px 0; line-height:1.15; letter-spacing:-.01em; }
.mz-warn { background:#fdeeee; color:#a51d1d; border-radius:12px; padding:8px 12px; font-weight:600; margin:0 0 10px; }
.mz-dgrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.mz-dgrid div { background:#f6f8fa; border-radius:12px; padding:9px 11px; display:flex; flex-direction:column; gap:2px; min-width:0; } .mz-dgrid small { color:var(--dim); font-size:12px; } .mz-dgrid span { display:flex; align-items:center; flex-wrap:wrap; }
.mz-detail h3 { font-size:13px; color:var(--dim); margin:16px 0 6px; }
.mz-cl2 { list-style:none; margin:0; padding:0; display:grid; gap:4px; } .mz-cl2 .is-done { color:var(--dim); text-decoration:line-through; }
.mz-detail details { margin-top:14px; } .mz-detail summary { cursor:pointer; color:#245edb; font-weight:600; margin-bottom:8px; }
.mz-detail footer { display:flex; flex-wrap:wrap; gap:6px; margin-top:18px; }
.mz-compose input { width:100%; font:inherit; font-size:18px; font-weight:600; border:0; background:#f3f5f8; border-radius:14px; padding:14px 16px; margin-top:12px; outline:none; }
.mz-compose input:focus { box-shadow:0 0 0 2px #245edb; }
.mz-prev { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 0; }
.mz-pick { display:flex; flex-wrap:wrap; gap:6px; } .mz-pick button { border-radius:99px; padding:7px 12px!important; background:#f3f5f8!important; font-weight:500; display:inline-flex!important; align-items:center; } .mz-pick button:hover { background:#e7ecf3!important; }
@container app (max-width: 1100px) { .mz-grid, .is-body, .is-week { grid-template-columns:repeat(2,minmax(0,1fr)); } .is-money, .is-project { grid-template-columns:repeat(2,minmax(0,1fr)); } .is-home .mz-now { grid-row:span 1; } }
@container app (max-width: 700px) {
  .mz-top { padding:12px 14px; } .mz-search { display:none; } .mz-top .mz-add { margin-left:auto; }
  .mz-hello { font-size:19px; } .mz-hello small { display:block; }
  .mz-stage { padding:0 12px 24px; }
  .mz-grid, .is-body, .is-money, .is-project, .is-week { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .is-home .mz-now, .is-home .mz-proj, .is-home .mz-week, .is-body .mz-sleep, .is-body .mz-sport2, .is-body .mz-habits2, .is-project .mz-ptasks, .mz-tile.mz-cats, .mz-tile.mz-left, .mz-tile.mz-todo, .mz-tile.mz-ops, .mz-day, .mz-later, .is-body .mz-rec2 { grid-column:1/-1; grid-row:auto; }
  .mz-tile { padding:14px; border-radius:18px; } .mz-huge { font-size:46px; } .mz-big { font-size:24px; }
  .mz-plist button { grid-template-columns:1fr 70px; } .mz-plist small { display:none; }
  .mz-split { grid-template-columns:1fr; } .mz-plist2 { position:static; flex-direction:row; overflow-x:auto; } .mz-plist2 h4 { display:none; } .mz-plist2 button { flex:none; }
  .is-project .mz-phead .mz-add { margin-left:0; }
  .mz-detail { inset:auto 0 0 0; width:100%; max-height:92%; border-radius:24px 24px 0 0; }
  .mz-dgrid { grid-template-columns:1fr; }
}`,
  };
})();
