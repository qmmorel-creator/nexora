// Concept 6 — Sommaire : un seul plan arborescent, dense, pour tout Nexora.
(function () {
  const K = window.K, D = K.D, e = K.esc;
  const VIEWS = [["jour", "Aujourd'hui"], ["projet", "Tous les projets"], ["planning", "Planning"], ["corps", "Corps"], ["argent", "Argent"]];

  function sentence(S) {
    const tok = (t) => `<button type="button" class="sm-tok">${t} ▾</button>`;
    if (S.view === "jour") return `Tâches ${tok("ouvertes")} de ${tok("tous les projets")}, échéance ${tok("jusqu'à aujourd'hui")}, groupées par ${tok("dossier › projet")}`;
    if (S.view === "projet") return `Toutes les tâches de ${tok("tous les projets")}, terminées ${tok("masquées")}, triées par ${tok("échéance")}`;
    if (S.view === "planning") return `Tâches ${tok("ouvertes")} sur ${tok("6 semaines")}, avec ${tok("barres de planning")}`;
    if (S.view === "corps") return `Mesures ${tok("Whoop et balance")} sur ${tok("14 jours")}, séances et habitudes`;
    return `Budget ${tok("octobre 2026")}, opérations ${tok("groupées par catégorie")}`;
  }

  const head = (cols) => `<div class="sm-row sm-head" role="row">${cols.map((c) => `<span role="columnheader">${c}</span>`).join("")}</div>`;
  const taskRow = (t, depth, S) => {
    const open = S.taskId === t.id, p = K.project(t.projectId), s = K.status(t.statusId), cl = t.checklist || [];
    let r = `<div class="sm-row sm-task ${open ? "is-open" : ""} ${K.isDone(t) ? "is-done" : ""}" role="row" style="--d:${depth}">
      <span class="sm-title"><button type="button" class="sm-disc" data-task="${open ? "" : t.id}" ${open ? "data-close" : ""} aria-label="${open ? "Replier" : "Déplier"} ${e(t.title)}" aria-expanded="${open}">${open ? "▾" : "▸"}</button><button type="button" class="sm-ck" data-done="${t.id}" aria-label="${K.isDone(t) ? "Rouvrir" : "Terminer"} ${e(t.title)}">${K.isDone(t) ? "✓" : ""}</button><button type="button" class="sm-name" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button>${cl.length ? `<em>${cl.filter((x) => x.done).length}/${cl.length}</em>` : ""}${K.blocked(t) ? `<em class="is-warn">bloquée</em>` : ""}</span>
      <span><i class="sm-st" style="--c:${s.color}"></i>${e(s.name)}</span>
      <span class="sm-av">${t.assignee ? K.initials(t.assignee) : "—"}</span>
      <span class="sm-due ${K.isLate(t) ? "is-late" : ""}">${K.isLate(t) ? "−" + K.lateDays(t) + " j" : t.end === D.today ? (t.startTime || "auj.") : K.dateShort(t.end)}</span>
      <span class="sm-prog"><i style="width:${K.isDone(t) ? 100 : t.progress || 0}%"></i></span>
      <span class="sm-crit" style="--c:${t.crit ? K.critColor[t.crit] : "transparent"}">${t.crit ? K.critLabel[t.crit] : ""}</span></div>`;
    if (open) r += `<div class="sm-detail" style="--d:${depth}">
      <div class="sm-dgrid">${K.fields(t).concat(K.more(t).slice(0, 3).map(([l, v]) => [l, e(v)])).map(([l, v]) => `<label><small>${l}</small><span>${v}</span></label>`).join("")}</div>
      ${cl.length ? `<div class="sm-sub">${cl.map((x) => `<div class="${x.done ? "is-done" : ""}"><i>${x.done ? "✓" : ""}</i>${e(x.text)}</div>`).join("")}<div class="sm-addsub">+ sous-tâche</div></div>` : ""}
      ${t.desc ? `<p class="sm-desc">${e(t.desc)}</p>` : ""}
      ${K.deps(t).length ? `<p class="sm-desc">Dépend de : ${K.deps(t).map((d) => `<button type="button" class="sm-link" data-task="${d.id}">${e(d.title)}</button>`).join(", ")}</p>` : ""}
      <div class="sm-dact"><button type="button" class="sm-btn is-primary" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Terminer"} <kbd>Espace</kbd></button><button type="button" class="sm-btn">Reporter <kbd>D</kbd></button><button type="button" class="sm-btn">Dupliquer</button><button type="button" class="sm-btn">Archiver <kbd>X</kbd></button><button type="button" class="sm-btn is-ghost">Historique, référence, risques…</button></div></div>`;
    return r;
  };
  const groupRow = (label, meta, depth, color, go) => `<div class="sm-row sm-group" role="row" style="--d:${depth}"><span class="sm-title"><span class="sm-disc" aria-hidden="true">▾</span>${color ? `<i class="sm-sq" style="background:${color}"></i>` : ""}${go ? `<button type="button" class="sm-gname" ${go}>${e(label)}</button>` : `<b>${e(label)}</b>`}<small>${meta}</small></span></div>`;

  function outline(S, filter) {
    let html = "";
    D.folders.forEach((f) => {
      const projs = D.projects.filter((p) => p.folderId === f.id).map((p) => ({ p, ts: K.byProject(p.id).filter(filter) })).filter((x) => x.ts.length);
      if (!projs.length) return;
      html += groupRow(f.name, `${projs.reduce((a, x) => a + x.ts.length, 0)} tâches`, 0, "", "");
      projs.forEach(({ p, ts }) => {
        const st = K.projectStats(p.id);
        html += groupRow(p.name, `${st.progress} % · ${st.late ? st.late + " en retard" : "à jour"}`, 1, p.color, `data-go="projet" data-project="${p.id}"`);
        ts.sort((a, b) => (K.isDone(a) - K.isDone(b)) || a.end.localeCompare(b.end)).forEach((t) => (html += taskRow(t, 2, S)));
        if (S.composer && p.id === (K.parse(S.draft).projectId || S.projectId)) html += `<form class="sm-row sm-newrow" data-compose style="--d:2"><span class="sm-title"><span class="sm-disc">+</span><input id="sm-draft" data-draft data-autofocus value="${e(S.draft)}" aria-label="Nouvelle tâche" autocomplete="off"></span><span class="sm-prev" data-preview>${K.previewHtml(S.draft)}</span><button type="submit" class="sm-btn is-primary">Créer ↵</button></form>`;
      });
    });
    return html;
  }

  const COLS = ["Titre", "Statut", "Resp.", "Échéance", "Avancement", "Criticité"];
  function jour(S) {
    return `<div class="sm-table" role="table" aria-label="Aujourd'hui">${head(COLS)}${outline(S, (t) => !K.isDone(t) && t.statusId !== "s6" && t.end <= D.today && t.start <= D.today)}</div>
      <div class="sm-foot"><span>${K.todayTasks().length} aujourd'hui · ${K.late().length} en retard</span><span>Demain : ${K.open().filter((t) => t.end === K.addDays(D.today, 1)).map((t) => e(t.title)).join(", ") || "rien"}</span></div>`;
  }
  function projet(S) {
    return `<div class="sm-table" role="table" aria-label="Tous les projets">${head(COLS)}${outline(S, (t) => t.statusId !== "s6" && (!K.isDone(t) || t.projectId === S.projectId))}</div>`;
  }
  function planning(S) {
    const start = K.addDays(D.today, -7), N = 42, x = (iso) => (Math.max(0, Math.min(N, K.days(start, iso))) / N) * 100;
    let rows = "";
    D.projects.forEach((p) => {
      const ts = K.byProject(p.id).filter((t) => !K.isDone(t) && t.statusId !== "s6");
      if (!ts.length) return;
      rows += `<div class="sm-row sm-group sm-g2" role="row" style="--d:0"><span class="sm-title"><span class="sm-disc">▾</span><i class="sm-sq" style="background:${p.color}"></i><button type="button" class="sm-gname" data-go="projet" data-project="${p.id}">${e(p.name)}</button></span><span class="sm-gtrack"></span></div>`;
      ts.sort((a, b) => a.start.localeCompare(b.start)).forEach((t) => { const a = x(t.start), b = x(K.addDays(t.end, 1)); rows += `<div class="sm-row sm-g2 ${S.taskId === t.id ? "is-open" : ""}" role="row" style="--d:1"><span class="sm-title"><span class="sm-disc"></span><button type="button" class="sm-name" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button></span><span class="sm-gtrack">${t.milestone ? `<i class="sm-ms" style="left:${x(t.end)}%;background:${p.color}"></i>` : `<button type="button" class="sm-gbar ${K.isLate(t) ? "is-late" : ""}" data-task="${t.id}" style="left:${a}%;width:${Math.max(1.2, b - a)}%;--c:${p.color}" aria-label="${e(t.title)}"></button>`}</span></div>`; });
    });
    const weeks = Array.from({ length: 6 }, (_, i) => K.addDays(start, i * 7));
    return `<div class="sm-table is-gantt" role="table" aria-label="Planning"><div class="sm-row sm-head sm-g2"><span>Titre</span><span class="sm-gtrack">${weeks.map((w) => `<b style="left:${x(w)}%">${K.dateShort(w)}</b>`).join("")}<i class="sm-today" style="left:${x(D.today)}%"></i></span></div>${rows}<i class="sm-todayline" style="--x:${x(D.today) / 100}"></i></div>
      ${detailSide(S)}`;
  }
  function detailSide(S) { const t = K.task(S.taskId); if (!t) return ""; return `<div class="sm-table sm-under">${head(COLS)}${taskRow(t, 0, S)}</div>`; }

  function corps(S) {
    const H = D.health, days = Array.from({ length: 14 }, (_, i) => K.addDays(D.today, i - 13));
    const mrow = (l, arr, u, col, dec = 0, good) => `<div class="sm-row sm-m" role="row" style="--d:1"><span class="sm-title"><span class="sm-disc"></span>${l}</span><span class="sm-cells">${arr.map((v) => `<i class="${good && good(v) ? "is-good" : ""}">${v.toLocaleString("fr-FR", { maximumFractionDigits: dec })}</i>`).join("")}</span><span class="sm-spk">${K.spark(arr, { w: 90, h: 22, color: col, fill: false })}</span><span class="sm-last">${K.last(arr).toLocaleString("fr-FR", { maximumFractionDigits: dec })} ${u}</span></div>`;
    const sw = K.sportWeek();
    return `<div class="sm-table is-metrics" role="table" aria-label="Corps"><div class="sm-row sm-head sm-m"><span>Mesure</span><span class="sm-cells">${days.map((d) => `<i>${K.dayShort(d).slice(0, 2)} ${Number(d.slice(8))}</i>`).join("")}</span><span>Tendance</span><span>Dernier</span></div>
      ${groupRow("Sommeil et récupération", "Whoop", 0, "#5b7bd8", "")}${mrow("Sommeil", H.sleep, "h", "#5b7bd8", 1, (v) => v >= 7.5)}${mrow("Récupération", H.recovery, "%", "#0f9d76", 0, (v) => v >= 67)}${mrow("HRV", H.hrv, "ms", "#0f9d76")}${mrow("FC repos", H.restingHr, "bpm", "#c2410c")}
      ${groupRow("Corps", "balance", 0, "#475569", "")}${mrow("Poids", H.weight, "kg", "#475569", 1)}${mrow("Pas (milliers)", H.steps.map((v) => Math.round(v / 100) / 10), "k", "#7c5cd6", 1, (v) => v >= 10)}
      ${groupRow("Sport", `${K.hm(sw.done)} / ${D.sport.goalHours} h cette semaine`, 0, "#0e7490", "")}${D.sport.planned.slice(0, 1).concat(D.sport.sessions.slice(0, 4)).map((s) => `<div class="sm-row sm-m" role="row" style="--d:1"><span class="sm-title"><span class="sm-disc"></span>${e(s.sport)} · ${e(s.title)}</span><span class="sm-cells is-text">${K.dayName(s.date)} ${Number(s.date.slice(8))}${s.time ? " · " + s.time + " · prévu" : ""} · ${K.hm(s.minutes)}${s.km ? " · " + String(s.km).replace(".", ",") + " km" : ""}${s.dplus ? " · D+ " + s.dplus + " m" : ""}${s.hr ? " · " + s.hr + " bpm" : ""}</span><span></span><span></span></div>`).join("")}
      ${groupRow("Habitudes", "aujourd'hui", 0, "#0f9d76", "")}<div class="sm-row sm-m" style="--d:1"><span class="sm-title" style="grid-column:1/-1"><span class="sm-disc"></span>${S.habits.map((g, gi) => g.items.map((h, i) => h.max != null ? `<span class="sm-hab"><button type="button" data-habit="${gi}:${i}:-1" aria-label="Moins">−</button>${e(h.name)} ${h.value}/${h.max}<button type="button" data-habit="${gi}:${i}:1" aria-label="Plus">+</button></span>` : `<button type="button" class="sm-hab ${h.done ? "is-on" : ""}" data-habit="${gi}:${i}" aria-pressed="${h.done}">${h.done ? "☑" : "☐"} ${e(h.name)}</button>`).join("")).join("")}</span></div>
    </div>`;
  }

  function argent(S) {
    const b = D.budget, bp = K.budgetPace();
    const txOf = (cat) => b.transactions.filter((x) => x.cat === cat || (x.cat == null && Object.entries(S.categorized).some(([id, c]) => c === cat && (b.toCategorize.find((y) => y.id === id) || {}).label === x.label)));
    const todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    return `<div class="sm-table is-money" role="table" aria-label="Argent"><div class="sm-row sm-head sm-a"><span>Catégorie / opération</span><span>Date</span><span>Montant</span><span>Budget</span><span>Consommé</span></div>
      ${todo.length ? groupRow("À classer", `${todo.length} opérations`, 0, "#7c3aed", "") + todo.map((x) => `<div class="sm-row sm-a" style="--d:1"><span class="sm-title"><span class="sm-disc"></span>${e(x.label)} <button type="button" class="sm-btn" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></span><span>${K.dateShort(x.date)}</span><span class="sm-num">${K.euro(x.amount, true)}</span><span></span><span></span></div>`).join("") : ""}
      ${groupRow("Octobre 2026", `reste ${K.euro(bp.left)} · ${K.euro(bp.perDay)}/j`, 0, "#245edb", "")}
      ${b.categories.map((c) => { const pct = Math.round((c.spent / c.limit) * 100); const tx = txOf(c.name); return `<div class="sm-row sm-a sm-cat ${pct > 100 ? "is-over" : ""}" style="--d:1"><span class="sm-title"><span class="sm-disc">${tx.length ? "▾" : ""}</span><i class="sm-sq" style="background:${c.color}"></i><b>${e(c.name)}</b></span><span></span><span class="sm-num">${K.euro(c.spent)}</span><span class="sm-num">${K.euro(c.limit)}</span><span class="sm-prog"><i style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "#b91c1c" : c.color}"></i><small>${pct} %</small></span></div>${tx.map((x) => `<div class="sm-row sm-a" style="--d:2"><span class="sm-title"><span class="sm-disc"></span>${e(x.label)}</span><span>${K.dateShort(x.date)}</span><span class="sm-num">${K.euro(x.amount, true)}</span><span></span><span></span></div>`).join("")}`; }).join("")}
      ${groupRow("Patrimoine", K.euro(D.wealth.total), 0, "#0f766e", "")}${D.wealth.parts.map((x) => `<div class="sm-row sm-a" style="--d:1"><span class="sm-title"><span class="sm-disc"></span><i class="sm-sq" style="background:${x.color}"></i>${e(x.name)}</span><span></span><span class="sm-num">${K.euro(x.value)}</span><span></span><span class="sm-prog"><i style="width:${Math.round((x.value / D.wealth.total) * 100)}%;background:${x.color}"></i><small>${Math.round((x.value / D.wealth.total) * 100)} %</small></span></div>`).join("")}
      ${groupRow("Pro", `${K.euro(D.pro.unpaid)} à encaisser · ${D.pro.invoices} factures · ${D.pro.quotes} devis`, 0, "#475569", "")}
    </div>`;
  }

  window.CONCEPTS.sommaire = {
    id: "sommaire",
    nom: "Sommaire",
    idee: "Pour la densité : tout Nexora dans un seul plan arborescent à colonnes (dossier › projet › tâche, mais aussi corps et argent). Une phrase en tête dit exactement ce qui est filtré ; une ligne se déplie sur place pour la modifier ; tout se pilote aussi au clavier.",
    render(S) {
      const v = S.view;
      const body = v === "projet" ? projet(S) : v === "planning" ? planning(S) : v === "corps" ? corps(S) : v === "argent" ? argent(S) : jour(S);
      return `<div class="sm-shell"><header class="sm-top"><b class="sm-brand">Nexora</b><nav class="sm-views" aria-label="Vues">${VIEWS.map(([id, l]) => `<button type="button" data-go="${id}" ${id === "projet" ? 'data-project="p-ctex6"' : ""} aria-current="${v === id}">${l}</button>`).join("")}<button type="button" class="sm-saved">+ Vue enregistrée</button></nav><button type="button" class="sm-btn is-primary" data-new>+ Nouvelle ligne <kbd>N</kbd></button></header>
        <p class="sm-sentence">${sentence(S)}</p><main class="sm-main" data-scroll>${body}</main>
        <footer class="sm-keys"><span><kbd>↑</kbd><kbd>↓</kbd> se déplacer</span><span><kbd>→</kbd> déplier</span><span><kbd>Espace</kbd> terminer</span><span><kbd>N</kbd> nouvelle ligne</span><span><kbd>/</kbd> chercher</span><span><kbd>?</kbd> tous les raccourcis</span></footer></div>`;
    },
    css: `
.k-sommaire { --ink:#161b22; --dim:#5b6573; --line:#e7eaee; --soft:#f6f7f9; --sel:#eef4ff; --acc:#245edb; font-family:"IBM Plex Sans",system-ui,sans-serif; font-size:14px; color:var(--ink); background:#fff; }
.k-sommaire button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; padding:0; text-align:left; }
.k-sommaire kbd { font-family:"IBM Plex Mono",monospace; font-size:11px; border:1px solid var(--line); border-bottom-width:2px; border-radius:4px; padding:0 4px; background:#fff; color:var(--dim); }
.sm-shell { display:flex; flex-direction:column; height:100%; }
.sm-top { display:flex; align-items:center; gap:16px; padding:10px 18px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
.sm-brand { font-family:"IBM Plex Mono",monospace; font-weight:500; letter-spacing:.04em; }
.sm-views { display:flex; gap:2px; flex-wrap:wrap; }
.sm-views button { padding:6px 11px!important; border-radius:6px; color:var(--dim)!important; font-weight:500; white-space:nowrap; }
.sm-views button[aria-current="true"] { background:var(--ink)!important; color:#fff!important; }
.sm-saved { color:var(--acc)!important; }
.sm-top > .sm-btn { margin-left:auto; }
.sm-sentence { margin:0; padding:9px 18px; background:var(--soft); border-bottom:1px solid var(--line); color:var(--dim); }
.sm-tok { color:var(--ink)!important; font-weight:600; border-bottom:1px dashed #9aa5b4!important; }
.sm-main { flex:1; overflow:auto; padding:0 0 20px; }
.sm-table { min-width:760px; }
.sm-row { display:grid; grid-template-columns:minmax(260px,1fr) 130px 56px 90px 110px 80px; align-items:center; min-height:34px; border-bottom:1px solid var(--line); padding-right:12px; }
.sm-head { position:sticky; top:0; background:#fff; z-index:2; font-size:12px; color:var(--dim); text-transform:uppercase; letter-spacing:.05em; min-height:30px; }
.sm-head span:first-child { padding-left:18px; }
.sm-title { display:flex; align-items:center; gap:7px; padding-left:calc(12px + var(--d,0) * 22px); min-width:0; }
.sm-disc { width:16px; flex:none; color:#8b96a5; font-size:11px; text-align:center!important; }
.sm-group { background:#fbfbfc; }
.sm-group b, .sm-gname { font-weight:600; }
.sm-gname:hover { color:var(--acc)!important; text-decoration:underline; }
.sm-group small { color:var(--dim); margin-left:6px; font-size:12.5px; }
.sm-sq { width:10px; height:10px; border-radius:2px; flex:none; }
.sm-task:hover { background:var(--soft); } .sm-task.is-open { background:var(--sel); }
.sm-ck { width:16px; height:16px; flex:none; border:1.5px solid #98a3b2!important; border-radius:4px; display:grid!important; place-items:center; font-size:10px; color:#fff!important; text-align:center!important; }
.sm-task.is-done .sm-ck { background:#16a34a!important; border-color:#16a34a!important; } .sm-task.is-done .sm-name { text-decoration:line-through; color:var(--dim)!important; }
.sm-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.sm-title em { font-style:normal; font-family:"IBM Plex Mono",monospace; font-size:11.5px; color:var(--dim); border:1px solid var(--line); border-radius:4px; padding:0 4px; flex:none; }
.sm-title em.is-warn { color:#a35c06; border-color:#f3d39b; background:#fdf6e8; }
.sm-st { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c); margin-right:6px; }
.sm-av { font-family:"IBM Plex Mono",monospace; font-size:12px; color:var(--dim); }
.sm-due { font-family:"IBM Plex Mono",monospace; font-size:12.5px; } .sm-due.is-late { color:#c42727; font-weight:500; }
.sm-prog { position:relative; height:6px; background:#edf0f3; border-radius:99px; margin-right:14px; } .sm-prog i { position:absolute; left:0; top:0; bottom:0; background:var(--acc); border-radius:99px; } .sm-prog small { position:absolute; right:-36px; top:-6px; font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--dim); }
.sm-crit { font-size:12.5px; color:var(--c); font-weight:600; }
.sm-detail { padding:10px 18px 14px calc(56px + var(--d,0) * 22px); background:var(--sel); border-bottom:1px solid #d8e3f8; }
.sm-dgrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px 18px; }
.sm-dgrid label { display:flex; flex-direction:column; gap:1px; } .sm-dgrid small { color:var(--dim); font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; } .sm-dgrid span { display:flex; align-items:center; flex-wrap:wrap; }
.sm-sub { margin-top:10px; display:grid; gap:3px; } .sm-sub div { display:flex; gap:8px; align-items:center; } .sm-sub i { width:14px; height:14px; border:1.5px solid #98a3b2; border-radius:3px; font-style:normal; font-size:9px; display:grid; place-items:center; } .sm-sub .is-done { color:var(--dim); text-decoration:line-through; } .sm-sub .is-done i { background:#16a34a; border-color:#16a34a; color:#fff; }
.sm-addsub { color:var(--acc); font-size:13px; }
.sm-desc { margin:8px 0 0; color:#2c3440; }
.sm-link { color:var(--acc)!important; text-decoration:underline; }
.sm-dact { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.sm-btn { border:1px solid var(--line)!important; background:#fff!important; padding:5px 10px!important; border-radius:6px; font-weight:500; white-space:nowrap; display:inline-flex!important; gap:6px; align-items:center; }
.sm-btn.is-primary { background:var(--acc)!important; color:#fff!important; border-color:var(--acc)!important; } .sm-btn.is-primary kbd { background:transparent; color:#dbe6ff; border-color:#6f95ea; }
.sm-btn.is-ghost { border-color:transparent!important; color:var(--acc)!important; }
.sm-newrow { background:#f3f8ff; grid-template-columns:minmax(260px,1fr) auto auto; gap:10px; }
.sm-newrow input { flex:1; font:inherit; border:1px solid var(--acc); border-radius:5px; padding:4px 8px; outline:none; min-width:0; }
.sm-prev { display:flex; flex-wrap:wrap; gap:4px; }
.sm-foot { display:flex; gap:24px; padding:10px 18px; color:var(--dim); font-size:13px; flex-wrap:wrap; }
.sm-keys { display:flex; flex-wrap:wrap; gap:6px 18px; padding:7px 18px; border-top:1px solid var(--line); color:var(--dim); font-size:12.5px; background:var(--soft); }
.sm-keys span { display:inline-flex; gap:4px; align-items:center; }
.is-gantt { position:relative; }
.sm-g2 { grid-template-columns:minmax(240px,300px) 1fr; padding-right:16px; }
.sm-gtrack { position:relative; height:100%; min-height:30px; background-image:repeating-linear-gradient(90deg,transparent 0 calc(100% / 6 - 1px),#eef0f3 calc(100% / 6 - 1px) calc(100% / 6)); }
.sm-head .sm-gtrack b { position:absolute; top:8px; font-weight:500; font-family:"IBM Plex Mono",monospace; font-size:11.5px; text-transform:none; letter-spacing:0; }
.sm-gbar { position:absolute; top:9px; height:14px; border-radius:3px; background:var(--c)!important; opacity:.8; }
.sm-gbar.is-late { background:repeating-linear-gradient(135deg,var(--c) 0 5px,#f3b1b1 5px 8px)!important; }
.sm-ms { position:absolute; top:9px; width:12px; height:12px; transform:translateX(-6px) rotate(45deg); }
.sm-today { position:absolute; top:4px; bottom:0; width:2px; background:#c42727; }
.sm-todayline { position:absolute; top:30px; bottom:0; left:calc(300px + (100% - 316px) * var(--x)); width:2px; background:rgba(196,39,39,.5); pointer-events:none; }
.sm-under { margin-top:12px; border-top:2px solid var(--ink); }
.sm-m { grid-template-columns:minmax(200px,240px) 1fr 100px 90px; }
.sm-cells { display:grid; grid-template-columns:repeat(14,minmax(0,1fr)); font-family:"IBM Plex Mono",monospace; font-size:12px; text-align:center; }
.sm-cells i { font-style:normal; padding:0 2px; } .sm-cells i.is-good { color:#0b7a52; font-weight:600; background:#eaf7f1; border-radius:3px; }
.sm-head .sm-cells i { text-transform:none; letter-spacing:0; font-size:11px; }
.sm-cells.is-text { display:block; text-align:left; font-family:"IBM Plex Sans",sans-serif; color:var(--dim); font-size:13px; }
.sm-last { font-family:"IBM Plex Mono",monospace; font-size:12.5px; text-align:right; }
.sm-hab { display:inline-flex!important; align-items:center; gap:5px; margin-right:12px; } .sm-hab.is-on { color:#0b7a52; font-weight:600; } .sm-hab button { padding:0 5px!important; color:var(--acc)!important; }
.sm-a { grid-template-columns:minmax(280px,1fr) 90px 110px 100px 160px; }
.sm-num { font-family:"IBM Plex Mono",monospace; font-size:12.5px; text-align:right; padding-right:14px; }
.sm-cat.is-over b, .sm-cat.is-over .sm-num:first-of-type { color:#b91c1c; }
.is-money .sm-prog { margin-right:44px; }
@container app (max-width: 700px) {
  .sm-top { padding:8px 12px; gap:8px; } .sm-saved { display:none; } .sm-top > .sm-btn { margin-left:0; } .sm-top > .sm-btn kbd { display:none; }
  .sm-views { overflow-x:auto; flex-wrap:nowrap; width:100%; order:3; }
  .sm-sentence { padding:8px 12px; font-size:13px; }
  .sm-table { min-width:0; }
  .sm-row { grid-template-columns:minmax(0,1fr) 64px; padding-right:10px; }
  .sm-row > span:nth-child(2), .sm-row > span:nth-child(3), .sm-row > span:nth-child(5), .sm-row > span:nth-child(6) { display:none; }
  .sm-head span:nth-child(4) { display:block; }
  .sm-title { padding-left:calc(6px + var(--d,0) * 12px); }
  .sm-dgrid { grid-template-columns:1fr 1fr; } .sm-detail { padding:10px 12px 12px; }
  .is-gantt, .is-metrics, .is-money { min-width:640px; } .sm-main { overflow:auto; }
  .is-gantt .sm-row > span, .is-metrics .sm-row > span, .is-money .sm-row > span { display:block!important; }
  .is-gantt .sm-row, .is-metrics .sm-row, .is-money .sm-row { grid-template-columns:revert-layer; }
  .sm-g2 { grid-template-columns:180px 1fr!important; } .sm-m { grid-template-columns:150px 1fr 80px 70px!important; } .sm-a { grid-template-columns:200px 70px 90px 80px 120px!important; }
  .sm-todayline { left:calc(180px + (100% - 196px) * var(--x)); }
  .sm-keys { display:none; }
  .sm-newrow { grid-template-columns:1fr auto; } .sm-newrow .sm-prev { display:none; }
}`,
  };
})();
