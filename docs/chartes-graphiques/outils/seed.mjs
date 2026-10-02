// Jeu de démonstration enrichi — uniquement pour les captures (localStorage de l'origine locale).
import { readFileSync } from 'node:fs';
const base = JSON.parse(readFileSync(new URL('./donnees/seed-base.json', import.meta.url)));
const K = (k) => 'nexora-demo:v1:nexora:' + k;
const wrap = (k, v) => JSON.stringify({ key: 'nexora:' + k, value: JSON.stringify(v), updatedAt: '2026-10-02T07:00:00.000Z', revision: 'seed-' + k, source: 'demo', storageMode: 'inline', chunkCount: 0 });
let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const day = (off) => { const d = new Date(Date.UTC(2026, 9, 2 + off)); return d.toISOString().slice(0, 10); };
const folders = [
  { id: 'f-chantiers', name: 'Chantiers', color: '#3B6FD8' },
  { id: 'f-agence', name: 'Agence', color: '#8B5CF6' },
];
const projects = [
  { id: 'p1', name: 'Lot 2B — Gros œuvre', icon: '🏗️', color: '#8B5CF6', folderId: 'f-chantiers' },
  { id: 'p2', name: 'CTEX6', icon: '📄', color: '#D64545', folderId: 'f-chantiers' },
  { id: 'p4', name: 'Pont de Rives', icon: '🌉', color: '#0EA5E9', folderId: 'f-chantiers' },
  { id: 'p3', name: 'Communication', icon: '📣', color: '#F2A93B', folderId: 'f-agence' },
  { id: 'p5', name: 'Recrutement', icon: '🧑‍💼', color: '#22B07D', folderId: 'f-agence' },
  { id: 'p6', name: 'Système qualité', icon: '✅', color: '#64748B', folderId: 'f-agence' },
];
const statuses = [
  { id: 's1', name: 'À planifier', color: '#64748B', icon: null },
  { id: 's2', name: 'Attente tiers', color: '#8B5CF6', icon: null },
  { id: 's3', name: 'En cours', color: '#0EA5E9', icon: null },
  { id: 's4', name: 'Bloqué', color: '#E2483E', icon: null },
  { id: 's5', name: 'Terminé', color: '#22B07D', icon: null },
  { id: 's6', name: 'Information', color: '#64748B', icon: null },
];
const team = [
  { id: 'u1', name: 'Quentin', color: '#4F6AF5', avatarDataUrl: null },
  { id: 'u2', name: 'Maïa Sonnier', color: '#22B07D', avatarDataUrl: null },
  { id: 'u3', name: 'Vincent', color: '#F2A93B', avatarDataUrl: null },
  { id: 'u4', name: 'Anne-Laure Masson', color: '#D64545', avatarDataUrl: null },
  { id: 'u5', name: 'Karim Benali', color: '#0EA5E9', avatarDataUrl: null },
  { id: 'u6', name: 'Lucie Martin', color: '#8B5CF6', avatarDataUrl: null },
];
const T = [
  // [projet, titre, début, durée, statut, progression, assigné, jalon, type]
  ['p1', 'Revue DOE', -60, 75, 's3', 40], ['p1', 'Demande lame pour piste d\'accès', -48, 7, 's1', 10], ['p1', 'Réunion Expert', -14, 0, 's3', 0, 'u1', true, 'tt3'],
  ['p1', 'Coulage dalle niveau 2', -6, 12, 's3', 55, 'u3'], ['p1', 'Réception coffrages', 4, 3, 's1', 0, 'u3'], ['p1', 'Plan de récolement', 10, 18, 's1', 0, 'u2'],
  ['p1', 'Visite OPC', 7, 0, 's1', 0, 'u1', true, 'tt3'], ['p1', 'Levée des réserves', 22, 14, 's1', 0, 'u4'],
  ['p2', 'Documents FOR-0129', -81, 39, 's3', 67, 'u3'], ['p2', 'PV Contrôles DREAL', -62, 14, 's1', 0, 'u3'], ['p2', 'Mémoire technique', -10, 16, 's3', 70, 'u4'],
  ['p2', 'Dépôt dossier préfecture', 9, 0, 's1', 0, 'u4', true], ['p2', 'Analyse des offres', -3, 9, 's2', 30, 'u2'], ['p2', 'Note de calcul fondations', 2, 12, 's4', 20, 'u5'],
  ['p4', 'Étude géotechnique G2', -30, 25, 's5', 100, 'u5'], ['p4', 'Implantation des piles', -2, 10, 's3', 35, 'u5'], ['p4', 'Commande acier', 1, 5, 's2', 0, 'u3'],
  ['p4', 'Revue de conception', 12, 0, 's1', 0, 'u1', true, 'tt3'], ['p4', 'Essais de chargement', 30, 10, 's1', 0, 'u6'], ['p4', 'Dossier de consultation', -20, 18, 's3', 80, 'u6'],
  ['p3', 'Confirmer les personnes CNR aux PI', -14, 2, 's6', 0, 'u2'], ['p3', 'Deadline MAJ Octopus complète', -11, 0, 's1', 0, 'u2', true], ['p3', 'Plaquette institutionnelle', -4, 15, 's3', 45, 'u6'],
  ['p3', 'Newsletter octobre', 3, 4, 's1', 0, 'u2'], ['p3', 'Salon Bâtir 2026', 18, 2, 's1', 0, 'u1', true, 'tt2'], ['p3', 'Refonte du site', -25, 50, 's3', 30, 'u6'],
  ['p5', 'Fiche de poste conducteur', -9, 5, 's5', 100, 'u4'], ['p5', 'Entretiens candidats', 0, 8, 's3', 25, 'u4'], ['p5', 'Intégration nouvel arrivant', 15, 5, 's1', 0, 'u2'],
  ['p5', 'Point RH mensuel', 6, 0, 's1', 0, 'u1', true, 'tt3'],
  ['p6', 'Audit ISO 9001', 20, 2, 's1', 0, 'u1', true], ['p6', 'Mise à jour procédures', -15, 30, 's3', 50, 'u5'], ['p6', 'Revue de direction', -1, 0, 's4', 0, 'u1', true, 'tt3'],
  ['p6', 'Indicateurs qualité T3', -5, 6, 's2', 60, 'u6'], ['p6', 'Formation sécurité', 8, 1, 's1', 0, 'u3'],
];
const names = Object.fromEntries(team.map((u) => [u.id, u.name]));
const tasks = T.map(([pid, title, st, dur, sid, prog, uid, ms, tt], i) => ({
  id: 't' + (i + 1), projectId: pid, statusId: sid, title, desc: '', start: day(st), end: day(st + dur), progress: prog,
  milestone: !!ms, assignee: names[uid || ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'][i % 6]], taskTypeId: tt || (ms ? 'tt2' : 'tt1'),
  checklist: prog > 0 && !ms ? [{ id: 'c' + i + 'a', text: 'Préparer', done: true }, { id: 'c' + i + 'b', text: 'Valider', done: prog > 60 }, { id: 'c' + i + 'c', text: 'Diffuser', done: prog === 100 }] : [],
  priority: i % 5 === 0 ? 'high' : 'normal', lastInteraction: '2026-10-01T09:00:00.000Z',
}));
tasks.find((t) => t.title === 'Réception coffrages').dependsOn = [tasks.find((t) => t.title === 'Coulage dalle niveau 2').id];
tasks.find((t) => t.title === 'Levée des réserves').dependsOn = [tasks.find((t) => t.title === 'Réception coffrages').id];
tasks.find((t) => t.title === 'Essais de chargement').dependsOn = [tasks.find((t) => t.title === 'Implantation des piles').id];
tasks.find((t) => t.title === 'Implantation des piles').dependsOn = [tasks.find((t) => t.title === 'Commande acier').id];
tasks.find((t) => t.title === 'Dépôt dossier préfecture').dependsOn = [tasks.find((t) => t.title === 'Mémoire technique').id];
tasks[0].desc = 'Revue documentaire des ouvrages exécutés, lot par lot.';
const F = (o = {}) => ({ projectIds: [], statusIds: [], onlyLate: false, onlyMilestone: false, excludeDone: false, ...o });
const kpi = (id, title, filter, x, metric = 'count') => ({ id, type: 'customCard', title, cardColumns: 1, cardBlocks: [{ id: id + 'b', kind: 'aggregate', metric, emphasis: 'hero', showIcon: false, showLabel: false, label: '', icon: '', color: '', bgColor: '', accent: 'none' }], layout: { x, y: 0, w: 3, h: 2 }, filter });
const dashboards = [
  { id: 'd1', name: 'Pilotage', folderId: null, widgets: [
    kpi('k1', 'Tâches actives', F({ excludeDone: true }), 0), kpi('k2', 'En retard', F({ excludeDone: true, onlyLate: true }), 3),
    kpi('k3', 'Avancement moyen', F({ excludeDone: false }), 6, 'avgProgress'), kpi('k4', 'Jalons', F({ onlyMilestone: true }), 9),
    { id: 'w1', type: 'chart', title: 'Tâches par projet', groupBy: 'project', chartStyle: 'bar', layout: { x: 0, y: 2, w: 6, h: 5 }, filter: F({ excludeDone: true }) },
    { id: 'w2', type: 'chart', title: 'Répartition par statut', groupBy: 'status', chartStyle: 'pie', layout: { x: 6, y: 2, w: 6, h: 5 }, filter: F() },
    { id: 'w3', type: 'list', title: 'Prochaines échéances', sortBy: 'end', limit: 8, layout: { x: 0, y: 7, w: 6, h: 6 }, filter: F({ excludeDone: true }) },
    { id: 'w4', type: 'minigantt', title: 'Mini-Gantt — chantiers', layout: { x: 6, y: 7, w: 6, h: 6 }, filter: F({ projectIds: ['p1', 'p2', 'p4'], excludeDone: true }) },
  ] },
  { id: 'd2', name: 'Planning & équipe', folderId: null, widgets: [
    { id: 'w5', type: 'calendar', title: 'Calendrier', layout: { x: 0, y: 0, w: 6, h: 8 }, filter: F() },
    { id: 'w6', type: 'staffing', title: 'Charge personnel', staffingMembers: ['Quentin','Maïa Sonnier','Vincent','Anne-Laure Masson','Karim Benali','Lucie Martin'], layout: { x: 6, y: 0, w: 6, h: 8 }, filter: F() },
    { id: 'w7', type: 'heatmapMonth', title: 'Heat map mensuelle', layout: { x: 0, y: 8, w: 7, h: 6 }, filter: F() },
    { id: 'w8', type: 'criticalPath', title: 'Chemin critique', layout: { x: 7, y: 8, w: 5, h: 6 }, filter: F() },
  ] },
  { id: 'd3', name: 'Suivi & décisions', folderId: null, widgets: [
    { id: 'w9', type: 'nextBestAction', title: 'Priorité du moment', layout: { x: 0, y: 0, w: 4, h: 6 }, filter: F() },
    { id: 'w10', type: 'dominoEffect', dominoSortBy: 'directImpact', title: 'Tâches bloquantes', layout: { x: 4, y: 0, w: 4, h: 6 }, filter: F() },
    { id: 'w11', type: 'note', title: 'Note de chantier', content: '**Points à lever en réunion**\n\n- Accès piste sud\n- Livraison acier S41\n- Validation DOE lot 2B\n- Planning essais de chargement', layout: { x: 8, y: 0, w: 4, h: 6 } },
    { id: 'w12', type: 'projectTreemap', title: 'Treemap projets', layout: { x: 0, y: 6, w: 6, h: 7 }, filter: F() },
    { id: 'w13', type: 'bubbles', title: 'Bulles', layout: { x: 6, y: 6, w: 6, h: 7 }, filter: F() },
  ] },
];
export function seedEntries() {
  const o = { ...base };
  for (const k of Object.keys(o)) if (k.includes(':snapshot')) delete o[k];
  const put = (k, v) => (o[K(k)] = wrap(k, v));
  put('projects', projects); put('projectFolders', folders); put('statuses', statuses); put('teamMembers', team); put('tasks', tasks);
  put('dashboards', dashboards); put('activeDashboardId', 'd1'); put('onboardingSeen', true);
  return o;
}
