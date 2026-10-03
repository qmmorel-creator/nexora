import { describe, expect, it } from "vitest";
import { entreesStrava, normaliserLienStrava } from "../src/donnees/strava";
import { brouillonCapture, lireCapture } from "../src/donnees/capture";
import { sauvegarde, tachesCsv } from "../src/donnees/export";
import type { Activite } from "../src/donnees/sport";
import { CAT } from "./fixtures";

const act = (date: string, sport: string, total: number): Activite => ({ id: `${date}${sport}`, date, sport, title: "", total, moving: total, distance: null, elevation: null, hr: null, maxHr: null, url: null });

describe("liaison Strava (port de habitStravaEntries)", () => {
  const themes = [
    { id: "t", name: "Sport", color: "#000", selectionMode: "multi", habits: [{ id: "run", name: "Course", color: "#f00", kind: "check", strava: { sports: ["Course à pied"], minMinutes: 30, since: "2026-10-01" } }, { id: "x", name: "Sans lien", color: "#0f0", kind: "check" }] },
    { id: "u", name: "Lieu", color: "#00f", selectionMode: "single", habits: [{ id: "velo", name: "Vélo", color: "#0ff", kind: "check", strava: { sports: ["Vélo"] } }, { id: "bur", name: "Bureau", color: "#ff0", kind: "check" }] },
  ];
  it("lien normalisé : sports obligatoires, minutes arrondies, date ISO", () => {
    expect(normaliserLienStrava({ sports: ["A", "A", " "], minMinutes: "29.6", since: "x" })).toEqual({ sports: ["A"], minMinutes: 30, since: "" });
    expect(normaliserLienStrava({ sports: [] })).toBeNull();
  });
  it("coche seulement les jours qualifiants, non cochés, non « n/a », pas dans le futur, sans sœur en choix unique", () => {
    const acts = [act("2026-09-30", "Course à pied", 60), act("2026-10-01", "Course à pied", 20), act("2026-10-02", "Course à pied", 45), act("2026-10-03", "Course à pied", 45), act("2026-10-09", "Course à pied", 45),
      act("2026-10-02", "Vélo", 10), act("2026-10-03", "Vélo", 10)];
    const journal = [{ id: "bur|2026-10-02", habitId: "bur", date: "2026-10-02" }];
    const na = [{ id: "run|2026-10-03", habitId: "run", date: "2026-10-03" }];
    expect(entreesStrava(themes, journal, na, acts, "2026-10-04").map((e) => e.id)).toEqual(["run|2026-10-02", "velo|2026-10-03"]);
  });
});

describe("capture externe (?nexoraCapture=1)", () => {
  it("lit les paramètres, refuse sans titre", () => {
    expect(lireCapture("?nexoraCapture=1&desc=x")).toBeNull();
    expect(lireCapture("?title=A")).toBeNull();
    const c = lireCapture("?nexoraCapture=1&title=%20Relancer%20BC%20&due=2026-10-09&project=ctex6&driveUrl=https://drive.google.com/drive/folders/abc", "2026-10-03T08:00:00Z")!;
    expect([c.title, c.project, c.source]).toEqual(["Relancer BC", "ctex6", "gmail"]);
    const b = brouillonCapture(c, [{ id: "p1", name: "CTEX6" }], "Léa", () => "pj1");
    expect(b).toMatchObject({ title: "Relancer BC", projectId: "p1", start: "2026-10-09", end: "2026-10-09", milestone: true, assignee: "Léa" });
    expect(b.attachments).toEqual([{ id: "pj1", type: "link", provider: "google-drive", driveKind: "folder", name: "Dossier Google Drive", url: "https://drive.google.com/drive/folders/abc", addedAt: "2026-10-03T08:00:00Z" }]);
  });
  it("projet inconnu : Inbox, sinon le premier ; date invalide ignorée", () => {
    const c = lireCapture("?nexoraCapture=1&title=A&project=zzz&due=demain")!;
    expect(brouillonCapture(c, [{ id: "a", name: "A" }, { id: "i", name: "Inbox" }], "", () => "x")).toMatchObject({ projectId: "i" });
    expect(brouillonCapture(c, [{ id: "a", name: "A" }], "", () => "x").start).toBeUndefined();
  });
});

describe("exports", () => {
  it("CSV : BOM, séparateur ; et guillemets échappés", () => {
    const csv = tachesCsv([{ id: "t1", title: 'Dire "oui"; vite', projectId: "p1", statusId: "s5", desc: "a\nb" }], CAT);
    expect(csv.startsWith("﻿id;titre;projet")).toBe(true);
    expect(csv.split("\r\n")[1]).toBe('t1;"Dire ""oui""; vite";CTEX6;Terminé;;;;;;;;;;;oui;"a\nb"');
  });
  it("sauvegarde : valeur et révision de chaque clé", () => {
    const j = JSON.parse(sauvegarde({ taches: { cle: "nexora:tasks", texte: "[1]", revision: "r3" }, vide: null }, "2026-10-03"));
    expect(j).toEqual({ format: "nexora-futur-sauvegarde", version: 1, le: "2026-10-03", cles: { "nexora:tasks": { revision: "r3", valeur: [1] } } });
  });
});

import { actionDeTouche, normaliserRaccourcis, touches } from "../src/donnees/raccourcis";
import { sportCsv } from "../src/donnees/export";
describe("raccourcis réglables", () => {
  it("lettres valides et uniques ; une lettre reprise retire celle de l'autre action", () => {
    expect(normaliserRaccourcis({ terminer: "T", statut: "t", focus: "g", archiver: "1", inconnu: "z" })).toEqual({ terminer: "t" });
    const t = touches({ terminer: "s" });
    expect([t.terminer, t.statut, t.focus]).toEqual(["s", "", "f"]);
    expect(actionDeTouche(t, "s")).toBe("terminer");
    expect(actionDeTouche(t, "e")).toBeNull();
  });
  it("CSV du sport", () => {
    expect(sportCsv([{ date: "2026-10-01", sport: "Course", title: "Footing", total: 45, moving: 40, distance: 8.2, elevation: 30, hr: 140, url: null }]).split("\r\n")[1]).toBe("2026-10-01;Course;Footing;45;40;8.2;30;140;");
  });
});
