// Palette de commandes (Ref #655) : créer, chercher, aller à, agir.
import { useEffect, useMemo, useRef, useState } from "react";
import { analyserSaisie, normaliser as norm, type Saisie } from "../donnees/saisie";
import { CRITICITES, type Catalogues, type Tache } from "../donnees/modele";
import { Kbd } from "../composants";

export interface Commande { id: string; libelle: string; detail?: string; raccourci?: string; executer: () => void; }
type Element =
  | { genre: "creer"; saisie: Saisie }
  | { genre: "tache"; t: Tache; archivee: boolean }
  | { genre: "projet"; id: string; nom: string; couleur?: string }
  | { genre: "commande"; c: Commande };

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Props {
  ouverte: boolean; modeInitial: "tout" | "creer"; texteInitial?: string; onFermer: () => void;
  cat: Catalogues; taches: Tache[]; archive: Tache[]; aujourdhui: string; commandes: Commande[];
  onCreer: (s: Saisie, ouvrir: boolean) => void; onOuvrirTache: (t: Tache, archivee: boolean) => void; onAllerProjet: (id: string) => void;
}

export function Palette({ ouverte, modeInitial, texteInitial = "", onFermer, cat, taches, archive, aujourdhui, commandes, onCreer, onOuvrirTache, onAllerProjet }: Props) {
  const [q, setQ] = useState(texteInitial);
  const [i, setI] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  // Montée neuve à chaque ouverture (clé côté Cockpit) : champ vide dès le
  // premier rendu, rien n'est effacé après coup pendant que l'on tape.

  const ctx = useMemo(() => ({
    aujourdhui, personnes: cat.membres.map((m) => ({ id: m.id, nom: m.name })), projets: cat.projets.map((p) => ({ id: p.id, nom: p.name || "" })),
    types: cat.types.map((t) => ({ id: t.id, nom: t.name || "" })), criticites: CRITICITES.map((c) => ({ valeur: c.id, alias: c.id === "urgent" ? ["urgent", "u", "!"] : c.id === "moyen" ? ["moyen", "m"] : ["bas", "b"] })),
  }), [cat, aujourdhui]);

  const elements = useMemo<Element[]>(() => {
    const brut = q.trim();
    const cmd = brut.startsWith(">");
    const mots = sansAccents(cmd ? brut.slice(1) : brut).split(/\s+/).filter(Boolean);
    const ok = (texte: string) => mots.every((m) => sansAccents(texte).includes(m));
    const r: Element[] = [];
    if (brut && !cmd) r.push({ genre: "creer", saisie: analyserSaisie(brut, ctx) });
    if (modeInitial === "creer" && !brut) return r;
    if (!cmd && mots.length) {
      const foin = (t: Tache) => [t.title, cat.projets.find((p) => p.id === t.projectId)?.name || "Sans projet", cat.statuts.find((s) => s.id === t.statusId)?.name || "Sans statut", t.desc, t.assignee].join(" ");
      const trouvees = [...taches.map((t) => ({ t, archivee: false })), ...archive.map((t) => ({ t, archivee: true }))].filter(({ t }) => ok(foin(t)))
        .sort((a, b) => (a.t.end || "9999-12-31").localeCompare(b.t.end || "9999-12-31") || (a.t.title || "").localeCompare(b.t.title || "")).slice(0, 8);
      trouvees.forEach((x) => r.push({ genre: "tache", ...x }));
      cat.projets.filter((p) => ok(p.name || "")).slice(0, 5).forEach((p) => r.push({ genre: "projet", id: p.id, nom: p.name || "", couleur: p.color }));
    }
    commandes.filter((c) => !mots.length || ok(`${c.libelle} ${c.detail || ""}`)).slice(0, cmd || !mots.length ? 20 : 5).forEach((c) => r.push({ genre: "commande", c }));
    return r;
  }, [q, ctx, taches, archive, cat, commandes, modeInitial]);

  useEffect(() => { setI((x) => Math.min(x, Math.max(0, elements.length - 1))); }, [elements.length]);
  useEffect(() => { liste.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" }); }, [i]);

  if (!ouverte) return null;
  const lancer = (e: Element, maj = false) => {
    if (e.genre === "creer") { if (!e.saisie.titre) return; onCreer(e.saisie, maj); }
    else if (e.genre === "tache") onOuvrirTache(e.t, e.archivee);
    else if (e.genre === "projet") onAllerProjet(e.id);
    else e.c.executer();
    onFermer();
  };
  const titreSection = (k: number) => { const g = elements[k].genre; return k === 0 || elements[k - 1].genre !== g ? ({ creer: "Créer", tache: "Tâches", projet: "Aller au projet", commande: "Commandes" } as const)[g] : null; };
  const creation = elements[0]?.genre === "creer" ? elements[0].saisie : null;

  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Palette de commandes">
        <div className="palette-saisie">
          <span className="mono discret" aria-hidden="true">›</span>
          <input ref={champ} autoFocus aria-label="Saisie de la palette" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} role="combobox" aria-expanded="true" aria-controls="palette-liste" aria-activedescendant={`pal-${i}`}
            placeholder={modeInitial === "creer" ? "Nouvelle tâche : « Relancer BC vendredi @Vincent #CTEX6 !urgent »" : "Créer, chercher une tâche, aller à un projet… (> pour les commandes)"}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, elements.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              else if (e.key === "Enter" && elements[i]) { e.preventDefault(); lancer(elements[i], e.shiftKey); }
              else if (e.key === "Escape") { e.preventDefault(); onFermer(); }
            }} />
        </div>
        {creation && (
          <div className="palette-analyse" aria-live="polite">
            <span className="puce">titre <b>{creation.titre || "—"}</b></span>
            {creation.jetons.map((j, k) => <span key={k} className="puce">{({ date: "date", heure: "heure", personne: "responsable", projet: "projet", type: "type", criticite: "criticité" } as const)[j.genre]} <b>{j.libelle}</b></span>)}
            {creation.start && creation.end && creation.start !== creation.end && <span className="puce">du <b>{creation.start.split("-").reverse().join("/")}</b> au <b>{creation.end.split("-").reverse().join("/")}</b></span>}
            {creation.inconnus.map((x) => <span key={x} className="puce puce-inconnu">non reconnu <b>{x}</b></span>)}
          </div>
        )}
        <ul className="palette-liste" id="palette-liste" role="listbox" ref={liste}>
          {elements.map((e, k) => (
            <li key={k} role="presentation">
              {titreSection(k) && <div className="palette-section surtitre">{titreSection(k)}</div>}
              <div id={`pal-${k}`} data-i={k} role="option" aria-selected={k === i} className={`palette-el ${k === i ? "actif" : ""}`} onMouseMove={() => setI(k)} onClick={() => lancer(e)}>
                {e.genre === "creer" && <><span>Créer « {e.saisie.titre || "…"} »</span><span className="marge-auto palette-k"><Kbd>↵</Kbd><span className="discret">ouvrir</span><Kbd>⇧↵</Kbd></span></>}
                {e.genre === "tache" && <><span className="point" style={{ background: cat.projets.find((p) => p.id === e.t.projectId)?.color || "var(--encre3)" }} /><span>{e.t.title}</span><span className="discret">{cat.projets.find((p) => p.id === e.t.projectId)?.name}</span>{e.archivee && <span className="etiquette mono">archivée</span>}<span className="marge-auto mono discret">{e.t.end?.split("-").reverse().slice(0, 2).join("/")}</span></>}
                {e.genre === "projet" && <><span className="point" style={{ background: e.couleur || "var(--encre3)" }} /><span>{e.nom}</span></>}
                {e.genre === "commande" && <><span>{e.c.libelle}</span>{e.c.detail && <span className="discret">{e.c.detail}</span>}{e.c.raccourci && <span className="marge-auto"><Kbd>{e.c.raccourci}</Kbd></span>}</>}
              </div>
            </li>
          ))}
          {!elements.length && <li className="palette-vide discret">{modeInitial === "creer" ? "Tape le titre de la tâche." : "Aucun résultat."}</li>}
        </ul>
        <div className="palette-pied mono discret"><span>@personne #projet !criticité /type · dates : demain, vendredi, +3j, 9/10, 9 oct · heures : 14h, 14h-15h30</span></div>
      </div>
    </div>
  );
}
export { norm };
