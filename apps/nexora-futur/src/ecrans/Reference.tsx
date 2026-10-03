// Page de référence de l'identité « Clarté » (Ref #654) : /reference.
import { useState } from "react";
import { COULEURS, COUPLES_AA, ECHELLE, contraste, type Mode } from "../theme/jetons";
import { Bouton, Cartouche, Champ, Etat, Kbd, Puce, Segment, Surtitre } from "../composants";
import { ReglagesApparence } from "../composants/ReglagesApparence";

const NUANCIER = ["fond", "surface", "rail", "sel", "ligne", "encre", "encre2", "encre3", "accent", "crit", "alerte", "ok", "info"];

export function Reference() {
  const [lentille, setLentille] = useState<"liste" | "colonnes" | "frise" | "agenda" | "densite">("liste");
  return (
    <div className="page">
      <header className="entete">
        <span className="logo" aria-hidden="true">N</span>
        <strong className="entete-titre">Référence · Clarté</strong>
        <span className="marge-auto" />
        <ReglagesApparence />
      </header>
      <main className="contenu quadrillage">
        <div className="feuille">
          <Cartouche surtitre="Identité visuelle · piste D" titre="Clarté"
            meta={<><span>Inter Tight</span><span>Inter</span><span>JetBrains Mono</span><span>r 8 px · trait 1 px</span></>}
            actions={<Bouton variante="principal" raccourci="⌘↵">Action principale</Bouton>} />

          <section className="panneau ref-bloc">
            <Surtitre>Couleurs · contraste mesuré sur la surface</Surtitre>
            {(["clair", "sombre"] as Mode[]).map((m) => (
              <div key={m} className="ref-nuancier">
                <span className="mono discret">{m}</span>
                {NUANCIER.map((k) => (
                  <div key={k} className="ref-pastille">
                    <i style={{ background: COULEURS[m][k] }} />
                    <span className="mono">{k}</span>
                    <span className="mono discret">{contraste(COULEURS[m][k], COULEURS[m].surface).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ))}
            <p className="discret">{COUPLES_AA.length} couples texte/fond vérifiés à 4,5:1 minimum dans les deux modes (tests/jetons.test.ts).</p>
          </section>

          <section className="panneau ref-bloc">
            <Surtitre>Typographie</Surtitre>
            {Object.entries(ECHELLE).reverse().map(([k, v]) => (
              <div key={k} className="ref-typo"><span className="mono discret">{k} · {v}</span><span style={{ fontSize: v, fontFamily: parseInt(v) >= 20 ? "var(--titre)" : "var(--texte)", fontWeight: parseInt(v) >= 20 ? 600 : 400 }}>PV Contrôles DREAL · 49 jours</span></div>
            ))}
            <div className="ref-typo"><span className="mono discret">mono</span><span className="mono">01/08 → 15/08/2026 · −49 j · rév. 3f9a2c1e</span></div>
          </section>

          <section className="panneau ref-bloc">
            <Surtitre>Commandes</Surtitre>
            <div className="ref-ligne">
              <Bouton variante="principal">Marquer terminée</Bouton><Bouton raccourci="D">Décaler</Bouton><Bouton raccourci="A">Assigner</Bouton>
              <Bouton variante="discret">Annuler</Bouton><Bouton variante="danger">Archiver</Bouton><Bouton disabled>Indisponible</Bouton>
            </div>
            <div className="ref-ligne">
              <Segment etiquette="Lentille" valeur={lentille} onChange={setLentille} options={[
                { valeur: "liste", libelle: "Liste", raccourci: "1" }, { valeur: "colonnes", libelle: "Colonnes", raccourci: "2" },
                { valeur: "frise", libelle: "Frise", raccourci: "3" }, { valeur: "agenda", libelle: "Agenda", raccourci: "4" }, { valeur: "densite", libelle: "Densité", raccourci: "5" }]} />
              <span className="discret">Raccourcis <Kbd>⌘K</Kbd> <Kbd>J</Kbd> <Kbd>K</Kbd> <Kbd>E</Kbd></span>
            </div>
            <div className="ref-ligne">
              <Puce libelle="projet" valeur="CTEX6, Lot 2B" onRetirer={() => undefined} /><Puce libelle="statut" valeur="≠ Terminé" onRetirer={() => undefined} /><Puce libelle="tri" valeur="échéance" />
            </div>
            <div className="ref-ligne">
              <Etat>À planifier</Etat><Etat ton="info">En cours</Etat><Etat ton="alerte">Attente tiers</Etat><Etat ton="ok">Terminé</Etat><Etat ton="crit">Urgent</Etat><Etat ton="accent">Sélection</Etat>
            </div>
            <div className="ref-champs">
              <Champ libelle="Titre" defaultValue="Relancer le bureau de contrôle" />
              <Champ libelle="Échéance" defaultValue="ven. 9 oct." aide="Saisie libre : « vendredi », « +3j », « 9/10 »." />
              <Champ libelle="Responsable" defaultValue="" erreur="Personne introuvable dans l'équipe." />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
