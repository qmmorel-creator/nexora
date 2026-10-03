// Parcours de bout en bout du Cockpit (Ref #655), sur données FICTIVES.
//   npm run e2e   (lance Vite en mode démo, puis Chromium via Playwright)
// Playwright est facultatif : PLAYWRIGHT_MODULE ou le module global.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const mod = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(mod);
const PORT = 5191;
const sortie = process.env.E2E_CAPTURES || "e2e/captures";
mkdirSync(sortie, { recursive: true });

const vite = spawn("node_modules/.bin/vite", ["--port", String(PORT), "--strictPort"], { env: { ...process.env, VITE_DEMO: "1" }, stdio: "pipe" });
await new Promise((ok, ko) => { vite.stdout.on("data", (b) => /Local/.test(String(b)) && ok()); setTimeout(() => ko(new Error("Vite ne démarre pas")), 30000); });

const navigateur = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const erreurs = [];
let etape = "";
let page;
try {
  page = await navigateur.newPage({ viewport: { width: 1500, height: 920 } });
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  const taches = () => page.evaluate(() => window.__nexoraDemo.valeur("nexora:tasks"));
  const archive = () => page.evaluate(() => window.__nexoraDemo.valeur("nexora:taskArchive"));
  const capture = (n) => page.screenshot({ path: `${sortie}/${n}.png` });

  etape = "chargement"; await page.goto(`http://127.0.0.1:${PORT}/taches`);
  await page.getByRole("grid", { name: "Tâches" }).waitFor();
  await capture("1-liste");
  assert.ok(await page.getByText("PV Contrôles DREAL").isVisible());

  etape = "création par saisie rapide"; console.log("→", etape);
  await page.keyboard.press("c");
  await page.getByRole("combobox", { name: "Saisie de la palette" }).waitFor();
  await page.keyboard.type("Relancer bureau de contrôle vendredi @Vincent #CTEX6 !urgent");
  await page.getByText("non reconnu").waitFor({ state: "detached", timeout: 500 }).catch(() => {});
  await capture("2-palette-creation");
  await page.keyboard.press("Enter");
  await page.getByText("« Relancer bureau de contrôle » créée.").waitFor();
  const cree = (await taches()).find((t) => t.title === "Relancer bureau de contrôle");
  assert.ok(cree, "tâche créée");
  assert.equal(cree.projectId, "p-ctex6"); assert.equal(cree.assignee, "Vincent Bernard"); assert.equal(cree.criticality, "urgent");
  assert.equal(new Date(cree.end + "T12:00:00Z").getUTCDay(), 5, "fin un vendredi");
  assert.ok(cree.lastInteraction, "horodatée");

  etape = "inspecteur"; console.log("→", etape);
  await page.getByRole("button", { name: "PV Contrôles DREAL" }).click();
  await page.getByRole("complementary", { name: /Fiche : PV Contrôles DREAL/ }).waitFor();
  assert.match(page.url(), /[?&]t=t2/);
  await page.locator("#i-statut").selectOption("s3");
  await page.waitForTimeout(150);
  assert.equal((await taches()).find((t) => t.id === "t2").statusId, "s3");
  await page.getByPlaceholder("Ajouter une sous-tâche puis Entrée").fill("Relancer le bureau de contrôle");
  await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  assert.equal((await taches()).find((t) => t.id === "t2").checklist.length, 1);
  await capture("3-inspecteur");
  await page.keyboard.press("Escape"); // quitte le champ
  await page.keyboard.press("Escape"); // ferme la fiche
  await page.waitForTimeout(100);
  assert.doesNotMatch(page.url(), /[?&]t=/);

  etape = "terminer une récurrente"; console.log("→", etape);
  const avant = (await taches()).length;
  await page.getByRole("button", { name: "Point hebdo chantier" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("e"); await page.waitForTimeout(200);
  const apres = await taches();
  assert.equal(apres.length, avant + 1, "occurrence suivante créée");
  assert.equal(apres.find((t) => t.id === "t7").statusId, "s5");
  assert.ok(apres.find((t) => t.id === "t7").completedAt, "completedAt posé");

  assert.equal(await page.locator(".ligne.sel").count(), 1, "la sélection passe à la tâche suivante");

  etape = "archiver puis annuler"; console.log("→", etape);
  await page.getByRole("button", { name: "Demande lame pour piste d'accès" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("x"); await page.waitForTimeout(200);
  assert.ok((await archive()).some((t) => t.id === "t5"));
  assert.ok(!(await taches()).some((t) => t.id === "t5"));
  await page.locator(".notif", { hasText: "archivée" }).getByRole("button", { name: "Annuler" }).click(); await page.waitForTimeout(250);
  assert.ok((await taches()).some((t) => t.id === "t5"), "restaurée");
  assert.ok(!(await archive()).some((t) => t.id === "t5"));

  etape = "colonnes et glisser-déposer"; console.log("→", etape);
  await page.keyboard.press("2");
  await page.getByLabel("Tâches en colonnes").waitFor();
  assert.match(page.url(), /v=colonnes/);
  const carte = page.locator(".carte-tache", { hasText: "Newsletter d'octobre" });
  const colonne = page.locator(".colonne", { hasText: /^En cours/ }).first();
  await carte.dragTo(page.getByRole("region", { name: /^En cours/ }));
  await page.waitForTimeout(200);
  assert.equal((await taches()).find((t) => t.id === "t10").statusId, "s3", "statut changé par glisser-déposer");
  await capture("4-colonnes");
  void colonne;

  etape = "recherche par la palette"; console.log("→", etape);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Saisie de la palette" }).waitFor();
  await page.keyboard.type("dreal visite");
  // « PV Contrôles DREAL » remonte aussi (sa description cite la visite) :
  // la recherche couvre les descriptions, comme la recherche globale actuelle.
  const resultats = page.locator(".palette-el");
  await resultats.filter({ hasText: "Visite DREAL" }).waitFor();
  assert.ok(await resultats.filter({ hasText: "PV Contrôles DREAL" }).count(), "recherche dans la description");
  await resultats.filter({ hasText: "Visite DREAL" }).click();
  await page.getByRole("complementary", { name: /Fiche : Visite DREAL/ }).waitFor();

  etape = "lien profond et Précédent"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/projets/p-lot2b?v=liste&retard=1`);
  await page.getByRole("heading", { name: "Lot 2B" }).waitFor();
  const lignes = await page.locator(".ligne").allTextContents();
  assert.equal(lignes.length, 1); assert.match(lignes[0], /Demande lame/);
  await page.goBack(); await page.waitForTimeout(200);

  etape = "tâche Google Calendar en lecture seule"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/?t=t12`);
  await page.getByText("Événement Google Calendar").waitFor();
  assert.ok(await page.locator("#i-statut").isDisabled());

  etape = "fil du jour : briefing et à caser"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/?m=matin`);
  await page.getByText("Briefing de 7 h · généré par l'assistant").waitFor();
  assert.ok(await page.getByText("412 €").isVisible(), "reste à dépenser du rapport");
  const bac = page.getByRole("region", { name: "À caser aujourd'hui" });
  await bac.getByText("Demande lame pour piste d'accès").waitFor();
  await capture("6-fil-matin");
  // Cadran (#678) : la tâche déposée à 15 h (en haut à droite, sur l'anneau des créneaux).
  const cadran = page.locator(".ca-cadran");
  const boite = await cadran.boundingBox();
  const a = ((15 - 12) / 24) * 2 * Math.PI - Math.PI / 2;
  await bac.locator(".fil-tache", { hasText: "Demande lame" }).dragTo(cadran, { targetPosition: { x: boite.width * (0.5 + 0.375 * Math.cos(a)), y: boite.height * (0.5 + 0.375 * Math.sin(a)) } });
  await page.waitForTimeout(250);
  const casee = (await taches()).find((t) => t.id === "t5");
  const auj = await page.evaluate(() => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  assert.equal(casee.end, auj, "replanifiée aujourd'hui");
  assert.equal(casee.startTime, "15:00", "heure lue sur le cadran");
  await page.locator(".ca-ev", { hasText: "Demande lame" }).waitFor();
  assert.ok(await page.locator(".ca-arc title", { hasText: "Demande lame" }).count(), "arc sur le cadran");
  // Habitudes dans le Cadran : mosaïque au centre, pixel du jour, ← → changent de jour.
  assert.ok(await page.locator(".ca-centre .mos .px").count() > 0, "mosaïque au centre du cadran");
  await page.getByRole("region", { name: "Le pixel du jour, Aujourd'hui" }).waitFor();
  await page.locator("body").press("ArrowLeft");
  await page.getByRole("region", { name: "Le pixel du jour, Hier" }).waitFor();
  await page.locator("body").press("ArrowRight");
  await page.getByRole("region", { name: "Le pixel du jour, Aujourd'hui" }).waitFor();

  etape = "fil du jour : bilan du soir et semaine"; console.log("→", etape);
  await page.getByRole("radio", { name: "Soir" }).click();
  assert.match(page.url(), /m=soir/);
  await page.locator(".fil-glisse", { hasText: "Demande lame" }).getByRole("button", { name: "Demain" }).click();
  await page.waitForTimeout(250);
  assert.ok((await taches()).find((t) => t.id === "t5").end > auj, "reportée à demain");
  await page.getByRole("radio", { name: "Semaine" }).click();
  assert.equal(await page.locator(".fil-sjour").count(), 7);
  assert.equal(await page.locator(".fil-sjour .ca-mini").count(), 7, "sept cadrans");
  await page.getByRole("region", { name: "Heat map annuelle des habitudes" }).waitFor();
  await capture("7-fil-semaine");

  etape = "page projet"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/projets/p-ctex6`);
  await page.getByRole("region", { name: "Budget du projet" }).waitFor();
  assert.match(await page.getByRole("region", { name: "Budget du projet" }).textContent(), /62 %/);
  assert.match(await page.getByRole("region", { name: "Risques de retard" }).textContent(), /bloquée/);
  await capture("8-page-projet");
  await page.getByRole("button", { name: "Personnaliser" }).click();
  await page.getByRole("group", { name: "Sections de la page projet" }).getByLabel("Journal du projet").uncheck();
  assert.equal(await page.getByRole("region", { name: "Journal du projet" }).count(), 0, "section masquée");
  await page.keyboard.press("Escape"); // rend le focus : les raccourcis sont ignorés dans un champ
  await page.keyboard.press("1"); await page.waitForTimeout(100);
  assert.match(page.url(), /v=liste/);
  await page.keyboard.press("3"); await page.waitForTimeout(100);
  assert.doesNotMatch(page.url(), /v=/);

  etape = "espaces et mémoire"; console.log("→", etape);
  await page.keyboard.press("g"); await page.keyboard.press("e");
  await page.getByRole("table", { name: "Charge par personne" }).waitFor();
  assert.match(page.url(), /\/equipe$/);
  await capture("9-espace-equipe");
  await page.keyboard.press("g"); await page.keyboard.press("s");
  await page.getByRole("region", { name: "Le pixel du jour, Aujourd'hui" }).waitFor();
  await page.keyboard.press("g"); await page.keyboard.press("f");
  await page.getByText("Reste à dépenser").waitFor();
  await page.keyboard.press("g"); await page.keyboard.press("c");
  await page.waitForTimeout(150);
  assert.match(page.url(), /\/projets\/p-ctex6$/, "Chantiers revient à la dernière adresse");
  const prefs = () => page.evaluate(() => window.__nexoraDemo.valeur("nexora:futurPrefs"));
  assert.deepEqual((await prefs())?.pageProjet?.masquees, ["journal"], "ordre des sections synchronisé");
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:futurPrefs")?.espaces?.chantiers === "/projets/p-ctex6", null, { timeout: 6000 });

  etape = "habitudes et journal"; console.log("→", etape);
  const valeur = (cle) => page.evaluate((c) => window.__nexoraDemo.valeur(c), cle);
  await page.keyboard.press("g"); await page.keyboard.press("s");
  const jourHab = page.getByRole("region", { name: "Le pixel du jour, Aujourd'hui" });
  await jourHab.waitFor();
  await jourHab.getByRole("checkbox", { name: /Bureau/ }).click();
  await jourHab.getByRole("checkbox", { name: /Bureau/, checked: true }).waitFor();
  await jourHab.getByRole("checkbox", { name: /Télétravail/ }).click();
  await jourHab.getByRole("checkbox", { name: /Télétravail/, checked: true }).waitFor();
  assert.equal(await jourHab.getByRole("checkbox", { name: /Bureau/ }).getAttribute("aria-checked"), "false", "choix unique : Bureau décoché");
  await jourHab.getByRole("button", { name: "Augmenter Pas (milliers)" }).click();
  await jourHab.getByText("0 / 10").waitFor();
  await jourHab.getByRole("button", { name: "Augmenter Pas (milliers)" }).click();
  await jourHab.getByText("2 / 10").waitFor();
  await jourHab.getByRole("button", { name: "Méditation non applicable" }).click();
  await jourHab.getByRole("button", { name: "Méditation non applicable", pressed: true }).waitFor();
  const aujourdhui = await page.evaluate(() => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  const duJour = (await valeur("nexora:habitLog")).filter((e) => e.date === aujourdhui);
  assert.deepEqual(duJour.filter((e) => ["h4", "h5", "h6"].includes(e.habitId)).map((e) => [e.id, e.value]), [[`h4|${aujourdhui}`, 2], [`h6|${aujourdhui}`, undefined]]);
  assert.deepEqual((await valeur("nexora:habitSkips")).map((e) => e.id), [`h3|${aujourdhui}`]);
  await capture("10-corps-habitudes");
  // Pixel : le clic sur le pixel de Lecture coche l'habitude, comme la case.
  await jourHab.getByRole("group", { name: "Pixels Santé" }).getByRole("button", { name: "Lecture" }).click();
  await jourHab.getByRole("checkbox", { name: "Lecture", checked: true }).waitFor();
  // Hier, depuis la navigation du pixel du jour.
  await page.getByRole("button", { name: "Jour précédent" }).click();
  await page.getByRole("region", { name: "Le pixel du jour, Hier" }).getByRole("checkbox", { name: /Bureau/ }).click();
  await page.waitForFunction((auj) => (window.__nexoraDemo.valeur("nexora:habitLog") || []).some((e) => e.habitId === "h5" && e.date < auj), aujourdhui);
  // Heat map : la case d'aujourd'hui porte les couleurs des habitudes faites.
  assert.match(await page.locator(".co-cell.auj").getAttribute("style") || "", /conic-gradient|#/, "case du jour colorée");

  etape = "corps : sport, santé, photos"; console.log("→", etape);
  const rubrique = (nom) => page.getByRole("radiogroup", { name: "Rubrique" }).getByRole("radio", { name: nom, exact: true }).click();
  await rubrique("Sport");
  await page.getByText("Dernière séance").waitFor();
  await page.getByRole("img", { name: /^Barres empilées/ }).waitFor();
  await page.getByRole("radiogroup", { name: "Regroupement" }).getByRole("radio", { name: "Mois" }).click();
  await page.getByRole("img", { name: /Barres empilées, 1[23] périodes/ }).waitFor();
  await capture("10b-corps-sport");
  await rubrique("Santé");
  await page.getByRole("img", { name: "Courbe Poids" }).waitFor();
  await page.getByLabel("Mesure").selectOption("recovery");
  await page.getByRole("img", { name: "Courbe Récupération" }).waitFor();
  await rubrique("Photos");
  const curseur = page.getByRole("slider", { name: "Curseur avant / après" });
  await curseur.waitFor();
  await page.getByRole("img", { name: /alignée sur la référence/ }).waitFor();
  await curseur.focus(); await page.keyboard.press("End");
  assert.equal(await curseur.getAttribute("aria-valuenow"), "100");
  assert.match(await page.getByRole("img", { name: /alignée sur la référence/ }).getAttribute("style"), /matrix\(/, "photo alignée par les repères");
  await capture("10c-corps-photos");

  etape = "équipe : charge du personnel, organigramme, fiche"; console.log("→", etape);
  await page.keyboard.press("Escape");
  await page.keyboard.press("g"); await page.keyboard.press("e");
  await rubrique("Charge du personnel");
  const grilleEq = page.getByRole("table", { name: "Affectations par personne et par jour" });
  await grilleEq.waitFor();
  assert.ok(await grilleEq.getByText("Karim (intérim)").count(), "personne hors annuaire affichée");
  assert.ok(await grilleEq.locator(".eq-case.pleine").count() > 10, "affectations peintes");
  // Saisie d'une affectation (#663) : case de Maïa Sonnier aujourd'hui, atelier Formation.
  const ajd = await page.evaluate(() => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  await grilleEq.getByRole("button", { name: `Maïa Sonnier, ${ajd}` }).click();
  await page.getByRole("menu", { name: `Ateliers de Maïa Sonnier le ${ajd}` }).getByRole("menuitemcheckbox", { name: /Formation/ }).click();
  await page.waitForFunction((j) => (window.__nexoraDemo.valeur("nexora:staffing") || []).some((e) => e.member === "Maïa Sonnier" && e.date === j && e.workshops.includes("ws-formation")), ajd);
  await page.keyboard.press("Escape");
  await rubrique("Organigramme");
  await page.getByRole("region", { name: "Organigramme" }).getByText("lien transverse avec Travaux").waitFor();
  await page.getByRole("button", { name: /Maïa Sonnier/ }).first().click();
  const fichePers = page.getByRole("complementary", { name: "Fiche de Maïa Sonnier" });
  await fichePers.getByText("Travaux · Cheffe d'équipe").waitFor();
  await capture("10d-equipe-organigramme");
  await fichePers.getByRole("button", { name: "Fermer la fiche" }).click();
  // Écritures : aucune clé Équipe n'est touchée par Futur.
  for (const cle of ["nexora:staffing", "nexora:workshops", "nexora:teams", "nexora:teamMembers"]) assert.ok(Array.isArray(await valeur(cle)), cle);
  // Journal d'activité : une tâche terminée au clavier y est inscrite une fois.
  await page.keyboard.press("g"); await page.keyboard.press("c");
  await page.waitForTimeout(150);
  await page.keyboard.press("1");
  await page.getByRole("grid", { name: "Tâches" }).waitFor();
  await page.keyboard.press("j");
  const choisie = await page.locator('[role="row"][aria-selected="true"]').getAttribute("data-id");
  await page.keyboard.press("e");
  await page.waitForFunction((id) => (window.__nexoraDemo.valeur("nexora:activityLog") || []).some((e) => e.taskId === id && e.type === "completed"), choisie);
  const journal = await valeur("nexora:activityLog");
  assert.equal(journal.filter((e) => e.taskId === choisie && e.type === "completed").length, 1, "une seule entrée");
  assert.equal(journal[0].taskId, choisie, "entrée en tête du journal");
  assert.equal(new Set(journal.map((e) => e.id)).size, journal.length, "identifiants uniques");

  etape = "triage : appliquer, annuler, revoir, règles"; console.log("→", etape);
  const attendre = async (lib, f, arg) => { try { await page.waitForFunction(f, arg, { timeout: 8000 }); } catch (e) { throw new Error(`${lib} : ${e.message.split("\n")[0]}`); } };
  await page.goto(`http://127.0.0.1:${PORT}/triage`);
  await page.getByRole("radiogroup", { name: "Moment" }).getByRole("radio", { name: "Matin" }).click();
  const carteTri = page.locator('article[aria-label^="Carte de triage"]');
  await carteTri.waitFor();
  const titreCarte = await carteTri.locator("h3").textContent();
  const idCarte = (await taches()).find((t) => t.title === titreCarte)?.id;
  assert.ok(idCarte, `carte de tâche : ${titreCarte}`);
  const finAvant = (await taches()).find((t) => t.id === idCarte).end;
  await capture("10e-triage");
  await page.keyboard.press("Enter");
  await attendre("tâche datée", ([id, fin]) => window.__nexoraDemo.valeur("nexora:tasks").find((t) => t.id === id)?.end !== fin, [idCarte, finAvant]);
  await attendre("carte suivante", (t) => document.querySelector('article[aria-label^="Carte de triage"] h3')?.textContent !== t, titreCarte);
  await page.getByText(/^Progression · 1\//).waitFor();
  await page.keyboard.press("u");
  await attendre("tâche remise", ([id, fin]) => window.__nexoraDemo.valeur("nexora:tasks").find((t) => t.id === id)?.end === fin, [idCarte, finAvant]);
  await attendre("carte revenue", (t) => document.querySelector('article[aria-label^="Carte de triage"] h3')?.textContent === t, titreCarte);
  await page.keyboard.press("n");
  await attendre("report enregistré", (id) => Object.keys(window.__nexoraDemo.valeur("nexora:futurPrefs")?.triage?.reports || {}).some((k) => k.includes(id)), idCarte);
  await page.getByText(/^Progression · 1\//).waitFor();
  await page.waitForTimeout(150);
  const avantRegle = Number((await page.getByText(/\d+ à décider/).textContent()).match(/\d+/)[0]);
  await page.getByRole("button", { name: "Règles" }).click();
  await page.getByRole("region", { name: "Règles du triage" }).getByLabel("Tâche sans date").uncheck();
  await attendre("compteur après la règle", (n) => Number((document.body.innerText.match(/(\d+) à décider/) || [])[1]) === n - 1, avantRegle);
  assert.equal((await valeur("nexora:futurPrefs")).triage.regles.actives["sans-date"], false, "règle enregistrée dans les préférences");
  await page.getByRole("radiogroup", { name: "Moment" }).getByRole("radio", { name: "Soir" }).click();
  await page.getByText("Triage du soir · règles sans IA").waitFor();

  etape = "atlas : zoom, tiroir, fiche, mesures"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/atlas`);
  const atlas = page.getByRole("img", { name: "Atlas en 2,5D" });
  await atlas.waitFor();
  await page.locator('[data-ilot="p:p-ctex6"]').click({ force: true });
  await page.getByRole("navigation", { name: "Fil d'Ariane" }).getByRole("button", { name: "Chantiers" }).waitFor();
  await page.locator('[data-ilot="p:p-ctex6"]').click({ force: true });
  const tiroir = page.getByRole("complementary", { name: "Îlot CTEX6" });
  await tiroir.waitFor();
  await capture("10f-atlas");
  await tiroir.getByRole("button", { name: /Documents FOR-0129/ }).click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("t") === "t1");
  await page.keyboard.press("Escape");
  await page.goto(`http://127.0.0.1:${PORT}/atlas`);
  await atlas.waitFor();
  await page.getByRole("button", { name: "Mesures" }).click();
  await page.getByRole("button", { name: "Essai 300 projets" }).click();
  await page.getByText("300 projets", { exact: true }).waitFor();
  await page.getByText(/résumé : 3\d\d îlots visibles/).waitFor();
  assert.match(await page.locator("[data-m=noeuds]").textContent(), /^\d+ éléments SVG$/);
  assert.ok(Number((await page.locator("[data-m=noeuds]").textContent()).match(/\d+/)[0]) < 8000, "niveau de détail : moins de 8 000 éléments pour 300 projets");
  await page.getByRole("button", { name: "Mes données" }).click();

  etape = "phrase : mots, vues enregistrées, tuiles"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/phrase`);
  const chiffre = page.locator(".ph-chiffre b");
  await page.getByRole("button", { name: /^les tâches, changer/ }).click();
  await page.getByRole("option", { name: "mes dépenses" }).click();
  await page.waitForFunction(() => /€$/.test(document.querySelector(".ph-chiffre b")?.textContent || ""));
  await page.locator("body").press("s");
  const nom = page.getByLabel("Nom de la vue");
  await nom.fill("Budget du mois"); await nom.press("Enter");
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:futurPrefs")?.phrase?.vues?.length === 1);
  const vue = (await prefs()).phrase.vues[0];
  assert.deepEqual([vue.nom, vue.ph.quoi, vue.ph.per], ["Budget du mois", "depenses", "mois"]);
  assert.match(page.url(), /\/phrase/);
  await page.locator("body").press("e");
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:futurPrefs")?.phrase?.tuiles?.length === 1);
  // Un mot changé au clavier : la vue est « modifiée », puis mise à jour.
  await page.getByRole("button", { name: /^ce mois, changer/ }).focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("button", { name: /^le mois dernier, changer/ }).waitFor();
  await page.getByText("modifiée", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mettre à jour « Budget du mois »" }).click();
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:futurPrefs")?.phrase?.vues?.[0]?.ph?.per === "dernier");
  await capture("10g-phrase");
  // La tuile ramène la phrase épinglée ; la palette ouvre la vue.
  await page.getByRole("button", { name: /^Tuile : mes dépenses en toutes catégories sur ce mois/ }).click();
  await page.getByRole("button", { name: /^ce mois, changer/ }).waitFor();
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Vue : Budget");
  await page.getByRole("dialog").getByText("Vue : Budget du mois", { exact: true }).click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("vue")?.startsWith("v"));
  await page.getByRole("button", { name: /^le mois dernier, changer/ }).waitFor();
  // Renommer puis supprimer.
  await page.getByRole("button", { name: "Renommer la vue Budget du mois" }).click();
  const renom = page.getByLabel("Nouveau nom"); await renom.fill("Budget précédent"); await renom.press("Enter");
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:futurPrefs")?.phrase?.vues?.[0]?.nom === "Budget précédent");
  await page.getByRole("button", { name: "Supprimer la vue Budget précédent" }).click();
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:futurPrefs")?.phrase?.vues?.length === 0);
  assert.ok(await chiffre.textContent());

  etape = "réglages : projets, statuts, modèles, habitudes"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/reglages?o=projets`);
  const blocProjets = page.getByRole("region", { name: "Projets", exact: true });
  await blocProjets.getByLabel("Nom du nouveau projet").fill("Chantier Martin");
  await blocProjets.getByRole("button", { name: "Créer" }).click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:projects") || []).some((p) => p.name === "Chantier Martin"));
  const ligneMartin = blocProjets.getByRole("row", { name: "Chantier Martin" });
  const nomMartin = ligneMartin.getByLabel("Nom de Chantier Martin");
  await nomMartin.fill("Chantier Martin (Lyon)"); await nomMartin.press("Enter");
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:projects") || []).some((p) => p.name === "Chantier Martin (Lyon)"));
  const martin = (await valeur("nexora:projects")).find((p) => p.name === "Chantier Martin (Lyon)");
  await blocProjets.getByRole("button", { name: "Favori Chantier Martin (Lyon)" }).click();
  await page.waitForFunction((id) => (window.__nexoraDemo.valeur("nexora:favorites") || []).some((f) => f.type === "project" && f.id === id), martin.id);
  assert.ok(await blocProjets.getByRole("row", { name: "CTEX6" }).getByText("a des tâches").isVisible(), "projet avec tâches non supprimable");
  await blocProjets.getByRole("button", { name: "Supprimer Chantier Martin (Lyon)" }).click();
  await blocProjets.getByRole("button", { name: "Confirmer : supprimer Chantier Martin (Lyon)" }).click();
  await page.waitForFunction((id) => !(window.__nexoraDemo.valeur("nexora:projects") || []).some((p) => p.id === id), martin.id);
  // Statuts : création, portée, suppression.
  await page.getByRole("navigation", { name: "Rubriques des réglages" }).getByRole("button", { name: "Statuts et types" }).click();
  const blocStatuts = page.getByRole("region", { name: "Statuts", exact: true });
  await blocStatuts.getByLabel("Nom du nouveau statut").fill("Bloqué"); await blocStatuts.getByRole("button", { name: "Créer" }).click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:statuses") || []).some((x) => x.name === "Bloqué"));
  await blocStatuts.getByLabel("Portée de statut Bloqué").selectOption({ label: "CTEX6" });
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:statuses") || []).find((x) => x.name === "Bloqué")?.projectId === "p-ctex6");
  // Modèle de tâche, puis création depuis la palette.
  await page.getByRole("navigation", { name: "Rubriques des réglages" }).getByRole("button", { name: "Création" }).click();
  const blocModeles = page.getByRole("region", { name: "Modèles de tâche" });
  await blocModeles.getByLabel("Nom du nouveau modèle").fill("Visite de chantier"); await blocModeles.getByRole("button", { name: "Créer" }).click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:taskTemplates") || []).some((m) => m.name === "Visite de chantier"));
  await blocModeles.getByLabel("Visite de chantier : Projet").selectOption({ label: "Lot 2B" });
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:taskTemplates") || []).find((m) => m.name === "Visite de chantier")?.values?.projectId === "p-lot2b");
  await page.keyboard.press("Control+k"); await page.keyboard.type("modèle Visite");
  await page.getByRole("dialog").getByText("Nouvelle tâche : modèle Visite de chantier").click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:tasks") || []).some((t) => t.title === "Visite de chantier" && t.projectId === "p-lot2b"));
  await page.keyboard.press("Escape");
  // Thème d'habitudes : nouvelle habitude chiffrée.
  await page.goto(`http://127.0.0.1:${PORT}/reglages?o=habitudes`);
  const sante = page.getByRole("group", { name: "Thème Santé" });
  await sante.getByLabel("Nouvelle habitude dans Santé").fill("Gainage"); await sante.getByRole("button", { name: "Ajouter" }).click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:habitThemes") || []).some((t) => (t.habits || []).some((h) => h.name === "Gainage")));
  await sante.getByLabel("Saisie de Gainage").selectOption("numeric");
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:habitThemes") || []).flatMap((t) => t.habits || []).find((h) => h.name === "Gainage")?.kind === "numeric");
  // Utilisateurs, ateliers, méta-filtres.
  await page.goto(`http://127.0.0.1:${PORT}/reglages?o=equipe`);
  const blocUtil = page.getByRole("region", { name: "Utilisateurs" });
  await blocUtil.getByLabel("Nom du nouvel utilisateur").fill("Inès Durand"); await blocUtil.getByRole("button", { name: "Ajouter" }).click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:teamMembers") || []).some((m) => m.name === "Inès Durand"));
  await blocUtil.getByLabel("Équipe de Inès Durand").selectOption({ label: "Travaux" });
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:teamMembers") || []).find((m) => m.name === "Inès Durand")?.teamIds?.[0] === "eq1");
  await page.goto(`http://127.0.0.1:${PORT}/reglages?o=ateliers`);
  await page.getByLabel("Nom du nouvel atelier").fill("Peinture"); await page.getByRole("region", { name: "Ateliers" }).getByRole("button", { name: "Créer" }).click();
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:workshops") || []).some((w) => w.name === "Peinture"));
  await page.goto(`http://127.0.0.1:${PORT}/reglages?o=filtres`);
  await page.getByLabel("Masquer Communication").check();
  await page.waitForFunction(() => JSON.stringify(window.__nexoraDemo.valeur("nexora:metaFilters")?.advanced || {}).includes("isnot"));
  await page.getByRole("button", { name: "Remettre à zéro" }).click();
  await page.waitForFunction(() => !JSON.stringify(window.__nexoraDemo.valeur("nexora:metaFilters")?.advanced || {}).includes("isnot"));
  await capture("10h-reglages");

  etape = "guide, capture externe, historique, fiche mémo, export"; console.log("→", etape);
  await page.keyboard.press("Control+k"); await page.keyboard.type("Guide de démarrage");
  await page.getByRole("dialog").getByText("Guide de démarrage", { exact: true }).last().click();
  const guide = page.getByRole("dialog", { name: "Bienvenue dans Nexora Futur" });
  await guide.waitFor();
  await guide.getByRole("button", { name: "C'est parti" }).click();
  await guide.waitFor({ state: "detached" });
  // Capture externe : même adresse que nexora-project.
  const dans3 = await page.evaluate(() => { const [a, m, d] = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()).split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + 3)).toISOString().slice(0, 10); });
  await page.goto(`http://127.0.0.1:${PORT}/?nexoraCapture=1&title=${encodeURIComponent("Relancer le BET")}&project=ctex6&due=${dans3}&sourceSender=bet%40exemple.invalid`);
  await page.waitForFunction(() => (window.__nexoraDemo.valeur("nexora:tasks") || []).some((t) => t.title === "Relancer le BET"));
  const capt = (await taches()).find((t) => t.title === "Relancer le BET");
  assert.deepEqual([capt.projectId, capt.end, capt.milestone, capt.sourceSender], ["p-ctex6", dans3, true, "bet@exemple.invalid"]);
  await page.waitForFunction((id) => new URL(location.href).searchParams.get("t") === id && !location.search.includes("nexoraCapture"), capt.id);
  // Historique de la tâche (journal d'activité) puis fiche mémo.
  await page.getByText("Origine : e-mail de bet@exemple.invalid").waitFor();
  assert.ok(await page.locator(".insp-hist li", { hasText: "créée" }).count(), "historique : création");
  await page.getByRole("button", { name: "Fiche mémo" }).click();
  await page.getByRole("article", { name: "Fiche mémo Relancer le BET" }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Imprimer ou enregistrer en PDF" }).isVisible());
  // Export CSV des tâches.
  await page.goto(`http://127.0.0.1:${PORT}/reglages?o=donnees`);
  const [tele] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter les tâches" }).click()]);
  assert.match(tele.suggestedFilename(), /^nexora-taches-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = (await import("node:fs")).readFileSync(await tele.path(), "utf8");
  assert.ok(csv.startsWith("\ufeffid;titre;projet") && csv.includes("Demande lame pour piste d'accès"), "CSV des tâches");

  etape = "frise : glisser, référence, chemin critique"; console.log("→", etape);
  const J = (n) => page.evaluate((k) => { const [a, m, d] = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()).split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + k)).toISOString().slice(0, 10); }, n);
  const tache = async (id) => (await taches()).find((t) => t.id === id);
  await page.goto(`http://127.0.0.1:${PORT}/taches?v=frise&grp=project`);
  const gantt = page.getByRole("grid", { name: "Frise des tâches" });
  await gantt.waitFor();
  await capture("11-gantt");
  // Glisser « Newsletter d'octobre » de 3 jours.
  const jours = Number((await page.locator(".fr-outils .mono").first().textContent()).match(/(\d+) j/)[1]);
  const largeur = (await page.locator(".fr-axe .fr-piste").boundingBox()).width;
  const barreNews = gantt.getByRole("button", { name: /^Newsletter d'octobre, du/ });
  const bb = await barreNews.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + (3.2 * largeur) / jours, bb.y + bb.height / 2, { steps: 6 }); await page.mouse.up();
  const attendu = [await J(8), await J(15)];
  await page.waitForFunction((a) => { const t = window.__nexoraDemo.valeur("nexora:tasks").find((x) => x.id === "t10"); return t.start === a[0] && t.end === a[1]; }, attendu);
  // Référence courante puis plan initial (Revue DOE : fin J+7, référence J+2, initiale J+0).
  await page.getByRole("radio", { name: "Référence", exact: true }).click();
  await gantt.getByRole("button", { name: /^Revue DOE, .*écart de fin \+5 j/ }).waitFor();
  await page.getByRole("radio", { name: "Plan initial" }).click();
  await gantt.getByRole("button", { name: /^Revue DOE, .*écart de fin \+7 j/ }).waitFor();
  // Repli sur nexora:taskBaselines (Newsletter : baseline J+10, fin désormais J+15).
  await gantt.getByRole("button", { name: /^Newsletter d'octobre, .*écart de fin \+5 j/ }).waitFor();
  await page.getByLabel("Chemin critique").check();
  await gantt.getByRole("button", { name: /^Congés scolaires .*chemin critique/ }).waitFor();
  assert.deepEqual((await valeur("nexora:futurPrefs")).frise, { reference: "initiale", critique: true, style: "barres" }, "réglages de la frise synchronisés");
  await capture("12-gantt-reference");

  etape = "figer la référence"; console.log("→", etape);
  await gantt.getByRole("button", { name: "Revue DOE", exact: true }).click();
  const fiche = page.getByRole("complementary", { name: /Fiche : Revue DOE/ });
  await fiche.getByRole("button", { name: "Figer la référence" }).click();
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:tasks").find((x) => x.id === "t4").comparison.history.length === 2);
  const c4 = (await tache("t4")).comparison;
  assert.equal(c4.referenceEnd, await J(7)); assert.equal(c4.history[0].label, "Initiale");
  await page.keyboard.press("Escape");

  etape = "agenda"; console.log("→", etape);
  await page.keyboard.press("5");
  const jourAg = page.getByRole("region", { name: /^Frise du / });
  await jourAg.waitFor();
  await jourAg.getByRole("button", { name: "Jour suivant" }).click();
  await jourAg.getByRole("button", { name: "Jour suivant" }).click();
  await jourAg.getByRole("button", { name: "Jour suivant" }).click();
  await jourAg.getByRole("button", { name: "Jour suivant" }).click();
  await jourAg.getByRole("button", { name: /^09:00–11:00 Visite DREAL/ }).waitFor();
  await capture("13-agenda");

  etape = "tableur : édition en masse et annulation"; console.log("→", etape);
  await page.keyboard.press("6");
  // Les notifications des étapes précédentes couvrent le bas du tableur.
  for (const x of await page.getByRole("button", { name: "Fermer la notification" }).all()) await x.click();
  const tb = page.getByRole("table", { name: "Tableur des tâches" });
  await tb.waitFor();
  await tb.getByRole("checkbox", { name: "Sélectionner Revue DOE" }).check();
  await tb.getByRole("checkbox", { name: "Sélectionner Confirmer les personnes CNR aux PI" }).check();
  const masseBarre = page.getByRole("toolbar", { name: "Édition en masse" });
  await masseBarre.getByLabel("Décalage en jours").fill("2");
  await masseBarre.getByRole("button", { name: "Décaler (j)" }).click();
  const t8avant = await J(-13);
  await page.waitForFunction((d) => window.__nexoraDemo.valeur("nexora:tasks").find((x) => x.id === "t8").end === d, await J(-11));
  assert.equal((await tache("t4")).end, await J(9));
  await page.locator(".notif", { hasText: "Décalage" }).getByRole("button", { name: "Annuler" }).click();
  await page.waitForFunction((d) => window.__nexoraDemo.valeur("nexora:tasks").find((x) => x.id === "t8").end === d, t8avant);
  await masseBarre.getByLabel("Responsable").selectOption({ label: "Maïa Sonnier" });
  await page.waitForFunction(() => ["t4", "t8"].every((id) => window.__nexoraDemo.valeur("nexora:tasks").find((x) => x.id === id).assignee === "Maïa Sonnier"));
  const titre = tb.getByRole("row", { name: /Newsletter d'octobre/ }).getByLabel("Titre");
  await titre.fill("Newsletter d'octobre (v2)"); await titre.press("Enter");
  await page.waitForFunction(() => window.__nexoraDemo.valeur("nexora:tasks").find((x) => x.id === "t10").title === "Newsletter d'octobre (v2)");
  await capture("14-tableur");
  await page.keyboard.press("Escape");

  etape = "frise : bulles et métro"; console.log("→", etape);
  await page.keyboard.press("4");
  await page.getByRole("radio", { name: "Bulles" }).click();
  await page.locator(".fr-bulle-t", { hasText: "Revue DOE" }).waitFor();
  await page.getByRole("radio", { name: "Métro" }).click();
  await page.getByRole("button", { name: /^Visite DREAL, station le / }).waitFor();
  assert.equal((await valeur("nexora:futurPrefs")).frise.style, "metro");
  await capture("15-metro");
  await page.getByRole("radio", { name: "Barres" }).click();

  etape = "densité : mois, croisée, pixels"; console.log("→", etape);
  await page.keyboard.press("7");
  const finRevue = (await tache("t4")).end;
  await page.getByRole("button", { name: new RegExp(`^${finRevue} : \\d+ tâche`) }).click();
  await page.getByRole("complementary", { name: /^Échéances du / }).getByText("Revue DOE").waitFor();
  await page.getByRole("radio", { name: "Croisée" }).click();
  await page.getByRole("button", { name: /^CTEX6 × À planifier : 2$/ }).click();
  await page.getByRole("complementary", { name: "CTEX6 × À planifier" }).getByText("PV Contrôles DREAL").waitFor();
  await page.getByRole("radio", { name: "Pixels" }).click();
  await page.getByRole("table", { name: "Pixel Tasks" }).waitFor();
  assert.ok(await page.getByRole("button", { name: /, en retard$/ }).count() > 0, "pixels en retard");
  await capture("16-densite");

  etape = "synthèse : indicateurs, graphique, treemap, notes"; console.log("→", etape);
  await page.keyboard.press("8");
  const kpi = page.getByRole("region", { name: "Indicateurs" });
  await kpi.waitFor();
  assert.match(await kpi.textContent(), /Jalons2/);
  await page.getByLabel("Style du graphique").selectOption("pie");
  await page.getByRole("img", { name: /^Camembert : / }).waitFor();
  await page.getByLabel("Style du graphique").selectOption("completedPerWeek");
  await page.getByRole("img", { name: /^Terminées par semaine/ }).waitFor();
  // Les terminées comptent même quand la requête les masque (Réunion Expert, close il y a 9 jours).
  assert.ok(await page.locator(".sy-svg rect title", { hasText: /: 1$/ }).count() >= 1, "une semaine avec une tâche terminée");
  const notes = page.getByRole("region", { name: "Notes des tableaux de bord" });
  await notes.getByText("Consignes de la semaine").waitFor();
  assert.equal(await notes.getByRole("link", { name: "le plan" }).getAttribute("href"), "https://example.invalid/plan");
  // Note éditable (#663).
  await page.getByRole("button", { name: "Modifier la note Consignes de la semaine" }).click();
  const txt = page.getByLabel("Texte de la note Consignes de la semaine");
  await txt.fill("## Priorités\n- [x] Visite DREAL préparée");
  await page.getByRole("article", { name: "Note Consignes de la semaine" }).getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForFunction(() => JSON.stringify(window.__nexoraDemo.valeur("nexora:dashboards") || []).includes("Visite DREAL préparée"));
  await capture("17-synthese");
  await page.getByRole("listitem", { name: /^CTEX6 : / }).click();
  await page.waitForFunction(() => location.pathname === "/projets/p-ctex6");

  etape = "finances : synthèse, catégorisation, transactions, patrimoine"; console.log("→", etape);
  await page.keyboard.press("g"); await page.keyboard.press("f");
  await page.getByRole("region", { name: /^Budget de / }).getByText("Reste à dépenser").waitFor();
  await page.getByRole("list", { name: "Suivi par catégorie" }).getByText("Loisirs").waitFor();
  await page.getByLabel("Période de la synthèse").selectOption("previousYear");
  await page.getByRole("region", { name: "Synthèse sur une période" }).getByText(/^du 01\/01\/\d{4} au 31\/12\/\d{4}$/).waitFor();
  await page.getByRole("radio", { name: /^À catégoriser \(3\)/ }).click();
  await page.getByLabel("Catégorie de Achat CB 4521").selectOption("Alimentation");
  await page.getByLabel("Sous-catégorie de Achat CB 4521").selectOption("Courses");
  await page.getByRole("row", { name: /Achat CB 4521/ }).getByRole("button", { name: "Valider" }).click();
  await page.locator(".notif", { hasText: "« Achat CB 4521 » classée en Alimentation · Courses." }).waitFor();
  await page.getByRole("radio", { name: /^À catégoriser \(2\)/ }).waitFor();
  assert.deepEqual(await page.evaluate(() => { const t = window.__nexoraDemo.finance.etat().find((x) => x.label === "Achat CB 4521"); return [t.category, t.subcategory, t.confidence]; }), ["Alimentation", "Courses", 1]);
  await capture("18-finances-categoriser");
  await page.getByRole("radio", { name: "Transactions" }).click();
  await page.getByLabel("Rechercher une transaction").fill("escalade");
  await page.getByRole("table", { name: "Liste des transactions" }).getByText("Salle d'escalade").waitFor();
  await page.getByRole("radio", { name: "Patrimoine" }).click();
  await page.getByRole("img", { name: /^Patrimoine net : / }).waitFor();
  await page.getByRole("radio", { name: "Banque", exact: true }).first().click();
  await capture("19-finances-patrimoine");

  etape = "finances : graphiques, cumul, flux, pro, burn rate"; console.log("→", etape);
  await page.getByRole("radio", { name: "Graphiques" }).click();
  const cascade = page.getByRole("list", { name: /^Cascade/ });
  await cascade.getByText("Solde net").waitFor();
  assert.ok(await cascade.getByText("À classer").count() === 0, "l'opération catégorisée a quitté « À classer »");
  await page.getByLabel("Mode du cumul").selectOption("categories");
  await page.getByRole("img", { name: /^Cumul Par catégorie/ }).waitFor();
  await page.getByLabel("Mode du cumul").selectOption("multiples");
  await page.locator(".fi-multiple", { hasText: "Logement" }).waitFor();
  await page.getByRole("radio", { name: "Flux", exact: true }).click();
  await page.getByRole("img", { name: /^Flux : \d+ liaisons$/ }).waitFor();
  await page.getByRole("radiogroup", { name: "Type de flux" }).getByRole("radio", { name: "Patrimoine" }).click();
  await page.getByRole("img", { name: /^Flux : / }).waitFor();
  await capture("20-finances-flux");
  await page.getByRole("radio", { name: /^Pro :/ }).click();
  assert.match(await page.locator(".sy-carte", { hasText: "CA signé" }).textContent(), /13\s500,00/);
  await page.getByRole("region", { name: "Échéances de facturation" }).getByText("Fin des études").waitFor();
  await page.getByRole("radio", { name: /^Devis/ }).click();
  await page.getByRole("row", { name: /2026-005.*Expiré/ }).waitFor();
  await page.getByRole("radio", { name: /^Factures/ }).click();
  await page.getByRole("row", { name: /F-2026-008.*En retard/ }).waitFor();
  await capture("21-finances-pro");
  await page.goto(`http://127.0.0.1:${PORT}/projets/p-ctex6`);
  await page.getByRole("region", { name: "Budget du projet" }).getByText("Rythme (burn rate)").waitFor();

  etape = "mode sombre"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/projets/p-ctex6?t=t2`);
  await page.getByRole("complementary", { name: /Fiche : PV Contrôles DREAL/ }).waitFor();
  await page.keyboard.press("Control+k"); await page.getByRole("combobox", { name: "Saisie de la palette" }).waitFor(); await page.keyboard.type(">sombre"); await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await capture("5-sombre");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), "sombre");

  assert.deepEqual(erreurs, [], "aucune erreur de console");
  console.log(`Parcours e2e : OK (${(await import("node:fs")).readFileSync(new URL(import.meta.url), "utf8").match(/^  etape = "/gm).length} étapes)`);
} catch (e) {
  console.error(`Parcours e2e en échec à l'étape « ${etape} » :`, e.message, erreurs);
  await page?.screenshot({ path: `${sortie}/echec.png` }).catch(() => {});
  console.error("Adresse au moment de l'échec :", page?.url());
  process.exitCode = 1;
} finally {
  await navigateur.close(); vite.kill();
  process.exit(process.exitCode ?? 0);
}
