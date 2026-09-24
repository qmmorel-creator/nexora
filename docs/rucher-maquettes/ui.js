/* Rucher — aides d'interface partagées par les maquettes. */
(function () {
  'use strict';
  var DAY = 864e5;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(ms) { return ms == null ? null : new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  var WORLD = { todo: 'Fleur ouverte · nectar disponible', doing: 'Ruchette · abeilles au travail', done: 'Pot de miel · compte dans la ruche', waiting: 'Fleur en bouton · en attente', info: 'Panneau · information' };
  var CRIT = { urgent: ['Urgent', '#DC2626'], moyen: ['Moyen', '#D97706'], bas: ['Bas', '#1FA971'] };

  function dueText(t) {
    if (t.end == null) return 'Sans échéance';
    var diff = Math.round((t.end - today()) / DAY);
    if (t.state === 'done') return 'Échéance ' + fmt(t.end);
    if (diff < 0) return 'En retard de ' + (-diff) + ' j';
    if (diff === 0) return 'Échéance aujourd’hui';
    return 'Échéance dans ' + diff + ' j';
  }

  function detailHTML(t, data, opts) {
    opts = opts || {};
    var p = data.projectById[t.projectId] || {};
    var crit = CRIT[t.criticality];
    var late = t.end != null && t.end < today() && t.state !== 'done' && t.state !== 'info';
    var ckDone = t.checklist.filter(function (c) { return c.done; }).length;
    var deps = t.dependsOn.map(function (id) { return data.taskById[id]; }).filter(Boolean);
    var dependents = data.tasks.filter(function (o) { return o.dependsOn.indexOf(t.id) !== -1; });
    var sec = t.secondaryProjectId && data.projectById[t.secondaryProjectId];
    var h = '';
    h += '<div class="rd-project"><span class="rd-dot" style="background:' + esc(p.color || '#999') + '"></span>' + esc(p.icon ? p.icon + ' ' : '') + esc(p.name || 'Sans projet') + (p.folderName ? ' <span class="rd-folder">· ' + esc(p.folderName) + '</span>' : '') + '</div>';
    h += '<h3 class="rd-title">' + (t.milestone ? '<span class="rd-ms" title="Jalon">◆</span> ' : '') + esc(t.title) + '</h3>';
    h += '<div class="rd-chips">';
    h += '<span class="rd-chip"><i style="background:' + esc(t.statusColor) + '"></i>' + esc(t.statusName) + '</span>';
    h += '<span class="rd-chip"><i style="background:' + esc(t.typeColor) + '"></i>' + esc(t.typeName) + '</span>';
    if (crit) h += '<span class="rd-chip rd-chip--crit" style="--c:' + crit[1] + '">Criticité ' + crit[0] + '</span>';
    h += '</div>';
    h += '<dl class="rd-grid">';
    h += '<dt>Dates</dt><dd>' + (t.start != null ? fmt(t.start) + ' → ' + fmt(t.end) : 'Non renseignées') + '</dd>';
    h += '<dt>Échéance</dt><dd class="' + (late ? 'is-late' : '') + '">' + dueText(t) + '</dd>';
    h += '<dt>Avancement</dt><dd><span class="rd-bar"><span style="width:' + Math.max(0, Math.min(100, t.progress)) + '%"></span></span> ' + t.progress + ' %</dd>';
    h += '<dt>Responsable</dt><dd>' + (t.assignee ? esc(t.assignee) : 'Non attribuée') + '</dd>';
    if (t.checklist.length) h += '<dt>Sous-tâches</dt><dd>' + ckDone + ' / ' + t.checklist.length + ' faites</dd>';
    if (sec) h += '<dt>Partagée avec</dt><dd><span class="rd-dot" style="background:' + esc(sec.color) + '"></span>' + esc(sec.name) + '</dd>';
    h += '</dl>';
    if (t.desc) h += '<p class="rd-desc">' + esc(t.desc.length > 280 ? t.desc.slice(0, 279) + '…' : t.desc) + '</p>';
    if (deps.length || dependents.length) {
      h += '<div class="rd-links">';
      deps.forEach(function (o) { h += '<button type="button" class="rd-link" data-go="' + esc(o.id) + '"><span class="rd-arrow rd-arrow--in">Attend</span>' + esc(o.title) + '</button>'; });
      dependents.forEach(function (o) { h += '<button type="button" class="rd-link" data-go="' + esc(o.id) + '"><span class="rd-arrow rd-arrow--out">Bloque</span>' + esc(o.title) + '</button>'; });
      h += '</div>';
    }
    h += '<p class="rd-world">Sur la carte : ' + WORLD[t.state] + '</p>';
    h += '<div class="rd-actions"><button type="button" class="rd-btn rd-btn--primary" data-open="' + esc(t.id) + '">Ouvrir la fiche Nexora</button>' +
      (opts.walk === false ? '' : '<button type="button" class="rd-btn" data-walk="' + esc(t.id) + '">Y aller</button>') + '</div>';
    return h;
  }

  function index(data) {
    data.projectById = {}; data.taskById = {};
    data.projects.forEach(function (p) { data.projectById[p.id] = p; });
    data.tasks.forEach(function (t) { data.taskById[t.id] = t; });
    return data;
  }

  // Filtres : statut (famille), criticité, retard, recherche texte.
  function makeFilter(f) {
    var t0 = today();
    return function (t) {
      if (f.states && !f.states[t.state]) return false;
      if (f.crit && f.crit !== 'all' && t.criticality !== f.crit) return false;
      if (f.late && !(t.end != null && t.end < t0 && t.state !== 'done' && t.state !== 'info')) return false;
      return true;
    };
  }

  function searchProjects(data, q) {
    q = String(q || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (!q) return [];
    return data.projects.filter(function (p) {
      return String(p.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
  }

  // Liste de secours sans WebGL : même contenu, sans 3D.
  function fallbackHTML(data) {
    var h = '<div class="rf"><p class="rf-lead"><strong>La carte 3D n’est pas disponible sur cet appareil</strong> (WebGL désactivé ou non pris en charge). Voici les mêmes territoires sous forme de liste.</p>';
    data.projects.forEach(function (p) {
      var ts = data.tasks.filter(function (t) { return t.projectId === p.id; });
      var done = ts.filter(function (t) { return t.state === 'done'; }).length;
      h += '<details class="rf-proj"><summary><span class="rd-dot" style="background:' + esc(p.color) + '"></span>' + esc(p.name) + ' <span class="rf-count">' + done + ' / ' + ts.length + ' terminées</span></summary><ul>';
      ts.forEach(function (t) { h += '<li><button type="button" data-open="' + esc(t.id) + '">' + esc(t.title) + '</button> <span>' + esc(t.statusName) + '</span></li>'; });
      h += '</ul></details>';
    });
    return h + '</div>';
  }

  function toast(host, msg) {
    var el = document.createElement('div');
    el.className = 'r-toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); }, 2600);
    setTimeout(function () { el.remove(); }, 3100);
  }

  // Manette tactile virtuelle.
  function joystick(el, engine) {
    var knob = el.querySelector('.r-joy-knob');
    var active = null;
    function set(e) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy, max = r.width / 2 - 10;
      var len = Math.hypot(dx, dy); if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      engine.setJoystick(dx / max, dy / max);
    }
    el.addEventListener('pointerdown', function (e) { active = e.pointerId; el.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
    el.addEventListener('pointermove', function (e) { if (active === e.pointerId) set(e); });
    function end() { active = null; knob.style.transform = ''; engine.setJoystick(0, 0); }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  window.RucherUI = { detailHTML: detailHTML, index: index, makeFilter: makeFilter, searchProjects: searchProjects, fallbackHTML: fallbackHTML, toast: toast, joystick: joystick, esc: esc, dueText: dueText, CRIT: CRIT };
})();
