// Inspecteur latéral (Ref #655) : la fiche de tâche, sans modale.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CRITICITES, ecartJours, estProjetCalendrier, estReunion, estTerminee, nouvelId, statutImpose, statutsDuProjet, typesDuProjet, type Catalogues, type ElementCheck, type PieceJointe, type Tache } from "../donnees/modele";
import { Bouton, Etat, Kbd, Segment, Surtitre } from "../composants";

interface Props {
  t: Tache; cat: Catalogues; taches: Tache[]; aujourdhui: string;
  onPatch: (patch: Partial<Tache>) => void; onBasculer: () => void; onArchiver: () => void; onDupliquer: () => void; onFermer: () => void;
  onOuvrir: (id: string) => void;
}

function Ligne({ libelle, children, id }: { libelle: string; children: ReactNode; id?: string }) {
  return <div className="insp-ligne"><label className="insp-libelle" htmlFor={id}>{libelle}</label><div className="insp-valeur">{children}</div></div>;
}

// Champ texte enregistré à la sortie (ou Entrée pour une ligne).
function Texte({ id, valeur, onValider, multiligne, placeholder, lignes = 4 }: { id?: string; valeur: string; onValider: (v: string) => void; multiligne?: boolean; placeholder?: string; lignes?: number }) {
  const [v, setV] = useState(valeur);
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setV(valeur); }, [valeur]);
  const valider = () => { focus.current = false; if (v !== valeur) onValider(v); };
  const props = { id, value: v, placeholder, onFocus: () => { focus.current = true; }, onBlur: valider, onChange: (e: { target: { value: string } }) => setV(e.target.value) };
  return multiligne
    ? <textarea {...props} rows={lignes} className="insp-texte" />
    : <input {...props} className="insp-champ" onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(valeur); } }} />;
}

const taille = (o: number) => (o > 1024 * 1024 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.ceil(o / 1024)} Ko`);

export function Inspecteur({ t, cat, taches, aujourdhui, onPatch, onBasculer, onArchiver, onDupliquer, onFermer, onOuvrir }: Props) {
  const calendrier = estProjetCalendrier(cat.projets, t.projectId);
  const impose = statutImpose(cat.types, cat.statuts, t.taskTypeId);
  const fini = estTerminee(t, cat.statuts);
  const statuts = statutsDuProjet(cat.statuts, cat.projets, t.projectId, t.statusId);
  const types = typesDuProjet(cat.types, cat.projets, t.projectId, t.taskTypeId);
  const membres = cat.membres.map((m) => m.name);
  const [nouvelleCase, setNouvelleCase] = useState("");
  const [lien, setLien] = useState({ name: "", url: "" });
  const [ajoutDep, setAjoutDep] = useState("");
  const [erreurFichier, setErreurFichier] = useState("");
  const dis = calendrier;
  const checklist = t.checklist || [];
  const deps = (t.dependsOn || []).map((id) => taches.find((x) => x.id === id)).filter(Boolean) as Tache[];
  const bloquee = deps.some((d) => !estTerminee(d, cat.statuts));
  const conflit = deps.some((d) => d.end && t.start && d.end > t.start);
  const ref = t.comparison?.referenceEnd;
  const ecart = ref && t.end ? ecartJours(ref, t.end) : null;
  const pj = t.attachments || [];

  const majCase = (id: string, p: Partial<ElementCheck>) => onPatch({ checklist: checklist.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const ajouterFichier = (f: File) => {
    setErreurFichier("");
    if (f.size > 350 * 1024) { setErreurFichier(`« ${f.name} » dépasse 350 Ko : ajoute plutôt un lien Drive.`); return; }
    const lecteur = new FileReader();
    lecteur.onload = () => onPatch({ attachments: [...pj, { id: nouvelId(), type: "file", name: f.name, url: String(lecteur.result), mime: f.type, size: f.size, addedAt: aujourdhui }] });
    lecteur.readAsDataURL(f);
  };
  const ouvrirFichier = (p: PieceJointe) => {
    if (!p.url) return;
    fetch(p.url).then((r) => r.blob()).then((b) => { const u = URL.createObjectURL(b); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60_000); }).catch(() => setErreurFichier("Impossible d'ouvrir ce fichier."));
  };

  return (
    <aside className="insp" aria-label={`Fiche : ${t.title}`}>
      <div className="insp-tete">
        <Surtitre>{cat.projets.find((p) => p.id === t.projectId)?.name || "Sans projet"} · {cat.types.find((x) => x.id === t.taskTypeId)?.name || "Tâche"}</Surtitre>
        <button type="button" className="btn btn-discret insp-fermer" onClick={onFermer} aria-label="Fermer la fiche">Fermer <Kbd>Échap</Kbd></button>
      </div>
      {calendrier && <p className="insp-alerte"><Etat ton="info">Événement Google Calendar</Etat> Il se modifie dans Google Calendar.</p>}
      <Texte valeur={t.title || ""} onValider={(v) => v.trim() && onPatch({ title: v.trim() })} placeholder="Titre" />
      <div className="insp-etats">
        {fini ? <Etat ton="ok">Terminée</Etat> : t.end && t.end < aujourdhui ? <Etat ton="crit">{`${ecartJours(t.end, aujourdhui)} j de retard`}</Etat> : null}
        {bloquee && <Etat ton="alerte">Bloquée par une dépendance</Etat>}
        {conflit && <Etat ton="crit">Conflit de dépendance</Etat>}
      </div>

      <div className="insp-grille">
        <Ligne libelle="Statut" id="i-statut">
          <select id="i-statut" value={t.statusId || ""} disabled={dis || !!impose} onChange={(e) => onPatch({ statusId: e.target.value })}>
            {statuts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>{impose && <span className="discret"> imposé par le type</span>}
        </Ligne>
        <Ligne libelle="Type" id="i-type"><select id="i-type" value={t.taskTypeId || ""} disabled={dis} onChange={(e) => onPatch({ taskTypeId: e.target.value })}>{types.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Ligne>
        <Ligne libelle="Projet" id="i-projet"><select id="i-projet" value={t.projectId || ""} disabled={dis} onChange={(e) => onPatch({ projectId: e.target.value })}>{cat.projets.filter((p) => !p.gcalSource && !p.syncedCalendarSource).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Ligne>
        <Ligne libelle="Projet secondaire" id="i-proj2"><select id="i-proj2" value={t.secondaryProjectId || ""} disabled={dis} onChange={(e) => onPatch({ secondaryProjectId: e.target.value })}><option value="">Aucun</option>{cat.projets.filter((p) => p.id !== t.projectId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Ligne>
        <Ligne libelle="Criticité">
          <Segment etiquette="Criticité" valeur={(t.criticality || "aucune") as string} onChange={(v) => !dis && onPatch({ criticality: v === "aucune" ? null : (v as Tache["criticality"]) })}
            options={[{ valeur: "aucune", libelle: "—" }, ...CRITICITES.map((c) => ({ valeur: c.id as string, libelle: c.nom }))]} />
        </Ligne>
        <Ligne libelle="Responsable" id="i-resp">
          <select id="i-resp" value={t.assignee || ""} disabled={dis} onChange={(e) => onPatch({ assignee: e.target.value })}>
            <option value="">Aucun</option>{[...new Set([...membres, ...(t.assignee && !membres.includes(t.assignee) ? [t.assignee] : [])])].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Ligne>
        <Ligne libelle="Début" id="i-debut"><input id="i-debut" type="date" value={t.start || ""} disabled={dis} onChange={(e) => e.target.value && onPatch({ start: e.target.value })} />
          <input type="time" aria-label="Heure de début" value={t.startTime || ""} disabled={dis} onChange={(e) => onPatch({ startTime: e.target.value })} /></Ligne>
        <Ligne libelle="Fin" id="i-fin"><input id="i-fin" type="date" value={t.end || ""} disabled={dis || !!t.milestone} onChange={(e) => e.target.value && onPatch({ end: e.target.value })} />
          <input type="time" aria-label="Heure de fin" value={t.endTime || ""} disabled={dis || !t.startTime} onChange={(e) => onPatch({ endTime: e.target.value })} /></Ligne>
        <Ligne libelle="Options">
          <label className="insp-case"><input type="checkbox" checked={!!t.milestone} disabled={dis} onChange={(e) => onPatch({ milestone: e.target.checked })} /> Jalon</label>
          <label className="insp-case"><input type="checkbox" checked={t.focus === true} disabled={dis} onChange={(e) => onPatch({ focus: e.target.checked })} /> Focus</label>
        </Ligne>
        <Ligne libelle="Avancement" id="i-av"><input id="i-av" type="range" min={0} max={100} step={5} value={Number(t.progress ?? 0)} disabled={dis} onChange={(e) => onPatch({ progress: Number(e.target.value) })} /><span className="mono">{Number(t.progress ?? 0)} %</span></Ligne>
        <Ligne libelle="Récurrence" id="i-rec">
          <select id="i-rec" value={t.recurrence?.unit || ""} disabled={dis} onChange={(e) => onPatch({ recurrence: e.target.value ? { unit: e.target.value as "day" | "week" | "month", interval: t.recurrence?.interval || 1 } : null })}>
            <option value="">Aucune</option><option value="day">Jours</option><option value="week">Semaines</option><option value="month">Mois (30 j)</option>
          </select>
          {t.recurrence && <><span className="discret">tous les</span><input type="number" min={1} max={365} aria-label="Intervalle" className="insp-nombre" value={t.recurrence.interval} onChange={(e) => onPatch({ recurrence: { ...t.recurrence!, interval: Math.max(1, Number(e.target.value) || 1) } })} /></>}
        </Ligne>
      </div>

      <section className="insp-section"><Surtitre>Sous-tâches {checklist.filter((c) => c.done).length}/{checklist.length}</Surtitre>
        {checklist.map((c) => (
          <div key={c.id} className="insp-case-ligne">
            <input type="checkbox" checked={c.done} aria-label={`Fait : ${c.text}`} onChange={(e) => majCase(c.id, { done: e.target.checked })} />
            <Texte valeur={c.text} onValider={(v) => majCase(c.id, { text: v })} />
            <button type="button" className="btn btn-discret" aria-label={`Supprimer ${c.text}`} onClick={() => onPatch({ checklist: checklist.filter((x) => x.id !== c.id) })}>×</button>
          </div>
        ))}
        <input className="insp-champ" placeholder="Ajouter une sous-tâche puis Entrée" value={nouvelleCase} onChange={(e) => setNouvelleCase(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && nouvelleCase.trim()) { onPatch({ checklist: [...checklist, { id: nouvelId(), text: nouvelleCase.trim(), done: false, end: t.end, statusId: null, assignee: "" }] }); setNouvelleCase(""); } }} />
      </section>

      <section className="insp-section"><Surtitre>Description</Surtitre>
        <Texte multiligne valeur={t.desc || ""} onValider={(v) => onPatch({ desc: v })} placeholder="Markdown" lignes={5} />
      </section>
      {estReunion(t, cat.types) && (
        <section className="insp-section"><Surtitre>Compte rendu</Surtitre>
          <Texte multiligne valeur={t.meetingReport || ""} onValider={(v) => onPatch({ meetingReport: v })} placeholder="Décisions, actions, présents…" lignes={6} />
        </section>
      )}

      <section className="insp-section"><Surtitre>Dépend de</Surtitre>
        {deps.map((d) => (
          <div key={d.id} className="insp-dep">
            <button type="button" className="ligne-lien" onClick={() => onOuvrir(d.id)}>{d.title}</button>
            <span className="mono discret">fin {d.end?.split("-").reverse().join("/")}</span>
            {!estTerminee(d, cat.statuts) && <Etat ton="alerte">ouverte</Etat>}
            <button type="button" className="btn btn-discret" aria-label={`Retirer la dépendance ${d.title}`} onClick={() => onPatch({ dependsOn: (t.dependsOn || []).filter((x) => x !== d.id) })}>×</button>
          </div>
        ))}
        <select aria-label="Ajouter une dépendance" value={ajoutDep} disabled={dis} onChange={(e) => { const v = e.target.value; if (v) onPatch({ dependsOn: [...(t.dependsOn || []), v] }); setAjoutDep(""); }}>
          <option value="">Ajouter une dépendance…</option>
          {taches.filter((x) => x.id !== t.id && !(t.dependsOn || []).includes(x.id) && !(x.dependsOn || []).includes(t.id)).sort((a, b) => Number(b.projectId === t.projectId) - Number(a.projectId === t.projectId) || (a.title || "").localeCompare(b.title || ""))
            .map((x) => <option key={x.id} value={x.id}>{x.title}{x.projectId !== t.projectId ? ` · ${cat.projets.find((p) => p.id === x.projectId)?.name || ""}` : ""}</option>)}
        </select>
      </section>

      <section className="insp-section"><Surtitre>Pièces jointes</Surtitre>
        {pj.map((p) => (
          <div key={p.id} className="insp-dep">
            {p.type === "link" ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.name || p.url}</a> : <button type="button" className="ligne-lien" onClick={() => ouvrirFichier(p)}>{p.name}</button>}
            <span className="mono discret">{p.type === "file" && p.size ? taille(p.size) : p.provider === "google-drive" ? "Drive" : "lien"}</span>
            <button type="button" className="btn btn-discret" aria-label={`Retirer ${p.name}`} onClick={() => onPatch({ attachments: pj.filter((x) => x.id !== p.id) })}>×</button>
          </div>
        ))}
        <div className="insp-lien">
          <input className="insp-champ" placeholder="Nom" value={lien.name} onChange={(e) => setLien({ ...lien, name: e.target.value })} />
          <input className="insp-champ" placeholder="https://…" value={lien.url} onChange={(e) => setLien({ ...lien, url: e.target.value })} />
          <Bouton disabled={!/^https?:\/\//.test(lien.url)} onClick={() => { onPatch({ attachments: [...pj, { id: nouvelId(), type: "link", name: lien.name || lien.url, url: lien.url, provider: /drive\.google|docs\.google/.test(lien.url) ? "google-drive" : undefined, addedAt: aujourdhui }] }); setLien({ name: "", url: "" }); }}>Lier</Bouton>
        </div>
        <label className="insp-case"><input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) ajouterFichier(f); e.target.value = ""; }} /> Fichier (350 Ko max.)</label>
        {erreurFichier && <p className="crit" role="alert">{erreurFichier}</p>}
      </section>

      <section className="insp-section insp-infos mono">
        {ref && <div>Référence : fin {ref.split("-").reverse().join("/")}{ecart !== null && ecart !== 0 ? ` · écart ${ecart > 0 ? "+" : ""}${ecart} j` : ""}</div>}
        {t.lastInteraction && <div>Dernière modification : {new Date(t.lastInteraction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</div>}
        {t.completedAt && <div>Terminée le : {new Date(t.completedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</div>}
        {t.sourceSender && <div>Origine : e-mail de {t.sourceSender}</div>}
        <div>id {t.id}</div>
      </section>

      <div className="insp-actions">
        <Bouton variante="principal" raccourci="E" onClick={onBasculer} disabled={dis || !!impose}>{fini ? "Rouvrir" : "Marquer terminée"}</Bouton>
        <Bouton onClick={onDupliquer} disabled={dis}>Dupliquer</Bouton>
        <Bouton variante="danger" raccourci="X" onClick={onArchiver} disabled={dis}>Archiver</Bouton>
      </div>
    </aside>
  );
}
