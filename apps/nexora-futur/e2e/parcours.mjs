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
try {
  const page = await navigateur.newPage({ viewport: { width: 1500, height: 920 } });
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
  await page.goto(`http://127.0.0.1:${PORT}/projets/p-lot2b?retard=1`);
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

  etape = "mode sombre"; console.log("→", etape);
  await page.goto(`http://127.0.0.1:${PORT}/projets/p-ctex6?t=t2`);
  await page.getByRole("complementary", { name: /Fiche : PV Contrôles DREAL/ }).waitFor();
  await page.keyboard.press("Control+k"); await page.getByRole("combobox", { name: "Saisie de la palette" }).waitFor(); await page.keyboard.type(">sombre"); await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await capture("5-sombre");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), "sombre");

  assert.deepEqual(erreurs, [], "aucune erreur de console");
  console.log("Parcours e2e : OK (10 étapes)");
} catch (e) {
  console.error(`Parcours e2e en échec à l'étape « ${etape} » :`, e.message, erreurs);
  process.exitCode = 1;
} finally {
  await navigateur.close(); vite.kill();
  process.exit(process.exitCode ?? 0);
}
