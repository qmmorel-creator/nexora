// Glisser-déposer des frises (Ref #688) : déplacer une tâche (dates
// décalées), étirer un bord (début ou fin) ou la déposer sur la portée d'un
// autre projet. Chaque modification est annulable ; l'écriture passe par les
// mutations rejouables du magasin (protocole anti-conflit de Futur).
import { useEffect, useRef } from "react";
import { ajouterJours, type Tache } from "../donnees/modele";
import { modifier, remettre } from "../donnees/actions";
import { dateCourte, useOptim, useUi } from "./contexte";
import { infobulleFlottante } from "./infobulle";

interface Etat { id: string; el: HTMLElement; mode: "move" | "start" | "end"; x0: number; y0: number; pxJour: number; left: number; width: number; bouge: boolean; dd: number; projet: string | null; styles: [string, string, string]; }

export function useGlisser() {
  const { d, executer, projet } = useOptim();
  const { notifier } = useUi();
  const etat = useRef<Etat | null>(null);
  const taches = useRef(d.taches); taches.current = d.taches;
  const juste = useRef(false);

  useEffect(() => {
    const bas = (ev: PointerEvent) => {
      const el = (ev.target as HTMLElement).closest?.("[data-drag]") as HTMLElement | null;
      if (!el || ev.button !== 0) return;
      const piste = el.closest("[data-rs]") as HTMLElement | null; if (!piste) return;
      const t = taches.current.find((x) => x.id === el.dataset.drag); if (!t) return;
      const rb = el.getBoundingClientRect(), tr = piste.getBoundingClientRect();
      const mode = t.milestone ? "move" : ev.clientX - rb.left < 8 ? "start" : rb.right - ev.clientX < 8 ? "end" : "move";
      etat.current = { id: t.id, el, mode, x0: ev.clientX, y0: ev.clientY, pxJour: tr.width / Number(piste.dataset.rn), left: el.offsetLeft, width: el.offsetWidth, bouge: false, dd: 0, projet: null, styles: [el.style.left, el.style.width, el.style.transform] };
      el.classList.add("is-dragging");
    };
    const deplace = (ev: PointerEvent) => {
      const g = etat.current; if (!g) return;
      const dx = ev.clientX - g.x0, dd = Math.round(dx / g.pxJour), t = taches.current.find((x) => x.id === g.id); if (!t) return;
      if (Math.abs(dx) > 3 || Math.abs(ev.clientY - g.y0) > 6) g.bouge = true;
      if (!g.bouge) return;
      ev.preventDefault();
      if (g.mode === "move") g.el.style.transform = `translate(${dd * g.pxJour}px, ${ev.clientY - g.y0}px)`;
      else if (g.mode === "start") { g.el.style.left = `${g.left + dd * g.pxJour}px`; g.el.style.width = `${Math.max(g.pxJour, g.width - dd * g.pxJour)}px`; }
      else g.el.style.width = `${Math.max(g.pxJour, g.width + dd * g.pxJour)}px`;
      const sous = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => (n as HTMLElement).dataset?.laneProject) as HTMLElement | undefined;
      document.querySelectorAll(".hx-lane.is-drop").forEach((n) => n.classList.remove("is-drop"));
      g.projet = g.mode === "move" && sous && sous.dataset.laneProject !== (t.projectId || "") ? sous.dataset.laneProject || null : null;
      if (g.projet && sous) sous.classList.add("is-drop");
      g.dd = dd;
      const { debut, fin } = nouvellesDates(t, g.mode, dd);
      infobulleFlottante([t.title || "", `${g.mode === "move" ? "Déplacer" : g.mode === "start" ? "Nouveau début" : "Nouvelle fin"} · ${dd > 0 ? "+" : ""}${dd} j`, t.milestone ? `Jalon le ${dateCourte(fin)}` : `${dateCourte(debut)} → ${dateCourte(fin)}`, ...(g.projet ? [`Nouveau projet : ${projet(g.projet).name}`] : [])], ev.clientX, ev.clientY);
    };
    const haut = async () => {
      const g = etat.current; if (!g) return; etat.current = null;
      infobulleFlottante(null, 0, 0);
      document.querySelectorAll(".hx-lane.is-drop").forEach((n) => n.classList.remove("is-drop"));
      // Styles d'origine (posés par React) restaurés, jamais effacés.
      g.el.classList.remove("is-dragging"); [g.el.style.left, g.el.style.width, g.el.style.transform] = g.styles;
      if (!g.bouge) return;
      juste.current = true; setTimeout(() => { juste.current = false; }, 0);
      const t = taches.current.find((x) => x.id === g.id); if (!t || (!g.dd && !g.projet)) return;
      const avant: Tache = { ...t };
      const { debut, fin } = nouvellesDates(t, g.mode, g.dd);
      const patch: Partial<Tache> = { ...(t.milestone ? {} : { start: debut }), end: fin, ...(t.milestone && t.start ? { start: fin } : {}), ...(g.projet ? { projectId: g.projet } : {}) };
      try {
        await executer(modifier(t.id, patch));
        notifier({ texte: `« ${t.title} » ${t.milestone ? "le " + dateCourte(fin) : `du ${dateCourte(debut)} au ${dateCourte(fin)}`}${g.projet ? " · déplacée dans " + projet(g.projet).name : ""}`, annuler: () => { void executer(remettre([avant])); } });
      } catch (e) { notifier({ texte: `Modification refusée : ${(e as Error).message}` }); }
    };
    // Un clic qui suit un glisser n'ouvre pas la fiche.
    const clic = (ev: MouseEvent) => { if (juste.current) { ev.stopPropagation(); ev.preventDefault(); juste.current = false; } };
    document.addEventListener("pointerdown", bas); document.addEventListener("pointermove", deplace); document.addEventListener("pointerup", haut); document.addEventListener("click", clic, true);
    return () => { document.removeEventListener("pointerdown", bas); document.removeEventListener("pointermove", deplace); document.removeEventListener("pointerup", haut); document.removeEventListener("click", clic, true); };
  }, [executer, notifier, projet]);
}

function nouvellesDates(t: Tache, mode: Etat["mode"], dd: number) {
  const s = t.start || t.end || "", e = t.end || t.start || "";
  if (mode === "start") { const n = ajouterJours(s, dd); return { debut: n > e ? e : n, fin: e }; }
  if (mode === "end") { const n = ajouterJours(e, dd); return { debut: s, fin: n < s ? s : n }; }
  return { debut: ajouterJours(s, dd), fin: ajouterJours(e, dd) };
}
