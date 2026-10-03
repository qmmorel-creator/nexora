// Espace Finances (Ref #659, lot 6a) : budget KDM360 relayé par nexora-project.
// Lecture : synthèse du mois et d'une période libre, transactions, patrimoine.
// Écriture : la seule catégorisation (décision de Quentin, 2026-10-03).
import { useEffect, useMemo, useState } from "react";
import { ErreurFinance, type AccesFinance, type RessourceFinance } from "../donnees/source";
import {
  PERIODES, bornesPeriode, datesPeriode, decalerMois, euros, graduationsMontant, libelleMois, messageFinance, modeleBarrePatrimoine, modeleCourbePatrimoine, raison, trierSuivi,
  type ACategoriser, type Detail, type DonneesTransactions, type Periode, type Regroupement, type SerieDePatrimoine, type SyntheseBudget, type TotauxPeriode,
} from "../donnees/finance";
import { Bouton, Cartouche, Etat, Segment, Surtitre } from "../composants";
import { useNotifier } from "./Notifications";
import { CumulBudget, FluxBudget, GraphiquesBudget } from "./FinancesGraphiques";
import { FinancesPro } from "./FinancesPro";
import type { DonneesPro } from "../donnees/magasin";
import type { Projet } from "../donnees/modele";
import type { Graphes } from "../donnees/finance-graphes";

type Onglet = "synthese" | "graphiques" | "flux" | "categoriser" | "transactions" | "patrimoine";

function useLecture<T>(finance: AccesFinance | undefined, ressource: RessourceFinance, params: Record<string, string> | null, version: number) {
  const [etat, setEtat] = useState<{ donnees: T | null; erreur: string | null; charge: boolean }>({ donnees: null, erreur: null, charge: false });
  const cle = JSON.stringify(params);
  useEffect(() => {
    if (!finance || !params) return;
    let vivant = true;
    setEtat((e) => ({ ...e, charge: false, erreur: null }));
    finance.lire(ressource, params).then((d) => vivant && setEtat({ donnees: d as T, erreur: null, charge: true }))
      .catch((e) => vivant && setEtat({ donnees: null, erreur: e instanceof ErreurFinance ? e.code : String(e), charge: true }));
    return () => { vivant = false; };
  }, [finance, ressource, cle, version]); // eslint-disable-line react-hooks/exhaustive-deps
  return etat;
}

const Erreur = ({ code }: { code: string }) => <p role="alert" className="fi-erreur"><Etat ton="crit">Budget</Etat> {messageFinance(code)}</p>;
const Chargement = () => <p className="surtitre zone-charge">Lecture du budget…</p>;
const dateCourte = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "");

function Cartes({ t }: { t: { expenses: number; income: number; net: number; remaining?: number; budget?: number } }) {
  return (
    <div className="fi-cartes">
      <div className="panneau sy-carte"><Surtitre>Dépenses</Surtitre><span className="sy-valeur mono">{euros(t.expenses)}</span></div>
      <div className="panneau sy-carte"><Surtitre>Revenus</Surtitre><span className="sy-valeur mono">{euros(t.income)}</span></div>
      <div className="panneau sy-carte"><Surtitre>Solde net</Surtitre><span className={`sy-valeur mono ${t.net < 0 ? "crit" : "ok"}`}>{euros(t.net)}</span></div>
      {t.remaining !== undefined && <div className="panneau sy-carte"><Surtitre>Reste à dépenser</Surtitre><span className={`sy-valeur mono ${t.remaining < 0 ? "crit" : ""}`}>{euros(t.remaining)}</span><span className="discret sy-detail">sur {euros(t.budget)} budgétés</span></div>}
    </div>
  );
}

function Synthese({ s, mois, setMois, finance, jour, version }: { s: SyntheseBudget; mois: string; setMois: (m: string) => void; finance: AccesFinance; jour: string; version: number }) {
  const [periode, setPeriode] = useState<Periode>("previousMonth");
  const [libre, setLibre] = useState({ from: "", to: "" });
  const b = bornesPeriode(periode, jour, libre);
  const params = periode === "all" ? { from: "2000-01-01", to: jour } : b.from && b.to ? b : null;
  const p = useLecture<TotauxPeriode>(finance, "budget-summary", params, version);
  return (
    <>
      <section className="panneau sy-bloc" aria-label={`Budget de ${libelleMois(mois)}`}>
        <div className="sy-tete">
          <Bouton variante="discret" aria-label="Mois précédent" onClick={() => setMois(decalerMois(mois, -1))}>←</Bouton>
          <strong>{libelleMois(mois)}</strong>
          <Bouton variante="discret" aria-label="Mois suivant" onClick={() => setMois(decalerMois(mois, 1))}>→</Bouton>
          {mois !== jour.slice(0, 7) && <Bouton variante="discret" onClick={() => setMois(jour.slice(0, 7))}>Ce mois</Bouton>}
          <span className="marge-auto discret">{s.overBudget.length ? `${s.overBudget.length} catégorie(s) dépassée(s)` : "aucun dépassement"}</span>
        </div>
        <Cartes t={s.totals} />
        <div className="fi-suivi" role="list" aria-label="Suivi par catégorie">
          {trierSuivi(s.tracking).map((c) => (
            <div key={c.category} role="listitem" className="fi-cat">
              <span className="fi-cat-nom"><span className="point" style={{ background: c.color || "var(--encre3)" }} />{c.category}</span>
              <span className="mono">{euros(c.actual)}{c.budget > 0 ? ` / ${euros(c.budget)}` : ""}</span>
              {c.budget > 0 ? <span className="fi-barre"><span className={c.over ? "crit" : c.actual / c.budget >= 0.9 ? "alerte" : ""} style={{ width: `${Math.min(100, (c.actual / c.budget) * 100)}%` }} /></span> : <span className="discret fi-sans">sans budget</span>}
              {c.over && <Etat ton="crit" point={false}>{`+${euros(c.actual - c.budget)}`}</Etat>}
            </div>
          ))}
        </div>
      </section>
      <section className="panneau sy-bloc" aria-label="Synthèse sur une période">
        <div className="sy-tete">
          <Surtitre>Période</Surtitre>
          <select aria-label="Période de la synthèse" value={periode} onChange={(e) => setPeriode(e.target.value as Periode)}>{PERIODES.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}</select>
          {periode === "custom" && <><input type="date" aria-label="Du" value={libre.from} onChange={(e) => setLibre({ ...libre, from: e.target.value })} /><input type="date" aria-label="Au" value={libre.to} onChange={(e) => setLibre({ ...libre, to: e.target.value })} /></>}
          <span className="marge-auto discret">{p.donnees ? datesPeriode(p.donnees.period) : ""}</span>
        </div>
        {!params ? <p className="discret">Choisis les deux dates.</p> : p.erreur ? <Erreur code={p.erreur} /> : !p.charge || !p.donnees ? <Chargement /> : (
          <><Cartes t={p.donnees.totals} /><p className="discret mono">{p.donnees.counts.expenses} dépense(s) · {p.donnees.counts.income} revenu(s) ou remboursement(s)</p></>
        )}
      </section>
    </>
  );
}

function LigneACategoriser({ x, s, onValider }: { x: ACategoriser; s: SyntheseBudget; onValider: (cat: string, sous: string | null) => Promise<void> }) {
  const [cat, setCat] = useState(s.catalogs.categories.some((c) => c.name === x.category) ? x.category : "");
  const sous = s.catalogs.categories.find((c) => c.name === cat)?.subcategories || [];
  const [sc, setSc] = useState(x.subcategory && sous.includes(x.subcategory) ? x.subcategory : "");
  const [enCours, setEnCours] = useState(false);
  const pret = !!cat && (sous.length === 0 || !!sc);
  return (
    <div role="row" className="fi-acat">
      <span role="cell" className="mono discret">{dateCourte(x.date)}</span>
      <span role="cell" className="fi-acat-lib"><strong>{x.label}</strong><span className="discret">{x.account} · {raison(x)}</span></span>
      <span role="cell" className={`mono ${x.amount < 0 ? "" : "ok"}`}>{euros(x.amount)}</span>
      <span role="cell"><select aria-label={`Catégorie de ${x.label}`} value={cat} onChange={(e) => { setCat(e.target.value); setSc(""); }}><option value="">Catégorie…</option>{s.catalogs.categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></span>
      <span role="cell">{sous.length > 0 ? <select aria-label={`Sous-catégorie de ${x.label}`} value={sc} onChange={(e) => setSc(e.target.value)}><option value="">Sous-catégorie…</option>{sous.map((v) => <option key={v} value={v}>{v}</option>)}</select> : <span className="discret">—</span>}</span>
      <span role="cell"><Bouton variante="principal" disabled={!pret || enCours} onClick={async () => { setEnCours(true); try { await onValider(cat, sous.length ? sc : null); } finally { setEnCours(false); } }}>{enCours ? "…" : "Valider"}</Bouton></span>
    </div>
  );
}

function Transactions({ d }: { d: DonneesTransactions }) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  const comptes = useMemo(() => new Map(d.accounts.map((a) => [String(a.account_id), String(a.name || a.account_id)])), [d.accounts]);
  const lignes = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...d.transactions].filter((t) => !n || Object.values(t).some((v) => v != null && String(v).toLowerCase().includes(n)))
      .sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)));
  }, [d.transactions, q]);
  useEffect(() => setPage(0), [q]);
  const vue = lignes.slice(page * 100, page * 100 + 100);
  const csv = () => {
    const echap = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const texte = ["Date;Libellé;Montant;Type;Catégorie;Sous-catégorie;Compte", ...lignes.map((t) => [t.effective_date, t.merchant || t.description, String(t.signed_amount).replace(".", ","), t.transaction_type, t.category, t.subcategory, comptes.get(String(t.account_id))].map(echap).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${texte}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <section className="panneau sy-bloc" aria-label="Transactions">
      <div className="sy-tete">
        <input className="insp-champ fi-recherche" type="search" placeholder="Rechercher (libellé, catégorie, montant…)" aria-label="Rechercher une transaction" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="mono discret">{lignes.length} opération(s)</span>
        <span className="marge-auto" /><Bouton variante="discret" onClick={csv}>Exporter CSV</Bouton>
      </div>
      <div className="tb-defil">
        <table className="tb" aria-label="Liste des transactions">
          <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th><th>Type</th><th>Catégorie</th><th>Compte</th></tr></thead>
          <tbody>{vue.map((t) => (
            <tr key={String(t.transaction_id)}>
              <td className="mono">{dateCourte(String(t.effective_date || ""))}</td><td>{String(t.merchant || t.description || "")}</td>
              <td className={`mono ${Number(t.signed_amount) < 0 ? "" : "ok"}`}>{Number(t.signed_amount).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</td>
              <td className="discret">{String(t.transaction_type || "")}</td><td>{t.category ? `${t.category}${t.subcategory ? ` · ${t.subcategory}` : ""}` : <Etat ton="alerte" point={false}>à classer</Etat>}</td>
              <td className="discret">{comptes.get(String(t.account_id)) || String(t.account_id || "")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {lignes.length > 100 && <div className="sy-tete"><Bouton variante="discret" disabled={!page} onClick={() => setPage(page - 1)}>← 100 précédentes</Bouton><span className="mono discret">page {page + 1} / {Math.ceil(lignes.length / 100)}</span><Bouton variante="discret" disabled={(page + 1) * 100 >= lignes.length} onClick={() => setPage(page + 1)}>100 suivantes →</Bouton></div>}
    </section>
  );
}

function Patrimoine({ s, finance, jour, version }: { s: SyntheseBudget; finance: AccesFinance; jour: string; version: number }) {
  const [par, setPar] = useState<Regroupement>("type");
  const [detail, setDetail] = useState<Detail>("none");
  const [pas, setPas] = useState<"week" | "month">("week");
  const barre = useMemo(() => modeleBarrePatrimoine(s.wealth.accounts, par), [s.wealth.accounts, par]);
  const from = useMemo(() => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 364); return d.toISOString().slice(0, 10); }, [jour]);
  const serie = useLecture<SerieDePatrimoine>(finance, "wealth-series", { step: pas, from, to: jour }, version);
  const courbe = useMemo(() => modeleCourbePatrimoine(serie.donnees, detail), [serie.donnees, detail]);
  const g = graduationsMontant(courbe.min, courbe.max);
  const W = 720; const H = 220; const x = (i: number) => 50 + (i * (W - 60)) / Math.max(1, courbe.points.length - 1); const y = (v: number) => 10 + ((g.max - v) / (g.max - g.min)) * (H - 30);
  return (
    <>
      <section className="panneau sy-bloc" aria-label="Répartition du patrimoine">
        <div className="sy-tete"><Surtitre>Patrimoine au {dateCourte(s.wealth.date)}</Surtitre><strong className="mono">{euros(barre.net)}</strong>
          <span className="marge-auto" /><Segment etiquette="Regrouper le patrimoine par" valeur={par} onChange={setPar} options={[{ valeur: "type", libelle: "Type" }, { valeur: "bank", libelle: "Banque" }, { valeur: "account", libelle: "Compte" }]} /></div>
        <div className="fi-pbarre" role="img" aria-label={`Actifs : ${barre.segments.map((x) => `${x.libelle} ${euros(x.valeur)}`).join(", ")}`}>
          {barre.segments.map((x) => <i key={x.cle} style={{ flexGrow: x.part, background: x.couleur || "var(--encre3)" }} title={`${x.libelle} : ${euros(x.valeur)} (${Math.round(x.part * 100)} %)`}>{x.part > 0.08 ? `${Math.round(x.part * 100)} %` : ""}</i>)}
        </div>
        <div className="fi-plignes">
          {[...barre.segments, ...barre.negatifs].map((x) => <div key={x.cle} className="fi-pligne"><span className="point" style={{ background: x.couleur || "var(--encre3)" }} /><span>{x.libelle}</span><span className={`mono ${x.valeur < 0 ? "crit" : ""}`}>{euros(x.valeur)}</span></div>)}
          <div className="fi-pligne fi-ptotal"><span /><span>Actifs {euros(barre.totalPositif)} · dettes {euros(barre.totalNegatif)}</span><strong className="mono">{euros(barre.net)}</strong></div>
        </div>
      </section>
      <section className="panneau sy-bloc" aria-label="Évolution du patrimoine">
        <div className="sy-tete"><Surtitre>Évolution sur 12 mois</Surtitre><span className="marge-auto" />
          <Segment etiquette="Pas de la courbe" valeur={pas} onChange={setPas} options={[{ valeur: "week", libelle: "Semaine" }, { valeur: "month", libelle: "Mois" }]} />
          <Segment etiquette="Détail de la courbe" valeur={detail} onChange={setDetail} options={[{ valeur: "none", libelle: "Net" }, { valeur: "type", libelle: "Type" }, { valeur: "bank", libelle: "Banque" }, { valeur: "account", libelle: "Compte" }]} />
        </div>
        {serie.erreur ? <Erreur code={serie.erreur} /> : !serie.charge ? <Chargement /> : courbe.points.length < 2 ? <p className="discret">Pas assez de points.</p> : (
          <svg viewBox={`0 0 ${W} ${H}`} className="sy-svg fi-courbe" role="img" aria-label={`Patrimoine net : de ${euros(courbe.points[0].net)} à ${euros(courbe.points[courbe.points.length - 1].net)}`}>
            {g.traits.map((v) => <g key={v}><line x1={46} x2={W} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--encre2)" : "var(--ligne2)"} /><text x={42} y={y(v) + 3} textAnchor="end" className="sy-txt discret">{Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k` : v}</text></g>)}
            {courbe.groupes.map((gr, k) => <path key={gr.cle} d={`M${courbe.points.map((p, i) => `${x(i)},${y(p.pile[k].haut)}`).join(" L")} L${courbe.points.map((p, i) => `${x(i)},${y(p.pile[k].bas)}`).reverse().join(" L")} Z`} fill={gr.couleur || "var(--encre3)"} opacity={0.45}><title>{gr.libelle}</title></path>)}
            <polyline points={courbe.points.map((p, i) => `${x(i)},${y(p.net)}`).join(" ")} fill="none" stroke="var(--encre)" strokeWidth={2} />
            {[0, Math.floor((courbe.points.length - 1) / 2), courbe.points.length - 1].map((i) => <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className="sy-txt discret">{dateCourte(courbe.points[i].date)}</text>)}
          </svg>
        )}
        {detail !== "none" && <ul className="sy-legende">{courbe.groupes.map((gr) => <li key={gr.cle}><span className="point" style={{ background: gr.couleur || "var(--encre3)" }} />{gr.libelle} <span className="mono discret">{euros(gr.dernier)}</span></li>)}</ul>}
      </section>
    </>
  );
}

export function PageFinancesKdm({ finance, jour, pro, projets }: { finance: AccesFinance | undefined; jour: string; pro: DonneesPro; projets: Projet[] }) {
  const notifier = useNotifier();
  const [univers, setUnivers] = useState<"perso" | "pro">("perso");
  const [onglet, setOnglet] = useState<Onglet>("synthese");
  const [mois, setMois] = useState(jour.slice(0, 7));
  const [version, setVersion] = useState(0);
  const s = useLecture<SyntheseBudget>(finance, "budget-summary", { month: mois }, version);
  // La file « à catégoriser » est celle du mois en cours (comme nexora-project).
  const courant = useLecture<SyntheseBudget>(finance, "budget-summary", mois === jour.slice(0, 7) ? null : { month: jour.slice(0, 7) }, version);
  const file = (mois === jour.slice(0, 7) ? s.donnees : courant.donnees)?.toCategorize || [];
  const tx = useLecture<DonneesTransactions>(finance, "transactions-data", onglet === "transactions" ? {} : null, version);
  const bascule = <Segment etiquette="Univers financier" valeur={univers} onChange={setUnivers} options={[{ valeur: "perso", libelle: "Budget perso (KDM360)" }, { valeur: "pro", libelle: "Pro : devis, factures, Finance PRO" }]} />;
  if (univers === "pro") return <div className="espace finances"><Cartouche surtitre="Espace Finances" titre="Activité pro" meta={<span>lecture seule</span>} />{bascule}<FinancesPro pro={pro} projets={projets} jour={jour} /></div>;
  if (!finance) return <div className="espace finances"><Cartouche surtitre="Espace Finances" titre="Budget" />{bascule}<p className="discret">Budget indisponible dans cette session.</p></div>;
  const categoriser = async (x: ACategoriser, category: string, subcategory: string | null) => {
    try {
      await finance.categoriser({ transactionId: x.id, category, subcategory, idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      notifier({ message: `« ${x.label} » classée en ${category}${subcategory ? ` · ${subcategory}` : ""}.` });
      setVersion((v) => v + 1);
    } catch (e) { notifier({ message: messageFinance(e instanceof ErreurFinance ? e.code : String(e)), ton: "crit" }); }
  };
  return (
    <div className="espace finances">
      <Cartouche surtitre="Espace Finances" titre="Budget personnel" meta={<><span>source : KDM360, via nexora-project</span><span>écriture : catégorisation seulement</span></>}
        actions={<Bouton variante="discret" onClick={() => setVersion((v) => v + 1)}>Actualiser</Bouton>} />
      {bascule}
      <Segment etiquette="Vue Finances" valeur={onglet} onChange={setOnglet}
        options={[{ valeur: "synthese", libelle: "Synthèse" }, { valeur: "graphiques", libelle: "Graphiques" }, { valeur: "flux", libelle: "Flux" }, { valeur: "categoriser", libelle: `À catégoriser${file.length ? ` (${file.length})` : ""}` }, { valeur: "transactions", libelle: "Transactions" }, { valeur: "patrimoine", libelle: "Patrimoine" }]} />
      {s.erreur ? <Erreur code={s.erreur} /> : !s.charge || !s.donnees ? <Chargement /> : (
        <>
          {onglet === "synthese" && <Synthese s={s.donnees} mois={mois} setMois={setMois} finance={finance} jour={jour} version={version} />}
          {onglet === "categoriser" && (
            <section className="panneau sy-bloc" aria-label="Opérations à catégoriser">
              <div className="sy-tete"><Surtitre>À catégoriser · mois en cours et IA peu sûre sur 60 jours</Surtitre><span className="marge-auto mono discret">{file.length} opération(s)</span></div>
              {file.length ? <div role="table" className="fi-acats">{file.map((x) => <LigneACategoriser key={x.id} x={x} s={(mois === jour.slice(0, 7) ? s.donnees : courant.donnees) || s.donnees!} onValider={(c, sc) => categoriser(x, c, sc)} />)}</div>
                : <p className="discret">Rien à catégoriser.</p>}
            </section>
          )}
          {onglet === "transactions" && (tx.erreur ? <Erreur code={tx.erreur} /> : !tx.charge || !tx.donnees ? <Chargement /> : <Transactions d={tx.donnees} />)}
          {onglet === "graphiques" && (s.donnees.charts ? <>
            <div className="sy-tete"><Bouton variante="discret" aria-label="Mois précédent" onClick={() => setMois(decalerMois(mois, -1))}>←</Bouton><strong>{libelleMois(mois)}</strong><Bouton variante="discret" aria-label="Mois suivant" onClick={() => setMois(decalerMois(mois, 1))}>→</Bouton></div>
            <GraphiquesBudget c={s.donnees.charts as unknown as Graphes} mois={mois} /><CumulBudget c={s.donnees.charts as unknown as Graphes} mois={mois} />
          </> : <p className="discret">Graphiques absents de la réponse.</p>)}
          {onglet === "flux" && <FluxBudget finance={finance} jour={jour} version={version} />}
          {onglet === "patrimoine" && <Patrimoine s={s.donnees} finance={finance} jour={jour} version={version} />}
        </>
      )}
    </div>
  );
}
