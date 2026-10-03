// Réglages repris de Nexora (retour de Quentin du 03/10/2026 : « reprendre
// l'intégralité des réglages présents dans Nexora »). Ces rubriques écrivent les
// catalogues PARTAGÉS avec Nexora (nexora:projects, statuses, taskTypes…),
// élément par élément, avec updatedAt : Nexora fusionne ces clés élément par
// élément. Règles de Nexora conservées : statuts protégés, types verrouillés,
// suppression refusée quand l'élément sert encore, dossier vide seulement,
// renommage d'un utilisateur reporté sur les tâches. Écrans de départ : Nexora
// Futur (src/cockpit/Reglages.tsx, Ref #663), réécrits dans le langage d'Optim.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CleJson, Modele } from "../donnees/magasin";
import { CRITICITES, estProjetCalendrier, type Dossier, type Projet, type Statut, type Tache, type TypeTache } from "../donnees/modele";
import { ATELIERS_DEPART, capacite, equipesDe, normaliserEquipes, type Equipe, type MembreEquipe } from "../donnees/equipe";
import {
  SYMBOLES_JALON, TYPES_JALON_DEPART, avecDepart, calendriersSync, majCalendrierSync, objetOuVide, retirerAtelierDesAffectations, type TypeJalon,
  COULEURS_REGLAGES, ajouterElement, ajouterHabitude, deplacerElement, descendants, majElement, majHabitude, majObjet, nouvelIdReglage, parentsPossibles, renommerResponsable, retirerElement, statutProtege, usages,
} from "../donnees/reglages";
import { useOptim, useUi } from "./contexte";
import { ChoixRecherche } from "./ListeCoches";

type Ecrire = (nom: CleJson, f: (v: unknown) => unknown, message?: string) => Promise<void>;
function useEcrire(): Ecrire {
  const { ecrireJson } = useOptim();
  const { notifier } = useUi();
  return (nom, f, message) => ecrireJson(nom, f).then(() => { if (message) notifier({ texte: message }); }).catch((e) => notifier({ texte: `Réglage non enregistré : ${(e as Error).message}` }));
}

// Texte validé à la sortie du champ ou par Entrée (une écriture par modification).
function Texte({ valeur, libelle, onValider }: { valeur: string; libelle: string; onValider: (v: string) => void }) {
  const [v, setV] = useState(valeur); const [vu, setVu] = useState(valeur);
  if (valeur !== vu) { setVu(valeur); setV(valeur); }
  const valider = () => { const x = v.trim(); if (x && x !== valeur) onValider(x); else setV(valeur); };
  return <input className="ox-rg-t" aria-label={libelle} value={v} onChange={(e) => setV(e.target.value)} onBlur={valider}
    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { e.stopPropagation(); setV(valeur); (e.target as HTMLInputElement).blur(); } }} />;
}
// Couleur : aperçu local pendant le choix, UNE écriture à la validation (événement natif « change »),
// et non à chaque mouvement dans la palette (l'onChange de React suit l'événement « input »).
function Couleur({ valeur, libelle, onChange }: { valeur?: string; libelle: string; onChange: (c: string) => void }) {
  const v = /^#[0-9a-f]{6}$/i.test(valeur || "") ? (valeur as string) : "#7a8290";
  const ref = useRef<HTMLInputElement>(null), rappel = useRef(onChange), initiale = useRef(v);
  rappel.current = onChange; initiale.current = v;
  useEffect(() => { const el = ref.current; if (!el) return; const f = () => { if (el.value.toLowerCase() !== initiale.current.toLowerCase()) rappel.current(el.value); }; el.addEventListener("change", f); return () => el.removeEventListener("change", f); }, []);
  return <input ref={ref} key={v} type="color" className="ox-rg-c" aria-label={libelle} defaultValue={v} />;
}
// Suppression en deux temps (pas de boîte de dialogue native).
function Supprimer({ libelle, refus, onConfirmer }: { libelle: string; refus?: string; onConfirmer: () => void }) {
  const [arme, setArme] = useState(false);
  if (refus) return <span className="ox-rg-refus" title={refus}>{refus}</span>;
  return arme
    ? <span className="ox-rg-conf"><button type="button" className="hx-btn is-sm ox-rg-danger" onClick={() => { setArme(false); onConfirmer(); }} aria-label={`Confirmer : supprimer ${libelle}`}>Confirmer</button><button type="button" className="hx-more" onClick={() => setArme(false)}>Annuler</button></span>
    : <button type="button" className="hx-more is-plain" onClick={() => setArme(true)} aria-label={`Supprimer ${libelle}`}>Supprimer</button>;
}
function Ajout({ placeholder, libelle, onCreer, children }: { placeholder: string; libelle: string; onCreer: (nom: string) => void; children?: ReactNode }) {
  const [nom, setNom] = useState("");
  return <form className="ox-rg-ajout" onSubmit={(e) => { e.preventDefault(); const n = nom.trim(); if (!n) return; setNom(""); onCreer(n); }}>
    <input className="ox-rg-t" aria-label={libelle} placeholder={placeholder} value={nom} onChange={(e) => setNom(e.target.value)} />{children}
    <button type="submit" className="hx-btn is-sm is-primary" disabled={!nom.trim()}>Créer</button></form>;
}
const Bloc = ({ titre, aide, actions, children }: { titre: string; aide?: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="ox-rg-bloc" aria-label={titre}><header><h3 className="ox-sh">{titre}</h3>{actions}</header>{aide && <p className="hx-hint">{aide}</p>}{children}</section>
);
export const AvisPartage = () => <p className="ox-rg-avis">Réglages partagés avec Nexora : chaque changement est écrit tout de suite, élément par élément, et horodaté. Si Nexora est ouvert en même temps, il fusionne les modifications élément par élément (la plus récente gagne).</p>;

/* -------------------------------------------------------------- Projets */
export function OngletProjets() {
  const { d, executer } = useOptim();
  const { notifier } = useUi();
  const ecrire = useEcrire();
  const [dossierNouveau, setDossierNouveau] = useState("");
  const [reaffecter, setReaffecter] = useState<{ id: string; vers: string } | null>(null);
  const [plus, setPlus] = useState<string | null>(null);
  const majP = (id: string, patch: Partial<Projet>) => ecrire("projets", (v) => majElement<Projet>(v, id, patch));
  const dossiers = d.dossiers.filter((f) => f.id !== "folder-a-trier");
  const optsDossiers = dossiers.map((f) => ({ id: f.id, libelle: f.name || f.id }));
  const tri = [...d.projets].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const autres = (id: string) => tri.filter((p) => p.id !== id && !estProjetCalendrier(d.projets, p.id)).map((p) => ({ id: p.id, libelle: p.name || p.id, couleur: p.color }));
  const supprimerAvecReaffectation = async (p: Projet, vers: string) => {
    try {
      const champ = (t: Tache) => (t.projectId === p.id ? { ...t, projectId: vers, lastInteraction: new Date().toISOString() } : t);
      await executer((taches, archive) => ({ taches: taches.map(champ), archive: archive.map(champ) }));
      await ecrire("projets", (v) => retirerElement(v, p.id), `Projet « ${p.name} » supprimé ; ses tâches vont dans « ${d.projets.find((x) => x.id === vers)?.name || vers} ».`);
    } catch (e) { notifier({ texte: `Suppression refusée : ${(e as Error).message}` }); }
    setReaffecter(null);
  };
  return <>
    <AvisPartage />
    <Bloc titre="Projets" aide="Couleur, nom, dossier, priorité ; statuts et types masqués par projet. Un projet qui a des tâches se supprime en les réaffectant à un autre projet (comme dans Nexora)."
      actions={<Ajout placeholder="Nouveau projet" libelle="Nom du nouveau projet" onCreer={(n) => ecrire("projets", (v) => ajouterElement<Projet>(v, { id: nouvelIdReglage(), name: n, color: COULEURS_REGLAGES[d.projets.length % COULEURS_REGLAGES.length], folderId: dossierNouveau || "folder-a-trier", priority: "normal" }), `Projet « ${n} » créé.`)}>
        <ChoixRecherche libelle="Dossier du nouveau projet" vide="À trier" valeur={dossierNouveau} changer={setDossierNouveau} options={optsDossiers} /></Ajout>}>
      <div className="ox-rg-table" role="table" aria-label="Projets">
        {tri.map((p) => {
          const cal = estProjetCalendrier(d.projets, p.id), n = usages(d.taches, d.archive, "projectId", p.id);
          return <div key={p.id} className="ox-rg-det">
            <div className="ox-rg-l" role="row" aria-label={p.name}>
              <Couleur valeur={p.color} libelle={`Couleur de ${p.name}`} onChange={(c) => void majP(p.id, { color: c })} />
              {cal ? <span className="ox-rg-fixe">{p.name} <small>· calendrier synchronisé</small></span> : <Texte valeur={p.name || ""} libelle={`Nom de ${p.name}`} onValider={(x) => void majP(p.id, { name: x })} />}
              <ChoixRecherche libelle={`Dossier de ${p.name}`} vide="À trier" valeur={p.folderId && p.folderId !== "folder-a-trier" ? p.folderId : ""} changer={(v) => void majP(p.id, { folderId: v || "folder-a-trier" })} options={optsDossiers} />
              <span className="ox-rg-n">{n} tâche{n > 1 ? "s" : ""}</span>
              {cal ? <span className="ox-rg-refus">géré par la synchronisation</span>
                : n ? (reaffecter?.id === p.id
                  ? <span className="ox-rg-conf"><ChoixRecherche libelle="Réaffecter les tâches à" vide="Réaffecter à…" valeur={reaffecter.vers} changer={(v) => setReaffecter({ id: p.id, vers: v })} options={autres(p.id)} />
                    <button type="button" className="hx-btn is-sm ox-rg-danger" disabled={!reaffecter.vers} onClick={() => void supprimerAvecReaffectation(p, reaffecter.vers)}>Réaffecter et supprimer</button><button type="button" className="hx-more" onClick={() => setReaffecter(null)}>Annuler</button></span>
                  : <button type="button" className="hx-more is-plain" onClick={() => setReaffecter({ id: p.id, vers: "" })}>Supprimer…</button>)
                : <Supprimer libelle={p.name || p.id} onConfirmer={() => void ecrire("projets", (v) => retirerElement(v, p.id), `Projet « ${p.name} » supprimé.`)} />}
              <button type="button" className="hx-more is-plain" aria-expanded={plus === p.id} onClick={() => setPlus(plus === p.id ? null : p.id)}>{plus === p.id ? "Moins ▴" : "Plus ▾"}</button>
            </div>
            {plus === p.id && <div className="ox-rg-plus">
              <label>Priorité <select value={p.priority || "normal"} onChange={(e) => void majP(p.id, { priority: e.target.value })}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option></select></label>
              <label>Icône <input key={p.icon || ""} className="ox-rg-t is-court" maxLength={4} defaultValue={p.icon || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.icon || "")) void majP(p.id, { icon: v || undefined }); }} aria-label={`Icône de ${p.name}`} /></label>
              <div><b>Statuts proposés</b> <small className="hx-dim">les statuts protégés et ceux du projet restent toujours actifs</small>
                <div className="ox-rg-puces">{d.statuts.filter((s) => !s.projectId || s.projectId === p.id).map((s) => { const verrou = statutProtege(s) || s.projectId === p.id, off = (p.disabledStatusIds || []).includes(s.id);
                  return <label key={s.id} className={verrou ? "is-off" : ""}><input type="checkbox" checked={!off} disabled={verrou} onChange={() => void majP(p.id, { disabledStatusIds: off ? (p.disabledStatusIds || []).filter((x) => x !== s.id) : [...(p.disabledStatusIds || []), s.id] })} /><i style={{ background: s.color }} />{s.name}</label>; })}</div></div>
              <div><b>Types proposés</b> <small className="hx-dim">les types verrouillés et ceux du projet restent toujours actifs</small>
                <div className="ox-rg-puces">{d.types.filter((t) => !t.projectId || t.projectId === p.id).map((t) => { const verrou = !!t.locked || t.projectId === p.id, off = (p.disabledTaskTypeIds || []).includes(t.id);
                  return <label key={t.id} className={verrou ? "is-off" : ""}><input type="checkbox" checked={!off} disabled={verrou} onChange={() => void majP(p.id, { disabledTaskTypeIds: off ? (p.disabledTaskTypeIds || []).filter((x) => x !== t.id) : [...(p.disabledTaskTypeIds || []), t.id] })} /><i style={{ background: t.color }} />{t.name}</label>; })}</div></div>
            </div>}
          </div>;
        })}
      </div>
    </Bloc>
    <Bloc titre="Dossiers de projets" aide="Les dossiers s'imbriquent ; un dossier ne peut pas être rangé dans un de ses sous-dossiers. Seul un dossier vide se supprime. « À trier » est géré par Nexora."
      actions={<Ajout placeholder="Nouveau dossier" libelle="Nom du nouveau dossier" onCreer={(n) => ecrire("dossiers", (v) => ajouterElement<Dossier>(v, { id: nouvelIdReglage(), name: n, parentId: null, color: COULEURS_REGLAGES[dossiers.length % COULEURS_REGLAGES.length] }), `Dossier « ${n} » créé.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Dossiers">
        {dossiers.map((f) => { const plein = d.projets.some((p) => p.folderId === f.id) || d.dossiers.some((x) => x.parentId === f.id);
          return <div key={f.id} className="ox-rg-l" role="row" aria-label={f.name}>
            <Couleur valeur={f.color} libelle={`Couleur du dossier ${f.name}`} onChange={(c) => void ecrire("dossiers", (v) => majElement<Dossier>(v, f.id, { color: c }))} />
            <Texte valeur={f.name || ""} libelle={`Nom du dossier ${f.name}`} onValider={(x) => void ecrire("dossiers", (v) => majElement<Dossier>(v, f.id, { name: x }))} />
            <ChoixRecherche libelle={`Parent du dossier ${f.name}`} vide="(racine)" valeur={f.parentId || ""} changer={(v) => void ecrire("dossiers", (x) => majElement<Dossier>(x, f.id, { parentId: v || null }))} options={parentsPossibles(dossiers, f.id).map((x) => ({ id: x.id, libelle: x.name || x.id }))} />
            <span className="ox-rg-n">{d.projets.filter((p) => p.folderId === f.id).length} projet(s)</span>
            <Supprimer libelle={`le dossier ${f.name}`} refus={plein ? "non vide" : undefined} onConfirmer={() => void ecrire("dossiers", (v) => retirerElement(v, f.id), `Dossier « ${f.name} » supprimé.`)} />
          </div>; })}
        {!dossiers.length && <p className="hx-dim">Aucun dossier.</p>}
      </div>
    </Bloc>
  </>;
}

/* ------------------------------------------------------ Statuts et types */
export function OngletStatuts() {
  const { d } = useOptim();
  const ecrire = useEcrire();
  const projets = d.projets.filter((p) => !estProjetCalendrier(d.projets, p.id)).map((p) => ({ id: p.id, libelle: p.name || p.id, couleur: p.color }));
  const portee = (x: Statut | TypeTache, nom: CleJson, libelle: string, fige?: boolean) => fige
    ? <span className="ox-rg-fixe"><small>{x.projectId ? d.projets.find((p) => p.id === x.projectId)?.name : "Tous les projets"}</small></span>
    : <ChoixRecherche libelle={`Portée de ${libelle}`} vide="Tous les projets" valeur={x.projectId || ""} changer={(v) => void ecrire(nom, (y) => majElement<Statut>(y, x.id, { projectId: v || null }))} options={projets} />;
  const fleches = (nom: CleJson, id: string, i: number, n: number) => <span className="ox-rg-ord"><button type="button" aria-label="Monter" disabled={i === 0} onClick={() => void ecrire(nom, (v) => deplacerElement(v as { id: string }[], id, -1))}>↑</button><button type="button" aria-label="Descendre" disabled={i === n - 1} onClick={() => void ecrire(nom, (v) => deplacerElement(v as { id: string }[], id, 1))}>↓</button></span>;
  return <>
    <AvisPartage />
    <Bloc titre="Statuts" aide="Global ou propre à un projet. « Terminé » et « En cours » sont protégés (la détection des tâches terminées en dépend) : seules leur couleur et leur place changent. Un statut utilisé (tâches ou archive) ne se supprime pas."
      actions={<Ajout placeholder="Nouveau statut" libelle="Nom du nouveau statut" onCreer={(n) => ecrire("statuts", (v) => ajouterElement<Statut>(v, { id: nouvelIdReglage(), name: n, color: "#7A8290", icon: null, projectId: null }), `Statut « ${n} » créé.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Statuts">
        {d.statuts.map((s, i) => { const n = usages(d.taches, d.archive, "statusId", s.id), prot = statutProtege(s);
          return <div key={s.id} className="ox-rg-l" role="row" aria-label={s.name}>
            <Couleur valeur={s.color} libelle={`Couleur du statut ${s.name}`} onChange={(c) => void ecrire("statuts", (v) => majElement<Statut>(v, s.id, { color: c }))} />
            {prot ? <span className="ox-rg-fixe">{s.name} <small>· protégé</small></span> : <Texte valeur={s.name || ""} libelle={`Nom du statut ${s.name}`} onValider={(x) => void ecrire("statuts", (v) => majElement<Statut>(v, s.id, { name: x }))} />}
            {portee(s, "statuts", `statut ${s.name}`, prot)}
            <span className="ox-rg-n">{n} tâche{n > 1 ? "s" : ""}</span>
            {fleches("statuts", s.id, i, d.statuts.length)}
            <Supprimer libelle={`le statut ${s.name}`} refus={prot ? "protégé" : n ? "utilisé" : d.types.some((t) => t.restrictedStatusId === s.id) ? "imposé par un type" : undefined} onConfirmer={() => void ecrire("statuts", (v) => retirerElement(v, s.id), `Statut « ${s.name} » supprimé.`)} />
          </div>; })}
      </div>
    </Bloc>
    <Bloc titre="Types de tâche" aide="Les types verrouillés (Tâches, Planning, Réunions, Information) ne se renomment ni ne se suppriment. Un type peut imposer un statut."
      actions={<Ajout placeholder="Nouveau type" libelle="Nom du nouveau type" onCreer={(n) => ecrire("types", (v) => ajouterElement<TypeTache>(v, { id: nouvelIdReglage(), name: n, color: "#7A8290", projectId: null }), `Type « ${n} » créé.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Types de tâche">
        {d.types.map((t, i) => { const n = usages(d.taches, d.archive, "taskTypeId", t.id);
          return <div key={t.id} className="ox-rg-l" role="row" aria-label={t.name}>
            <Couleur valeur={t.color} libelle={`Couleur du type ${t.name}`} onChange={(c) => void ecrire("types", (v) => majElement<TypeTache>(v, t.id, { color: c }))} />
            {t.locked ? <span className="ox-rg-fixe">{t.name} <small>· verrouillé</small></span> : <Texte valeur={t.name || ""} libelle={`Nom du type ${t.name}`} onValider={(x) => void ecrire("types", (v) => majElement<TypeTache>(v, t.id, { name: x }))} />}
            {portee(t, "types", `type ${t.name}`, !!t.locked)}
            {t.locked ? <span className="ox-rg-fixe"><small>{t.restrictedStatusId ? `impose « ${d.statuts.find((s) => s.id === t.restrictedStatusId)?.name || t.restrictedStatusId} »` : ""}</small></span>
              : <ChoixRecherche libelle={`Statut imposé par ${t.name}`} vide="Aucun statut imposé" valeur={t.restrictedStatusId || ""} changer={(v) => void ecrire("types", (y) => majElement<TypeTache>(y, t.id, { restrictedStatusId: v || undefined }))} options={d.statuts.map((s) => ({ id: s.id, libelle: s.name || s.id, couleur: s.color }))} />}
            <span className="ox-rg-n">{n}</span>
            {fleches("types", t.id, i, d.types.length)}
            <Supprimer libelle={`le type ${t.name}`} refus={t.locked ? "verrouillé" : n ? "utilisé" : undefined} onConfirmer={() => void ecrire("types", (v) => retirerElement(v, t.id), `Type « ${t.name} » supprimé.`)} />
          </div>; })}
      </div>
    </Bloc>
  </>;
}

/* ---------------------------------------------- Valeurs par défaut, modèles */
function ChampsValeurs({ valeurs, onChange, prefixe }: { valeurs: Record<string, unknown>; onChange: (k: string, v: string) => void; prefixe: string }) {
  const { d } = useOptim();
  const s = (k: string) => (typeof valeurs[k] === "string" ? (valeurs[k] as string) : "");
  const projets = d.projets.filter((p) => !estProjetCalendrier(d.projets, p.id)).map((p) => ({ id: p.id, libelle: p.name || p.id, couleur: p.color }));
  const champ = (k: string, libelle: string, options: { id: string; libelle: string; couleur?: string }[]) => <label className="ox-rg-champ"><span>{libelle}</span><ChoixRecherche libelle={`${prefixe} : ${libelle}`} vide="—" valeur={s(k)} changer={(v) => onChange(k, v)} options={options} /></label>;
  return <div className="ox-rg-valeurs">
    {champ("projectId", "Projet", projets)}
    {champ("secondaryProjectId", "Second projet", projets)}
    {champ("taskTypeId", "Type", d.types.map((t) => ({ id: t.id, libelle: t.name || t.id, couleur: t.color })))}
    {champ("statusId", "Statut", d.statuts.map((x) => ({ id: x.id, libelle: x.name || x.id, couleur: x.color })))}
    {champ("assignee", "Responsable", d.membres.map((m) => ({ id: m.name, libelle: m.name })))}
    {champ("criticality", "Criticité", CRITICITES.map((c) => ({ id: c.id, libelle: c.nom, couleur: c.couleur })))}
    {champ("milestone", "Tâche ou jalon", [{ id: "task", libelle: "Tâche" }, { id: "milestone", libelle: "Jalon" }])}
  </div>;
}
export function OngletCreation() {
  const { d } = useOptim();
  const ecrire = useEcrire();
  return <>
    <AvisPartage />
    <Bloc titre="Valeurs par défaut des tâches" aide="Appliquées à chaque nouvelle tâche quand la saisie ne précise rien. « — » laisse le champ vide. Attention : Nexora ne fusionne pas cette clé ; si Nexora la modifie au même moment, il affiche un conflit au lieu d'écraser.">
      <ChampsValeurs prefixe="Défaut" valeurs={d.defauts as Record<string, unknown>} onChange={(k, v) => void ecrire("defauts", (x) => majObjet(x, { [k]: v || undefined, ...(k === "assignee" ? { assigneeDefaulted: true } : {}) }), "Valeur par défaut enregistrée.")} />
    </Bloc>
    <Bloc titre="Modèles de tâche" aide="Un modèle crée une tâche déjà remplie (clic droit sur « Nouvelle tâche » dans Nexora)."
      actions={<Ajout placeholder="Nouveau modèle" libelle="Nom du nouveau modèle" onCreer={(n) => ecrire("modeles", (v) => ajouterElement<Modele>(v, { id: nouvelIdReglage(), name: n, values: {} }), `Modèle « ${n} » créé.`)} />}>
      {d.modeles.map((m) => <div key={m.id} className="ox-rg-modele" role="group" aria-label={`Modèle ${m.name}`}>
        <div className="ox-rg-l"><Texte valeur={m.name} libelle={`Nom du modèle ${m.name}`} onValider={(x) => void ecrire("modeles", (v) => majElement<Modele>(v, m.id, { name: x }))} />
          <Supprimer libelle={`le modèle ${m.name}`} onConfirmer={() => void ecrire("modeles", (v) => retirerElement(v, m.id), `Modèle « ${m.name} » supprimé.`)} /></div>
        <ChampsValeurs prefixe={m.name} valeurs={(m.values || {}) as Record<string, unknown>} onChange={(k, val) => void ecrire("modeles", (v) => majElement<Modele>(v, m.id, { values: majObjet(m.values, { [k]: val || undefined }) }))} />
      </div>)}
      {!d.modeles.length && <p className="hx-dim">Aucun modèle.</p>}
    </Bloc>
  </>;
}

/* ------------------------------------------------------- Thèmes d'habitudes */
export function GestionHabitudes() {
  const { d } = useOptim();
  const ecrire = useEcrire();
  const [nouvelles, setNouvelles] = useState<Record<string, string>>({});
  return <Bloc titre="Thèmes et habitudes (Nexora)" aide="Un thème « un seul choix » ne garde qu'une habitude cochée par jour (comme Lieu). Une habitude chiffrée se saisit entre un minimum et un maximum, avec un pas. Retirer une habitude garde son historique dans le journal (choix prudent : rien n'est effacé) ; un thème ne se supprime que vide."
    actions={<Ajout placeholder="Nouveau thème" libelle="Nom du nouveau thème" onCreer={(n) => ecrire("themesHabitudes", (v) => ajouterElement(v, { id: nouvelIdReglage(), name: n, color: "#22B07D", selectionMode: "multi", habits: [] }), `Thème « ${n} » créé.`)} />}>
    {d.themesHabitudes.map((t, i) => <div key={t.id} className="ox-rg-theme" role="group" aria-label={`Thème ${t.name}`}>
      <div className="ox-rg-l">
        <Couleur valeur={t.color} libelle={`Couleur du thème ${t.name}`} onChange={(c) => void ecrire("themesHabitudes", (v) => majElement(v, t.id, { color: c }))} />
        <Texte valeur={t.name} libelle={`Nom du thème ${t.name}`} onValider={(x) => void ecrire("themesHabitudes", (v) => majElement(v, t.id, { name: x }))} />
        <div className="hx-seg is-xs" role="group" aria-label={`Choix du thème ${t.name}`}>{([["multi", "Plusieurs"], ["single", "Un seul choix"]] as const).map(([m, l]) => <button key={m} type="button" aria-pressed={t.selectionMode === m} onClick={() => void ecrire("themesHabitudes", (v) => majElement(v, t.id, { selectionMode: m }))}>{l}</button>)}</div>
        <span className="ox-rg-ord"><button type="button" aria-label="Monter" disabled={i === 0} onClick={() => void ecrire("themesHabitudes", (v) => deplacerElement(v as { id: string }[], t.id, -1))}>↑</button><button type="button" aria-label="Descendre" disabled={i === d.themesHabitudes.length - 1} onClick={() => void ecrire("themesHabitudes", (v) => deplacerElement(v as { id: string }[], t.id, 1))}>↓</button></span>
        <Supprimer libelle={`le thème ${t.name}`} refus={t.habits.length ? "contient des habitudes" : undefined} onConfirmer={() => void ecrire("themesHabitudes", (v) => retirerElement(v, t.id), `Thème « ${t.name} » supprimé.`)} />
      </div>
      {t.habits.map((h) => <div key={h.id} className="ox-rg-l is-hab" role="row" aria-label={h.name}>
        <Couleur valeur={h.color} libelle={`Couleur de ${h.name}`} onChange={(c) => void ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, { color: c }))} />
        <Texte valeur={h.name} libelle={`Nom de l'habitude ${h.name}`} onValider={(x) => void ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, { name: x }))} />
        <div className="hx-seg is-xs" role="group" aria-label={`Saisie de ${h.name}`}>{([["check", "Case"], ["numeric", "Chiffrée"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={h.kind === k} onClick={() => void ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, k === "numeric" ? { kind: "numeric", min: h.min || 0, max: h.max > (h.min || 0) ? h.max : (h.min || 0) + 10, step: h.step || 1 } : { kind: "check" }))}>{l}</button>)}</div>
        {h.kind === "numeric" ? <span className="ox-rg-bornes">{(["min", "max", "step"] as const).map((k) => <label key={k}>{k === "step" ? "pas" : k}<input key={`${k}${k === "step" ? h.step ?? 1 : h[k]}`} type="number" className="ox-rg-t is-nb" aria-label={`${k} de ${h.name}`} defaultValue={k === "step" ? h.step ?? 1 : h[k]}
          onBlur={(e) => { const n = Number(e.target.value), avant = k === "step" ? h.step ?? 1 : h[k]; if (!Number.isFinite(n) || n === avant) return; if (k === "step" && n <= 0) return; if (k === "max" && n <= h.min) return; if (k === "min" && n >= h.max) return; void ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, { [k]: n })); }} /></label>)}</span> : <span />}
        <Supprimer libelle={`l'habitude ${h.name}`} onConfirmer={() => void ecrire("themesHabitudes", (v) => majHabitude(v, t.id, h.id, null), `Habitude « ${h.name} » retirée (son historique reste dans le journal).`)} />
      </div>)}
      <form className="ox-rg-ajout is-hab" onSubmit={(e) => { e.preventDefault(); const n = (nouvelles[t.id] || "").trim(); if (!n) return; setNouvelles({ ...nouvelles, [t.id]: "" });
        void ecrire("themesHabitudes", (v) => ajouterHabitude(v, t.id, { id: nouvelIdReglage(), name: n, color: t.color, kind: "check", min: 0, max: 10 }), `Habitude « ${n} » ajoutée.`); }}>
        <input className="ox-rg-t" aria-label={`Nouvelle habitude dans ${t.name}`} placeholder="Nouvelle habitude" value={nouvelles[t.id] || ""} onChange={(e) => setNouvelles({ ...nouvelles, [t.id]: e.target.value })} />
        <button type="submit" className="hx-btn is-sm" disabled={!(nouvelles[t.id] || "").trim()}>Ajouter</button></form>
    </div>)}
  </Bloc>;
}

/* -------------------------------------------------- Utilisateurs, équipes */
export function OngletEquipe() {
  const { d, executer } = useOptim();
  const { notifier } = useUi();
  const ecrire = useEcrire();
  const equipes = normaliserEquipes(d.equipesBrutes);
  const majM = (id: string, patch: Partial<MembreEquipe>) => ecrire("membres", (v) => majElement<MembreEquipe>(v, id, patch));
  // Renommer : le nom sert de clé aux tâches (responsable) ; réécrit d'abord les tâches, puis l'utilisateur.
  const renommer = async (m: MembreEquipe, nom: string) => {
    if (d.membresEquipe.some((x) => x.name === nom)) { notifier({ texte: `« ${nom} » existe déjà.` }); return; }
    try {
      await executer((taches, archive) => ({ taches: renommerResponsable(taches, m.name, nom), archive: renommerResponsable(archive, m.name, nom) }));
      await ecrire("membres", (v) => majElement<MembreEquipe>(v, m.id, { name: nom }), `« ${m.name} » renommé en « ${nom} » (tâches mises à jour).`);
    } catch (e) { notifier({ texte: `Renommage refusé : ${(e as Error).message}` }); }
  };
  return <>
    <AvisPartage />
    <Bloc titre="Utilisateurs" aide="Renommer un utilisateur met à jour le responsable de ses tâches et de l'archive (comme Nexora). Capacité : nombre de tâches par jour au-delà duquel la charge passe en rouge. Un utilisateur qui a des tâches (même archivées) ou qui dirige une équipe ne se supprime pas."
      actions={<Ajout placeholder="Prénom Nom" libelle="Nom du nouvel utilisateur" onCreer={(n) => d.membresEquipe.some((m) => m.name === n) ? notifier({ texte: `« ${n} » existe déjà.` }) : ecrire("membres", (v) => ajouterElement<MembreEquipe>(v, { id: nouvelIdReglage(), name: n, color: COULEURS_REGLAGES[d.membresEquipe.length % COULEURS_REGLAGES.length], capacityPerDay: 1, teamIds: [], teamId: null } as MembreEquipe), `« ${n} » ajouté.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Utilisateurs">
        {d.membresEquipe.map((m) => { const n = d.taches.filter((t) => t.assignee === m.name).length, nArch = d.archive.filter((t) => t.assignee === m.name).length, chef = equipes.filter((t) => t.leadName === m.name).length;
          return <div key={m.id} className="ox-rg-l" role="row" aria-label={m.name}>
            <Couleur valeur={m.color} libelle={`Couleur de ${m.name}`} onChange={(c) => void majM(m.id, { color: c })} />
            <Texte valeur={m.name} libelle={`Nom de ${m.name}`} onValider={(x) => void renommer(m, x)} />
            <ChoixRecherche libelle={`Équipe de ${m.name}`} vide="Sans équipe" valeur={equipesDe(m)[0] || ""} options={equipes.map((t) => ({ id: t.id, libelle: t.name, couleur: t.color }))}
              changer={(v) => void majM(m.id, v ? { teamIds: [v, ...equipesDe(m).slice(1).filter((x) => x !== v)], teamId: v } : { teamIds: [], teamId: null })} />
            <label className="ox-rg-bornes">cap.<input key={capacite(m.capacityPerDay)} type="number" min={1} step={1} className="ox-rg-t is-nb" aria-label={`Capacité de ${m.name}`} defaultValue={capacite(m.capacityPerDay)}
              onBlur={(e) => { const x = Number(e.target.value); if (Number.isFinite(x) && x > 0 && x !== capacite(m.capacityPerDay)) void majM(m.id, { capacityPerDay: x }); }} /></label>
            <span className="ox-rg-n">{n} tâche{n > 1 ? "s" : ""}</span>
            <Supprimer libelle={m.name} refus={n ? "a des tâches" : nArch ? "a des tâches archivées" : chef ? "responsable d'équipe" : undefined} onConfirmer={() => void ecrire("membres", (v) => retirerElement(v, m.id), `« ${m.name} » retiré.`)} />
          </div>; })}
      </div>
    </Bloc>
    <Bloc titre="Équipes" aide="Une équipe peut dépendre d'une autre ; une équipe qui a des membres ou des sous-équipes ne se supprime pas."
      actions={<Ajout placeholder="Nouvelle équipe" libelle="Nom de la nouvelle équipe" onCreer={(n) => ecrire("equipes", (v) => ajouterElement(v, { id: nouvelIdReglage(), name: n, color: COULEURS_REGLAGES[equipes.length % COULEURS_REGLAGES.length], parentTeamId: "", parentLinkType: "hierarchique" }), `Équipe « ${n} » créée.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Équipes">
        {equipes.map((t: Equipe) => { const n = d.membresEquipe.filter((m) => equipesDe(m).includes(t.id)).length; const sous = descendants(equipes.map((x) => ({ id: x.id, parentId: x.parentTeamId || null })), t.id);
          return <div key={t.id} className="ox-rg-l" role="row" aria-label={t.name}>
            <Couleur valeur={t.color} libelle={`Couleur de l'équipe ${t.name}`} onChange={(c) => void ecrire("equipes", (v) => majElement(v, t.id, { color: c }))} />
            <Texte valeur={t.name} libelle={`Nom de l'équipe ${t.name}`} onValider={(x) => void ecrire("equipes", (v) => majElement(v, t.id, { name: x }))} />
            <ChoixRecherche libelle={`Équipe parente de ${t.name}`} vide="(racine)" valeur={t.parentTeamId || ""} changer={(v) => void ecrire("equipes", (x) => majElement(x, t.id, { parentTeamId: v }))} options={equipes.filter((x) => !sous.has(x.id)).map((x) => ({ id: x.id, libelle: x.name, couleur: x.color }))} />
            <ChoixRecherche libelle={`Responsable de ${t.name}`} vide="Sans responsable" valeur={t.leadName || ""} changer={(v) => void ecrire("equipes", (x) => majElement(x, t.id, { leadName: v }))} options={d.membresEquipe.map((m) => ({ id: m.name, libelle: m.name }))} />
            <span className="ox-rg-n">{n} membre{n > 1 ? "s" : ""}</span>
            <Supprimer libelle={`l'équipe ${t.name}`} refus={n ? "a des membres" : equipes.some((x) => x.parentTeamId === t.id) ? "a des sous-équipes" : undefined} onConfirmer={() => void ecrire("equipes", (v) => retirerElement(v, t.id), `Équipe « ${t.name} » supprimée.`)} />
          </div>; })}
        {!equipes.length && <p className="hx-dim">Aucune équipe.</p>}
      </div>
    </Bloc>
  </>;
}

/* -------------------------------------------------------- Objectifs sport */
export function OngletObjectifs() {
  const { d } = useOptim();
  const ecrire = useEcrire();
  const o = d.objectifsSport;
  const brut = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const annuels = (v: unknown) => (Array.isArray(brut(v).yearlyKm) ? (brut(v).yearlyKm as { id: string }[]) : []);
  const arrondi = (x: number) => Math.round(x * 100) / 100;
  return <>
    <AvisPartage />
    <Bloc titre="Objectifs sport" aide="Heures par semaine et kilomètres par an (par groupe de sports) ; l'onglet Sport montre l'avancement. Une valeur vide ou nulle retire l'objectif.">
      <label className="ox-rg-champ"><span>Heures par semaine</span>
        <input key={String(o.weeklyHours)} type="number" min={0} step={0.5} className="ox-rg-t is-nb" aria-label="Heures par semaine" defaultValue={o.weeklyHours ?? ""}
          onBlur={(e) => { const x = e.target.value === "" ? null : Number(e.target.value); const v = x !== null && Number.isFinite(x) && x > 0 ? arrondi(x) : null; if (v !== o.weeklyHours) void ecrire("objectifsSport", (y) => ({ ...brut(y), weeklyHours: v }), "Objectif hebdomadaire enregistré."); }} /></label>
      <h4 className="ox-rg-sous">Kilomètres par an</h4>
      {o.yearlyKm.map((g) => <div key={g.id} className="ox-rg-l" role="row" aria-label={g.label || g.id}>
        <Texte valeur={g.label || ""} libelle={`Libellé de l'objectif ${g.label}`} onValider={(x) => void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: majElement(annuels(v), g.id, { label: x }) }))} />
        <input key={g.sports.join("|")} className="ox-rg-t" aria-label={`Sports de ${g.label}`} placeholder="Tous les sports (ou : Vélo, Course à pied)" defaultValue={g.sports.join(", ")}
          onBlur={(e) => { const sp = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); if (sp.join("|") !== g.sports.join("|")) void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: majElement(annuels(v), g.id, { sports: sp }) })); }} />
        <label className="ox-rg-bornes">km<input key={String(g.km)} type="number" min={0} className="ox-rg-t is-nb" aria-label={`Kilomètres de ${g.label}`} defaultValue={g.km ?? ""}
          onBlur={(e) => { const x = e.target.value.trim() === "" ? null : Number(e.target.value); const km = x !== null && Number.isFinite(x) && x > 0 ? arrondi(x) : null; if (km !== (g.km ?? null)) void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: majElement(annuels(v), g.id, { km }) })); }} /></label>
        <Supprimer libelle={`l'objectif ${g.label}`} onConfirmer={() => void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: retirerElement(annuels(v), g.id) }))} />
      </div>)}
      <Ajout placeholder="Nouvel objectif annuel (ex. Vélo)" libelle="Libellé du nouvel objectif annuel" onCreer={(n) => ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: ajouterElement(annuels(v), { id: nouvelIdReglage(), label: n, sports: [], km: 1000 }) }), `Objectif « ${n} » créé.`)} />
    </Bloc>
  </>;
}

/* ------------------------------------------------- Types de jalon, ateliers */
// Symbole d'un type de jalon : tracé SVG 24×24 de Nexora (plein ou creux).
export function SymboleJalon({ cle, couleur, taille = 18 }: { cle: string; couleur: string; taille?: number }) {
  const s = SYMBOLES_JALON.find((x) => x.key === cle) || SYMBOLES_JALON[0];
  return <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={s.d} fill={s.hollow ? "none" : couleur} stroke={s.hollow ? couleur : "none"} strokeWidth={s.hollow ? 2.4 : 0} fillRule="evenodd" /></svg>;
}
function ChoixSymbole({ valeur, couleur, libelle, changer }: { valeur: string; couleur: string; libelle: string; changer: (k: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  return <span className="hx-fchip-w ox-rg-symb"><button type="button" className="ox-cr-b" aria-label={libelle} aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}><SymboleJalon cle={valeur} couleur={couleur} /> ▾</button>
    {ouvert && <div className="hx-pop is-f ox-lc-pop ox-rg-symbs" role="listbox" aria-label={libelle}>{SYMBOLES_JALON.map((s) => <button key={s.key} type="button" role="option" aria-selected={s.key === valeur} title={s.label} aria-label={s.label} className={s.key === valeur ? "is-sel" : ""} onClick={() => { changer(s.key); setOuvert(false); }}><SymboleJalon cle={s.key} couleur={couleur} taille={20} /></button>)}</div>}</span>;
}
export function OngletJalons() {
  const { d } = useOptim();
  const ecrire = useEcrire();
  const jalons = (f: (v: TypeJalon[]) => unknown) => (v: unknown) => f(avecDepart<TypeJalon>(v, TYPES_JALON_DEPART));
  const ateliersEcr = (f: (v: { id: string }[]) => unknown) => (v: unknown) => f(avecDepart(v, ATELIERS_DEPART));
  const utilisations = (id: string) => d.affectations.filter((a) => a.workshops.includes(id)).length;
  const supprimerAtelier = async (w: { id: string; name: string }) => {
    if (utilisations(w.id)) await ecrire("affectations", (v) => retirerAtelierDesAffectations(v, w.id));
    await ecrire("ateliers", ateliersEcr((v) => retirerElement(v, w.id)), `Atelier « ${w.name} » supprimé.`);
  };
  return <>
    <AvisPartage />
    <Bloc titre="Types de jalon" aide="Nom, symbole et couleur, comme dans Nexora. Le premier type sert « par défaut » ; il en reste toujours au moins un. Un jalon dont le type est supprimé retombe sur le premier type."
      actions={<Ajout placeholder="Nouveau type de jalon" libelle="Nom du nouveau type de jalon" onCreer={(n) => ecrire("typesJalon", jalons((v) => ajouterElement<TypeJalon>(v, { id: nouvelIdReglage(), name: n, symbol: "diamond", color: COULEURS_REGLAGES[d.typesJalon.length % COULEURS_REGLAGES.length] })), `Type de jalon « ${n} » créé.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Types de jalon">
        {d.typesJalon.map((t, i) => <div key={t.id} className="ox-rg-l" role="row" aria-label={t.name}>
          <Couleur valeur={t.color} libelle={`Couleur du type de jalon ${t.name}`} onChange={(c) => void ecrire("typesJalon", jalons((v) => majElement<TypeJalon>(v, t.id, { color: c })))} />
          <ChoixSymbole valeur={t.symbol} couleur={t.color} libelle={`Symbole de ${t.name}`} changer={(k) => void ecrire("typesJalon", jalons((v) => majElement<TypeJalon>(v, t.id, { symbol: k })))} />
          <Texte valeur={t.name} libelle={`Nom du type de jalon ${t.name}`} onValider={(x) => void ecrire("typesJalon", jalons((v) => majElement<TypeJalon>(v, t.id, { name: x })))} />
          <span className="ox-rg-n">{i === 0 ? "par défaut" : ""}</span>
          <span className="ox-rg-ord"><button type="button" aria-label="Monter" disabled={i === 0} onClick={() => void ecrire("typesJalon", jalons((v) => deplacerElement(v, t.id, -1)))}>↑</button><button type="button" aria-label="Descendre" disabled={i === d.typesJalon.length - 1} onClick={() => void ecrire("typesJalon", jalons((v) => deplacerElement(v, t.id, 1)))}>↓</button></span>
          <Supprimer libelle={`le type de jalon ${t.name}`} refus={d.typesJalon.length <= 1 ? "dernier type" : undefined} onConfirmer={() => void ecrire("typesJalon", jalons((v) => retirerElement(v, t.id)), `Type de jalon « ${t.name} » supprimé.`)} />
        </div>)}
      </div>
    </Bloc>
    <Bloc titre="Ateliers" aide="Postes de la charge du personnel (Usine, Bureau, Chantier…). Supprimer un atelier utilisé le retire aussi des affectations (comme Nexora) ; il reste toujours au moins un atelier."
      actions={<Ajout placeholder="Nouvel atelier" libelle="Nom du nouvel atelier" onCreer={(n) => ecrire("ateliers", ateliersEcr((v) => ajouterElement(v, { id: `ws-${nouvelIdReglage()}`, name: n, color: COULEURS_REGLAGES[d.ateliers.length % COULEURS_REGLAGES.length], custom: true })), `Atelier « ${n} » créé.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Ateliers">
        {d.ateliers.map((w, i) => { const n = utilisations(w.id);
          return <div key={w.id} className="ox-rg-l" role="row" aria-label={w.name}>
            <Couleur valeur={w.color} libelle={`Couleur de l'atelier ${w.name}`} onChange={(c) => void ecrire("ateliers", ateliersEcr((v) => majElement(v, w.id, { color: c })))} />
            <Texte valeur={w.name} libelle={`Nom de l'atelier ${w.name}`} onValider={(x) => void ecrire("ateliers", ateliersEcr((v) => majElement(v, w.id, { name: x })))} />
            <span className="ox-rg-n">{n} jour{n > 1 ? "s" : ""} affecté{n > 1 ? "s" : ""}</span>
            <span className="ox-rg-ord"><button type="button" aria-label="Monter" disabled={i === 0} onClick={() => void ecrire("ateliers", ateliersEcr((v) => deplacerElement(v, w.id, -1)))}>↑</button><button type="button" aria-label="Descendre" disabled={i === d.ateliers.length - 1} onClick={() => void ecrire("ateliers", ateliersEcr((v) => deplacerElement(v, w.id, 1)))}>↓</button></span>
            <Supprimer libelle={`l'atelier ${w.name}${n ? ` (retiré de ${n} affectation${n > 1 ? "s" : ""})` : ""}`} refus={d.ateliers.length <= 1 ? "dernier atelier" : undefined} onConfirmer={() => void supprimerAtelier(w)} />
          </div>; })}
      </div>
    </Bloc>
  </>;
}

/* --------------------------------------- Google Calendar, calendriers synchronisés */
export function OngletIntegrations() {
  const { d } = useOptim();
  const ecrire = useEcrire();
  const g = d.gcal, cals = Array.isArray(g.calendars) ? (g.calendars as { id: string; name?: string; color?: string; customName?: string }[]) : [];
  const majG = (patch: Record<string, unknown>, message?: string) => ecrire("gcal", (v) => majObjet(v, patch), message);
  const majCal = (id: string, patch: Record<string, unknown>) => ecrire("gcal", (v) => { const o = objetOuVide(v); return { ...o, calendars: majElement(Array.isArray(o.calendars) ? o.calendars : [], id, patch) }; });
  const sync = calendriersSync(d.calendriersSync), zone = typeof d.calendriersSync.zone === "string" ? d.calendriersSync.zone : "A";
  const nombre = (k: string, defaut: number) => (typeof g[k] === "number" ? (g[k] as number) : defaut);
  return <>
    <AvisPartage />
    <Bloc titre="Google Calendar" aide="Calendriers importés, nom affiché et fenêtre d'import. La liste des calendriers et l'import eux-mêmes viennent de la connexion Google (aujourd'hui assurée par Nexora et l'assistant) : on règle ici leur affichage.">
      <div className="ox-rg-valeurs">
        <label className="ox-rg-champ"><span>Jours passés importés</span><input key={nombre("daysPast", 30)} type="number" min={0} className="ox-rg-t is-nb" defaultValue={nombre("daysPast", 30)} onBlur={(e) => { const x = Math.round(Number(e.target.value)); if (Number.isFinite(x) && x >= 0 && x !== nombre("daysPast", 30)) void majG({ daysPast: x }, "Fenêtre d'import enregistrée."); }} aria-label="Jours passés importés" /></label>
        <label className="ox-rg-champ"><span>Jours à venir importés</span><input key={nombre("daysFuture", 365)} type="number" min={0} className="ox-rg-t is-nb" defaultValue={nombre("daysFuture", 365)} onBlur={(e) => { const x = Math.round(Number(e.target.value)); if (Number.isFinite(x) && x >= 0 && x !== nombre("daysFuture", 365)) void majG({ daysFuture: x }, "Fenêtre d'import enregistrée."); }} aria-label="Jours à venir importés" /></label>
        <label className="ox-rg-champ ox-rg-case"><span>Événements passés</span><span><input type="checkbox" checked={g.autoCompletePastEvents === true} onChange={(e) => void majG({ autoCompletePastEvents: e.target.checked }, e.target.checked ? "Les événements passés seront marqués « Terminé »." : "Marquage automatique désactivé.")} /> marquer « Terminé »</span></label>
      </div>
      <div className="ox-rg-table" role="table" aria-label="Calendriers Google">
        {cals.map((c) => <div key={c.id} className="ox-rg-l" role="row" aria-label={c.name || c.id}>
          <i className="ox-rg-pastille" style={{ background: c.color || "#7a8290" }} />
          <span className="ox-rg-fixe" title={c.id}>{c.name || c.id}</span>
          <Texte valeur={c.customName || ""} libelle={`Nom affiché de ${c.name || c.id}`} onValider={(x) => void majCal(c.id, { customName: x })} />
          {c.customName && <button type="button" className="hx-more is-plain" onClick={() => void majCal(c.id, { customName: undefined })}>Nom d'origine</button>}
        </div>)}
        {!cals.length && <p className="hx-dim">Aucun calendrier Google configuré.</p>}
      </div>
    </Bloc>
    <Bloc titre="Calendriers synchronisés" aide="Jours fériés, vacances scolaires, changements d'heure, calendrier fiscal : chacun alimente un projet. La synchronisation elle-même est faite par Nexora ; ses réglages sont partagés.">
      <div className="ox-rg-valeurs">
        <label className="ox-rg-champ"><span>Zone scolaire</span><div className="hx-seg is-xs" role="group" aria-label="Zone scolaire">{["A", "B", "C"].map((z) => <button key={z} type="button" aria-pressed={zone === z} onClick={() => void ecrire("calendriersSync", (v) => ({ ...objetOuVide(v), zone: z }), `Zone ${z} enregistrée.`)}>{z}</button>)}</div></label>
        <label className="ox-rg-champ"><span>Département</span><input key={String(d.calendriersSync.department)} className="ox-rg-t is-nb" maxLength={3} defaultValue={typeof d.calendriersSync.department === "string" ? d.calendriersSync.department : "69"} onBlur={(e) => { const x = e.target.value.trim(); if (x && x !== d.calendriersSync.department) void ecrire("calendriersSync", (v) => ({ ...objetOuVide(v), department: x }), "Département enregistré."); }} aria-label="Département" /></label>
      </div>
      <div className="ox-rg-table" role="table" aria-label="Calendriers synchronisés">
        {sync.map((c) => <div key={c.id} className="ox-rg-l" role="row" aria-label={c.label}>
          <label className="ox-rg-case"><input type="checkbox" checked={c.enabled} onChange={(e) => void ecrire("calendriersSync", (v) => majCalendrierSync(v, c.id, { enabled: e.target.checked }))} aria-label={`Activer ${c.label}`} /></label>
          <Couleur valeur={c.color} libelle={`Couleur de ${c.label}`} onChange={(x) => void ecrire("calendriersSync", (v) => majCalendrierSync(v, c.id, { color: x }))} />
          <span className="ox-rg-fixe" title={c.description}>{c.label}</span>
          <Texte valeur={c.projectName} libelle={`Projet de ${c.label}`} onValider={(x) => void ecrire("calendriersSync", (v) => majCalendrierSync(v, c.id, { projectName: x }))} />
          <label className="ox-rg-case"><input type="checkbox" checked={c.showAsMetaBlock} onChange={(e) => void ecrire("calendriersSync", (v) => majCalendrierSync(v, c.id, { showAsMetaBlock: e.target.checked }))} /> bloc temporel</label>
        </div>)}
      </div>
      {typeof d.calendriersSync.lastSyncAt === "string" && <p className="hx-hint">Dernière synchronisation : {new Date(d.calendriersSync.lastSyncAt).toLocaleString("fr-FR")}.</p>}
    </Bloc>
  </>;
}

/* ----------------------------------------------------- Méta-blocs temporels */
export function OngletMetaBlocs() {
  const { d, jour } = useOptim();
  const ecrire = useEcrire();
  const maj = (id: string, patch: Record<string, unknown>) => ecrire("metaBlocs", (v) => majElement(v, id, patch));
  return <>
    <AvisPartage />
    <Bloc titre="Méta-blocs temporels" aide="Périodes affichées en fond des frises de Nexora (phases, congés, campagnes) : titre, dates, couleur, bordure."
      actions={<Ajout placeholder="Nouveau bloc (ex. Phase 1)" libelle="Titre du nouveau bloc" onCreer={(n) => ecrire("metaBlocs", (v) => ajouterElement(v, { id: nouvelIdReglage(), title: n, startDate: jour, endDate: jour, kind: "phase", color: COULEURS_REGLAGES[d.metaBlocs.length % COULEURS_REGLAGES.length], borderStyle: "solid", dashboardIds: null }), `Bloc « ${n} » créé.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Méta-blocs">
        {d.metaBlocs.map((b) => <div key={b.id} className="ox-rg-l" role="row" aria-label={b.title}>
          <Couleur valeur={b.color} libelle={`Couleur de ${b.title}`} onChange={(c) => void maj(b.id, { color: c })} />
          <Texte valeur={b.title} libelle={`Titre de ${b.title}`} onValider={(x) => void maj(b.id, { title: x })} />
          <label className="ox-rg-bornes">du<input key={b.startDate} type="date" className="ox-rg-t is-date" defaultValue={b.startDate} onBlur={(e) => { const x = e.target.value; if (x && x !== b.startDate) void maj(b.id, { startDate: x, ...(b.endDate && x > b.endDate ? { endDate: x } : {}) }); }} aria-label={`Début de ${b.title}`} /></label>
          <label className="ox-rg-bornes">au<input key={b.endDate} type="date" className="ox-rg-t is-date" defaultValue={b.endDate} min={b.startDate || undefined} onBlur={(e) => { const x = e.target.value; if (x && x !== b.endDate && (!b.startDate || x >= b.startDate)) void maj(b.id, { endDate: x }); }} aria-label={`Fin de ${b.title}`} /></label>
          <div className="hx-seg is-xs" role="group" aria-label={`Bordure de ${b.title}`}>{([["solid", "Pleine"], ["dashed", "Tirets"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={b.borderStyle === k} onClick={() => void maj(b.id, { borderStyle: k })}>{l}</button>)}</div>
          <button type="button" className="hx-more is-plain" onClick={() => void ecrire("metaBlocs", (v) => { const l = Array.isArray(v) ? v : []; const o = l.find((x) => x?.id === b.id); return o ? [...l, { ...o, id: nouvelIdReglage(), title: `${b.title} (copie)` }] : l; }, `Bloc « ${b.title} » dupliqué.`)}>Dupliquer</button>
          <Supprimer libelle={`le bloc ${b.title}`} onConfirmer={() => void ecrire("metaBlocs", (v) => retirerElement(v, b.id), `Bloc « ${b.title} » supprimé.`)} />
        </div>)}
        {!d.metaBlocs.length && <p className="hx-dim">Aucun méta-bloc.</p>}
      </div>
    </Bloc>
  </>;
}
