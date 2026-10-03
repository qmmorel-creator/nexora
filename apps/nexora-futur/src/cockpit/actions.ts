// Actions du Cockpit (Ref #655) : chaque action est une mutation rejouable,
// accompagnée de son inverse pour « Annuler ».
import type { Mutation } from "../donnees/magasin";
import { archiver, basculerTerminee, creerTache, dupliquer, modifierTache, restaurer, statutSuivant, type Brouillon } from "../donnees/operations";
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
