import { describe, expect, it } from "vitest";
import { correspond, dansPreselection, filtresParDefaut, metaFiltresParDefaut, normaliserFiltres, SANS_PROJET, SANS_RESPONSABLE, type Contexte } from "../src/donnees/filtres";
import { PARAMS_RESERVES, depuisParams, grouper, requeteParDefaut, trier, versFiltres, versParams } from "../src/donnees/requete";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const ctx: Contexte = { projets: CAT.projets, statuts: CAT.statuts, types: CAT.types, aujourdhui: "2026-10-03", maintenant: new Date("2026-10-03T12:00:00Z") };
const T: Tache[] = [
  { id: "a", title: "Revue DOE", projectId: "p2", statusId: "s3", end: "2026-10-10", assignee: "Quentin Morel", criticality: "moyen", progress: 35 },
  { id: "b", title: "PV Contrôles DREAL", projectId: "p1", statusId: "s1", end: "2026-08-15", assignee: "Vincent B.", criticality: "urgent", progress: 0, lastInteraction: "2026-08-01T00:00:00Z" },
  { id: "c", title: "Clôture", projectId: "p1", secondaryProjectId: "p2", statusId: "s5", end: "2026-09-01", progress: 100 },
  { id: "d", title: "Sans projet", statusId: "s1", end: "2026-10-05", focus: true },
];
const ids = (f: Parameters<typeof correspond>[1]) => T.filter((t) => correspond(t, f, ctx)).map((t) => t.id);

describe("filtres (port de matchTaskFilters)", () => {
  it("défaut : terminées masquées ; méta-filtres : visibles", () => {
    expect(ids(filtresParDefaut())).toEqual(["a", "b", "d"]);
    expect(ids(metaFiltresParDefaut())).toEqual(["a", "b", "c", "d"]);
  });
  it("recherche dans le foin (projet, statut, responsable), sensible aux accents comme l'original", () => {
    expect(ids({ ...filtresParDefaut(), search: "vincent" })).toEqual(["b"]);
    expect(ids({ ...filtresParDefaut(), search: "lot 2b" })).toEqual(["a"]);
    expect(ids({ ...filtresParDefaut(), search: "controles" })).toEqual([]);
  });
  it("retard, urgent, focus, échéance proche, inactivité", () => {
    expect(ids({ ...filtresParDefaut(), lateOnly: true })).toEqual(["b"]);
    expect(ids({ ...filtresParDefaut(), urgentOnly: true })).toEqual(["b"]);
    expect(ids({ ...filtresParDefaut(), focus: "yes" })).toEqual(["d"]);
    expect(ids({ ...filtresParDefaut(), dueWithinDays: 7 })).toEqual(["a", "d"]);
    expect(ids({ ...filtresParDefaut(), dueWithinDays: 2 })).toEqual(["d"]);
    expect(ids({ ...filtresParDefaut(), inactivityDays: 30 })).toEqual(["a", "b", "d"]);
  });
  it("conditions avancées : projet principal ou secondaire, sentinelles, groupes OU", () => {
    const f = (items: never[], op: "and" | "or" = "and") => ({ ...metaFiltresParDefaut(), advanced: { op, items } });
    expect(ids(f([{ field: "project", mode: "is", values: ["p2"] }] as never[]))).toEqual(["a", "c"]);
    expect(ids(f([{ field: "project", mode: "is", values: [SANS_PROJET] }] as never[]))).toEqual(["d"]);
    expect(ids(f([{ field: "assignee", mode: "is", values: [SANS_RESPONSABLE] }] as never[]))).toEqual(["c", "d"]);
    expect(ids(f([{ field: "criticality", mode: "is", values: ["urgent"] }, { field: "focus", mode: "is", values: ["yes"] }] as never[], "or"))).toEqual(["b", "d"]);
    // Samedi 3 octobre : semaine en cours du lundi 28/09 au dimanche 4/10.
    expect(ids(f([{ field: "end", mode: "is", datePreset: "this_week" }] as never[]))).toEqual([]);
    expect(ids(f([{ field: "end", mode: "is", datePreset: "next_week" }] as never[]))).toEqual(["a", "d"]);
  });
  it("préréglages de dates (semaine du lundi)", () => {
    expect(dansPreselection("2026-09-28", "this_week", "2026-10-03")).toBe(true);
    expect(dansPreselection("2026-10-05", "next_week", "2026-10-03")).toBe(true);
    expect(dansPreselection("2026-10-31", "this_month", "2026-10-03")).toBe(true);
  });
  it("complète un filtre ancien sans champs récents", () => {
    expect(normaliserFiltres({ showDone: true })).toMatchObject({ showDone: true, focus: "all", advanced: { op: "and", items: [] } });
  });
});

describe("requête, adresse, tri, regroupement", () => {
  it("aller-retour par l'adresse", () => {
    const r = { ...requeteParDefaut(), projets: ["p1", "p2"], retard: true, texte: "DREAL", tri: { champ: "criticality" as const, sens: "desc" as const }, groupe: "project" as const };
    expect(versParams(r).toString()).toBe("p=p1%2Cp2&q=DREAL&retard=1&tri=criticality%3Adesc&grp=project");
    expect(depuisParams(versParams(r))).toEqual(r);
    expect(versParams(requeteParDefaut()).toString()).toBe("");
  });
  it("n'utilise jamais les paramètres réservés du Cockpit (t = tâche, v = lentille)", () => {
    const r = depuisParams(new URLSearchParams("t=t2&v=colonnes&ty=tt3"));
    expect(r.types).toEqual(["tt3"]);
    const plein = versParams({ ...requeteParDefaut(), projets: ["a"], statuts: ["b"], responsables: ["c"], types: ["d"], criticites: ["e"], texte: "x", terminees: true, retard: true, urgent: true, focus: "yes", echeance: "today", tri: { champ: "title", sens: "desc" }, groupe: "project" });
    expect([...plein.keys()].filter((k) => PARAMS_RESERVES.includes(k))).toEqual([]);
  });
  it("la requête devient des filtres Nexora", () => {
    const f = versFiltres({ ...requeteParDefaut(), projets: ["p1"], urgent: true });
    expect(T.filter((t) => correspond(t, f, ctx)).map((t) => t.id)).toEqual(["b"]);
  });
  it("tri par criticité et par fin", () => {
    expect(trier(T, { champ: "criticality", sens: "desc" }, CAT).map((t) => t.id)).toEqual(["b", "a", "c", "d"]);
    expect(trier(T, { champ: "end", sens: "asc" }, CAT).map((t) => t.id)).toEqual(["b", "c", "d", "a"]);
  });
  it("regroupe dans l'ordre du catalogue, « Non défini » en dernier", () => {
    expect(grouper(T, "status", CAT).map((p) => [p.cle, p.taches.length])).toEqual([["s1", 2], ["s3", 1], ["s5", 1]]);
    expect(grouper(T, "project", CAT).map((p) => p.libelle)).toEqual(["CTEX6", "Lot 2B", "Non défini"]);
    expect(grouper(T, "period", CAT).map((p) => p.libelle)).toEqual(["août 2026", "septembre 2026", "octobre 2026"]);
  });
});
