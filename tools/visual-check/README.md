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

Scénario « Mini-Gantt en mode Comparaison » — un widget jumeau du second (mêmes
tâches, mêmes champs, même regroupement), au mode près, sur des tâches dont cinq
portent des dates de référence (retard, avance, conforme, décalage intégral,
jalon) et deux n'en portent pas, dont un jalon :

- les widgets restés en mode Standard ne dessinent aucune barre de référence,
  bien que les tâches en portent : le mode appartient au widget ;
- une barre de référence par tâche comparable, aucune pour les jalons, qui ont
  un losange fantôme et un segment de liaison ;
- zones d'avance, de retard et de référence non consommée présentes et de
  surface non nulle ;
- un indicateur d'écart par ligne comparable, toujours signé et chiffré ;
- la légende s'ouvre sur Initial, Actuel, Avance, Retard, sans recouvrement ;
- le sélecteur rapide affiche l'état actif ;
- **les hauteurs de ligne sont identiques à celles du widget standard** : la
  superposition des barres ne fait grandir aucune ligne.

Poignée d'avancement du Mini-Gantt :

- une tâche à 100 % remplace son rond blanc par une pastille verte à coche,
  plus grande que le rond ordinaire ;
- les tâches non terminées gardent leur rond, sans coche.

Fiche de CRÉATION d'une tâche :

- la comparaison est activée d'emblée et les deux champs sont remplis avec les
  dates demandées ;
- changer une date après l'ouverture déplace la référence avec elle ;
- une référence saisie à la main n'est plus jamais rattrapée par un changement
  de date ;
- ce qui est enregistré est exactement ce qui était à l'écran.

Fiche de tâche existante, mode comparaison :

- l'interrupteur est décoché sur une tâche qui n'en porte pas, et les champs de
  dates de référence n'existent pas tant qu'il l'est ;
- activé sans dates, deux erreurs explicites s'affichent à côté des champs ;
- « Copier les dates actuelles comme référence » remplit les deux champs depuis
  les dates de la tâche, et seulement au clic ;
- désactiver masque les champs sans effacer ce qui a été saisi.

Scénario « Nuage des échéances » — quatre tâches datées et une sans date de fin,
en couloirs par projet puis par criticité :

- une tâche sans échéance ne devient jamais un point ;
- le retard est à gauche de l'axe « aujourd'hui », et signalé par une couleur qui
  n'est celle d'aucun couloir ;
- deux tâches de même échéance ne se superposent pas ;
- points et étiquettes restent dans le cadre du dessin ;
- les couloirs de criticité suivent l'urgence : Urgent, Moyen, Bas, Sans criticité ;
- l'infobulle apparaît au survol, le clic ouvre la tâche, et le couloir choisi
  dans la fiche du widget est bien enregistré ;
- sans aucune tâche datée, le widget explique pourquoi il n'affiche rien ;
- chaque couloir porte la couleur de son entité en aplat très pâle, et l'axe une
  sous-grille non étiquetée plus fine que les graduations ;
- un point garde la couleur de son groupe en retard comme à venir, le retard
  étant signalé au contour ;
- sur un couloir dense de 36 tâches à titres longs : aucune étiquette n'en
  recouvre une autre ni ne masque un point, aucune ne sort du cadre, et les amas
  produisent des rappels en coude plutôt que de rester muets ;
- en fenêtre fixe, aucune tâche hors plage ne disparaît : elle est rabattue sur
  le bord en chevron, comptée aux deux bouts, et les bornes restent graduées.

Scénario « Treemap par statut » — le même widget, mais une tuile = un statut :

- les tuiles portent des noms de statut, pas des noms de projet ;
- la fiche propose les quatre champs possibles pour les tuiles ;
- dossier, priorité, budget et risques — des notions de projet — ne sont plus
  proposés, ni comme champ de tuile ni comme regroupement ;
- le premier champ de la tuile s'intitule d'après le champ choisi.

Scénario « Heat map croisée » — projet × statut, puis projet × mois d'échéance
avec la mesure « tâches en retard » :

- toutes les cases ont exactement la même taille — c'est ce qui sépare ce widget
  du Treemap, où la surface encode un comptage ;
- une case à zéro porte un chiffre ET une couleur, une case sans tâche n'a ni
  l'un ni l'autre : les deux ne disent pas la même chose ;
- la grille est complète (autant de cases que lignes × colonnes) ;
- l'infobulle nomme le croisement, la fiche propose les six axes et les quatre
  mesures, et l'axe choisi est bien enregistré.

## Pourquoi un dossier séparé

`apps/nexora` est construit par Netlify à chaque publication. Y ajouter React,
Babel et les jeux d'icônes (plusieurs dizaines de Mo) rallongerait chaque build
de production pour un outil qui ne sert qu'au développement. Ce dossier n'est
installé que par qui en a besoin.
