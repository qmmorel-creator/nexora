// Fiche mémo (Ref #663) : une tâche sur une page A4, à imprimer ou à
// enregistrer en PDF (impression du navigateur), comme la fiche mémo PDF de
// nexora-project (MEMO-PDF-CORE).
import type { Donnees } from "../donnees/magasin";
import { estTerminee } from "../donnees/modele";
import { journalTache } from "../donnees/historique";
import { Bouton } from "../composants";
import { naviguer } from "../navigation/routeur";

const date = (iso?: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
const CRIT: Record<string, string> = { low: "Faible", normal: "Normale", high: "Haute", urgent: "Urgente" };

export function FicheMemo({ d, id }: { d: Donnees; id: string }) {
  const t = d.taches.find((x) => x.id === id) || d.archive.find((x) => x.id === id);
  if (!t) return <div className="espace"><p className="discret">Tâche introuvable.</p></div>;
  const projet = d.projets.find((p) => p.id === t.projectId);
  const statut = d.statuts.find((s) => s.id === t.statusId);
  const deps = (t.dependsOn || []).map((x) => d.taches.find((y) => y.id === x)).filter(Boolean);
  const hist = journalTache(d.journal, t.id, 8, (x) => d.statuts.find((s) => s.id === x)?.name || x);
  return (
    <div className="fiche">
      <div className="fiche-actions no-print">
        <Bouton variante="discret" onClick={() => naviguer("/taches", new URLSearchParams({ t: t.id }))}>← Retour à la tâche</Bouton>
        <Bouton variante="principal" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</Bouton>
      </div>
      <article className="fiche-page" aria-label={`Fiche mémo ${t.title}`}>
        <header className="fiche-tete" style={{ borderColor: projet?.color || "var(--encre)" }}>
          <span className="fiche-projet">{projet?.name || "Sans projet"}</span>
          <h1>{t.title}</h1>
          <span className="fiche-statut">{statut?.name || "—"}{estTerminee(t, d.statuts) ? " · terminée" : ""}{t.milestone ? " · jalon" : ""}{t.focus ? " · focus" : ""}</span>
        </header>
        <dl className="fiche-kv">
          <div><dt>Responsable</dt><dd>{t.assignee || "—"}</dd></div>
          <div><dt>Début</dt><dd>{date(t.start)}{t.startTime ? ` · ${t.startTime}` : ""}</dd></div>
          <div><dt>Fin</dt><dd>{date(t.end)}{t.endTime ? ` · ${t.endTime}` : ""}</dd></div>
          <div><dt>Criticité</dt><dd>{t.criticality ? CRIT[t.criticality] || t.criticality : "—"}</dd></div>
          <div><dt>Avancement</dt><dd>{t.progress ?? 0} %</dd></div>
        </dl>
        {t.desc && <section><h2>Description</h2><p className="fiche-texte">{t.desc}</p></section>}
        {!!t.checklist?.length && <section><h2>Sous-tâches</h2><ul className="fiche-liste">{t.checklist.map((c, i) => <li key={i}>{c.done ? "☑" : "☐"} {c.text}</li>)}</ul></section>}
        {deps.length > 0 && <section><h2>Dépend de</h2><ul className="fiche-liste">{deps.map((x) => <li key={x!.id}>{x!.title} · fin {date(x!.end)}</li>)}</ul></section>}
        {t.meetingReport && <section><h2>Compte rendu</h2><p className="fiche-texte">{t.meetingReport}</p></section>}
        {!!t.attachments?.length && <section><h2>Pièces jointes</h2><ul className="fiche-liste">{t.attachments.map((a) => <li key={a.id}>{a.name || a.url}{a.url ? ` · ${a.url}` : ""}</li>)}</ul></section>}
        {hist.length > 0 && <section><h2>Historique</h2><ul className="fiche-liste">{hist.map((h, i) => <li key={i}>{h.quand} · {h.texte}</li>)}</ul></section>}
        <footer className="fiche-pied">Nexora · fiche éditée le {new Date().toLocaleDateString("fr-FR")} · {t.id}</footer>
      </article>
    </div>
  );
}
