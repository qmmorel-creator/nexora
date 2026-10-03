// Journée (Ref #688) : Pixel Tasks | Cadran + fil horaire | Habit Pixel.
import { useState } from "react";
import { jourLong, useOptim } from "./contexte";
import { Cadran, FilHoraire, PanneauHabitudes, PanneauTaches } from "./jour";

export function Journee() {
  const { jour, d, couleurHabitude } = useOptim();
  const [date, setDate] = useState(jour);
  return (
    <main className="hx-main hx-journee" data-scroll>
      <div className="hx-hello"><h1>Journée <span>{jourLong(date)}</span></h1><p>À gauche, les tâches du jour en pixels ; au centre, le cadran (anneau extérieur : les heures ; anneau intérieur : une case par habitude ; au cœur, les deux pixels du jour) ; à droite, les habitudes. Survoler une habitude l'éclaire partout.</p></div>
      <div className="hx-jgrid">
        <PanneauTaches date={date} setDate={setDate} />
        <section className="hx-dialwrap"><Cadran date={date} taille={460} />
          <ul className="hx-legend"><li><i style={{ background: "#7c5cd6" }} />Réunions et tâches à heure fixe <small>(couleur du projet)</small></li>
            {d.themesHabitudes.filter((t) => t.habits.length).map((t) => <li key={t.id}><i style={{ background: t.habits.length === 1 ? couleurHabitude(t.habits[0]) : t.color }} />{t.name}</li>)}</ul>
          <header className="hx-th is-sub"><h2>Fil horaire</h2></header><FilHoraire date={date} /></section>
        <PanneauHabitudes date={date} setDate={setDate} />
      </div>
    </main>
  );
}
