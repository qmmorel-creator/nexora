// Cocher les habitudes (Ref #669) : coche, compteur −/+ des habitudes
// chiffrées, « non applicable ». Mêmes règles que nexora-project (habitudes.ts).
import { useMemo } from "react";
import { useDonnees } from "../donnees/magasin";
import { basculerHabitude, etatsDuJour, pasNumerique, poserNonApplicable, poserValeur } from "../donnees/habitudes";
import { useNotifier } from "./Notifications";

export function HabitudesJour({ jour }: { jour: string }) {
  const { d, ecrireJson } = useDonnees();
  const notifier = useNotifier();
  const themes = d.themesHabitudes;
  const e = useMemo(() => etatsDuJour(themes, d.journalHabitudes, d.nonApplicables, jour), [themes, d.journalHabitudes, d.nonApplicables, jour]);
  const lu = d.etats.themesHabitudes.charge && d.etats.journalHabitudes.charge;
  const ecrire = (p: Promise<void>) => p.catch((x) => notifier({ message: `Habitude non enregistrée : ${(x as Error).message}`, ton: "crit" }));

  if (!e.parTheme.length) return <p className="discret">{lu ? "Aucune habitude configurée." : "Lecture des habitudes…"}</p>;
  return (
    <div className="habs">
      <p className="mono discret habs-total">{e.faites}/{e.total} validées</p>
      {e.parTheme.map(({ theme, habitudes }) => (
        <div key={theme.id} className="hab-theme" role="group" aria-label={`${theme.name}${theme.selectionMode === "single" ? ", choix unique" : ""}`}>
          <span className="discret hab-theme-nom">{theme.name}</span>
          {habitudes.map(({ h, etat, valeur }) => (
            <span key={h.id} className={`hab-el ${etat}`} style={{ ["--hab" as string]: h.color }}>
              {h.kind === "numeric" ? (
                <>
                  <button type="button" className="hab-pas" aria-label={`Diminuer ${h.name}`} disabled={valeur === null}
                    onClick={() => { const v = pasNumerique(h, valeur, -1); if (v !== null) ecrire(ecrireJson("journalHabitudes", (l) => poserValeur(l, themes, h.id, jour, v))); }}>−</button>
                  <span className="hab-nom">{h.name} <span className="mono">{valeur ?? "—"}/{h.max}</span></span>
                  <button type="button" className="hab-pas" aria-label={`Augmenter ${h.name}`} disabled={valeur !== null && valeur >= h.max}
                    onClick={() => { const v = pasNumerique(h, valeur, 1); if (v !== null) ecrire(ecrireJson("journalHabitudes", (l) => poserValeur(l, themes, h.id, jour, v))); }}>+</button>
                </>
              ) : (
                <button type="button" role="checkbox" aria-checked={etat === "fait"} className="hab-coche"
                  onClick={() => ecrire(ecrireJson("journalHabitudes", (l) => basculerHabitude(l, themes, h.id, jour)))}>
                  <span aria-hidden="true">{etat === "fait" ? "✓" : "○"}</span> {h.name}
                </button>
              )}
              {(etat === "a-faire" || etat === "na") && (
                <button type="button" className="hab-na" aria-pressed={etat === "na"} title="Non applicable ce jour-là" aria-label={`${h.name} non applicable`}
                  onClick={() => ecrire(ecrireJson("nonApplicables", (l) => poserNonApplicable(l, themes, h.id, jour, etat !== "na")))}>n/a</button>
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
