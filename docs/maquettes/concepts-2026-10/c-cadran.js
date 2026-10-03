// Concept 1 — Cadran : la journée est un cadran de 24 h.
(function () {
  const K = window.K, D = K.D, e = K.esc;
  const ACC = "#245edb";
  const nav = [["jour", "Aujourd'hui", "◷"], ["projet", "Projets", "▤"], ["planning", "Semaine", "▦"], ["corps", "Corps", "♥"], ["argent", "Argent", "€"]];
  const h2a = (h) => (h / 24) * 360 - 90;
  const pt = (cx, cy, r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  function arc(cx, cy, r, h0, h1) {
    let a0 = h2a(h0), a1 = h2a(h1); if (a1 < a0) a1 += 360;
    const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  const hh = (t) => { const [a, b] = t.split(":").map(Number); return a + b / 60; };

  function dayItems(iso) {
    const items = [];
    K.tasks().filter((t) => t.startTime && t.start <= iso && t.end >= iso && !K.isDone(t)).forEach((t) => items.push({ kind: K.type(t.typeId).name === "Réunion" ? "meet" : "task", h0: hh(t.startTime), h1: t.endTime ? hh(t.endTime) : hh(t.startTime) + 0.5, label: t.title, id: t.id, color: K.project(t.projectId).color }));
    D.sport.planned.filter((s) => s.date === iso).forEach((s) => items.push({ kind: "sport", h0: hh(s.time), h1: hh(s.time) + s.minutes / 60, label: s.title, color: "#0f9d76" }));
    return items.sort((a, b) => a.h0 - b.h0);
  }

  function dial(iso, size = 360, big = true) {
    const c = size / 2, R = size * 0.39, W = size * 0.06;
    const items = dayItems(iso);
    let s = `<svg class="cd-dial" viewBox="0 0 ${size} ${size}" role="img" aria-label="Cadran de la journée">`;
    s += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="#eef1f6" stroke-width="${W}"/>`;
    s += `<path d="${arc(c, c, R, 23.2, 6.7)}" stroke="#c9d4f5" stroke-width="${W}" fill="none"/>`;
    for (let h = 0; h < 24; h++) {
      const a = h2a(h), [x0, y0] = pt(c, c, R + W / 2 + 3, a), [x1, y1] = pt(c, c, R + W / 2 + (h % 6 ? 6 : 11), a);
      s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#b5c0cf" stroke-width="${h % 6 ? 1 : 1.6}"/>`;
      if (big && h % 3 === 0) { const [tx, ty] = pt(c, c, R + W / 2 + 22, a); s += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" class="cd-hr">${h}h</text>`; }
    }
    items.forEach((it) => { s += `<path d="${arc(c, c, R, it.h0, Math.max(it.h1, it.h0 + 0.35))}" stroke="${it.color}" stroke-width="${W}" fill="none" stroke-linecap="butt" ${it.id ? `data-task="${it.id}" class="cd-arc"` : ""}><title>${e(it.label)}</title></path>`; });
    if (iso === D.today) {
      const n = hh(D.now), a = h2a(n);
      if (big) s += `<path d="${arc(c, c, R - W / 2 - 7, 6.7, n)}" stroke="${ACC}" stroke-width="2" fill="none" opacity=".35"/>`;
      const [x, y] = pt(c, c, R + W / 2 + 2, a), [x2, y2] = pt(c, c, R - W / 2 - 2, a);
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#18202c" stroke-width="3" stroke-linecap="round"/>`;
    }
    return s + "</svg>";
  }

  const row = (t, opts = {}) => {
    const p = K.project(t.projectId), late = K.isLate(t), done = K.isDone(t);
    return `<li class="cd-row ${done ? "is-done" : ""} ${K.state.taskId === t.id ? "is-sel" : ""}">
      <button type="button" class="cd-check" data-done="${t.id}" aria-label="${done ? "Rouvrir" : "Terminer"} ${e(t.title)}">${done ? "✓" : ""}</button>
      <button type="button" class="cd-title" data-task="${t.id}"><span>${t.milestone ? "◆ " : ""}${e(t.title)}</span>
      <small><span class="k-dot" style="--c:${p.color}"></span>${e(p.name)}${t.assignee && t.assignee !== "Quentin Morel" ? " · " + e(K.first(t.assignee)) : ""}</small></button>
      <span class="cd-when ${late ? "is-late" : ""}">${t.startTime && t.end === D.today ? t.startTime : late ? "−" + K.lateDays(t) + " j" : opts.date ? K.rel(t.end) : ""}</span></li>`;
  };

  function railHtml(S) {
    return `<nav class="cd-rail" aria-label="Navigation principale">
      <div class="cd-logo"><span></span>Nexora</div>
      <button type="button" class="cd-new" data-new>+ Nouvelle tâche</button>
      ${nav.map(([id, l, i]) => `<button type="button" class="cd-nav" data-go="${id}" aria-current="${S.view === id ? "page" : "false"}"><i aria-hidden="true">${i}</i>${l}${id === "projet" ? `<em>${K.late().length}</em>` : ""}</button>`).join("")}
      <div class="cd-rail-foot">Rechercher <kbd>/</kbd><br>Réglages · Guide</div>
    </nav>`;
  }

  function vitals() {
    const r = K.last(D.health.recovery), sw = K.sportWeek(), bp = K.budgetPace();
    return `<div class="cd-vitals">
      <button type="button" class="cd-vital" data-go="corps">${K.ring(r, { size: 46, stroke: 6, color: r > 66 ? "#0f9d76" : "#d97706", label: "Récupération " + r + " %" })}<span><b>${r} %</b>Récupération<small>sommeil ${String(K.last(D.health.sleep)).replace(".", ",")} h</small></span></button>
      <button type="button" class="cd-vital" data-go="corps">${K.ring((sw.done / sw.goal) * 100, { size: 46, stroke: 6, color: "#0f9d76", label: "Sport" })}<span><b>${K.hm(sw.done)} / ${D.sport.goalHours} h</b>Sport cette semaine<small>footing prévu 18:30</small></span></button>
      <button type="button" class="cd-vital" data-go="argent">${K.ring((D.budget.spent / D.budget.total) * 100, { size: 46, stroke: 6, color: bp.ahead > 0 ? "#d97706" : ACC, label: "Budget" })}<span><b>${K.euro(bp.left)}</b>Reste ce mois<small>${K.euro(bp.perDay)} / jour possible</small></span></button>
    </div>`;
  }

  function jour(S) {
    const today = K.todayTasks(), late = K.late(), soon = K.upcoming(3);
    const next = dayItems(D.today).find((i) => i.h0 >= 10.66);
    return `<section class="cd-main" data-scroll>
      <header class="cd-head"><div><h1>${K.dateLong(D.today)}</h1><p>${D.now} · ${today.length} tâches aujourd'hui · ${late.length} en retard</p></div></header>
      <div class="cd-today">
        <div class="cd-dialbox">${dial(D.today)}<div class="cd-center"><small>Ensuite</small><b>${next ? e(next.label) : "Rien de prévu"}</b><span>${next ? Math.floor(next.h0) + ":" + String(Math.round((next.h0 % 1) * 60)).padStart(2, "0") : ""}</span></div>
          <ul class="cd-legend"><li><i style="background:#c9d4f5"></i>Sommeil (heure de coucher à importer)</li><li><i style="background:#7c5cd6"></i>Réunions</li><li><i style="background:#d64545"></i>Tâches à heure fixe</li><li><i style="background:#0f9d76"></i>Sport</li></ul></div>
        <div class="cd-lists">
          <h2>Aujourd'hui</h2><ul class="cd-list">${today.map((t) => row(t)).join("")}</ul>
          <details class="cd-fold" open><summary>En retard <span>${late.length}</span></summary><ul class="cd-list">${late.map((t) => row(t)).join("")}</ul></details>
          <details class="cd-fold"><summary>Trois prochains jours <span>${soon.length}</span></summary><ul class="cd-list">${soon.map((t) => row(t, { date: true })).join("")}</ul></details>
        </div>
      </div>
      ${vitals()}
    </section>`;
  }

  function projet(S) {
    const p = K.project(S.projectId), st = K.projectStats(p.id), ts = K.byProject(p.id);
    const groups = [["En retard", ts.filter(K.isLate)], ["À venir", ts.filter((t) => !K.isLate(t) && !K.isDone(t) && t.statusId !== "s6")], ["Terminées", ts.filter(K.isDone)]];
    return `<section class="cd-projects" aria-label="Projets">
      <h2>Projets</h2>
      ${D.folders.map((f) => `<div class="cd-folder"><h3>${e(f.name)}</h3>${D.projects.filter((x) => x.folderId === f.id).map((x) => { const s = K.projectStats(x.id); return `<button type="button" class="cd-proj" data-go="projet" data-project="${x.id}" aria-current="${x.id === p.id}">${K.ring(s.progress, { size: 28, stroke: 4, color: x.color })}<span>${e(x.name)}<small>${s.open} ouvertes${s.late ? ` · <b>${s.late} en retard</b>` : ""}</small></span></button>`; }).join("")}</div>`).join("")}
    </section>
    <section class="cd-main cd-pmain" data-scroll>
      <header class="cd-phead"><div class="cd-pring">${K.ring(st.progress, { size: 64, stroke: 7, color: p.color })}<b>${st.progress}%</b></div><div><p class="cd-crumb">${e(D.folders.find((f) => f.id === p.folderId).name)} ›</p><h1>${e(p.name)}</h1><p>${st.open} ouvertes · ${st.late} en retard${p.next ? " · prochain jalon : " + e(p.next) : ""}</p></div>
      <button type="button" class="cd-btn" data-new>+ Tâche dans ${e(p.name)}</button></header>
      ${p.budget ? `<div class="cd-pbudget"><span>Budget ${K.euro(p.spent)} / ${K.euro(p.budget)}</span><div class="cd-bar"><i style="width:${Math.round((p.spent / p.budget) * 100)}%;background:${p.color}"></i></div></div>` : ""}
      ${groups.filter((g) => g[1].length).map(([l, arr]) => `<h2 class="cd-gh">${l} <span>${arr.length}</span></h2><ul class="cd-list">${arr.map((t) => row(t, { date: true })).join("")}</ul>`).join("")}
      <p class="cd-hint">Vues avancées du projet : Gantt, Tableur, Heat map, Pixel Tasks → menu « Afficher en… » en haut à droite.</p>
    </section>`;
  }

  function planning(S) {
    const wk = K.week();
    return `<section class="cd-main" data-scroll>
      <header class="cd-head"><div><h1>Semaine du 5 au 11 octobre</h1><p>Chaque cadran montre une journée. Touchez une tâche pour l'ouvrir.</p></div></header>
      <div class="cd-week">${wk.map((d) => { const ts = K.open().filter((t) => t.end === d || (t.start <= d && t.end >= d && t.startTime)); return `<article class="cd-day ${d === D.today ? "is-today" : ""}"><h3>${K.dayShort(d)} <span>${K.dateShort(d)}</span></h3>${dial(d, 150, false)}<ul>${ts.slice(0, 4).map((t) => `<li><button type="button" data-task="${t.id}"><span class="k-dot" style="--c:${K.project(t.projectId).color}"></span>${t.milestone ? "◆ " : ""}${e(t.title)}</button></li>`).join("") || "<li class='k-muted'>Libre</li>"}${D.sport.planned.filter((s) => s.date === d).map((s) => `<li class="cd-sport">${s.time} ${e(s.title)}</li>`).join("")}</ul></article>`; }).join("")}</div>
      <h2 class="cd-gh">Jalons des 30 prochains jours</h2>
      <div class="cd-miles">${K.open().filter((t) => t.milestone).map((t) => `<button type="button" data-task="${t.id}" style="--x:${(K.days(D.today, t.end) / 30) * 100}%"><i style="background:${K.project(t.projectId).color}"></i>${e(t.title)}<small>${K.dateShort(t.end)}</small></button>`).join("")}<span class="cd-axis"><b>auj.</b><b>+10 j</b><b>+20 j</b><b>+30 j</b></span></div>
    </section>`;
  }

  function corps(S) {
    const H = D.health, sw = K.sportWeek();
    const metric = (l, arr, u, col, dec = 0) => `<div class="cd-metric"><span>${l}</span><b>${K.last(arr).toLocaleString("fr-FR", { maximumFractionDigits: dec })}<small> ${u}</small></b>${K.spark(arr, { w: 150, h: 34, color: col })}<small>14 jours</small></div>`;
    return `<section class="cd-main" data-scroll>
      <header class="cd-head"><div><h1>Corps</h1><p>Nuit de 23:10 à 06:40 · récupération ${K.last(H.recovery)} %</p></div></header>
      <div class="cd-body">
        <div class="cd-dialbox cd-small">${dial(D.today, 260, false)}<div class="cd-center"><small>Récupération</small><b class="cd-big">${K.last(H.recovery)} %</b><span>Prêt pour un footing modéré</span></div></div>
        <div class="cd-metrics">${metric("Sommeil", H.sleep, "h", "#5b7bd8", 1)}${metric("HRV", H.hrv, "ms", "#0f9d76")}${metric("FC repos", H.restingHr, "bpm", "#d64545")}${metric("Poids", H.weight, "kg", "#7c5cd6", 1)}</div>
      </div>
      <div class="cd-split">
        <div><h2 class="cd-gh">Sport <span>${K.hm(sw.done)} / ${D.sport.goalHours} h cette semaine · semaine dernière ${K.hm(sw.last)}</span></h2>
        <ul class="cd-sessions">${D.sport.planned.slice(0, 1).map((s) => `<li class="is-plan"><b>Aujourd'hui ${s.time}</b>${e(s.title)}<small>prévu</small></li>`).join("")}${D.sport.sessions.slice(0, 4).map((s) => `<li><b>${K.dayShort(s.date)} ${K.dateShort(s.date)}</b>${e(s.sport)} · ${e(s.title)}<small>${K.hm(s.minutes)}${s.km ? " · " + String(s.km).replace(".", ",") + " km" : ""}${s.dplus ? " · D+ " + s.dplus + " m" : ""} · ${s.hr} bpm</small></li>`).join("")}</ul></div>
        <div><h2 class="cd-gh">Habitudes du jour</h2>${habits(S)}</div>
      </div>
    </section>`;
  }
  function habits(S) {
    return S.habits.map((g, gi) => `<div class="cd-habits"><h4>${e(g.theme)}</h4>${g.items.map((h, i) => h.max != null ? `<span class="cd-hab is-num"><button type="button" data-habit="${gi}:${i}:-1" aria-label="Moins">−</button>${e(h.name)} <b>${h.value}/${h.max}</b><button type="button" data-habit="${gi}:${i}:1" aria-label="Plus">+</button></span>` : `<button type="button" class="cd-hab ${h.done ? "is-on" : ""}" data-habit="${gi}:${i}" aria-pressed="${h.done}">${h.done ? "✓ " : ""}${e(h.name)}</button>`).join("")}</div>`).join("");
  }

  function argent(S) {
    const b = D.budget, bp = K.budgetPace(), size = 240, c = size / 2;
    const ringPath = (r, frac, col, w) => `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#eef1f6" stroke-width="${w}"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * r * frac).toFixed(1)} 999" transform="rotate(-90 ${c} ${c})"/>`;
    const todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    return `<section class="cd-main" data-scroll>
      <header class="cd-head"><div><h1>Argent · ${b.month}</h1><p>Anneau extérieur : le mois écoulé. Anneau intérieur : le budget dépensé.</p></div></header>
      <div class="cd-body">
        <div class="cd-dialbox cd-small"><svg viewBox="0 0 ${size} ${size}" class="cd-dial" role="img" aria-label="Rythme du budget">${ringPath(100, b.dayOfMonth / b.daysInMonth, "#b5c0cf", 10)}${ringPath(80, b.spent / b.total, ACC, 16)}</svg><div class="cd-center"><small>Reste à dépenser</small><b class="cd-big">${K.euro(bp.left)}</b><span>${K.euro(bp.perDay)} par jour jusqu'au 31</span></div></div>
        <div class="cd-cats">${b.categories.map((x) => { const pct = Math.round((x.spent / x.limit) * 100); return `<div class="cd-cat ${pct > 100 ? "is-over" : ""}"><span>${e(x.name)}</span><div class="cd-bar"><i style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "#dc2626" : x.color}"></i></div><b>${K.euro(x.spent)}<small> / ${K.euro(x.limit)}</small></b></div>`; }).join("")}</div>
      </div>
      <div class="cd-split">
        <div><h2 class="cd-gh">À catégoriser <span>${todo.length}</span></h2>${todo.map((x) => `<div class="cd-tx"><span><b>${e(x.label)}</b><small>${K.dateShort(x.date)}</small></span><b>${K.euro(x.amount, true)}</b><button type="button" class="cd-btn" data-cat="${x.id}:${x.suggest}">${e(x.suggest)} ✓</button></div>`).join("") || "<p class='k-muted'>Tout est classé.</p>"}
        <h2 class="cd-gh">Dernières opérations</h2>${b.transactions.slice(0, 5).map((x) => `<div class="cd-tx"><span><b>${e(x.label)}</b><small>${K.dateShort(x.date)} · ${e(S.categorized[(b.toCategorize.find((y) => y.label === x.label) || {}).id] || x.cat || "à classer")}</small></span><b class="${x.amount > 0 ? "is-in" : ""}">${K.euro(x.amount, true)}</b></div>`).join("")}</div>
        <div><h2 class="cd-gh">Patrimoine <span>${K.euro(D.wealth.total)}</span></h2>${K.spark(D.wealth.series, { w: 320, h: 70, color: "#0f766e" })}<div class="cd-wealth">${D.wealth.parts.map((x) => `<span><i style="background:${x.color}"></i>${e(x.name)} <b>${K.euro(x.value)}</b></span>`).join("")}</div>
        <p class="cd-hint">Pro : ${D.pro.quotes} devis en cours, ${D.pro.invoices} factures, ${K.euro(D.pro.unpaid)} à encaisser → Argent › Pro.</p></div>
      </div>
    </section>`;
  }

  function detail(S) {
    const t = K.task(S.taskId); if (!t) return "";
    const deps = K.deps(t), cl = t.checklist || [];
    return `<aside class="cd-sheet" aria-label="Fiche de la tâche">
      <header><button type="button" class="cd-x" data-close aria-label="Fermer">×</button><p class="cd-crumb">${e(K.project(t.projectId).name)} › tâche</p><h2>${e(t.title)}</h2>
      ${K.isLate(t) ? `<span class="cd-flag">${K.lateDays(t)} j de retard</span>` : ""}${K.blocked(t) ? `<span class="cd-flag is-amber">Attend « ${e(deps[0].title)} »</span>` : ""}</header>
      <dl class="cd-fields">${K.fields(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${cl.length ? `<h3>Sous-tâches ${cl.filter((x) => x.done).length}/${cl.length}</h3><ul class="cd-cl">${cl.map((x) => `<li class="${x.done ? "is-done" : ""}"><i>${x.done ? "✓" : ""}</i>${e(x.text)}</li>`).join("")}</ul>` : ""}
      ${t.desc ? `<h3>Description</h3><p>${e(t.desc)}</p>` : ""}
      ${deps.length ? `<h3>Dépend de</h3>${deps.map((d) => `<button type="button" class="cd-link" data-task="${d.id}">${e(d.title)} · ${K.isDone(d) ? "terminée" : "ouverte"}</button>`).join("")}` : ""}
      ${(t.attachments || []).length ? `<h3>Pièces jointes</h3>${t.attachments.map((a) => `<p class="cd-att">📎 ${e(a)}</p>`).join("")}` : ""}
      <details class="cd-more"><summary>Plus de détails</summary><dl class="cd-fields">${K.more(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></details>
      <footer><button type="button" class="cd-btn is-primary" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Marquer terminée"}</button><button type="button" class="cd-btn">Reporter</button><button type="button" class="cd-btn">Dupliquer</button><button type="button" class="cd-btn is-ghost">Archiver</button></footer>
    </aside>`;
  }

  function composer(S) {
    if (!S.composer) return "";
    return `<div class="cd-scrim" data-close></div><form class="cd-composer" data-compose aria-label="Nouvelle tâche">
      <h2>Nouvelle tâche</h2>
      <input data-draft data-autofocus id="cd-draft" value="${e(S.draft)}" aria-label="Décrire la tâche" autocomplete="off">
      <p class="cd-preview" data-preview>${K.previewHtml(S.draft)}</p>
      <p class="cd-hint">Écrivez naturellement : <b>#projet</b>, <b>@personne</b>, <b>!urgent</b>, un jour ou une heure. Tout reste modifiable ensuite.</p>
      <details class="cd-more"><summary>Plus d'options : type, dates de début et de fin, sous-tâches, récurrence…</summary><p class="k-muted">Les mêmes champs que la fiche, repliés par défaut.</p></details>
      <footer><button type="button" class="cd-btn is-ghost" data-close>Annuler</button><button type="submit" class="cd-btn is-primary">Créer la tâche</button></footer>
    </form>`;
  }

  function tabbar(S) {
    return `<nav class="cd-tabbar" aria-label="Navigation mobile">${nav.map(([id, l, i]) => `<button type="button" data-go="${id}" aria-current="${S.view === id ? "page" : "false"}"><i aria-hidden="true">${i}</i>${l.replace("Aujourd'hui", "Jour")}</button>`).join("")}</nav><button type="button" class="cd-fab" data-new aria-label="Nouvelle tâche">+</button>`;
  }

  window.CONCEPTS.cadran = {
    id: "cadran",
    nom: "Cadran",
    idee: "La journée est un cadran de 24 h : sommeil, réunions, séances et tâches à heure fixe autour d'une aiguille. À côté, une seule liste « Aujourd'hui », les retards et trois indicateurs de vie (récupération, sport, budget).",
    render(S) {
      const v = S.view;
      const body = v === "projet" ? projet(S) : v === "planning" ? planning(S) : v === "corps" ? corps(S) : v === "argent" ? argent(S) : jour(S);
      return `<div class="cd-shell is-${v}">${railHtml(S)}${body}${detail(S)}${composer(S)}${tabbar(S)}</div>`;
    },
    css: `
.k-cadran { --ink:#17202d; --dim:#5c6a7e; --line:#e4e9f0; --soft:#f5f7fa; --acc:${ACC}; --late:#c42727; font-family:"Figtree",system-ui,sans-serif; font-size:14.5px; color:var(--ink); background:#fff; }
.k-cadran button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; padding:0; text-align:left; }
.cd-shell { display:grid; grid-template-columns:200px 1fr; height:100%; }
.cd-shell.is-projet { grid-template-columns:200px 230px 1fr; }
.cd-rail { background:var(--soft); border-right:1px solid var(--line); padding:16px 12px; display:flex; flex-direction:column; gap:4px; }
.cd-logo { display:flex; align-items:center; gap:8px; font-weight:800; letter-spacing:.02em; margin:0 6px 14px; }
.cd-logo span { width:22px; height:22px; border-radius:6px; background:conic-gradient(from 200deg,#00b4ff,#7b3cff,#ff2fa0,#ffa31a,#00b4ff); }
.cd-new { background:var(--acc)!important; color:#fff!important; border-radius:9px!important; padding:9px 12px!important; font-weight:700; margin-bottom:10px; }
.cd-nav { display:flex; align-items:center; gap:10px; padding:8px 10px!important; border-radius:8px; color:var(--dim)!important; font-weight:600; }
.cd-nav i { font-style:normal; width:18px; text-align:center; }
.cd-nav em { margin-left:auto; font-style:normal; font-size:11px; background:#fde8e8; color:var(--late); border-radius:99px; padding:1px 7px; }
.cd-nav[aria-current="page"] { background:#fff; color:var(--ink)!important; box-shadow:0 1px 2px rgba(20,30,50,.08); }
.cd-rail-foot { margin-top:auto; font-size:12px; color:var(--dim); line-height:1.6; padding:0 10px; }
.cd-rail-foot kbd { border:1px solid var(--line); border-radius:4px; padding:0 4px; background:#fff; }
.cd-main { overflow:auto; padding:22px 28px 90px; min-width:0; }
.cd-head h1, .cd-phead h1 { font-size:26px; font-weight:800; margin:0; letter-spacing:-.01em; }
.cd-head h1::first-letter { text-transform:uppercase; }
.cd-head p, .cd-phead p { margin:4px 0 0; color:var(--dim); }
.cd-today { display:grid; grid-template-columns:minmax(300px,420px) 1fr; gap:28px; margin-top:14px; align-items:start; }
.cd-dialbox { position:relative; }
.cd-dial { width:100%; height:auto; display:block; }
.cd-hr { font-size:11px; fill:#8796aa; font-family:inherit; }
.cd-arc { cursor:pointer; } .cd-arc:hover { opacity:.8; }
.cd-center { position:absolute; inset:0; display:grid; place-content:center; text-align:center; pointer-events:none; padding:0 25%; }
.cd-dialbox:not(.cd-small) .cd-center { padding-bottom:30px; }
.cd-center small { color:var(--dim); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
.cd-center b { font-size:17px; line-height:1.25; margin:4px 0; }
.cd-center .cd-big { font-size:30px; font-weight:800; }
.cd-center span { color:var(--dim); font-size:13px; }
.cd-legend { list-style:none; display:flex; flex-wrap:wrap; gap:6px 14px; justify-content:center; padding:0; margin:4px 0 0; font-size:12px; color:var(--dim); }
.cd-legend i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:5px; vertical-align:-1px; }
.cd-lists h2, .cd-gh { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:6px 0 6px; font-weight:700; }
.cd-gh span { text-transform:none; letter-spacing:0; font-weight:500; margin-left:6px; }
.cd-list { list-style:none; margin:0 0 10px; padding:0; }
.cd-row { display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:10px; padding:8px 6px; border-bottom:1px solid var(--line); border-radius:6px; }
.cd-row:hover, .cd-row.is-sel { background:var(--soft); }
.cd-check { width:20px; height:20px; border-radius:50%!important; border:2px solid #b5c0cf!important; display:grid!important; place-items:center; font-size:12px; color:#fff!important; }
.cd-row.is-done .cd-check { background:#16a34a!important; border-color:#16a34a!important; }
.cd-row.is-done .cd-title span { text-decoration:line-through; color:var(--dim); }
.cd-title { display:flex!important; flex-direction:column; gap:2px; min-width:0; }
.cd-title span { font-weight:600; }
.cd-title small { color:var(--dim); font-size:12.5px; }
.cd-when { font-size:13px; color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap; }
.cd-when.is-late { color:var(--late); font-weight:700; }
.cd-fold { margin-top:8px; }
.cd-fold summary { cursor:pointer; font-weight:700; padding:6px 0; color:var(--ink); }
.cd-fold summary span { color:var(--late); margin-left:4px; }
.cd-vitals { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:24px; }
.cd-vital { display:flex!important; gap:12px; align-items:center; border:1px solid var(--line)!important; border-radius:14px; padding:12px 14px!important; }
.cd-vital:hover { border-color:#c7d1de!important; }
.cd-vital span { display:flex; flex-direction:column; font-size:13px; color:var(--dim); }
.cd-vital b { color:var(--ink); font-size:17px; }
.cd-vital small { font-size:12px; }
.cd-projects { border-right:1px solid var(--line); padding:20px 12px; overflow:auto; }
.cd-projects h2 { font-size:18px; margin:0 6px 10px; }
.cd-folder h3 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:14px 6px 4px; }
.cd-proj { display:flex!important; gap:10px; align-items:center; width:100%; padding:7px 6px!important; border-radius:8px; }
.cd-proj span { display:flex; flex-direction:column; font-weight:600; }
.cd-proj small { font-weight:400; color:var(--dim); font-size:12px; } .cd-proj small b { color:var(--late); font-weight:600; }
.cd-proj[aria-current="true"] { background:var(--soft); }
.cd-phead { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
.cd-phead > div:nth-child(2) { flex:1; min-width:200px; }
.cd-pring { position:relative; width:64px; height:64px; } .cd-pring b { position:absolute; inset:0; display:grid; place-items:center; font-size:14px; }
.cd-crumb { margin:0; font-size:12.5px; color:var(--dim); }
.cd-btn { border:1px solid var(--line)!important; border-radius:9px; padding:8px 12px!important; font-weight:600; background:#fff!important; white-space:nowrap; }
.cd-btn:hover { border-color:#c3cddb!important; }
.cd-btn.is-primary { background:var(--acc)!important; color:#fff!important; border-color:var(--acc)!important; }
.cd-btn.is-ghost { border-color:transparent!important; color:var(--dim)!important; }
.cd-pbudget { display:flex; align-items:center; gap:12px; margin:16px 0 6px; font-size:13px; color:var(--dim); }
.cd-bar { flex:1; height:6px; background:#eef1f6; border-radius:99px; overflow:hidden; } .cd-bar i { display:block; height:100%; border-radius:99px; }
.cd-pmain .cd-gh { margin-top:18px; }
.cd-hint { color:var(--dim); font-size:12.5px; margin-top:16px; }
.cd-week { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:10px; margin-top:16px; }
.cd-day { border:1px solid var(--line); border-radius:14px; padding:10px; min-width:0; }
.cd-day.is-today { border-color:var(--acc); box-shadow:0 0 0 3px #e3ebfc; }
.cd-day h3 { margin:0 0 4px; font-size:14px; text-transform:capitalize; } .cd-day h3 span { color:var(--dim); font-weight:500; }
.cd-day ul { list-style:none; padding:0; margin:6px 0 0; font-size:12.5px; display:grid; gap:4px; }
.cd-day li button { display:flex; align-items:baseline; text-align:left; line-height:1.3; }
.cd-day .cd-sport { color:#0f7a5c; font-weight:600; }
.cd-miles { position:relative; height:110px; border-top:2px solid var(--line); margin:30px 10px 0; }
.cd-miles > button { position:absolute; left:var(--x); top:-8px; display:flex; flex-direction:column; align-items:flex-start; font-size:12.5px; font-weight:600; max-width:150px; }
.cd-miles > button i { width:14px; height:14px; transform:rotate(45deg); margin-bottom:6px; border-radius:2px; }
.cd-miles small { color:var(--dim); font-weight:400; }
.cd-axis { position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:space-between; font-size:11px; color:var(--dim); } .cd-axis b { font-weight:500; }
.cd-body { display:grid; grid-template-columns:260px 1fr; gap:28px; align-items:center; margin-top:16px; }
.cd-small { max-width:260px; }
.cd-metrics, .cd-cats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.cd-metric { border:1px solid var(--line); border-radius:14px; padding:12px 14px; display:grid; gap:2px; }
.cd-metric > span, .cd-metric > small { color:var(--dim); font-size:12.5px; }
.cd-metric b { font-size:22px; font-variant-numeric:tabular-nums; } .cd-metric b small { font-size:13px; color:var(--dim); font-weight:500; }
.cd-metric svg { width:100%; height:34px; }
.cd-cats { grid-template-columns:1fr; gap:8px; }
.cd-cat { display:grid; grid-template-columns:110px 1fr 130px; gap:12px; align-items:center; font-size:13.5px; }
.cd-cat b { text-align:right; font-variant-numeric:tabular-nums; } .cd-cat b small { color:var(--dim); font-weight:400; }
.cd-cat.is-over span, .cd-cat.is-over b { color:var(--late); }
.cd-split { display:grid; grid-template-columns:1fr 1fr; gap:28px; margin-top:24px; }
.cd-sessions { list-style:none; padding:0; margin:0; display:grid; gap:6px; }
.cd-sessions li { display:grid; grid-template-columns:110px 1fr; gap:2px 10px; padding:8px 10px; border-radius:10px; background:var(--soft); font-size:13.5px; }
.cd-sessions li small { grid-column:2; color:var(--dim); } .cd-sessions li.is-plan { background:#e6f6f0; }
.cd-habits { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:10px; }
.cd-habits h4 { width:100%; margin:4px 0 0; font-size:12.5px; color:var(--dim); font-weight:600; }
.cd-hab { border:1px solid var(--line)!important; border-radius:99px; padding:6px 12px!important; font-size:13.5px; display:inline-flex!important; gap:8px; align-items:center; }
.cd-hab.is-on { background:#e6f6f0!important; border-color:#9fd9c2!important; color:#0b6b4f!important; font-weight:600; }
.cd-hab.is-num button { width:22px; height:22px; border-radius:50%; background:var(--soft)!important; text-align:center!important; }
.cd-tx { display:grid; grid-template-columns:1fr auto auto; gap:12px; align-items:center; padding:9px 0; border-bottom:1px solid var(--line); font-size:13.5px; }
.cd-tx span { display:flex; flex-direction:column; } .cd-tx small { color:var(--dim); } .cd-tx > b { font-variant-numeric:tabular-nums; } .cd-tx .is-in { color:#0f7a5c; }
.cd-wealth { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:13px; color:var(--dim); margin-top:8px; }
.cd-wealth i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:5px; } .cd-wealth b { color:var(--ink); }
.cd-sheet { position:absolute; top:0; right:0; bottom:0; width:min(420px,100%); background:#fff; border-left:1px solid var(--line); box-shadow:-12px 0 40px rgba(20,30,50,.10); padding:20px 22px 90px; overflow:auto; z-index:20; animation:cd-slide .22s ease-out; }
@keyframes cd-slide { from { transform:translateX(24px); opacity:0; } }
.cd-sheet h2 { font-size:21px; margin:4px 0 8px; line-height:1.25; }
.cd-sheet h3 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:18px 0 6px; }
.cd-x { position:absolute; right:14px; top:12px; font-size:24px!important; width:36px; height:36px; border-radius:50%!important; text-align:center!important; color:var(--dim)!important; }
.cd-x:hover { background:var(--soft)!important; }
.cd-flag { display:inline-block; font-size:12.5px; font-weight:600; background:#fde8e8; color:var(--late); border-radius:6px; padding:3px 8px; margin-right:6px; }
.cd-flag.is-amber { background:#fdf1dc; color:#9a5b05; }
.cd-fields { margin:12px 0 0; display:grid; gap:0; }
.cd-fields div { display:grid; grid-template-columns:110px 1fr; gap:10px; padding:8px 0; border-bottom:1px solid var(--line); font-size:14px; }
.cd-fields dt { color:var(--dim); } .cd-fields dd { margin:0; display:flex; align-items:center; flex-wrap:wrap; }
.cd-cl { list-style:none; padding:0; margin:0; display:grid; gap:6px; }
.cd-cl li { display:flex; gap:8px; align-items:center; } .cd-cl i { width:16px; height:16px; border:2px solid #b5c0cf; border-radius:4px; font-style:normal; font-size:10px; display:grid; place-items:center; }
.cd-cl .is-done { color:var(--dim); text-decoration:line-through; } .cd-cl .is-done i { background:#16a34a; border-color:#16a34a; color:#fff; }
.cd-link { color:var(--acc)!important; font-weight:600; }
.cd-att { margin:4px 0; }
.cd-more { margin-top:16px; } .cd-more summary { cursor:pointer; color:var(--acc); font-weight:600; }
.cd-sheet footer { display:flex; flex-wrap:wrap; gap:8px; margin-top:20px; }
.cd-scrim { position:absolute; inset:0; background:rgba(20,28,40,.28); z-index:25; }
.cd-composer { position:absolute; left:50%; top:12%; transform:translateX(-50%); width:min(620px,calc(100% - 32px)); background:#fff; border-radius:16px; padding:20px 22px; z-index:30; box-shadow:0 24px 60px rgba(20,30,50,.25); animation:k-in2 .2s ease-out; }
@keyframes k-in2 { from { opacity:0; transform:translate(-50%,10px); } }
.cd-composer h2 { margin:0 0 10px; font-size:18px; }
.cd-composer input { width:100%; font:inherit; font-size:17px; padding:12px 14px; border:2px solid var(--acc); border-radius:10px; outline:none; }
.cd-preview { display:flex; flex-wrap:wrap; gap:6px; min-height:28px; }
.cd-composer footer { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
.cd-tabbar, .cd-fab { display:none!important; }
@container app (max-width: 1100px) { .cd-shell { grid-template-columns:170px 1fr; } .cd-shell.is-projet { grid-template-columns:170px 200px 1fr; } .cd-week { grid-template-columns:repeat(4,minmax(0,1fr)); } .cd-today { grid-template-columns:1fr; } .cd-dialbox:not(.cd-small) { max-width:400px; margin:0 auto; width:100%; } }
@container app (max-width: 700px) {
  .cd-shell, .cd-shell.is-projet { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
  .cd-rail { display:none; }
  .cd-projects { border:0; border-bottom:1px solid var(--line); padding:10px 12px; display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; }
  .cd-projects h2, .cd-folder h3 { display:none; } .cd-folder { display:contents; }
  .cd-proj { width:auto; flex:none; border:1px solid var(--line)!important; }
  .cd-shell.is-projet .cd-main { grid-row:2; }
  .cd-main { padding:16px 16px 110px; }
  .cd-head h1, .cd-phead h1 { font-size:22px; }
  .cd-today { gap:12px; } .cd-dialbox:not(.cd-small) { max-width:290px; }
  .cd-vitals, .cd-split, .cd-body, .cd-metrics { grid-template-columns:1fr; } .cd-small { margin:0 auto; max-width:230px; }
  .cd-week { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .cd-cat { grid-template-columns:90px 1fr 100px; }
  .cd-sheet { width:100%; border:0; padding-top:56px; }
  .cd-tabbar { display:flex!important; position:absolute; left:0; right:0; bottom:0; background:#fff; border-top:1px solid var(--line); padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px)); z-index:22; justify-content:space-around; }
  .cd-tabbar button { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:11px; color:var(--dim)!important; padding:4px 6px!important; text-align:center!important; }
  .cd-tabbar i { font-style:normal; font-size:17px; } .cd-tabbar [aria-current="page"] { color:var(--acc)!important; font-weight:700; }
  .cd-fab { display:grid!important; place-items:center; position:absolute; right:16px; bottom:76px; width:52px; height:52px; border-radius:50%!important; background:var(--acc)!important; color:#fff!important; font-size:28px!important; box-shadow:0 8px 20px rgba(36,94,219,.35); z-index:21; text-align:center!important; }
  .cd-composer { top:auto; bottom:0; left:0; transform:none; width:100%; border-radius:18px 18px 0 0; animation:none; }
  .k-toast { bottom:84px; }
}`,
  };
})();
