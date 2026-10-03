// Atlas (Ref #662, lot 9) : PROTOTYPE MESURÉ, en 2,5D SVG sans bibliothèque
// 3D. Premier niveau par espaces (la Carte), puis îlots en relief (l'Atlas) :
// hauteur = tâches ouvertes, blocs = tâches, calques budget, équipe, réunions,
// dépendances. Le panneau « Mesures » chiffre le coût du rendu et du zoom, avec
// une charge d'essai fictive (jamais écrite) pour décider de la généralisation.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Donnees } from "../donnees/magasin";
import type { Source } from "../donnees/source";
import type { SyntheseBudget } from "../donnees/finance";
import { etatsDuJour } from "../donnees/habitudes";
import { activitesDe, avancementObjectifs } from "../donnees/sport";
import { chargeEssai, construireAtlas, initialesDe, type Atlas as Monde, type Extras, type Ilot, type Region } from "../donnees/atlas";
import { estTerminee, type Tache } from "../donnees/modele";
import { naviguer } from "../navigation/routeur";
import { Bouton, Cartouche, Etat, Surtitre } from "../composants";

const U = 30, K = 0.866;
const P = (x: number, y: number, z: number): [number, number] => [(x - y) * U * K, (x + y) * U * 0.5 - z * U];
const pts = (l: [number, number, number][]) => l.map(([x, y, z]) => P(x, y, z).map((v) => v.toFixed(1)).join(",")).join(" ");
// Repère d'un plan horizontal à la hauteur z (texte « couché » sur le sol ou un îlot).
const plan = (z: number) => `matrix(${(K * U).toFixed(3)},${(0.5 * U).toFixed(3)},${(-K * U).toFixed(3)},${(0.5 * U).toFixed(3)},0,${(-z * U).toFixed(3)})`;
// Repère de la face avant gauche d'un bloc (plan y = cste).
const faceAvant = (y: number) => `matrix(${(K * U).toFixed(3)},${(0.5 * U).toFixed(3)},0,${U},${(-y * U * K).toFixed(3)},${(y * 0.5 * U).toFixed(3)})`;
const SEUIL_DETAIL = 60; // au-delà, en vue d'ensemble, les blocs sont résumés par une barre
const COUL_ETAT = { retard: "var(--crit)", ouvert: "", jalon: "var(--encre)", fait: "var(--ligne)" } as const;

type Calque = "taches" | "budget" | "equipe" | "reunions" | "deps";
type Vue = { niveau: 0 } | { niveau: 1; region: Region["id"] } | { niveau: 2; region: Region["id"]; ilot: string };

function Bloc({ x, y, w, d, z0 = 0, h, c, className, onClick, titre }: { x: number; y: number; w: number; d: number; z0?: number; h: number; c: string; className?: string; onClick?: () => void; titre?: string }) {
  const z1 = z0 + h;
  return (
    <g className={className} onClick={onClick}>
      {titre && <title>{titre}</title>}
      <polygon points={pts([[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]])} style={{ fill: `color-mix(in srgb, ${c} 62%, #000 12%)` }} />
      <polygon points={pts([[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]])} style={{ fill: `color-mix(in srgb, ${c} 78%, #000 22%)` }} />
      <polygon className="at-dessus" points={pts([[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]])} style={{ fill: c }} />
    </g>
  );
}

function boite(cs: [number, number, number][], marge: number, ratio: number): [number, number, number, number] {
  const p = cs.map(([x, y, z]) => P(x, y, z)); const xs = p.map((v) => v[0]), ys = p.map((v) => v[1]);
  let x0 = Math.min(...xs) - marge, x1 = Math.max(...xs) + marge, y0 = Math.min(...ys) - marge, y1 = Math.max(...ys) + marge;
  const w = x1 - x0, h = y1 - y0;
  if (w / h < ratio) { const nw = h * ratio; x0 -= (nw - w) / 2; x1 = x0 + nw; } else { const nh = w / ratio; y0 -= (nh - h) / 2; y1 = y0 + nh; }
  return [x0, y0, x1 - x0, y1 - y0];
}

function useExtras(source: Source, d: Donnees): Extras {
  const [budgetMois, setBudget] = useState<Extras["budgetMois"]>(null);
  const [sport, setSport] = useState<Extras["sport"]>(null);
  useEffect(() => { let v = true; source.finance?.lire("budget-summary", { month: d.aujourdhui.slice(0, 7) }).then((x) => { const s = x as SyntheseBudget; if (v) setBudget({ reste: s.totals.remaining, budget: s.totals.budget, aCategoriser: (s.toCategorize || []).length }); }).catch(() => {}); return () => { v = false; }; }, [source, d.aujourdhui]);
  useEffect(() => { let v = true; source.corps?.lire("sport-activities").then((x) => { const o = avancementObjectifs(activitesDe(x), d.objectifsSport, d.aujourdhui).hebdo; if (v) setSport(o ? { fait: o.fait, cible: o.cible } : { fait: 0, cible: null }); }).catch(() => {}); return () => { v = false; }; }, [source, d.aujourdhui]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = etatsDuJour(d.themesHabitudes, d.journalHabitudes, d.nonApplicables, d.aujourdhui);
  return { budgetMois, sport, habitudes: e.total ? { faites: e.faites, total: e.total } : null, depenses: d.depenses };
}

export function PageAtlas({ d, source, onOuvrir }: { d: Donnees; source: Source; onOuvrir: (id: string) => void }) {
  const extras = useExtras(source, d);
  const [essai, setEssai] = useState<{ n: number; t: number } | null>(null);
  const [calques, setCalques] = useState<Record<Calque, boolean>>({ taches: true, budget: true, equipe: true, reunions: true, deps: true });
  const [detail, setDetail] = useState<"auto" | "toujours">("auto");
  const [mesures, setMesures] = useState(false);
  const [vue, setVue] = useState<Vue>({ niveau: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const anim = useRef(0);
  const t0 = performance.now();

  // Données : réelles, ou charge d'essai (jamais écrite) pour la mesure.
  const entree = useMemo(() => {
    if (!essai) return { taches: d.taches, projets: d.projets, dossiers: d.dossiers, statuts: d.statuts, types: d.types, membres: d.membresEquipe, jour: d.aujourdhui };
    const c = chargeEssai(essai.n, essai.t, d.aujourdhui);
    return { ...c, statuts: [{ id: "__ouvert", name: "En cours" }, { id: "__fait", name: "Terminé" }], types: d.types, membres: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, name: `Personne ${i + 1}` })), jour: d.aujourdhui };
  }, [essai, d.taches, d.projets, d.dossiers, d.statuts, d.types, d.membresEquipe, d.aujourdhui]);
  const tCalcul = useRef(0);
  const monde: Monde = useMemo(() => { const a = performance.now(); const m = construireAtlas(entree, essai ? {} : extras); tCalcul.current = performance.now() - a; return m; }, [entree, extras, essai]);
  const tachesParId = useMemo(() => new Map(entree.taches.map((t) => [t.id, t])), [entree.taches]);
  const ilotZoom = vue.niveau === 2 ? monde.ilots.find((i) => i.id === vue.ilot) : undefined;
  // Niveau de détail : blocs dessinés seulement si peu d'îlots sont visibles ; au zoom sur
  // un îlot, lui seul est détaillé. Mesuré : au-delà, le rendu bloque l'écran (voir #662).
  const visibles = vue.niveau === 0 ? monde.ilots.length : monde.ilots.filter((i) => i.region === vue.region).length;
  const detaille = (i: Ilot) => detail === "toujours" || (vue.niveau === 2 ? vue.ilot === i.id || visibles <= SEUIL_DETAIL : visibles <= SEUIL_DETAIL);
  const resume = detail === "auto" && visibles > SEUIL_DETAIL;

  const vbTout = useMemo(() => boite(monde.regions.flatMap((r) => [[r.x, r.y, 0], [r.x + r.w, r.y, 0], [r.x + r.w, r.y + r.d, 0], [r.x, r.y + r.d, 0], [r.x, r.y, 3]] as [number, number, number][]), 30, 16 / 9), [monde]);
  const cible = (v: Vue): [number, number, number, number] => {
    if (v.niveau === 1) { const r = monde.regions.find((x) => x.id === v.region)!; return boite([[r.x, r.y, 4], [r.x + r.w, r.y, 0], [r.x + r.w, r.y + r.d, 0], [r.x, r.y + r.d, 0]], 30, 16 / 9); }
    if (v.niveau === 2) { const i = monde.ilots.find((x) => x.id === v.ilot); if (i) { const b = boite([[i.x, i.y, i.h + 2.6], [i.x + i.w, i.y, i.h], [i.x + i.w, i.y + i.d, 0], [i.x, i.y + i.d, 0]], 50, 16 / 9); return [b[0] + b[2] * 0.12, b[1], b[2], b[3]]; } }
    return vbTout;
  };
  // Zoom : animation du viewBox hors de React (aucun rendu par image) ; mesure des images.
  const demande = useRef<Vue | null>(null);
  const aller = (v: Vue) => { demande.current = v; setVue(v); };
  // L'animation démarre APRÈS le rendu du nouveau niveau : sa mesure ne compte que les images.
  useLayoutEffect(() => {
    const v = demande.current; demande.current = null;
    if (v) animer(v);
  }, [vue]); // eslint-disable-line react-hooks/exhaustive-deps
  const animer = (v: Vue) => {
    const el = svg.current; if (!el) return;
    const depart = (el.getAttribute("viewBox") || vbTout.join(" ")).split(" ").map(Number); const fin = cible(v);
    cancelAnimationFrame(anim.current);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { el.setAttribute("viewBox", fin.join(" ")); return; }
    const debut = performance.now(); let prec = debut; const ecarts: number[] = [];
    const pas = (t: number) => {
      ecarts.push(t - prec); prec = t;
      const k = Math.min(1, (t - debut) / 600), e = 1 - Math.pow(1 - k, 3);
      el.setAttribute("viewBox", depart.map((a, j) => a + (fin[j] - a) * e).join(" "));
      if (k < 1) anim.current = requestAnimationFrame(pas);
      else if (panneau.current) { const im = ecarts.slice(1); const z = panneau.current.querySelector("[data-m=zoom]"); if (z) z.textContent = im.length ? `${Math.round(im.length / ((t - debut) / 1000))} images/s · pire image ${Math.max(...im).toFixed(0)} ms` : "animation sautée (image trop longue)"; }
    };
    anim.current = requestAnimationFrame(pas);
  };
  useEffect(() => { svg.current?.setAttribute("viewBox", cible(vue).join(" ")); }, [monde]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape" && vue.niveau > 0 && !document.querySelector('[role="dialog"]')) { e.preventDefault(); aller(vue.niveau === 2 ? { niveau: 1, region: vue.region } : { niveau: 0 }); } }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); });
  // Mesure du rendu : écrite directement dans le panneau (pas de nouveau rendu).
  useLayoutEffect(() => {
    if (!panneau.current) return;
    const set = (k: string, v: string) => { const z = panneau.current!.querySelector(`[data-m=${k}]`); if (z) z.textContent = v; };
    set("rendu", `${(performance.now() - t0).toFixed(0)} ms (dont disposition ${tCalcul.current.toFixed(1)} ms)`);
    set("noeuds", `${svg.current?.querySelectorAll("*").length ?? 0} éléments SVG`);
  });

  const cliqueIlot = (i: Ilot) => (vue.niveau === 0 ? aller({ niveau: 1, region: i.region }) : vue.niveau === 2 && vue.ilot === i.id ? undefined : aller({ niveau: 2, region: i.region, ilot: i.id }));
  const tri = [...monde.ilots].sort((a, b) => a.x + a.y - (b.x + b.y));
  const centre = (i: Ilot): [number, number] => P(i.x + i.w / 2, i.y + i.d / 2, i.h);

  return (
    <div className="espace at">
      <Cartouche surtitre="Atlas · prototype mesuré" titre={vue.niveau === 0 ? "Vue d'ensemble" : vue.niveau === 1 ? monde.regions.find((r) => r.id === vue.region)?.nom : ilotZoom?.nom}
        meta={<><span>{monde.ilots.filter((i) => i.region === "chantiers").length} projets</span><span>{entree.taches.length} tâches</span>{essai && <Etat ton="alerte" point={false}>charge d'essai</Etat>}</>}
        actions={<Bouton variante="discret" aria-pressed={mesures} onClick={() => setMesures((x) => !x)}>Mesures</Bouton>} />
      <div className="at-barre">
        <nav className="at-fil" aria-label="Fil d'Ariane">
          <button type="button" onClick={() => aller({ niveau: 0 })}>Tout</button>
          {vue.niveau !== 0 && <><span>›</span><button type="button" onClick={() => aller({ niveau: 1, region: vue.region })}>{monde.regions.find((r) => r.id === vue.region)?.nom}</button></>}
          {vue.niveau === 2 && <><span>›</span><b>{ilotZoom?.nom}</b></>}
        </nav>
        <div className="at-calques" role="group" aria-label="Calques">
          {([["taches", "Tâches"], ["budget", "Budget"], ["equipe", "Équipe"], ["reunions", "Réunions"], ["deps", "Dépendances"]] as [Calque, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={calques[k]} onClick={() => setCalques((c) => ({ ...c, [k]: !c[k] }))}>{l}</button>
          ))}
        </div>
      </div>
      <div className="at-scene">
        <svg ref={svg} className="at-svg" role="img" aria-label="Atlas en 2,5D" onClick={(e) => { if (e.target === e.currentTarget && vue.niveau > 0) aller(vue.niveau === 2 ? { niveau: 1, region: vue.region } : { niveau: 0 }); }}>
          <defs><marker id="at-fleche" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" style={{ fill: "var(--encre)" }} /></marker></defs>
          {monde.regions.map((r) => (
            <g key={r.id} className="at-region" onClick={() => vue.niveau === 0 && aller({ niveau: 1, region: r.id })}>
              <polygon points={pts([[r.x, r.y, 0], [r.x + r.w, r.y, 0], [r.x + r.w, r.y + r.d, 0], [r.x, r.y + r.d, 0]])} style={{ fill: `color-mix(in srgb, ${r.couleur} 8%, var(--surface))`, stroke: `color-mix(in srgb, ${r.couleur} 45%, transparent)` }} />
            </g>
          ))}
          {monde.zones.map((z) => (
            <g key={z.nom} pointerEvents="none">
              <polygon points={pts([[z.x, z.y, 0.01], [z.x + z.w, z.y, 0.01], [z.x + z.w, z.y + z.d, 0.01], [z.x, z.y + z.d, 0.01]])} style={{ fill: "none", stroke: `color-mix(in srgb, ${z.couleur} 45%, transparent)` }} strokeDasharray="5 5" />
            </g>
          ))}
          {tri.map((i) => {
            const autre = vue.niveau === 2 && vue.ilot !== i.id; const focus = vue.niveau === 2 && vue.ilot === i.id;
            const fond = `color-mix(in srgb, ${i.couleur} 24%, var(--surface))`;
            return (
              <g key={i.id} className="at-ilot" data-ilot={i.id} style={{ opacity: autre ? 0.3 : 1 }} onClick={(e) => { e.stopPropagation(); cliqueIlot(i); }}>
                <Bloc x={i.x} y={i.y} w={i.w} d={i.d} h={i.h} c={fond} titre={`${i.nom} · ${i.metrique}`} />
                <g transform={faceAvant(i.y + i.d)} pointerEvents="none"><text x={i.x + 0.25} y={-i.h / 2 + 0.16} fontSize={Math.min(0.46, i.h * 0.55)} className="at-nom">{i.nom}</text></g>
                {calques.taches && (!detaille(i) || i.cubes.length === 0 ? (i.ouvertes > 0 && i.region !== "finances" && i.region !== "corps" && (
                  <g transform={plan(i.h)} pointerEvents="none"><rect x={i.x + 0.4} y={i.y + 1.2} width={(i.w - 0.8) * Math.min(1, i.ouvertes / 30)} height={0.5} rx={0.1} style={{ fill: i.couleur }} />
                    {i.retards > 0 && <rect x={i.x + 0.4} y={i.y + 1.8} width={(i.w - 0.8) * Math.min(1, i.retards / 30)} height={0.5} rx={0.1} style={{ fill: "var(--crit)" }} />}</g>
                )) : [...i.cubes].sort((a, b) => a.x + a.y - (b.x + b.y)).map((c, n) => {
                  const ch = c.etat === "fait" ? 0.15 : 0.55;
                  return (
                    <g key={c.id} onClick={focus ? (e) => { e.stopPropagation(); onOuvrir(c.id); } : undefined} className={focus ? "at-cube actif" : "at-cube"}>
                      <Bloc x={i.x + c.x} y={i.y + c.y} w={0.7} d={0.7} z0={i.h} h={ch} c={COUL_ETAT[c.etat] || i.couleur} titre={tachesParId.get(c.id)?.title} />
                      {focus && (() => { const [nx, ny] = P(i.x + c.x + 0.35, i.y + c.y + 0.35, i.h + ch); return <text x={nx} y={ny + 4} textAnchor="middle" fontSize={11} className="at-num">{i.cubes.indexOf(c) + 1 || n + 1}</text>; })()}
                    </g>
                  );
                }))}
                {calques.budget && i.budget !== null && (() => { const bx = i.x + i.w - 0.75, by = i.y + 0.2, hb = 2.4 * Math.min(1.2, i.budget); const [lx, ly] = P(bx + 0.45, by, i.h + Math.max(hb, 2.4) + 0.15); return (
                  <g pointerEvents="none"><Bloc x={bx} y={by} w={0.45} d={0.45} z0={i.h} h={2.4} c="var(--ligne2)" /><Bloc x={bx} y={by} w={0.45} d={0.45} z0={i.h} h={hb} c={i.budget > 1 ? "var(--crit)" : i.budget > 0.9 ? "var(--alerte)" : "var(--ok)"} />
                    <text x={lx + 4} y={ly} fontSize={10} className="at-meta" style={i.budget > 1 ? { fill: "var(--crit)" } : undefined}>{Math.round(i.budget * 100)} %</text></g>); })()}
              </g>
            );
          })}
          <g pointerEvents="none" className="at-etiquettes">
            {monde.regions.map((r) => (
              <g key={`t${r.id}`} transform={plan(0)} style={{ opacity: vue.niveau === 0 || ("region" in vue && vue.region === r.id) ? 1 : 0.35 }}>
                <text x={r.x + 0.4} y={r.y + r.d + 1.05} fontSize={1} className="at-titre" style={{ fill: r.couleur }}>{r.nom}</text>
                <text x={r.x + 0.42} y={r.y + r.d + 1.7} fontSize={0.42} className="at-meta">{r.metrique}</text>
              </g>
            ))}
            {!(vue.niveau === 0 && resume) && monde.zones.map((z) => <g key={`z${z.nom}`} transform={plan(0.01)}><text x={z.x + 0.3} y={z.y + z.d + 0.5} fontSize={0.4} className="at-zone" style={{ fill: z.couleur }}>{z.nom.toUpperCase()}</text></g>)}
          </g>
          <g pointerEvents="none">
            {calques.equipe && !resume && monde.ilots.filter((i) => i.equipe.length).map((i) => i.equipe.map((n, k) => { const ax = i.x + i.w * 0.4 + k * 0.85; const [x, y] = P(ax, i.y - 0.2, i.h + 1.5); const [x0, y0] = P(ax, i.y + 0.3, i.h); return (
              <g key={`${i.id}${n}`} style={{ opacity: vue.niveau === 2 && vue.ilot !== i.id ? 0.3 : 1 }}><line x1={x} y1={y} x2={x0} y2={y0} className="at-tige" /><circle cx={x} cy={y} r={10} className="at-avatar" /><text x={x} y={y + 3.5} textAnchor="middle" fontSize={9.5} className="at-init">{initialesDe(n)}</text></g>); }))}
            {calques.reunions && monde.ilots.filter((i) => i.reunion).map((i) => { const [x, y] = P(i.x + 0.25, i.y + 0.25, i.h); return (
              <g key={`r${i.id}`}><line x1={x} y1={y} x2={x} y2={y - 30} className="at-mat" /><polygon points={`${x},${y - 30} ${x + 14},${y - 25.5} ${x},${y - 21}`} className="at-drapeau" /><text x={x + 17} y={y - 23} fontSize={10} className="at-meta">{i.reunion}</text></g>); })}
            {calques.deps && monde.liens.map((l) => { const a = monde.ilots.find((i) => i.id === l.de), b = monde.ilots.find((i) => i.id === l.vers); if (!a || !b) return null; const [x0, y0] = centre(a), [x1, y1] = centre(b); const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 80; return (
              <g key={`${l.de}${l.vers}`}><path d={`M${x0} ${y0} Q${mx} ${my} ${x1} ${y1}`} className="at-dep" markerEnd="url(#at-fleche)" />{l.nb > 1 && <text x={(x0 + 2 * mx + x1) / 4} y={(y0 + 2 * my + y1) / 4 - 4} textAnchor="middle" fontSize={10} className="at-meta">{l.nb}</text>}</g>); })}
          </g>
        </svg>
        <MiniCarte monde={monde} vue={vue} />
        {mesures && (
          <div className="panneau at-mesures" ref={panneau} aria-label="Mesures">
            <Surtitre>Mesures du prototype</Surtitre>
            <dl><dt>Rendu</dt><dd className="mono" data-m="rendu">—</dd><dt>Taille</dt><dd className="mono" data-m="noeuds">—</dd><dt>Dernier zoom</dt><dd className="mono" data-m="zoom">zoome pour mesurer</dd>
              <dt>Détail</dt><dd>{resume ? `résumé : ${visibles} îlots visibles (seuil ${SEUIL_DETAIL})` : "blocs dessinés"}</dd></dl>
            <div className="at-essai">
              <Bouton variante={!essai ? "principal" : "secondaire"} onClick={() => { setEssai(null); setVue({ niveau: 0 }); }}>Mes données</Bouton>
              {[[100, 12], [300, 15], [600, 15]].map(([n, t]) => <Bouton key={n} variante={essai?.n === n ? "principal" : "secondaire"} onClick={() => { setEssai({ n, t }); setVue({ niveau: 0 }); }}>Essai {n} projets</Bouton>)}
            </div>
            <label className="eq-opt"><input type="checkbox" checked={detail === "toujours"} onChange={(e) => setDetail(e.target.checked ? "toujours" : "auto")} /> Toujours dessiner chaque bloc</label>
            <p className="discret">La charge d'essai est fictive, calculée dans le navigateur et jamais enregistrée.</p>
          </div>
        )}
        {ilotZoom && <Tiroir ilot={ilotZoom} taches={tachesParId} statuts={entree.statuts} essai={!!essai} onOuvrir={onOuvrir} fermer={() => aller({ niveau: 1, region: ilotZoom.region })} />}
      </div>
      <p className="discret at-aide">Clique une région, puis un îlot, puis un bloc pour ouvrir la tâche. Échap ou un clic sur le fond pour reculer. Hauteur d'un îlot = tâches ouvertes ; bloc rouge = en retard ; colonne = budget consommé.</p>
    </div>
  );
}

function Tiroir({ ilot, taches, statuts, essai, onOuvrir, fermer }: { ilot: Ilot; taches: Map<string, Tache>; statuts: Donnees["statuts"]; essai: boolean; onOuvrir: (id: string) => void; fermer: () => void }) {
  const liste = ilot.cubes.map((c) => ({ c, t: taches.get(c.id) })).filter((x): x is { c: typeof x.c; t: Tache } => !!x.t);
  return (
    <aside className="panneau at-tiroir" aria-label={`Îlot ${ilot.nom}`}>
      <div className="at-tiroir-tete"><div><Surtitre>{ilot.region === "chantiers" ? "Projet" : ilot.region === "equipe" ? "Personne" : ilot.region === "finances" ? "Finances" : "Corps"}</Surtitre><h3>{ilot.nom}</h3></div><Bouton variante="discret" aria-label="Fermer" onClick={fermer}>×</Bouton></div>
      <p className="discret mono">{ilot.metrique}{ilot.budget !== null ? ` · budget ${Math.round(ilot.budget * 100)} %` : ""}{ilot.reunion ? ` · réunion ${ilot.reunion}` : ""}</p>
      {liste.map(({ c, t }, n) => (
        <button key={c.id} type="button" className="at-t" disabled={essai} onClick={() => onOuvrir(c.id)}>
          <span className={`at-n ${c.etat}`}>{n + 1}</span><span className={estTerminee(t, statuts) ? "fini" : ""}>{t.title}</span><span className="mono discret">{t.end ? `${t.end.slice(8, 10)}/${t.end.slice(5, 7)}` : ""}</span>
        </button>
      ))}
      {ilot.enPlus > 0 && <p className="discret">et {ilot.enPlus} autre{ilot.enPlus > 1 ? "s" : ""}</p>}
      {ilot.lien && !essai && <Bouton variante="principal" onClick={() => naviguer(ilot.lien!.split("?")[0])}>{ilot.region === "chantiers" ? "Ouvrir le projet" : ilot.region === "equipe" ? "Voir l'équipe" : `Ouvrir ${ilot.region === "finances" ? "Finances" : "Corps"}`}</Bouton>}
    </aside>
  );
}

function MiniCarte({ monde, vue }: { monde: Monde; vue: Vue }) {
  const k = Math.min(170 / monde.largeur, 110 / monde.profondeur);
  return (
    <svg className="at-mini" viewBox={`0 0 ${monde.largeur * k + 8} ${monde.profondeur * k + 8}`} aria-hidden="true">
      {monde.regions.map((r) => <rect key={r.id} x={4 + r.x * k} y={4 + r.y * k} width={r.w * k} height={r.d * k} rx={2} style={{ fill: r.couleur, opacity: vue.niveau === 0 || ("region" in vue && vue.region === r.id) ? 0.55 : 0.18 }} />)}
      {vue.niveau === 2 && (() => { const i = monde.ilots.find((x) => x.id === vue.ilot); return i ? <rect x={4 + i.x * k} y={4 + i.y * k} width={Math.max(2, i.w * k)} height={Math.max(2, i.d * k)} style={{ fill: "none", stroke: "var(--encre)", strokeWidth: 1.5 }} /> : null; })()}
    </svg>
  );
}
