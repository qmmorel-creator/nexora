# Maquettes du Rucher (Ref #361)

Trois directions visuelles proposées avant développement. **Données fictives uniquement** (`data.js`).

| Maquette | Direction |
|---|---|
| A · Prairie | Vue intégrée au cadre Nexora, caméra proche qui suit l'apiculteur, palette vive, panneau latéral |
| B · Atlas | Vue haute de lecture, liste des territoires par dossier, tiroir de détail, test à 300 projets |
| C · Veillée | Lumière de fin de journée, interface de jeu mobile (manette, bouton « Lire », fiche en tiroir) |

- `layout.js` : disposition hexagonale déterministe (module pur, testable sous Node).
- `engine.js` : rendu three.js instancié, apiculteur, caméra, contrôles, libellés sans chevauchement.
- `ui.js` : panneau de détail, filtres, repli sans WebGL.
- `node build.mjs a b c` produit `out/rucher-*.html` ; three.js 0.158.0 est chargé depuis jsDelivr
  (installer `three@0.158.0` dans ce dossier pour la version locale de test).

Ces fichiers ne sont pas servis par Netlify. Correspondance données → monde : `../CARTE_ANALOGIES.md`.
