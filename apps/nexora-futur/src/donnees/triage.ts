// Triage par règles (Ref #661, lot 8). Décision de Quentin : pas d'IA. Chaque
// carte naît d'une règle lisible et réglable, et la cite ; les propositions
// viennent de calculs simples (jour le moins chargé, personne la moins
// chargée, projet nommé dans le titre, catégorie suggérée par le serveur).
import { ajouterJours, ecartJours, estEnRetard, estProjetCalendrier, estReunion, estTerminee, inactiviteJours, statutImpose, type Catalogues, type Tache } from "./modele";
import { etatsDuJour, type EntreeHabitude, type NonApplicable, type ThemeHabitudes } from "./habitudes";
import type { ACategoriser } from "./finance";
import { capacite, equipesDe, tachesActives, tachesDuJour, type MembreEquipe } from "./equipe";

export type RegleId = "retard" | "sans-date" | "sans-projet" | "assistant" | "dependance" | "reunion" | "operation" | "habitude" | "sport" | "glisse";
export type Moment = "matin" | "soir";
export interface ReglesTriage {
  actives: Record<RegleId, boolean>;
  retardJours: number;   // retard ET inactivité au-delà de N jours
  habitudeJours: number; // habitude manquée N jours de suite
  reunionJours: number;  // réunions passées examinées sur N jours
  revoirJours: number;   // « Revoir dans N jours »
}
export const REGLES_DEFAUT: ReglesTriage = {
  actives: { retard: true, "sans-date": true, "sans-projet": true, assistant: true, dependance: true, reunion: true, operation: true, habitude: true, sport: true, glisse: true },
  retardJours: 3, habitudeJours: 3, reunionJours: 14, revoirJours: 3,
};
export const LIBELLES_REGLES: Record<RegleId, string> = {
  retard: "Tâche en retard sans activité", "sans-date": "Tâche sans date", "sans-projet": "Tâche sans projet", assistant: "Créé par l'assistant, à ranger",
  dependance: "Dépendance qui bloque un jalon", reunion: "Réunion sans compte rendu", operation: "Opération à catégoriser", habitude: "Habitude manquée",
  sport: "Objectif sport en retard", glisse: "Échéance du jour non faite",
};
const entier = (v: unknown, d: number, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
export function normaliserRegles(v: unknown): ReglesTriage {
  const b = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const a = b.actives && typeof b.actives === "object" ? (b.actives as Record<string, unknown>) : {};
  const actives = Object.fromEntries(Object.keys(REGLES_DEFAUT.actives).map((k) => [k, a[k] !== false])) as Record<RegleId, boolean>;
  return { actives, retardJours: entier(b.retardJours, 3, 0, 90), habitudeJours: entier(b.habitudeJours, 3, 2, 30), reunionJours: entier(b.reunionJours, 14, 1, 90), revoirJours: entier(b.revoirJours, 3, 1, 30) };
}
// Reports (« Revoir dans N jours ») : clé de carte → date de retour ; les reports échus sont oubliés.
export function nettoyerReports(v: unknown, jour: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object") Object.entries(v as Record<string, unknown>).forEach(([k, d]) => { if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > jour) out[k] = d; });
  return out;
}

export type Action =
  | { genre: "dater"; id: string; date: string }
  | { genre: "faite"; id: string }
  | { genre: "reassigner"; id: string; qui: string }
  | { genre: "projet"; id: string; projectId: string }
  | { genre: "archiver"; id: string }
  | { genre: "ouvrir"; id: string }
  | { genre: "categoriser"; op: ACategoriser; category: string; subcategory: string | null }
  | { genre: "habitude"; habitId: string; date: string; na: boolean }
  | { genre: "aller"; chemin: string }
  | { genre: "revoir" };
export interface Choix { touche: string; libelle: string; detail?: string; action: Action; }
export interface Carte {
  cle: string; regle: RegleId; titre: string; meta: string; motif: string;
  proposition: string | null; choix: Choix[]; tacheId?: string;
}

export interface Contexte extends Catalogues {
  taches: Tache[]; jour: string; maintenant?: Date;
  membres: MembreEquipe[];
  journalHabitudes: EntreeHabitude[]; nonApplicables: NonApplicable[]; themesHabitudes: ThemeHabitudes[];
  operations?: ACategoriser[]; categories?: { name: string; subcategories: string[] }[];
  sport?: { cible: number; fait: number } | null;
}

const jourFr = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const ouvre = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; };
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Jour ouvré le moins chargé pour une personne dans les `n` prochains (le
// premier en cas d'égalité) : tâches actives ce jour-là rapportées à sa capacité.
const indexActives = new WeakMap<Tache[], ReturnType<typeof tachesActives>>();
export function jourLibre(ctx: Contexte, qui: string | undefined, n = 10): string {
  let index = indexActives.get(ctx.taches);
  if (!index) { index = tachesActives(ctx.taches, ctx.statuts); indexActives.set(ctx.taches, index); }
  const cap = capacite(ctx.membres.find((m) => m.name === qui)?.capacityPerDay);
  let meilleur = ""; let charge = Infinity;
  for (let i = 1, vus = 0; vus < n && i < 30; i++) {
    const d = ajouterJours(ctx.jour, i); if (!ouvre(d)) continue; vus++;
    const c = qui ? tachesDuJour(index, qui, d).length / cap : 0;
    if (c < charge) { charge = c; meilleur = d; }
    if (c === 0) break;
  }
  return meilleur || ajouterJours(ctx.jour, 1);
}
// Personne la moins chargée parmi celles qui partagent une équipe (sinon l'annuaire).
export function relaisPour(ctx: Contexte, qui: string | undefined): string | null {
  const m = ctx.membres.find((x) => x.name === qui); const eq = new Set(equipesDe(m));
  const candidats = ctx.membres.filter((x) => x.name !== qui && !x.inactive && (!eq.size || equipesDe(x).some((id) => eq.has(id))));
  const ouvertes = (n: string) => ctx.taches.filter((t) => t.assignee === n && !estTerminee(t, ctx.statuts)).length;
  return candidats.sort((a, b) => ouvertes(a.name) - ouvertes(b.name) || a.name.localeCompare(b.name, "fr"))[0]?.name || null;
}
// Projet probable : nommé dans le titre, sinon le plus fréquent chez la personne.
export function projetProbable(ctx: Contexte, t: Tache): { id: string; raison: string } | null {
  const titre = sansAccents(t.title || "");
  const nomme = ctx.projets.filter((p) => !estProjetCalendrier(ctx.projets, p.id) && p.name && sansAccents(p.name).length >= 3 && titre.includes(sansAccents(p.name)))[0];
  if (nomme) return { id: nomme.id, raison: `« ${nomme.name} » est dans le titre` };
  if (t.assignee) {
    const n = new Map<string, number>();
    ctx.taches.forEach((x) => { if (x.id !== t.id && x.assignee === t.assignee && x.projectId && !estProjetCalendrier(ctx.projets, x.projectId)) n.set(x.projectId, (n.get(x.projectId) || 0) + 1); });
    const top = [...n.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) return { id: top[0], raison: `projet le plus fréquent de ${t.assignee}` };
  }
  return null;
}
const nomProjet = (ctx: Contexte, id?: string) => ctx.projets.find((p) => p.id === id)?.name || "Sans projet";
const aTrier = (ctx: Contexte, t: Tache) => !t.projectId || ctx.projets.find((p) => p.id === t.projectId)?.folderId === "folder-a-trier";
const triable = (ctx: Contexte, t: Tache) => !estTerminee(t, ctx.statuts) && !estProjetCalendrier(ctx.projets, t.projectId) && !statutImpose(ctx.types, ctx.statuts, t.taskTypeId);

function choixTache(t: Tache, regles: ReglesTriage, extra: Choix[]): Choix[] {
  return [...extra, { touche: "F", libelle: "Faite", action: { genre: "faite", id: t.id } }, { touche: "N", libelle: `Revoir dans ${regles.revoirJours} jours`, action: { genre: "revoir" } }, { touche: "A", libelle: "Archiver", action: { genre: "archiver", id: t.id } }];
}
const choixProjets = (ctx: Contexte, t: Tache, sauf?: string): Choix[] => ctx.projets.filter((p) => p.id !== sauf && !estProjetCalendrier(ctx.projets, p.id) && p.folderId !== "folder-a-trier").slice(0, 4)
  .map((p, i) => ({ touche: String(i + 1), libelle: p.name || p.id, action: { genre: "projet", id: t.id, projectId: p.id } as Action }));

export function cartesTriage(ctx: Contexte, regles: ReglesTriage, moment: Moment, reports: Record<string, string> = {}): Carte[] {
  const c: Carte[] = []; const vus = new Set<string>(); const on = regles.actives;
  const ajouter = (x: Carte) => { if (reports[x.cle] || (x.tacheId && vus.has(x.tacheId))) return; if (x.tacheId) vus.add(x.tacheId); c.push(x); };
  const { jour } = ctx;
  if (moment === "soir") {
    if (on.glisse) ctx.taches.filter((t) => triable(ctx, t) && t.end === jour).forEach((t) => {
      const d = jourLibre(ctx, t.assignee);
      ajouter({ cle: `glisse:${t.id}:${jour}`, regle: "glisse", tacheId: t.id, titre: t.title || "Sans titre", meta: `${nomProjet(ctx, t.projectId)} · ${t.assignee || "sans responsable"} · échéance aujourd'hui`, motif: LIBELLES_REGLES.glisse,
        proposition: `Reporter au ${jourFr(d)}, jour le moins chargé${t.assignee ? ` de ${t.assignee}` : ""}`, choix: choixTache(t, regles, [{ touche: "Entrée", libelle: "Reporter", detail: jourFr(d), action: { genre: "dater", id: t.id, date: d } }]) });
    });
    if (on.reunion) ctx.taches.filter((t) => estReunion(t, ctx.types) && t.end === jour && !(t.meetingReport || "").trim()).forEach((t) => ajouter(carteReunion(ctx, t, regles)));
    if (on.habitude) {
      const e = etatsDuJour(ctx.themesHabitudes, ctx.journalHabitudes, ctx.nonApplicables, jour);
      e.parTheme.filter(({ theme }) => theme.selectionMode !== "single").forEach(({ habitudes }) => habitudes.filter((x) => x.etat === "a-faire" && x.h.kind !== "numeric").forEach(({ h }) => ajouter({
        cle: `habitude-soir:${h.id}:${jour}`, regle: "habitude", titre: `${h.name} : pas encore cochée`, meta: "aujourd'hui", motif: "Habitude du jour non cochée",
        proposition: "Cocher si c'est fait, sinon la marquer non applicable", choix: [
          { touche: "Entrée", libelle: "Cocher aujourd'hui", action: { genre: "habitude", habitId: h.id, date: jour, na: false } },
          { touche: "X", libelle: "Non applicable aujourd'hui", action: { genre: "habitude", habitId: h.id, date: jour, na: true } },
          { touche: "N", libelle: "Laisser", action: { genre: "revoir" } }],
      })));
    }
    return c;
  }
  // --- Matin ---
  if (on.retard) ctx.taches.filter((t) => triable(ctx, t) && estEnRetard(t, ctx.statuts, jour) && ecartJours(t.end!, jour) > regles.retardJours && inactiviteJours(t, ctx.maintenant) > regles.retardJours)
    .sort((a, b) => (a.end || "").localeCompare(b.end || "")).forEach((t) => {
      const d = jourLibre(ctx, t.assignee); const r = relaisPour(ctx, t.assignee);
      ajouter({ cle: `retard:${t.id}:${t.end}`, regle: "retard", tacheId: t.id, titre: t.title || "Sans titre", meta: `${nomProjet(ctx, t.projectId)} · ${t.assignee || "sans responsable"} · échéance ${dm(t.end)}`,
        motif: `En retard de ${ecartJours(t.end!, jour)} jours, sans activité depuis plus de ${regles.retardJours} jours (réglage : ${regles.retardJours} j)`,
        proposition: `Dater au ${jourFr(d)}, jour le moins chargé${t.assignee ? ` de ${t.assignee}` : ""}`,
        choix: choixTache(t, regles, [{ touche: "Entrée", libelle: "Dater", detail: jourFr(d), action: { genre: "dater", id: t.id, date: d } }, ...(r ? [{ touche: "R", libelle: "Réassigner", detail: r, action: { genre: "reassigner", id: t.id, qui: r } as Action }] : [])]) });
    });
  if (on.dependance) ctx.taches.filter((m) => m.milestone && !estTerminee(m, ctx.statuts) && m.start && m.start >= jour && (m.dependsOn || []).length).forEach((m) => {
    (m.dependsOn || []).map((id) => ctx.taches.find((x) => x.id === id)).filter((t): t is Tache => !!t && !estTerminee(t, ctx.statuts) && !!t.end && (t.end >= m.start! || t.end < jour)).forEach((t) => {
      const cible = ajouterJours(m.start!, -1); const d = cible > jour ? cible : ajouterJours(jour, 1);
      ajouter({ cle: `dependance:${t.id}:${m.id}`, regle: "dependance", tacheId: t.id, titre: `« ${t.title} » bloque le jalon « ${m.title} »`, meta: `${nomProjet(ctx, m.projectId)} · jalon le ${dm(m.start)} · échéance actuelle ${dm(t.end)}`,
        motif: LIBELLES_REGLES.dependance, proposition: `Ramener l'échéance au ${jourFr(d)}, la veille du jalon`,
        choix: choixTache(t, regles, [{ touche: "Entrée", libelle: "Ramener", detail: jourFr(d), action: { genre: "dater", id: t.id, date: d } }, { touche: "O", libelle: "Ouvrir le jalon", action: { genre: "ouvrir", id: m.id } }]) });
    });
  });
  if (on.reunion) ctx.taches.filter((t) => estReunion(t, ctx.types) && !!t.end && t.end < jour && t.end >= ajouterJours(jour, -regles.reunionJours) && !(t.meetingReport || "").trim())
    .sort((a, b) => (b.end || "").localeCompare(a.end || "")).forEach((t) => ajouter(carteReunion(ctx, t, regles)));
  if (on.assistant) ctx.taches.filter((t) => triable(ctx, t) && !!t.source && aTrier(ctx, t)).forEach((t) => ajouter(carteRanger(ctx, t, regles, "assistant")));
  if (on["sans-projet"]) ctx.taches.filter((t) => triable(ctx, t) && aTrier(ctx, t)).forEach((t) => ajouter(carteRanger(ctx, t, regles, "sans-projet")));
  if (on["sans-date"]) ctx.taches.filter((t) => triable(ctx, t) && !t.end).forEach((t) => {
    const d = jourLibre(ctx, t.assignee);
    ajouter({ cle: `sans-date:${t.id}`, regle: "sans-date", tacheId: t.id, titre: t.title || "Sans titre", meta: `${nomProjet(ctx, t.projectId)} · ${t.assignee || "sans responsable"}`, motif: LIBELLES_REGLES["sans-date"],
      proposition: `Dater au ${jourFr(d)}, jour le moins chargé${t.assignee ? ` de ${t.assignee}` : ""}`, choix: choixTache(t, regles, [{ touche: "Entrée", libelle: "Dater", detail: jourFr(d), action: { genre: "dater", id: t.id, date: d } }]) });
  });
  if (on.operation) (ctx.operations || []).forEach((o) => {
    const cats = ctx.categories || [];
    const propre = cats.find((x) => x.name === o.category);
    const prete = propre && (!propre.subcategories.length || (o.subcategory && propre.subcategories.includes(o.subcategory)));
    const autres = cats.filter((x) => x.name !== o.category && !x.subcategories.length).slice(0, 3);
    ajouter({ cle: `operation:${o.id}`, regle: "operation", titre: `${o.label}, ${o.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`, meta: `${o.account} · ${dm(o.date)}`, motif: LIBELLES_REGLES.operation,
      proposition: prete ? `${o.category}${o.subcategory ? ` › ${o.subcategory}` : ""}${o.confidence !== null ? ` (confiance ${Math.round(o.confidence * 100)} %)` : ""}` : "Aucune catégorie sûre : choisir ou ouvrir Finances",
      choix: [...(prete ? [{ touche: "Entrée", libelle: "Appliquer", detail: o.category, action: { genre: "categoriser", op: o, category: o.category, subcategory: o.subcategory } as Action }] : []),
        ...autres.map((x, i) => ({ touche: String(i + 1), libelle: x.name, action: { genre: "categoriser", op: o, category: x.name, subcategory: null } as Action })),
        { touche: "O", libelle: "Ouvrir Finances", action: { genre: "aller", chemin: "/finances" } }, { touche: "N", libelle: `Revoir dans ${regles.revoirJours} jours`, action: { genre: "revoir" } }] });
  });
  if (on.habitude) {
    const veille = ajouterJours(jour, -1);
    // Journal indexé une fois (habitId|date) : la règle tourne à chaque affichage.
    const posees = new Set(ctx.journalHabitudes.map((e) => `${e.habitId}|${e.date}`));
    const na = new Set(ctx.nonApplicables.map((e) => `${e.habitId}|${e.date}`));
    const jours = Array.from({ length: 60 }, (_, i) => ajouterJours(jour, -(i + 1)));
    ctx.themesHabitudes.filter((t) => t.selectionMode !== "single").forEach((theme) => theme.habits.filter((h) => h.kind !== "numeric").forEach((h) => {
      let n = 0;
      for (const d of jours) {
        const k = `${h.id}|${d}`;
        if (posees.has(k)) break; if (na.has(k)) continue; n++;
      }
      if (n < regles.habitudeJours || n >= 60) return;
      ajouter({ cle: `habitude:${h.id}:${veille}`, regle: "habitude", titre: `${h.name} : ${n} jours manqués`, meta: `Thème ${theme.name}`, motif: `Habitude manquée ${regles.habitudeJours} jours de suite ou plus (réglage : ${regles.habitudeJours} j)`,
        proposition: "La reprendre aujourd'hui, ou marquer hier non applicable si c'était voulu", choix: [
          { touche: "Entrée", libelle: "Ouvrir le pixel du jour", action: { genre: "aller", chemin: "/corps" } },
          { touche: "H", libelle: "Cocher hier", detail: "c'était fait", action: { genre: "habitude", habitId: h.id, date: veille, na: false } },
          { touche: "X", libelle: "Hier non applicable", action: { genre: "habitude", habitId: h.id, date: veille, na: true } },
          { touche: "N", libelle: `Revoir dans ${regles.revoirJours} jours`, action: { genre: "revoir" } }] });
    }));
  }
  if (on.sport && ctx.sport) {
    const dow = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7; const attendu = (ctx.sport.cible * dow) / 7;
    if (dow >= 2 && ctx.sport.fait + 0.25 < attendu) {
      const reste = ctx.sport.cible - ctx.sport.fait; const h = (v: number) => `${Math.floor(v)} h ${String(Math.round((v % 1) * 60)).padStart(2, "0")}`;
      ajouter({ cle: `sport:${ajouterJours(jour, -dow)}:${jour}`, regle: "sport", titre: `Objectif ${ctx.sport.cible} h par semaine : ${h(ctx.sport.fait)} à ce jour`, meta: `il reste ${h(reste)} en ${7 - dow} jour${7 - dow > 1 ? "s" : ""}`, motif: "Objectif sport en retard sur le rythme de la semaine",
        proposition: `Prévoir ${h(reste / Math.max(1, 7 - dow))} par jour d'ici dimanche`, choix: [{ touche: "Entrée", libelle: "Ouvrir le sport", action: { genre: "aller", chemin: "/corps" } }, { touche: "N", libelle: "Ignorer cette semaine", action: { genre: "revoir" } }] });
    }
  }
  return c;
}

function carteReunion(ctx: Contexte, t: Tache, regles: ReglesTriage): Carte {
  return { cle: `reunion:${t.id}:${t.end}`, regle: "reunion", tacheId: t.id, titre: t.title || "Réunion", meta: `${nomProjet(ctx, t.projectId)} · ${dm(t.end)}${t.startTime ? ` · ${t.startTime}` : ""}`,
    motif: `Réunion passée sans compte rendu (réglage : ${regles.reunionJours} derniers jours)`, proposition: "Écrire le compte rendu dans la fiche de la réunion",
    choix: [{ touche: "Entrée", libelle: "Écrire le compte rendu", action: { genre: "ouvrir", id: t.id } }, { touche: "N", libelle: `Revoir dans ${regles.revoirJours} jours`, action: { genre: "revoir" } }, { touche: "A", libelle: "Archiver sans compte rendu", action: { genre: "archiver", id: t.id } }] };
}
function carteRanger(ctx: Contexte, t: Tache, regles: ReglesTriage, regle: "assistant" | "sans-projet"): Carte {
  const p = projetProbable(ctx, t);
  return { cle: `${regle}:${t.id}`, regle, tacheId: t.id, titre: t.title || "Sans titre", meta: `${t.source ? `créée par ${t.source}` : "créée à la main"}${t.end ? ` · échéance ${dm(t.end)}` : " · sans date"}${t.assignee ? ` · ${t.assignee}` : ""}`,
    motif: regle === "assistant" ? "Créé par l'assistant, rangé dans « À trier »" : "Tâche sans projet (ou dans « À trier »)",
    proposition: p ? `Ranger dans ${nomProjet(ctx, p.id)} (${p.raison})` : "Aucun projet probable : choisir un projet",
    choix: choixTache(t, regles, [...(p ? [{ touche: "Entrée", libelle: "Ranger", detail: nomProjet(ctx, p.id), action: { genre: "projet", id: t.id, projectId: p.id } as Action }] : []), ...choixProjets(ctx, t, p?.id)]) };
}
