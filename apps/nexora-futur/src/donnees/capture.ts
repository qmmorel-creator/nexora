// Capture externe (Ref #663) : même adresse que nexora-project
// (`?nexoraCapture=1&title=…&desc=…&due=…&project=…`, part-001:11763-11845),
// pour ChatGPT, un raccourci ou un lien. La demande survit à un rechargement
// (sessionStorage) jusqu'à la création de la tâche.
import type { PieceJointe, Projet, Tache } from "./modele";

export const CLE_CAPTURE = "nexora:pendingExternalCapture";
export interface Capture {
  title: string; desc: string; due: string; project: string; sourceUrl: string; sourceMessageId: string; sourceSender: string;
  source: string; driveUrl: string; driveName: string; capturedAt: string;
}
export function lireCapture(recherche: string, maintenant = new Date().toISOString()): Capture | null {
  const p = new URLSearchParams(recherche);
  if (p.get("nexoraCapture") !== "1") return null;
  const v = (k: string, d = "") => (p.get(k) || d).trim();
  const c: Capture = { title: v("title"), desc: v("desc"), due: v("due"), project: v("project", "Inbox") || "Inbox", sourceUrl: v("sourceUrl"), sourceMessageId: v("sourceMessageId"),
    sourceSender: v("sourceSender"), source: v("source", "gmail") || "gmail", driveUrl: v("driveUrl"), driveName: v("driveName"), capturedAt: maintenant };
  return c.title ? c : null;
}
const estDrive = (u: string) => /^https:\/\/(drive|docs)\.google\.com\//.test(u);
const genreDrive = (u: string) => (/\/folders\//.test(u) ? "folder" : "file");

// Tâche à créer : projet nommé (sans casse), sinon « Inbox », sinon le premier.
export function brouillonCapture(c: Capture, projets: Projet[], responsable: string, id: () => string): Partial<Tache> & { title: string } {
  const demande = c.project.trim().toLowerCase();
  const cible = projets.find((x) => (x.name || "").trim().toLowerCase() === demande) || projets.find((x) => (x.name || "").trim().toLowerCase() === "inbox") || projets[0];
  const due = /^\d{4}-\d{2}-\d{2}$/.test(c.due) ? c.due : "";
  const pj: PieceJointe[] = estDrive(c.driveUrl) ? [{ id: id(), type: "link", provider: "google-drive", driveKind: genreDrive(c.driveUrl),
    name: c.driveName || (genreDrive(c.driveUrl) === "folder" ? "Dossier Google Drive" : "Fichier Google Drive"), url: c.driveUrl, addedAt: c.capturedAt }] : [];
  return {
    title: c.title, desc: c.desc, projectId: cible?.id || undefined, ...(due ? { start: due, end: due, milestone: true } : {}),
    source: c.source, sourceUrl: c.sourceUrl, sourceMessageId: c.sourceMessageId, sourceSender: c.sourceSender, attachments: pj, assignee: responsable,
  };
}
