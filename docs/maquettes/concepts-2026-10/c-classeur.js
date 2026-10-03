// Concept 2 — Classeur : dossiers en onglets, projets en intercalaires, tâches en fiches.
(function () {
  const K = window.K, D = K.D, e = K.esc;
  const TABS = [
    { id: "jour", label: "Aujourd'hui", color: "#245edb" },
    { id: "f-chantiers", label: "Chantiers", color: "#c2410c", folder: true },
    { id: "f-com", label: "Communication", color: "#b7791f", folder: true },
    { id: "folder-a-trier", label: "À trier", color: "#64748b", folder: true },
    { id: "planning", label: "Agenda", color: "#0e7490" },
    { id: "corps", label: "Corps", color: "#15803d" },
    { id: "argent", label: "Argent", color: "#6d28d9" },
  ];
  const activeTab = (S) => (S.view === "projet" ? K.project(S.projectId).folderId : S.view);

  const line = (t, showProject = true) => {
    const p = K.project(t.projectId), done = K.isDone(t);
    return `<li class="cl-line ${done ? "is-done" : ""} ${K.state.taskId === t.id ? "is-sel" : ""}">
      <button type="button" class="cl-box" data-done="${t.id}" aria-label="${done ? "Rouvrir" : "Terminer"} ${e(t.title)}">${done ? "✓" : ""}</button>
      <button type="button" class="cl-t" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}${showProject ? ` <span class="cl-pj" style="--c:${p.color}">${e(p.name)}</span>` : ""}</button>
      <span class="cl-who">${t.assignee ? e(K.first(t.assignee)) : ""}</span>
      <span class="cl-due ${K.isLate(t) ? "is-late" : ""}">${K.isLate(t) ? K.lateDays(t) + " j de retard" : t.startTime && t.end === D.today ? t.startTime : K.rel(t.end)}</span></li>`;
  };

  function tabs(S) {
    const a = activeTab(S);
    return `<nav class="cl-tabs" aria-label="Dossiers et espaces">${TABS.map((t) => { const go = t.folder ? `data-go="projet" data-project="${D.projects.find((p) => p.folderId === t.id).id}"` : `data-go="${t.id}"`; const late = t.folder ? D.projects.filter((p) => p.folderId === t.id).reduce((s, p) => s + K.projectStats(p.id).late, 0) : 0; return `<button type="button" class="cl-tab" style="--tc:${t.color}" ${go} aria-current="${a === t.id ? "page" : "false"}">${e(t.label)}${late ? `<em>${late}</em>` : ""}</button>`; }).join("")}
      <button type="button" class="cl-add" data-new>+ Nouvelle fiche</button></nav>`;
  }

  function page(S, inner, color) { return `<div class="cl-desk" style="--pc:${color}"><div class="cl-page" data-scroll>${inner}</div></div>`; }

  function jour(S) {
    const timed = K.todayTasks().filter((t) => t.startTime);
    const agenda = [...timed.map((t) => ({ time: t.startTime, end: t.endTime, label: t.title, id: t.id, color: K.project(t.projectId).color })), ...D.sport.planned.filter((s) => s.date === D.today).map((s) => ({ time: s.time, label: s.title + " · sport", color: "#15803d" }))].sort((a, b) => a.time.localeCompare(b.time));
    const untimed = K.todayTasks().filter((t) => !t.startTime);
    const byFolder = D.folders.map((f) => ({ f, items: [...untimed, ...K.late()].filter((t, i, a) => a.indexOf(t) === i && K.project(t.projectId).folderId === f.id) })).filter((x) => x.items.length);
    return page(S, `
      <header class="cl-ph"><p class="cl-kicker">Lundi 5 octobre 2026 · 10:40</p><h1>Ce qui vous attend aujourd'hui</h1></header>
      <div class="cl-cols">
        <section><h2>Agenda du jour</h2><ol class="cl-agenda">${agenda.map((a) => `<li style="--c:${a.color}"><time>${a.time}${a.end ? "–" + a.end : ""}</time>${a.id ? `<button type="button" data-task="${a.id}">${e(a.label)}</button>` : `<span>${e(a.label)}</span>`}</li>`).join("")}</ol>
          <h2>Pense-bête</h2><ul class="cl-memo"><li><b>${K.last(D.health.recovery)} %</b> de récupération, ${String(K.last(D.health.sleep)).replace(".", ",")} h de sommeil</li><li><b>${K.euro(K.budgetPace().left)}</b> restent pour octobre</li><li><b>${D.budget.toCategorize.length}</b> opérations à classer</li><li>Prochain jalon : <b>Deadline MAJ Octopus</b>, mercredi</li></ul></section>
        <section><h2>À faire, rangé par dossier</h2>${byFolder.map(({ f, items }) => `<h3 class="cl-fh">${e(f.name)}</h3><ul class="cl-lines">${items.map((t) => line(t)).join("")}</ul>`).join("")}</section>
      </div>`, "#245edb");
  }

  function projet(S) {
    const p = K.project(S.projectId), f = D.folders.find((x) => x.id === p.folderId), siblings = D.projects.filter((x) => x.folderId === f.id), st = K.projectStats(p.id), ts = K.byProject(p.id);
    const sec = [["En retard", ts.filter(K.isLate)], ["En cours", ts.filter((t) => t.statusId === "s3" && !K.isLate(t))], ["À venir", ts.filter((t) => ["s1", "s2"].includes(t.statusId) && !K.isLate(t))], ["Pour information", ts.filter((t) => t.statusId === "s6")], ["Terminées", ts.filter(K.isDone)]];
    return `<div class="cl-desk" style="--pc:${p.color}"><nav class="cl-inter" aria-label="Projets du dossier ${e(f.name)}">${siblings.map((x) => `<button type="button" data-go="projet" data-project="${x.id}" style="--c:${x.color}" aria-current="${x.id === p.id}">${e(x.name)}<small>${K.projectStats(x.id).open}</small></button>`).join("")}<button type="button" class="cl-inter-add">+ Projet</button></nav>
      <div class="cl-page" data-scroll>
        <header class="cl-ph cl-pph"><p class="cl-kicker">${e(f.name)} › ${e(p.name)}</p><h1>${e(p.name)}</h1>
          <div class="cl-facts"><span><b>${st.progress} %</b> avancement</span><span><b class="${st.late ? "is-late" : ""}">${st.late}</b> en retard</span><span><b>${st.open}</b> ouvertes</span>${p.budget ? `<span><b>${Math.round((p.spent / p.budget) * 100)} %</b> du budget</span>` : ""}${p.next ? `<span>Prochain jalon <b>${e(p.next)}</b></span>` : ""}</div>
          <div class="cl-ptools"><button type="button" class="cl-btn is-primary" data-new>+ Fiche dans ${e(p.name)}</button><span class="cl-viewas">Afficher en : <b>Liste</b> · Tableau · Gantt · Tableur</span></div></header>
        ${sec.filter((s) => s[1].length).map(([l, a]) => `<h2>${l} <span>${a.length}</span></h2><ul class="cl-lines">${a.map((t) => line(t, false)).join("")}</ul>`).join("")}
        <details class="cl-annex"><summary>Annexes du projet : budget, documents, équipe, journal</summary><p>Budget ${K.euro(p.spent)} sur ${K.euro(p.budget)} · 2 documents · 3 personnes · 2 événements récents.</p></details>
      </div></div>`;
  }

  function planning(S) {
    const first = "2026-10-01", start = K.addDays(first, -3); // grille du lundi 28 sept.
    const cells = Array.from({ length: 35 }, (_, i) => K.addDays(start, i));
    return page(S, `<header class="cl-ph"><p class="cl-kicker">Agenda</p><h1>Octobre 2026</h1><p class="cl-sub">Échéances, jalons, réunions et séances. Les retards restent dans l'onglet de leur dossier.</p></header>
      <div class="cl-month"><div class="cl-dow">${["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cl-grid">${cells.map((d) => { const its = K.open().filter((t) => t.end === d && t.statusId !== "s6"); const sp = D.sport.planned.filter((s) => s.date === d).concat(D.sport.sessions.filter((s) => s.date === d)); return `<div class="cl-cell ${d === D.today ? "is-today" : ""} ${d.slice(5, 7) !== "10" ? "is-out" : ""}"><span class="cl-num">${Number(d.slice(8))}</span>${its.slice(0, 3).map((t) => `<button type="button" data-task="${t.id}" style="--c:${K.project(t.projectId).color}">${t.milestone ? "◆ " : ""}${t.startTime ? t.startTime + " " : ""}${e(t.title)}</button>`).join("")}${its.length > 3 ? `<small>+${its.length - 3}</small>` : ""}${sp.map((s) => `<i class="cl-sp">${e(s.sport)}</i>`).join("")}${d >= "2026-10-17" && d <= "2026-10-31" ? `<i class="cl-hol"></i>` : ""}</div>`; }).join("")}</div>
      <p class="cl-legend"><i class="cl-hol"></i> Congés scolaires (zone A) · <i class="cl-sp">Sport</i> séances faites ou prévues</p></div>`, "#0e7490");
  }

  function corps(S) {
    const H = D.health, n = 7, sl = (a) => a.slice(-n);
    const days7 = Array.from({ length: n }, (_, i) => K.addDays(D.today, i - n + 1));
    const rowH = (l, a, u, dec = 0, good) => `<tr><th>${l}</th>${sl(a).map((v, i) => `<td class="${good && good(v) ? "is-good" : ""}">${v.toLocaleString("fr-FR", { maximumFractionDigits: dec })}</td>`).join("")}<td class="cl-u">${u}</td></tr>`;
    const sw = K.sportWeek();
    return page(S, `<header class="cl-ph"><p class="cl-kicker">Carnet de santé</p><h1>Corps</h1><p class="cl-sub">Sept derniers jours, du plus ancien au plus récent. Données Whoop et balance.</p></header>
      <div class="cl-tablewrap"><table class="cl-table"><thead><tr><th></th>${days7.map((d) => `<th>${K.dayShort(d)}<br><small>${Number(d.slice(8))}</small></th>`).join("")}<th></th></tr></thead><tbody>
      ${rowH("Sommeil", H.sleep, "h", 1, (v) => v >= 7.5)}${rowH("Récupération", H.recovery, "%", 0, (v) => v >= 67)}${rowH("HRV", H.hrv, "ms")}${rowH("FC repos", H.restingHr, "bpm")}${rowH("Poids", H.weight, "kg", 1)}${rowH("Pas", H.steps.map((x) => Math.round(x / 100) / 10), "milliers", 1, (v) => v >= 10)}</tbody></table></div>
      <div class="cl-cols">
        <section><h2>Journal sportif <span>${K.hm(sw.done)} sur ${D.sport.goalHours} h cette semaine</span></h2><ul class="cl-log">${D.sport.planned.slice(0, 1).map((s) => `<li class="is-plan"><time>auj. ${s.time}</time><b>${e(s.title)}</b><span>prévu</span></li>`).join("")}${D.sport.sessions.slice(0, 4).map((s) => `<li><time>${K.dayShort(s.date)} ${Number(s.date.slice(8))}</time><b>${e(s.sport)} — ${e(s.title)}</b><span>${K.hm(s.minutes)}${s.km ? " · " + String(s.km).replace(".", ",") + " km" : ""}${s.dplus ? " · D+ " + s.dplus + " m" : ""} · FC ${s.hr}</span></li>`).join("")}</ul></section>
        <section><h2>Habitudes du jour</h2>${S.habits.map((g, gi) => `<h3 class="cl-fh">${e(g.theme)}${g.single ? " · un seul choix" : ""}</h3><ul class="cl-habits">${g.items.map((h, i) => h.max != null ? `<li><span>${e(h.name)}</span><span class="cl-step"><button type="button" data-habit="${gi}:${i}:-1" aria-label="Moins">−</button><b>${h.value} / ${h.max}</b><button type="button" data-habit="${gi}:${i}:1" aria-label="Plus">+</button></span></li>` : `<li><button type="button" class="cl-box ${h.done ? "is-on" : ""}" data-habit="${gi}:${i}" aria-pressed="${h.done}">${h.done ? "✓" : ""}</button><span>${e(h.name)}</span></li>`).join("")}</ul>`).join("")}</section>
      </div>`, "#15803d");
  }

  function argent(S) {
    const b = D.budget, bp = K.budgetPace(), todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    return page(S, `<header class="cl-ph"><p class="cl-kicker">Livre de comptes</p><h1>${b.month}</h1><p class="cl-sub">${K.euro(b.spent)} dépensés sur ${K.euro(b.total)} au ${b.dayOfMonth} du mois. À ce rythme, attendu : ${K.euro(bp.expected)}.</p></header>
      <div class="cl-cols">
        <section><h2>Budget par catégorie</h2><table class="cl-ledger"><tbody>${b.categories.map((c) => { const pct = Math.round((c.spent / c.limit) * 100); return `<tr class="${pct > 100 ? "is-over" : ""}"><th>${e(c.name)}</th><td class="cl-meter"><i style="width:${Math.min(100, pct)}%;--c:${pct > 100 ? "#b91c1c" : c.color}"></i></td><td>${K.euro(c.spent)}</td><td class="cl-u">/ ${K.euro(c.limit)}</td></tr>`; }).join("")}<tr class="cl-total"><th>Reste à dépenser</th><td></td><td>${K.euro(bp.left)}</td><td class="cl-u">${K.euro(bp.perDay)} / j</td></tr></tbody></table>
          <h2>Patrimoine <span>${K.euro(D.wealth.total)}</span></h2><div class="cl-wealth">${D.wealth.parts.map((x) => `<span style="--c:${x.color};flex:${x.value}" title="${e(x.name)}"></span>`).join("")}</div><ul class="cl-wl">${D.wealth.parts.map((x) => `<li><i style="background:${x.color}"></i>${e(x.name)}<b>${K.euro(x.value)}</b></li>`).join("")}</ul></section>
        <section><h2>À classer <span>${todo.length}</span></h2>${todo.map((x) => `<div class="cl-tocat"><div><b>${e(x.label)}</b><small>${K.dateShort(x.date)} · ${K.euro(x.amount, true)}</small></div><div class="cl-choices"><button type="button" class="cl-btn is-primary" data-cat="${x.id}:${x.suggest}">${e(x.suggest)}</button><button type="button" class="cl-btn">Autre…</button></div></div>`).join("") || `<p class="cl-sub">Tout est classé.</p>`}
          <h2>Opérations</h2><table class="cl-ops"><tbody>${b.transactions.map((x) => `<tr><td>${K.dateShort(x.date)}</td><th>${e(x.label)}</th><td class="${x.amount > 0 ? "is-in" : ""}">${K.euro(x.amount, true)}</td></tr>`).join("")}</tbody></table>
          <p class="cl-sub">Intercalaire « Pro » : ${D.pro.quotes} devis, ${D.pro.invoices} factures, ${K.euro(D.pro.unpaid)} à encaisser.</p></section>
      </div>`, "#6d28d9");
  }

  function card(S) {
    const t = K.task(S.taskId); if (!t) return "";
    const p = K.project(t.projectId), cl = t.checklist || [], deps = K.deps(t);
    return `<div class="cl-scrim" data-close></div><article class="cl-card" style="--c:${p.color}" aria-label="Fiche ${e(t.title)}">
      <header><p>${e(D.folders.find((f) => f.id === p.folderId).name)} › ${e(p.name)}</p><button type="button" class="cl-x" data-close aria-label="Fermer la fiche">×</button><h2>${e(t.title)}</h2>
      <div>${K.isLate(t) ? `<span class="cl-stamp">${K.lateDays(t)} j de retard</span>` : ""}${K.blocked(t) ? `<span class="cl-stamp is-amber">bloquée par une dépendance</span>` : ""}</div></header>
      <dl class="cl-ruled">${K.fields(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${cl.length ? `<h3>Sous-tâches · ${cl.filter((x) => x.done).length} sur ${cl.length}</h3><ul class="cl-sub-l">${cl.map((x) => `<li class="${x.done ? "is-done" : ""}"><i>${x.done ? "✓" : ""}</i>${e(x.text)}</li>`).join("")}</ul>` : ""}
      ${t.desc ? `<h3>Notes</h3><p class="cl-notes">${e(t.desc)}</p>` : ""}
      ${deps.length ? `<h3>Attend</h3>${deps.map((d) => `<button type="button" class="cl-ref" data-task="${d.id}">→ ${e(d.title)}</button>`).join("")}` : ""}
      ${(t.attachments || []).length ? `<h3>Agrafé</h3>${t.attachments.map((a) => `<p class="cl-clip">${e(a)}</p>`).join("")}` : ""}
      <details class="cl-annex"><summary>Verso de la fiche : type, récurrence, référence, risques, historique</summary><dl class="cl-ruled">${K.more(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></details>
      <footer><button type="button" class="cl-btn is-primary" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Terminer"}</button><button type="button" class="cl-btn">Changer d'échéance</button><button type="button" class="cl-btn">Dupliquer</button><button type="button" class="cl-btn is-ghost">Archiver</button></footer>
    </article>`;
  }

  function composer(S) {
    if (!S.composer) return "";
    const p = K.parse(S.draft);
    return `<div class="cl-scrim" data-close></div><form class="cl-card cl-new" data-compose style="--c:#245edb" aria-label="Nouvelle fiche">
      <header><p>Nouvelle fiche</p><button type="button" class="cl-x" data-close aria-label="Fermer">×</button></header>
      <label class="cl-write" for="cl-draft">Écrivez la tâche comme vous la diriez</label>
      <input id="cl-draft" data-draft data-autofocus value="${e(S.draft)}" autocomplete="off">
      <p class="cl-preview" data-preview>${K.previewHtml(S.draft)}</p>
      <dl class="cl-ruled is-form"><div><dt>Rangée dans</dt><dd>${e(K.project(p.projectId || S.projectId).name)} <small class="k-muted">modifiable</small></dd></div><div><dt>Échéance</dt><dd>${K.dateShort(p.end)} ${p.startTime ? "· " + p.startTime : ""}</dd></div><div><dt>Responsable</dt><dd>${e(p.assignee || "Moi")}</dd></div></dl>
      <footer><button type="button" class="cl-btn is-ghost" data-close>Annuler</button><button type="submit" class="cl-btn is-primary">Ranger la fiche</button></footer>
    </form>`;
  }

  window.CONCEPTS.classeur = {
    id: "classeur",
    nom: "Classeur",
    idee: "Un classeur à onglets : chaque dossier est un onglet de couleur, chaque projet un intercalaire, chaque tâche une fiche bristol. Corps, Argent et l'Agenda sont des onglets comme les autres. La hiérarchie se voit au lieu de se deviner.",
    render(S) {
      const v = S.view;
      const body = v === "projet" ? projet(S) : v === "planning" ? planning(S) : v === "corps" ? corps(S) : v === "argent" ? argent(S) : jour(S);
      return `<div class="cl-shell"><div class="cl-top"><span class="cl-brand">Nexora</span><span class="cl-search">Chercher une fiche, un projet, une personne…</span></div>${tabs(S)}${body}${card(S)}${composer(S)}</div>`;
    },
    css: `
.k-classeur { --ink:#1d2430; --dim:#5d6878; --rule:#e3e7ee; --desk:#eef1f5; --paper:#ffffff; --late:#b91c1c; font-family:"Source Sans 3",system-ui,sans-serif; font-size:15.5px; color:var(--ink); background:var(--desk); }
.k-classeur button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; padding:0; text-align:left; }
.cl-shell { display:flex; flex-direction:column; height:100%; }
.cl-top { display:flex; align-items:center; gap:18px; padding:12px 22px 4px; }
.cl-brand { font-family:"Source Serif 4",Georgia,serif; font-weight:700; font-size:19px; letter-spacing:.01em; }
.cl-search { flex:1; max-width:520px; background:#fff; border:1px solid var(--rule); border-radius:8px; padding:7px 12px; color:#8a95a5; font-size:14px; }
.cl-tabs { display:flex; align-items:flex-end; gap:3px; padding:8px 22px 0; overflow-x:auto; flex:none; }
.cl-tab { position:relative; padding:9px 16px 10px!important; border-radius:10px 10px 0 0; background:color-mix(in srgb,var(--tc) 12%,#fff)!important; color:color-mix(in srgb,var(--tc) 80%,#000)!important; font-weight:600; white-space:nowrap; border-top:4px solid var(--tc)!important; transform:translateY(3px); transition:transform .15s; }
.cl-tab:hover { transform:translateY(0); }
.cl-tab[aria-current="page"] { background:var(--paper)!important; transform:none; color:var(--ink)!important; box-shadow:0 -2px 6px rgba(20,30,50,.05); z-index:2; }
.cl-tab em { font-style:normal; font-size:11.5px; background:var(--late); color:#fff; border-radius:99px; padding:0 6px; margin-left:7px; vertical-align:1px; }
.cl-add { margin-left:auto; align-self:center; background:#245edb!important; color:#fff!important; border-radius:8px; padding:7px 14px!important; font-weight:600; white-space:nowrap; margin-bottom:6px; }
.cl-desk { flex:1; min-height:0; display:flex; padding:0 22px 22px; }
.cl-page { flex:1; min-width:0; background:var(--paper); border-radius:0 12px 12px 12px; box-shadow:0 1px 3px rgba(20,30,50,.07); overflow:auto; padding:26px 34px 60px; border-top:3px solid var(--pc); }
.cl-inter { display:flex; flex-direction:column; gap:4px; padding-top:18px; width:150px; flex:none; }
.cl-inter button { padding:9px 12px!important; border-radius:10px 0 0 10px; background:color-mix(in srgb,var(--c) 10%,#fff)!important; border-left:4px solid var(--c)!important; font-weight:600; display:flex!important; justify-content:space-between; margin-right:-1px; color:var(--dim)!important; }
.cl-inter button small { font-weight:500; color:var(--dim); }
.cl-inter button[aria-current="true"] { background:#fff!important; color:var(--ink)!important; box-shadow:-2px 1px 4px rgba(20,30,50,.06); }
.cl-inter .cl-inter-add { background:transparent!important; border-left-color:transparent!important; font-weight:500; }
.cl-inter + .cl-page { border-radius:0 12px 12px 12px; }
.cl-ph { margin-bottom:14px; }
.cl-kicker { margin:0; font-size:13px; text-transform:uppercase; letter-spacing:.09em; color:var(--dim); }
.cl-ph h1 { font-family:"Source Serif 4",Georgia,serif; font-size:32px; font-weight:600; margin:4px 0 6px; letter-spacing:-.01em; text-wrap:balance; }
.cl-sub { color:var(--dim); margin:0; max-width:70ch; }
.cl-facts { display:flex; flex-wrap:wrap; gap:6px 22px; color:var(--dim); margin:8px 0 12px; }
.cl-facts b { color:var(--ink); font-size:17px; font-variant-numeric:tabular-nums; } .cl-facts .is-late { color:var(--late); }
.cl-ptools { display:flex; flex-wrap:wrap; align-items:center; gap:14px; }
.cl-viewas { color:var(--dim); font-size:14px; } .cl-viewas b { color:var(--ink); }
.cl-page h2 { font-family:"Source Serif 4",Georgia,serif; font-size:19px; font-weight:600; margin:22px 0 6px; padding-bottom:4px; border-bottom:2px solid var(--ink); }
.cl-page h2 span { font-family:"Source Sans 3",sans-serif; font-weight:500; font-size:14px; color:var(--dim); margin-left:6px; }
.cl-fh { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:14px 0 2px; }
.cl-cols { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:40px; }
.cl-lines { list-style:none; margin:0; padding:0; }
.cl-line { display:grid; grid-template-columns:26px minmax(0,1fr) auto auto; gap:12px; align-items:center; padding:9px 4px; border-bottom:1px solid var(--rule); }
.cl-line:hover, .cl-line.is-sel { background:#f6f8fb; }
.cl-box { width:19px; height:19px; border:1.6px solid #9aa6b6!important; border-radius:4px; display:grid!important; place-items:center; font-size:12px; color:#fff!important; text-align:center!important; }
.cl-line.is-done .cl-box, .cl-box.is-on { background:#15803d!important; border-color:#15803d!important; }
.cl-line.is-done .cl-t { text-decoration:line-through; color:var(--dim)!important; }
.cl-t { font-weight:600; min-width:0; }
.cl-pj { font-weight:500; font-size:13px; color:color-mix(in srgb,var(--c) 75%,#000); background:color-mix(in srgb,var(--c) 12%,#fff); border-radius:4px; padding:1px 6px; margin-left:4px; white-space:nowrap; }
.cl-who { color:var(--dim); font-size:14px; }
.cl-due { font-size:14px; color:var(--dim); white-space:nowrap; font-variant-numeric:tabular-nums; min-width:92px; text-align:right; }
.cl-due.is-late { color:var(--late); font-weight:600; }
.cl-agenda { list-style:none; margin:0; padding:0; border-left:2px solid var(--rule); }
.cl-agenda li { position:relative; padding:6px 0 12px 18px; display:flex; flex-direction:column; }
.cl-agenda li::before { content:""; position:absolute; left:-7px; top:10px; width:12px; height:12px; border-radius:50%; background:var(--c); border:2px solid #fff; }
.cl-agenda time { font-size:13.5px; color:var(--dim); font-variant-numeric:tabular-nums; }
.cl-agenda button, .cl-agenda span { font-weight:600; }
.cl-memo { margin:0; padding-left:18px; display:grid; gap:6px; color:var(--dim); } .cl-memo b { color:var(--ink); }
.cl-annex { margin-top:22px; color:var(--dim); } .cl-annex summary { cursor:pointer; color:#245edb; font-weight:600; }
.cl-btn { border:1px solid var(--rule)!important; background:#fff!important; padding:8px 14px!important; border-radius:8px; font-weight:600; white-space:nowrap; }
.cl-btn:hover { border-color:#c3ccd8!important; }
.cl-btn.is-primary { background:#1d2430!important; color:#fff!important; border-color:#1d2430!important; }
.cl-btn.is-ghost { border-color:transparent!important; color:var(--dim)!important; }
.cl-month { margin-top:10px; }
.cl-dow, .cl-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); }
.cl-dow span { font-size:13px; color:var(--dim); text-transform:uppercase; letter-spacing:.06em; padding:4px 6px; }
.cl-grid { border-top:1px solid var(--rule); border-left:1px solid var(--rule); }
.cl-cell { min-height:96px; border-right:1px solid var(--rule); border-bottom:1px solid var(--rule); padding:5px 6px; display:flex; flex-direction:column; gap:3px; position:relative; min-width:0; }
.cl-cell.is-out { background:#f8f9fb; color:#a0a9b6; }
.cl-cell.is-today { background:#eff5ff; box-shadow:inset 0 0 0 2px #245edb; }
.cl-num { font-weight:700; font-size:14px; }
.cl-cell button { font-size:12.5px; line-height:1.25; padding:2px 5px!important; border-radius:4px; background:color-mix(in srgb,var(--c) 14%,#fff)!important; border-left:3px solid var(--c)!important; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cl-cell small { font-size:12px; color:var(--dim); }
.cl-sp { font-style:normal; font-size:11.5px; color:#15803d; font-weight:600; }
.cl-sp::before { content:"● "; }
.cl-hol { position:absolute; left:0; right:0; bottom:0; height:4px; background:repeating-linear-gradient(90deg,#94a3b8 0 6px,transparent 6px 10px); display:block; }
.cl-legend { color:var(--dim); font-size:13.5px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.cl-legend .cl-hol { position:static; width:28px; display:inline-block; }
.cl-tablewrap { overflow-x:auto; }
.cl-table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; }
.cl-table th, .cl-table td { padding:8px 10px; border-bottom:1px solid var(--rule); text-align:right; }
.cl-table thead th { font-size:13px; color:var(--dim); font-weight:600; text-transform:capitalize; }
.cl-table tbody th { text-align:left; font-weight:600; }
.cl-table td.is-good { color:#15803d; font-weight:700; }
.cl-u { color:var(--dim); font-size:13px; text-align:left!important; }
.cl-log { list-style:none; margin:0; padding:0; }
.cl-log li { display:grid; grid-template-columns:80px 1fr; gap:0 12px; padding:8px 0; border-bottom:1px solid var(--rule); }
.cl-log time { color:var(--dim); font-size:14px; text-transform:capitalize; } .cl-log span { grid-column:2; color:var(--dim); font-size:14px; }
.cl-log .is-plan b { color:#15803d; }
.cl-habits { list-style:none; margin:0; padding:0; }
.cl-habits li { display:flex; align-items:center; gap:12px; padding:7px 0; border-bottom:1px solid var(--rule); }
.cl-step { margin-left:auto; display:flex; align-items:center; gap:10px; } .cl-step button { width:28px; height:28px; border:1px solid var(--rule)!important; border-radius:50%; text-align:center!important; }
.cl-ledger, .cl-ops { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
.cl-ledger th, .cl-ledger td, .cl-ops th, .cl-ops td { padding:8px 6px; border-bottom:1px solid var(--rule); text-align:right; }
.cl-ledger th, .cl-ops th { text-align:left; font-weight:600; }
.cl-meter { width:42%; } .cl-meter i { display:block; height:7px; border-radius:99px; background:var(--c); }
.cl-ledger .is-over th, .cl-ledger .is-over td { color:var(--late); }
.cl-total th, .cl-total td { border-top:2px solid var(--ink); border-bottom:0; font-weight:700; }
.cl-ops td:first-child { color:var(--dim); text-align:left; width:70px; } .cl-ops .is-in { color:#15803d; }
.cl-wealth { display:flex; height:14px; border-radius:99px; overflow:hidden; gap:2px; margin:8px 0; } .cl-wealth span { background:var(--c); }
.cl-wl { list-style:none; padding:0; margin:0; display:grid; grid-template-columns:1fr 1fr; gap:4px 18px; font-size:14px; }
.cl-wl li { display:flex; align-items:center; gap:6px; } .cl-wl i { width:9px; height:9px; border-radius:2px; } .cl-wl b { margin-left:auto; font-variant-numeric:tabular-nums; }
.cl-tocat { display:flex; justify-content:space-between; gap:10px; align-items:center; padding:10px 0; border-bottom:1px solid var(--rule); flex-wrap:wrap; }
.cl-tocat div:first-child { display:flex; flex-direction:column; } .cl-tocat small { color:var(--dim); }
.cl-choices { display:flex; gap:6px; }
.cl-scrim { position:absolute; inset:0; background:rgba(25,32,44,.32); z-index:25; }
.cl-card { position:absolute; z-index:30; top:50%; left:50%; transform:translate(-50%,-50%); width:min(560px,calc(100% - 32px)); max-height:calc(100% - 40px); overflow:auto; background:#fff; border-radius:6px; box-shadow:0 30px 70px rgba(15,20,30,.3); padding:0 26px 22px; border-top:10px solid var(--c); animation:cl-card .22s ease-out; background-image:repeating-linear-gradient(#fff 0 31px,#e8eef7 31px 32px); background-position:0 120px; }
@keyframes cl-card { from { opacity:0; transform:translate(-50%,-46%); } }
.cl-card header { position:relative; padding-top:14px; background:#fff; }
.cl-card header p { margin:0; font-size:13px; color:var(--dim); text-transform:uppercase; letter-spacing:.08em; }
.cl-card h2 { font-family:"Source Serif 4",Georgia,serif; font-size:25px; font-weight:600; margin:4px 0 8px; line-height:1.2; }
.cl-x { position:absolute; right:-10px; top:6px; width:36px; height:36px; font-size:24px!important; border-radius:50%; text-align:center!important; color:var(--dim)!important; }
.cl-stamp { display:inline-block; border:2px solid var(--late); color:var(--late); font-weight:700; text-transform:uppercase; font-size:12px; letter-spacing:.06em; padding:2px 8px; border-radius:4px; transform:rotate(-2deg); margin:0 8px 8px 0; }
.cl-stamp.is-amber { border-color:#b45309; color:#b45309; }
.cl-ruled { margin:6px 0 0; } .cl-ruled div { display:grid; grid-template-columns:120px 1fr; gap:10px; min-height:32px; align-items:center; }
.cl-ruled dt { color:var(--dim); font-size:14px; } .cl-ruled dd { margin:0; display:flex; align-items:center; flex-wrap:wrap; gap:4px; }
.cl-card h3 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:14px 0 2px; line-height:32px; }
.cl-sub-l { list-style:none; margin:0; padding:0; } .cl-sub-l li { line-height:32px; display:flex; align-items:center; gap:10px; }
.cl-sub-l i { width:16px; height:16px; border:1.6px solid #9aa6b6; border-radius:3px; font-style:normal; font-size:10px; display:grid; place-items:center; }
.cl-sub-l .is-done { color:var(--dim); text-decoration:line-through; } .cl-sub-l .is-done i { background:#15803d; border-color:#15803d; color:#fff; }
.cl-notes { margin:0; line-height:32px; }
.cl-ref { color:#245edb!important; font-weight:600; line-height:32px; }
.cl-clip { margin:0; line-height:32px; } .cl-clip::before { content:"📎 "; }
.cl-card footer { display:flex; gap:8px; flex-wrap:wrap; margin-top:18px; background:#fff; padding-top:10px; }
.cl-write { display:block; font-size:14px; color:var(--dim); margin:10px 0 4px; background:#fff; }
.cl-new input { width:100%; font:inherit; font-family:"Source Serif 4",Georgia,serif; font-size:21px; border:0; border-bottom:2px solid #245edb; padding:6px 0; outline:none; background:transparent; }
.cl-preview { display:flex; flex-wrap:wrap; gap:6px; min-height:30px; background:#fff; padding:6px 0; margin:0; }
@container app (max-width: 980px) { .cl-cols { grid-template-columns:1fr; gap:6px; } .cl-page { padding:20px 20px 60px; } }
@container app (max-width: 700px) {
  .cl-top { padding:10px 14px 2px; } .cl-search { font-size:13px; }
  .cl-tabs { padding:6px 10px 0; } .cl-tab { padding:8px 12px 9px!important; font-size:14.5px; }
  .cl-add { position:absolute; right:16px; bottom:16px; z-index:20; border-radius:99px!important; padding:12px 18px!important; box-shadow:0 8px 20px rgba(36,94,219,.35); margin:0; }
  .cl-desk { padding:0; flex-direction:column; }
  .cl-inter { flex-direction:row; width:auto; padding:8px 10px 0; overflow-x:auto; background:#fff; }
  .cl-inter button { border-radius:8px; border-left:0!important; border-bottom:3px solid var(--c)!important; margin:0; white-space:nowrap; gap:8px; }
  .cl-page { border-radius:0; padding:16px 16px 90px; }
  .cl-ph h1 { font-size:25px; }
  .cl-line { grid-template-columns:26px minmax(0,1fr) auto; } .cl-who { display:none; } .cl-due { min-width:0; font-size:13px; }
  .cl-cell { min-height:62px; padding:3px; } .cl-cell button { font-size:0; padding:0!important; height:6px; border-left:0!important; background:var(--c)!important; } .cl-sp { font-size:0; } .cl-sp::before { font-size:10px; }
  .cl-card { top:auto; bottom:0; left:0; transform:none; width:100%; max-height:92%; border-radius:16px 16px 0 0; animation:none; }
}`,
  };
})();
