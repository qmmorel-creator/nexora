// Coque des maquettes : barre de démonstration, rendu, interactions communes.
// Chaque concept s'enregistre dans window.CONCEPTS avec { id, nom, idee, css, render(S) }.
(function () {
  "use strict";
  const K = window.K;
  const ORDER = ["cadran", "classeur", "partition", "mosaique", "carnet", "sommaire"];
  const SCREENS = [
    ["jour", "Aujourd'hui"], ["projet", "Projet + tâche"], ["nouvelle", "Nouvelle tâche"],
    ["planning", "Planning"], ["corps", "Corps"], ["argent", "Argent"],
  ];

  const S = () => K.state;
  const root = () => document.getElementById("app");

  function render() {
    const s = S();
    const c = window.CONCEPTS[s.concept];
    document.getElementById("concept-css").textContent = c.css;
    document.querySelectorAll("[data-concept-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.conceptTab === s.concept)));
    document.querySelectorAll("[data-screen-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.screenTab === s.screen)));
    document.querySelectorAll("[data-device]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.device === s.device)));
    document.getElementById("stage").className = "stage is-" + s.device;
    document.getElementById("idee").innerHTML = `<b>${K.esc(c.nom)}</b> — ${K.esc(c.idee)}`;
    s.view = s.screen === "nouvelle" ? "jour" : s.screen;
    const app = root();
    const keep = app.querySelector("[data-scroll]")?.scrollTop || 0;
    app.className = "app k-" + c.id;
    app.innerHTML = c.render(s) + (s.toast ? `<div class="k-toast" role="status">${K.esc(s.toast)}</div>` : "");
    const sc = app.querySelector("[data-scroll]"); if (sc && s.keepScroll) sc.scrollTop = keep;
    s.keepScroll = false;
    const f = app.querySelector("[data-autofocus]"); if (f && s.composer) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  }
  K.render = render;

  function go(screen, extra = {}) {
    const s = S();
    s.screen = screen; s.toast = "";
    s.composer = screen === "nouvelle";
    if (screen === "projet") { s.projectId = extra.project || s.projectId || "p-ctex6"; s.taskId = extra.task !== undefined ? extra.task : (extra.project ? null : "t2"); }
    else s.taskId = extra.task || null;
    render();
  }

  document.addEventListener("click", (e) => {
    const s = S();
    const el = e.target.closest("[data-concept-tab],[data-screen-tab],[data-device],[data-go],[data-task],[data-close],[data-done],[data-new],[data-habit],[data-cat],[data-reset],[data-toggle],[data-append]");
    if (!el) return;
    if (el.dataset.conceptTab) { s.concept = el.dataset.conceptTab; try { history.replaceState(null, "", "#" + s.concept); } catch (_) {} render(); return; }
    if (el.dataset.screenTab) { go(el.dataset.screenTab); return; }
    if (el.dataset.device) { s.device = el.dataset.device; render(); return; }
    if (el.dataset.reset !== undefined) { const c = s.concept, d = s.device; K.reset(); Object.assign(S(), { concept: c, device: d }); render(); return; }
    if (el.dataset.done) { e.stopPropagation(); const t = K.task(el.dataset.done); if (t) { t.statusId = K.isDone(t) ? "s3" : "s5"; s.toast = K.isDone(t) ? `« ${t.title} » terminée · Annuler` : `« ${t.title} » rouverte`; } s.keepScroll = true; render(); return; }
    if (el.dataset.habit) { e.stopPropagation(); const [g, i, d] = el.dataset.habit.split(":").map(Number); const h = s.habits[g].items[i]; if (h.max != null) h.value = Math.max(0, Math.min(h.max, (h.value || 0) + (d || 1))); else { if (s.habits[g].single) s.habits[g].items.forEach((x) => (x.done = false)); h.done = !h.done; } s.keepScroll = true; render(); return; }
    if (el.dataset.cat) { const [id, cat] = el.dataset.cat.split(":"); s.categorized[id] = cat; s.toast = `Opération classée dans « ${cat} » (démo)`; s.keepScroll = true; render(); return; }
    if (el.dataset.new !== undefined) { s.composer = true; s.taskId = null; render(); return; }
    if (el.dataset.close !== undefined) { s.composer = false; s.taskId = null; if (s.screen === "nouvelle") s.screen = "jour"; render(); return; }
    if (el.dataset.append) { s.draft = (s.draft.trim() + " " + el.dataset.append).trim(); s.composer = true; render(); return; }
    if (el.dataset.toggle) { s[el.dataset.toggle] = !s[el.dataset.toggle]; s.keepScroll = true; render(); return; }
    if (el.dataset.go) { e.preventDefault(); go(el.dataset.go, { project: el.dataset.project, task: el.dataset.task }); return; }
    if (el.dataset.task) { e.preventDefault(); s.taskId = el.dataset.task; s.composer = false; s.keepScroll = true; render(); return; }
  });

  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-draft]")) {
      S().draft = e.target.value;
      document.querySelectorAll("[data-preview]").forEach((p) => (p.innerHTML = K.previewHtml(S().draft)));
    }
  });
  document.addEventListener("submit", (e) => {
    if (!e.target.matches("[data-compose]")) return;
    e.preventDefault();
    const s = S();
    const hook = window.CONCEPTS[s.concept].onCompose;
    const handled = hook && hook(s.draft, s);
    if (handled) { s.composer = false; s.draft = ""; if (s.screen === "nouvelle") s.screen = "jour"; s.toast = handled; render(); return; }
    const t = K.createFromDraft(s.draft);
    if (!t) return;
    s.composer = false; s.draft = "";
    if (s.screen === "nouvelle") s.screen = "jour";
    s.toast = `Tâche « ${t.title} » créée dans ${K.project(t.projectId).name} (démo, rien n'est enregistré)`;
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (S().composer || S().taskId)) { S().composer = false; S().taskId = null; render(); }
  });

  function boot() {
    K.reset();
    const h = (location.hash || "").slice(1);
    if (ORDER.includes(h)) S().concept = h;
    if (window.matchMedia("(max-width: 720px)").matches) S().device = "mobile";
    document.getElementById("concept-tabs").innerHTML = ORDER.filter((id) => window.CONCEPTS[id]).map((id, i) => `<button type="button" data-concept-tab="${id}" aria-pressed="false"><span class="n">${i + 1}</span>${K.esc(window.CONCEPTS[id].nom)}</button>`).join("");
    document.getElementById("screen-tabs").innerHTML = SCREENS.map(([id, l]) => `<button type="button" data-screen-tab="${id}" aria-pressed="false">${l}</button>`).join("");
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
