/* DONNÉES FICTIVES — maquettes du Rucher uniquement (Ref #361).
 * Même forme que les enregistrements Nexora (statusId, taskTypeId, criticality, dependsOn…),
 * contenus inventés. Aucune donnée réelle.
 */
(function () {
  'use strict';
  var DAY = 864e5;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  function d(n) { var x = new Date(today.getTime() + n * DAY); return x.toISOString().slice(0, 10); }

  var statuses = [
    { id: 's1', name: 'À planifier', color: '#64748B' },
    { id: 's2', name: 'Attente tiers', color: '#8B5CF6' },
    { id: 's3', name: 'En cours', color: '#0EA5E9' },
    { id: 's5', name: 'Terminé', color: '#22B07D' },
    { id: 's6', name: 'Information', color: '#64748B' }
  ];
  var taskTypes = [
    { id: 'tt1', name: 'Tâches', color: '#4F6AF5' },
    { id: 'tt2', name: 'Planning', color: '#F2A93B' },
    { id: 'tt3', name: 'Réunions', color: '#8B5CF6' },
    { id: 'tt4', name: 'Information', color: '#64748B' }
  ];
  var folders = [
    { id: 'f-chantiers', name: 'Chantiers', color: '#E07A3F' },
    { id: 'f-qme', name: 'Ingénierie', color: '#245EDB' },
    { id: 'f-perso', name: 'Perso', color: '#2A9D8F' },
    { id: 'folder-a-trier', name: 'À trier', color: '#94A3B8' }
  ];
  var projects = [
    { id: 'p-lot2b', name: 'Lot 2B — Gros œuvre', icon: '🏗️', color: '#E07A3F', folderId: 'f-chantiers', priority: 'high', createdAt: 1 },
    { id: 'p-ecole', name: 'Réhabilitation école', icon: '🏫', color: '#C2410C', folderId: 'f-chantiers', priority: 'normal', createdAt: 2 },
    { id: 'p-passerelle', name: 'Passerelle quai Nord', icon: '🌉', color: '#B45309', folderId: 'f-chantiers', priority: 'normal', createdAt: 3 },
    { id: 'p-audit', name: 'Audit structure halle', icon: '🔎', color: '#245EDB', folderId: 'f-qme', priority: 'high', createdAt: 4 },
    { id: 'p-devis', name: 'Devis & facturation', icon: '🧾', color: '#4F6AF5', folderId: 'f-qme', priority: 'normal', createdAt: 5 },
    { id: 'p-rucher', name: 'Ruches du jardin', icon: '🐝', color: '#E0A21A', folderId: 'f-perso', priority: 'normal', createdAt: 6 },
    { id: 'p-gr20', name: 'Randonnée GR20', icon: '🥾', color: '#2A9D8F', folderId: 'f-perso', priority: 'low', createdAt: 7 },
    { id: 'p-idees', name: 'Idées en vrac', icon: '💡', color: '#8B5CF6', folderId: 'folder-a-trier', priority: 'low', createdAt: 8 }
  ];
  var people = ['Camille', 'Léo', 'Inès', 'Hugo', null];
  var T = [];
  var n = 0;
  function t(projectId, title, statusId, o) {
    o = o || {};
    n++;
    var start = o.start != null ? o.start : -10 + (n * 7) % 20;
    var end = o.end != null ? o.end : start + 2 + (n % 9);
    T.push({
      id: o.id || 'fx-' + n, projectId: projectId, title: title, statusId: statusId,
      taskTypeId: o.type || 'tt1', criticality: o.crit === undefined ? [null, 'bas', 'moyen', null, 'urgent', null, 'bas'][n % 7] : o.crit,
      milestone: !!o.ms, start: o.noDate ? null : d(start), end: o.noDate ? null : d(end),
      progress: o.progress != null ? o.progress : statusId === 's3' ? 20 + (n * 13) % 70 : statusId === 's5' ? 100 : 0,
      assignee: o.who !== undefined ? o.who : people[n % people.length],
      desc: o.desc || '', dependsOn: o.deps || [], secondaryProjectId: o.sec || null,
      checklist: o.ck || [], createdAt: n
    });
  }
  // Lot 2B
  t('p-lot2b', 'Coulage dalle niveau R+1', 's3', { id: 'fx-dalle', crit: 'urgent', start: -4, end: 2, desc: 'Coulage prévu en deux passes. Vérifier la météo la veille.', ck: [{ text: 'Réservations posées', done: true }, { text: 'Béton commandé', done: true }, { text: 'Contrôle ferraillage', done: false }] });
  t('p-lot2b', 'Contrôle ferraillage par le BET', 's5', { id: 'fx-ferr', start: -9, end: -6 });
  t('p-lot2b', 'Réception des réservations', 's5', { start: -14, end: -12 });
  t('p-lot2b', 'Commande grue mobile', 's2', { crit: 'moyen', start: -2, end: 5, desc: 'En attente du retour du loueur.' });
  t('p-lot2b', 'Réunion de chantier hebdo', 's1', { type: 'tt3', start: 1, end: 1, crit: null });
  t('p-lot2b', 'Jalon : hors d’eau hors d’air', 's1', { ms: true, type: 'tt2', start: 30, end: 30, deps: ['fx-dalle'], crit: 'urgent' });
  t('p-lot2b', 'Planning recalé semaine 42', 's1', { type: 'tt2', start: 3, end: 8 });
  t('p-lot2b', 'PV de réception fondations', 's5', { start: -30, end: -28 });
  t('p-lot2b', 'Relancer le géomètre', 's1', { start: -12, end: -3, crit: 'moyen' });
  t('p-lot2b', 'Consignes sécurité levage', 's6', { type: 'tt4', crit: null });
  t('p-lot2b', 'Chiffrage avenant n°2', 's3', { crit: 'moyen', sec: 'p-devis' });
  for (var i = 0; i < 9; i++) t('p-lot2b', 'Point d’arrêt ' + (i + 1), i % 3 === 0 ? 's5' : 's1', { start: i * 3 - 6 });
  // École
  t('p-ecole', 'Diagnostic amiante', 's5', { start: -40, end: -35 });
  t('p-ecole', 'Dossier de consultation', 's3', { id: 'fx-dce', crit: 'urgent', start: -6, end: 4 });
  t('p-ecole', 'Visite avec la mairie', 's1', { type: 'tt3', start: 6, end: 6 });
  t('p-ecole', 'Analyse des offres', 's1', { deps: ['fx-dce'], start: 12, end: 20 });
  t('p-ecole', 'Attente avis ABF', 's2', { start: -8, end: 10 });
  t('p-ecole', 'Jalon : notification des marchés', 's1', { ms: true, start: 40, end: 40 });
  for (var j = 0; j < 6; j++) t('p-ecole', 'Relevé salle ' + (101 + j), j < 4 ? 's5' : 's1');
  // Passerelle
  t('p-passerelle', 'Note de calcul platelage', 's3', { id: 'fx-plat', start: -3, end: 9 });
  t('p-passerelle', 'Essais de charge', 's1', { deps: ['fx-plat'], start: 15, end: 16, crit: 'urgent' });
  t('p-passerelle', 'Retour bureau de contrôle', 's2', { start: -5, end: -1 });
  t('p-passerelle', 'Choix du garde-corps', 's5');
  t('p-passerelle', 'Réunion riverains', 's1', { type: 'tt3', start: 9, end: 9 });
  // Audit
  t('p-audit', 'Visite de la halle', 's5', { start: -20, end: -20, type: 'tt3' });
  t('p-audit', 'Sondages des pannes', 's3', { id: 'fx-sond', start: -7, end: 3, crit: 'moyen' });
  t('p-audit', 'Rapport d’audit', 's1', { deps: ['fx-sond'], start: 4, end: 14, crit: 'urgent', sec: 'p-devis' });
  t('p-audit', 'Photos et relevés', 's5');
  t('p-audit', 'Hypothèses de charge neige', 's6', { type: 'tt4' });
  t('p-audit', 'Jalon : remise du rapport', 's1', { ms: true, start: 14, end: 14, deps: ['fx-sond'] });
  // Devis
  t('p-devis', 'Devis mission halle', 's5', { start: -25, end: -22 });
  t('p-devis', 'Facture acompte audit', 's3', { crit: 'moyen' });
  t('p-devis', 'Relance facture mars', 's1', { start: -20, end: -9, crit: 'urgent' });
  t('p-devis', 'Mettre à jour les tarifs 2027', 's1', { start: 20, end: 40, crit: 'bas' });
  for (var k = 0; k < 5; k++) t('p-devis', 'Facture n°' + (240 + k), 's5');
  // Rucher
  t('p-rucher', 'Visite de printemps', 's5', { start: -60, end: -60 });
  t('p-rucher', 'Commander des cadres', 's1', { crit: 'bas', start: 2, end: 10 });
  t('p-rucher', 'Traitement varroa', 's3', { crit: 'urgent', start: -2, end: 6 });
  t('p-rucher', 'Récolte d’automne', 's1', { start: 10, end: 12 });
  t('p-rucher', 'Nourrissement hivernal', 's1', { start: 25, end: 40 });
  // GR20
  t('p-gr20', 'Réserver les refuges', 's2', { start: -3, end: 7 });
  t('p-gr20', 'Liste de matériel', 's3');
  t('p-gr20', 'Billets de ferry', 's1', { start: 5, end: 12 });
  // Idées
  t('p-idees', 'Tester une vue carte des projets', 's1', { noDate: true, crit: null, who: null });
  t('p-idees', 'Lire « L’abeille et le philosophe »', 's1', { noDate: true, who: null });
  t('p-idees', 'Atelier compost partagé', 's2', { noDate: true });

  window.RUCHER_DEMO = { statuses: statuses, taskTypes: taskTypes, folders: folders, projects: projects, tasks: T };

  // ---- Normalisation Nexora → monde (même logique que la version finale) ----
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function stateOf(task, statusById, typeById) {
    var st = statusById[task.statusId];
    var ty = typeById[task.taskTypeId];
    var name = norm(st && st.name);
    if (/termin/.test(name)) return 'done';
    if ((ty && norm(ty.name) === 'information') || /information/.test(name)) return 'info';
    if (/en\s*cours/.test(name)) return 'doing';
    if (/attente/.test(name)) return 'waiting';
    return 'todo';
  }
  function kindOf(task, typeById) {
    var ty = typeById[task.taskTypeId];
    var n2 = norm(ty && ty.name);
    if (n2 === 'reunion' || n2 === 'reunions') return 'meeting';
    if (n2 === 'planning') return 'planning';
    if (n2 === 'information') return 'info';
    return 'task';
  }
  function toMs(isoDate) { if (!isoDate) return null; var p = isoDate.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
  window.RucherNormalize = function (raw) {
    var statusById = {}, typeById = {}, folderById = {};
    raw.statuses.forEach(function (s) { statusById[s.id] = s; });
    raw.taskTypes.forEach(function (s) { typeById[s.id] = s; });
    raw.folders.forEach(function (f) { folderById[f.id] = f; });
    var projects = raw.projects.map(function (p) {
      return { id: p.id, name: p.name, icon: p.icon, color: p.color, priority: p.priority || 'normal', createdAt: p.createdAt,
        group: p.folderId && p.folderId !== 'folder-a-trier' ? p.folderId : null, folderId: p.folderId,
        folderName: folderById[p.folderId] ? folderById[p.folderId].name : '' };
    });
    var t0 = today.getTime();
    var tasks = raw.tasks.map(function (t) {
      var state = stateOf(t, statusById, typeById);
      var start = toMs(t.start), end = toMs(t.end);
      return {
        id: t.id, projectId: t.projectId, title: t.title, state: state, statusId: t.statusId,
        statusName: statusById[t.statusId] ? statusById[t.statusId].name : 'Sans statut',
        statusColor: statusById[t.statusId] ? statusById[t.statusId].color : '#94A3B8',
        typeName: typeById[t.taskTypeId] ? typeById[t.taskTypeId].name : 'Sans type',
        typeColor: typeById[t.taskTypeId] ? typeById[t.taskTypeId].color : '#94A3B8',
        kind: kindOf(t, typeById), milestone: !!t.milestone, criticality: t.criticality || null,
        start: start, end: end, startIso: t.start, endIso: t.end,
        future: state === 'todo' && start != null && start > t0,
        progress: t.progress || 0, assignee: t.assignee || null, desc: t.desc || '',
        checklist: t.checklist || [], dependsOn: t.dependsOn || [], secondaryProjectId: t.secondaryProjectId || null,
        createdAt: t.createdAt
      };
    });
    return { projects: projects, tasks: tasks };
  };

  // Volume de test : N projets fictifs × M tâches (pour éprouver les performances).
  window.RucherStress = function (np, per) {
    var raw = { statuses: statuses, taskTypes: taskTypes, folders: folders, projects: [], tasks: [] };
    var cols = ['#E07A3F', '#245EDB', '#2A9D8F', '#8B5CF6', '#E0A21A', '#C2410C', '#4F6AF5', '#0EA5E9'];
    for (var a = 0; a < np; a++) {
      raw.projects.push({ id: 'sx-' + a, name: 'Projet fictif ' + (a + 1), color: cols[a % cols.length], folderId: 'f-' + (a % 12), priority: 'normal', createdAt: a });
      for (var b = 0; b < per; b++) {
        var z = a * per + b;
        raw.tasks.push({ id: 'st-' + z, projectId: 'sx-' + a, title: 'Tâche fictive ' + (b + 1), statusId: ['s1', 's3', 's5', 's2', 's5'][z % 5], taskTypeId: 'tt1', criticality: [null, 'bas', 'moyen', 'urgent'][z % 4], start: d(-10 + z % 30), end: d(-5 + z % 40), createdAt: z });
      }
    }
    raw.folders = raw.folders.concat(Array.from({ length: 12 }, function (_, i) { return { id: 'f-' + i, name: 'Dossier ' + (i + 1) }; }));
    return window.RucherNormalize(raw);
  };
})();
