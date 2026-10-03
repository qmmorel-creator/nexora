// Journée (Ref #688 ; retour du 03/10/2026) : deux onglets.
// - Personnelle : calendriers dans le module « Tâches du jour » de Nexora
//   (à gauche), cadran agrandi et fil horaire (au centre), habitudes (à droite).
// - Professionnelle : grand filtre en haut ; tâches filtrées (hors calendriers)
//   dans le module « Tâches du jour » de Nexora (à gauche), cadran sans
//   habitudes et fil horaire (à droite).
import { useState } from "react";
import { estProjetCalendrier } from "../donnees/modele";
import { FILTRE_VIDE } from "../donnees/prefs";
import { naviguer, useRoute } from "../navigation/routeur";
import { jourLong, useOptim, useUi } from "./contexte";
import { BarreFiltres, useFiltrage } from "./filtres";
import { Cadran, FilHoraire, PanneauHabitudes } from "./jour";
import { PixelTaches } from "./PixelTaches";

export function Journee({ email }: { email: string }) {
  const { jour, d, prefs, ecrirePrefs, couleurHabitude } = useOptim();
  const { filtre } = useUi();
  const filtrer = useFiltrage();
  const route = useRoute();
  const [date, setDate] = useState(jour);
  const seg = route.segments[1];
  const onglet = seg === "pro" || seg === "perso" ? seg : prefs.journee.onglet;
  const choisir = (o: "perso" | "pro") => { void ecrirePrefs({ journee: { ...prefs.journee, onglet: o } }); naviguer(`/journee/${o}`); };
  const calendriers = d.taches.filter((t) => estProjetCalendrier(d.projets, t.projectId));
  const pro = filtrer(d.taches.filter((t) => !estProjetCalendrier(d.projets, t.projectId)), { ...FILTRE_VIDE, ...filtre, terminees: true });
  const tete = <div className="hx-hello ox-jtete"><h1>Journée <span>{jourLong(date)}</span></h1>
    <div className="hx-seg" role="group" aria-label="Journée"><button type="button" aria-pressed={onglet === "perso"} onClick={() => choisir("perso")}>Personnelle</button><button type="button" aria-pressed={onglet === "pro"} onClick={() => choisir("pro")}>Professionnelle</button></div>
    <p className="ox-trlien"><button type="button" className="hx-more" onClick={() => setDate(jour)} hidden={date === jour}>Revenir à aujourd'hui</button></p></div>;
  const legende = <ul className="hx-legend"><li><i style={{ background: "#7c5cd6" }} />Réunions et tâches à heure fixe <small>(couleur du projet)</small></li>
    {onglet === "perso" && d.themesHabitudes.filter((t) => t.habits.length).map((t) => <li key={t.id}><i style={{ background: t.habits.length === 1 ? couleurHabitude(t.habits[0]) : t.color }} />{t.name}</li>)}
    <li><i className="ox-nuitlg" />Nuit (23 h – 6 h 30)</li></ul>;
  if (onglet === "pro") return (
    <main className="hx-main hx-journee ox-jpro" data-scroll>
      {tete}
      <BarreFiltres ecran="journee" n={pro.length} email={email} reglages={{}} appliquerReglages={() => undefined} />
      <div className="ox-jgrid-pro">
        <PixelTaches taches={pro} reglages={prefs.journee.pixelPro} ecrireReglages={(r) => void ecrirePrefs({ journee: { ...prefs.journee, pixelPro: r } })} titre="Tâches du jour" />
        <section className="hx-dialwrap"><Cadran date={date} taille={460} habitudes={false} />{legende}<header className="hx-th is-sub"><h2>Fil horaire</h2></header><FilHoraire date={date} /></section>
      </div>
    </main>
  );
  return (
    <main className="hx-main hx-journee ox-jperso" data-scroll>
      {tete}
      <div className="ox-jgrid-perso">
        <PixelTaches taches={calendriers} reglages={prefs.journee.pixelPerso} ecrireReglages={(r) => void ecrirePrefs({ journee: { ...prefs.journee, pixelPerso: r } })} titre="Calendriers" />
        <section className="hx-dialwrap"><Cadran date={date} taille={560} />{legende}<header className="hx-th is-sub"><h2>Fil horaire</h2></header><FilHoraire date={date} /></section>
        <PanneauHabitudes date={date} setDate={setDate} />
      </div>
    </main>
  );
}
