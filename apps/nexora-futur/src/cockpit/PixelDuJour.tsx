// « Le pixel du jour » (Ref #660, réutilisé par le Cadran #678) : une habitude
// = un pixel, liste reliée par des fils à ses pixels groupés par thème.
// Esthétique et états repris du widget Pixel de nexora-project
// (.lp-hpx-*, part-001:2061-2145) ; écriture par les règles de habitudes.ts.
import { useMemo } from "react";
import { useDonnees } from "../donnees/magasin";
import { basculerHabitude, etatsDuJour, pasNumerique, poserNonApplicable, poserValeur, type EtatHabitude, type Habitude, type ThemeHabitudes } from "../donnees/habitudes";
import { ajouterJours } from "../donnees/modele";
import { useNotifier } from "./Notifications";

const CLASSE: Record<EtatHabitude, string> = { fait: "done", partiel: "part", na: "na", "a-faire": "todo" };
const LARG = 520, COL = 250, PX = 26, PXG = 5, TH = 26, RG = 21;

export function Pixel({ h, etat, valeur, taille, futur, onClick, mini }: { h: Habitude; etat: EtatHabitude; valeur: number | null; taille: number; futur?: boolean; onClick?: () => void; mini?: boolean }) {
  const remplissage = etat === "partiel" && valeur !== null ? Math.round(((valeur - h.min) / (h.max - h.min || 1)) * 100) : 0;
  const lib = mini ? "" : h.kind === "numeric" && valeur !== null ? String(valeur) : etat === "fait" ? "✓" : etat === "na" ? "–" : "";
  const style = { ["--c" as string]: h.color, ["--fill" as string]: `${remplissage}%`, width: taille, height: taille };
  const cls = `px ${futur && etat === "a-faire" ? "futur" : CLASSE[etat]}${mini ? " mini" : ""}`;
  return onClick && !futur
    ? <button type="button" className={cls} style={style} onClick={onClick} title={`${h.name} : ${etat === "fait" ? "fait" : etat === "partiel" ? `${valeur} / ${h.max}` : etat === "na" ? "non applicable" : "à faire"}`} aria-label={h.name}>{lib}</button>
    : <span className={cls} style={style} aria-hidden="true">{lib}</span>;
}

// Carré journalier : une rangée par thème, complétée de cases vides.
export function Mosaique({ themes, journal, nonApplicables, jour, taille, futur }: { themes: ThemeHabitudes[]; journal: unknown; nonApplicables: unknown; jour: string; taille: number; futur?: boolean }) {
  const e = useMemo(() => etatsDuJour(themes, journal, nonApplicables, jour), [themes, journal, nonApplicables, jour]);
  const cote = Math.max(e.parTheme.length, ...e.parTheme.map((t) => t.habitudes.length), 1);
  return (
    <span className="mos" aria-hidden="true">
      {Array.from({ length: cote }, (_, r) => (
        <span key={r} className="mos-l">
          {Array.from({ length: cote }, (_, k) => { const x = e.parTheme[r]?.habitudes[k]; return x ? <Pixel key={k} h={x.h} etat={x.etat} valeur={x.valeur} taille={taille} futur={futur} mini={taille < 10} /> : <span key={k} className={`px vide${taille < 10 ? " mini" : ""}`} style={{ width: taille, height: taille }} />; })}
        </span>
      ))}
    </span>
  );
}

export function PixelDuJour({ jour, setJour, aujourdhui }: { jour: string; setJour: (j: string) => void; aujourdhui: string }) {
  const { d, ecrireJson } = useDonnees();
  const notifier = useNotifier();
  const themes = d.themesHabitudes;
  const e = useMemo(() => etatsDuJour(themes, d.journalHabitudes, d.nonApplicables, jour), [themes, d.journalHabitudes, d.nonApplicables, jour]);
  const futur = jour > aujourdhui;
  const ecrire = (p: Promise<void>) => p.catch((x) => notifier({ message: `Habitude non enregistrée : ${(x as Error).message}`, ton: "crit" }));
  const cocher = (h: Habitude) => ecrire(ecrireJson("journalHabitudes", (l) => basculerHabitude(l, themes, h.id, jour)));
  const pas = (h: Habitude, valeur: number | null, delta: number) => { const v = pasNumerique(h, valeur, delta); if (v !== null) ecrire(ecrireJson("journalHabitudes", (l) => poserValeur(l, themes, h.id, jour, v))); };
  // Clic sur un pixel : coche, ou +pas puis effacement au maximum, ou retrait du « non applicable ».
  const cliquerPixel = (h: Habitude, etat: EtatHabitude, valeur: number | null) => {
    if (etat === "na") return ecrire(ecrireJson("nonApplicables", (l) => poserNonApplicable(l, themes, h.id, jour, false)));
    if (h.kind !== "numeric") return cocher(h);
    if (valeur !== null && valeur >= h.max) return ecrire(ecrireJson("journalHabitudes", (l) => poserValeur(l, themes, h.id, jour, "")));
    pas(h, valeur, 1);
  };
  const titre = jour === aujourdhui ? "Aujourd'hui" : jour === ajouterJours(aujourdhui, -1) ? "Hier" : jour === ajouterJours(aujourdhui, 1) ? "Demain" : new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  let y = 0; const lignes: JSX.Element[] = []; const fils: JSX.Element[] = []; const groupes: JSX.Element[] = [];
  e.parTheme.forEach(({ theme, habitudes }) => {
    const n = habitudes.length, gw = n * PX + (n - 1) * PXG + 8, gx = LARG - gw - 4, gy = y - 6, bas = gy + 4 + PX;
    const faites = habitudes.filter((x) => x.etat === "fait").length, applicables = habitudes.filter((x) => x.etat !== "na").length;
    lignes.push(<div key={`t${theme.id}`} className="hp-th" style={{ top: y }}><span className="hp-dot" style={{ background: theme.color }} />{theme.name}<small className="mono">{faites} / {applicables}{theme.selectionMode === "single" ? " · un seul choix" : ""}</small></div>);
    groupes.push(<div key={`g${theme.id}`} className="hp-grp" role="group" aria-label={`Pixels ${theme.name}`} style={{ ["--tc" as string]: theme.color, left: gx, top: gy }}>{habitudes.map(({ h, etat, valeur }) => <Pixel key={h.id} h={h} etat={etat} valeur={valeur} taille={PX} futur={futur} onClick={() => cliquerPixel(h, etat, valeur)} />)}</div>);
    habitudes.forEach(({ h, etat, valeur }, k) => {
      const ry = y + TH + k * RG, cy = ry + RG / 2, px = gx + 4 + k * (PX + PXG) + PX / 2;
      lignes.push(
        <div key={h.id} className={`hp-row ${etat === "na" ? "na" : ""}`} style={{ top: ry }}>
          <span className="hp-nom">{h.name}</span>
          {h.kind === "numeric" ? (
            <span className="hp-step">
              <button type="button" aria-label={`Diminuer ${h.name}`} disabled={futur || valeur === null} onClick={() => pas(h, valeur, -1)}>−</button>
              <b className="mono">{valeur ?? "–"} / {h.max}</b>
              <button type="button" aria-label={`Augmenter ${h.name}`} disabled={futur || (valeur !== null && valeur >= h.max)} onClick={() => pas(h, valeur, 1)}>+</button>
            </span>
          ) : etat !== "na" && (
            <button type="button" role="checkbox" aria-checked={etat === "fait"} aria-label={h.name} disabled={futur} className={`hp-check ${etat === "fait" ? "on" : ""}`} style={{ ["--c" as string]: h.color }} onClick={() => cocher(h)}>{etat === "fait" ? "✓" : ""}</button>
          )}
          {(etat === "a-faire" || etat === "na") && !futur && (
            <button type="button" className={`hp-na ${etat === "na" ? "actif" : ""}`} aria-pressed={etat === "na"} aria-label={`${h.name} non applicable`} title="Non applicable ce jour-là"
              onClick={() => ecrire(ecrireJson("nonApplicables", (l) => poserNonApplicable(l, themes, h.id, jour, etat !== "na")))}>n/a</button>
          )}
        </div>,
      );
      fils.push(<path key={`f${h.id}`} className={`hp-fil ${etat === "fait" || etat === "partiel" ? "on" : ""} ${etat === "na" ? "na" : ""}`} d={`M ${COL + 6} ${cy} H ${px - 5} Q ${px} ${cy} ${px} ${cy - 5} V ${bas}`} style={{ stroke: etat === "na" ? undefined : h.color }} />);
      fils.push(<circle key={`p${h.id}`} cx={COL + 6} cy={cy} r={2.6} style={{ fill: h.color }} />);
    });
    y += TH + n * RG + 8;
  });
  const hauteur = Math.max(0, y - 4);
  return (
    <section className="panneau hp" aria-label={`Le pixel du jour, ${titre}`}>
      <div className="hp-tete">
        <div className="hp-titre"><b>Le pixel du jour</b><span className="discret">1 habitude = 1 pixel · non applicables exclues</span></div>
        <span className="hp-nav" role="group" aria-label="Jour">
          <button type="button" aria-label="Jour précédent" onClick={() => setJour(ajouterJours(jour, -1))}>‹</button>
          <button type="button" className="cour" onClick={() => setJour(aujourdhui)} title="Revenir à aujourd'hui">{titre}</button>
          <button type="button" aria-label="Jour suivant" disabled={jour > aujourdhui} onClick={() => setJour(ajouterJours(jour, 1))}>›</button>
        </span>
        <span className="hp-score mono"><b>{e.faites}</b> / {e.total}</span>
      </div>
      {!e.parTheme.length ? <p className="discret">{d.etats.themesHabitudes.charge ? "Aucune habitude configurée." : "Lecture des habitudes…"}</p> : (
        <div className="hp-corps" style={{ height: hauteur, width: LARG }}>
          <svg className="hp-fils" viewBox={`0 0 ${LARG} ${hauteur}`} width={LARG} height={hauteur} aria-hidden="true">{fils}</svg>
          {lignes}{groupes}
        </div>
      )}
    </section>
  );
}
