// Lentille Frise (Ref #658) : Gantt des tâches de la requête, regroupées comme
// la liste. Port des règles du Mini-Gantt de nexora-project : barres et jalons,
// barre de synthèse par groupe, chemin critique, comparaison à la référence.
// Glisser une barre la déplace ; glisser un bord change le début ou la fin.
import { useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { ajouterJours, ecartJours, estEnRetard, estTerminee, type Catalogues, type Tache } from "../donnees/modele";
import type { Paquet } from "../donnees/requete";
import { cheminCritique, comparaison, couloirs, fenetreFrise, graduations, libelleEcart, lignesFrise, syntheseGroupe, type Baselines, type LigneFrise } from "../donnees/planning";
import { initiales } from "./Lignes";
import type { PrefsFrise } from "../donnees/prefs";
import { Bouton, Segment } from "../composants";

interface Props {
  paquets: Paquet[]; cat: Catalogues; aujourdhui: string; selection?: string; references: Baselines;
  prefs: PrefsFrise; setPrefs: (p: PrefsFrise) => void;
  onSelect: (id: string) => void; onOuvrir: (id: string) => void; onDeplacer: (id: string, patch: Partial<Tache>) => void;
}
type Prise = { id: string; mode: "deplacer" | "debut" | "fin"; x0: number; largeur: number; delta: number };

const court = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function Frise({ paquets, cat, aujourdhui, selection, references, prefs, setPrefs, onSelect, onOuvrir, onDeplacer }: Props) {
  const [zoom, setZoom] = useState(0);
  const [decalage, setDecalage] = useState(0);
  const [replies, setReplies] = useState<Record<string, boolean>>({});
  const [prise, setPrise] = useState<Prise | null>(null);
  const piste = useRef<HTMLDivElement>(null);

  const groupes = useMemo(() => paquets.map((p) => ({ p, lignes: lignesFrise(p.taches) })).filter((g) => g.lignes.length), [paquets]);
  const toutes = useMemo(() => groupes.flatMap((g) => g.lignes), [groupes]);
  const sansDates = paquets.reduce((n, p) => n + p.taches.length, 0) - toutes.length;
  const mode = prefs.reference === "aucune" ? null : prefs.reference;
  const cmp = useMemo(() => new Map(mode ? toutes.map((l) => [l.t.id, comparaison(l.t, references, mode)] as const) : []), [toutes, references, mode]);
  const refs = useMemo(() => [...cmp.values()].filter(Boolean).map((c) => ({ debut: c!.referenceStart, fin: c!.referenceEnd })), [cmp]);
  const f = useMemo(() => fenetreFrise(toutes, aujourdhui, zoom, decalage, refs), [toutes, aujourdhui, zoom, decalage, refs]);
  const axe = useMemo(() => graduations(f), [f]);
  const critique = useMemo(() => (prefs.critique ? cheminCritique(toutes.map((l) => l.t)) : null), [prefs.critique, toutes]);
  const pct = (iso: string) => (ecartJours(f.debut, iso) / f.jours) * 100;
  const largeurPct = (a: string, b: string) => Math.max(0.6, ((ecartJours(a, b) + 1) / f.jours) * 100);

  // Glisser : un jour par (largeur de piste / jours de la fenêtre).
  const saisir = (e: PE, l: LigneFrise, m: Prise["mode"]) => {
    if (e.button !== 0 || !piste.current) return;
    e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId);
    setPrise({ id: l.t.id, mode: l.jalon ? "deplacer" : m, x0: e.clientX, largeur: piste.current.getBoundingClientRect().width, delta: 0 });
  };
  const bouger = (e: PE) => { if (prise) setPrise({ ...prise, delta: Math.round(((e.clientX - prise.x0) / prise.largeur) * f.jours) }); };
  const lacher = (l: LigneFrise) => {
    if (!prise) return;
    const { delta, mode: m } = prise; setPrise(null);
    if (!delta) { onSelect(l.t.id); return; }
    if (l.jalon) onDeplacer(l.t.id, { start: ajouterJours(l.debut, delta), end: ajouterJours(l.fin, delta) });
    else if (m === "deplacer") onDeplacer(l.t.id, { start: ajouterJours(l.debut, delta), end: ajouterJours(l.fin, delta) });
    else if (m === "debut") { const d = ajouterJours(l.debut, delta); onDeplacer(l.t.id, { start: d <= l.fin ? d : l.fin }); }
    else { const d = ajouterJours(l.fin, delta); onDeplacer(l.t.id, { end: d >= l.debut ? d : l.debut }); }
  };
  const apercu = (l: LigneFrise) => {
    if (!prise || prise.id !== l.t.id || !prise.delta) return l;
    const d = prise.delta;
    if (l.jalon || prise.mode === "deplacer") return { ...l, debut: ajouterJours(l.debut, d), fin: ajouterJours(l.fin, d) };
    if (prise.mode === "debut") { const x = ajouterJours(l.debut, d); return { ...l, debut: x <= l.fin ? x : l.fin }; }
    const x = ajouterJours(l.fin, d); return { ...l, fin: x >= l.debut ? x : l.debut };
  };

  const auj = pct(aujourdhui);
  const barre = (l0: LigneFrise) => {
    const l = apercu(l0); const t = l.t;
    const fini = estTerminee(t, cat.statuts); const retard = estEnRetard(t, cat.statuts, aujourdhui);
    const p = cat.projets.find((x) => x.id === t.projectId);
    const couleur = cat.statuts.find((s) => s.id === t.statusId)?.color || p?.color || "var(--encre3)";
    const c = cmp.get(t.id) || null;
    const attenue = critique && !critique.has(t.id);
    const calendrier = !!(p?.gcalSource || p?.syncedCalendarSource);
    const av = fini ? 100 : Math.max(0, Math.min(100, Number(t.progress) || 0));
    const etiquette = `${t.title || "Sans titre"}, ${l.jalon ? `jalon le ${court(l.fin)}` : `du ${court(l.debut)} au ${court(l.fin)}`}${retard ? ", en retard" : ""}${c ? `, écart de fin ${libelleEcart(c.ecartFin)}` : ""}${critique?.has(t.id) ? ", chemin critique" : ""}`;
    return (
      <div key={t.id} role="row" data-id={t.id} aria-selected={selection === t.id} className={`fr-ligne ${selection === t.id ? "sel" : ""} ${attenue ? "attenue" : ""}`} onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)}>
        <div role="rowheader" className="fr-titre">
          <button type="button" className="ligne-lien" onClick={(e) => { e.stopPropagation(); onSelect(t.id); onOuvrir(t.id); }}>{l.jalon ? "◆ " : ""}{t.title || "Sans titre"}</button>
          <span className={`mono discret ${retard ? "crit" : ""}`}>{l.jalon ? court(l.fin) : `${court(l.debut)}→${court(l.fin)}`}</span>
        </div>
        <div role="gridcell" className="fr-piste">
          {c && <span className="fr-ref" style={{ left: `${pct(c.referenceStart)}%`, width: `${largeurPct(c.referenceStart, c.referenceEnd)}%` }} aria-hidden="true" />}
          {l.jalon ? (
            <span role="button" tabIndex={-1} aria-label={etiquette} className={`fr-jalon ${fini ? "fini" : ""} ${retard ? "retard" : ""} ${critique?.has(t.id) ? "critique" : ""}`} style={{ left: `${pct(l.fin) + 50 / f.jours}%`, ["--c" as string]: couleur }}
              onPointerDown={calendrier ? undefined : (e) => saisir(e, l0, "deplacer")} onPointerMove={bouger} onPointerUp={() => lacher(l0)} onPointerCancel={() => setPrise(null)} />
          ) : (
            <span role="button" tabIndex={-1} aria-label={etiquette} className={`fr-barre ${fini ? "fini" : ""} ${retard ? "retard" : ""} ${critique?.has(t.id) ? "critique" : ""} ${calendrier ? "fige" : ""}`}
              style={{ left: `${pct(l.debut)}%`, width: `${largeurPct(l.debut, l.fin)}%`, ["--c" as string]: couleur, ["--av" as string]: `${av}%` }}
              onPointerDown={calendrier ? undefined : (e) => saisir(e, l0, "deplacer")} onPointerMove={bouger} onPointerUp={() => lacher(l0)} onPointerCancel={() => setPrise(null)}>
              {!calendrier && <span className="fr-poignee g" onPointerDown={(e) => saisir(e, l0, "debut")} onPointerMove={bouger} onPointerUp={() => lacher(l0)} />}
              {!calendrier && <span className="fr-poignee d" onPointerDown={(e) => saisir(e, l0, "fin")} onPointerMove={bouger} onPointerUp={() => lacher(l0)} />}
            </span>
          )}
          {c && c.ecartFin !== 0 && <span className={`fr-ecart mono ${c.tonFin}`} style={{ left: `calc(${pct(l.fin) + 100 / f.jours}% + 6px)` }}>{libelleEcart(c.ecartFin)}</span>}
          {prise?.id === t.id && prise.delta !== 0 && <span className="fr-bulle mono" style={{ left: `${pct(l.debut)}%` }}>{l.jalon ? court(l.fin) : `${court(l.debut)} → ${court(l.fin)}`}</span>}
        </div>
      </div>
    );
  };

  // Bulle : titre dans la pastille, champs condensés dessous (responsable,
  // échéance, avancement), largeur minimale lisible.
  const bulle = (l: LigneFrise) => {
    const t = l.t; const fini = estTerminee(t, cat.statuts); const retard = estEnRetard(t, cat.statuts, aujourdhui);
    const couleur = cat.statuts.find((s) => s.id === t.statusId)?.color || cat.projets.find((x) => x.id === t.projectId)?.color || "var(--encre3)";
    const c = cmp.get(t.id) || null;
    const largeur = Math.max(largeurPct(l.debut, l.fin), 12);
    return (
      <button key={t.id} type="button" data-id={t.id} className={`fr-bulle-t ${selection === t.id ? "sel" : ""} ${fini ? "fini" : ""} ${retard ? "retard" : ""} ${critique?.has(t.id) ? "critique" : ""} ${critique && !critique.has(t.id) ? "attenue" : ""}`}
        style={{ left: `${pct(l.debut)}%`, width: `${largeur}%`, ["--c" as string]: couleur, ["--av" as string]: `${fini ? 100 : Math.max(0, Math.min(100, Number(t.progress) || 0))}%` }}
        onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)}
        aria-label={`${t.title || "Sans titre"}, ${l.jalon ? `jalon le ${court(l.fin)}` : `du ${court(l.debut)} au ${court(l.fin)}`}${retard ? ", en retard" : ""}${c ? `, écart de fin ${libelleEcart(c.ecartFin)}` : ""}`}>
        <span className="fr-bulle-titre">{l.jalon ? "◆ " : ""}{t.title || "Sans titre"}</span>
        <span className="fr-bulle-champs mono">{initiales(t.assignee) || "·"} · {court(l.fin)} · {fini ? 100 : Number(t.progress) || 0} %{c && c.ecartFin ? ` · ${libelleEcart(c.ecartFin)}` : ""}</span>
      </button>
    );
  };
  // Métro (Planning Projets) : une ligne par groupe, de la première à la
  // dernière date ; une station par tâche, sur sa fin.
  const metro = (libelle: string, couleurGroupe: string | undefined, lignes: LigneFrise[]) => {
    const s = syntheseGroupe(lignes, cat.statuts); if (!s) return null;
    const c = couleurGroupe || "var(--accent)";
    return (
      <div className="fr-ligne fr-metro" role="row">
        <div className="fr-titre" role="rowheader"><span className="point" style={{ background: c }} /><strong>{libelle}</strong><span className="mono discret">{lignes.length} · {s.avancement} %</span></div>
        <div className="fr-piste" role="gridcell">
          <span className="fr-metro-ligne" style={{ left: `${pct(s.debut)}%`, width: `${largeurPct(s.debut, s.fin)}%`, background: c }} aria-hidden="true" />
          {lignes.map((l) => {
            const t = l.t; const fini = estTerminee(t, cat.statuts); const retard = estEnRetard(t, cat.statuts, aujourdhui);
            return <button key={t.id} type="button" data-id={t.id} className={`fr-station ${l.jalon ? "jalon" : ""} ${fini ? "fini" : ""} ${retard ? "retard" : ""} ${selection === t.id ? "sel" : ""} ${critique && !critique.has(t.id) ? "attenue" : ""}`}
              style={{ left: `${pct(l.fin) + 50 / f.jours}%`, ["--c" as string]: c }} title={`${t.title} · ${court(l.fin)}`}
              aria-label={`${t.title || "Sans titre"}, station le ${court(l.fin)}${fini ? ", terminée" : retard ? ", en retard" : ""}`} onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)} />;
          })}
          <span className="fr-ecart mono conforme" style={{ left: `calc(${pct(s.fin) + 100 / f.jours}% + 8px)` }}>{s.avancement} %</span>
        </div>
      </div>
    );
  };

  return (
    <div className="frise">
      <div className="fr-outils">
        <Segment etiquette="Style de frise" valeur={prefs.style} onChange={(style) => setPrefs({ ...prefs, style })}
          options={[{ valeur: "barres", libelle: "Barres" }, { valeur: "bulles", libelle: "Bulles" }, { valeur: "metro", libelle: "Métro" }]} />
        <Segment etiquette="Référence" valeur={prefs.reference} onChange={(v) => setPrefs({ ...prefs, reference: v })}
          options={[{ valeur: "aucune", libelle: "Sans référence" }, { valeur: "courante", libelle: "Référence" }, { valeur: "initiale", libelle: "Plan initial" }]} />
        <label className="insp-case"><input type="checkbox" checked={prefs.critique} onChange={(e) => setPrefs({ ...prefs, critique: e.target.checked })} /> Chemin critique</label>
        <span className="discret fr-legende">{prefs.critique ? "double contour : critique · " : ""}rouge : retard{mode ? " · trait : référence" : ""}</span>
        <span className="marge-auto" />
        <span className="mono discret">{f.jours} j · {axe.unite}</span>
        <Bouton variante="discret" aria-label="Période précédente" onClick={() => setDecalage((d) => d - 1)}>←</Bouton>
        <Bouton variante="discret" aria-label="Dézoomer" disabled={zoom <= -8} onClick={() => setZoom((z) => z - 1)}>−</Bouton>
        <Bouton variante="discret" aria-label="Zoomer" disabled={zoom >= 8} onClick={() => setZoom((z) => z + 1)}>+</Bouton>
        <Bouton variante="discret" aria-label="Période suivante" onClick={() => setDecalage((d) => d + 1)}>→</Bouton>
        <Bouton variante="discret" disabled={!zoom && !decalage} onClick={() => { setZoom(0); setDecalage(0); }}>Tout voir</Bouton>
      </div>
      {!toutes.length ? <div className="vide"><p>Aucune tâche datée dans cette requête.</p>{sansDates > 0 && <p className="discret">{sansDates} tâche(s) sans dates ne sont pas représentées.</p>}</div> : (
        <div className="fr-corps" role="grid" aria-label="Frise des tâches" aria-rowcount={toutes.length}>
          <div className="fr-ligne fr-axe" role="row">
            <div className="fr-titre surtitre" role="columnheader">{toutes.length} tâches{sansDates ? ` · ${sansDates} sans dates` : ""}</div>
            <div className="fr-piste" ref={piste} role="columnheader">
              {axe.traits.map((g) => <span key={g.jour} className="fr-trait mono" style={{ left: `${g.position * 100}%` }}>{g.libelle}</span>)}
            </div>
          </div>
          <div className="fr-lignes">
            {auj >= 0 && auj <= 100 && <span className="fr-auj" style={{ left: `calc(var(--fr-titre) + (100% - var(--fr-titre)) * ${(auj + 50 / f.jours) / 100})` }} aria-hidden="true" />}
            {axe.traits.map((g) => <span key={g.jour} className="fr-grille" style={{ left: `calc(var(--fr-titre) + (100% - var(--fr-titre)) * ${g.position})` }} aria-hidden="true" />)}
            {groupes.map(({ p, lignes }) => {
              const s = syntheseGroupe(lignes, cat.statuts);
              const ferme = replies[p.cle];
              return (
                <div key={p.cle} role="rowgroup">
                  {prefs.style === "metro" ? metro(p.libelle, p.couleur, lignes) : p.cle !== "tout" && (
                    <div className="fr-ligne fr-groupe" role="row">
                      <div className="fr-titre" role="rowheader">
                        <button type="button" className="groupe" aria-expanded={!ferme} onClick={() => setReplies((r) => ({ ...r, [p.cle]: !r[p.cle] }))}>
                          <span aria-hidden="true">{ferme ? "▸" : "▾"}</span>{p.couleur && <span className="point" style={{ background: p.couleur }} />}{p.libelle}<span className="mono discret">· {lignes.length}</span>
                        </button>
                      </div>
                      <div className="fr-piste" role="gridcell">
                        {s && <span className="fr-synthese" style={{ left: `${pct(s.debut)}%`, width: `${largeurPct(s.debut, s.fin)}%`, ["--av" as string]: `${s.avancement}%` }} title={`${court(s.debut)} → ${court(s.fin)} · ${s.avancement} %`} />}
                        {s && <span className="fr-ecart mono conforme" style={{ left: `calc(${pct(s.fin) + 100 / f.jours}% + 6px)` }}>{s.avancement} %</span>}
                      </div>
                    </div>
                  )}
                  {!ferme && prefs.style === "barres" && lignes.map(barre)}
                  {!ferme && prefs.style === "bulles" && couloirs(lignes, Math.ceil(f.jours * 0.12)).map((c, k) => (
                    <div key={k} className="fr-ligne fr-couloir" role="row">
                      <div className="fr-titre" role="rowheader"><span className="mono discret">{k === 0 ? `${lignes.length} tâche(s)` : ""}</span></div>
                      <div className="fr-piste" role="gridcell">{c.map(bulle)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
