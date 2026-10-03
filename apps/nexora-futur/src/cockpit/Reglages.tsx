// Réglages (Ref #663, lot 10) : l'écran de configuration de nexora-project
// porté dans Futur. Chaque modification écrit UN élément (rejouable, sans
// écraser une autre session) dans la clé Firebase partagée avec nexora-project.
import { useState, type ReactNode } from "react";
import type { Donnees, CleJson, Favori, Modele } from "../donnees/magasin";
import { useDonnees } from "../donnees/magasin";
import type { Dossier, Projet, Statut, TypeTache } from "../donnees/modele";
import { estProjetCalendrier } from "../donnees/modele";
import {
  COULEURS_REGLAGES, ajouterElement, ajouterHabitude, basculerFavori, majElement, majHabitude, majObjet, nouvelIdReglage, parentsPossibles, retirerElement, usages,
} from "../donnees/reglages";
import { copiesSecours, oublierSecours, type CopieSecours } from "../donnees/secours";
import { Bouton, Cartouche, Segment, Surtitre } from "../composants";
import { ReglagesApparence } from "../composants/ReglagesApparence";
import { useNotifier } from "./Notifications";

export type OngletReglages = "apparence" | "projets" | "statuts" | "creation" | "habitudes" | "sauvegarde";
export const ONGLETS_REGLAGES: { valeur: OngletReglages; libelle: string }[] = [
  { valeur: "apparence", libelle: "Apparence" }, { valeur: "projets", libelle: "Projets et dossiers" }, { valeur: "statuts", libelle: "Statuts et types" },
  { valeur: "creation", libelle: "Création" }, { valeur: "habitudes", libelle: "Thèmes d'habitudes" }, { valeur: "sauvegarde", libelle: "Sauvegarde" },
];
const CRITICITES: [string, string][] = [["", "—"], ["low", "Faible"], ["normal", "Normale"], ["high", "Haute"], ["urgent", "Urgente"]];

// Texte validé à la sortie du champ ou par Entrée (une écriture par modification).
function Texte({ valeur, libelle, onValider, largeur }: { valeur: string; libelle: string; onValider: (v: string) => void; largeur?: number }) {
  const [v, setV] = useState(valeur);
  const [vu, setVu] = useState(valeur);
  if (valeur !== vu) { setVu(valeur); setV(valeur); }
  const valider = () => { const x = v.trim(); if (x && x !== valeur) onValider(x); else setV(valeur); };
  return <input className="rg-texte" aria-label={libelle} value={v} style={largeur ? { width: largeur } : undefined} onChange={(e) => setV(e.target.value)} onBlur={valider}
    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(valeur); (e.target as HTMLInputElement).blur(); } }} />;
}
const Couleur = ({ valeur, libelle, onChange }: { valeur?: string; libelle: string; onChange: (c: string) => void }) =>
  <input type="color" className="rg-couleur" aria-label={libelle} value={/^#[0-9a-f]{6}$/i.test(valeur || "") ? valeur : "#7a8290"} onChange={(e) => onChange(e.target.value)} />;
// Suppression en deux temps (pas de boîte de dialogue native).
function Supprimer({ libelle, refus, onConfirmer }: { libelle: string; refus?: string; onConfirmer: () => void }) {
  const [arme, setArme] = useState(false);
  if (refus) return <span className="rg-refus discret" title={refus}>{refus}</span>;
  return arme
    ? <span className="rg-conf"><Bouton variante="discret" className="btn-danger" onClick={() => { setArme(false); onConfirmer(); }} aria-label={`Confirmer : supprimer ${libelle}`}>Confirmer</Bouton><Bouton variante="discret" onClick={() => setArme(false)}>Annuler</Bouton></span>
    : <Bouton variante="discret" onClick={() => setArme(true)} aria-label={`Supprimer ${libelle}`}>Supprimer</Bouton>;
}
const Bloc = ({ titre, aide, actions, children }: { titre: string; aide?: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="panneau rg-bloc" aria-label={titre}>
    <div className="rg-tete"><h2>{titre}</h2>{actions}</div>
    {aide && <p className="discret rg-aide">{aide}</p>}
    {children}
  </section>
);

export function PageReglages({ d, onglet, setOnglet }: { d: Donnees; onglet: OngletReglages; setOnglet: (o: OngletReglages) => void }) {
  const { ecrireJson } = useDonnees();
  const notifier = useNotifier();
  const ecrire = (nom: CleJson, f: (v: unknown) => unknown, message?: string) =>
    ecrireJson(nom, f).then(() => { if (message) notifier({ message }); }).catch((e) => notifier({ message: `Réglage non enregistré : ${(e as Error).message}`, ton: "crit" }));
  return (
    <div className="espace rg">
      <Cartouche surtitre="Réglages" titre={ONGLETS_REGLAGES.find((o) => o.valeur === onglet)?.libelle || "Réglages"}
        meta={<span>Partagés avec Nexora actuel : chaque changement est écrit tout de suite, élément par élément.</span>} />
      <div className="rg-corps">
        <nav className="rg-onglets" aria-label="Rubriques des réglages">
          {ONGLETS_REGLAGES.map((o) => <button key={o.valeur} type="button" className={o.valeur === onglet ? "actif" : ""} aria-current={o.valeur === onglet ? "page" : undefined} onClick={() => setOnglet(o.valeur)}>{o.libelle}</button>)}
        </nav>
        <div className="rg-contenu">
          {onglet === "apparence" && <Bloc titre="Apparence" aide="Propre à cet appareil (identité Clarté)."><ReglagesApparence /></Bloc>}
          {onglet === "projets" && <Projets d={d} ecrire={ecrire} />}
          {onglet === "statuts" && <StatutsTypes d={d} ecrire={ecrire} />}
          {onglet === "creation" && <Creation d={d} ecrire={ecrire} />}
          {onglet === "habitudes" && <Habitudes d={d} ecrire={ecrire} />}
          {onglet === "sauvegarde" && <Sauvegarde />}
        </div>
      </div>
    </div>
  );
}
type Ecrire = (nom: CleJson, f: (v: unknown) => unknown, message?: string) => Promise<void>;

/* -------------------------------------------------------- Projets, dossiers */
function Projets({ d, ecrire }: { d: Donnees; ecrire: Ecrire }) {
  const [nom, setNom] = useState("");
  const [dossier, setDossier] = useState("");
  const majP = (id: string, patch: Partial<Projet>) => ecrire("projets", (v) => majElement<Projet>(v, id, patch));
  const estFavori = (id: string) => d.favoris.some((f) => f.type === "project" && f.id === id);
  const dossiersReels = d.dossiers.filter((f) => f.id !== "folder-a-trier" || d.etats.dossiers.lecture?.texte?.includes("folder-a-trier"));
  const creer = () => {
    const n = nom.trim(); if (!n) return;
    const p: Projet = { id: nouvelIdReglage(), name: n, color: COULEURS_REGLAGES[d.projets.length % COULEURS_REGLAGES.length], ...(dossier ? { folderId: dossier } : {}) };
    setNom(""); ecrire("projets", (v) => ajouterElement(v, p), `Projet « ${n} » créé.`);
  };
  const [nomDossier, setNomDossier] = useState("");
  const creerDossier = () => {
    const n = nomDossier.trim(); if (!n) return;
    setNomDossier(""); ecrire("dossiers", (v) => ajouterElement<Dossier>(v, { id: nouvelIdReglage(), name: n, parentId: null }), `Dossier « ${n} » créé.`);
  };
  const tri = [...d.projets].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  return (
    <>
      <Bloc titre="Projets" aide="Couleur, nom, dossier et favori. Un projet qui a encore des tâches (ou des tâches archivées) ne peut pas être supprimé."
        actions={<form className="rg-ajout" onSubmit={(e) => { e.preventDefault(); creer(); }}>
          <input className="rg-texte" aria-label="Nom du nouveau projet" placeholder="Nouveau projet" value={nom} onChange={(e) => setNom(e.target.value)} />
          <select className="rg-select" aria-label="Dossier du nouveau projet" value={dossier} onChange={(e) => setDossier(e.target.value)}><option value="">À trier</option>{dossiersReels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <Bouton variante="principal" type="submit" disabled={!nom.trim()}>Créer</Bouton></form>}>
        <div className="rg-table" role="table" aria-label="Projets">
          {tri.map((p) => {
            const cal = estProjetCalendrier(d.projets, p.id); const n = usages(d.taches, d.archive, "projectId", p.id);
            return (
              <div key={p.id} className="rg-ligne" role="row" aria-label={p.name}>
                <Couleur valeur={p.color} libelle={`Couleur de ${p.name}`} onChange={(c) => majP(p.id, { color: c })} />
                {cal ? <span className="rg-fixe">{p.name} <span className="discret">· calendrier synchronisé</span></span> : <Texte valeur={p.name || ""} libelle={`Nom de ${p.name}`} onValider={(x) => majP(p.id, { name: x })} />}
                <select className="rg-select" aria-label={`Dossier de ${p.name}`} value={p.folderId || ""} onChange={(e) => majP(p.id, { folderId: e.target.value || undefined })}>
                  <option value="">À trier</option>{dossiersReels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                <span className="mono discret">{n} tâche{n > 1 ? "s" : ""}</span>
                <button type="button" className={`rg-etoile ${estFavori(p.id) ? "on" : ""}`} aria-pressed={estFavori(p.id)} aria-label={`Favori ${p.name}`}
                  onClick={() => ecrire("favoris", (v) => basculerFavori(v, { type: "project", id: p.id } as Favori))}>★</button>
                <Supprimer libelle={p.name || p.id} refus={cal ? "géré par la synchronisation" : n ? "a des tâches" : undefined} onConfirmer={() => ecrire("projets", (v) => retirerElement(v, p.id), `Projet « ${p.name} » supprimé.`)} />
              </div>
            );
          })}
        </div>
      </Bloc>
      <Bloc titre="Dossiers" aide="Les dossiers s'imbriquent ; un dossier ne peut pas être rangé dans un de ses sous-dossiers. Seul un dossier vide peut être supprimé."
        actions={<form className="rg-ajout" onSubmit={(e) => { e.preventDefault(); creerDossier(); }}>
          <input className="rg-texte" aria-label="Nom du nouveau dossier" placeholder="Nouveau dossier" value={nomDossier} onChange={(e) => setNomDossier(e.target.value)} />
          <Bouton type="submit" disabled={!nomDossier.trim()}>Créer</Bouton></form>}>
        <div className="rg-table" role="table" aria-label="Dossiers">
          {dossiersReels.map((f) => {
            const plein = d.projets.some((p) => p.folderId === f.id) || d.dossiers.some((x) => x.parentId === f.id);
            return (
              <div key={f.id} className="rg-ligne" role="row" aria-label={f.name}>
                <Couleur valeur={f.color} libelle={`Couleur du dossier ${f.name}`} onChange={(c) => ecrire("dossiers", (v) => majElement<Dossier>(v, f.id, { color: c }))} />
                <Texte valeur={f.name || ""} libelle={`Nom du dossier ${f.name}`} onValider={(x) => ecrire("dossiers", (v) => majElement<Dossier>(v, f.id, { name: x }))} />
                <select className="rg-select" aria-label={`Parent du dossier ${f.name}`} value={f.parentId || ""} onChange={(e) => ecrire("dossiers", (v) => majElement<Dossier>(v, f.id, { parentId: e.target.value || null }))}>
                  <option value="">(racine)</option>{parentsPossibles(dossiersReels, f.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <span />
                <span />
                <Supprimer libelle={`le dossier ${f.name}`} refus={plein ? "non vide" : undefined} onConfirmer={() => ecrire("dossiers", (v) => retirerElement(v, f.id), `Dossier « ${f.name} » supprimé.`)} />
              </div>
            );
          })}
        </div>
      </Bloc>
    </>
  );
}

/* ---------------------------------------------------------- Statuts, types */
function StatutsTypes({ d, ecrire }: { d: Donnees; ecrire: Ecrire }) {
  const [nomS, setNomS] = useState(""); const [nomT, setNomT] = useState("");
  const projets = d.projets.filter((p) => !estProjetCalendrier(d.projets, p.id));
  const portee = (x: Statut | TypeTache, nom: CleJson, libelle: string) => (
    <select className="rg-select" aria-label={`Portée de ${libelle}`} value={x.projectId || ""} onChange={(e) => ecrire(nom, (v) => majElement<Statut>(v, x.id, { projectId: e.target.value || null }))}>
      <option value="">Tous les projets</option>{projets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
  );
  return (
    <>
      <Bloc titre="Statuts" aide="Un statut global sert à tous les projets ; un statut de projet n'apparaît que dans ce projet. Un statut utilisé ne peut pas être supprimé."
        actions={<form className="rg-ajout" onSubmit={(e) => { e.preventDefault(); const n = nomS.trim(); if (!n) return; setNomS(""); ecrire("statuts", (v) => ajouterElement<Statut>(v, { id: nouvelIdReglage(), name: n, color: "#7A8290", projectId: null }), `Statut « ${n} » créé.`); }}>
          <input className="rg-texte" aria-label="Nom du nouveau statut" placeholder="Nouveau statut" value={nomS} onChange={(e) => setNomS(e.target.value)} /><Bouton type="submit" disabled={!nomS.trim()}>Créer</Bouton></form>}>
        <div className="rg-table" role="table" aria-label="Statuts">
          {d.statuts.map((s) => { const n = usages(d.taches, d.archive, "statusId", s.id); return (
            <div key={s.id} className="rg-ligne" role="row" aria-label={s.name}>
              <Couleur valeur={s.color} libelle={`Couleur du statut ${s.name}`} onChange={(c) => ecrire("statuts", (v) => majElement<Statut>(v, s.id, { color: c }))} />
              <Texte valeur={s.name || ""} libelle={`Nom du statut ${s.name}`} onValider={(x) => ecrire("statuts", (v) => majElement<Statut>(v, s.id, { name: x }))} />
              {portee(s, "statuts", `statut ${s.name}`)}
              <span className="mono discret">{n} tâche{n > 1 ? "s" : ""}</span><span />
              <Supprimer libelle={`le statut ${s.name}`} refus={n ? "utilisé" : d.types.some((t) => t.restrictedStatusId === s.id) ? "imposé par un type" : undefined} onConfirmer={() => ecrire("statuts", (v) => retirerElement(v, s.id), `Statut « ${s.name} » supprimé.`)} />
            </div>); })}
        </div>
      </Bloc>
      <Bloc titre="Types de tâche" aide="Les types verrouillés (Tâches, Planning, Réunions, Information) ne se suppriment pas. Un type peut imposer un statut."
        actions={<form className="rg-ajout" onSubmit={(e) => { e.preventDefault(); const n = nomT.trim(); if (!n) return; setNomT(""); ecrire("types", (v) => ajouterElement<TypeTache>(v, { id: nouvelIdReglage(), name: n, color: "#7A8290", projectId: null }), `Type « ${n} » créé.`); }}>
          <input className="rg-texte" aria-label="Nom du nouveau type" placeholder="Nouveau type" value={nomT} onChange={(e) => setNomT(e.target.value)} /><Bouton type="submit" disabled={!nomT.trim()}>Créer</Bouton></form>}>
        <div className="rg-table" role="table" aria-label="Types de tâche">
          {d.types.map((t) => { const n = usages(d.taches, d.archive, "taskTypeId", t.id); return (
            <div key={t.id} className="rg-ligne" role="row" aria-label={t.name}>
              <Couleur valeur={t.color} libelle={`Couleur du type ${t.name}`} onChange={(c) => ecrire("types", (v) => majElement<TypeTache>(v, t.id, { color: c }))} />
              {t.locked ? <span className="rg-fixe">{t.name} <span className="discret">· verrouillé</span></span> : <Texte valeur={t.name || ""} libelle={`Nom du type ${t.name}`} onValider={(x) => ecrire("types", (v) => majElement<TypeTache>(v, t.id, { name: x }))} />}
              {t.locked ? <span /> : portee(t, "types", `type ${t.name}`)}
              <select className="rg-select" aria-label={`Statut imposé par ${t.name}`} value={t.restrictedStatusId || ""} disabled={t.locked} onChange={(e) => ecrire("types", (v) => majElement<TypeTache>(v, t.id, { restrictedStatusId: e.target.value || undefined }))}>
                <option value="">Aucun statut imposé</option>{d.statuts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <span className="mono discret">{n}</span>
              <Supprimer libelle={`le type ${t.name}`} refus={t.locked ? "verrouillé" : n ? "utilisé" : undefined} onConfirmer={() => ecrire("types", (v) => retirerElement(v, t.id), `Type « ${t.name} » supprimé.`)} />
            </div>); })}
        </div>
      </Bloc>
    </>
  );
}

/* ------------------------------------------------- Défauts, modèles */
function ChampsValeurs({ d, valeurs, onChange, prefixe }: { d: Donnees; valeurs: Record<string, unknown>; onChange: (k: string, v: string) => void; prefixe: string }) {
  const s = (k: string) => (typeof valeurs[k] === "string" ? (valeurs[k] as string) : "");
  const sel = (k: string, libelle: string, opts: [string, string][]) => (
    <label className="rg-champ"><span>{libelle}</span>
      <select className="rg-select" aria-label={`${prefixe} : ${libelle}`} value={s(k)} onChange={(e) => onChange(k, e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  );
  return (
    <div className="rg-valeurs">
      {sel("projectId", "Projet", [["", "—"], ...d.projets.filter((p) => !estProjetCalendrier(d.projets, p.id)).map((p): [string, string] => [p.id, p.name || p.id])])}
      {sel("taskTypeId", "Type", [["", "—"], ...d.types.map((t): [string, string] => [t.id, t.name || t.id])])}
      {sel("statusId", "Statut", [["", "—"], ...d.statuts.map((x): [string, string] => [x.id, x.name || x.id])])}
      {sel("assignee", "Responsable", [["", "—"], ...d.membres.map((m): [string, string] => [m.name, m.name])])}
      {sel("criticality", "Criticité", CRITICITES)}
    </div>
  );
}
function Creation({ d, ecrire }: { d: Donnees; ecrire: Ecrire }) {
  const [nom, setNom] = useState("");
  return (
    <>
      <Bloc titre="Valeurs par défaut" aide="Appliquées à chaque nouvelle tâche quand la saisie ne précise rien (projet, type, statut, responsable, criticité).">
        <ChampsValeurs d={d} prefixe="Défaut" valeurs={d.defauts as Record<string, unknown>} onChange={(k, v) => ecrire("defauts", (x) => majObjet(x, { [k]: v || undefined }))} />
      </Bloc>
      <Bloc titre="Modèles de tâche" aide="Un modèle crée une tâche déjà remplie : commande « Nouvelle tâche : modèle … » dans la palette (Ctrl K)."
        actions={<form className="rg-ajout" onSubmit={(e) => { e.preventDefault(); const n = nom.trim(); if (!n) return; setNom(""); ecrire("modeles", (v) => ajouterElement<Modele>(v, { id: nouvelIdReglage(), name: n, values: {} }), `Modèle « ${n} » créé.`); }}>
          <input className="rg-texte" aria-label="Nom du nouveau modèle" placeholder="Nouveau modèle" value={nom} onChange={(e) => setNom(e.target.value)} /><Bouton type="submit" disabled={!nom.trim()}>Créer</Bouton></form>}>
        {d.modeles.map((m) => (
          <div key={m.id} className="rg-modele" role="group" aria-label={`Modèle ${m.name}`}>
            <div className="rg-modele-t"><Texte valeur={m.name} libelle={`Nom du modèle ${m.name}`} onValider={(x) => ecrire("modeles", (v) => majElement<Modele>(v, m.id, { name: x }))} />
              <Supprimer libelle={`le modèle ${m.name}`} onConfirmer={() => ecrire("modeles", (v) => retirerElement(v, m.id), `Modèle « ${m.name} » supprimé.`)} /></div>
            <ChampsValeurs d={d} prefixe={m.name} valeurs={(m.values || {}) as Record<string, unknown>} onChange={(k, val) => ecrire("modeles", (v) => majElement<Modele>(v, m.id, { values: majObjet(m.values, { [k]: val || undefined }) }))} />
          </div>
        ))}
        {!d.modeles.length && <p className="discret">Aucun modèle.</p>}
      </Bloc>
    </>
  );
}

/* ------------------------------------------------------------ Habitudes */
function Habitudes({ d, ecrire }: { d: Donnees; ecrire: Ecrire }) {
  const [nomTheme, setNomTheme] = useState("");
  const [nouvelles, setNouvelles] = useState<Record<string, string>>({});
  return (
    <Bloc titre="Thèmes d'habitudes" aide="Un thème « un seul choix » ne garde qu'une habitude cochée par jour (comme Lieu). Une habitude chiffrée se saisit avec − / + entre un minimum et un maximum."
      actions={<form className="rg-ajout" onSubmit={(e) => { e.preventDefault(); const n = nomTheme.trim(); if (!n) return; setNomTheme(""); ecrire("themesHabitudes", (v) => ajouterElement(v, { id: nouvelIdReglage(), name: n, color: "#22B07D", selectionMode: "multi", habits: [] }), `Thème « ${n} » créé.`); }}>
        <input className="rg-texte" aria-label="Nom du nouveau thème" placeholder="Nouveau thème" value={nomTheme} onChange={(e) => setNomTheme(e.target.value)} /><Bouton type="submit" disabled={!nomTheme.trim()}>Créer</Bouton></form>}>
      {d.themesHabitudes.map((t) => (
        <div key={t.id} className="rg-theme" role="group" aria-label={`Thème ${t.name}`}>
          <div className="rg-ligne">
            <Couleur valeur={t.color} libelle={`Couleur du thème ${t.name}`} onChange={(c) => ecrire("themesHabitudes", (v) => majElement(v, t.id, { color: c }))} />
            <Texte valeur={t.name} libelle={`Nom du thème ${t.name}`} onValider={(x) => ecrire("themesHabitudes", (v) => majElement(v, t.id, { name: x }))} />
            <Segment etiquette={`Choix du thème ${t.name}`} valeur={t.selectionMode} onChange={(m) => ecrire("themesHabitudes", (v) => majElement(v, t.id, { selectionMode: m }))} options={[{ valeur: "multi", libelle: "Plusieurs" }, { valeur: "single", libelle: "Un seul choix" }]} />
            <span /><span />
            <Supprimer libelle={`le thème ${t.name}`} refus={t.habits.length ? "contient des habitudes" : undefined} onConfirmer={() => ecrire("themesHabitudes", (v) => retirerElement(v, t.id), `Thème « ${t.name} » supprimé.`)} />
          </div>
          {t.habits.map((h) => (
            <div key={h.id} className="rg-ligne rg-hab" role="row" aria-label={h.name}>
              <Couleur valeur={h.color} libelle={`Couleur de ${h.name}`} onChange={(c) => ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, { color: c }))} />
              <Texte valeur={h.name} libelle={`Nom de l'habitude ${h.name}`} onValider={(x) => ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, { name: x }))} />
              <select className="rg-select" aria-label={`Saisie de ${h.name}`} value={h.kind} onChange={(e) => ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, e.target.value === "numeric" ? { kind: "numeric", min: h.min || 0, max: h.max > 1 ? h.max : 10, step: h.step || 1 } : { kind: "check" }))}>
                <option value="check">Case à cocher</option><option value="numeric">Chiffrée</option></select>
              {h.kind === "numeric" ? (
                <span className="rg-bornes">
                  {(["min", "max", "step"] as const).map((k) => <label key={k}>{k === "min" ? "min" : k === "max" ? "max" : "pas"}<input type="number" className="rg-texte rg-nombre" aria-label={`${k} de ${h.name}`} defaultValue={k === "step" ? h.step ?? 1 : h[k]}
                    onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== (k === "step" ? h.step ?? 1 : h[k]) && (k !== "step" || n > 0)) ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, { [k]: n })); }} /></label>)}
                </span>
              ) : <span />}
              <span />
              <Supprimer libelle={`l'habitude ${h.name}`} onConfirmer={() => ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, null), `Habitude « ${h.name} » retirée (son historique reste dans le journal).`)} />
            </div>
          ))}
          <form className="rg-ajout rg-hab-ajout" onSubmit={(e) => { e.preventDefault(); const n = (nouvelles[t.id] || "").trim(); if (!n) return; setNouvelles({ ...nouvelles, [t.id]: "" });
            ecrire("themesHabitudes", (v) => ajouterHabitude(v, t.id, { id: nouvelIdReglage(), name: n, color: t.color, kind: "check", min: 0, max: 1 }), `Habitude « ${n} » ajoutée.`); }}>
            <input className="rg-texte" aria-label={`Nouvelle habitude dans ${t.name}`} placeholder="Nouvelle habitude" value={nouvelles[t.id] || ""} onChange={(e) => setNouvelles({ ...nouvelles, [t.id]: e.target.value })} />
            <Bouton type="submit" disabled={!(nouvelles[t.id] || "").trim()}>Ajouter</Bouton></form>
        </div>
      ))}
    </Bloc>
  );
}

/* ------------------------------------------------------------ Sauvegarde */
export function telecharger(nom: string, contenu: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a"); a.href = url; a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Sauvegarde() {
  const [copies, setCopies] = useState<CopieSecours[]>(() => copiesSecours());
  return (
    <Bloc titre="Copies de secours locales" aide="Avant chaque écriture, la valeur calculée est gardée dans ce navigateur, puis effacée dès que Firebase confirme. Une copie restante signale une écriture interrompue (onglet fermé, réseau, conflit répété) : télécharge-la avant de l'ignorer.">
      {copies.map((c) => (
        <div key={c.cle} className="rg-ligne rg-secours" role="row" aria-label={c.cle}>
          <span className="mono">{c.cle}</span><span className="discret">{new Date(c.le).toLocaleString("fr-FR")}</span><span className="discret">{c.erreur || "non confirmée"}</span>
          <Bouton onClick={() => telecharger(`${c.cle.replace(/[^\w-]/g, "_")}-${c.le.slice(0, 19).replace(/:/g, "-")}.json`, c.texte)}>Télécharger</Bouton>
          <Bouton variante="discret" onClick={() => { oublierSecours(c.cle); setCopies(copiesSecours()); }}>Ignorer</Bouton>
        </div>
      ))}
      {!copies.length && <p className="discret">Aucune écriture en attente : tout a été confirmé par Firebase.</p>}
      <Surtitre>Protection des écritures</Surtitre>
      <p className="discret rg-aide">Chaque écriture exige la révision lue. Si une autre session (ou Nexora actuel) a écrit entre-temps, Futur relit et rejoue la seule modification demandée, trois fois au plus, puis renonce sans rien écraser.</p>
    </Bloc>
  );
}
