// Réglages repris de Nexora (retour de Quentin du 03/10/2026 : « reprendre
// l'intégralité des réglages présents dans Nexora »). Ces rubriques écrivent les
// catalogues PARTAGÉS avec Nexora (nexora:projects, statuses, taskTypes…),
// élément par élément, avec updatedAt : Nexora fusionne ces clés élément par
// élément. Règles de Nexora conservées : statuts protégés, types verrouillés,
// suppression refusée quand l'élément sert encore, dossier vide seulement,
// renommage d'un utilisateur reporté sur les tâches. Écrans de départ : Nexora
// Futur (src/cockpit/Reglages.tsx, Ref #663), réécrits dans le langage d'Optim.
import { useState, type ReactNode } from "react";
import type { CleJson, Modele } from "../donnees/magasin";
import { CRITICITES, estProjetCalendrier, type Dossier, type Projet, type Statut, type Tache, type TypeTache } from "../donnees/modele";
import { capacite, equipesDe, normaliserEquipes, type Equipe, type MembreEquipe } from "../donnees/equipe";
import {
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
const Couleur = ({ valeur, libelle, onChange }: { valeur?: string; libelle: string; onChange: (c: string) => void }) =>
  <input type="color" className="ox-rg-c" aria-label={libelle} value={/^#[0-9a-f]{6}$/i.test(valeur || "") ? valeur : "#7a8290"} onChange={(e) => onChange(e.target.value)} />;
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
              <label>Icône <input className="ox-rg-t is-court" maxLength={4} defaultValue={p.icon || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.icon || "")) void majP(p.id, { icon: v || undefined }); }} aria-label={`Icône de ${p.name}`} /></label>
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
    <Bloc titre="Valeurs par défaut des tâches" aide="Appliquées à chaque nouvelle tâche quand la saisie ne précise rien. « — » laisse le champ vide.">
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
        {h.kind === "numeric" ? <span className="ox-rg-bornes">{(["min", "max", "step"] as const).map((k) => <label key={k}>{k === "step" ? "pas" : k}<input type="number" className="ox-rg-t is-nb" aria-label={`${k} de ${h.name}`} defaultValue={k === "step" ? h.step ?? 1 : h[k]}
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
    <Bloc titre="Utilisateurs" aide="Renommer un utilisateur met à jour le responsable de ses tâches (comme Nexora). Capacité : nombre de tâches par jour au-delà duquel la charge passe en rouge. Un utilisateur qui a des tâches ne se supprime pas."
      actions={<Ajout placeholder="Prénom Nom" libelle="Nom du nouvel utilisateur" onCreer={(n) => d.membresEquipe.some((m) => m.name === n) ? notifier({ texte: `« ${n} » existe déjà.` }) : ecrire("membres", (v) => ajouterElement<MembreEquipe>(v, { id: nouvelIdReglage(), name: n, color: COULEURS_REGLAGES[d.membresEquipe.length % COULEURS_REGLAGES.length], capacityPerDay: 1, teamIds: [], teamId: null } as MembreEquipe), `« ${n} » ajouté.`)} />}>
      <div className="ox-rg-table" role="table" aria-label="Utilisateurs">
        {d.membresEquipe.map((m) => { const n = d.taches.filter((t) => t.assignee === m.name).length;
          return <div key={m.id} className="ox-rg-l" role="row" aria-label={m.name}>
            <Couleur valeur={m.color} libelle={`Couleur de ${m.name}`} onChange={(c) => void majM(m.id, { color: c })} />
            <Texte valeur={m.name} libelle={`Nom de ${m.name}`} onValider={(x) => void renommer(m, x)} />
            <ChoixRecherche libelle={`Équipe de ${m.name}`} vide="Sans équipe" valeur={equipesDe(m)[0] || ""} options={equipes.map((t) => ({ id: t.id, libelle: t.name, couleur: t.color }))}
              changer={(v) => void majM(m.id, v ? { teamIds: [v, ...equipesDe(m).slice(1).filter((x) => x !== v)], teamId: v } : { teamIds: [], teamId: null })} />
            <label className="ox-rg-bornes">cap.<input type="number" min={1} step={1} className="ox-rg-t is-nb" aria-label={`Capacité de ${m.name}`} defaultValue={capacite(m.capacityPerDay)}
              onBlur={(e) => { const x = Number(e.target.value); if (Number.isFinite(x) && x > 0 && x !== capacite(m.capacityPerDay)) void majM(m.id, { capacityPerDay: x }); }} /></label>
            <span className="ox-rg-n">{n} tâche{n > 1 ? "s" : ""}</span>
            <Supprimer libelle={m.name} refus={n ? "a des tâches" : undefined} onConfirmer={() => void ecrire("membres", (v) => retirerElement(v, m.id), `« ${m.name} » retiré.`)} />
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
        <input type="number" min={0} step={0.5} className="ox-rg-t is-nb" aria-label="Heures par semaine" defaultValue={o.weeklyHours ?? ""}
          onBlur={(e) => { const x = e.target.value === "" ? null : Number(e.target.value); const v = x !== null && Number.isFinite(x) && x > 0 ? arrondi(x) : null; if (v !== o.weeklyHours) void ecrire("objectifsSport", (y) => ({ ...brut(y), weeklyHours: v }), "Objectif hebdomadaire enregistré."); }} /></label>
      <h4 className="ox-rg-sous">Kilomètres par an</h4>
      {o.yearlyKm.map((g) => <div key={g.id} className="ox-rg-l" role="row" aria-label={g.label || g.id}>
        <Texte valeur={g.label || ""} libelle={`Libellé de l'objectif ${g.label}`} onValider={(x) => void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: majElement(annuels(v), g.id, { label: x }) }))} />
        <input className="ox-rg-t" aria-label={`Sports de ${g.label}`} placeholder="Tous les sports (ou : Vélo, Course à pied)" defaultValue={g.sports.join(", ")}
          onBlur={(e) => { const sp = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); if (sp.join("|") !== g.sports.join("|")) void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: majElement(annuels(v), g.id, { sports: sp }) })); }} />
        <label className="ox-rg-bornes">km<input type="number" min={0} className="ox-rg-t is-nb" aria-label={`Kilomètres de ${g.label}`} defaultValue={g.km ?? ""}
          onBlur={(e) => { const x = Number(e.target.value); if (Number.isFinite(x) && x !== g.km) void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: majElement(annuels(v), g.id, { km: x > 0 ? arrondi(x) : null }) })); }} /></label>
        <Supprimer libelle={`l'objectif ${g.label}`} onConfirmer={() => void ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: retirerElement(annuels(v), g.id) }))} />
      </div>)}
      <Ajout placeholder="Nouvel objectif annuel (ex. Vélo)" libelle="Libellé du nouvel objectif annuel" onCreer={(n) => ecrire("objectifsSport", (v) => ({ ...brut(v), yearlyKm: ajouterElement(annuels(v), { id: nouvelIdReglage(), label: n, sports: [], km: 1000 }) }), `Objectif « ${n} » créé.`)} />
    </Bloc>
  </>;
}
