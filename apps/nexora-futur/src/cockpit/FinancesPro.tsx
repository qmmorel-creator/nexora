// Finances Pro (Ref #659, lot 6b) : Finance PRO, devis, factures, en LECTURE
// seule (clés Firestore non ouvertes, décision de Quentin). Saisie et
// modification restent dans nexora-project.
import { useMemo, useState } from "react";
import type { DonneesPro } from "../donnees/magasin";
import type { Projet } from "../donnees/modele";
import {
  STATUTS_DEVIS, STATUTS_FACTURE, STATUTS_LIGNE, caEncaisse, caEncaisseAnnee, caFacture, caPlanifie, caSigne, echeancesFacturation, euros2, facturesEnRetard, seuilTva,
  statutDevis, statutFacture, totalDevis, travailNonFacture, tresoreriePrevisionnelle,
} from "../donnees/finance-pro";
import { Etat, Segment, Surtitre } from "../composants";

const date = (d?: string) => (d ? d.split("-").reverse().join("/") : "—");
const tonDevis = (s: string) => (s === "accepted" ? "ok" : s === "refused" ? "crit" : s === "expired" ? "alerte" : s === "sent" ? "info" : "neutre") as "ok" | "crit" | "alerte" | "info" | "neutre";
const tonFacture = (s: string) => (s === "paid" ? "ok" : s === "late" ? "alerte" : s === "cancelled" ? "neutre" : "info") as "ok" | "alerte" | "neutre" | "info";

export function FinancesPro({ pro, projets, jour }: { pro: DonneesPro; projets: Projet[]; jour: string }) {
  const [vue, setVue] = useState<"synthese" | "devis" | "factures" | "recettes">("synthese");
  const client = (id?: string) => pro.clients.find((c) => c.id === id)?.name || "Client non renseigné";
  const mission = (id?: string) => { const m = pro.missions.find((x) => x.id === id); return m ? `${projets.find((p) => p.id === m.projectId)?.name || "Mission sans projet lié"} · ${client(m.clientId)}` : "—"; };
  const k = useMemo(() => {
    const signe = caSigne(pro.devis); const facture = caFacture(pro.echeancier); const encaisse = caEncaisse(pro.paiements);
    return { signe, planifie: caPlanifie(pro.echeancier), facture, encaisse, resteAFacturer: signe - facture, resteAEncaisser: facture - encaisse, nonFacture: travailNonFacture(pro.temps, pro.depenses),
      retards: facturesEnRetard(pro.echeancier, jour), tva: seuilTva(caEncaisseAnnee(pro.paiements, +jour.slice(0, 4))), treso30: tresoreriePrevisionnelle(pro.reglages, pro.echeancier, 30, jour), treso90: tresoreriePrevisionnelle(pro.reglages, pro.echeancier, 90, jour) };
  }, [pro, jour]);
  const recettes = pro.factures.filter((f) => f.status === "paid").sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
  const vide = !pro.devis.length && !pro.factures.length && !pro.echeancier.length && !pro.missions.length;
  return (
    <>
      <Segment etiquette="Vue Pro" valeur={vue} onChange={setVue} options={[{ valeur: "synthese", libelle: "Finance PRO" }, { valeur: "devis", libelle: `Devis (${pro.devis.length})` }, { valeur: "factures", libelle: `Factures (${pro.factures.length})` }, { valeur: "recettes", libelle: "Livre des recettes" }]} />
      <p className="discret">Lecture seule : la saisie et la modification se font dans nexora-project.</p>
      {vue === "synthese" && (vide ? <p className="discret">Aucune donnée Finance PRO.</p> : <>
        <div className="fi-cartes">
          {([["CA signé", k.signe], ["CA planifié", k.planifie], ["CA facturé", k.facture], ["CA encaissé", k.encaisse], ["Reste à facturer", k.resteAFacturer], ["Reste à encaisser", k.resteAEncaisser], ["Travail non facturé", k.nonFacture], ["Trésorerie à 30 j", k.treso30], ["Trésorerie à 90 j", k.treso90]] as [string, number][]).map(([l, v]) => (
            <div key={l} className="panneau sy-carte"><Surtitre>{l}</Surtitre><span className="sy-valeur mono fi-pro-v">{euros2(v)}</span></div>
          ))}
          <div className="panneau sy-carte"><Surtitre>Franchise de TVA {jour.slice(0, 4)}</Surtitre><span className="sy-valeur mono fi-pro-v">{Math.round(k.tva.ratio * 100)} %</span>
            <span className="sy-detail">{euros2(k.tva.ca)} encaissés / {euros2(k.tva.base)}</span>{k.tva.statut !== "ok" && <Etat ton={k.tva.statut === "proche" ? "alerte" : "crit"} point={false}>{k.tva.statut === "proche" ? "seuil proche" : k.tva.statut === "depasse_base" ? "seuil de base dépassé" : "seuil majoré dépassé"}</Etat>}</div>
        </div>
        <section className="panneau sy-bloc" aria-label="Échéances de facturation">
          <div className="sy-tete"><Surtitre>Échéances de facturation</Surtitre><span className="marge-auto mono discret">{k.retards.length} en retard</span></div>
          {echeancesFacturation(pro.echeancier).map((l) => (
            <div key={l.id} className="fi-pligne fi-echeance"><span className={`mono ${l.dateCible! < jour ? "crit" : "discret"}`}>{date(l.dateCible)}</span><span>{l.libelle || l.type} <span className="discret">· {mission(l.missionId)}</span></span><span><Etat ton={l.dateCible! < jour ? "crit" : "neutre"} point={false}>{STATUTS_LIGNE[l.statut || ""] || l.statut || ""}</Etat> <span className="mono">{euros2(Number(l.montantPrevu) || 0)}</span></span></div>
          ))}
          {!echeancesFacturation(pro.echeancier).length && <p className="discret">Aucune échéance ouverte.</p>}
        </section>
      </>)}
      {vue === "devis" && (
        <section className="panneau sy-bloc" aria-label="Devis">
          <table className="tb" aria-label="Liste des devis"><thead><tr><th>N°</th><th>Client</th><th>Objet</th><th>Date</th><th>Validité</th><th>Statut</th><th>Total</th></tr></thead>
            <tbody>{[...pro.devis].sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || "")).map((d) => { const s = statutDevis(d, jour); return (
              <tr key={d.id}><td className="mono">{d.number}</td><td>{client(d.clientId)}</td><td>{d.title}</td><td className="mono">{date(d.issueDate)}</td><td className="mono">{date(d.validUntil)}</td><td><Etat ton={tonDevis(s)} point={false}>{STATUTS_DEVIS[s] || s}</Etat></td><td className="mono">{euros2(totalDevis(d))}</td></tr>); })}</tbody>
          </table>
          <p className="discret mono">Total accepté : {euros2(k.signe)} · franchise en base (art. 293 B du CGI) : HT = TTC</p>
        </section>
      )}
      {vue === "factures" && (
        <section className="panneau sy-bloc" aria-label="Factures">
          <table className="tb" aria-label="Liste des factures"><thead><tr><th>N°</th><th>Client</th><th>Objet</th><th>Émise</th><th>Échéance</th><th>Statut</th><th>Total</th></tr></thead>
            <tbody>{[...pro.factures].sort((a, b) => (b.number || "").localeCompare(a.number || "")).map((f) => { const s = statutFacture(f, jour); return (
              <tr key={f.id}><td className="mono">{f.number}{f.creditNoteOf ? " (avoir)" : ""}</td><td>{client(f.clientId)}</td><td>{f.title}</td><td className="mono">{date(f.issueDate)}</td><td className="mono">{date(f.dueDate)}</td><td><Etat ton={tonFacture(s)} point={false}>{STATUTS_FACTURE[s] || s}</Etat></td><td className="mono">{euros2(totalDevis(f))}</td></tr>); })}</tbody>
          </table>
        </section>
      )}
      {vue === "recettes" && (
        <section className="panneau sy-bloc" aria-label="Livre des recettes">
          <table className="tb" aria-label="Livre des recettes"><thead><tr><th>N°</th><th>Client</th><th>Objet</th><th>Payée le</th><th>Montant HT</th></tr></thead>
            <tbody>{recettes.map((f) => <tr key={f.id}><td className="mono">{f.number}</td><td>{client(f.clientId)}</td><td>{f.title}</td><td className="mono">{date((f.paidAt || "").slice(0, 10))}</td><td className="mono">{euros2(totalDevis(f))}</td></tr>)}</tbody>
          </table>
          <p className="discret mono">Total encaissé : {euros2(recettes.reduce((s, f) => s + totalDevis(f), 0))}</p>
        </section>
      )}
    </>
  );
}
