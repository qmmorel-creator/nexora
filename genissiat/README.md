# Génissiat — jumeau numérique 3D

Page unique et autoportante : [`genissiat.html`](genissiat.html). Elle simule le barrage-centrale
CNR de Génissiat (éclusées, 6 groupes, équipes en 3×8, chantiers, météo) sur le relief réel.

## Régénérer les données

```sh
pip install -r tools/requirements.txt
python tools/prepare_data.py      # télécharge IGN + OSM → data/terrain.json, data/ortho.jpg, data/osm.json, data/report.json
python tools/build_page.py        # embarque les données dans genissiat.html (16 Mo maximum)
```

- Les réponses brutes des services sont gardées dans `data/raw/` (hors git).
  `prepare_data.py --offline` les retraite sans réseau.
- `data/report.json` consigne les contrôles de cohérence : cote de l'eau lue sur le MNT
  (retenue ~330 m, Rhône aval ~260 m), altitude des plateaux (420–480 m), éléments OSM trouvés.
- `build_page.py --sans-donnees` construit la page avec le relief estimé de la première version.
- La page elle-même se modifie dans `src/genissiat.src.html`, jamais dans `genissiat.html`.

## Sources

| Donnée | Source | Licence |
|---|---|---|
| Relief | IGN RGE ALTI 5 m, Géoplateforme (WMS-R `ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES`, repli : API altimétrie), ré-échantillonné à 10 m | Licence Ouverte Etalab 2.0 |
| Orthophoto | IGN BD ORTHO, Géoplateforme (WMS-R `ORTHOIMAGERY.ORTHOPHOTOS`), 2048 px, JPEG | Licence Ouverte Etalab 2.0 |
| Implantations | OpenStreetMap via Overpass API : barrage, usine, bâtiments, routes, lignes HT, pylônes, poste, plans d'eau | ODbL — © les contributeurs d'OpenStreetMap |
| Caractéristiques | CFBR, CNR, Wikipédia (cotes de crête 335,7 m et de retenue normale 330,7 m NGF, dimensions) | — |

Repère local : origine au milieu de la crête (géométrie OSM `waterway=dam`), x = est, z = sud,
y = altitude m NGF, axes de la grille Lambert 93 (EPSG:2154). Aucune donnée Google.

Scripts de la page : Three.js 0.160 et Chart.js 4.4.1 depuis `cdn.jsdelivr.net/npm`, versions figées.
