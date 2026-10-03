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
  const frise = page.locator(".fil-heures");
  const boite = await frise.boundingBox();
  await bac.locator(".fil-tache", { hasText: "Demande lame" }).dragTo(frise, { targetPosition: { x: boite.width / 2, y: 54 * 3 + 5 } });
  await page.waitForTimeout(250);
  const casee = (await taches()).find((t) => t.id === "t5");
  const auj = await page.evaluate(() => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  assert.equal(casee.end, auj, "replanifiée aujourd'hui");
  assert.match(casee.startTime, /^\d{2}:(00|15|30|45)$/, "heure calée au quart d'heure");
  await page.locator(".fil-ev", { hasText: "Demande lame" }).waitFor();

  etape = "fil du jour : bilan du soir et semaine"; console.log("→", etape);
  await page.getByRole("radio", { name: "Soir" }).click();
  assert.match(page.url(), /m=soir/);
  await page.locator(".fil-glisse", { hasText: "Demande lame" }).getByRole("button", { name: "Demain" }).click();
  await page.waitForTimeout(250);
  assert.ok((await taches()).find((t) => t.id === "t5").end > auj, "reportée à demain");
  await page.getByRole("radio", { name: "Semaine" }).click();
  assert.equal(await page.locator(".fil-sjour").count(), 7);
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
  await page.getByRole("region", { name: "Grille des habitudes" }).waitFor();
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
  const jourHab = page.getByRole("region", { name: "Habitudes, Aujourd'hui" });
  await jourHab.waitFor();
  await jourHab.getByRole("checkbox", { name: /Bureau/ }).click();
  await jourHab.getByRole("checkbox", { name: /Bureau/, checked: true }).waitFor();
  await jourHab.getByRole("checkbox", { name: /Télétravail/ }).click();
  await jourHab.getByRole("checkbox", { name: /Télétravail/, checked: true }).waitFor();
  assert.equal(await jourHab.getByRole("checkbox", { name: /Bureau/ }).getAttribute("aria-checked"), "false", "choix unique : Bureau décoché");
  await jourHab.getByRole("button", { name: "Augmenter Pas (milliers)" }).click();
  await jourHab.getByText("0/10").waitFor();
  await jourHab.getByRole("button", { name: "Augmenter Pas (milliers)" }).click();
  await jourHab.getByText("2/10").waitFor();
  await jourHab.getByRole("button", { name: "Méditation non applicable" }).click();
  await jourHab.getByRole("button", { name: "Méditation non applicable", pressed: true }).waitFor();
  const aujourdhui = await page.evaluate(() => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  const duJour = (await valeur("nexora:habitLog")).filter((e) => e.date === aujourdhui);
  assert.deepEqual(duJour.filter((e) => ["h4", "h5", "h6"].includes(e.habitId)).map((e) => [e.id, e.value]), [[`h4|${aujourdhui}`, 2], [`h6|${aujourdhui}`, undefined]]);
  assert.deepEqual((await valeur("nexora:habitSkips")).map((e) => e.id), [`h3|${aujourdhui}`]);
  await capture("10-corps-habitudes");
  // Hier, depuis la grille.
  await page.getByRole("button", { name: "Jour précédent" }).click();
  await page.getByRole("region", { name: "Habitudes, Hier" }).getByRole("checkbox", { name: /Bureau/ }).click();
  assert.ok((await valeur("nexora:habitLog")).some((e) => e.habitId === "h5" && e.date < aujourdhui), "habitude cochée pour hier");
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
  assert.deepEqual((await valeur("nexora:futurPrefs")).frise, { reference: "initiale", critique: true }, "réglages de la frise synchronisés");
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
