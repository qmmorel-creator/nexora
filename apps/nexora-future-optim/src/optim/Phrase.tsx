// Phrase (Ref #708), reprise de Nexora Futur (#679) et réécrite dans le langage
// d'Optim : une question en phrase dont chaque mot souligné se change (clic,
// ↑ ↓), la réponse recalculée en direct, des vues enregistrées (rangées par
// espace, avec leur chiffre) et des tuiles épinglées. Vues et tuiles vivent
// dans nexora:optimPrefs (champ « phrase »), séparées des vues de Planning et Projets.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as KE } from "react";
import type { Source } from "../donnees/source";
import { fusionnerPrefs, normaliserPrefs } from "../donnees/prefs";
import { decalerMois, type SyntheseBudget } from "../donnees/finance";
import { activitesDe, type Activite } from "../donnees/sport";
import {
  DEFAUTS, MAX_TUILES, MODELES, QUOIS, calcul, choisir, cle, epingler, libelle, nomPropose, options, texte,
  type Contexte, type Detail, type Phrase as PhraseT, type PrefsPhrase, type Vue,
} from "../donnees/phrase";
import { naviguer, useRoute } from "../navigation/routeur";
import { useOptim, useUi } from "./contexte";

const ecrit = (x: EventTarget | null) => x instanceof HTMLElement && (x.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(x.tagName));
const moisUtiles = (ph: PhraseT, jour: string) => { const m0 = jour.slice(0, 7); return ph.quoi !== "depenses" ? [] : ph.per === "dernier" ? [decalerMois(m0, -1)] : ph.per === "trois" ? [decalerMois(m0, -2), decalerMois(m0, -1), m0] : [m0]; };

// Lectures relayées (budget par mois, journal sportif), une fois par session.
const budgets = new Map<string, Promise<SyntheseBudget>>();
let sportLu: Promise<Activite[]> | null = null;
function useLectures(source: Source, phrases: PhraseT[], jour: string) {
  const [budget, setBudget] = useState<Record<string, SyntheseBudget | "erreur">>({});
  const [sport, setSport] = useState<Activite[] | "erreur" | null>(null);
  const mois = [...new Set(phrases.flatMap((p) => moisUtiles(p, jour)).concat(phrases.some((p) => p.quoi === "depenses") ? [jour.slice(0, 7)] : []))].sort().join(",");
  const veutSport = phrases.some((p) => p.quoi === "sport");
  useEffect(() => {
    let vivant = true;
    mois.split(",").filter(Boolean).forEach((m) => {
      if (!source.finance) { setBudget((b) => ({ ...b, [m]: "erreur" })); return; }
      const p = budgets.get(m) || (source.finance.lire("budget-summary", { month: m }) as Promise<SyntheseBudget>);
      budgets.set(m, p);
      p.then((x) => vivant && setBudget((b) => ({ ...b, [m]: x }))).catch(() => { budgets.delete(m); if (vivant) setBudget((b) => ({ ...b, [m]: "erreur" })); });
    });
    return () => { vivant = false; };
  }, [source, mois]);
  useEffect(() => {
    if (!veutSport) return;
    let vivant = true;
    if (!source.corps) { setSport("erreur"); return; }
    sportLu = sportLu || source.corps.lire("sport-activities").then(activitesDe);
    sportLu.then((x) => vivant && setSport(x)).catch(() => { sportLu = null; if (vivant) setSport("erreur"); });
    return () => { vivant = false; };
  }, [source, veutSport]);
  return { budget: (m: string) => budget[m] ?? null, sport };
}

function DetailReponse({ x, ouvrir }: { x: Detail; ouvrir: (id: string) => void }) {
  if (x.type === "attente") return <p className="hx-dim">{x.message}</p>;
  if (x.type === "taches") return !x.lignes.length ? <p className="hx-dim">Aucune tâche ne correspond. Change un mot de la phrase.</p> : (
    <>{x.lignes.map((l) => (
      <button key={l.id} type="button" className="ox-ph-l" onClick={() => ouvrir(l.id)}>
        <i className={`ox-ph-pt is-${l.ton}`} style={{ background: l.ton === "neutre" ? l.couleur : undefined }} />
        <span className="ox-ph-lt">{l.titre} <small>· {l.projet}</small></span>
        <span className="hx-dim">{l.qui}</span><span className="ox-ph-m hx-dim">{l.fin ? `${l.fin.slice(8)}/${l.fin.slice(5, 7)}` : "—"}</span>
      </button>))}
      {x.enPlus > 0 && <p className="hx-dim ox-ph-m">+ {x.enPlus} autres</p>}</>
  );
  if (x.type === "categories") return !x.lignes.length ? <p className="hx-dim">Aucune dépense ni budget sur cette période.</p> : (
    <>
      <div className="ox-ph-barres" aria-hidden="true">{x.lignes.map((l) => <i key={l.nom} title={l.nom} style={{ flex: Math.max(0, l.reel), background: l.couleur }} />)}<i style={{ flex: Math.max(0, x.budget - x.total), background: "var(--line)" }} /></div>
      {x.lignes.map((l) => (
        <div key={l.nom} className="ox-ph-l"><i className="ox-ph-pt" style={{ background: l.couleur }} /><span className="ox-ph-lt">{l.nom}</span>
          <span className="ox-ph-m">{Math.round(l.reel).toLocaleString("fr-FR")} €</span>
          <span className={`ox-ph-m ox-ph-pc ${l.budget && l.reel > l.budget ? "hx-red" : ""}`}>{l.budget ? `${Math.round((l.reel / l.budget) * 100)} %` : "—"}</span></div>
      ))}
    </>
  );
  if (x.type === "colonnes") {
    const max = Math.max(0.5, ...x.colonnes.map((c) => c.segments.reduce((s, y) => s + y.valeur, 0)));
    return (
      <>
        <div className="ox-ph-cols" role="img" aria-label={`${x.colonnes.length} colonnes`}>
          {x.colonnes.map((c, i) => { const t = c.segments.reduce((s, y) => s + y.valeur, 0); return (
            <div key={i} title={`${c.libelle} : ${Math.round(t * 10) / 10} ${x.unite}`}><b style={{ height: `${(t / max) * 100}%` }}>{c.segments.map((y) => <i key={y.nom} style={{ flex: y.valeur, background: y.couleur }} />)}</b><span>{c.libelle}</span></div>); })}
        </div>
        <p className="ox-ph-leg">{x.legende.map((l) => <span key={l.nom}><i className="ox-ph-pt" style={{ background: l.couleur }} /> {l.nom}</span>)}{!x.legende.length && <span className="hx-dim">Aucune séance sur la période.</span>}</p>
      </>
    );
  }
  return (
    <>{x.lignes.map((l) => (
      <div key={l.nom} className="ox-ph-l is-grille"><span className="ox-ph-lt">{l.nom}</span>
        <span className="ox-ph-grille" style={{ gridTemplateColumns: `repeat(${l.cases.length}, minmax(0, 1fr))` }}>
          {l.cases.map((c, i) => <i key={i} title={c.titre} className={c.t === -1 ? "is-crit" : c.t === -2 ? "is-na" : ""} style={c.t > 0 ? { background: `color-mix(in srgb, ${l.couleur} ${Math.round(25 + c.t * 75)}%, transparent)` } : undefined} />)}
        </span><span className="ox-ph-m hx-dim">{l.droite}</span></div>
    ))}{!x.lignes.length && <p className="hx-dim">Rien à montrer.</p>}</>
  );
}

export function Phrase() {
  const { d, source, ecrireJson } = useOptim();
  const { notifier, ouvrir } = useUi();
  const route = useRoute();
  const vueId = route.params.get("vue");
  const prefs = d.prefs.phrase;
  const [phrase, setPhrase] = useState<PhraseT>(() => prefs.vues.find((v) => v.id === vueId)?.ph || prefs.tuiles[0] || DEFAUTS);
  const [courante, setCourante] = useState<string | null>(vueId && prefs.vues.some((v) => v.id === vueId) ? vueId : null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [saisie, setSaisie] = useState<{ mode: "nouvelle" | "renommer"; id?: string; nom: string } | null>(null);
  const racine = useRef<HTMLElement>(null);

  // Démarrage à froid : les préférences peuvent arriver après le premier rendu ; on
  // applique alors la vue de l'URL tant qu'aucune vue n'est ouverte.
  const vueAppliquee = useRef<string | null>(courante);
  useEffect(() => { const v = prefs.vues.find((x) => x.id === vueId); if (v && vueAppliquee.current !== v.id) { vueAppliquee.current = v.id; setPhrase(v.ph); setCourante(v.id); } if (!vueId) vueAppliquee.current = null; }, [vueId, prefs.vues]);

  const visibles = useMemo(() => [phrase, ...prefs.tuiles, ...prefs.vues.map((v) => v.ph)], [phrase, prefs]);
  const lu = useLectures(source, visibles, d.aujourdhui);
  const ctx: Contexte = { ...d, sport: lu.sport, budget: lu.budget };
  const r = calcul(phrase, ctx);
  const vc = prefs.vues.find((v) => v.id === courante);
  const modifiee = !!vc && cle(vc.ph) !== cle(phrase);
  const epinglee = prefs.tuiles.some((t) => cle(t) === cle(phrase));

  const ecrire = (f: (p: PrefsPhrase) => PrefsPhrase, message?: string) =>
    ecrireJson("prefs", (v) => fusionnerPrefs(v, { phrase: f(normaliserPrefs(v).phrase) }))
      .then(() => { if (message) notifier({ texte: message }); })
      .catch((e) => notifier({ texte: `Vue non enregistrée : ${(e as Error).message}` }));
  const enregistrer = (nom: string) => {
    const id = `v${Date.now().toString(36)}`; const n = nom.trim() || nomPropose(phrase, ctx);
    setSaisie(null); setCourante(id);
    void ecrire((p) => ({ ...p, vues: [...p.vues, { id, nom: n, ph: phrase }] }), `Vue « ${n} » enregistrée.`);
    naviguer("/phrase", new URLSearchParams({ vue: id }), true);
  };
  const renommer = (id: string, nom: string) => { setSaisie(null); if (nom.trim()) void ecrire((p) => ({ ...p, vues: p.vues.map((v) => (v.id === id ? { ...v, nom: nom.trim().slice(0, 120) } : v)) }), "Vue renommée."); };
  const mettreAJour = () => vc && void ecrire((p) => ({ ...p, vues: p.vues.map((v) => (v.id === vc.id ? { ...v, ph: phrase } : v)) }), `Vue « ${vc.nom} » mise à jour.`);
  const supprimer = (v: Vue) => { if (courante === v.id) { setCourante(null); naviguer("/phrase", undefined, true); } void ecrire((p) => ({ ...p, vues: p.vues.filter((x) => x.id !== v.id) }), `Vue « ${v.nom} » supprimée.`); };
  const epinglerCourante = () => { if (!epinglee) void ecrire((p) => epingler(p, phrase), prefs.tuiles.length >= MAX_TUILES ? "Tuile épinglée (la plus ancienne est retirée)." : "Tuile épinglée."); };
  const ouvrirVue = (v: Vue) => { setPhrase(v.ph); setCourante(v.id); setOuvert(null); naviguer("/phrase", new URLSearchParams({ vue: v.id }), true); };

  // S : enregistrer comme vue ; E : épingler. En capture, avant le clavier global d'Optim (N, C).
  const etat = useRef({ saisie, epinglerCourante, ouvrirSaisie: () => setSaisie({ mode: "nouvelle", nom: nomPropose(phrase, ctx) }) });
  etat.current = { saisie, epinglerCourante, ouvrirSaisie: () => setSaisie({ mode: "nouvelle", nom: nomPropose(phrase, ctx) }) };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || ecrit(e.target) || etat.current.saisie || document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); e.stopImmediatePropagation(); setOuvert(null); etat.current.ouvrirSaisie(); }
      else if (k === "e") { e.preventDefault(); e.stopImmediatePropagation(); etat.current.epinglerCourante(); }
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, []);

  const changer = (k: string, v: string) => setPhrase((p) => choisir(p, k, v));
  const clavierMot = (k: string) => (e: KE<HTMLButtonElement>) => {
    const opts = options(k, ctx); const i = Math.max(0, opts.findIndex((o) => o[0] === (phrase[k] ?? DEFAUTS[k])));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); const n = opts.length; changer(k, opts[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n][0]); }
    else if (e.key === "Escape" && ouvert) { e.preventDefault(); e.stopPropagation(); setOuvert(null); }
  };
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".ox-ph-mot")) setOuvert(null); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  const groupes = [...new Set(QUOIS.map((q) => MODELES[q].espace))].map((esp) => ({ esp, couleur: MODELES[QUOIS.find((q) => MODELES[q].espace === esp)!].couleur, vues: prefs.vues.filter((v) => MODELES[v.ph.quoi].espace === esp) })).filter((g) => g.vues.length);
  const formulaire = saisie && (
    <form className="ox-ph-saisie" onSubmit={(e) => { e.preventDefault(); if (saisie.mode === "nouvelle") enregistrer(saisie.nom); else renommer(saisie.id!, saisie.nom); }}>
      <label htmlFor="ox-ph-nom">{saisie.mode === "nouvelle" ? "Nom de la vue" : "Nouveau nom"}</label>
      <input id="ox-ph-nom" value={saisie.nom} autoComplete="off" autoFocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setSaisie(null); racine.current?.focus(); } }} />
      <span><button type="submit" className="hx-btn is-primary is-sm">Enregistrer</button><button type="button" className="hx-btn is-ghost is-sm" onClick={() => setSaisie(null)}>Annuler</button></span>
    </form>
  );

  return (
    <main className="hx-main ox-ph" data-scroll ref={racine} tabIndex={-1}>
      <div className="hx-hello"><h1>Phrase <span>une question dont chaque mot souligné se change</span></h1></div>
      <div className="ox-ph-grid">
        <aside className="hx-tile ox-ph-vues" aria-label="Vues enregistrées">
          <header className="hx-th"><h2>Vues enregistrées <small>{prefs.vues.length}</small></h2></header>
          {formulaire}
          <div className="ox-ph-vliste">
            {groupes.map((g) => (
              <div key={g.esp} role="group" aria-label={g.esp}>
                <p className="ox-ph-vg"><i className="ox-ph-pt" style={{ background: g.couleur }} />{g.esp}</p>
                {g.vues.map((v) => { const x = calcul(v.ph, ctx); return (
                  <div key={v.id} className={`ox-ph-v ${v.id === courante ? "is-sel" : ""}`}>
                    <button type="button" className="ox-ph-vo" onClick={() => ouvrirVue(v)} aria-current={v.id === courante ? "true" : undefined} onDoubleClick={() => setSaisie({ mode: "renommer", id: v.id, nom: v.nom })}>
                      <span>{v.nom}</span><b style={{ color: x.couleur }}>{x.chiffre}</b></button>
                    <button type="button" className="ox-ph-x" aria-label={`Renommer la vue ${v.nom}`} title="Renommer" onClick={() => setSaisie({ mode: "renommer", id: v.id, nom: v.nom })}>✎</button>
                    <button type="button" className="ox-ph-x" aria-label={`Supprimer la vue ${v.nom}`} title="Supprimer" onClick={() => supprimer(v)}>×</button>
                  </div>); })}
              </div>
            ))}
            {!prefs.vues.length && <p className="hx-dim">Aucune vue. Compose une phrase puis « Enregistrer comme vue » (touche S).</p>}
          </div>
          <div className="ox-ph-pied">
            {modifiee && <button type="button" className="hx-btn is-primary" onClick={mettreAJour}>Mettre à jour « {vc!.nom} »</button>}
            <button type="button" className="hx-btn" onClick={() => { setOuvert(null); setSaisie({ mode: "nouvelle", nom: nomPropose(phrase, ctx) }); }}><kbd>S</kbd> Enregistrer comme vue</button>
          </div>
        </aside>
        <div className="ox-ph-droite">
          <div className="ox-ph-mur" role="group" aria-label="Tuiles épinglées">
            {prefs.tuiles.map((t) => { const x = calcul(t, ctx); const tx = texte(t, ctx).replace(/^Montre /, ""); return (
              <div key={cle(t)} className={`ox-ph-tuile ${cle(t) === cle(phrase) ? "is-sel" : ""}`}>
                <button type="button" className="ox-ph-to" onClick={() => { setPhrase(t); setCourante(null); naviguer("/phrase", undefined, true); }} aria-label={`Tuile : ${tx}`}>
                  <i style={{ background: x.couleur }} /><b style={{ color: x.couleur }}>{x.chiffre}</b><span>{tx}</span></button>
                <button type="button" className="ox-ph-x ox-ph-tx" aria-label={`Désépingler ${tx}`} onClick={() => void ecrire((p) => ({ ...p, tuiles: p.tuiles.filter((y) => cle(y) !== cle(t)) }))}>×</button>
              </div>); })}
            <button type="button" className="ox-ph-tuile is-ajout" onClick={epinglerCourante} disabled={epinglee}>{epinglee ? "Épinglée" : <span><kbd>E</kbd> Épingler</span>}</button>
          </div>
          <section className="hx-tile ox-ph-scene">
            <div className="ox-ph-titre">{vc ? <>{vc.nom}{modifiee && <em className="ox-ph-modif">modifiée</em>}</> : <span className="hx-dim">Phrase libre</span>}</div>
            <h2 className="ox-ph-phrase" aria-label={texte(phrase, ctx)}>
              {MODELES[phrase.quoi].mots.map((m, i) => {
                if (typeof m === "string") return <span key={i}>{m} </span>;
                const k = m.k; const o = ouvert === k; const opts = options(k, ctx); const val = phrase[k] ?? DEFAUTS[k];
                return (
                  <span key={i} className="ox-ph-mot">
                    <button type="button" className={`ox-ph-puce ${o ? "is-open" : ""}`} style={{ ["--c" as string]: k === "quoi" ? r.couleur : "var(--ink-2)" }} aria-haspopup="listbox" aria-expanded={o}
                      aria-label={`${libelle(k, val, ctx)}, changer (↑ ↓)`} onClick={() => setOuvert(o ? null : k)} onKeyDown={clavierMot(k)}>{libelle(k, val, ctx)}</button>
                    {o && (
                      <span className="ox-ph-menu" role="listbox" aria-label="Choix">
                        {opts.map(([v, l]) => <button key={v} type="button" role="option" aria-selected={v === val} className={v === val ? "is-sel" : ""} onClick={() => { changer(k, v); setOuvert(null); }}>{l}</button>)}
                      </span>
                    )}{" "}
                  </span>
                );
              })}
            </h2>
            <div className="ox-ph-rep">
              <div className="ox-ph-chiffre" style={{ ["--c" as string]: r.couleur }}>
                <b className={r.chiffre.length > 5 ? "is-long" : ""} aria-live="polite">{r.chiffre}</b><span>{r.phrase}</span>
              </div>
              <div className="ox-ph-detail" key={cle(phrase)}><DetailReponse x={r.detail} ouvrir={ouvrir} /></div>
            </div>
            <p className="ox-ph-aide hx-dim">Clic sur un mot souligné, ou <kbd>Tab</kbd> puis <kbd>↑</kbd> <kbd>↓</kbd> pour le changer · <kbd>S</kbd> enregistrer la vue · <kbd>E</kbd> épingler</p>
          </section>
        </div>
      </div>
    </main>
  );
}
