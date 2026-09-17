import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

/* Widget « Charge personnel » (#124). Comme les autres suites, les fonctions
   testées sont extraites de l'interface RÉELLEMENT construite
   (`.build/index.html`, reconstruit par `npm run build` juste avant
   `npm test`), entre les sentinelles de leur bloc. Aucune copie du code n'est
   maintenue à côté : si le bloc change, ces tests suivent.

   Le bloc du widget appelle `iso`, `addDays` et `normalizeForMatch` — les
   briques de date et de comparaison de texte de tout Nexora. Elles sont
   extraites AVEC lui, et exécutées dans la même portée : les éprouver contre
   des copies écrites ici reviendrait à tester deux calendriers différents. */
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function sourceOf(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${start} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

const EXPORTS = [
  "WORKSHOP_SEED", "normalizeWorkshops", "workshopFor", "workshopCode",
  "staffingCellId", "normalizeStaffingEntries", "staffingByCell", "staffingCellWorkshops",
  "staffingSetCell", "staffingWorkshopUsage",
  "STAFFING_RANGES", "STAFFING_DEFAULTS", "STAFFING_MAX_BANDS",
  "normalizeStaffingRange", "normalizeStaffingOffset", "normalizeStaffingWidget",
  "staffingVisibleMembers", "staffingWindow", "staffingDays", "staffingBands",
  "staffingMemberLoad", "staffingDayCount", "staffingPickerGroups",
];

const {
  WORKSHOP_SEED, normalizeWorkshops, workshopFor, workshopCode,
  staffingCellId, normalizeStaffingEntries, staffingByCell, staffingCellWorkshops,
  staffingSetCell, staffingWorkshopUsage,
  STAFFING_RANGES, STAFFING_DEFAULTS, STAFFING_MAX_BANDS,
  normalizeStaffingRange, normalizeStaffingOffset, normalizeStaffingWidget,
  staffingVisibleMembers, staffingWindow, staffingDays, staffingBands,
  staffingMemberLoad, staffingDayCount, staffingPickerGroups,
} = vm.runInThisContext(
  `(function () {\n`
  + sourceOf("// === NEXORA:DATE-UTILS:START ===", "// === NEXORA:DATE-UTILS:END ===")
  + `\n`
  + sourceOf("// === NEXORA:TEXT-MATCH:START ===", "// === NEXORA:TEXT-MATCH:END ===")
  + `\n`
  + sourceOf("// === NEXORA:STAFFING:START ===", "// === NEXORA:STAFFING:END ===")
  + `\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const WS = WORKSHOP_SEED.map((w) => w.id); // usine, bureau, chantier, atelier, formation, absence
const [USINE, BUREAU, CHANTIER, ATELIER, FORMATION, ABSENCE] = WS;

// --- Catalogue d'ateliers ---------------------------------------------------

test("le catalogue refuse les entrées sans nom, dédoublonne, et n'est jamais vide", () => {
  assert.deepEqual(normalizeWorkshops([]).map((w) => w.id), WS);
  assert.deepEqual(normalizeWorkshops(null).map((w) => w.id), WS);
  // Sans nom, sans identifiant : ce n'est pas un atelier.
  assert.deepEqual(normalizeWorkshops([{ id: "a" }, { name: "Quai" }]).map((w) => w.id), WS);
  // Deux fois le même identifiant : la première entrée gagne.
  const doublon = normalizeWorkshops([
    { id: "x", name: "Quai", color: "#123456" },
    { id: "x", name: "Quai bis", color: "#654321" },
  ]);
  assert.equal(doublon.length, 1);
  assert.equal(doublon[0].name, "Quai");
  // Une couleur absurde retombe sur celle du premier atelier de départ.
  assert.equal(normalizeWorkshops([{ id: "x", name: "Quai", color: "bleu" }])[0].color, WORKSHOP_SEED[0].color);
  assert.equal(normalizeWorkshops([{ id: "x", name: "  Quai  " }])[0].name, "Quai");
});

test("un atelier inconnu ne retombe sur RIEN", () => {
  /* C'est la différence avec un type de jalon, qui prend le premier du
     catalogue pour que le repère reste visible. Ici, un atelier supprimé doit
     disparaître des jours où il était posé : le remplacer silencieusement par
     « Usine » écrirait une affectation que personne n'a demandée. */
  assert.equal(workshopFor(WORKSHOP_SEED, "ws-inexistant"), null);
  assert.equal(workshopFor(WORKSHOP_SEED, USINE).name, "Usine");
});

test("le code court d'un atelier vient de son nom, sans accent", () => {
  assert.equal(workshopCode("Usine"), "US");
  assert.equal(workshopCode("Étude"), "ET");
  assert.equal(workshopCode("chantier"), "CH");
  assert.equal(workshopCode("  "), "··");
  assert.equal(workshopCode("3D"), "3D");
});

// --- Affectations -----------------------------------------------------------

test("l'identifiant d'une case est DÉRIVÉ de la personne et du jour", () => {
  /* Deux sessions qui affectent la même case produisent alors la même entrée,
     que la fusion traite comme une seule. Un identifiant aléatoire aurait
     fabriqué deux affectations concurrentes pour un seul jour. */
  assert.equal(staffingCellId("Maïa", "2026-09-16"), "Maïa|2026-09-16");
  assert.equal(staffingCellId("  Maïa  ", " 2026-09-16 "), "Maïa|2026-09-16");
});

test("une case vide n'est pas une donnée : elle n'est pas écrite", () => {
  const entries = normalizeStaffingEntries([
    { member: "Maïa", date: "2026-09-16", workshops: [BUREAU, USINE] },
    { member: "Maïa", date: "2026-09-17", workshops: [] },
    { member: "Vincent", date: "2026-09-16", workshops: [CHANTIER] },
  ]);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.member), ["Maïa", "Vincent"]);
});

test("la normalisation écarte ce qui n'est pas une affectation", () => {
  const entries = normalizeStaffingEntries([
    null,
    "texte",
    { member: "", date: "2026-09-16", workshops: [USINE] },
    { member: "Léa", date: "16/09/2026", workshops: [USINE] },
    { member: "Léa", date: "2026-09-16", workshops: [USINE, USINE, "", null] },
  ]);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].workshops, [USINE], "les doublons et les vides sont retirés");
});

test("un atelier supprimé quitte les affectations à la normalisation", () => {
  const brut = [{ member: "Léa", date: "2026-09-16", workshops: [USINE, "ws-supprime"] }];
  assert.deepEqual(normalizeStaffingEntries(brut, WS)[0].workshops, [USINE]);
  // Une case qui ne gardait QUE l'atelier supprimé disparaît entièrement.
  const seul = [{ member: "Léa", date: "2026-09-16", workshops: ["ws-supprime"] }];
  assert.deepEqual(normalizeStaffingEntries(seul, WS), []);
  // Sans catalogue passé, rien n'est filtré : la lecture ne perd pas de données
  // parce qu'un catalogue n'était pas encore chargé.
  assert.equal(normalizeStaffingEntries(seul).length, 1);
});

test("écrire une case remplace, et une liste vide efface", () => {
  let entries = [];
  entries = staffingSetCell(entries, "Maïa", "2026-09-16", [BUREAU], WS);
  assert.deepEqual(staffingCellWorkshops(entries, "Maïa", "2026-09-16"), [BUREAU]);
  entries = staffingSetCell(entries, "Maïa", "2026-09-16", [BUREAU, USINE], WS);
  assert.deepEqual(staffingCellWorkshops(entries, "Maïa", "2026-09-16"), [BUREAU, USINE]);
  assert.equal(entries.length, 1, "la case est remplacée, pas ajoutée une seconde fois");
  entries = staffingSetCell(entries, "Maïa", "2026-09-16", [], WS);
  assert.deepEqual(entries, [], "« tout retirer » n'a laissé aucune coquille");
});

test("les affectations sont triées par jour puis par personne", () => {
  const entries = normalizeStaffingEntries([
    { member: "Vincent", date: "2026-09-17", workshops: [CHANTIER] },
    { member: "Anne", date: "2026-09-16", workshops: [BUREAU] },
    { member: "Maïa", date: "2026-09-16", workshops: [USINE] },
  ]);
  assert.deepEqual(entries.map((e) => e.member + "@" + e.date), [
    "Anne@2026-09-16", "Maïa@2026-09-16", "Vincent@2026-09-17",
  ]);
});

test("le nombre de jours d'un atelier est ce que chiffre la suppression", () => {
  const entries = [
    { member: "Maïa", date: "2026-09-16", workshops: [BUREAU, USINE] },
    { member: "Maïa", date: "2026-09-17", workshops: [BUREAU] },
    { member: "Léa", date: "2026-09-17", workshops: [CHANTIER] },
  ];
  assert.equal(staffingWorkshopUsage(entries, BUREAU), 2);
  assert.equal(staffingWorkshopUsage(entries, USINE), 1);
  assert.equal(staffingWorkshopUsage(entries, FORMATION), 0);
});

// --- Fenêtre affichée --------------------------------------------------------

test("la granularité par défaut est le MOIS", () => {
  assert.deepEqual(STAFFING_RANGES, ["month", "twoWeeks", "week"]);
  assert.equal(STAFFING_DEFAULTS.staffingRange, "month");
  assert.equal(normalizeStaffingRange(undefined), "month");
  assert.equal(normalizeStaffingRange("trimestre"), "month");
  assert.equal(normalizeStaffingRange("week"), "week");
  assert.equal(normalizeStaffingWidget({}).staffingRange, "month");
});

test("un mois est un MOIS, pas trente jours", () => {
  // Le décalage se compte en périodes : « mois suivant » doit tomber sur le
  // mois suivant, quelle que soit sa longueur.
  assert.deepEqual(staffingWindow("month", 0, "2026-09-17"), { start: "2026-09-01", end: "2026-09-30" });
  assert.deepEqual(staffingWindow("month", 1, "2026-09-17"), { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(staffingWindow("month", -1, "2026-09-17"), { start: "2026-08-01", end: "2026-08-31" });
  // Février bissextile, et le passage d'année.
  assert.deepEqual(staffingWindow("month", 0, "2028-02-10"), { start: "2028-02-01", end: "2028-02-29" });
  assert.deepEqual(staffingWindow("month", 1, "2026-12-05"), { start: "2027-01-01", end: "2027-01-31" });
});

test("une semaine commence le lundi, et deux semaines en font quatorze", () => {
  // 2026-09-17 est un jeudi.
  assert.deepEqual(staffingWindow("week", 0, "2026-09-17"), { start: "2026-09-14", end: "2026-09-20" });
  assert.deepEqual(staffingWindow("week", 1, "2026-09-17"), { start: "2026-09-21", end: "2026-09-27" });
  assert.deepEqual(staffingWindow("week", -1, "2026-09-17"), { start: "2026-09-07", end: "2026-09-13" });
  // Un dimanche appartient à la semaine qui le PRÉCÈDE, pas à la suivante.
  assert.deepEqual(staffingWindow("week", 0, "2026-09-20"), { start: "2026-09-14", end: "2026-09-20" });
  assert.deepEqual(staffingWindow("twoWeeks", 0, "2026-09-17"), { start: "2026-09-14", end: "2026-09-27" });
  assert.deepEqual(staffingWindow("twoWeeks", 1, "2026-09-17"), { start: "2026-09-28", end: "2026-10-11" });
});

test("la navigation est bornée, et une valeur absurde ne déplace rien", () => {
  assert.equal(normalizeStaffingOffset(undefined), 0);
  assert.equal(normalizeStaffingOffset("plus tard"), 0);
  assert.equal(normalizeStaffingOffset(999), 24);
  assert.equal(normalizeStaffingOffset(-999), -24);
  assert.equal(normalizeStaffingOffset(2.4), 2);
});

test("les colonnes portent le jour de la semaine, le week-end et aujourd'hui", () => {
  const days = staffingDays({ start: "2026-09-14", end: "2026-09-20" }, "2026-09-17");
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((d) => d.dow), [0, 1, 2, 3, 4, 5, 6], "lundi vaut 0");
  assert.deepEqual(days.filter((d) => d.weekend).map((d) => d.iso), ["2026-09-19", "2026-09-20"]);
  assert.equal(days.filter((d) => d.today).length, 1);
  assert.equal(days.find((d) => d.today).iso, "2026-09-17");
  assert.deepEqual(days.map((d) => d.num), ["14", "15", "16", "17", "18", "19", "20"]);
});

test("masquer les week-ends retire les colonnes, jamais les affectations", () => {
  const days = staffingDays({ start: "2026-09-14", end: "2026-09-20" }, "2026-09-17", { showWeekends: false });
  assert.equal(days.length, 5);
  assert.ok(days.every((d) => !d.weekend));
  // Le magasin d'affectations, lui, n'est pas touché : c'est une option
  // d'affichage, et une affectation de samedi survit à son masquage.
  const entries = staffingSetCell([], "Vincent", "2026-09-19", [CHANTIER], WS);
  assert.deepEqual(staffingCellWorkshops(entries, "Vincent", "2026-09-19"), [CHANTIER]);
});

test("une fenêtre sans dates valables ne fabrique aucune colonne", () => {
  assert.deepEqual(staffingDays(null, "2026-09-17"), []);
  assert.deepEqual(staffingDays({ start: "hier", end: "2026-09-20" }, "2026-09-17"), []);
});

// --- Ce que dessine une case -------------------------------------------------

test("les ateliers d'un jour se partagent la case, trois au plus", () => {
  assert.equal(STAFFING_MAX_BANDS, 3);
  const trois = staffingBands([USINE, BUREAU, CHANTIER], WORKSHOP_SEED, { cellPx: 120 });
  assert.equal(trois.length, 3);
  assert.ok(trois.every((b) => !b.more));
  // Au-delà : deux bandes, et la dernière compte le reste.
  const cinq = staffingBands([USINE, BUREAU, CHANTIER, ATELIER, FORMATION], WORKSHOP_SEED, { cellPx: 120 });
  assert.equal(cinq.length, 3);
  assert.deepEqual(cinq.map((b) => b.more), [false, false, true]);
  assert.equal(cinq[2].label, "+3");
  /* En vue mois, le compte se tait comme les autres : « +3 » coupé en « +; »
     est pire que rien. La bande reste, elle — c'est elle qui montre qu'il y a
     plus — et l'infobulle donne la liste complète. */
  const serre = staffingBands([USINE, BUREAU, CHANTIER, ATELIER, FORMATION], WORKSHOP_SEED, { cellPx: 20 });
  assert.equal(serre.length, 3);
  assert.equal(serre[2].more, true);
  assert.equal(serre[2].label, "");
});

test("une bande ne porte un texte que si elle a la place", () => {
  // Une case large et un seul atelier : le nom en entier.
  assert.equal(staffingBands([CHANTIER], WORKSHOP_SEED, { cellPx: 118 })[0].label, "Chantier");
  // Plus étroite : le code court.
  assert.equal(staffingBands([CHANTIER], WORKSHOP_SEED, { cellPx: 40 })[0].label, "CH");
  // Deux ateliers dans 40 px : 20 px chacun, plus de place pour rien.
  assert.deepEqual(staffingBands([CHANTIER, USINE], WORKSHOP_SEED, { cellPx: 40 }).map((b) => b.label), ["", ""]);
  // Vue mois, colonnes de 16 px : la couleur seule, et l'infobulle prend le relais.
  assert.equal(staffingBands([CHANTIER], WORKSHOP_SEED, { cellPx: 16 })[0].label, "");
  // Sans mesure de piste (premier rendu), on n'invente pas de texte.
  assert.equal(staffingBands([CHANTIER], WORKSHOP_SEED, {})[0].label, "");
});

test("un atelier inconnu n'occupe aucune bande", () => {
  assert.deepEqual(staffingBands(["ws-supprime"], WORKSHOP_SEED, { cellPx: 100 }), []);
  const bands = staffingBands([USINE, "ws-supprime"], WORKSHOP_SEED, { cellPx: 100 });
  assert.equal(bands.length, 1);
  assert.equal(bands[0].name, "Usine");
  assert.deepEqual(staffingBands([], WORKSHOP_SEED, { cellPx: 100 }), []);
});

// --- Totaux ------------------------------------------------------------------

test("la charge d'une personne compte les POSTES, pas les jours", () => {
  const entries = [
    { member: "Karim", date: "2026-09-14", workshops: [ATELIER, USINE] },
    { member: "Karim", date: "2026-09-15", workshops: [ATELIER] },
    { member: "Karim", date: "2026-09-21", workshops: [FORMATION] },
  ];
  const days = staffingDays({ start: "2026-09-14", end: "2026-09-20" }, "2026-09-17");
  assert.equal(staffingMemberLoad(entries, "Karim", days), 3, "deux ateliers le même jour font deux postes");
  assert.equal(staffingMemberLoad(entries, "Karim", []), 0);
  assert.equal(staffingMemberLoad(entries, "Personne", days), 0);
});

test("le pied de colonne compte les PERSONNES, pas les postes", () => {
  const entries = [
    { member: "Karim", date: "2026-09-14", workshops: [ATELIER, USINE] },
    { member: "Léa", date: "2026-09-14", workshops: [BUREAU] },
  ];
  const members = [{ name: "Karim" }, { name: "Léa" }, { name: "Vincent" }];
  assert.equal(staffingDayCount(entries, members, "2026-09-14"), 2);
  assert.equal(staffingDayCount(entries, members, "2026-09-15"), 0);
});

// --- Personnes affichées -----------------------------------------------------

test("la sélection de personnes est propre au widget, et vide veut dire tout le monde", () => {
  const team = [{ name: "Maïa", color: "#111111" }, { name: "Vincent" }, { name: "  " }];
  assert.deepEqual(staffingVisibleMembers(team, []).map((m) => m.name), ["Maïa", "Vincent"]);
  assert.deepEqual(staffingVisibleMembers(team, undefined).map((m) => m.name), ["Maïa", "Vincent"]);
  assert.deepEqual(staffingVisibleMembers(team, ["Vincent"]).map((m) => m.name), ["Vincent"]);
  // Une personne retirée de l'annuaire disparaît d'elle-même du widget.
  assert.deepEqual(staffingVisibleMembers(team, ["Vincent", "Parti"]).map((m) => m.name), ["Vincent"]);
  assert.deepEqual(staffingVisibleMembers([], ["Vincent"]), []);
});

test("les réglages du widget se normalisent sans rien perdre d'inconnu", () => {
  const w = normalizeStaffingWidget({ id: "w1", type: "staffing", titre: "gardé", staffingMembers: ["A", "A", " B ", ""] });
  assert.equal(w.id, "w1");
  assert.equal(w.titre, "gardé", "une propriété inconnue survit à la normalisation");
  assert.deepEqual(w.staffingMembers, ["A", "B"]);
  assert.equal(w.staffingShowWeekends, true);
  assert.equal(w.staffingShowLoad, true);
  assert.equal(normalizeStaffingWidget({ staffingShowWeekends: false }).staffingShowWeekends, false);
  assert.equal(normalizeStaffingWidget(null).staffingRange, "month");
});

// --- Le sélecteur d'ateliers -------------------------------------------------

test("à l'ouverture, les ateliers posés remontent en tête", () => {
  const picked = staffingPickerGroups(WORKSHOP_SEED, [CHANTIER, USINE], "");
  assert.equal(picked.mode, "all");
  assert.deepEqual(picked.groups.map((g) => g.key), ["selected", "all"]);
  // L'ordre des Réglages est conservé à l'intérieur de chaque groupe.
  assert.deepEqual(picked.groups[0].items.map((i) => i.name), ["Usine", "Chantier"]);
  assert.ok(picked.groups[0].items.every((i) => i.checked));
  assert.ok(picked.groups[1].items.every((i) => !i.checked));
  assert.deepEqual(picked.hiddenSelected, []);
});

test("sans rien de coché, il n'y a qu'un groupe et pas de titre", () => {
  const picked = staffingPickerGroups(WORKSHOP_SEED, [], "");
  assert.equal(picked.groups.length, 1);
  assert.equal(picked.groups[0].label, "");
  assert.equal(picked.groups[0].items.length, WORKSHOP_SEED.length);
});

test("la recherche ignore accents et casse, et dit ce qu'elle cache", () => {
  const picked = staffingPickerGroups(WORKSHOP_SEED, [BUREAU, USINE], "AT");
  assert.equal(picked.mode, "search");
  assert.deepEqual(picked.groups[0].items.map((i) => i.name), ["Atelier", "Formation"]);
  /* Un atelier coché qui sort du filtre reste coché : le panneau le dit, sans
     quoi chercher « at » donnerait l'impression d'avoir tout perdu. */
  assert.deepEqual(picked.hiddenSelected, ["Usine", "Bureau"]);
  // Accents : « Étude » se trouve en tapant « etude ».
  const accentue = staffingPickerGroups([{ id: "w", name: "Étude" }], [], "etude");
  assert.equal(accentue.groups[0].items.length, 1);
  // Aucun résultat : aucun groupe, et le panneau le dira.
  assert.deepEqual(staffingPickerGroups(WORKSHOP_SEED, [], "zzz").groups, []);
});
