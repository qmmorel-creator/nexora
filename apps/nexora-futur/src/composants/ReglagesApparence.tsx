import { Segment } from "./index";
import { useApparence } from "../theme/useApparence";

export function ReglagesApparence() {
  const [a, changer] = useApparence();
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Segment etiquette="Mode d'affichage" valeur={a.mode} onChange={(mode) => changer({ mode })}
        options={[{ valeur: "auto", libelle: "Auto" }, { valeur: "clair", libelle: "Clair" }, { valeur: "sombre", libelle: "Sombre" }]} />
      <Segment etiquette="Densité" valeur={a.densite} onChange={(densite) => changer({ densite })}
        options={[{ valeur: "compacte", libelle: "Compacte" }, { valeur: "confortable", libelle: "Confortable" }]} />
    </div>
  );
}
