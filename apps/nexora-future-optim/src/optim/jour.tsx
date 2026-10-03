// Journée (Ref #688) : Cadran, Pixel Tasks et Habit Pixel, portés du
// prototype hybride v4, sur les données réelles. Règles des habitudes :
// celles de Nexora (src/donnees/habitudes.ts) — choix unique par thème,
// « non applicable » hors du total, valeur partielle comptée comme faite.
import { useCallback, useMemo, type ReactNode } from "react";
import { basculerHabitude, etatsDuJour, pasNumerique, poserNonApplicable, poserValeur, type EtatHabitude, type Habitude, type ThemeHabitudes } from "../donnees/habitudes";
import { ajouterJours, type Tache } from "../donnees/modele";
import { basculer } from "../donnees/actions";
import { classeStatut } from "./frise";
import { dateCourte, jourCourt, useOptim, useUi } from "./contexte";

// --- Tâches du jour ----------------------------------------------------------
const STYLE_STATUT: Record<string, { fill: string; stroke: string; wire: string; label: string }> = {
  "is-s1": { fill: "#ffffff", stroke: "#c3cdd9", wire: "#9aa6b6", label: "À planifier" },
  "is-s3": { fill: "#dfeafd", stroke: "#7aa7f0", wire: "#5b8def", label: "En cours" },
  "is-s2": { fill: "#fdf0cf", stroke: "#f0b44c", wire: "#e59f1f", label: "Attente" },
  "is-s5": { fill: "#16a34a", stroke: "#16a34a", wire: "#16a34a", label: "Terminé" },
  "is-s6": { fill: "#f1f5f9", stroke: "#cbd5e1", wire: "#94a3b8", label: "Information" },
};

export function useJour() {
  const o = useOptim();
  const { d, jour, fini, retard } = o;
  const tachesDuJour = useCallback((date: string): Tache[] => {
    const info = (t: Tache) => classeStatut(t, d.statuts) === "is-s6";
    const l = d.taches.filter((t) => !info(t) && (
      (!fini(t) && (t.end === date || (!!t.startTime && !!t.start && t.start <= date && (t.end || t.start) >= date)))
      || (date === jour && retard(t))
      || (fini(t) && (t.completedAt ? String(t.completedAt).slice(0, 10) === date : t.end === date))));
    return l.filter((t, i) => l.indexOf(t) === i);
  }, [d.taches, d.statuts, fini, retard, jour]);
  const compteTaches = useCallback((date: string) => { const l = tachesDuJour(date); return { faites: l.filter(fini).length, total: l.length }; }, [tachesDuJour, fini]);
  const etats = useCallback((date: string) => etatsDuJour(d.themesHabitudes, d.journalHabitudes, d.nonApplicables, date), [d.themesHabitudes, d.journalHabitudes, d.nonApplicables]);
  const styleTache = useCallback((t: Tache) => STYLE_STATUT[classeStatut(t, d.statuts)] || STYLE_STATUT["is-s1"], [d.statuts]);
  return { ...o, tachesDuJour, compteTaches, etats, styleTache };
}

// Actions sur les habitudes, écrites dans nexora:habitLog et nexora:habitSkips.
export function useActionsHabitudes() {
  const { d, ecrireJson } = useOptim();
  const themes = d.themesHabitudes;
  return useMemo(() => ({
    basculer: async (id: string, date: string, etaitNa: boolean) => {
      if (etaitNa) await ecrireJson("nonApplicables", (v) => poserNonApplicable(v, themes, id, date, false));
      await ecrireJson("journalHabitudes", (v) => basculerHabitude(v, themes, id, date));
    },
    pas: async (h: Habitude, date: string, valeur: number | null, delta: number, etaitNa: boolean) => {
      const n = pasNumerique(h, valeur, delta); if (n === null) return;
      if (etaitNa) await ecrireJson("nonApplicables", (v) => poserNonApplicable(v, themes, h.id, date, false));
      await ecrireJson("journalHabitudes", (v) => poserValeur(v, themes, h.id, date, n));
    },
    na: async (id: string, date: string, actif: boolean) => {
      if (actif) await ecrireJson("journalHabitudes", (v) => poserValeur(v, themes, id, date, null));
      await ecrireJson("nonApplicables", (v) => poserNonApplicable(v, themes, id, date, actif));
    },
  }), [ecrireJson, themes]);
}

const LIBELLE_ETAT: Record<EtatHabitude, string> = { fait: "faite", partiel: "en partie", "a-faire": "à faire", na: "non applicable" };
type LigneEtat = { h: Habitude; etat: EtatHabitude; valeur: number | null };
const infoHabitude = (x: LigneEtat, theme: ThemeHabitudes, date: string) => `${x.h.name}|${theme.name} · ${LIBELLE_ETAT[x.etat]}${x.h.kind === "numeric" ? ` · ${x.valeur ?? 0} / ${x.h.max}` : ""}|${dateCourte(date)}`;

// Motif « non applicable » (hachures), à poser une fois par SVG.
const MotifNa = () => <defs><pattern id="hx-na" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#f6f7f9" /><line x1="0" y1="0" x2="0" y2="4" stroke="#cbd3de" strokeWidth="1.4" /></pattern></defs>;

// Pixel du jour des habitudes : une rangée par thème, une case par habitude.
export function PixelHabitudes({ date, taille = 8, ecart = 2, chaud, brut }: { date: string; taille?: number; ecart?: number; chaud?: string | null; brut?: boolean }) {
  const { etats, couleurHabitude, d } = useJour();
  const e = etats(date);
  const n = Math.max(1, d.themesHabitudes.length, ...d.themesHabitudes.map((t) => t.habits.length));
  const w = n * taille + (n - 1) * ecart;
  const cases: ReactNode[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const pt = e.parTheme[r], x = c * (taille + ecart), y = r * (taille + ecart), item = pt?.habitudes[c];
    const k = `${r}-${c}`;
    if (!item || !pt) { cases.push(<rect key={k} x={x} y={y} width={taille} height={taille} rx={taille / 5} fill="none" stroke="#e6eaf0" strokeWidth="1" strokeDasharray="2 2" />); continue; }
    const col = couleurHabitude(item.h), cls = `hx-pc${chaud === item.h.id ? " is-hot" : ""}`, tip = infoHabitude(item, pt.theme, date);
    if (item.etat === "fait") cases.push(<rect key={k} className={cls} data-hp={item.h.id} data-tip={tip} x={x} y={y} width={taille} height={taille} rx={taille / 5} fill={col} />);
    else if (item.etat === "partiel") { const f = Math.max(0, Math.min(1, (item.valeur ?? 0) / (item.h.max || 1))); cases.push(<g key={k}><rect className={cls} data-hp={item.h.id} data-tip={tip} x={x} y={y} width={taille} height={taille} rx={taille / 5} fill={col} opacity=".18" /><rect x={x} y={y + taille * (1 - f)} width={taille} height={taille * f} fill={col} pointerEvents="none" /></g>); }
    else if (item.etat === "na") cases.push(<rect key={k} className={cls} data-hp={item.h.id} data-tip={tip} x={x + .5} y={y + .5} width={taille - 1} height={taille - 1} rx={taille / 5} fill="url(#hx-na)" stroke="#cbd3de" />);
    else cases.push(<rect key={k} className={cls} data-hp={item.h.id} data-tip={tip} x={x + .5} y={y + .5} width={taille - 1} height={taille - 1} rx={taille / 5} fill="#fff" stroke={col} strokeOpacity=".45" />);
  }
  if (brut) return <>{cases}</>;
  return <svg className="hx-px" viewBox={`0 0 ${w} ${w}`} width={w} height={w} aria-hidden="true"><MotifNa />{cases}</svg>;
}
export function taillePixelHabitudes(themes: ThemeHabitudes[]) { return Math.max(1, themes.length, ...themes.map((t) => t.habits.length)); }

// Pixel du jour des tâches : carré n × n, couleur = statut, cadre rouge = retard.
export function PixelTaches({ date, taille = 8, ecart = 2, brut }: { date: string; taille?: number; ecart?: number; brut?: boolean }) {
  const { tachesDuJour, styleTache, retard, projet } = useJour();
  const ts = tachesDuJour(date), n = Math.max(2, Math.ceil(Math.sqrt(ts.length || 1))), w = n * taille + (n - 1) * ecart;
  const cases = Array.from({ length: n * n }, (_, i) => {
    const x = (i % n) * (taille + ecart), y = Math.floor(i / n) * (taille + ecart), t = ts[i];
    if (!t) return <rect key={i} x={x + .5} y={y + .5} width={taille - 1} height={taille - 1} rx={taille / 5} fill="none" stroke="#e6eaf0" strokeDasharray="2 2" />;
    const st = styleTache(t);
    return <rect key={i} data-tip={`${t.title}|${projet(t.projectId).name} · ${st.label}${retard(t) ? " · en retard" : ""}`} x={x + .5} y={y + .5} width={taille - 1} height={taille - 1} rx={taille / 5} fill={st.fill} stroke={retard(t) ? "#dc2626" : st.stroke} />;
  });
  if (brut) return <>{cases}</>;
  return <svg className="hx-px" viewBox={`0 0 ${w} ${w}`} width={w} height={w} aria-hidden="true">{cases}</svg>;
}
export const tailleCarreTaches = (n: number) => Math.max(2, Math.ceil(Math.sqrt(n || 1)));

// --- Cadran --------------------------------------------------------------------
const h2a = (h: number) => (h / 24) * 360 - 90;
const P = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (a1 < a0) a1 += 360;
  const [x0, y0] = P(cx, cy, r, a0), [x1, y1] = P(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const hh = (t?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] + +m[2] / 60 : null; };
export const hmf = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
export const heureParisDec = () => { const [h, m] = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date()).split(":").map(Number); return h + m / 60; };

export interface ElementHoraire { h0: number; h1: number; titre: string; id?: string; couleur: string; genre: string; fini: boolean; sous: string; }
export function useElementsHoraires() {
  const { d, projet, statut, fini } = useOptim();
  return useCallback((date: string): ElementHoraire[] => d.taches
    .filter((t) => t.startTime && t.start && t.start <= date && (t.end || t.start) >= date)
    .map((t) => {
      const h0 = hh(t.startTime) ?? 0, h1 = hh(t.endTime) ?? h0 + .5, ty = d.types.find((x) => x.id === t.taskTypeId)?.name || "";
      return { h0, h1: Math.max(h1, h0 + .25), titre: t.title || "Sans titre", id: t.id, couleur: projet(t.projectId).color, genre: /r[ée]union/i.test(ty) ? "Réunion" : "Tâche", fini: fini(t), sous: `${projet(t.projectId).name} · ${statut(t.statusId).name}${t.assignee ? " · " + t.assignee : ""}` };
    }).sort((a, b) => a.h0 - b.h0), [d.taches, d.types, projet, statut, fini]);
}

export function Cadran({ date, taille = 440, mini = false, pixels = true }: { date: string; taille?: number; mini?: boolean; pixels?: boolean }) {
  const { etats, compteTaches, couleurHabitude, d, jour, tachesDuJour } = useJour();
  const { ouvrir } = useUi();
  const items = useElementsHoraires()(date);
  const c = taille / 2, R1 = taille * .4, W1 = taille * .042, R2 = taille * .325, W2 = taille * .03;
  const e = etats(date), ct = compteTaches(date);
  const maintenant = heureParisDec();
  const themes = e.parTheme, nh = themes.reduce((a, t) => a + t.habitudes.length, 0);
  const gapT = 5, gapH = 1.6, span = nh ? (360 - themes.length * gapT - Math.max(0, nh - themes.length) * gapH) / nh : 0;
  const segments: ReactNode[] = [];
  let a = -90 + gapT / 2;
  themes.forEach((pt) => pt.habitudes.forEach((x, i) => {
    const a0 = a, a1 = a + span, col = couleurHabitude(x.h), tip = infoHabitude(x, pt.theme, date);
    segments.push(<path key={x.h.id} className="hx-seg" data-hp={x.h.id} data-tip={tip} d={arc(c, c, R2, a0, a1)} stroke={x.etat === "na" ? "url(#hx-na)" : col} strokeOpacity={x.etat === "na" ? 1 : .16} strokeWidth={W2} fill="none" />);
    if (x.etat === "fait") segments.push(<path key={x.h.id + "f"} className="hx-seg" data-hp={x.h.id} d={arc(c, c, R2, a0, a1)} stroke={col} strokeWidth={W2} fill="none" pointerEvents="none" />);
    if (x.etat === "partiel") segments.push(<path key={x.h.id + "p"} d={arc(c, c, R2, a0, a0 + span * Math.min(1, (x.valeur ?? 0) / (x.h.max || 1)))} stroke={col} strokeWidth={W2} fill="none" pointerEvents="none" />);
    a = a1 + (i < pt.habitudes.length - 1 ? gapH : gapT);
  }));
  // Cœur : pixels dimensionnés sur la place libre (moins grands quand le
  // nombre d'habitudes augmente), ou compteurs seuls (réglage d'accueil).
  let coeur: ReactNode;
  if (mini && !pixels) {
    coeur = <>
      <text x={c - taille * .13} y={c + 4} textAnchor="middle" className="hx-cnum is-big">{ct.faites}<tspan className="hx-cden">/{ct.total}</tspan></text>
      <text x={c + taille * .13} y={c + 4} textAnchor="middle" className="hx-cnum is-big">{e.faites}<tspan className="hx-cden">/{e.total}</tspan></text>
      <text x={c - taille * .13} y={c + 20} textAnchor="middle" className="hx-csub">tâches</text>
      <text x={c + taille * .13} y={c + 20} textAnchor="middle" className="hx-csub">habitudes</text></>;
  } else {
    const SQ = taillePixelHabitudes(d.themesHabitudes), pg = mini ? 2 : 3, gapC = mini ? 12 : 22, inner = 2 * (R2 - W2 / 2) * (mini ? .74 : .7);
    const hwMax = (inner - gapC) / 2, ps = Math.min(mini ? 12 : 14, (hwMax - (SQ - 1) * pg) / SQ), hw = SQ * ps + (SQ - 1) * pg;
    const tn = tailleCarreTaches(tachesDuJour(date).length), tps = (hw - (tn - 1) * pg) / tn;
    const x0 = c - (hw * 2 + gapC) / 2, y0 = c - hw / 2 - (mini ? 6 : 12);
    coeur = <>
      <g transform={`translate(${x0.toFixed(1)} ${y0.toFixed(1)})`}><PixelTaches date={date} taille={tps} ecart={pg} brut /></g>
      <g transform={`translate(${(x0 + hw + gapC).toFixed(1)} ${y0.toFixed(1)})`}><PixelHabitudes date={date} taille={ps} ecart={pg} brut /></g>
      <text x={x0 + hw / 2} y={y0 + hw + (mini ? 14 : 20)} textAnchor="middle" className="hx-cnum">{ct.faites}<tspan className="hx-cden">/{ct.total}</tspan></text>
      <text x={x0 + hw + gapC + hw / 2} y={y0 + hw + (mini ? 14 : 20)} textAnchor="middle" className="hx-cnum">{e.faites}<tspan className="hx-cden">/{e.total}</tspan></text>
      {!mini && <><text x={x0 + hw / 2} y={y0 - 8} textAnchor="middle" className="hx-csub">tâches</text><text x={x0 + hw + gapC + hw / 2} y={y0 - 8} textAnchor="middle" className="hx-csub">habitudes</text></>}
    </>;
  }
  const suivant = items.find((i) => i.h0 >= maintenant && !i.fini);
  return (
    <svg className="hx-dial" viewBox={`0 0 ${taille} ${taille}`} role="img" aria-label="Cadran de la journée et anneau des habitudes">
      <MotifNa />
      <circle cx={c} cy={c} r={R1} fill="none" stroke="#eef1f6" strokeWidth={W1} />
      {Array.from({ length: 24 }, (_, h) => {
        const an = h2a(h), [x0, y0] = P(c, c, R1 + W1 / 2 + 3, an), [x1, y1] = P(c, c, R1 + W1 / 2 + (h % 6 ? 6 : 10), an);
        const [tx, ty] = P(c, c, R1 + W1 / 2 + 21, an);
        return <g key={h}><line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#b9c4d2" strokeWidth={h % 6 ? 1 : 1.5} />{!mini && h % 3 === 0 && <text x={tx} y={ty + 4} textAnchor="middle" className="hx-hr">{String(h).padStart(2, "0")}</text>}</g>;
      })}
      {items.map((it, i) => <path key={i} d={arc(c, c, R1, h2a(it.h0), h2a(Math.max(it.h1, it.h0 + .3)))} stroke={it.couleur} strokeWidth={W1} fill="none" opacity={it.fini ? .35 : 1}
        data-tip={`${hmf(it.h0)}–${hmf(it.h1)} · ${it.titre}|${it.genre} · ${it.sous}${it.fini ? "|Terminée" : ""}`} className={it.id ? "hx-arc" : undefined} onClick={it.id ? () => ouvrir(it.id!) : undefined} />)}
      {segments}
      {date === jour && (() => {
        const an = h2a(maintenant), [x, y] = P(c, c, R1 + W1 / 2 + 3, an), [x2, y2] = P(c, c, R2 + W2 / 2 + 6, an);
        return <><line x1={x} y1={y} x2={x2} y2={y2} stroke="#18263d" strokeWidth="3.5" strokeLinecap="round" data-tip={`Maintenant · ${hmf(maintenant)}|${suivant ? `Ensuite : ${hmf(suivant.h0)} ${suivant.titre}` : "Plus rien d'horodaté"}`} /><circle cx={x2} cy={y2} r="3" fill="#18263d" /></>;
      })()}
      {coeur}
    </svg>
  );
}

// --- Panneaux reliés (même dessin que habitPixelWirePath de Nexora) -----------
const RH = 28, HH = 34, CS = 22, CG = 6;
interface Cellule { fil: string; hp?: string; dessin: (x: number, y: number, s: number) => ReactNode; }
function Relie({ tete, lignes, cellules, teinte }: { tete: ReactNode; lignes: ReactNode[]; cellules: Cellule[]; teinte: string }) {
  const n = cellules.length, W = 26 + n * CS + Math.max(0, n - 1) * CG + 8, H = HH + lignes.length * RH;
  return (
    <div className="hx-wg"><div className="hx-wgl"><div className="hx-wgh">{tete}</div>{lignes}</div>
      <svg className="hx-wsvg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}><MotifNa />
        <rect x="18" y="2" width={W - 20} height={CS + 10} rx="8" fill={teinte} fillOpacity=".07" stroke={teinte} strokeOpacity=".28" />
        {cellules.map((cel, i) => {
          const x = 24 + i * (CS + CG), y = 7, cx = x + CS / 2, ry = HH + i * RH + RH / 2, r = 5;
          return <g key={i}><path className="hx-wire" data-hp={cel.hp} d={`M3 ${ry} H${cx - r} Q${cx} ${ry} ${cx} ${ry - r} V${y + CS + 1}`} fill="none" stroke={cel.fil} strokeWidth="1.4" /><circle cx="3" cy={ry} r="2.5" fill={cel.fil} />{cel.dessin(x, y, CS)}</g>;
        })}
      </svg></div>
  );
}

export function Coche({ t }: { t: Tache }) {
  const { fini, executer } = useOptim();
  const { notifier } = useUi();
  const f = fini(t);
  return <button type="button" className={`hx-ck ${f ? "is-on" : ""}`} aria-label={`${f ? "Rouvrir" : "Terminer"} ${t.title || ""}`}
    onClick={async (ev) => { ev.stopPropagation(); await executer(basculer(t.id)); notifier({ texte: `« ${t.title} » ${f ? "rouverte" : "terminée"}`, annuler: () => { void executer(basculer(t.id)); } }); }}>{f ? "✓" : ""}</button>;
}

export function PanneauTaches({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { tachesDuJour, compteTaches, styleTache, fini, retard, joursRetard, projet, d, jour } = useJour();
  const { ouvrir, tacheId } = useUi();
  const ts = tachesDuJour(date), ct = compteTaches(date);
  const parProjet = new Map<string, Tache[]>();
  ts.forEach((t) => { const k = t.projectId || ""; parProjet.set(k, [...(parProjet.get(k) || []), t]); });
  const ordre = [...d.projets.map((p) => p.id), ""].filter((id) => parProjet.has(id));
  const puce = (t: Tache) => fini(t) ? <span className="hx-chip is-ok">fait</span> : retard(t) ? <span className="hx-chip is-late">retard {joursRetard(t)} j</span> : t.startTime ? <span className="hx-chip is-time">{t.startTime}</span> : t.end === date ? <span className="hx-chip is-due">échéance</span> : <span className="hx-chip">éch. {dateCourte(t.end)}</span>;
  return (
    <section className="hx-pxpanel" aria-label="Tâches du jour, une tâche par pixel">
      <header className="hx-th"><h2>Tâches du jour</h2><span className="hx-badge">{ct.faites} / {ct.total}</span>
        <span className="hx-dnav"><button type="button" aria-label="Jour précédent" onClick={() => setDate(ajouterJours(date, -1))}>‹</button><button type="button" className="ox-link" onClick={() => setDate(jour)}>{date === jour ? "Aujourd'hui" : dateCourte(date)}</button><button type="button" aria-label="Jour suivant" onClick={() => setDate(ajouterJours(date, 1))}>›</button></span></header>
      <div className="hx-pdj"><PixelTaches date={date} taille={9} ecart={2} /><div><b>Le pixel du jour</b><small>1 tâche = 1 pixel · ✓ = terminée</small></div><strong>{ct.faites}<span> / {ct.total}</span></strong></div>
      <p className="hx-plegend">{["is-s1", "is-s3", "is-s2", "is-s5"].map((k) => { const s = STYLE_STATUT[k]; return <span key={k}><i style={{ background: s.fill, borderColor: s.stroke }} />{s.label}</span>; })}<span><i style={{ border: "2px solid #dc2626" }} />En retard</span><span><i className="is-bar" />avancement</span></p>
      {!ts.length && <p className="hx-empty">Rien de prévu ce jour-là.</p>}
      {ordre.map((pid) => {
        const p = projet(pid || null), l = (parProjet.get(pid) || []).sort((a, b) => (a.startTime || "99").localeCompare(b.startTime || "99"));
        return <Relie key={pid || "sans"} teinte={p.color}
          tete={<><i style={{ background: p.color }} /><b>{p.name}</b><span>{l.filter(fini).length} / {l.length}</span></>}
          lignes={l.map((t) => <div key={t.id} className={`hx-wr ${fini(t) ? "is-done" : ""} ${tacheId === t.id ? "is-sel" : ""}`}><button type="button" className="hx-wt2" onClick={() => ouvrir(t.id)}>{t.milestone ? "◆ " : ""}{t.title}</button>{puce(t)}<Coche t={t} /></div>)}
          cellules={l.map((t) => { const st = styleTache(t), lt = retard(t), f = fini(t); return { fil: st.wire, dessin: (x, y, s) => (
            <g className="hx-tc" data-tip={`${t.title}|${p.name} · ${st.label}${lt ? ` · ${joursRetard(t)} j de retard` : ""}|Échéance ${dateCourte(t.end)}${t.startTime ? " · " + t.startTime : ""}${t.progress ? ` · ${t.progress} %` : ""}`} onClick={() => ouvrir(t.id)}>
              <rect x={x} y={y} width={s} height={s} rx={s / 4} fill={st.fill} stroke={lt ? "#dc2626" : st.stroke} strokeWidth={lt ? 2 : 1.3} />
              {f ? <path d={`M${x + s * .28} ${y + s * .52} l${s * .15} ${s * .15} l${s * .3} -${s * .32}`} fill="none" stroke="#fff" strokeWidth={Math.max(1.4, s / 10)} strokeLinecap="round" strokeLinejoin="round" />
                : t.progress ? <rect x={x + 3} y={y + s - 5} width={(s - 6) * Number(t.progress) / 100} height="2.5" rx="1" fill="#245edb" /> : null}
            </g>) }; })} />;
      })}
      <div className="hx-week">{Array.from({ length: 7 }, (_, i) => ajouterJours(date, i - 3)).map((x) => { const k = compteTaches(x); return <button type="button" key={x} className={x === date ? "is-today" : ""} onClick={() => setDate(x)}><PixelTaches date={x} taille={6} ecart={1.5} /><b>{jourCourt(x).slice(0, 3)} {Number(x.slice(8))}</b><small>{k.faites} / {k.total}</small></button>; })}</div>
      <p className="hx-hint">Clic sur un pixel = ouvrir la fiche · la coche termine la tâche.</p>
    </section>
  );
}

export function PanneauHabitudes({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { etats, couleurHabitude, jour } = useJour();
  const act = useActionsHabitudes();
  const e = etats(date);
  return (
    <section className="hx-pxpanel" aria-label="Habitudes du jour, une habitude par pixel">
      <header className="hx-th"><h2>Habitudes</h2><span className="hx-badge">{e.faites} / {e.total}</span>
        <span className="hx-dnav"><button type="button" aria-label="Jour précédent" onClick={() => setDate(ajouterJours(date, -1))}>‹</button><button type="button" className="ox-link" onClick={() => setDate(jour)}>{date === jour ? "Aujourd'hui" : dateCourte(date)}</button><button type="button" aria-label="Jour suivant" disabled={date >= jour} onClick={() => setDate(ajouterJours(date, 1))}>›</button></span></header>
      <div className="hx-pdj"><PixelHabitudes date={date} taille={9} ecart={2} /><div><b>Le pixel du jour</b><small>1 habitude = 1 pixel · non applicables exclues</small></div><strong>{e.faites}<span> / {e.total}</span></strong></div>
      {!e.parTheme.length && <p className="hx-empty">Aucune habitude définie dans Nexora.</p>}
      {e.parTheme.map((pt) => {
        const f = pt.habitudes.filter((x) => x.etat === "fait" || x.etat === "partiel").length, tot = pt.habitudes.filter((x) => x.etat !== "na").length;
        return <Relie key={pt.theme.id} teinte={pt.theme.color}
          tete={<><i style={{ background: pt.theme.color }} /><b>{pt.theme.name}</b><span>{f} / {tot}</span><small>{pt.theme.selectionMode === "single" ? "un seul choix" : ""}</small></>}
          lignes={pt.habitudes.map((x) => { const col = couleurHabitude(x.h), na = x.etat === "na"; return (
            <div key={x.h.id} className={`hx-wr hx-hrow is-${x.etat}`} data-hp={x.h.id} style={{ ["--t" as string]: col }}>
              <span className="hx-hname"><i className="hx-hdot" style={{ background: col }} />{x.h.name}</span>
              {x.h.kind === "numeric"
                ? <span className="hx-step"><button type="button" aria-label="Moins" onClick={() => act.pas(x.h, date, x.valeur, -1, na)}>−</button><b>{x.valeur ?? 0}/{x.h.max}</b><button type="button" aria-label="Plus" onClick={() => act.pas(x.h, date, x.valeur, 1, na)}>+</button></span>
                : <button type="button" className={`hx-box ${x.etat === "fait" ? "is-on" : ""}`} aria-pressed={x.etat === "fait"} aria-label={x.h.name} onClick={() => act.basculer(x.h.id, date, na)}>{x.etat === "fait" ? "✓" : ""}</button>}
              <button type="button" className={`hx-na ${na ? "is-on" : ""}`} aria-pressed={na} title="Non applicable ce jour" onClick={() => act.na(x.h.id, date, !na)}>n/a</button>
            </div>); })}
          cellules={pt.habitudes.map((x) => { const col = couleurHabitude(x.h); return { fil: col, hp: x.h.id, dessin: (cx, cy, s) => (
            <g className="hx-pc" data-hp={x.h.id} data-tip={infoHabitude(x, pt.theme, date)} onClick={() => (x.h.kind === "numeric" ? act.pas(x.h, date, x.valeur, 1, x.etat === "na") : act.basculer(x.h.id, date, x.etat === "na"))}>
              {x.etat === "fait" ? <><rect x={cx} y={cy} width={s} height={s} rx={s / 4} fill={col} /><path d={`M${cx + s * .28} ${cy + s * .52} l${s * .15} ${s * .15} l${s * .3} -${s * .32}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>
                : x.etat === "partiel" ? <><rect x={cx} y={cy} width={s} height={s} rx={s / 4} fill={col} fillOpacity=".15" stroke={col} /><rect x={cx + 3} y={cy + s - 5} width={(s - 6) * Math.min(1, (x.valeur ?? 0) / (x.h.max || 1))} height="2.5" rx="1" fill={col} /><text x={cx + s / 2} y={cy + s / 2 + 2} textAnchor="middle" className="hx-pctxt">{x.valeur}/{x.h.max}</text></>
                  : x.etat === "na" ? <rect x={cx + .5} y={cy + .5} width={s - 1} height={s - 1} rx={s / 4} fill="url(#hx-na)" stroke="#cbd3de" />
                    : <rect x={cx + .5} y={cy + .5} width={s - 1} height={s - 1} rx={s / 4} fill="#fff" stroke={col} strokeOpacity=".5" />}
            </g>) }; })} />;
      })}
      <div className="hx-week">{Array.from({ length: 7 }, (_, i) => ajouterJours(date, i - 6)).map((x) => { const k = etats(x); return <button type="button" key={x} className={x === date ? "is-today" : ""} onClick={() => setDate(x)}><PixelHabitudes date={x} taille={6} ecart={1.5} /><b>{jourCourt(x).slice(0, 3)} {Number(x.slice(8))}</b><small>{k.faites} / {k.total}</small></button>; })}</div>
    </section>
  );
}

export function FilHoraire({ date }: { date: string }) {
  const items = useElementsHoraires()(date);
  const { jour } = useOptim();
  const { ouvrir } = useUi();
  const maintenant = heureParisDec();
  const lignes: ReactNode[] = []; let place = date !== jour;
  items.forEach((it, i) => {
    if (!place && it.h0 > maintenant) { lignes.push(<li key="now" className="hx-now"><time>{hmf(maintenant)}</time><span>Maintenant</span></li>); place = true; }
    lignes.push(<li key={i} className={(date < jour || (date === jour && it.h1 < maintenant)) || it.fini ? "is-past" : ""} style={{ ["--c" as string]: it.couleur }}><time>{hmf(it.h0)}</time>{it.id ? <button type="button" onClick={() => ouvrir(it.id!)}>{it.titre}</button> : <span>{it.titre}</span>}<small>{it.genre} · {Math.round((it.h1 - it.h0) * 60)} min</small></li>);
  });
  if (!place) lignes.push(<li key="now" className="hx-now"><time>{hmf(maintenant)}</time><span>Maintenant</span></li>);
  return <ol className="hx-fil">{lignes.length ? lignes : <li><span className="ox-dim">Rien d'horodaté ce jour-là.</span></li>}</ol>;
}
