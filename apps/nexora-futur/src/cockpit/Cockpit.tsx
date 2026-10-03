// Cockpit (Ref #655) : liste + inspecteur + palette, piloté au clavier.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useDonnees, type Mutation } from "../donnees/magasin";
import { deconnexion } from "../donnees/firebase";
import { correspond, type Contexte } from "../donnees/filtres";
import { depuisParams, grouper, ouvertesDabord, trier, versFiltres, versParams, type Requete } from "../donnees/requete";
import { estEnRetard, estTerminee, nouvelId, type Tache } from "../donnees/modele";
import { RefusOperation } from "../donnees/operations";
import { ErreurConflit } from "../donnees/plan-ecriture";
import { ErreurLectureSeule } from "../donnees/garde";
import type { Saisie } from "../donnees/saisie";
import { naviguer, useRoute } from "../navigation/routeur";
import { Bouton, Cartouche, Etat, Kbd, Segment } from "../composants";
import { useApparence } from "../theme/useApparence";
import { Navigation } from "./Navigation";
import { BarreRequete, compterMeta } from "./BarreRequete";
import { Colonnes, Liste } from "./Lignes";
import { Inspecteur } from "./Inspecteur";
import { Palette, type Commande } from "./Palette";
import { useNotifier } from "./Notifications";
import { FilDuJour } from "./FilDuJour";
import { PageProjet } from "./PageProjet";
import { Bande, ESPACES, NavEspace, PageCorps, PageEquipe, PageFinances, allerEspace, memoriser, useRapportDuJour, type Espace } from "./Espaces";
import { aCaser, type ModeJour } from "../donnees/journee";
import { archiverTache, basculer, creer, dupliquerTache, modifier, remettre, restaurerTache, retirer, statutCyclique } from "./actions";

type Lentille = "page" | "liste" | "colonnes";
const ecrit = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const AIDE: [string, string][] = [
  ["⌘K · Ctrl+K · /", "Palette : créer, chercher, aller à, commandes"], ["C · N · Ctrl+Alt+N", "Nouvelle tâche (saisie rapide)"],
  ["J · ↓ / K · ↑", "Tâche suivante / précédente"], ["↵", "Ouvrir la fiche"], ["Échap", "Fermer la fiche ou la palette"],
  ["g puis j · c · f · s · e", "Espace : Fil du jour, Chantiers, Finances, Corps, Équipe"], ["3", "Page du projet"], ["E", "Terminer / rouvrir"], ["S", "Statut suivant"], ["F", "Focus oui / non"], ["D", "Modifier la date de fin"], ["A", "Changer le responsable"],
  ["X · Suppr", "Archiver (annulable)"], ["1 · 2", "Lentille Liste / Colonnes"], ["?", "Cette aide"],
];

export function Cockpit({ utilisateur }: { utilisateur: Pick<User, "email"> }) {
  const { d, executer, enCours, source } = useDonnees();
  const notifier = useNotifier();
  const route = useRoute();
  const [apparence, changerApparence] = useApparence();
  const [palette, setPaletteEtat] = useState<null | "tout" | "creer">(null);
  // Référence lue par le clavier global : aucune frappe ne doit être
  // interprétée comme raccourci entre l'ouverture de la palette et son rendu.
  const paletteRef = useRef<null | "tout" | "creer">(null);
  const setPalette = useCallback((v: null | "tout" | "creer") => { paletteRef.current = v; setPaletteEtat(v); }, []);
  const [aide, setAide] = useState(false);
  const [selection, setSelection] = useState<string | undefined>();
  const zone = useRef<HTMLDivElement>(null);

  const s0 = route.segments[0];
  const vue = s0 === "projets" ? "projet" : s0 === "archive" ? "archive" : s0 === "taches" ? "toutes" : s0 === "finances" || s0 === "corps" || s0 === "equipe" ? s0 : "fil";
  const espace: Espace = vue === "fil" || vue === "finances" || vue === "corps" || vue === "equipe" ? vue : "chantiers";
  const sansRequete = espace !== "chantiers";
  const modeFil = (["matin", "journee", "soir", "semaine"] as const).find((m) => m === route.params.get("m")) ?? null;
  const projetFixe = vue === "projet" ? route.segments[1] : undefined;
  const projet = d.projets.find((p) => p.id === projetFixe);
  const lentilleDefaut: Lentille = vue === "projet" ? "page" : "liste";
  const vParam = route.params.get("v");
  const lentille: Lentille = vParam === "colonnes" ? "colonnes" : vParam === "liste" ? "liste" : vParam === "page" && vue === "projet" ? "page" : lentilleDefaut;
  const ouverte = route.params.get("t") || undefined;
  const r = useMemo(() => depuisParams(route.params), [route.params]);
  const base = vue === "projet" ? `/projets/${encodeURIComponent(projetFixe || "")}` : vue === "archive" ? "/archive" : vue === "toutes" ? "/taches" : vue === "fil" ? "/" : `/${vue}`;

  const majAdresse = useCallback((modif: { r?: Requete; v?: Lentille; t?: string | null; m?: ModeJour }, empiler = false) => {
    const p = sansRequete ? new URLSearchParams() : versParams(modif.r ?? r);
    const m = modif.m ?? modeFil; if (vue === "fil" && m) p.set("m", m);
    const v = modif.v ?? lentille; if (!sansRequete && v !== lentilleDefaut) p.set("v", v);
    const t = modif.t === undefined ? ouverte : modif.t; if (t) p.set("t", t);
    naviguer(base, p, !empiler);
  }, [r, lentille, lentilleDefaut, ouverte, base, vue, modeFil, sansRequete]);

  const ctx: Contexte = useMemo(() => ({ projets: d.projets, statuts: d.statuts, types: d.types, aujourdhui: d.aujourdhui }), [d.projets, d.statuts, d.types, d.aujourdhui]);
  const filtres = useMemo(() => versFiltres(projetFixe ? { ...r, projets: [projetFixe] } : r), [r, projetFixe]);
  const visibles = useMemo(() => (vue === "archive" || sansRequete ? [] : d.taches.filter((t) => correspond(t, d.metaFiltres, ctx) && correspond(t, filtres, ctx))), [vue, sansRequete, d.taches, d.metaFiltres, filtres, ctx]);
  const paquets = useMemo(() => {
    const p = grouper(trier(visibles, r.tri, d), lentille === "colonnes" && r.groupe === "aucun" ? "status" : r.groupe, d);
    return r.groupe === "status" ? ouvertesDabord(p, d) : p;
  }, [visibles, r.tri, r.groupe, lentille, d]);
  const ordre = useMemo(() => (vue === "fil" ? aCaser(d.taches, d.aujourdhui, d).map((t) => t.id) : paquets.flatMap((p) => p.taches.map((t) => t.id))), [vue, paquets, d]);
  const tacheOuverte = d.taches.find((t) => t.id === ouverte);
  const rapportDuJour = useRapportDuJour(source, d.aujourdhui);
  // Chaque espace mémorise sa dernière adresse (préférence locale).
  useEffect(() => { memoriser(espace, location.pathname + location.search); }, [espace, route.chemin, route.params]);
  const accord = useRef(0);

  // Exécution avec retour visible et « Annuler ».
  const agir = useCallback(async (m: Mutation, message?: string, inverse?: () => Mutation) => {
    try {
      await executer(m);
      if (message) notifier({ message, annuler: inverse ? () => { executer(inverse()).catch((e) => notifier({ message: (e as Error).message, ton: "crit" })); } : undefined });
    } catch (e) {
      const err = e as Error;
      const msg = err instanceof RefusOperation || err instanceof ErreurLectureSeule ? err.message
        : err instanceof ErreurConflit ? "Une autre session modifie les tâches en ce moment : réessaie dans un instant. Rien n'a été écrasé."
        : `Enregistrement impossible : ${err.message}`;
      notifier({ message: msg, ton: "crit" });
    }
  }, [executer, notifier]);

  const tache = (id?: string) => d.taches.find((t) => t.id === id);
  const actionBasculer = (id: string) => {
    const avant = tache(id); if (!avant) return;
    const sortie: { occurrence?: Tache } = {};
    const fini = estTerminee(avant, d.statuts);
    // Une tâche terminée sort de la vue si les terminées sont masquées : la
    // sélection passe à la suivante pour que le clavier reste utile.
    if (!fini && !r.terminees && selection === id) { const i = ordre.indexOf(id); setSelection(ordre[i + 1] || ordre[i - 1]); }
    agir(basculer(id, sortie), fini ? `« ${avant.title} » rouverte.` : `« ${avant.title} » terminée.${avant.recurrence ? " Prochaine occurrence créée." : ""}`,
      () => (t, a, c) => { const r1 = remettre([avant])(t, a, c).taches ?? t; return { taches: sortie.occurrence ? retirer([sortie.occurrence.id])(r1, a, c).taches : r1 }; });
  };
  const actionPatch = (id: string, patch: Partial<Tache>, message?: string) => { const avant = tache(id); if (avant) agir(modifier(id, patch), message, () => remettre([avant])); };
  const actionArchiver = (id: string) => {
    const t = tache(id); if (!t) return;
    const i = ordre.indexOf(id); setSelection(ordre[i + 1] || ordre[i - 1]);
    if (ouverte === id) majAdresse({ t: null });
    agir(archiverTache(id), `« ${t.title} » archivée.`, () => restaurerTache(id));
  };
  const actionDupliquer = (id: string) => { const sortie: { id?: string } = {}; agir(dupliquerTache(id, sortie), "Tâche dupliquée.", () => retirer(sortie.id ? [sortie.id] : [])); };
  const actionCreer = (s: Saisie, ouvrir: boolean) => {
    const id = nouvelId();
    const def = d.defauts;
    const b = {
      title: s.titre, projectId: s.projectId || projetFixe || def.projectId || undefined, taskTypeId: s.taskTypeId || def.taskTypeId || undefined, statusId: def.statusId || undefined,
      assignee: s.assignee ?? def.assignee ?? "", criticality: (s.criticality || def.criticality || null) as Tache["criticality"],
      start: s.start, end: s.end, startTime: s.startTime, endTime: s.endTime,
    };
    agir(creer(b, d.aujourdhui, id), `« ${s.titre} » créée.`, () => retirer([id])).then(() => { setSelection(id); if (ouvrir) majAdresse({ t: id }, true); });
  };
  const ouvrir = (id: string) => { setSelection(id); majAdresse({ t: id }, true); };
  const fermer = () => majAdresse({ t: null });

  const focusChamp = (id: string, champ: string) => { ouvrir(id); setTimeout(() => (document.getElementById(champ) as HTMLElement | null)?.focus(), 50); };

  const commandes: Commande[] = useMemo(() => [
    { id: "fil", libelle: "Fil du jour", detail: "accueil", executer: () => naviguer("/") },
    { id: "fil-soir", libelle: "Bilan du soir", executer: () => naviguer("/", new URLSearchParams("m=soir")) },
    { id: "fil-semaine", libelle: "Semaine", detail: "fil du jour, 7 jours", executer: () => naviguer("/", new URLSearchParams("m=semaine")) },
    { id: "toutes", libelle: "Toutes les tâches", executer: () => naviguer("/taches") },
    { id: "lentille-liste", libelle: "Lentille Liste", raccourci: "1", executer: () => (vue === "fil" ? naviguer("/taches") : majAdresse({ v: "liste" })) },
    { id: "lentille-colonnes", libelle: "Lentille Colonnes", detail: "kanban par regroupement", raccourci: "2", executer: () => (vue === "fil" ? naviguer("/taches", new URLSearchParams("v=colonnes")) : majAdresse({ v: "colonnes" })) },
    { id: "terminees", libelle: r.terminees ? "Masquer les terminées" : "Afficher les terminées", executer: () => majAdresse({ r: { ...r, terminees: !r.terminees } }) },
    { id: "retard", libelle: "Voir les tâches en retard", executer: () => naviguer("/taches", new URLSearchParams("retard=1")) },
    { id: "archive", libelle: "Ouvrir l'archive", executer: () => naviguer("/archive") },
    ...(["status", "project", "assignee", "criticality", "period", "aucun"] as const).map((g) => ({ id: `grp-${g}`, libelle: `Grouper par ${({ status: "statut", project: "projet", assignee: "responsable", criticality: "criticité", period: "mois d'échéance", aucun: "rien" })[g]}`, executer: () => majAdresse({ r: { ...r, groupe: g } }) })),
    { id: "mode-sombre", libelle: "Mode sombre", executer: () => changerApparence({ mode: "sombre" }) },
    { id: "mode-clair", libelle: "Mode clair", executer: () => changerApparence({ mode: "clair" }) },
    { id: "mode-auto", libelle: "Mode automatique (système)", executer: () => changerApparence({ mode: "auto" }) },
    { id: "densite", libelle: apparence.densite === "compacte" ? "Densité confortable" : "Densité compacte", executer: () => changerApparence({ densite: apparence.densite === "compacte" ? "confortable" : "compacte" }) },
    { id: "aide", libelle: "Raccourcis clavier", raccourci: "?", executer: () => setAide(true) },
    { id: "reference", libelle: "Référence de l'identité visuelle", executer: () => { location.href = "/reference"; } },
    { id: "deconnexion", libelle: "Se déconnecter", executer: () => { deconnexion(); } },
  ], [r, majAdresse, changerApparence, apparence.densite, vue]);

  // Clavier global.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette("tout"); return; }
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); setPalette("creer"); return; }
      if (paletteRef.current || ecrit(e.target)) { if (e.key === "Escape" && ecrit(e.target) && !paletteRef.current) (e.target as HTMLElement).blur(); return; }
      if (aide) { if (e.key === "Escape" || e.key === "?") setAide(false); return; }
      if (mod || e.altKey) return;
      // Accords « g » + lettre : changer d'espace.
      if (accord.current && Date.now() - accord.current < 1200) {
        accord.current = 0;
        const cible = ESPACES.find((x) => x.touche === e.key.toLowerCase());
        if (cible) { e.preventDefault(); allerEspace(cible.id); return; }
      }
      if (e.key === "g") { accord.current = Date.now(); return; }
      const sel = selection && ordre.includes(selection) ? selection : undefined;
      const bouger = (n: number) => { e.preventDefault(); const i = sel ? ordre.indexOf(sel) : -1; const k = Math.max(0, Math.min(ordre.length - 1, i + n)); if (ordre[k]) { setSelection(ordre[k]); if (ouverte) majAdresse({ t: ordre[k] }); } };
      switch (e.key) {
        case "/": e.preventDefault(); setPalette("tout"); break;
        case "c": case "n": case "N": e.preventDefault(); setPalette("creer"); break;
        case "j": case "ArrowDown": bouger(1); break;
        case "k": case "ArrowUp": bouger(-1); break;
        case "Enter": if (sel) { e.preventDefault(); ouvrir(sel); } break;
        case "Escape": if (ouverte) fermer(); else setSelection(undefined); break;
        case "e": if (sel) actionBasculer(sel); break;
        case "s": if (sel) { const t = tache(sel); if (t) agir(statutCyclique(sel), "Statut changé.", () => remettre([t])); } break;
        case "f": if (sel) { const t = tache(sel); if (t) actionPatch(sel, { focus: t.focus !== true }, t.focus ? "Focus retiré." : "Tâche passée en focus."); } break;
        case "d": if (sel) focusChamp(sel, "i-fin"); break;
        case "a": if (sel) focusChamp(sel, "i-resp"); break;
        case "x": case "Delete": if (sel) actionArchiver(sel); break;
        case "1": if (sansRequete) naviguer("/taches"); else majAdresse({ v: "liste" }); break;
        case "2": if (sansRequete) naviguer("/taches", new URLSearchParams("v=colonnes")); else majAdresse({ v: "colonnes" }); break;
        case "3": if (vue === "projet") majAdresse({ v: "page" }); break;
        case "?": setAide(true); break;
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  useEffect(() => { if (selection) zone.current?.querySelector(`[data-id="${CSS.escape(selection)}"]`)?.scrollIntoView({ block: "nearest" }); }, [selection]);

  const segmentLentilles = (
    <Segment etiquette="Lentille" valeur={lentille} onChange={(v) => majAdresse({ v })}
      options={[...(vue === "projet" ? [{ valeur: "page" as Lentille, libelle: "Page", raccourci: "3" }] : []), { valeur: "liste" as Lentille, libelle: "Liste", raccourci: "1" }, { valeur: "colonnes" as Lentille, libelle: "Colonnes", raccourci: "2" }]} />
  );
  const retards = visibles.filter((t) => estEnRetard(t, d.statuts, d.aujourdhui)).length;
  const titre = vue === "projet" ? projet?.name || "Projet introuvable" : vue === "archive" ? "Archive" : r.retard ? "En retard" : r.focus === "yes" ? "Focus" : "Toutes les tâches";
  const erreurs = Object.entries(d.etats).filter(([, e]) => e.erreur).map(([k, e]) => `${k} : ${e.erreur}`);
  const membres = [...new Set([...d.membres.map((m) => m.name), ...d.taches.map((t) => t.assignee || "").filter(Boolean)])].sort((a, b) => a.localeCompare(b));

  return (
    <div className="cockpit">
      <header className="entete">
        <strong className="entete-titre">Nexora Futur</strong>
        <button type="button" className="commande-barre" onClick={() => setPalette("tout")}>Rechercher, créer, aller à…<Kbd>⌘K</Kbd></button>
        <span className="marge-auto" />
        <Bouton variante="principal" raccourci="C" onClick={() => setPalette("creer")}>Nouvelle tâche</Bouton>
        <span className="discret mono entete-compte">{utilisateur.email}</span>
      </header>
      <Bande actif={espace} d={d} budget={rapportDuJour} />
      {espace === "fil" || espace === "chantiers" ? <Navigation projetActif={projetFixe} vue={vue === "toutes" && !r.retard && r.focus === "all" ? "toutes" : vue} /> : <NavEspace espace={espace} />}
      <main className="zone quadrillage" ref={zone}>
        {vue === "fil" ? <FilDuJour d={d} source={source} mode={modeFil} setMode={(m) => majAdresse({ m })} selection={selection} onOuvrir={ouvrir} onPatch={actionPatch} onBasculer={actionBasculer} />
        : vue === "equipe" ? <PageEquipe d={d} />
        : vue === "corps" ? <PageCorps d={d} />
        : vue === "finances" ? <PageFinances rapport={rapportDuJour} />
        : vue === "projet" && lentille === "page" && projet ? <PageProjet d={d} projet={projet} selection={selection} onOuvrir={ouvrir} onBasculer={actionBasculer} lentilles={segmentLentilles} />
        : <>
        <div className="zone-tete">
          <Cartouche surtitre={vue === "projet" ? "Projet" : vue === "archive" ? "Tâches archivées · purge après 30 jours" : "Cockpit"} titre={titre}
            meta={vue === "archive" ? <span>{d.archive.length} tâches</span> : <><span>{visibles.length} tâches</span><span className={retards ? "crit" : ""}>{retards} en retard</span><span>{d.charge ? "à jour" : "lecture…"}</span></>}
            actions={vue !== "archive" ? segmentLentilles : undefined} />
          {vue !== "archive" && <BarreRequete r={r} setR={(x) => majAdresse({ r: x })} cat={d} membres={membres} metaActifs={compterMeta(d.metaFiltres)} projetFixe={projetFixe} />}
        </div>
        {erreurs.length > 0 && <p role="alert" className="zone-alerte"><Etat ton="crit">Lecture Firebase en échec</Etat> {erreurs.join(" · ")}</p>}
        {!d.charge ? <p className="surtitre zone-charge">Lecture de Firebase…</p>
          : vue === "archive" ? (
            <div className="liste" role="grid" aria-label="Archive">
              {[...d.archive].sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || "")).map((t) => (
                <div key={t.id} role="row" className="ligne ligne-archive">
                  <span role="gridcell" />
                  <span role="gridcell" className="ligne-titre">{t.title}</span>
                  <span role="gridcell" className="ligne-projet"><span className="point" style={{ background: d.projets.find((p) => p.id === t.projectId)?.color || "var(--encre3)" }} />{d.projets.find((p) => p.id === t.projectId)?.name || "Sans projet"}</span>
                  <span role="gridcell" className="mono discret">archivée {t.archivedAt ? new Date(t.archivedAt).toLocaleDateString("fr-FR") : ""}</span>
                  <span role="gridcell"><Bouton onClick={() => agir(restaurerTache(t.id), `« ${t.title} » restaurée.`, () => archiverTache(t.id))}>Restaurer</Bouton></span>
                </div>
              ))}
              {!d.archive.length && <div className="vide"><p>L'archive est vide.</p></div>}
            </div>
          ) : lentille === "colonnes"
            ? <Colonnes paquets={paquets} cat={d} aujourdhui={d.aujourdhui} selection={selection} onSelect={setSelection} onOuvrir={ouvrir} onBasculer={actionBasculer} champ={r.groupe === "aucun" ? "status" : r.groupe} onDeplacer={(id, patch) => actionPatch(id, patch, "Tâche déplacée.")} />
            : <Liste paquets={paquets} cat={d} aujourdhui={d.aujourdhui} selection={selection} onSelect={setSelection} onOuvrir={ouvrir} onBasculer={actionBasculer} />}
        </>}
      </main>
      {tacheOuverte && (
        <Inspecteur key={tacheOuverte.id} t={tacheOuverte} cat={d} taches={d.taches} aujourdhui={d.aujourdhui}
          onPatch={(p) => actionPatch(tacheOuverte.id, p)} onBasculer={() => actionBasculer(tacheOuverte.id)} onArchiver={() => actionArchiver(tacheOuverte.id)}
          onDupliquer={() => actionDupliquer(tacheOuverte.id)} onFermer={fermer} onOuvrir={ouvrir} />
      )}
      <footer className="etat-barre mono" aria-live="polite">
        <span className={enCours ? "" : "ok"}>{enCours ? "● Enregistrement…" : "● Synchronisé"}</span>
        <span>Tâches · rév. {d.etats.taches.lecture?.revision?.slice(0, 8) || "—"}</span>
        <span>Écriture : tâches et archive · le reste en lecture seule</span>
        <span className="marge-auto"><Kbd>⌘K</Kbd> commandes · <Kbd>?</Kbd> raccourcis</span>
      </footer>
      {palette && <Palette key={palette} ouverte modeInitial={palette} onFermer={() => setPalette(null)} cat={d} taches={d.taches} archive={d.archive} aujourdhui={d.aujourdhui} commandes={commandes}
        onCreer={actionCreer} onOuvrirTache={(t, archivee) => (archivee ? naviguer("/archive") : ouvrir(t.id))} onAllerProjet={(id) => naviguer(`/projets/${encodeURIComponent(id)}`)} />}
      {aide && (
        <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && setAide(false)}>
          <div className="palette aide" role="dialog" aria-modal="true" aria-label="Raccourcis clavier">
            <Cartouche surtitre="Cockpit" titre="Raccourcis clavier" actions={<Bouton variante="discret" onClick={() => setAide(false)}>Fermer <Kbd>Échap</Kbd></Bouton>} />
            <dl className="aide-liste">{AIDE.map(([k, v]) => <div key={k}><dt className="mono">{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
        </div>
      )}
    </div>
  );
}
