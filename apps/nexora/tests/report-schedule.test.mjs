import test from "node:test";
import assert from "node:assert/strict";
import { parisLocalClock, shouldRunReport } from "../lib/report-period.mjs";

// Les deux rapports planifiés sont programmés deux fois par jour, à une heure
// d'intervalle (`0 5,6 * * *` et `30 18,19 * * *`). Selon la saison, c'est la première
// ou la seconde invocation qui tombe sur l'heure de Paris voulue ; l'autre doit être
// écartée. Ce qui compte ici, c'est qu'il en passe TOUJOURS exactement une — jamais
// zéro (pas de rapport ce jour-là), jamais deux (rapport en double).

const MATIN = { heure: 7, minute: 0, cron: [5, 6] };
const SOIR = { heure: 20, minute: 30, cron: [18, 19] };

/** Invocations réelles d'un cron UTC, un jour donné, décalées de `retardMin`. */
function invocations({ cron, minute }, jourUtc, retardMin = 0) {
  return cron.map(h => new Date(Date.UTC(...jourUtc, h, minute + retardMin, 0)));
}

function combienPassent(cible, jourUtc, retardMin = 0) {
  return invocations(cible, jourUtc, retardMin)
    .filter(at => shouldRunReport(parisLocalClock(at), cible.heure, cible.minute))
    .length;
}

// 15 janvier : heure d'hiver (CET, UTC+1). 15 juillet : heure d'été (CEST, UTC+2).
const HIVER = [2026, 0, 15];
const ETE = [2026, 6, 15];

for (const [nom, cible] of [["matin", MATIN], ["soir", SOIR]]) {
  for (const [saison, jour] of [["hiver", HIVER], ["été", ETE]]) {
    test(`${nom} / ${saison} : exactement une invocation produit le rapport`, () => {
      assert.equal(combienPassent(cible, jour), 1);
    });

    // Le cœur du correctif : un déclenchement retardé ne doit plus annuler la journée.
    for (const retard of [1, 5, 15]) {
      test(`${nom} / ${saison} : un retard de ${retard} min laisse passer une invocation`, () => {
        assert.equal(combienPassent(cible, jour, retard), 1);
      });
    }

    // Et la fenêtre doit rester assez étroite pour que les deux invocations, séparées
    // d'une heure, ne passent jamais ensemble.
    test(`${nom} / ${saison} : jamais deux invocations, même très en retard`, () => {
      for (let retard = 0; retard <= 59; retard += 1) {
        assert.ok(combienPassent(cible, jour, retard) <= 1,
          `${retard} min de retard : rapport produit deux fois`);
      }
    });
  }
}

test("l'ancien garde à la minute exacte perdait le rapport au moindre retard", () => {
  // Reproduction du comportement d'avant le correctif, pour figer la régression.
  const ancien = (local) => local.hour === MATIN.heure && local.minute === MATIN.minute;
  const perdu = invocations(MATIN, HIVER, 1).filter(at => ancien(parisLocalClock(at))).length;
  assert.equal(perdu, 0, "l'ancien garde laissait passer quelque chose : la reproduction est fausse");
  assert.equal(combienPassent(MATIN, HIVER, 1), 1, "le nouveau garde doit, lui, produire le rapport");
});

test("la tolérance est symétrique et bornée", () => {
  assert.ok(shouldRunReport({ hour: 7, minute: 0 }, 7, 0));
  assert.ok(shouldRunReport({ hour: 6, minute: 40 }, 7, 0), "20 min d'avance : dans la fenêtre");
  assert.ok(shouldRunReport({ hour: 7, minute: 20 }, 7, 0), "20 min de retard : dans la fenêtre");
  assert.ok(!shouldRunReport({ hour: 6, minute: 39 }, 7, 0), "21 min d'avance : hors fenêtre");
  assert.ok(!shouldRunReport({ hour: 7, minute: 21 }, 7, 0), "21 min de retard : hors fenêtre");
  assert.ok(!shouldRunReport({ hour: 8, minute: 0 }, 7, 0), "l'autre invocation reste écartée");
  assert.ok(!shouldRunReport({ hour: 6, minute: 0 }, 7, 0), "l'autre invocation reste écartée");
});
