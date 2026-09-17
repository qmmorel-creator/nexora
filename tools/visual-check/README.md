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

Scénario `harness.jsx` — Mini-Gantt, deux blocs temporels et
deux encadrés, dont un posé sur des tâches **non successives** :

- aucune erreur JavaScript au rendu ;
- blocs temporels et encadrés présents dans le diagramme ;
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
  superposition des barres ne fait grandir aucune ligne ;
- la référence et les zones d'écart vivent sur un **rail placé sous la barre**,
  jamais dans sa bande : à hauteur égale, elles se lisaient comme son
  prolongement, et la poignée d'avancement semblait avoir de la course qu'elle
  n'avait pas.

Annotations horizontales, traits de jalon et formes de repère :

- une **annotation horizontale** — trait d'une date à une autre, un rond à
  chaque bout, texte libre — se pose à la hauteur de la ligne de **sa** tâche,
  et son calque passe au-dessus des barres ;
- celle qui vise une tâche non affichée ne dessine rien, et ne fait rien tomber ;
- les **deux bouts** d'un trait se règlent séparément : réglés différemment, ils
  ne se dessinent pas pareil ;
- le **trait vertical** sous un jalon n'apparaît que dans le widget qui a coché
  le réglage, et son calque reste derrière les barres et les textes ;
- deux repères de nature différente ne se dessinent jamais pareil : le
  **symbole** les distingue, pas seulement la couleur — y compris pour un type
  ajouté dans les Réglages et pour un jalon dont le type a été supprimé, qui
  retombe sur le premier du catalogue ;
- le catalogue **Réglages > Types de jalon** est monté à côté du diagramme :
  c'est le même catalogue, donc un symbole choisi là est celui qui apparaît ici.

Alignement des titres de bloc :

- dans un widget **sans bande de repères** — donc sans la mesure sur laquelle la
  largeur de piste s'appuyait —, chaque titre reste centré sur sa bande.

Barre d'outils et sous-grille du Mini-Gantt :

- toutes les commandes d'affichage sont **alignées côte à côte** sur une bande
  au-dessus de l'axe, et non empilées en colonne ;
- sur une échelle de neuf ans, l'axe porte des sous-graduations trimestrielles
  et le diagramme une sous-grille verticale : sans elles, neuf traits et rien
  entre eux.

Widget « Bulles » (#92) — deux widgets, dont un avec deux macro-bulles
imbriquées, l'une posée sur des tâches **non successives** :

- les bulles et les bulles de jalon se rendent, et **aucune barre de Mini-Gantt**
  n'est dessinée : le mode bulles remplace la barre, il ne s'y ajoute pas ;
- la colonne d'étiquettes de gauche disparaît — le titre vit dans la bulle ;
- les champs rangés **sous** une bulle restent dans leur ligne : en position
  absolue, ils débordaient sur la ligne suivante et la hauteur mesurée les
  ignorait ;
- trois enveloppes pour deux macro-bulles (l'une coupée en deux), chacune avec
  son remplissage, son libellé et une surface non nulle, toutes dans la zone des
  lignes ;
- deux enveloppes imbriquées ne partagent pas le même sommet ;
- le second widget, groupé par projet et coloré par responsable, rend ses
  en-têtes de groupe et une légende d'au moins deux rangs ;
- les couches superposées partent du **même bord gauche** que la piste d'une
  ligne — axe, grille et cadres de macro-bulles : une gouttière de flex en trop
  les décalait toutes de 6 px (#104) ;
- les champs rangés sous une bulle tiennent **exactement sa largeur**, bord
  gauche et bord droit (#103) ;
- une macro-bulle contenant une tâche d'un jour et deux jalons **contient
  entièrement** leurs bulles : largeur minimale et jalon centré compris (#104) ;
- survoler le corps d'une bulle ouvre l'infobulle, survoler la **poignée
  d'avancement** ne l'ouvre pas, et quitter la poignée la redonne (#106) ;
- un troisième widget réglé sur **trois lignes de description** (#97) : la
  description est bien coupée à trois lignes, la bulle gagne exactement la
  hauteur de ses deux lignes supplémentaires, et son **pied — statut et
  avancement — reste visible** au lieu d'être mangé par `overflow:hidden`.

Ordre des lignes et cadrage du Mini-Gantt :

- un jalon placé **entre deux barres** apparaît bien entre elles, et non en bas
  du widget : barres et jalons sont triés ensemble ;
- un widget réglé sur « Titre » rend un ordre alphabétique, et un autre widget
  garde le sien — le tri est propre à chaque widget ;
- en « Fenêtre glissante », l'axe suit le calendrier et les tâches hors fenêtre
  ne sont plus dessinées du tout.

Parité des réglages du Gantt — la fiche du widget Mini-Gantt et les réglages de
la vue pleine page sont ouverts l'un après l'autre sur le même contexte :

- les deux offrent les mêmes commandes d'affichage (regroupement, couleur des
  barres, informations, disposition, ordre, étendue, mode) ;
- le menu de regroupement est identique de part et d'autre, inactivité et champ
  personnalisé compris ;
- un cadrage « Dates fixes » sans dates affiche le même message des deux côtés ;
- les explications de la fiche (fenêtre glissante, ordre des jalons, mode
  Comparaison) se retrouvent dans la vue.

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
