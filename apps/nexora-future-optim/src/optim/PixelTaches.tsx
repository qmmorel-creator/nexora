// Tâches du jour (retour du 03/10/2026) : le module « Pixel Tasks » de Nexora,
// repris tel quel (src/nexora/pixel-tasks-nexora.jsx), branché sur Optim :
// écritures par les mutations rejouables d'Optim (protocole anti-conflit),
// « Annuler » par la notification d'Optim, réglages du module (groupes,
// paquets, rameaux, fantômes, horizon, charge, capacité, replis…) mémorisés
// dans nexora:optimPrefs comme Nexora les mémorise sur son widget.
// Écart assumé avec Nexora : « Annuler » n'apparaît qu'après une écriture
// réussie (Nexora l'affiche même quand l'écriture est refusée).
import { useMemo, useState } from "react";
import { PIXEL_TASKS_CSS, WidgetPixelTasks, isTaskDoneGlobal, pixelTaskUpdateLabel, type CtxNexora } from "../nexora/pixel-tasks-nexora";
import { basculer, creer, modifier, remettre } from "../donnees/actions";
import { nouvelId, type Tache } from "../donnees/modele";
import type { Mutation } from "../donnees/magasin";
import { useOptim, useUi } from "./contexte";

export function PixelTaches({ taches, reglages, ecrireReglages, titre }: { taches: Tache[]; reglages: Record<string, unknown>; ecrireReglages: (r: Record<string, unknown>) => void; titre?: string }) {
  const { d, jour, executer } = useOptim();
  const { notifier, ouvrir } = useUi();
  const [barre, setBarre] = useState<HTMLElement | null>(null);
  const ctx: CtxNexora = useMemo(() => ({ statuses: d.statuts, projects: d.projets, projectFolders: d.dossiers, taskTypes: d.types, teamMembers: d.membres, tasks: d.taches }), [d]);
  const action = async (id: string, m: Mutation, decrire: (avant: Tache) => string) => {
    const avant = d.taches.find((t) => t.id === id);
    try {
      await executer(m);
      if (avant) notifier({ texte: `« ${avant.title || "Tâche"} » ${decrire(avant)}.`, annuler: () => { void executer(remettre([avant])); } });
    } catch (e) { notifier({ texte: (e as Error).message }); }
  };
  return (
    <section className="hx-tile ox-ptx nx-ptx-scope">
      <style>{PIXEL_TASKS_CSS}</style>
      <header className="ox-ptx-tete lp-widget-head">{titre && <h2>{titre}</h2>}<div className="ox-ptx-barre lp-widget-head-toolbar" ref={setBarre} /></header>
      <WidgetPixelTasks widget={reglages} tasks={taches} ctx={ctx} onOpen={(id) => ouvrir(id)} externalToolbarSlot={barre}
        onToggleDone={(id) => void action(id, basculer(id), (t) => (isTaskDoneGlobal(t, ctx) ? "rouverte" : "terminée"))}
        onUpdateTask={(id, patch) => void action(id, modifier(id, patch as Partial<Tache>), pixelTaskUpdateLabel(patch))}
        onCreateTask={(data) => {
          const id = nouvelId();
          executer(creer({ ...(data as Partial<Tache>), title: String(data.title || "") }, jour, id))
            .then(() => notifier({ texte: `Tâche « ${String(data.title || "")} » créée.`, annuler: () => { void executer((ts) => ({ taches: ts.filter((t) => t.id !== id) })); } }))
            .catch((e: Error) => notifier({ texte: e.message }));
          return { ...data, id };
        }}
        onUpdateWidget={(patch) => ecrireReglages({ ...reglages, ...patch })} />
    </section>
  );
}
