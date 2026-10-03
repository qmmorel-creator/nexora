// Barre de requête (Ref #655) : une seule requête, visible en puces.
import { useState } from "react";
import { CRITICITES, type Catalogues } from "../donnees/modele";
import { GROUPES, TRIS, requeteParDefaut, type Requete } from "../donnees/requete";
import { SANS_PROJET, SANS_RESPONSABLE, type Filtres } from "../donnees/filtres";
import { Puce } from "../composants";

const PRESETS: Record<string, string> = { today: "aujourd'hui", this_week: "cette semaine", next_week: "semaine prochaine", this_month: "ce mois-ci", before_today: "dépassée" };

export function compterMeta(f: Filtres): number {
  let n = 0;
  if (f.search.trim()) n++; if (f.milestone !== "all") n++; if (f.focus !== "all") n++; if (f.progressMin > 0 || f.progressMax < 100) n++;
  if (f.startFrom || f.startTo) n++; if (f.endFrom || f.endTo) n++; if (f.lateOnly) n++; if (f.dueWithinDays !== "" && f.dueWithinDays != null) n++;
  if (f.pastDays !== "" && f.pastDays != null) n++; if (f.inactivityDays !== "" && f.inactivityDays != null) n++; if (f.quickDatePreset) n++;
  if (!f.showDone) n++; if (f.urgentOnly) n++;
  const compter = (g: Filtres["advanced"]): number => (g?.items || []).reduce((a, i) => a + ("items" in i ? compter(i) : 1), 0);
  return n + compter(f.advanced);
}

export function BarreRequete({ r, setR, cat, membres, metaActifs, projetFixe }: { r: Requete; setR: (r: Requete) => void; cat: Catalogues; membres: string[]; metaActifs: number; projetFixe?: string }) {
  const [ajout, setAjout] = useState(false);
  const nom = (liste: { id: string; name?: string }[], id: string) => (id === SANS_PROJET ? "sans projet" : id === SANS_RESPONSABLE ? "sans responsable" : liste.find((x) => x.id === id)?.name || id);
  const retirer = (k: keyof Requete, v?: string) => setR({ ...r, [k]: Array.isArray(r[k]) && v !== undefined ? (r[k] as string[]).filter((x) => x !== v) : (requeteParDefaut()[k] as never) });
  const basculerListe = (k: "projets" | "statuts" | "responsables" | "types" | "criticites", v: string) => setR({ ...r, [k]: r[k].includes(v) ? r[k].filter((x) => x !== v) : [...r[k], v] });
  return (
    <div className="requete">
      <div className="requete-puces" aria-label="Requête">
        {r.projets.filter((p) => p !== projetFixe).map((p) => <Puce key={p} libelle="projet" valeur={nom(cat.projets, p)} onRetirer={() => retirer("projets", p)} />)}
        {r.statuts.map((s) => <Puce key={s} libelle="statut" valeur={nom(cat.statuts, s)} onRetirer={() => retirer("statuts", s)} />)}
        {r.types.map((s) => <Puce key={s} libelle="type" valeur={nom(cat.types, s)} onRetirer={() => retirer("types", s)} />)}
        {r.criticites.map((s) => <Puce key={s} libelle="criticité" valeur={CRITICITES.find((c) => c.id === s)?.nom || s} onRetirer={() => retirer("criticites", s)} />)}
        {r.responsables.map((s) => <Puce key={s} libelle="responsable" valeur={s === SANS_RESPONSABLE ? "aucun" : s} onRetirer={() => retirer("responsables", s)} />)}
        {r.texte && <Puce libelle="contient" valeur={`« ${r.texte} »`} onRetirer={() => retirer("texte")} />}
        {r.retard && <Puce libelle="échéance" valeur="en retard" onRetirer={() => retirer("retard")} />}
        {r.urgent && <Puce libelle="criticité" valeur="urgentes" onRetirer={() => retirer("urgent")} />}
        {r.focus !== "all" && <Puce libelle="focus" valeur={r.focus === "yes" ? "oui" : "non"} onRetirer={() => retirer("focus")} />}
        {r.echeance && <Puce libelle="fin" valeur={PRESETS[r.echeance] || r.echeance} onRetirer={() => retirer("echeance")} />}
        <Puce libelle="terminées" valeur={r.terminees ? "affichées" : "masquées"} onRetirer={undefined} />
        {metaActifs > 0 && <span className="puce puce-meta" title="Méta-filtres de Nexora, appliqués partout (réglés dans Nexora actuel)">méta-filtres <b>{metaActifs}</b></span>}
        <button type="button" className="puce puce-ajout" aria-expanded={ajout} onClick={() => setAjout((x) => !x)}>+ filtre</button>
      </div>
      <div className="requete-outils">
        <label className="outil"><span className="surtitre">Tri</span>
          <select value={`${r.tri.champ}:${r.tri.sens}`} onChange={(e) => { const [c, s] = e.target.value.split(":"); setR({ ...r, tri: { champ: c as Requete["tri"]["champ"], sens: s as "asc" | "desc" } }); }}>
            {TRIS.flatMap((t) => (t.cle === "none" ? [[`none:asc`, t.libelle]] : [[`${t.cle}:asc`, `${t.libelle} ↑`], [`${t.cle}:desc`, `${t.libelle} ↓`]])).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="outil"><span className="surtitre">Grouper</span>
          <select value={r.groupe} onChange={(e) => setR({ ...r, groupe: e.target.value as Requete["groupe"] })}>{GROUPES.map((g) => <option key={g.cle} value={g.cle}>{g.libelle}</option>)}</select></label>
        <label className="outil-case"><input type="checkbox" checked={r.terminees} onChange={(e) => setR({ ...r, terminees: e.target.checked })} />Terminées</label>
      </div>
      {ajout && (
        <div className="requete-panneau panneau" role="group" aria-label="Ajouter un filtre">
          <fieldset><legend className="surtitre">Raccourcis</legend>
            <label><input type="checkbox" checked={r.retard} onChange={(e) => setR({ ...r, retard: e.target.checked })} /> En retard</label>
            <label><input type="checkbox" checked={r.urgent} onChange={(e) => setR({ ...r, urgent: e.target.checked })} /> Urgentes</label>
            <label><input type="checkbox" checked={r.focus === "yes"} onChange={(e) => setR({ ...r, focus: e.target.checked ? "yes" : "all" })} /> Focus</label>
            <label className="outil"><span>Fin</span><select value={r.echeance} onChange={(e) => setR({ ...r, echeance: e.target.value })}><option value="">toutes</option>{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="outil"><span>Contient</span><input value={r.texte} onChange={(e) => setR({ ...r, texte: e.target.value })} placeholder="titre, description…" /></label>
          </fieldset>
          {!projetFixe && <fieldset><legend className="surtitre">Projets</legend>{[...cat.projets.map((p) => [p.id, p.name || p.id]), [SANS_PROJET, "Sans projet"]].map(([id, n]) => <label key={id}><input type="checkbox" checked={r.projets.includes(id)} onChange={() => basculerListe("projets", id)} /> {n}</label>)}</fieldset>}
          <fieldset><legend className="surtitre">Statuts</legend>{cat.statuts.map((s) => <label key={s.id}><input type="checkbox" checked={r.statuts.includes(s.id)} onChange={() => basculerListe("statuts", s.id)} /> {s.name}</label>)}</fieldset>
          <fieldset><legend className="surtitre">Criticité</legend>{CRITICITES.map((c) => <label key={c.id}><input type="checkbox" checked={r.criticites.includes(c.id)} onChange={() => basculerListe("criticites", c.id)} /> {c.nom}</label>)}</fieldset>
          <fieldset><legend className="surtitre">Types</legend>{cat.types.map((s) => <label key={s.id}><input type="checkbox" checked={r.types.includes(s.id)} onChange={() => basculerListe("types", s.id)} /> {s.name}</label>)}</fieldset>
          <fieldset><legend className="surtitre">Responsables</legend>{[...membres, SANS_RESPONSABLE].map((m) => <label key={m}><input type="checkbox" checked={r.responsables.includes(m)} onChange={() => basculerListe("responsables", m)} /> {m === SANS_RESPONSABLE ? "Sans responsable" : m}</label>)}</fieldset>
        </div>
      )}
    </div>
  );
}
