# Contrôle visuel hors ligne

L'interface Nexora charge React, Babel, lucide, Tabler et Firebase depuis des
CDN. Dans un environnement sans accès à ces domaines — un agent, un runner CI,
un train — la page n'affiche que son écran de chargement : **impossible de
constater qu'un rendu est correct**, et facile de croire à tort que l'application
a démarré.

Ce banc d'essai reconstruit les mêmes dépendances depuis npm, bouchonne Firebase
et monte directement les composants sur les données de démonstration du fichier.
Il ne remplace pas une recette sur la production : il vérifie que les composants
se rendent et que la géométrie des annotations est juste.

## Utilisation

```bash
cd tools/visual-check
npm install          # une seule fois (dépendances locales, hors build Netlify)
npm start            # construit le banc, contrôle le rendu, écrit la capture
```

La capture est écrite dans `tools/visual-check/.harness/annotations.png`, et le
script sort en erreur si un contrôle échoue.

`playwright` est facultatif : sans lui, le banc est tout de même construit et le
script indique comment l'ouvrir à la main (`npx http-server .harness`). Pour
l'activer, soit `npm install playwright` dans ce dossier, soit un Playwright
déjà présent sur la machine — dans ce cas, indiquer où le trouver :

```bash
NODE_PATH=$(npm root -g) npm start
CHROMIUM_PATH=/chemin/vers/chromium NODE_PATH=$(npm root -g) npm start   # binaire hors emplacement par défaut
```

## Ce qui est contrôlé

Scénario `harness.jsx` — Gantt complet et Mini-Gantt, deux blocs temporels et
deux encadrés, dont un posé sur des tâches **non successives** :

- aucune erreur JavaScript au rendu ;
- blocs temporels et encadrés présents dans les deux diagrammes ;
- l'encadré non successif produit bien deux cadres distincts ;
- les étiquettes de cadres ne se superposent pas ;
- les cadres ont une surface non nulle et restent dans la zone des lignes.

## Pourquoi un dossier séparé

`apps/nexora` est construit par Netlify à chaque publication. Y ajouter React,
Babel et les jeux d'icônes (plusieurs dizaines de Mo) rallongerait chaque build
de production pour un outil qui ne sert qu'au développement. Ce dossier n'est
installé que par qui en a besoin.
