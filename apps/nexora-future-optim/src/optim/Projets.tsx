// Projets (Ref #688) : comparaison à la référence courante ou au plan
// initial (comparison de chaque tâche, repli nexora:taskBaselines), barres
// fantômes, glissements, dérive ; groupement libre des tâches ; mêmes
// représentations et filtres que le Planning.
import { useState, type ReactNode } from "react";
import { ajouterJours, CRITICITES, ecartJours, type Tache } from "../donnees/modele";
import { comparaison, libelleEcart, lignesFrise, type Comparaison } from "../donnees/planning";
import { santeProjet } from "../donnees/projet";
import { COLONNES_PROJET, GROUPES_PROJET, REFERENCES, type ColonneProjet, type GroupeProjet, type Reference, type VueEnregistree, type Zoom } from "../donnees/prefs";
import { dateCourte, initiales, useOptim, useUi } from "./contexte";
import { ListeCoches } from "./ListeCoches";
import { BarreFiltres, useFiltrage } from "./filtres";
import { BarreProjet, clairsemer, Grille, graduations, infobulle, plage, tx } from "./frise";
import { AideStyle, BarreZoom, SelecteurStyle } from "./Planning";
import { Coche } from "./jour";
import { FriseProjet } from "./FriseProjet";

export const ZOOMS_PROJET: Zoom[] = ["jour", "semaine", "mois", "trimestre", "annee", "pluri"];
// Colonnes du planning détaillé (retour du 03/10/2026) : libellé, en-tête et largeur.
const COLONNES: Record<ColonneProjet, { libelle: string; largeur: string }> = { resp: { libelle: "Responsable", largeur: "36px" }, debut: { libelle: "Début", largeur: "58px" }, fin: { libelle: "Fin", largeur: "58px" }, ref: { libelle: "Référence", largeur: "58px" }, derive: { libelle: "Dérive", largeur: "52px" } };
export const LIB_GROUPE: Record<GroupeProjet, string> = { aucun: "Aucun", statut: "Statut", responsable: "Responsable", type: "Type", criticite: "Criticité", echeance: "Échéance", jalon: "Tâche / jalon" };
export const LIB_REF: Record<Reference, string> = { aucune: "Aucune", courante: "Référence courante", initiale: "Plan initial" };

// Date exploitable : les données réelles contiennent des valeurs corrompues
// (ex. « NaN-NaN-NaN » importé de Todoist, #688) qu'aucun calcul ne doit voir.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (v: unknown): v is string => typeof v === "string" && ISO.test(v);

interface Groupe { id: string; libelle: string; couleur: string; taches: Tache[]; }

export function Projets({ projetId, email, ouvrirProjet }: { projetId: string | null; email: string; ouvrirProjet: (id: string) => void }) {
  const o = useOptim();
  const { d, jour, prefs, ecrirePrefs, projet, statut, fini, retard, joursRetard } = o;
  const { filtre, ouvrir, tacheId, setSaisie } = useUi();
  const filtrer = useFiltrage();
  const [decalage, setDecalage] = useState(0);
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const p = projet(projetId && d.projets.some((x) => x.id === projetId) ? projetId : d.projets[0]?.id);
  if (!p.id) return <main className="hx-main"><p className="hx-empty">Aucun projet dans Nexora.</p></main>;
  const { zoom, groupe, reference } = prefs.projets, style = prefs.gantt;
  const colonnes = prefs.projets.colonnes, voir = Object.fromEntries(COLONNES_PROJET.map((k) => [k, colonnes.includes(k)])) as Record<ColonneProjet, boolean>;
  const gabarit = ["minmax(200px, 1.3fr)", ...COLONNES_PROJET.filter((k) => voir[k]).map((k) => COLONNES[k].largeur), "minmax(380px, 3fr)"].join(" ");
  const choisirColonnes = (l: ColonneProjet[]) => void ecrirePrefs({ projets: { ...prefs.projets, colonnes: COLONNES_PROJET.filter((k) => l.includes(k)) } });
  const r = plage(zoom, decalage, jour);
  const dossier = d.dossiers.find((f) => f.id === (p.folderId || "folder-a-trier"));
  const toutes = d.taches.filter((t) => t.projectId === p.id);
  const ts = filtrer(toutes, { ...filtre, projets: [] }).sort((a, b) => (a.start || a.end || "9999").localeCompare(b.start || b.end || "9999"));
  const sante = santeProjet(d.taches, p.id, d, jour);
  const cmp = (t: Tache): Comparaison | null => (reference === "aucune" ? null : comparaison(t, d.references, reference));
  const reelles = toutes.filter((t) => statut(t.statusId).name.toLowerCase() !== "information");
  const finAct = reelles.reduce((m, t) => (iso(t.end) && t.end > m ? t.end : m), "");
  const finRef = reference !== "aucune" ? reelles.reduce((m, t) => { const c = cmp(t); const x = c ? c.referenceEnd : iso(t.end) ? t.end : ""; return x > m ? x : m; }, "") : "";
  const ecarts = reelles.map((t) => cmp(t)?.ecartFin).filter((x): x is number => typeof x === "number");
  const glissees = ecarts.filter((x) => x > 0).length, avance = ecarts.filter((x) => x < 0).length, heure = ecarts.filter((x) => x === 0).length;
  const moyenne = ecarts.length ? ecarts.reduce((a, b) => a + b, 0) / ecarts.length : 0;
  const infos = (t: Tache) => ({ fini: fini(t), retard: retard(t), joursRetard: joursRetard(t), jour });
  const cellEcart = (n: number | null | undefined) => (n == null ? <span className="hx-dim">—</span> : n === 0 ? <span className="hx-dim">0 j</span> : <span className={n > 0 ? "hx-red" : "hx-green"}>{libelleEcart(n)}</span>);
  const appliquer = (v: VueEnregistree) => { void ecrirePrefs({ projets: { ...prefs.projets, ...(v.zoom ? { zoom: v.zoom } : {}), ...(v.groupe && (GROUPES_PROJET as readonly string[]).includes(v.groupe) ? { groupe: v.groupe as GroupeProjet } : {}), ...(v.reference ? { reference: v.reference } : {}) }, ...(v.style ? { gantt: v.style } : {}) }); setDecalage(0); };

  const ligne = (t: Tache): ReactNode => {
    const c = cmp(t), l = lignesFrise([t])[0];
    let piste: ReactNode = null;
    if (l) {
      const a1 = l.jalon ? tx(r, l.debut) : tx(r, ajouterJours(l.fin, 1));
      let fantome: ReactNode = null, lien: ReactNode = null;
      if (c) {
        const g0 = tx(r, c.referenceStart), g1 = l.jalon ? g0 : tx(r, ajouterJours(c.referenceEnd, 1));
        if (l.jalon) { if (g0 >= 0 && g0 <= 100) fantome = <i className="hx-gms" style={{ left: `${g0}%` }} />; }
        else if (g1 >= 0 && g0 <= 100) fantome = <i className="hx-ghost" style={{ left: `${Math.max(0, g0)}%`, width: `${Math.max(.3, Math.min(100, g1) - Math.max(0, g0))}%` }} />;
        const ce = l.jalon ? g0 : g1, c0 = Math.max(0, Math.min(ce, a1)), c1 = Math.min(100, Math.max(ce, a1));
        if (c.ecartFin && c1 > c0) lien = <i className={`hx-conn ${c.ecartFin > 0 ? "is-late" : "is-early"}`} style={{ left: `${c0}%`, width: `${c1 - c0}%` }} />;
      }
      const depasse = retard(t) ? (() => { const o0 = Math.max(0, a1), o1 = Math.min(100, tx(r, jour)); return o1 > o0 ? <span className="hx-over" style={{ left: `${o0}%`, width: `${o1 - o0}%`, top: 7 }} /> : null; })() : null;
      piste = <>{fantome}{lien}<BarreProjet l={l} r={r} style={style} couleur={p.color} statuts={d.statuts} infos={infos(t)} info={infobulle(t, l, p.name, statut(t.statusId).name, infos(t))} />{depasse}</>;
    }
    return (
      <div key={t.id} className={`hx-prw ${tacheId === t.id ? "is-sel" : ""} ${fini(t) ? "is-done" : ""}`}>
        <span className="hx-gname"><Coche t={t} /><button type="button" onClick={() => ouvrir(t.id)}>{t.milestone ? "◆ " : ""}{t.title}</button></span>
        {voir.resp && <span className="hx-dim" title={t.assignee}>{initiales(t.assignee)}</span>}
        {voir.debut && <span className="hx-num">{dateCourte(t.milestone ? t.end : t.start)}</span>}
        {voir.fin && <span className={`hx-num ${retard(t) ? "hx-red" : ""}`}>{dateCourte(t.end)}</span>}
        {voir.ref && <span className="hx-num hx-dim">{c ? dateCourte(c.referenceEnd) : "—"}</span>}
        {voir.derive && <span className="hx-num">{cellEcart(c?.ecartFin ?? null)}</span>}
        <div className="hx-ptl" data-rs={r.debut} data-rn={r.jours}><Grille r={r} jour={jour} />{piste}</div>
      </div>
    );
  };

  const groupes: Groupe[] = (() => {
    if (groupe === "statut") return d.statuts.map((s) => ({ id: "s-" + s.id, libelle: s.name || s.id, couleur: statut(s.id).color, taches: ts.filter((t) => t.statusId === s.id) }));
    if (groupe === "responsable") { const noms = [...new Set(ts.map((t) => t.assignee || ""))].sort((a, b) => (a ? a.localeCompare(b, "fr") : 1)); return noms.map((m) => ({ id: "m-" + m, libelle: m || "Sans responsable", couleur: "#64748b", taches: ts.filter((t) => (t.assignee || "") === m) })); }
    if (groupe === "type") return d.types.map((ty) => ({ id: "t-" + ty.id, libelle: ty.name || ty.id, couleur: ty.color || "#64748b", taches: ts.filter((t) => t.taskTypeId === ty.id) }));
    if (groupe === "criticite") return [...CRITICITES.map((c) => ({ id: "c-" + c.id, libelle: c.nom, couleur: c.couleur, taches: ts.filter((t) => t.criticality === c.id) })), { id: "c-sans", libelle: "Sans criticité", couleur: "#94a3b8", taches: ts.filter((t) => !t.criticality) }];
    if (groupe === "jalon") return [{ id: "j-t", libelle: "Tâches", couleur: "#64748b", taches: ts.filter((t) => !t.milestone) }, { id: "j-m", libelle: "Jalons", couleur: "#18263d", taches: ts.filter((t) => t.milestone) }];
    if (groupe === "echeance") {
      const rang = (t: Tache) => (fini(t) ? 4 : retard(t) ? 0 : !iso(t.end) ? 5 : t.end <= ajouterJours(jour, 6) ? 1 : t.end <= ajouterJours(jour, 30) ? 2 : 3);
      return [["e0", "En retard", "#dc2626"], ["e1", "Sous 7 jours", "#d97706"], ["e2", "Sous 30 jours", "#2563eb"], ["e3", "Plus tard", "#64748b"], ["e4", "Terminées", "#16a34a"], ["e5", "Sans échéance", "#94a3b8"]].map(([id, l, c], i) => ({ id, libelle: l, couleur: c, taches: ts.filter((t) => rang(t) === i) }));
    }
    return [{ id: "", libelle: "", couleur: "", taches: ts }];
  })().filter((g) => g.taches.length);

  return (
    <main className="hx-main hx-projets" data-scroll>
      <nav className="hx-plist" aria-label="Projets">{d.dossiers.map((f) => { const ps = d.projets.filter((q) => (q.folderId || "folder-a-trier") === f.id); return ps.length ? <div key={f.id}><h3>{f.name}</h3>{ps.map((q) => { const s = santeProjet(d.taches, q.id, d, jour); return <button key={q.id} type="button" aria-current={q.id === p.id} onClick={() => { ouvrirProjet(q.id); setDecalage(0); }}><i style={{ background: q.color || "#94a3b8" }} /><span>{q.name}</span><small>{s.ouvertes}{s.retards > 0 && <> · <em>{s.retards}</em></>}</small></button>; })}</div> : null; })}</nav>
      <div className="hx-pmain">
        <div className="hx-hello hx-row"><div><p className="hx-crumb">{dossier?.name || "À trier"} › {p.name}</p><h1 style={{ ["--c" as string]: p.color }} className="hx-ptitle">{p.name}</h1></div>
          <div className="hx-kpis is-inline"><div><small>Avancement</small><b>{sante.avancement} %</b></div><div><small>Ouvertes</small><b>{sante.ouvertes}</b></div><div><small>En retard</small><b className={sante.retards ? "hx-red" : ""}>{sante.retards}</b></div><div><small>Fin prévue</small><b>{dateCourte(finAct || undefined)}</b></div></div>
          <button type="button" className="hx-btn is-primary" onClick={() => setSaisie(true)}>+ Tâche</button></div>
        <FriseProjet projetId={p.id} couleur={p.color} />
        <section className="hx-tile hx-cmp"><div className="hx-cmpl"><span>Comparer à</span><div className="hx-seg is-sm">{REFERENCES.map((x) => <button key={x} type="button" aria-pressed={reference === x} onClick={() => void ecrirePrefs({ projets: { ...prefs.projets, reference: x } })}>{LIB_REF[x]}</button>)}</div></div>
          {reference === "aucune" ? <p className="hx-dim">Choisissez une référence pour voir les glissements de dates.</p>
            : !ecarts.length ? <p className="hx-dim">Aucune tâche de ce projet n'a de référence figée. Elle se fige depuis la fiche d'une tâche dans Nexora.</p>
              : <div className="hx-cmpk">
                <div><small>Fin du projet</small><b>{dateCourte(finAct || undefined)}</b><span>{reference === "courante" ? "réf." : "initial"} {dateCourte(finRef || undefined)} · {finRef && finAct ? cellEcart(ecartJours(finRef, finAct)) : "—"}</span></div>
                <div><small>Tâches glissées</small><b className={glissees ? "hx-red" : ""}>{glissees}</b><span>sur {ecarts.length} comparées</span></div>
                <div><small>En avance</small><b className={avance ? "hx-green" : ""}>{avance}</b><span>{heure} à l'heure</span></div>
                <div><small>Dérive moyenne</small><b>{moyenne > 0 ? "+" : ""}{moyenne.toFixed(1).replace(".", ",")} j</b><span>sur la date de fin</span></div>
                <div className="hx-cmpbar">{ecarts.slice().sort((a, b) => b - a).map((x, i) => <i key={i} className={x > 0 ? "is-late" : x < 0 ? "is-early" : ""} style={{ height: `${Math.min(100, 12 + Math.abs(x) * 4)}%` }} title={libelleEcart(x)} />)}</div>
              </div>}
        </section>
        <div className="hx-pbarrow"><details className="ox-cols"><summary className="hx-btn is-sm">Colonnes ▾</summary>
          <div className="ox-cols-menu" role="group" aria-label="Colonnes affichées">
            <ListeCoches options={COLONNES_PROJET.map((k) => ({ id: k, libelle: COLONNES[k].libelle }))} choisis={colonnes} changer={(ids) => choisirColonnes(ids as ColonneProjet[])} libelleRecherche="Rechercher une colonne" />
          </div></details><BarreZoom r={r} zooms={ZOOMS_PROJET} setZoom={(z) => { void ecrirePrefs({ projets: { ...prefs.projets, zoom: z } }); setDecalage(0); }} decaler={(n) => setDecalage(n === null ? 0 : decalage + n)} />
          <div className="hx-opts"><span>Grouper par</span><div className="hx-seg is-sm">{GROUPES_PROJET.map((g) => <button key={g} type="button" aria-pressed={groupe === g} onClick={() => { void ecrirePrefs({ projets: { ...prefs.projets, groupe: g } }); setReplies(new Set()); }}>{LIB_GROUPE[g]}</button>)}</div></div><SelecteurStyle /></div>
        <BarreFiltres ecran="projets" n={ts.length} masquer={["projets"]} email={email} reglages={{ zoom, groupe, style, reference }} appliquerReglages={appliquer} />
        <div className="hx-tile hx-pgantt" style={{ ["--pcols" as string]: gabarit }}>
          <div className="hx-prw hx-prh"><span>Tâche</span>{voir.resp && <span title="Responsable">Resp.</span>}{voir.debut && <span>Début</span>}{voir.fin && <span>Fin</span>}{voir.ref && <span>{reference === "initiale" ? "Initiale" : "Réf."}</span>}{voir.derive && <span>Dérive</span>}<div className="hx-ptl">{clairsemer(graduations(r), 7).map((k) => <b key={k.iso} className={`hx-tick ${k.majeur ? "is-major" : ""}`} style={{ left: `${tx(r, k.iso)}%` }}>{k.libelle}</b>)}</div></div>
          {groupes.map((g) => {
            if (!g.id) return g.taches.map(ligne);
            const col = replies.has(g.id), nRet = g.taches.filter(retard).length, ouv = g.taches.filter((t) => !fini(t)).length;
            const dates = g.taches.flatMap((t) => [t.start, t.end].filter(iso));
            const g0 = dates.reduce((m, x) => (x < m ? x : m), "9999"), g1 = dates.reduce((m, x) => (x > m ? x : m), "0000");
            const a = dates.length ? Math.max(0, tx(r, g0)) : 0, b = dates.length ? Math.min(100, tx(r, ajouterJours(g1, 1))) : 0;
            return [
              <div key={g.id} className="hx-prw hx-pgrp">
                <button type="button" className="hx-gname" aria-expanded={!col} onClick={() => setReplies((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}><span className="hx-chev">{col ? "▸" : "▾"}</span><i style={{ background: g.couleur }} /><b>{g.libelle}</b><small>{g.taches.length} tâche{g.taches.length > 1 ? "s" : ""}{ouv !== g.taches.length && <> · {ouv} ouverte{ouv > 1 ? "s" : ""}</>}{nRet > 0 && <> · <em>{nRet} en retard</em></>}</small></button>
                {voir.resp && <span />}{voir.debut && <span className="hx-num hx-dim">{dates.length ? dateCourte(g0) : "—"}</span>}{voir.fin && <span className="hx-num hx-dim">{dates.length ? dateCourte(g1) : "—"}</span>}{voir.ref && <span />}{voir.derive && <span />}
                <div className="hx-ptl"><Grille r={r} jour={jour} />{b > a && <span className="hx-lsum" style={{ left: `${a}%`, width: `${b - a}%`, ["--c" as string]: g.couleur }} />}</div>
              </div>,
              ...(col ? [] : g.taches.map(ligne)),
            ];
          })}
          {!ts.length && <p className="hx-empty">Aucune tâche ne correspond aux filtres.</p>}
        </div>
        <AideStyle style={style} />
        <p className="hx-legend2"><span>barre : dates actuelles</span><span><i className="lg-ghost" />{reference === "initiale" ? "plan initial" : "référence"}</span><span><i className="lg-conn" />glissement</span><span><i className="lg-over" />retard</span></p>
      </div>
    </main>
  );
}
