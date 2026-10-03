// Concept 5 — Carnet : on écrit, Nexora range ; la page du jour se lit comme un texte.
// Les phrases sont produites par des règles fixes, sans IA (décision #652 : « règles seules »).
(function () {
  const K = window.K, D = K.D, e = K.esc;
  const pl = (p) => `<button type="button" class="cn-ref" data-go="projet" data-project="${p.id}" style="--c:${p.color}">${e(p.name)}</button>`;
  const tl = (t) => `<button type="button" class="cn-ref is-task" data-task="${t.id}">${e(t.title)}</button>`;
  const word = (arr, col) => K.spark(arr, { w: 46, h: 14, color: col, fill: false, dot: true });

  // Lecture d'une ligne : tâche, dépense ou séance (mêmes règles que la saisie rapide).
  function detect(text) {
    const t = String(text || "").trim();
    const money = t.match(/(\d+(?:[.,]\d{1,2})?)\s?€/);
    if (money) { const amount = Number(money[1].replace(",", ".")); const rest = t.replace(money[0], "").trim(); const cat = /resto|déj|dej|dîner|café|boulang/i.test(rest) ? "Restaurants" : /carrefour|courses|marché/i.test(rest) ? "Courses" : /train|sncf|essence|parking/i.test(rest) ? "Transport" : "Loisirs"; return { kind: "dépense", label: rest || "Dépense", amount, cat }; }
    const sport = t.match(/^(course|footing|vélo|velo|natation|renfo\w*)\b(.*)/i);
    if (sport) { const km = (sport[2].match(/(\d+(?:[.,]\d)?)\s?km/) || [])[1]; const min = (sport[2].match(/(\d+)\s?min/) || [])[1]; return { kind: "séance", sport: sport[1], km, min }; }
    return { kind: "tâche" };
  }
  const kindLabel = (text) => { const d = detect(text); return d.kind === "dépense" ? `Je note <b>une dépense</b> de ${K.euro(d.amount, true)} dans <b>${e(d.cat)}</b>` : d.kind === "séance" ? `Je note <b>une séance</b> : ${e(d.sport)}${d.km ? " · " + d.km + " km" : ""}${d.min ? " · " + d.min + " min" : ""}` : `Je crée <b>une tâche</b>`; };

  function writer(S, placeholder) {
    return `<form class="cn-write ${S.composer ? "is-focus" : ""}" data-compose aria-label="Écrire dans le carnet">
      <input id="cn-draft" data-draft ${S.composer ? "data-autofocus" : ""} value="${e(S.composer ? S.draft : "")}" placeholder="${e(placeholder)}" autocomplete="off" aria-label="Écrire une tâche, une dépense ou une séance">
      ${S.composer ? `<p class="cn-kind">${kindLabel(S.draft)}</p><p class="cn-prev" data-preview>${K.previewHtml(S.draft)}</p><p class="cn-help">Exemples : « Relancer BC vendredi 14h #CTEX6 @Vincent » · « 12 € déjeuner » · « course 8 km 42 min »</p>` : ""}
      <button type="submit" class="cn-ok">Ranger ↵</button></form>`;
  }

  function index(S) {
    const v = S.view;
    return `<nav class="cn-index" aria-label="Sommaire du carnet"><p class="cn-brand">Nexora<small>carnet</small></p>
      <button type="button" data-go="jour" aria-current="${v === "jour"}">Aujourd'hui</button><button type="button" data-go="planning" aria-current="${v === "planning"}">Semainier</button>
      <h4>Projets</h4>${D.projects.map((p) => `<button type="button" data-go="projet" data-project="${p.id}" aria-current="${v === "projet" && S.projectId === p.id}"><span class="k-dot" style="--c:${p.color}"></span>${e(p.name)}</button>`).join("")}
      <h4>Vie</h4><button type="button" data-go="corps" aria-current="${v === "corps"}">Corps</button><button type="button" data-go="argent" aria-current="${v === "argent"}">Argent</button>
      <p class="cn-note">Tout ce qui est souligné s'ouvre dans la marge.</p></nav>`;
  }

  function jour(S) {
    const today = K.todayTasks(), late = K.late(), H = D.health, bp = K.budgetPace();
    const lot = K.project("p-lot2b"), ctex = K.project("p-ctex6");
    const visite = K.task("t3"), pv = K.task("t2");
    const todo = D.budget.toCategorize.filter((x) => !S.categorized[x.id]);
    const habDone = S.habits[0].items.filter((h) => h.done).length;
    return `<article class="cn-page">
      ${writer(S, "Écrire une tâche, une dépense, une séance…")}
      <h1>Lundi 5 octobre</h1>
      <p class="cn-lead">Bonjour Quentin. La matinée commence avec ${tl(K.task("t7"))} à 8:30 pour ${pl(lot)}. À 11:00, ${tl(K.task("t13"))} pour ${pl(ctex)}. ${tl(K.task("t14"))} est marqué urgent et doit partir aujourd'hui. Ce soir, footing de 45 minutes à 18:30.</p>
      <h2>À faire aujourd'hui</h2>
      <ul class="cn-todo">${today.map((t) => `<li class="${K.isDone(t) ? "is-done" : ""}"><button type="button" class="cn-ck" data-done="${t.id}" aria-label="${K.isDone(t) ? "Rouvrir" : "Terminer"} ${e(t.title)}">${K.isDone(t) ? "✓" : ""}</button>${tl(t)} <small>${e(K.project(t.projectId).name)}${t.startTime ? " · " + t.startTime : ""}</small></li>`).join("")}</ul>
      <h2>À rattraper</h2>
      <p>${late.length} tâches ont dépassé leur échéance. La plus ancienne, ${tl(late[0])}, attend ${e(K.first(late[0].assignee))} depuis ${K.lateDays(late[0])} jours. ${tl(pv)} n'est pas prête alors que ${tl(visite)} a lieu jeudi à 9:00 : elle attend encore ${tl(K.task("t1"))}.</p>
      <h2>Cette semaine</h2>
      <p>Mardi à 14:00, ${tl(K.task("t12"))}. Mercredi, ${tl(K.task("t9"))} pour ${pl(K.project("p-com"))}. Jeudi, ${tl(visite)}. Samedi, sortie vélo de deux heures. <button type="button" class="cn-more" data-go="planning">Ouvrir le semainier ›</button></p>
      <h2>Corps</h2>
      <p>Nuit de ${String(K.last(H.sleep)).replace(".", ",")} h ${word(H.sleep, "#5b7bd8")}, récupération ${K.last(H.recovery)} % ${word(H.recovery, "#0f9d76")}. La HRV monte depuis une semaine ${word(H.hrv, "#0f9d76")}. ${habDone} habitudes sur ${S.habits[0].items.length} : ${S.habits[0].items.slice(0, 3).map((h, i) => `<button type="button" class="cn-hab ${h.done ? "is-on" : ""}" data-habit="0:${i}" aria-pressed="${h.done}">${h.done ? "✓" : "○"} ${e(h.name)}</button>`).join(" ")}. <button type="button" class="cn-more" data-go="corps">Tout le corps ›</button></p>
      <h2>Argent</h2>
      <p>Il reste ${K.euro(bp.left)} pour octobre, soit ${K.euro(bp.perDay)} par jour. Les restaurants ont dépassé leur budget de 12 €. ${todo.length ? `${todo.length === 1 ? "Une opération attend" : todo.length + " opérations attendent"} une catégorie : ${todo.map((x) => `${e(x.label)} (${K.euro(x.amount, true)}) <button type="button" class="cn-hab" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button>`).join(", ")}.` : "Tout est classé."} <button type="button" class="cn-more" data-go="argent">Tout l'argent ›</button></p>
      <p class="cn-sign">Page écrite par des règles à 10:40, sans intelligence artificielle. Chaque chiffre vient de vos données.</p>
    </article>`;
  }

  function projet(S) {
    const p = K.project(S.projectId), st = K.projectStats(p.id), ts = K.byProject(p.id), f = D.folders.find((x) => x.id === p.folderId);
    const late = ts.filter(K.isLate), open = ts.filter((t) => !K.isDone(t) && !K.isLate(t) && t.statusId !== "s6"), done = ts.filter(K.isDone);
    const ms = ts.find((t) => t.milestone && !K.isDone(t));
    return `<article class="cn-page">
      ${writer(S, `Ajouter à ${p.name}… (le projet est déjà choisi)`)}
      <p class="cn-kick">${e(f.name)} · chapitre</p><h1 style="--c:${p.color}" class="cn-ph">${e(p.name)}</h1>
      <p class="cn-lead">${e(p.name)} avance à ${st.progress} % avec ${st.open} tâches ouvertes${st.late ? `, dont ${st.late} en retard` : ""}. ${ms ? `Prochain jalon : ${tl(ms)}, ${K.rel(ms.end)}.` : ""} ${p.budget ? `Budget engagé : ${K.euro(p.spent)} sur ${K.euro(p.budget)} (${Math.round((p.spent / p.budget) * 100)} %).` : ""}</p>
      ${late.length ? `<h2>En retard</h2><ul class="cn-todo">${late.map((t) => `<li><button type="button" class="cn-ck" data-done="${t.id}" aria-label="Terminer ${e(t.title)}"></button>${tl(t)} <small class="is-late">${K.lateDays(t)} j · ${e(K.first(t.assignee))}</small></li>`).join("")}</ul>` : ""}
      <h2>À venir</h2><ul class="cn-todo">${open.map((t) => `<li><button type="button" class="cn-ck" data-done="${t.id}" aria-label="Terminer ${e(t.title)}"></button>${tl(t)} <small>${K.rel(t.end)}${t.assignee ? " · " + e(K.first(t.assignee)) : ""}</small></li>`).join("")}</ul>
      ${done.length ? `<h2>Fait</h2><ul class="cn-todo">${done.map((t) => `<li class="is-done"><button type="button" class="cn-ck" data-done="${t.id}" aria-label="Rouvrir">✓</button>${tl(t)}</li>`).join("")}</ul>` : ""}
      <p class="cn-sign">Autres lectures du chapitre : frise, tableau, tableur. Journal du projet : 2 événements cette semaine.</p>
    </article>`;
  }

  function planning(S) {
    const wk = K.week();
    const day = (d) => { const ts = K.open().filter((t) => t.end === d || (t.startTime && t.start <= d && t.end >= d)); const sp = D.sport.planned.filter((s) => s.date === d); return `<section class="cn-day ${d === D.today ? "is-today" : ""}"><h3>${K.dayName(d)} <span>${Number(d.slice(8))}</span></h3><ul>${ts.map((t) => `<li>${t.startTime ? `<time>${t.startTime}</time>` : "<time>·</time>"}${tl(t)}</li>`).join("")}${sp.map((s) => `<li class="is-sport"><time>${s.time}</time>${e(s.title)}</li>`).join("")}</ul></section>`; };
    return `<article class="cn-page is-wide">${writer(S, "Écrire pour un jour : « Copil jeudi 14h #Agenda »…")}
      <h1>Semaine 41</h1><p class="cn-lead">Du lundi 5 au dimanche 11 octobre. Deux jalons, une réunion, trois séances prévues.</p>
      <div class="cn-spread"><div class="cn-leaf">${wk.slice(0, 3).map(day).join("")}</div><div class="cn-leaf">${wk.slice(3).map(day).join("")}</div></div>
      <p class="cn-sign">Congés scolaires (zone A) à partir du 17 octobre. Agenda Google en lecture seule.</p></article>`;
  }

  function corps(S) {
    const H = D.health, sw = K.sportWeek();
    const row = (l, arr, u, col, dec = 0) => `<li><span>${l}</span>${K.spark(arr, { w: 140, h: 26, color: col, fill: false })}<b>${K.last(arr).toLocaleString("fr-FR", { maximumFractionDigits: dec })} ${u}</b></li>`;
    return `<article class="cn-page">${writer(S, "« course 8 km 42 min », « ✓ méditation »…")}
      <p class="cn-kick">Vie · corps</p><h1>Corps</h1>
      <p class="cn-lead">Récupération ${K.last(H.recovery)} %, au-dessus de votre moyenne de 14 jours (${Math.round(H.recovery.reduce((a, b) => a + b) / 14)} %). Le poids baisse doucement : ${String(H.weight[0]).replace(".", ",")} kg il y a deux semaines, ${String(K.last(H.weight)).replace(".", ",")} kg ce matin. Sport : ${K.hm(sw.done)} sur ${D.sport.goalHours} h cette semaine, ${K.hm(sw.last)} la semaine dernière.</p>
      <h2>Mesures, 14 jours</h2><ul class="cn-measures">${row("Sommeil", H.sleep, "h", "#5b7bd8", 1)}${row("Récupération", H.recovery, "%", "#0f9d76")}${row("HRV", H.hrv, "ms", "#0f9d76")}${row("FC repos", H.restingHr, "bpm", "#c2410c")}${row("Poids", H.weight, "kg", "#475569", 1)}${row("Pas", H.steps, "", "#7c5cd6")}</ul>
      <h2>Séances</h2><ul class="cn-todo">${D.sport.planned.slice(0, 1).map((s) => `<li><span class="cn-ck is-plan"></span><b>Ce soir ${s.time}</b>&nbsp;${e(s.title)} <small>prévu</small></li>`).join("")}${D.sport.sessions.slice(0, 4).map((s) => `<li><span class="cn-ck is-on">✓</span>${e(s.sport)}, ${e(s.title)} <small>${K.dayName(s.date)} · ${K.hm(s.minutes)}${s.km ? " · " + String(s.km).replace(".", ",") + " km" : ""}${s.dplus ? " · D+ " + s.dplus + " m" : ""} · ${s.hr} bpm</small></li>`).join("")}</ul>
      <h2>Habitudes</h2>${S.habits.map((g, gi) => `<p>${e(g.theme)} : ${g.items.map((h, i) => h.max != null ? `<span class="cn-hab"><button type="button" data-habit="${gi}:${i}:-1" aria-label="Moins">−</button> ${e(h.name)} ${h.value}/${h.max} <button type="button" data-habit="${gi}:${i}:1" aria-label="Plus">+</button></span>` : `<button type="button" class="cn-hab ${h.done ? "is-on" : ""}" data-habit="${gi}:${i}" aria-pressed="${h.done}">${h.done ? "✓" : "○"} ${e(h.name)}</button>`).join(" ")}</p>`).join("")}
    </article>`;
  }

  function argent(S) {
    const b = D.budget, bp = K.budgetPace(), todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    return `<article class="cn-page">${writer(S, "« 12 € déjeuner », « 46 € Carrefour »…")}
      <p class="cn-kick">Vie · argent</p><h1>${b.month}</h1>
      <p class="cn-lead">${K.euro(b.spent)} dépensés au ${b.dayOfMonth} du mois, pour un budget de ${K.euro(b.total)}. À ce rythme on attendrait ${K.euro(bp.expected)} : vous êtes ${K.euro(Math.abs(bp.ahead))} ${bp.ahead > 0 ? "au-dessus" : "en dessous"}. Il reste ${K.euro(bp.perDay)} par jour.</p>
      ${todo.length ? `<h2>À classer</h2><ul class="cn-todo">${todo.map((x) => `<li><span class="cn-ck"></span>${e(x.label)} <small>${K.dateShort(x.date)} · ${K.euro(x.amount, true)}</small> <button type="button" class="cn-hab" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></li>`).join("")}</ul>` : ""}
      <h2>Catégories</h2><table class="cn-ledger"><tbody>${b.categories.map((c) => { const pct = Math.round((c.spent / c.limit) * 100); return `<tr class="${pct > 100 ? "is-over" : ""}"><th>${e(c.name)}</th><td><span class="cn-bar"><i style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "#b91c1c" : c.color}"></i></span></td><td>${K.euro(c.spent)}</td><td class="cn-dim">sur ${K.euro(c.limit)}</td></tr>`; }).join("")}</tbody></table>
      <h2>Patrimoine</h2><p>${K.euro(D.wealth.total)} ${word(D.wealth.series, "#0f766e")}, en hausse de 10,8 % sur un an : ${D.wealth.parts.map((x) => `${e(x.name)} ${K.euro(x.value)}`).join(", ")}.</p>
      <p class="cn-sign">Côté pro : ${D.pro.invoices} factures, ${K.euro(D.pro.unpaid)} à encaisser, ${D.pro.quotes} devis en cours.</p></article>`;
  }

  function margin(S) {
    const t = K.task(S.taskId);
    if (!t) {
      if (S.view !== "jour") return `<aside class="cn-margin is-empty"><p>Touchez un mot souligné pour l'ouvrir ici, sans quitter la page.</p></aside>`;
      return `<aside class="cn-margin is-empty"><h4>Marge</h4><p>Touchez un mot souligné : la tâche ou le projet s'ouvre ici, sans quitter la page.</p><h4>Repères</h4><p>${K.late().length} en retard · ${K.todayTasks().length} aujourd'hui · ${K.euro(K.budgetPace().left)} restants · récupération ${K.last(D.health.recovery)} %</p></aside>`;
    }
    const cl = t.checklist || [], deps = K.deps(t), p = K.project(t.projectId);
    return `<aside class="cn-margin" aria-label="Tâche ouverte dans la marge"><button type="button" class="cn-x" data-close aria-label="Fermer">×</button>
      <p class="cn-kick">${pl(p)} · tâche</p><h3>${e(t.title)}</h3>
      <p class="cn-sum">${K.isDone(t) ? "Terminée." : K.isLate(t) ? `En retard de ${K.lateDays(t)} jours.` : `Échéance ${K.rel(t.end)}.`} ${t.assignee ? `Confiée à ${e(t.assignee)}.` : "Personne n'en est responsable."} ${t.crit ? `Criticité ${K.critLabel[t.crit].toLowerCase()}.` : ""} ${K.blocked(t) ? `Attend ${tl(deps[0])}.` : ""}</p>
      <dl>${K.fields(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${cl.length ? `<h4>Sous-tâches ${cl.filter((x) => x.done).length}/${cl.length}</h4><ul class="cn-cl">${cl.map((x) => `<li class="${x.done ? "is-done" : ""}">${x.done ? "✓" : "○"} ${e(x.text)}</li>`).join("")}</ul>` : ""}
      ${t.desc ? `<h4>Note</h4><p>${e(t.desc)}</p>` : ""}
      ${(t.attachments || []).length ? `<h4>Pièces jointes</h4><p>${t.attachments.map(e).join("<br>")}</p>` : ""}
      <details><summary>Tous les champs</summary><dl>${K.more(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></details>
      <footer><button type="button" class="cn-btn is-primary" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Terminer"}</button><button type="button" class="cn-btn">Reporter</button><button type="button" class="cn-btn">Archiver</button></footer></aside>`;
  }

  window.CONCEPTS.carnet = {
    id: "carnet",
    nom: "Carnet",
    idee: "On écrit, Nexora range. Une seule ligne d'écriture comprend une tâche, une dépense ou une séance. La page du jour se lit comme un texte rédigé par des règles (sans IA), dont chaque mot souligné ouvre la tâche ou le projet dans la marge.",
    onCompose(text) {
      const d = detect(text);
      if (d.kind === "dépense") return `Dépense de ${K.euro(d.amount, true)} notée dans ${d.cat} (démo, rien n'est enregistré)`;
      if (d.kind === "séance") return `Séance de ${d.sport} notée${d.km ? ", " + d.km + " km" : ""}${d.min ? ", " + d.min + " min" : ""} (démo)`;
      return null;
    },
    render(S) {
      const v = S.view;
      const body = v === "projet" ? projet(S) : v === "planning" ? planning(S) : v === "corps" ? corps(S) : v === "argent" ? argent(S) : jour(S);
      return `<div class="cn-shell ${S.taskId ? "has-task" : ""}">${index(S)}<main class="cn-desk" data-scroll>${body}</main>${margin(S)}<nav class="cn-tabs" aria-label="Navigation mobile"><button type="button" data-go="jour" aria-current="${v === "jour"}">Jour</button><button type="button" data-go="projet" data-project="${S.projectId}" aria-current="${v === "projet"}">Projets</button><button type="button" data-go="planning" aria-current="${v === "planning"}">Semaine</button><button type="button" data-go="corps" aria-current="${v === "corps"}">Corps</button><button type="button" data-go="argent" aria-current="${v === "argent"}">Argent</button></nav></div>`;
    },
    css: `
.k-carnet { --ink:#1f2328; --dim:#5f6670; --paper:#ffffff; --desk:#f2f3f1; --rule:#e5e7e4; --acc:#245edb; font-family:"Atkinson Hyperlegible",system-ui,sans-serif; font-size:15.5px; color:var(--ink); background:var(--desk); }
.k-carnet button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; padding:0; text-align:left; }
.cn-shell { display:grid; grid-template-columns:190px minmax(0,1fr) 320px; height:100%; }
.cn-index { padding:22px 16px; display:flex; flex-direction:column; gap:2px; overflow:auto; }
.cn-brand { font-family:"Literata",Georgia,serif; font-size:20px; font-weight:600; margin:0 8px 16px; display:flex; flex-direction:column; } .cn-brand small { font-family:"Atkinson Hyperlegible",sans-serif; font-size:12px; color:var(--dim); font-weight:400; letter-spacing:.08em; text-transform:uppercase; }
.cn-index h4 { font-size:12px; text-transform:uppercase; letter-spacing:.09em; color:var(--dim); margin:16px 8px 4px; }
.cn-index button { padding:6px 8px!important; border-radius:6px; color:var(--dim)!important; display:flex!important; align-items:center; }
.cn-index button[aria-current="true"] { color:var(--ink)!important; background:#fff!important; font-weight:700; }
.cn-note { margin:auto 8px 0; font-size:12.5px; color:var(--dim); line-height:1.5; padding-top:16px; }
.cn-desk { overflow:auto; padding:22px 18px 60px; }
.cn-page { background:var(--paper); max-width:720px; margin:0 auto; padding:30px 46px 40px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 30px rgba(30,35,40,.06); line-height:1.7; }
.cn-page.is-wide { max-width:980px; }
.cn-page h1 { font-family:"Literata",Georgia,serif; font-size:38px; font-weight:600; margin:22px 0 6px; letter-spacing:-.01em; line-height:1.15; }
.cn-ph { border-bottom:4px solid var(--c); display:inline-block; padding-bottom:2px; }
.cn-page h2 { font-family:"Literata",Georgia,serif; font-size:20px; font-weight:600; margin:26px 0 4px; }
.cn-page p { margin:0 0 10px; max-width:66ch; }
.cn-lead { font-family:"Literata",Georgia,serif; font-size:18.5px; line-height:1.65; }
.cn-kick { font-size:12.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--dim); margin:18px 0 0!important; }
.cn-ref { color:inherit!important; text-decoration:underline; text-decoration-color:color-mix(in srgb,var(--c,#245edb) 70%,transparent); text-decoration-thickness:2px; text-underline-offset:3px; font-weight:700; display:inline!important; text-align:inherit!important; }
.cn-ref.is-task { --c:#245edb; font-weight:600; }
.cn-ref:hover { background:color-mix(in srgb,var(--c,#245edb) 10%,transparent)!important; }
.cn-page .k-spark { vertical-align:-2px; }
.cn-todo { list-style:none; margin:4px 0 0; padding:0; }
.cn-todo li { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; padding:7px 0; border-bottom:1px solid var(--rule); }
.cn-todo small { color:var(--dim); font-size:14px; } .cn-todo small.is-late { color:#b91c1c; font-weight:700; }
.cn-todo li.is-done .cn-ref { text-decoration:line-through; color:var(--dim)!important; }
.cn-ck { width:19px; height:19px; flex:none; border:1.8px solid #8f98a3!important; border-radius:50%!important; display:inline-grid!important; place-items:center; font-size:11px; align-self:center; color:#fff!important; text-align:center!important; }
.cn-todo li.is-done .cn-ck, .cn-ck.is-on { background:#15803d!important; border-color:#15803d!important; }
.cn-ck.is-plan { border-style:dashed!important; border-color:#0e7490!important; }
.cn-hab { display:inline-flex!important; gap:5px; align-items:center; border:1px solid var(--rule)!important; border-radius:99px; padding:1px 10px!important; font-size:14px; line-height:1.6; background:#fff!important; vertical-align:1px; }
.cn-hab.is-on { background:#e7f5ee!important; border-color:#a5d8bf!important; color:#0b6b4f!important; font-weight:700; }
.cn-hab button { padding:0 4px!important; }
.cn-more { color:var(--acc)!important; font-weight:700; white-space:nowrap; display:inline!important; }
.cn-sign { margin-top:26px!important; font-size:13px; color:var(--dim); border-top:1px solid var(--rule); padding-top:10px; }
.cn-write { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; border-bottom:2px solid var(--ink); padding:4px 0 8px; }
.cn-write input { flex:1; min-width:200px; font:inherit; font-family:"Literata",Georgia,serif; font-size:19px; border:0; outline:none; background:transparent; padding:4px 0; }
.cn-write input::placeholder { color:#9aa1aa; font-style:italic; }
.cn-write.is-focus { border-bottom-color:var(--acc); }
.cn-ok { font-size:13px!important; color:var(--dim)!important; border:1px solid var(--rule)!important; border-radius:6px; padding:4px 10px!important; }
.cn-kind, .cn-prev, .cn-help { width:100%; margin:0!important; } .cn-kind { font-size:14.5px; } .cn-prev { display:flex; flex-wrap:wrap; gap:6px; } .cn-help { font-size:13px; color:var(--dim); }
.cn-measures { list-style:none; margin:0; padding:0; }
.cn-measures li { display:grid; grid-template-columns:130px 150px 1fr; align-items:center; gap:12px; padding:6px 0; border-bottom:1px solid var(--rule); } .cn-measures b { font-variant-numeric:tabular-nums; }
.cn-ledger { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
.cn-ledger th, .cn-ledger td { padding:7px 6px; border-bottom:1px solid var(--rule); text-align:right; } .cn-ledger th { text-align:left; font-weight:700; } .cn-dim { color:var(--dim); }
.cn-ledger .is-over th, .cn-ledger .is-over td { color:#b91c1c; }
.cn-bar { display:block; width:100%; min-width:80px; height:7px; background:#eef0ec; border-radius:99px; overflow:hidden; } .cn-bar i { display:block; height:100%; }
.cn-spread { display:grid; grid-template-columns:1fr 1fr; gap:0; margin-top:14px; border:1px solid var(--rule); border-radius:4px; }
.cn-leaf { padding:4px 18px; } .cn-leaf + .cn-leaf { border-left:1px solid var(--rule); box-shadow:inset 8px 0 12px -10px rgba(0,0,0,.18); }
.cn-day { padding:10px 0 12px; border-bottom:1px solid var(--rule); min-height:130px; } .cn-day:last-child { border-bottom:0; }
.cn-day h3 { font-family:"Literata",Georgia,serif; font-size:17px; margin:0 0 4px; text-transform:capitalize; font-weight:600; } .cn-day h3 span { color:var(--dim); font-weight:400; }
.cn-day.is-today h3 { color:var(--acc); }
.cn-day ul { list-style:none; margin:0; padding:0; background-image:repeating-linear-gradient(transparent 0 27px,var(--rule) 27px 28px); line-height:28px; }
.cn-day li { display:flex; gap:10px; } .cn-day time { width:42px; color:var(--dim); font-size:13.5px; font-variant-numeric:tabular-nums; flex:none; }
.cn-day .is-sport { color:#0e7490; font-weight:700; }
.cn-margin { border-left:1px solid var(--rule); background:#fbfbfa; padding:22px 20px 40px; overflow:auto; position:relative; line-height:1.55; animation:cn-in .2s ease-out; }
@keyframes cn-in { from { opacity:0; } }
.cn-margin.is-empty { color:var(--dim); font-size:14px; } .cn-margin h4 { font-size:12px; text-transform:uppercase; letter-spacing:.09em; color:var(--dim); margin:16px 0 4px; }
.cn-margin h3 { font-family:"Literata",Georgia,serif; font-size:22px; font-weight:600; margin:6px 0 8px; line-height:1.25; }
.cn-sum { font-family:"Literata",Georgia,serif; font-size:16px; }
.cn-margin dl { margin:10px 0 0; } .cn-margin dl div { display:grid; grid-template-columns:100px 1fr; gap:8px; padding:6px 0; border-bottom:1px solid var(--rule); font-size:14.5px; } .cn-margin dt { color:var(--dim); } .cn-margin dd { margin:0; display:flex; align-items:center; flex-wrap:wrap; }
.cn-cl { list-style:none; padding:0; margin:0; } .cn-cl .is-done { color:var(--dim); text-decoration:line-through; }
.cn-margin details { margin-top:12px; } .cn-margin summary { cursor:pointer; color:var(--acc); font-weight:700; }
.cn-margin footer { display:flex; gap:6px; flex-wrap:wrap; margin-top:16px; }
.cn-x { position:absolute; top:12px; right:12px; width:34px; height:34px; font-size:24px!important; border-radius:50%; text-align:center!important; color:var(--dim)!important; }
.cn-btn { border:1px solid var(--rule)!important; background:#fff!important; padding:7px 12px!important; border-radius:6px; font-weight:700; }
.cn-btn.is-primary { background:var(--ink)!important; color:#fff!important; border-color:var(--ink)!important; }
.cn-tabs { display:none!important; }
@container app (max-width: 1150px) { .cn-shell { grid-template-columns:170px minmax(0,1fr); } .cn-margin.is-empty { display:none; } .cn-margin { position:absolute; right:0; top:0; bottom:0; width:340px; z-index:20; box-shadow:-10px 0 30px rgba(0,0,0,.12); } .cn-page { padding:24px 28px 32px; } }
@container app (max-width: 700px) {
  .cn-shell { grid-template-columns:1fr; } .cn-index { display:none; }
  .cn-desk { padding:0 0 70px; } .cn-page { border-radius:0; box-shadow:none; padding:16px 18px 30px; }
  .cn-page h1 { font-size:30px; } .cn-lead { font-size:17px; }
  .cn-spread { grid-template-columns:1fr; } .cn-leaf + .cn-leaf { border-left:0; box-shadow:none; border-top:1px solid var(--rule); }
  .cn-measures li { grid-template-columns:100px 1fr auto; } .cn-measures svg { width:100%; }
  .cn-margin { width:100%; top:auto; height:78%; border-radius:16px 16px 0 0; border:0; }
  .cn-tabs { display:flex!important; position:absolute; left:0; right:0; bottom:0; background:#fff; border-top:1px solid var(--rule); justify-content:space-around; padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px)); z-index:15; }
  .cn-tabs button { font-size:13px; color:var(--dim)!important; padding:4px 6px!important; } .cn-tabs [aria-current="true"] { color:var(--ink)!important; font-weight:700; border-bottom:2px solid var(--ink)!important; }
}`,
  };
})();
