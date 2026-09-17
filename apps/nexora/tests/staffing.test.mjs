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
  "STAFFING_RANGES", "STAFFING_DEFAULTS",
  "normalizeStaffingRange", "normalizeStaffingOffset", "normalizeStaffingWidget",
  "staffingVisibleMembers", "staffingWindow", "staffingDays",
  "staffingCellFill", "staffingCellLabel", "staffingMemberColor", "normalizeStaffingExtraMembers",
  "staffingMemberLoad", "staffingDayCount", "staffingPickerGroups",
  "STAFFING_COLOR_CHOICES", "STAFFING_CUSTOM_MAX_DAYS",
  "staffingCustomWorkshopId", "staffingAddCustomWorkshop", "staffingRangeLabel",
];

const {
  WORKSHOP_SEED, normalizeWorkshops, workshopFor, workshopCode,
  staffingCellId, normalizeStaffingEntries, staffingByCell, staffingCellWorkshops,
  staffingSetCell, staffingWorkshopUsage,
  STAFFING_RANGES, STAFFING_DEFAULTS,
  normalizeStaffingRange, normalizeStaffingOffset, normalizeStaffingWidget,
  staffingVisibleMembers, staffingWindow, staffingDays,
  staffingCellFill, staffingCellLabel, staffingMemberColor, normalizeStaffingExtraMembers,
  staffingMemberLoad, staffingDayCount, staffingPickerGroups,
  STAFFING_COLOR_CHOICES, STAFFING_CUSTOM_MAX_DAYS,
  staffingCustomWorkshopId, staffingAddCustomWorkshop, staffingRangeLabel,
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
  assert.deepEqual(STAFFING_RANGES, ["month", "twoWeeks", "week", "custom"]);
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

test("un seul atelier remplit la case d'un aplat, plusieurs la partagent en quartiers", () => {
  /* C'est la technique de la heat map mensuelle, pas une variante : la
     diagonale saute aux yeux même sur une case de vingt pixels, là où deux
     bandes de dix pixels ne se distinguaient plus. */
  const seul = staffingCellFill([CHANTIER], WORKSHOP_SEED);
  assert.equal(seul.background, WORKSHOP_SEED[2].color, "un aplat, pas un dégradé à une couleur");
  assert.equal(seul.single.name, "Chantier");

  const deux = staffingCellFill([USINE, CHANTIER], WORKSHOP_SEED);
  assert.match(deux.background, /^conic-gradient\(from 45deg, /);
  assert.ok(deux.background.includes("0deg 180deg"), "deux quartiers égaux");
  assert.ok(deux.background.includes("180deg 360deg"));
  assert.equal(deux.single, null, "partagée : plus de libellé possible");

  // Aucune limite à trois, contrairement aux bandes : quatre quartiers restent
  // quatre quartiers, là où une quatrième bande n'était plus qu'un trait.
  const quatre = staffingCellFill([USINE, BUREAU, CHANTIER, ATELIER], WORKSHOP_SEED);
  assert.equal((quatre.background.match(/deg /g) || []).length, 4);
  assert.equal(quatre.shops.length, 4);
});

test("un atelier inconnu n'occupe aucun quartier", () => {
  assert.equal(staffingCellFill(["ws-supprime"], WORKSHOP_SEED), null);
  assert.equal(staffingCellFill([], WORKSHOP_SEED), null);
  const fill = staffingCellFill([USINE, "ws-supprime"], WORKSHOP_SEED);
  assert.equal(fill.shops.length, 1);
  assert.equal(fill.background, WORKSHOP_SEED[0].color, "une seule couleur reste : c'est un aplat");
});

test("une case ne porte un libellé que seule et au large", () => {
  const seul = staffingCellFill([CHANTIER], WORKSHOP_SEED);
  assert.equal(staffingCellLabel(seul, 118), "Chantier");
  assert.equal(staffingCellLabel(seul, 40), "CH");
  // Vue mois : la couleur seule, et l'infobulle prend le relais.
  assert.equal(staffingCellLabel(seul, 16), "");
  // Sans mesure de piste (premier rendu), on n'invente pas de texte.
  assert.equal(staffingCellLabel(seul, 0), "");
  /* Partagée en quartiers : rien. Un mot posé là chevaucherait deux couleurs et
     ne se lirait sur aucune. */
  assert.equal(staffingCellLabel(staffingCellFill([USINE, CHANTIER], WORKSHOP_SEED), 200), "");
  assert.equal(staffingCellLabel(null, 200), "");
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

test("la sélection de personnes est propre au widget, et vide veut dire PERSONNE", () => {
  /* Retour de test #124 : une sélection vide n'affiche personne. Déverser
     l'annuaire entier dans une grille de trente colonnes donnait une grille
     qu'il fallait vider avant de s'en servir. */
  const team = [{ name: "Maïa", color: "#111111" }, { name: "Vincent" }, { name: "  " }];
  assert.deepEqual(staffingVisibleMembers(team, []), []);
  assert.deepEqual(staffingVisibleMembers(team, undefined), []);
  assert.deepEqual(staffingVisibleMembers(team, ["Vincent"]).map((m) => m.name), ["Vincent"]);
  assert.deepEqual(
    staffingVisibleMembers(team, ["Maïa", "Vincent"]).map((m) => m.name),
    ["Maïa", "Vincent"],
    "cocher tout le monde reste possible, et c'est ce que fait le bouton de la fiche"
  );
  // Une personne ajoutée à la main s'affiche SANS qu'aucun inscrit soit coché :
  // c'est le cas d'un widget qui ne suit que des externes.
  assert.deepEqual(staffingVisibleMembers(team, [], ["Sofiane"]).map((m) => m.name), ["Sofiane"]);
  // Une personne retirée de l'annuaire disparaît d'elle-même du widget.
  assert.deepEqual(staffingVisibleMembers(team, ["Vincent", "Parti"]).map((m) => m.name), ["Vincent"]);
  assert.deepEqual(staffingVisibleMembers([], ["Vincent"]), []);
});

test("des personnes s'ajoutent À LA MAIN, en plus de l'annuaire", () => {
  /* Un intérimaire, un sous-traitant, quelqu'un qui n'a pas de compte : les
     faire entrer dans l'annuaire pour les planifier reviendrait à leur ouvrir
     Nexora (#124). */
  const team = [{ name: "Maïa", color: "#111111" }, { name: "Vincent" }];
  const vus = staffingVisibleMembers(team, ["Vincent"], [{ name: "Sofiane" }, "Renfort 2"]);
  assert.deepEqual(vus.map((m) => m.name), ["Vincent", "Sofiane", "Renfort 2"], "les libres suivent, dans l'ordre de saisie");
  assert.equal(vus[0].registered, true);
  assert.equal(vus[1].registered, false);
  assert.ok(vus[1].color, "un nom libre reçoit une couleur, par hachage");
  // Un nom libre qui existe déjà dans l'annuaire n'est pas dupliqué : c'est la
  // même personne, et les affectations sont indexées par le nom.
  assert.deepEqual(staffingVisibleMembers(team, ["Maïa", "Vincent"], ["Maïa"]).map((m) => m.name), ["Maïa", "Vincent"]);
  // Même chose s'il est écarté par la sélection : on ne le fait pas revenir en
  // double sous une autre identité.
  assert.deepEqual(staffingVisibleMembers(team, ["Vincent"], ["Maïa"]).map((m) => m.name), ["Vincent", "Maïa"]);
  assert.equal(staffingVisibleMembers(team, ["Vincent"], ["Maïa"])[1].registered, false);
});

test("les personnes ajoutées portent un nom ET une couleur, et les deux écritures se lisent", () => {
  /* Les widgets d'avant #124 portent une simple chaîne, ceux d'aujourd'hui un
     objet depuis que la couleur se choisit : lire les deux évite une migration
     du magasin, et une sauvegarde ancienne rouvre sans perdre personne. */
  assert.deepEqual(
    normalizeStaffingExtraMembers([" Sofiane ", "Sofiane", "", null, "Renfort"]),
    [{ name: "Sofiane", color: "" }, { name: "Renfort", color: "" }]
  );
  assert.deepEqual(
    normalizeStaffingExtraMembers([{ name: " Sofiane ", color: "#123456" }, { name: "Sofiane", color: "#abcdef" }]),
    [{ name: "Sofiane", color: "#123456" }],
    "le doublon est écarté, et c'est la PREMIÈRE couleur qui tient"
  );
  assert.deepEqual(normalizeStaffingExtraMembers([{ name: "X", color: "rouge" }]), [{ name: "X", color: "" }], "une couleur qui n'en est pas vaut absence");
  assert.deepEqual(normalizeStaffingExtraMembers(null), []);
  assert.deepEqual(normalizeStaffingWidget({ staffingExtraMembers: ["A", "A", " B "] }).staffingExtraMembers, [{ name: "A", color: "" }, { name: "B", color: "" }]);
  assert.deepEqual(normalizeStaffingWidget({}).staffingExtraMembers, []);
});

test("la couleur choisie pour une personne l'emporte sur celle du hachage", () => {
  const vus = staffingVisibleMembers([], [], [{ name: "Sofiane", color: "#123456" }, { name: "Renfort" }]);
  assert.equal(vus[0].color, "#123456");
  assert.equal(vus[1].color, staffingMemberColor("Renfort"), "sans choix, le hachage du nom");
});

test("la couleur d'un nom libre vient de son NOM, pas de son rang", () => {
  /* Le rang change dès qu'on ajoute quelqu'un au-dessus, et « Karim » changerait
     de couleur sans avoir bougé. */
  assert.equal(staffingMemberColor("Sofiane"), staffingMemberColor("Sofiane"));
  assert.match(staffingMemberColor("Sofiane"), /^#[0-9A-Fa-f]{6}$/);
  assert.match(staffingMemberColor(""), /^#[0-9A-Fa-f]{6}$/);
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

test("le sélecteur range par TYPE, et l'ordre ne bouge pas quand on coche", () => {
  /* Retour de test #124 : faire remonter les cochés en tête déplaçait les
     lignes sous le curseur — on cochait « Usine » et « Bureau » changeait de
     place. L'ordre est celui du catalogue, et la coche se voit à la coche. */
  const picked = staffingPickerGroups(WORKSHOP_SEED, [CHANTIER, USINE], "");
  assert.equal(picked.mode, "all");
  assert.deepEqual(picked.groups.map((g) => g.key), ["standard"]);
  assert.deepEqual(picked.groups[0].items.map((i) => i.name), WORKSHOP_SEED.map((w) => w.name));
  assert.deepEqual(picked.groups[0].items.filter((i) => i.checked).map((i) => i.name), ["Usine", "Chantier"]);
  assert.deepEqual(picked.hiddenSelected, []);
  // Un seul type au catalogue : pas de titre à écrire, il n'y a rien à distinguer.
  assert.equal(picked.groups[0].label, "");
});

test("les ateliers personnalisés font leur propre groupe", () => {
  const catalogue = [...WORKSHOP_SEED, { id: "ws-perso-grue", name: "Grue", color: "#123456", custom: true }];
  const picked = staffingPickerGroups(catalogue, [], "");
  assert.deepEqual(picked.groups.map((g) => g.key), ["standard", "custom"]);
  assert.deepEqual(picked.groups.map((g) => g.label), ["Ateliers standards", "Ateliers personnalisés"]);
  assert.deepEqual(picked.groups[1].items.map((i) => i.name), ["Grue"]);
});

test("sans rien de coché, les ateliers du catalogue sont tous proposés", () => {
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

/* ---- Plage de dates choisie à la main (#124) ------------------------------ */

test("une plage à la main est bornée par ses deux dates", () => {
  const win = staffingWindow("custom", 0, "2026-09-17", { start: "2026-10-05", end: "2026-10-09" });
  assert.deepEqual(win, { start: "2026-10-05", end: "2026-10-09" });
  assert.equal(staffingDays(win, "2026-09-17", {}).length, 5);
});

test("deux dates à l'envers sont remises à l'endroit, pas refusées", () => {
  // On sait ce que quelqu'un qui saisit « du 30 au 12 » voulait dire, et une
  // grille vide ne le lui dirait pas.
  assert.deepEqual(
    staffingWindow("custom", 0, "2026-09-17", { start: "2026-10-09", end: "2026-10-05" }),
    { start: "2026-10-05", end: "2026-10-09" }
  );
});

test("une plage incomplète montre le mois en cours, jamais rien", () => {
  const mois = { start: "2026-09-01", end: "2026-09-30" };
  assert.deepEqual(staffingWindow("custom", 0, "2026-09-17", { start: "2026-10-05", end: "" }), mois);
  assert.deepEqual(staffingWindow("custom", 0, "2026-09-17", null), mois);
  assert.deepEqual(staffingWindow("custom", 0, "2026-09-17", { start: "hier", end: "demain" }), mois);
});

test("les flèches font glisser la plage de sa PROPRE durée", () => {
  const custom = { start: "2026-10-05", end: "2026-10-09" }; // cinq jours
  assert.deepEqual(staffingWindow("custom", 1, "2026-09-17", custom), { start: "2026-10-10", end: "2026-10-14" });
  assert.deepEqual(staffingWindow("custom", -1, "2026-09-17", custom), { start: "2026-09-30", end: "2026-10-04" });
});

test("une plage démesurée est ramenée à une longueur lisible", () => {
  // Au-delà, les colonnes tombent sous le pixel : c'est une grille, pas un export.
  const win = staffingWindow("custom", 0, "2026-01-01", { start: "2026-01-01", end: "2027-12-31" });
  assert.equal(staffingDays(win, "2026-01-01", {}).length, STAFFING_CUSTOM_MAX_DAYS);
});

test("le nom d'une granularité s'écrit à UN seul endroit", () => {
  assert.deepEqual(STAFFING_RANGES.map(staffingRangeLabel), ["Mois", "2 semaines", "Semaine", "Plage"]);
});

/* ---- Ateliers personnalisés (#124) ---------------------------------------- */

test("un atelier du catalogue de départ n'est PAS personnalisé", () => {
  assert.ok(normalizeWorkshops(WORKSHOP_SEED).every((w) => w.custom === false));
  assert.equal(normalizeWorkshops([{ id: "x", name: "Grue", color: "#123456", custom: true }])[0].custom, true);
});

test("l'identifiant d'un atelier personnalisé est DÉRIVÉ de son nom", () => {
  /* Deux sessions qui créent « Grue » au même moment écrivent alors le même
     atelier, que la fusion traite comme un seul — un identifiant tiré au sort
     aurait donné deux « Grue » indiscernables, chacun avec ses affectations. */
  assert.equal(staffingCustomWorkshopId("Grue à tour", WORKSHOP_SEED), "ws-perso-grue-a-tour");
  assert.equal(staffingCustomWorkshopId("GRUE", WORKSHOP_SEED), staffingCustomWorkshopId("grue", WORKSHOP_SEED));
  // Un identifiant déjà pris par un AUTRE atelier ne l'écrase pas.
  const pris = [...WORKSHOP_SEED, { id: "ws-perso-grue", name: "Autre", color: "#123456", custom: true }];
  assert.equal(staffingCustomWorkshopId("Grue", pris), "ws-perso-grue-2");
});

test("créer un atelier depuis le widget l'ajoute au MÊME catalogue", () => {
  const fait = staffingAddCustomWorkshop(WORKSHOP_SEED, "Grue", "#123456");
  assert.equal(fait.created, true);
  assert.equal(fait.workshop.custom, true);
  assert.equal(fait.workshop.color, "#123456");
  assert.equal(fait.catalogue.length, WORKSHOP_SEED.length + 1);
  assert.equal(fait.catalogue[fait.catalogue.length - 1].name, "Grue");
  // Le catalogue rendu reste lisible par le reste du widget.
  assert.equal(workshopFor(fait.catalogue, fait.workshop.id).name, "Grue");
});

test("un nom déjà au catalogue rend l'atelier EXISTANT, sans doublon", () => {
  // « Usine » saisi dans le sélecteur est l'atelier Usine : deux entrées de même
  // nom ne se distingueraient qu'à la couleur.
  const fait = staffingAddCustomWorkshop(WORKSHOP_SEED, "  usine ", "#123456");
  assert.equal(fait.created, false);
  assert.equal(fait.workshop.id, WORKSHOP_SEED[0].id);
  assert.equal(fait.catalogue.length, WORKSHOP_SEED.length);
});

test("un nom vide ne crée rien", () => {
  const fait = staffingAddCustomWorkshop(WORKSHOP_SEED, "   ", "#123456");
  assert.equal(fait.created, false);
  assert.equal(fait.workshop, null);
  assert.equal(fait.catalogue.length, WORKSHOP_SEED.length);
});

test("une couleur qui n'en est pas retombe sur la palette, jamais sur du vide", () => {
  const fait = staffingAddCustomWorkshop(WORKSHOP_SEED, "Grue", "bleu");
  assert.equal(fait.workshop.color, STAFFING_COLOR_CHOICES[0]);
  assert.ok(STAFFING_COLOR_CHOICES.every((c) => /^#[0-9A-Fa-f]{6}$/.test(c)));
});

test("un atelier personnalisé se pose et se retire comme un autre", () => {
  const fait = staffingAddCustomWorkshop(WORKSHOP_SEED, "Grue", "#123456");
  const ids = fait.catalogue.map((w) => w.id);
  const apres = staffingSetCell([], "Maïa", "2026-09-17", [fait.workshop.id], ids);
  assert.deepEqual(staffingCellWorkshops(apres, "Maïa", "2026-09-17"), [fait.workshop.id]);
  // Et il quitte les affectations s'il disparaît du catalogue, comme les autres.
  assert.deepEqual(normalizeStaffingEntries(apres, WORKSHOP_SEED.map((w) => w.id)), []);
});

test("le détail de l'infobulle se lit sur son fond SOMBRE (#124)", () => {
  /* Les trois lignes du détail heritaient des couleurs de texte de la PAGE
     alors qu'elles se posent sur le carton sombre des infobulles : de l'encre
     presque noire sur un fond presque noir, où l'on ne voyait plus que la
     pastille de couleur. Aucune fonction n'était fautive — c'est la feuille de
     style construite qu'il faut lire. */
  const bloc = html.slice(html.indexOf(".lp-cp-tip-line{"), html.indexOf(".lp-cp-tip-empty{") + 200);
  assert.doesNotMatch(bloc, /color:var\(--text-900\)/, "du texte de page sur un carton sombre");
  assert.doesNotMatch(bloc, /color:var\(--text-600\)/, "du texte de page sur un carton sombre");
  assert.match(bloc, /\.lp-cp-tip-line\{[^}]*color:#fff/);
  assert.match(bloc, /\.lp-cp-tip-foot\{[^}]*color:rgba\(255,255,255/);
  assert.match(bloc, /\.lp-cp-tip-empty\{[^}]*color:rgba\(255,255,255/);
  // Et le carton, lui, reste bien le fond sombre partagé par toutes les infobulles.
  assert.match(html, /\.lp-pie-tooltip\{ background:var\(--ink\); color:#fff;/);
});

test("TOUT réglage du widget est recopié par l'enregistrement (#124)", () => {
  /* La granularité « Plage » est restée sans effet parce que ses deux dates
     manquaient dans le bloc d'enregistrement de la fiche : elle les affichait,
     l'enregistrement les laissait tomber. Le défaut était invisible aux tests
     de fonction — la normalisation, elle, faisait son travail.

     Ce contrôle relit le bloc construit et exige une ligne par clé connue :
     le prochain réglage ajouté ne pourra plus disparaître en silence. */
  const from = html.indexOf('if (type === "staffing") {');
  assert.ok(from !== -1, "bloc d'enregistrement du widget Charge introuvable");
  const bloc = html.slice(from, html.indexOf("}", html.indexOf("data.staffingShowLoad", from)));
  Object.keys(STAFFING_DEFAULTS).forEach((key) => {
    assert.ok(
      bloc.includes("data." + key + " = st." + key + ";"),
      `le réglage ${key} n'est pas enregistré par la fiche du widget`
    );
  });
  // Et l'offset, qui n'a pas de défaut nommé, est recopié lui aussi.
  assert.ok(bloc.includes("data.staffingOffset = st.staffingOffset;"));
});
