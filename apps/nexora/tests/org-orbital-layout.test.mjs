import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../.build/index.html', import.meta.url), 'utf8');
const block = (start, end) => {
  const a = html.indexOf(start), b = html.indexOf(end);
  assert.ok(a >= 0 && b > a, `${start} absent du build`);
  return html.slice(a + start.length, b);
};
const source = [
  'const STAFFING_COLOR_CHOICES = ["#64748B"];',
  block('// === NEXORA:TEAMS:START ===', '// === NEXORA:TEAMS:END ==='),
  block('// === NEXORA:ORGHIER-LAYOUT:START ===', '// === NEXORA:ORGHIER-LAYOUT:END ==='),
  block('// === NEXORA:ORG-ORBITAL:START ===', '// === NEXORA:ORG-ORBITAL:END ==='),
].join('\n');
const { buildOrgHierarchyTree, orgOrbitalMeasure, orgOrbitalLayout } = vm.runInThisContext(`(function(){${source};return {buildOrgHierarchyTree,orgOrbitalMeasure,orgOrbitalLayout}})()`);
const team = (id, extra = {}) => ({ id, name: `Équipe ${id}`, ...extra });
const member = (name, ids = [], extra = {}) => ({ name, teamIds: ids, ...extra });
const layout = (teams, people) => orgOrbitalLayout(buildOrgHierarchyTree(teams, people), teams);
const noOverlaps = (l) => {
  const p = l.placed;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    assert.ok(Math.abs(p[i].x - p[j].x) >= (p[i].w + p[j].w) / 2 || Math.abs(p[i].y - p[j].y) >= (p[i].h + p[j].h) / 2, `orbites ${i} et ${j} se chevauchent`);
  }
};

test('taille dictée par le nombre de personnes et la largeur des sous-arbres', () => {
  const small = layout([team('a')], [member('Alice', ['a'])]).placed[0];
  const large = layout([team('a')], Array.from({ length: 20 }, (_, i) => member(`Membre ${i}`, ['a']))).placed[0];
  const nested = layout([team('a'), team('b', { parentTeamId: 'a' })], [member('Alice', ['a'])]).placed[0];
  assert.ok(large.w > small.w);
  assert.ok(nested.w > small.w);
  assert.equal(nested.teams[0].node.team.id, 'b');
});

test('hiérarchie récursive profonde et manager utilisateur gardés distincts', () => {
  const teams = [team('a'), team('b', { parentTeamId: 'a' }), team('c', { parentTeamId: 'b' }), team('d', { parentTeamId: 'c' })];
  const people = [member('Alice', ['d']), member('Bob', ['d'], { managerName: 'Alice' }), member('Carl', ['d'], { managerName: 'Bob' })];
  const m = layout(teams, people).placed[0];
  assert.equal(m.teams[0].teams[0].teams[0].node.team.id, 'd');
  assert.deepEqual(m.teams[0].teams[0].teams[0].people.map((p) => p.depth), [0, 1, 2]);
  assert.equal(m.teams[0].teams[0].teams[0].teams.length, 0);
});

test('manager cyclique ne boucle pas ; utilisateur multi-équipe sans descendance secondaire', () => {
  const teams = [team('a'), team('b')];
  const cyclic = layout(teams, [member('Alice', ['a', 'b'], { managerName: 'Bob' }), member('Bob', ['a'], { managerName: 'Alice' })]);
  assert.equal(cyclic.placed.length, 2);
  const normal = layout(teams, [member('Alice', ['a', 'b']), member('Bob', ['a'], { managerName: 'Alice' })]);
  assert.equal(normal.placed[0].people.length, 2);
  assert.equal(normal.placed[1].people.length, 1);
  assert.equal(normal.placed[1].people[0].depth, 0);
});

test('transverses indépendantes et côtés conservés', () => {
  const teams = [team('a'), team('b'), team('left', { parentTeamId: 'a', parentLinkType: 'transverse', transverseSide: 'left' }), team('right', { parentTeamId: 'a', parentLinkType: 'transverse', transverseSide: 'right' })];
  const l = layout(teams, []);
  assert.equal(l.links.length, 2);
  assert.deepEqual(l.links.map((x) => x.side), ['left', 'right']);
  assert.ok(l.placed.filter((p) => p.transverse).every((p) => p.y > l.placed.filter((q) => !q.transverse).reduce((max, q) => Math.max(max, q.y), 0)));
  noOverlaps(l);
});

test('packing déterministe sans chevauchement de 2 à 30 équipes', () => {
  for (const size of [2, 4, 8, 15, 30]) {
    const teams = Array.from({ length: size }, (_, i) => team(String(i)));
    const people = Array.from({ length: size * 5 }, (_, i) => member(`Personne ${i}`, [String(Math.floor(i / 5))]));
    const a = layout(teams, people), b = layout(teams, people);
    assert.deepEqual(a.placed.map((p) => [p.x, p.y, p.w, p.h]), b.placed.map((p) => [p.x, p.y, p.w, p.h]));
    noOverlaps(a);
    assert.ok(a.width > 0 && a.height > 0);
  }
});
