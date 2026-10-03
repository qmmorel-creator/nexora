// Moteur de frise (Ref #688), porté du prototype hybride v4 :
// plages et zooms, graduations, traits verticaux à trois niveaux (retour du
// 03/10/2026 : mieux distinguer les repères temporels), rangement en lignes
// sans chevauchement et représentations de Gantt (dont six timelines premium en SVG).
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ajouterJours, ecartJours, type Statut, type Tache } from "../donnees/modele";
import type { LigneFrise } from "../donnees/planning";
import type { StyleGantt, Zoom } from "../donnees/prefs";
import { dateCourte, jourCourt, MOIS_C, semaineIso } from "./contexte";
import { dessinerBarre, STYLES_PREMIUM, type StylePremium } from "./timelines-premium.mjs";

export const ZOOMS_DEF: Record<Zoom, { libelle: string; jours: number; avant: number }> = {
  jour: { libelle: "Jour", jours: 3, avant: 1 },
  semaine: { libelle: "Semaine", jours: 9, avant: 2 }, mois: { libelle: "Mois", jours: 35, avant: 7 },
  trimestre: { libelle: "Trimestre", jours: 98, avant: 14 }, annee: { libelle: "Année", jours: 365, avant: 60 },
  pluri: { libelle: "Pluriannuel", jours: 1096, avant: 270 },
};
export const STYLES_DEF: { id: StyleGantt; libelle: string; aide: string }[] = [
  { id: "ruban", libelle: "Ruban", aide: "Bande pâle, avancement plein, titre dedans." },
  { id: "pixels", libelle: "Pixels", aide: "Une case par jour (semaine ou mois sur les zooms larges) ; foncée = écoulée." },
  { id: "comete", libelle: "Comète", aide: "Point à l'échéance, traînée depuis le début." },
  { id: "ecart", libelle: "Écart", aide: "Deux traits : en haut le temps écoulé, en bas l'avancement. Le rouge entre les deux est le retard pris." },
  { id: "pont", libelle: "Pont", aide: "Une arche du début à la fin ; la partie pleine est l'avancement." },
  { id: "compte", libelle: "Compte à rebours", aide: "Seul le temps restant est plein ; le passé est un pointillé ; « J−n » avant l'échéance." },
  { id: "jauge", libelle: "Jauge à curseur", aide: "Un rail fin pour la durée, une bille posée à l'avancement ; si la bille est derrière aujourd'hui, l'écart est rouge." },
  // Timelines premium (retour du 03/10/2026) : prototype docs/maquettes/timelines-premium.
  { id: "briques", libelle: "Briques techniques", aide: "Un module par jour, tenons plats ; modules pleins = réalisé, hachurés = restant." },
  { id: "conduite", libelle: "Conduite hydraulique", aide: "Un conduit fin entre deux raccords ; le fluide remplit jusqu'à l'avancement." },
  { id: "nuages", libelle: "Nuages de points", aide: "Particules entre deux bornes nettes : pleines = réalisé, creuses = restant." },
  { id: "niveaux", libelle: "Courbes de niveau", aide: "Une île dessinée comme une carte IGN ; courbes pleines = réalisé, pointillées = restant. Le relief est décoratif." },
  { id: "trajectoires", libelle: "Trajectoires", aide: "Brins tressés croisés au point d'avancement ; brin coloré et halo = réalisé, trait fin = restant." },
  { id: "prismes", libelle: "Prismes plats", aide: "Facettes translucides ; soutenues = réalisé, pâles au contour pointillé = restant ; trait foncé à l'avancement." },
];
const estPremium = (s: StyleGantt): s is StylePremium => (STYLES_PREMIUM as string[]).includes(s);

// Barre premium : SVG redessiné à sa taille réelle (ResizeObserver).
function FormePremium({ style, couleur, avancement, id, jours, libDebut, libFin }: { style: StylePremium; couleur: string; avancement: number; id: string; jours: number; libDebut: string; libFin: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const svg = ref.current; if (!svg) return;
    const dessiner = () => { const b = svg.getBoundingClientRect(); dessinerBarre(svg, style, { largeur: b.width, hauteur: b.height, couleur, avancement, id, jours, libDebut, libFin, compact: true }); };
    dessiner();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(dessiner); ro.observe(svg);
    return () => ro.disconnect();
  }, [style, couleur, avancement, id, jours, libDebut, libFin]);
  return <svg ref={ref} className="g-svg" aria-hidden="true" />;
}

export interface Plage { zoom: Zoom; debut: string; fin: string; jours: number; }
export function plage(zoom: Zoom, decalage: number, jour: string): Plage {
  const z = ZOOMS_DEF[zoom];
  const debut = ajouterJours(jour, -z.avant + decalage * Math.round(z.jours * 0.75));
  return { zoom, debut, fin: ajouterJours(debut, z.jours - 1), jours: z.jours };
}
export const tx = (r: Plage, iso: string) => (ecartJours(r.debut, iso) / r.jours) * 100;
export function libellePlage(r: Plage) {
  const a = new Date(`${r.debut}T12:00:00Z`), b = new Date(`${r.fin}T12:00:00Z`);
  return `${a.getUTCDate()} ${MOIS_C[a.getUTCMonth()]}${a.getUTCFullYear() !== b.getUTCFullYear() ? " " + a.getUTCFullYear() : ""} → ${b.getUTCDate()} ${MOIS_C[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

// Graduations libellées (en-tête) et traits (grille), par niveau :
// 2 = repère majeur (mois, année), 1 = semaine ou mois selon le zoom, 0 = fin.
export interface Graduation { iso: string; libelle: ReactNode; majeur: boolean; }
export interface Trait { iso: string; niveau: 0 | 1 | 2; }
const dt = (iso: string) => new Date(`${iso}T12:00:00Z`);
export function graduations(r: Plage): Graduation[] {
  const out: Graduation[] = [];
  for (let i = 0; i < r.jours; i++) {
    const iso = ajouterJours(r.debut, i), d = dt(iso), j = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear(), w = d.getUTCDay();
    if (r.zoom === "semaine" || r.zoom === "jour") out.push({ iso, libelle: <>{jourCourt(iso)} <b>{j}</b></>, majeur: w === 1 });
    else if (r.zoom === "mois" || r.zoom === "trimestre") { if (w === 1) out.push({ iso, libelle: <>S{semaineIso(iso)} <small>{j} {MOIS_C[m]}</small></>, majeur: j <= 7 }); }
    else if (r.zoom === "annee") { if (j === 1) out.push({ iso, libelle: <>{MOIS_C[m]}{m === 0 && <> <b>{y}</b></>}</>, majeur: m === 0 }); }
    else if (j === 1 && m % 3 === 0) out.push({ iso, libelle: <>T{m / 3 + 1} <b>{y}</b></>, majeur: m === 0 });
  }
  return out;
}
export function traits(r: Plage): Trait[] {
  const out: Trait[] = [];
  for (let i = 0; i < r.jours; i++) {
    const iso = ajouterJours(r.debut, i), d = dt(iso), j = d.getUTCDate(), m = d.getUTCMonth(), w = d.getUTCDay();
    let n: 0 | 1 | 2 | -1 = -1;
    if (r.zoom === "semaine" || r.zoom === "jour") n = w === 1 ? 2 : 1;
    else if (r.zoom === "mois") n = j === 1 ? 2 : w === 1 ? 1 : 0;
    else if (r.zoom === "trimestre") n = j === 1 ? 2 : w === 1 ? 1 : -1;
    else if (r.zoom === "annee") n = j === 1 ? (m === 0 ? 2 : 1) : w === 1 ? 0 : -1;
    else n = j === 1 ? (m === 0 ? 2 : m % 3 === 0 ? 1 : 0) : -1;
    if (n >= 0) out.push({ iso, niveau: n as 0 | 1 | 2 });
  }
  return out;
}
export const clairsemer = <T,>(l: T[], max: number) => { const pas = Math.max(1, Math.ceil(l.length / max)); return l.filter((_, i) => i % pas === 0); };

// Grille verticale d'une piste : traits par niveau, week-ends ombrés aux
// zooms courts, trait d'aujourd'hui.
export function Grille({ r, jour }: { r: Plage; jour: string }) {
  const largeurJour = 100 / r.jours;
  const we = r.zoom === "jour" || r.zoom === "semaine" || r.zoom === "mois" ? Array.from({ length: r.jours }, (_, i) => ajouterJours(r.debut, i)).filter((iso) => dt(iso).getUTCDay() === 6) : [];
  return <>
    {we.map((iso) => <i key={"w" + iso} className="ox-we" style={{ left: `${tx(r, iso)}%`, width: `${largeurJour * 2}%` }} />)}
    {traits(r).map((t) => <i key={t.iso} className={`hx-gl ox-n${t.niveau}`} style={{ left: `${tx(r, t.iso)}%` }} />)}
    {jour >= r.debut && jour <= r.fin && <i className="hx-today" style={{ left: `${tx(r, jour) + (r.zoom === "semaine" || r.zoom === "jour" ? largeurJour / 2 : 0)}%` }} />}
  </>;
}

// Classe de statut, déduite du NOM (les identifiants varient d'un compte à l'autre).
export function classeStatut(t: Tache, statuts: Statut[]): string {
  const n = (statuts.find((s) => s.id === t.statusId)?.name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/termin/.test(n)) return "is-s5";
  if (/attente/.test(n)) return "is-s2";
  if (/en\s*cours/.test(n)) return "is-s3";
  if (/information/.test(n)) return "is-s6";
  return "is-s1";
}

// --- Rangement ---------------------------------------------------------------
export interface Element { l: LigneFrise; a: number; b: number; rangee: number; }
const largeurTitre = (t: Tache) => (t.title || "").length * 6.3 + 22;
export function ranger(lignes: LigneFrise[], r: Plage, style: StyleGantt, largeurPiste = 1050): { elements: Element[]; rangees: number } {
  const items = lignes.map((l) => ({ l, a: tx(r, l.debut), b: l.jalon ? tx(r, l.debut) : tx(r, ajouterJours(l.fin, 1)), rangee: 0 }))
    .filter((x) => x.b >= 0 && x.a <= 100).sort((x, y) => x.a - y.a);
  const fins: number[] = [];
  items.forEach((it) => {
    const a0 = Math.max(0, it.a), px = (Math.min(100, it.b) - a0) / 100 * largeurPiste, lab = largeurTitre(it.l.t);
    const ext = it.l.jalon ? lab + 14 : style === "ruban" ? (px >= lab ? px : px + lab + 8) : style === "pixels" ? Math.max(px, lab) : px + lab + 16 + (style === "compte" ? 56 : 0);
    const fin = a0 + (ext / largeurPiste) * 100;
    let rg = fins.findIndex((v) => v <= a0 - 0.3); if (rg < 0) { rg = fins.length; fins.push(0); }
    fins[rg] = fin; it.rangee = rg;
  });
  return { elements: items, rangees: Math.max(1, fins.length) };
}
export const HAUTEUR_RANGEE = 26;

// --- Contenu des représentations ---------------------------------------------
export interface InfosTache { fini: boolean; retard: boolean; joursRetard: number; jour: string; }
const borne = (v: number) => Math.max(0, Math.min(100, v));
const dansBarre = (r: Plage, iso: string, a: number, b: number) => borne(((tx(r, iso) - a) / Math.max(0.01, b - a)) * 100);
export function compteARebours(t: Tache, i: InfosTache) {
  if (i.fini) return "✓"; if (i.retard) return `+${i.joursRetard} j`;
  if (t.start && t.start > i.jour) return `dans ${ecartJours(i.jour, t.start)} j`;
  const n = t.end ? ecartJours(i.jour, t.end) : 0; return n === 0 ? "J" : `J−${n}`;
}
function pixels(l: LigneFrise, r: Plage, i: InfosTache) {
  const u = r.jours <= 98 ? 1 : r.jours <= 366 ? 7 : 30.4;
  const s0 = l.debut < r.debut ? r.debut : l.debut, s1 = l.fin > r.fin ? r.fin : l.fin;
  const n = Math.max(1, Math.round((ecartJours(s0, s1) + 1) / u));
  const el = i.jour < s0 ? 0 : Math.min(n, Math.round((ecartJours(s0, i.jour < s1 ? i.jour : s1) + 1) / u));
  return <span className="g-px">{Array.from({ length: Math.min(n, 400) }, (_, k) => <i key={k} className={i.fini ? "is-done" : k < el ? "is-el" : ""} />)}</span>;
}
export function formeGantt(style: StyleGantt, t: Tache, l: LigneFrise, r: Plage, a: number, b: number, i: InfosTache, couleur = ""): ReactNode {
  const prog = i.fini ? 100 : Math.max(0, Math.min(100, Number(t.progress) || 0));
  const ecoule = i.fini ? 100 : dansBarre(r, ajouterJours(i.jour, 1), a, b);
  if (style === "pixels") return pixels(l, r, i);
  if (estPremium(style)) { const jours = Math.max(1, Math.round((b - a) / 100 * r.jours)); return <FormePremium style={style} couleur={couleur} avancement={prog} id={t.id} jours={jours} libDebut={dateCourte(l.debut)} libFin={dateCourte(l.fin)} />; }
  if (style === "comete") return <><span className="g-tail" /><i className="g-head" /></>;
  if (style === "ecart") { const lag = Math.max(0, ecoule - prog); return <><span className="g-time"><i style={{ width: `${ecoule}%` }} /></span><span className="g-done"><i style={{ width: `${prog}%` }} />{lag > 0 && !i.fini && <b style={{ left: `${prog}%`, width: `${lag}%` }} />}</span></>; }
  if (style === "pont") return <><span className="g-arc" /><span className="g-arc is-fill" style={{ clipPath: `inset(0 ${100 - prog}% 0 0)` }} /></>;
  if (style === "compte") { const passe = t.start && t.start > i.jour ? 0 : i.fini ? 100 : dansBarre(r, i.jour, a, b); return <><span className="g-past" style={{ width: `${passe}%` }} /><span className="g-left" style={{ left: `${passe}%` }} /></>; }
  // Jauge à curseur (retour du 03/10/2026) : rail, part faite, bille ; retard = de la bille à aujourd'hui.
  if (style === "jauge") { const lag = i.fini ? 0 : Math.max(0, ecoule - prog); return <><span className="g-rail" /><span className="g-fait" style={{ width: `${prog}%` }} />{lag > 0 && <span className="g-lag" style={{ left: `${prog}%`, width: `${lag}%` }} />}<i className={`g-bille ${i.fini ? "is-done" : ""}`} style={{ left: `${prog}%` }} /></>; }
  return <span className="g-bar"><i className="g-prog" style={{ width: `${prog}%` }} /></span>;
}

// Élément d'une piste (planning, semaine de l'accueil) : forme + titre.
export function LigneGantt({ el, r, style, couleur, statuts, infos, selection, ouvrir, info }: {
  el: Element; r: Plage; style: StyleGantt; couleur: string; statuts: Statut[]; infos: InfosTache; selection: boolean; ouvrir: (id: string) => void; info: string;
}) {
  const { l } = el, t = l.t, a = Math.max(0, el.a), b = Math.min(100, el.b), top = el.rangee * HAUTEUR_RANGEE;
  const cls = `${infos.fini ? "is-done" : ""} ${infos.retard ? "is-late" : ""} ${classeStatut(t, statuts)} ${el.a < 0 ? "cut-l" : ""} ${el.b > 100 ? "cut-r" : ""} ${selection ? "is-sel" : ""}`;
  const st = { "--c": couleur } as CSSProperties;
  if (l.jalon) return <button type="button" className={`hx-ms ${cls}`} data-drag={t.id} data-tip={info} onClick={() => ouvrir(t.id)} style={{ ...st, left: `${a}%`, top }}><i /><span>{t.title} <small>{dateCourte(l.fin)}</small></span></button>;
  const titre = style === "ruban"
    ? null
    : style === "compte" ? <span className="g-lab"><b className={`g-cd ${infos.retard ? "is-late" : ""}`}>{compteARebours(t, infos)}</b>{t.title}</span>
      : style === "pixels" ? <span className="g-lab">{t.title}</span>
        : <span className="g-lab">{infos.fini ? "✓ " : ""}{t.title} <small>{dateCourte(l.fin)}</small></span>;
  const forme = style === "ruban"
    ? <span className="g-bar"><i className="g-prog" style={{ width: `${infos.fini ? 100 : Math.max(0, Math.min(100, Number(t.progress) || 0))}%` }} /><span className="g-lab">{infos.fini ? "✓ " : ""}{t.title}</span></span>
    : formeGantt(style, t, l, r, a, b, infos, couleur);
  const depasse = infos.retard ? (() => { const o0 = Math.max(0, tx(r, ajouterJours(l.fin, 1))), o1 = Math.min(100, tx(r, infos.jour)); return o1 > o0 ? <span className={`hx-over gs-o-${style}`} style={{ left: `${o0}%`, width: `${o1 - o0}%`, top }} /> : null; })() : null;
  return <>
    <button type="button" className={`hx-g gs-${style} ${cls}`} data-drag={t.id} data-tip={info} onClick={() => ouvrir(t.id)} style={{ ...st, left: `${a}%`, width: `${Math.max(0.35, b - a)}%`, top }}>
      {style === "pixels" ? <>{titre}{forme}</> : <>{forme}{titre}</>}
    </button>
    {depasse}
  </>;
}

// Barre d'une ligne de projet (titre dans la colonne de gauche).
export function BarreProjet({ l, r, style, couleur, statuts, infos, info }: { l: LigneFrise; r: Plage; style: StyleGantt; couleur: string; statuts: Statut[]; infos: InfosTache; info: string }) {
  const t = l.t, a0 = tx(r, l.debut), a1 = l.jalon ? a0 : tx(r, ajouterJours(l.fin, 1));
  const st = { "--c": couleur } as CSSProperties;
  if (l.jalon) return <i className="hx-pms" data-drag={t.id} data-tip={info} style={{ ...st, left: `${a0}%` }} />;
  const a = Math.max(0, a0), b = Math.min(100, a1);
  if (b <= 0 || a >= 100) return null;
  const prog = infos.fini ? 100 : Math.max(0, Math.min(100, Number(t.progress) || 0));
  const cls = `${classeStatut(t, statuts)} ${infos.fini ? "is-done" : ""} ${infos.retard ? "is-late" : ""}`;
  const forme = style === "ruban" ? <span className="g-bar"><i className="g-prog" style={{ width: `${prog}%` }} />{prog > 0 && !infos.fini && <span className="g-lab is-pct">{prog} %</span>}</span> : formeGantt(style, t, l, r, a, b, infos, couleur);
  return <span className={`hx-g gs-${style} is-row ${cls}`} data-drag={t.id} data-tip={info} style={{ ...st, left: `${a}%`, width: `${Math.max(0.35, b - a)}%` }}>
    {forme}{style === "compte" && <span className="g-lab"><b className={`g-cd ${infos.retard ? "is-late" : ""}`}>{compteARebours(t, infos)}</b></span>}
  </span>;
}

export function infobulle(t: Tache, l: LigneFrise, projet: string, statut: string, i: InfosTache): string {
  return [t.title || "Sans titre", `${projet} · ${statut}${t.assignee ? " · " + t.assignee : ""}`,
    l.jalon ? `Jalon le ${dateCourte(l.fin)}` : `${dateCourte(l.debut)} → ${dateCourte(l.fin)} · ${ecartJours(l.debut, l.fin) + 1} j${t.progress ? ` · ${t.progress} %` : ""}`,
    ...(i.retard ? [`${i.joursRetard} jours de retard`] : []), "Glisser pour replanifier · bords pour étirer"].join("|");
}
