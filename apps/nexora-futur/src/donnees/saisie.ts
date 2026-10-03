// Saisie rapide en français (Ref #655) : « Relancer BC vendredi 14h @Vincent
// #CTEX6 !urgent ». Fonction pure ; les dates sont calculées depuis un jour
// de référence AAAA-MM-JJ (Europe/Paris, fourni par l'appelant).

export interface Candidat { id: string; nom: string; }
export interface ContexteSaisie {
  aujourdhui: string;
  personnes: Candidat[];
  projets: Candidat[];
  types: Candidat[];
  criticites: { valeur: string; alias: string[] }[];
}
export type GenreJeton = "date" | "heure" | "personne" | "projet" | "type" | "criticite";
export interface Jeton { genre: GenreJeton; texte: string; libelle: string; }
export interface Saisie {
  titre: string;
  start?: string; end?: string; startTime?: string; endTime?: string;
  assignee?: string; projectId?: string; taskTypeId?: string; criticality?: string;
  jetons: Jeton[];
  inconnus: string[];
}

export const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];

function versDate(iso: string): Date { const [a, m, j] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, j)); }
function versIso(d: Date): string { return d.toISOString().slice(0, 10); }
export function ajouterJours(iso: string, n: number): string { const d = versDate(iso); d.setUTCDate(d.getUTCDate() + n); return versIso(d); }
const jourSemaine = (iso: string) => versDate(iso).getUTCDay();

export function libelleDate(iso: string, aujourdhui: string): string {
  if (iso === aujourdhui) return "aujourd'hui";
  if (iso === ajouterJours(aujourdhui, 1)) return "demain";
  const d = versDate(iso);
  return `${["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][d.getUTCDay()]} ${d.getUTCDate()} ${["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][d.getUTCMonth()]}`;
}

// Date seule (sans heure). Renvoie null si le texte n'est pas une date.
export function lireDate(brut: string, aujourdhui: string): string | null {
  const t = brut.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "'").trim();
  if (t === "aujourd'hui" || t === "auj" || t === "ajd") return aujourdhui;
  if (t === "demain" || t === "dem") return ajouterJours(aujourdhui, 1);
  if (t === "apres-demain") return ajouterJours(aujourdhui, 2);
  let m = /^\+(\d{1,3})([jsm])$/.exec(t);
  if (m) { const n = +m[1]; return m[2] === "j" ? ajouterJours(aujourdhui, n) : m[2] === "s" ? ajouterJours(aujourdhui, 7 * n) : ajouterMois(aujourdhui, n); }
  const jour = JOURS.findIndex((j) => t === j || t === j.slice(0, 3));
  if (jour >= 0) { const d = (jour - jourSemaine(aujourdhui) + 7) % 7 || 7; return ajouterJours(aujourdhui, d); }
  m = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(t);
  if (m) return composer(+m[1], +m[2], m[3] ? +m[3] : undefined, aujourdhui);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return composer(+m[3], +m[2], +m[1], aujourdhui);
  return null;
}

function ajouterMois(iso: string, n: number): string {
  const d = versDate(iso); const jour = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return versIso(d);
}

function composer(j: number, mois: number, annee: number | undefined, aujourdhui: string): string | null {
  if (mois < 1 || mois > 12 || j < 1 || j > 31) return null;
  const a0 = +aujourdhui.slice(0, 4);
  let a = annee === undefined ? a0 : annee < 100 ? 2000 + annee : annee;
  const essai = (an: number) => { const d = new Date(Date.UTC(an, mois - 1, j)); return d.getUTCMonth() === mois - 1 ? versIso(d) : null; };
  let iso = essai(a);
  if (!iso) return null;
  // Sans année : la prochaine occurrence (une date passée de plus de 60 jours bascule l'an prochain).
  if (annee === undefined && iso < ajouterJours(aujourdhui, -60)) { a += 1; iso = essai(a); }
  return iso;
}

function lireHeure(t: string): string | null {
  const m = /^(?:a)?(\d{1,2})(?:h|:)(\d{2})?$/.exec(t.toLowerCase());
  if (!m || +m[1] > 23 || (m[2] && +m[2] > 59)) return null;
  return `${m[1].padStart(2, "0")}:${m[2] || "00"}`;
}

function chercher(c: Candidat[], q: string): Candidat | undefined {
  const n = normaliser(q);
  if (!n) return undefined;
  return c.find((x) => normaliser(x.nom) === n) || c.find((x) => normaliser(x.nom).startsWith(n)) || c.find((x) => normaliser(x.nom).includes(n));
}

export function analyserSaisie(texte: string, ctx: ContexteSaisie): Saisie {
  const s: Saisie = { titre: "", jetons: [], inconnus: [] };
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  const reste: string[] = [];
  const dates: string[] = [];
  const heures: string[] = [];
  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i];
    const suivant = mots[i + 1];
    const pref = mot[0];
    if ((pref === "@" || pref === "#" || pref === "!" || pref === "/") && mot.length > 1) {
      const q = mot.slice(1);
      if (pref === "@") { const p = chercher(ctx.personnes, q); if (p) { s.assignee = p.nom; s.jetons.push({ genre: "personne", texte: mot, libelle: p.nom }); } else s.inconnus.push(mot); continue; }
      if (pref === "#") { const p = chercher(ctx.projets, q); if (p) { s.projectId = p.id; s.jetons.push({ genre: "projet", texte: mot, libelle: p.nom }); } else s.inconnus.push(mot); continue; }
      if (pref === "/") { const p = chercher(ctx.types, q); if (p) { s.taskTypeId = p.id; s.jetons.push({ genre: "type", texte: mot, libelle: p.nom }); continue; } reste.push(mot); continue; }
      const c = ctx.criticites.find((x) => x.alias.some((a) => normaliser(a) === normaliser(q)));
      if (c) { s.criticality = c.valeur; s.jetons.push({ genre: "criticite", texte: mot, libelle: c.alias[0] }); } else s.inconnus.push(mot);
      continue;
    }
    // « 9 oct », « 9 octobre », « 9 oct. 2026 »
    if (/^\d{1,2}$/.test(mot) && suivant) {
      const mi = MOIS.findIndex((x) => normaliser(suivant).startsWith(x));
      if (mi >= 0) {
        const an = mots[i + 2] && /^\d{4}$/.test(mots[i + 2]) ? +mots[i + 2] : undefined;
        const d = composer(+mot, mi + 1, an, ctx.aujourdhui);
        if (d) { dates.push(d); s.jetons.push({ genre: "date", texte: [mot, suivant, an ?? ""].join(" ").trim(), libelle: libelleDate(d, ctx.aujourdhui) }); i += an ? 2 : 1; continue; }
      }
    }
    // « lundi prochain », « dans 3 jours »
    if (/^dans$/i.test(mot) && suivant && /^\d+$/.test(suivant) && mots[i + 2] && /^(jours?|semaines?|mois)$/i.test(mots[i + 2])) {
      const u = mots[i + 2][0].toLowerCase(); const d = lireDate(`+${suivant}${u === "j" ? "j" : u === "s" ? "s" : "m"}`, ctx.aujourdhui)!;
      dates.push(d); s.jetons.push({ genre: "date", texte: `dans ${suivant} ${mots[i + 2]}`, libelle: libelleDate(d, ctx.aujourdhui) }); i += 2; continue;
    }
    const intervalleHeure = /^(\d{1,2}h\d{0,2})-(\d{1,2}h\d{0,2})$/i.exec(mot);
    if (intervalleHeure) { const a = lireHeure(intervalleHeure[1]); const b = lireHeure(intervalleHeure[2]); if (a && b) { heures.push(a, b); s.jetons.push({ genre: "heure", texte: mot, libelle: `${a}–${b}` }); continue; } }
    const h = lireHeure(mot);
    if (h && /h|:/.test(mot)) { heures.push(h); s.jetons.push({ genre: "heure", texte: mot, libelle: h }); continue; }
    const d = lireDate(mot, ctx.aujourdhui);
    if (d && !(reste.length === 0 && dates.length === 0 && /^\d/.test(mot) === false && mots.length === 1)) {
      if (/^prochaine?$/i.test(suivant || "")) i += 1;
      dates.push(d); s.jetons.push({ genre: "date", texte: mot, libelle: libelleDate(d, ctx.aujourdhui) }); continue;
    }
    if (/^(du|au|le|a|à)$/i.test(mot) && suivant && (lireDate(suivant, ctx.aujourdhui) || /^\d{1,2}$/.test(suivant) || lireHeure(suivant.replace(/^à/, "")))) continue;
    reste.push(mot);
  }
  if (dates.length) {
    const tri = [...dates].sort();
    s.start = tri[0]; s.end = tri[tri.length - 1];
  }
  if (heures.length) { s.startTime = heures[0]; if (heures[1]) s.endTime = heures[1]; }
  s.titre = reste.join(" ").replace(/\s+/g, " ").trim();
  return s;
}
