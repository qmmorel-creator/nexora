// Actions du Cockpit (Ref #655) : chaque action est une mutation rejouable,
// accompagnée de son inverse pour « Annuler ».
import type { Mutation } from "../donnees/magasin";
import { archiver, basculerTerminee, creerTache, dupliquer, modifierPlusieurs, modifierTache, restaurer, statutSuivant, type Brouillon } from "../donnees/operations";
import type { Tache } from "../donnees/modele";

// Remet des tâches dans l'état capturé (si elles existent encore).
export const remettre = (versions: Tache[]): Mutation => (taches) => {
  const parId = new Map(versions.map((v) => [v.id, v]));
  return { taches: taches.map((t) => parId.get(t.id) ?? t) };
};
export const retirer = (ids: string[]): Mutation => (taches) => ({ taches: taches.filter((t) => !ids.includes(t.id)) });

export const modifier = (id: string, patch: Partial<Tache>): Mutation => (taches, _a, cat) => ({ taches: modifierTache(taches, id, patch, cat) });
export const basculer = (id: string, sortie: { occurrence?: Tache } = {}): Mutation => (taches, _a, cat) => {
  const r = basculerTerminee(taches, id, cat);
  sortie.occurrence = r.occurrence;
  return { taches: r.taches };
};
export const statutCyclique = (id: string): Mutation => (taches, _a, cat) => {
  const t = taches.find((x) => x.id === id);
  return t ? { taches: modifierTache(taches, id, { statusId: statutSuivant(t, cat) }, cat) } : {};
};
export const archiverTache = (id: string): Mutation => (taches, archive) => archiver(taches, archive, id, new Date().toISOString());
export const restaurerTache = (id: string): Mutation => (taches, archive) => restaurer(taches, archive, id);
export const creer = (b: Brouillon, aujourdhui: string, id: string): Mutation => (taches, _a, cat) => ({ taches: creerTache(taches, b, cat, aujourdhui, id).taches });
export const dupliquerTache = (id: string, nouvel: { id?: string }): Mutation => (taches, _a, cat) => {
  const r = dupliquer(taches, id, cat);
  nouvel.id = r.tache.id;
  return { taches: r.taches };
};

// Tableur (Ref #658) : en masse. `bilan` reçoit le décompte de la dernière
// application (rejouable sur conflit).
export const masse = (ids: string[], patch: (t: Tache) => Partial<Tache> | null, bilan: { modifiees?: number; refusees?: number } = {}): Mutation => (taches, _a, cat) => {
  const r = modifierPlusieurs(taches, ids, patch, cat);
  bilan.modifiees = r.modifiees; bilan.refusees = r.refusees;
  return { taches: r.taches };
};
export const archiverPlusieurs = (ids: string[]): Mutation => (taches, archive) => {
  const at = new Date().toISOString();
  let r = { taches, archive };
  for (const id of ids) if (r.taches.some((t) => t.id === id)) r = archiver(r.taches, r.archive, id, at);
  return r;
};
export const restaurerPlusieurs = (ids: string[]): Mutation => (taches, archive) => {
  let r = { taches, archive };
  for (const id of ids) if (r.archive.some((t) => t.id === id)) r = restaurer(r.taches, r.archive, id);
  return r;
};
export const dupliquerPlusieurs = (ids: string[], nouveaux: { ids?: string[] }): Mutation => (taches, _a, cat) => {
  let r = taches; const n: string[] = [];
  for (const id of ids) if (r.some((t) => t.id === id)) { const x = dupliquer(r, id, cat); r = x.taches; n.push(x.tache.id); }
  nouveaux.ids = n;
  return { taches: r };
};
