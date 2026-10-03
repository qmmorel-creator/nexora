// Argent (Ref #690) : Mois, Patrimoine, Pro, Opérations. Les graphiques
// Sankey et « Budget cumulé par mois » sont ceux de Nexora, repris tels quels
// (src/nexora/finance-nexora.jsx, généré) : même esthétique, même comportement.
// Seule écriture : la catégorisation d'une opération, comme dans Nexora.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { decalerMois, euros, messageFinance, trierSuivi, type ACategoriser, type SerieDePatrimoine, type SyntheseBudget } from "../donnees/finance";
import { caEncaisseAnnee, euros2, statutDevis, statutFacture, STATUTS_DEVIS, STATUTS_FACTURE, totalDevis } from "../donnees/finance-pro";
import { ErreurFinance, type RessourceFinance } from "../donnees/source";
import { DUREES_PATRIMOINE, ONGLETS_ARGENT, type OngletArgent } from "../donnees/prefs";
import { bornes, CHOIX_PERIODE, decaler, joursDe, LIB_PERIODE, moisCouverts, synthesePeriode, type ChoixPeriode, type Periode } from "../donnees/periode";
import { nouvelId } from "../donnees/modele";
import { FINANCE_BUDGET_CHART_CSS, FINANCE_BUDGET_CUMUL_CSS, FINANCE_SANKEY_DEFAULT_CONFIG, FinanceCumulCategories, FinanceSankeyChart, financeCumulModel, financeSankeyBuild, financeSankeyNormalize } from "../nexora/finance-nexora";
import { dateCourte, MOIS_C, useOptim, useUi } from "./contexte";
import { ChoixRecherche, ListeCoches } from "./ListeCoches";

const LIB_ONGLET: Record<OngletArgent, string> = { mois: "Période", patrimoine: "Patrimoine", pro: "Pro", operations: "Opérations" };

// Lecture d'une ressource du relais finance, mise en cache pour la session.
const cache = new Map<string, Promise<unknown>>();
function useRessource<T>(ressource: RessourceFinance, params: Record<string, string> = {}, cle = 0) {
  const { source } = useOptim();
  const k = `${ressource}?${new URLSearchParams(params)}#${cle}`;
  const [etat, setEtat] = useState<{ k: string; data: T | null; erreur: string }>({ k: "", data: null, erreur: "" });
  useEffect(() => {
    let vivant = true;
    if (!source.finance) { setEtat({ k, data: null, erreur: "Budget non relayé." }); return; }
    let p = cache.get(k);
    if (!p) { p = source.finance.lire(ressource, params); cache.set(k, p); p.catch(() => cache.delete(k)); }
    p.then((data) => { if (vivant) setEtat({ k, data: data as T, erreur: "" }); }).catch((e: unknown) => { if (vivant) setEtat({ k, data: null, erreur: e instanceof ErreurFinance ? messageFinance(e.code) : (e as Error).message }); });
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, k]);
  return { data: etat.k === k ? etat.data : null, erreur: etat.k === k ? etat.erreur : "", charge: etat.k === k };
}
// Construction du Sankey protégée (audit K2) : une donnée inattendue donne un message,
// jamais une page blanche ; sans flux, l'état vide de Nexora.
type Sankey = ReturnType<typeof financeSankeyBuild>;
function sankeySur(type: Parameters<typeof financeSankeyBuild>[0], donnees: unknown, config: Record<string, unknown>, jour: string): Sankey | { erreur: string } | null {
  if (!donnees) return null;
  try { const r = financeSankeyBuild(type, donnees, config, jour); return r.graph.links.length ? r : { erreur: "Aucun flux à représenter sur cette période." }; }
  catch (e) { return { erreur: `Sankey impossible : ${(e as Error).message}` }; }
}
const VueSankey = ({ c, config, titre, grand, erreur }: { c: Sankey | { erreur: string } | null; config: Record<string, unknown>; titre: string; grand?: boolean; erreur: string }) =>
  c && "graph" in c ? <div className={`ox-nexora ox-sankey ${grand ? "is-grand" : ""}`}><FinanceSankeyChart graph={c.graph} config={config} title={titre} period={c.period} /></div>
    : c ? <p className="hx-dim">{c.erreur}</p> : <Etat erreur={erreur} />;
const Etat = ({ erreur, texte = "Chargement…" }: { erreur?: string; texte?: string }) => <p className={erreur ? "ox-alerte" : "hx-dim"}>{erreur || texte}</p>;

// --- Catégorisation (seule écriture côté budget) -------------------------------
function Classer({ x, categories, apres }: { x: { id: string; label: string; amount: number; category?: string; subcategory?: string | null }; categories: { name: string; subcategories: string[] }[]; apres: () => void }) {
  const { source } = useOptim();
  const { notifier } = useUi();
  const [cat, setCat] = useState(x.category && categories.some((c) => c.name === x.category) ? x.category : "");
  const sous = categories.find((c) => c.name === cat)?.subcategories || [];
  const [sc, setSc] = useState(x.subcategory && sous.includes(x.subcategory) ? x.subcategory : "");
  const [enCours, setEnCours] = useState(false);
  const pret = !!cat && (!sous.length || !!sc);
  const valider = async () => {
    if (!source.finance || !pret) return;
    setEnCours(true);
    try { await source.finance.categoriser({ transactionId: x.id, category: cat, subcategory: sc || null, idempotencyKey: nouvelId() + nouvelId() }); notifier({ texte: `« ${x.label} » classée dans ${cat}${sc ? " › " + sc : ""}` }); cache.clear(); apres(); }
    catch (e) { notifier({ texte: `Classement refusé : ${e instanceof ErreurFinance ? messageFinance(e.code) : (e as Error).message}` }); }
    finally { setEnCours(false); }
  };
  return <span className="ox-classer">
    <ChoixRecherche libelle="Catégorie" vide="Catégorie…" valeur={cat} changer={(v) => { setCat(v); setSc(""); }} options={categories.map((c) => ({ id: c.name, libelle: c.name }))} />
    {sous.length > 0 && <ChoixRecherche libelle="Sous-catégorie" vide="Sous-catégorie…" valeur={sc} changer={setSc} options={sous.map((x) => ({ id: x, libelle: x }))} />}
    <button type="button" className="hx-btn is-sm" disabled={!pret || enCours} onClick={() => void valider()}>{enCours ? "…" : "Classer"}</button>
  </span>;
}

// --- Période (#690, retour du 03/10/2026) ------------------------------------------
// Boutons rapides ou dates libres ; tout l'onglet suit la période choisie.
// Suivi et cumul : calculs de Nexora (finance-budget.mjs) sur les opérations.
function OngletPeriode({ rafraichir, cle }: { rafraichir: () => void; cle: number }) {
  const { jour, prefs, ecrirePrefs } = useOptim();
  const choix = prefs.argent.periode;
  const [perso, setPerso] = useState<Periode>(() => bornes("mois", jour));
  const [ecart, setEcart] = useState(0);
  const base = bornes(choix, jour, perso);
  const p = useMemo(() => { let x = base; for (let k = 0; k < Math.abs(ecart); k++) x = decaler(x, ecart < 0 ? -1 : 1); return x; }, [base.from, base.to, ecart]); // eslint-disable-line react-hooks/exhaustive-deps
  const choisir = (c: ChoixPeriode) => { setEcart(0); void ecrirePrefs({ argent: { ...prefs.argent, periode: c } }); };
  const resume = useRessource<SyntheseBudget>("budget-summary", { month: jour.slice(0, 7) }, cle);
  const sankey = useRessource<Record<string, unknown>>("sankey-data", {}, cle);
  const ops = useRessource<Record<string, unknown>>("transactions-data", {}, cle);
  const synth = useMemo(() => {
    if (!sankey.data || !ops.data) return null;
    try { return synthesePeriode({ ...sankey.data, subcategories: [], transactions: ops.data.transactions }, p); } catch (e) { return { erreur: (e as Error).message }; }
  }, [sankey.data, ops.data, p]);
  const donneesSankey = useMemo(() => { try { return sankey.data ? financeSankeyNormalize(sankey.data) : null; } catch { return null; } }, [sankey.data]);
  const config = useMemo(() => ({ ...FINANCE_SANKEY_DEFAULT_CONFIG, from: p.from, to: p.to }), [p]);
  const construit = useMemo(() => (donneesSankey ? sankeySur("financeSankeyMonthly", donneesSankey, config, jour) : null), [donneesSankey, config, jour]);
  const s = synth && !("erreur" in synth) ? synth : null;
  const modele = useMemo(() => financeCumulModel(s?.charts), [s]);
  const n = joursDe(p), ecoules = jour < p.from ? 0 : jour > p.to ? n : joursDe({ from: p.from, to: jour }), enCours = jour >= p.from && jour <= p.to;
  const aClasser = (resume.data?.toCategorize || []).filter((x) => x.date >= p.from && x.date <= p.to);
  const categories = resume.data?.catalogs.categories.map((c) => ({ name: c.name, subcategories: c.subcategories })) || [];
  const libelle = `${dateCourte(p.from)} → ${dateCourte(p.to)}${p.from.slice(0, 4) !== p.to.slice(0, 4) || p.from.slice(0, 4) !== jour.slice(0, 4) ? " " + p.to.slice(0, 4) : ""}`;
  const erreur = sankey.erreur || ops.erreur || (synth && "erreur" in synth ? `Calcul impossible : ${synth.erreur}` : "");
  return <>
    <div className="ox-periode">
      <div className="hx-seg" role="group" aria-label="Période">{CHOIX_PERIODE.map((c) => <button key={c} type="button" aria-pressed={choix === c} onClick={() => choisir(c)}>{LIB_PERIODE[c]}</button>)}</div>
      {choix === "perso" && <span className="ox-pdates"><label>Du <input type="date" value={perso.from} max={perso.to} onChange={(e) => { if (e.target.value) { setEcart(0); setPerso({ ...perso, from: e.target.value }); } }} /></label><label>au <input type="date" value={perso.to} min={perso.from} onChange={(e) => { if (e.target.value) { setEcart(0); setPerso({ ...perso, to: e.target.value }); } }} /></label></span>}
      <div className="hx-nav2"><button type="button" aria-label="Période précédente" onClick={() => setEcart(ecart - 1)}>‹</button><b>{libelle}</b><button type="button" aria-label="Période suivante" disabled={p.to >= jour} onClick={() => setEcart(ecart + 1)}>›</button></div>
      <button type="button" className="hx-more" onClick={rafraichir} title="Relire les données">Actualiser</button>
    </div>
    {s ? <div className="hx-mk ox-mk"><div><small>Revenus</small><b>{euros(s.totals.income)}</b></div><div><small>Dépenses</small><b>{euros(s.totals.expenses)}</b></div><div><small>Solde</small><b className={s.totals.net >= 0 ? "hx-green" : "hx-red"}>{euros(s.totals.net)}</b></div>
      <div><small>Reste à dépenser</small><b>{euros(s.totals.remaining)}</b>{enCours && s.totals.remaining > 0 && <span className="hx-dim">{euros(s.totals.remaining / Math.max(1, n - ecoules + 1))} / jour</span>}</div>
      <div className="is-wide"><small>Rythme du budget · {euros(s.totals.expenses)} sur {euros(s.totals.budget)}{n < 28 || moisPartiel(p) ? " (budget au prorata des jours)" : ""}</small><span className="hx-pace"><i style={{ width: `${Math.min(100, Math.round(s.totals.expenses / Math.max(1, s.totals.budget) * 100))}%` }} /><b style={{ left: `${Math.round(ecoules / n * 100)}%` }} /></span>
        {(() => { const e = s.totals.expenses - s.totals.budget * ecoules / n; return <span className={e > 0 ? "hx-red" : "hx-green"}>{e > 0 ? `${euros(e)} au-dessus du rythme` : "dans le rythme"}</span>; })()}</div></div>
      : <Etat erreur={erreur} />}
    <section className="hx-tile"><header className="hx-th"><h2>Flux de la période</h2><small className="hx-dim">graphique Sankey de Nexora, à l'identique</small></header>
      <VueSankey c={construit} config={config} titre="Sankey (flux)" erreur={sankey.erreur} /></section>
    {s && <div className="hx-acols ox-pcols">
      <section className="hx-tile"><header className="hx-th"><h2>Budget cumulé</h2><small className="hx-dim">par catégorie, face au budget et aux revenus · graphique de Nexora</small></header>
        {!modele.series.length ? <p className="hx-dim">Aucune dépense sur la période.</p>
          : <div className="ox-cumul"><div className="nx-bch ox-nexora"><style>{FINANCE_BUDGET_CHART_CSS + FINANCE_BUDGET_CUMUL_CSS}</style><FinanceCumulCategories model={modele} /></div></div>}</section>
      <section className="hx-tile"><header className="hx-th"><h2>Budget par catégorie</h2><small className="hx-dim">{enCours ? `trait : où vous devriez en être (${ecoules}/${n} j)` : "période close"}</small></header>
        {trierSuivi(s.tracking).map((c) => { const pct = c.budget ? Math.round(c.actual / c.budget * 100) : 0; return <div key={c.category} className={`hx-bcat ${c.over ? "is-over" : ""}`}><span><i style={{ background: c.color || "#94a3b8" }} />{c.category}</span><span className="hx-bmeter"><i style={{ width: `${Math.min(100, pct)}%`, background: c.over ? "#dc2626" : c.color || "#94a3b8" }} />{enCours && <b style={{ left: `${Math.round(ecoules / n * 100)}%` }} />}</span><span className="hx-num">{euros(c.actual)} <small>/ {c.budget ? euros(c.budget) : "—"}</small></span><span className={`hx-num ${c.over ? "hx-red" : "hx-dim"}`}>{c.budget ? `${pct} %` : ""}</span></div>; })}
        {!s.tracking.length && <p className="hx-dim">Aucun budget ni dépense sur la période.</p>}</section>
    </div>}
    <section className="hx-tile"><header className="hx-th"><h2>À classer <span className="hx-badge">{aClasser.length}</span></h2><small className="hx-dim">opérations de la période</small></header>
      {!resume.data ? <Etat erreur={resume.erreur} /> : <>
        {aClasser.map((x: ACategoriser) => <div key={x.id} className="hx-txr ox-txr"><span>{x.label} <small className="hx-dim">{dateCourte(x.date)} · {x.account}</small></span><span className="hx-num">{euros(x.amount)}</span><Classer x={x} categories={categories} apres={rafraichir} /></div>)}
        {!aClasser.length && <p className="hx-dim">Tout est classé sur la période.</p>}</>}</section>
  </>;
}
const moisPartiel = (p: Periode) => moisCouverts(p).some((m) => m.part < 1);

// --- Patrimoine ------------------------------------------------------------------
function OngletPatrimoine({ cle }: { cle: number }) {
  const { jour, prefs, ecrirePrefs } = useOptim();
  const N = prefs.argent.patrimoineMois;
  const from = `${decalerMois(jour.slice(0, 7), -N)}-01`;
  const serie = useRessource<SerieDePatrimoine>("wealth-series", { step: "month", from, to: jour }, cle);
  const resume = useRessource<SyntheseBudget>("budget-summary", { month: jour.slice(0, 7) }, cle);
  const sankey = useRessource<unknown>("sankey-data", {}, cle);
  const donneesSankey = useMemo(() => { try { return sankey.data ? financeSankeyNormalize(sankey.data) : null; } catch { return null; } }, [sankey.data]);
  const config = useMemo(() => ({ ...FINANCE_SANKEY_DEFAULT_CONFIG, periodMode: "month", periodValue: jour.slice(0, 7) }), [jour]);
  const construit = useMemo(() => (donneesSankey ? sankeySur("financeSankeyWealth", donneesSankey, config, jour) : null), [donneesSankey, config, jour]);
  const sr = serie.data;
  // Empilement par type de compte.
  const types = useMemo(() => {
    if (!sr) return [] as { type: string; couleur: string; idx: number[] }[];
    const m = new Map<string, { type: string; couleur: string; idx: number[] }>();
    sr.accounts.forEach((a, i) => { const t = a.type || "Autre"; if (!m.has(t)) m.set(t, { type: t, couleur: a.typeColor || a.color || "#94a3b8", idx: [] }); m.get(t)!.idx.push(i); });
    return [...m.values()];
  }, [sr]);
  const points = sr?.points || [];
  const totaux = points.map((p) => p.total);
  const der = totaux.length ? totaux[totaux.length - 1] : 0;
  const ecart = (k: number) => (totaux.length > k ? der - totaux[totaux.length - 1 - k] : null);
  const fmtEcart = (v: number | null, base: number | undefined) => (v === null ? <b>—</b> : <><b className={v >= 0 ? "hx-green" : "hx-red"}>{v >= 0 ? "+" : "−"}{euros(Math.abs(v))}</b>{base ? <span className="hx-dim">{(v / Math.abs(base) * 100).toFixed(1).replace(".", ",")} %</span> : null}</>);
  const parType = types.map((t) => ({ ...t, v: points.length ? t.idx.reduce((s, i) => s + (points[points.length - 1].balances[i] || 0), 0) : 0 })).sort((a, b) => b.v - a.v);
  const graphique: ReactNode = (() => {
    if (!points.length) return <Etat erreur={serie.erreur} />;
    const W = 1300, H = 430, L = 56, R = 16, T = 10, B = 24, n = points.length;
    const empile = points.map((p) => { let pos = 0, neg = 0; return types.map((t) => { const v = t.idx.reduce((s, i) => s + (p.balances[i] || 0), 0); if (v >= 0) { const r = [pos, pos + v]; pos += v; return r; } const r = [neg + v, neg]; neg += v; return r; }); });
    const hautMax = Math.max(1, ...empile.flatMap((l) => l.map((r) => r[1]))), basMin = Math.min(0, ...empile.flatMap((l) => l.map((r) => r[0])));
    const pas = Math.pow(10, Math.floor(Math.log10(hautMax - basMin || 1))) * (((hautMax - basMin) / Math.pow(10, Math.floor(Math.log10(hautMax - basMin || 1)))) > 5 ? 2 : 1);
    const ymax = Math.ceil(hautMax / pas) * pas, ymin = Math.floor(basMin / pas) * pas;
    const X = (i: number) => L + (n > 1 ? i / (n - 1) : .5) * (W - L - R), Y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - T - B);
    const lab = (d: string, plein?: boolean) => { const m = Number(d.slice(5, 7)) - 1; return `${MOIS_C[m]}${plein || m === 0 ? " " + d.slice(0, 4) : ""}`; };
    const tous = Math.max(1, Math.round(n / 8)), slot = (W - L - R) / Math.max(1, n - 1);
    const graduations: number[] = []; for (let v = ymin; v <= ymax + 1e-6; v += pas) graduations.push(v);
    return <svg className="hx-mc hx-wchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Évolution du patrimoine sur ${N} mois`}>
      {graduations.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "#c9ccd1" : "#eef1f5"} /><text x={L - 8} y={Y(v) + 4} textAnchor="end" className="hx-mct">{Math.round(v / 1000)} k€</text></g>)}
      {types.map((t, ti) => <path key={t.type} d={`M${empile.map((l, i) => `${X(i).toFixed(1)} ${Y(l[ti][1]).toFixed(1)}`).join(" L")} L${empile.map((l, i) => [X(i), Y(l[ti][0])] as const).reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`} fill={t.couleur} opacity=".78" />)}
      <path d={`M${totaux.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" L")}`} fill="none" stroke="#18263d" strokeWidth="1.6" />
      {points.map((p, i) => ((n - 1 - i) % tous === 0 ? <text key={"l" + i} x={X(i)} y={H - 6} textAnchor={i === n - 1 ? "end" : "middle"} className="hx-mct">{lab(p.date)}</text> : null))}
      {points.map((p, i) => { const dv = i ? p.total - points[i - 1].total : null; return <g key={"h" + i} className="hx-whit"><line x1={X(i)} x2={X(i)} y1={T} y2={H - B} stroke="#18263d" strokeWidth="1" strokeDasharray="3 3" /><circle cx={X(i)} cy={Y(p.total)} r="4" fill="#fff" stroke="#18263d" strokeWidth="2" />
        <rect x={X(i) - slot / 2} y={T} width={slot} height={H - T - B} fill="transparent" data-tip={[`${lab(p.date, true)} · ${euros(p.total)}`, ...types.slice().reverse().map((t) => { const v = t.idx.reduce((s, k) => s + (p.balances[k] || 0), 0); return `${t.type} : ${euros(v)}${p.total ? ` (${Math.round(v / p.total * 100)} %)` : ""}`; }), ...(dv !== null ? [`Sur un mois : ${dv >= 0 ? "+" : "−"}${euros(Math.abs(dv))}`] : [])].join("|")} /></g>; })}
    </svg>;
  })();
  const comptes = resume.data?.wealth.accounts || [];
  return <>
    <div className="hx-wtop"><div className="hx-wcards">
      <div><small>Patrimoine</small><b>{points.length ? euros(der) : "—"}</b><span className="hx-dim">au {dateCourte(jour)}</span></div>
      <div><small>Sur 1 mois</small>{fmtEcart(ecart(1), totaux[totaux.length - 2])}</div>
      <div><small>Sur 12 mois</small>{fmtEcart(ecart(12), totaux[totaux.length - 13])}</div>
      {N !== 12 && <div><small>Sur {N} mois</small>{fmtEcart(totaux.length ? der - totaux[0] : null, totaux[0])}</div>}
      {parType.slice(0, 3).map((t) => <div key={t.type}><small>{t.type}</small><b>{euros(t.v)}</b>{der ? <span className="hx-dim">{Math.round(t.v / der * 100)} % du total</span> : null}</div>)}
    </div>
      <section className="hx-tile hx-wevo"><header className="hx-th"><h2>Évolution sur {N} mois <small>par type de compte</small></h2><span className="hx-sleg">{types.map((t) => <span key={t.type}><i style={{ background: t.couleur }} />{t.type}</span>)}</span>
        <div className="hx-seg is-xs" title="Durée, aussi réglable dans les réglages">{DUREES_PATRIMOINE.map((d) => <button key={d} type="button" aria-pressed={N === d} onClick={() => void ecrirePrefs({ argent: { ...prefs.argent, patrimoineMois: d } })}>{d} mois</button>)}</div></header>{graphique}</section></div>
    <section className="hx-tile ox-pat-sankey"><header className="hx-th"><h2>Structure du patrimoine</h2><small className="hx-dim">type › banque › compte · Sankey de Nexora</small></header>
        <VueSankey c={construit} config={config} titre="Structure du patrimoine (Sankey)" grand erreur={sankey.erreur} /></section>
    <div className="hx-acols">
      <section className="hx-tile"><header className="hx-th"><h2>Comptes</h2></header>
        {!comptes.length ? <Etat erreur={resume.erreur} texte={resume.charge ? "Aucun compte." : "Chargement…"} /> : (() => {
          const tot = comptes.reduce((s, a) => s + a.balance, 0), groupes = [...new Set(comptes.map((a) => a.type || "Autre"))];
          return <table className="hx-atab"><thead><tr><th>Compte</th><th>Banque</th><th>Solde</th><th>Part</th></tr></thead><tbody>{groupes.map((g) => { const l = comptes.filter((a) => (a.type || "Autre") === g), st = l.reduce((s, a) => s + a.balance, 0), c = l[0].typeColor || l[0].color || "#94a3b8"; return [
            <tr key={g} className="is-grp"><th colSpan={2}><i style={{ background: c }} />{g}</th><td className="hx-num">{euros(st)}</td><td className="hx-num hx-dim">{tot ? Math.round(st / tot * 100) : 0} %</td></tr>,
            ...l.map((a) => <tr key={a.id}><td>{a.name}</td><td className="hx-dim">{a.bank}</td><td className={`hx-num ${a.balance < 0 ? "hx-red" : ""}`}>{euros(a.balance)}</td><td><span className="hx-bar"><i style={{ width: `${tot ? Math.max(0, a.balance / tot * 100) : 0}%`, background: c }} /></span></td></tr>)]; })}</tbody></table>;
        })()}</section>
    </div>
  </>;
}

// --- Pro ---------------------------------------------------------------------------
const TONS: Record<string, string> = { draft: "#64748b", sent: "#2563eb", accepted: "#16a34a", refused: "#dc2626", expired: "#9a5b05", issued: "#2563eb", paid: "#16a34a", cancelled: "#64748b", late: "#dc2626" };
const Badge = ({ id, lib }: { id: string; lib: string }) => <span className="hx-badge2" style={{ ["--b" as string]: TONS[id] || "#64748b" }}>{lib}</span>;
function OngletPro() {
  const { d, jour } = useOptim();
  const p = d.pro, annee = Number(jour.slice(0, 4));
  const client = (id?: string) => p.clients.find((c) => c.id === id)?.name || p.clients.find((c) => c.id === id)?.company || "—";
  const enc = caEncaisseAnnee(p.paiements, annee);
  const montantFacture = (f: (typeof p.factures)[number]) => totalDevis(f);
  const ouvertes = p.factures.filter((f) => ["issued", "late"].includes(statutFacture(f, jour))), retard = p.factures.filter((f) => statutFacture(f, jour) === "late"), envoyes = p.devis.filter((q) => statutDevis(q, jour) === "sent");
  const mensuel = Array.from({ length: 12 }, (_, m) => p.paiements.filter((x) => x.statutRapprochement === "rapproche" && !x.archivedAt && (x.date || "").startsWith(`${annee}-${String(m + 1).padStart(2, "0")}`)).reduce((s, x) => s + (Number(x.montant) || 0), 0));
  const W = 1240, H = 210, L = 50, R = 175, T = 14, B = 24, BASE = 37500, MAJ = 41250;
  let cum = 0; const cumul = mensuel.map((v) => (cum += v));
  const max = Math.max(MAJ * 1.08, cum * 1.08), Y = (v: number) => T + (1 - v / max) * (H - T - B), X = (i: number) => L + (i + .5) * (W - L - R) / 12, bw = (W - L - R) / 12 * .5;
  const ymaxB = Math.max(1, ...mensuel) * 3.2, Yb = (v: number) => (H - B) - (v / ymaxB) * (H - T - B);
  const moisCourant = Number(jour.slice(5, 7)) - 1;
  return <>
    <div className="hx-mk"><div className="is-wide"><small>Chiffre d'affaires encaissé {annee} · franchise en base de TVA</small><span className="hx-pace is-pro"><i style={{ width: `${Math.min(100, enc / MAJ * 100).toFixed(1)}%` }} /><b style={{ left: `${(BASE / MAJ * 100).toFixed(1)}%` }} /></span><span><b>{euros(enc)}</b> <span className="hx-dim">· {Math.round(enc / BASE * 100)} % du seuil de {euros(BASE)} · majoré {euros(MAJ)}</span></span></div>
      <div><small>À encaisser</small><b>{euros(ouvertes.reduce((s, f) => s + montantFacture(f), 0))}</b><span className="hx-dim">{ouvertes.length} facture{ouvertes.length > 1 ? "s" : ""} émise{ouvertes.length > 1 ? "s" : ""}</span></div>
      <div><small>En retard</small><b className={retard.length ? "hx-red" : ""}>{euros(retard.reduce((s, f) => s + montantFacture(f), 0))}</b><span className="hx-dim">{retard.length} facture{retard.length > 1 ? "s" : ""}</span></div>
      <div><small>Devis envoyés</small><b>{euros(envoyes.reduce((s, q) => s + totalDevis(q), 0))}</b><span className="hx-dim">{envoyes.length} en attente</span></div></div>
    <section className="hx-tile"><header className="hx-th"><h2>Encaissements {annee}</h2><small className="hx-dim">barres : par mois · courbe : cumul face aux seuils de franchise</small></header>
      <svg className="hx-mc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Encaissements ${annee} face aux seuils de franchise de TVA`}>
        {[0, .25, .5, .75, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={Y(max * f)} y2={Y(max * f)} stroke="#ebecee" /><text x={L - 6} y={Y(max * f) + 3} textAnchor="end" className="hx-mct">{Math.round(max * f / 1000)} k€</text></g>)}
        {mensuel.map((v, i) => <rect key={i} x={X(i) - bw / 2} y={Yb(v)} width={bw} height={H - B - Yb(v)} rx="3" fill="#2a78d6" opacity=".28" data-tip={`${MOIS_C[i]} ${annee}|Encaissé : ${euros2(v)}|Cumul : ${euros2(cumul[i])}`} />)}
        <path d={cumul.slice(0, moisCourant + 1).map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ")} fill="none" stroke="#2a78d6" strokeWidth="2.2" />
        {cumul.slice(0, moisCourant + 1).map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="3" fill="#2a78d6" stroke="#fff" strokeWidth="1.5" />)}
        {([[BASE, "Seuil de franchise", "#c0392b"], [MAJ, "Seuil majoré", "#7a1f16"]] as const).map(([v, l, c]) => <g key={l}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={c} strokeWidth="1.4" strokeDasharray="6 4" /><text x={W - R + 6} y={Y(v) + 4} className="hx-mct" style={{ fill: c, fontWeight: 600 }}>{l} {Math.round(v / 1000 * 10) / 10} k€</text></g>)}
        {MOIS_C.map((m, i) => <text key={m} x={X(i)} y={H - 6} textAnchor="middle" className="hx-mct">{m}</text>)}
      </svg></section>
    <div className="hx-acols">
      <section className="hx-tile"><header className="hx-th"><h2>Factures</h2></header>{!p.factures.length ? <p className="hx-dim">Aucune facture.</p> : <table className="hx-atab"><thead><tr><th>N°</th><th>Client · objet</th><th>Échéance</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{[...p.factures].sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || "")).map((f) => { const st = statutFacture(f, jour); return <tr key={f.id}><td className="hx-num">{f.number || "—"}</td><td><b>{client(f.clientId)}</b><br /><small className="hx-dim">{f.title}</small></td><td className={`hx-num ${st === "late" ? "hx-red" : ""}`}>{dateCourte(f.dueDate)}</td><td className="hx-num">{euros2(montantFacture(f))}</td><td><Badge id={st} lib={STATUTS_FACTURE[st] || st} /></td></tr>; })}</tbody></table>}</section>
      <section className="hx-tile"><header className="hx-th"><h2>Devis</h2></header>{!p.devis.length ? <p className="hx-dim">Aucun devis.</p> : <table className="hx-atab"><thead><tr><th>N°</th><th>Client · objet</th><th>Validité</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{[...p.devis].sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || "")).map((q) => { const st = statutDevis(q, jour); return <tr key={q.id}><td className="hx-num">{q.number || "—"}</td><td><b>{client(q.clientId)}</b><br /><small className="hx-dim">{q.title}</small></td><td className="hx-num">{dateCourte(q.validUntil)}</td><td className="hx-num">{euros2(totalDevis(q))}</td><td><Badge id={st} lib={STATUTS_DEVIS[st] || st} /></td></tr>; })}</tbody></table>}</section>
    </div>
    <p className="hx-hint">Lecture seule. Devis, factures, missions et Finance PRO se modifient dans Nexora.</p>
  </>;
}

// --- Opérations : filtres sur tous les champs -----------------------------------
interface Op { id: string; date: string; libelle: string; montant: number; type: string; compte: string; banque: string; categorie: string; sousCategorie: string; confiance: number | null; }
const CHAMPS: { cle: keyof Op | "sens" | "statut"; lib: string; val: (o: Op) => string }[] = [
  { cle: "compte", lib: "Comptes", val: (o) => o.compte }, { cle: "banque", lib: "Banques", val: (o) => o.banque },
  { cle: "categorie", lib: "Catégories", val: (o) => o.categorie || "À classer" }, { cle: "sousCategorie", lib: "Sous-catégories", val: (o) => o.sousCategorie || "—" },
  { cle: "type", lib: "Type", val: (o) => o.type || "—" }, { cle: "sens", lib: "Sens", val: (o) => (o.montant >= 0 ? "Crédit" : "Débit") },
  { cle: "statut", lib: "Statut", val: (o) => (!o.categorie || o.categorie === "À classer" ? "À classer" : "Classée") },
];
const txt = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
function OngletOperations({ cle, rafraichir }: { cle: number; rafraichir: () => void }) {
  const r = useRessource<{ transactions: Record<string, unknown>[]; accounts: Record<string, unknown>[] }>("transactions-data", {}, cle);
  const { jour } = useOptim();
  const resume = useRessource<SyntheseBudget>("budget-summary", { month: jour.slice(0, 7) }, cle);
  const [q, setQ] = useState(""); const [du, setDu] = useState(""); const [au, setAu] = useState(""); const [min, setMin] = useState(""); const [max, setMax] = useState("");
  const [sel, setSel] = useState<Record<string, string[]>>({}); const [pop, setPop] = useState(""); const [limite, setLimite] = useState(200);
  const ops: Op[] = useMemo(() => {
    if (!r.data) return [];
    const comptes = new Map(r.data.accounts.map((a) => [txt(a.account_id || a.id), a]));
    return r.data.transactions.map((t) => { const a = comptes.get(txt(t.account_id)) || {}; return { id: txt(t.transaction_id || t.id), date: txt(t.effective_date || t.bank_date || t.date).slice(0, 10), libelle: txt(t.merchant || t.label || t.description || t.wording), montant: Number(t.signed_amount ?? t.amount) || 0, type: txt(t.transaction_type || t.type), compte: txt(a.name) || txt(t.account_id), banque: txt(a.bank), categorie: txt(t.category), sousCategorie: txt(t.subcategory), confiance: typeof t.category_confidence === "number" ? t.category_confidence : null }; })
      .sort((x, y) => y.date.localeCompare(x.date));
  }, [r.data]);
  const categories = resume.data?.catalogs.categories.map((c) => ({ name: c.name, subcategories: c.subcategories })) || [];
  const liste = ops.filter((o) => {
    const s = q.trim().toLowerCase();
    if (s && !`${o.libelle} ${o.categorie} ${o.sousCategorie} ${o.compte}`.toLowerCase().includes(s)) return false;
    if (du && o.date < du) return false; if (au && o.date > au) return false;
    if (min !== "" && Math.abs(o.montant) < Number(min)) return false; if (max !== "" && Math.abs(o.montant) > Number(max)) return false;
    return CHAMPS.every((c) => !(sel[c.cle] || []).length || sel[c.cle].includes(c.val(o)));
  });
  const depenses = liste.filter((o) => o.montant < 0).reduce((s, o) => s - o.montant, 0), revenus = liste.filter((o) => o.montant > 0).reduce((s, o) => s + o.montant, 0);
  const actifs = CHAMPS.filter((c) => (sel[c.cle] || []).length);
  const vide = !q && !du && !au && min === "" && max === "" && !actifs.length;
  if (!r.data) return <Etat erreur={r.erreur} />;
  return <>
    <div className="hx-fbar">
      <label className="hx-fsearch"><span aria-hidden="true">⌕</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Libellé, catégorie, compte" aria-label="Rechercher une opération" autoComplete="off" /></label>
      {CHAMPS.map((c) => { const opts = [...new Set(ops.map(c.val))].sort((a, b) => a.localeCompare(b, "fr")), n = (sel[c.cle] || []).length; return <span key={c.cle} className="hx-fchip-w"><button type="button" className={`hx-fchip ${n ? "is-on" : ""}`} aria-expanded={pop === c.cle} onClick={() => setPop(pop === c.cle ? "" : c.cle)}>{c.lib}{n ? <> <b>{n}</b></> : null} ▾</button>
        {pop === c.cle && <div className="hx-pop is-f ox-lc-pop" role="dialog" aria-label={c.lib}><ListeCoches options={opts.map((v) => ({ id: v, libelle: v, detail: ops.filter((o) => c.val(o) === v).length }))} choisis={sel[c.cle] || []} changer={(ids) => setSel((x) => ({ ...x, [c.cle]: ids }))} libelleRecherche={`Rechercher : ${c.lib.toLowerCase()}`} fermer={() => setPop("")} /></div>}</span>; })}
      <span className="hx-frange"><label>Du <input type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label><label>au <input type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label></span>
      <span className="hx-frange"><label>Montant ≥ <input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" /> €</label><label>≤ <input type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" /> €</label></span>
      <p className="hx-fsum"><b>{liste.length} opération{liste.length > 1 ? "s" : ""}</b> · {vide ? "aucun filtre" : [...actifs.map((c) => `${c.lib.toLowerCase()} : ${sel[c.cle].join(", ")}`), ...(du || au ? [`du ${du ? dateCourte(du) : "début"} au ${au ? dateCourte(au) : "aujourd'hui"}`] : []), ...(min !== "" || max !== "" ? [`montant ${min !== "" ? "≥ " + min + " €" : ""}${min !== "" && max !== "" ? " et " : ""}${max !== "" ? "≤ " + max + " €" : ""}`] : []), ...(q ? [`« ${q} »`] : [])].join(" · ")} · débits {euros(depenses)} · crédits {euros(revenus)}
        {!vide && <> <button type="button" className="hx-more" onClick={() => { setQ(""); setDu(""); setAu(""); setMin(""); setMax(""); setSel({}); }}>Réinitialiser</button></>}</p>
    </div>
    <div className="hx-tile hx-ops"><table className="hx-atab"><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Banque</th><th>Type</th><th>Catégorie</th><th>Montant</th></tr></thead>
      <tbody>{liste.slice(0, limite).map((o) => <tr key={o.id}><td className="hx-num hx-dim">{dateCourte(o.date)}</td><td>{o.libelle}</td><td>{o.compte}</td><td className="hx-dim">{o.banque}</td><td className="hx-dim">{o.type}</td>
        <td>{o.categorie && o.categorie !== "À classer" ? <span className="hx-catc">{o.categorie}{o.sousCategorie ? ` › ${o.sousCategorie}` : ""}</span> : <Classer x={{ id: o.id, label: o.libelle, amount: o.montant }} categories={categories} apres={rafraichir} />}</td>
        <td className={`hx-num ${o.montant > 0 ? "hx-green" : ""}`}>{euros(o.montant)}</td></tr>)}
        {!liste.length && <tr><td colSpan={7} className="hx-empty">Aucune opération ne correspond aux filtres.</td></tr>}</tbody></table>
      {liste.length > limite && <p className="hx-hint"><button type="button" className="hx-more" onClick={() => setLimite(limite + 200)}>Afficher 200 de plus</button> ({liste.length - limite} restantes)</p>}</div>
  </>;
}

export function Argent() {
  const { prefs, ecrirePrefs } = useOptim();
  const [cle, setCle] = useState(0);
  const onglet = prefs.argent.onglet;
  const rafraichir = () => { cache.clear(); setCle((c) => c + 1); };
  return (
    <main className="hx-main hx-argent" data-scroll>
      <div className="hx-hello hx-row"><div><h1>Suivi du budget</h1><p>Budget personnel (KDM360), patrimoine et activité pro. Côté budget, la seule écriture possible reste le classement d'une opération, comme dans Nexora.</p></div>
        <div className="hx-tabs">{ONGLETS_ARGENT.map((o) => <button key={o} type="button" aria-selected={onglet === o} onClick={() => void ecrirePrefs({ argent: { ...prefs.argent, onglet: o } })}>{LIB_ONGLET[o]}</button>)}</div></div>
      {onglet === "mois" && <OngletPeriode rafraichir={rafraichir} cle={cle} />}
      {onglet === "patrimoine" && <OngletPatrimoine cle={cle} />}
      {onglet === "pro" && <OngletPro />}
      {onglet === "operations" && <OngletOperations cle={cle} rafraichir={rafraichir} />}
    </main>
  );
}
