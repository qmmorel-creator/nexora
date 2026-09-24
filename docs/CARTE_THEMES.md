# Carte d'exploration : thèmes et progressions

> **Livré dans la vue Carte** (Ref #361). Décisions du 24 septembre 2026 intégrées. Complète
> [`CARTE_ANALOGIES.md`](CARTE_ANALOGIES.md), qui fixe les canaux visuels champ par champ.

## Ce qui change avec le thème, et ce qui ne change pas

Un territoire (un projet) a un **thème** : ville, désert, mer, haute montagne… Le thème décide
du **décor** et des **objets**. Le **sens** des indices, lui, est le même partout, pour qu'on
n'ait jamais à réapprendre la carte en passant d'un territoire à l'autre.

| Universel (même apparence partout) | Propre au thème (même sens, autre objet) |
|---|---|
| Feu rouge / fanion orange : criticité | Relief, sol, eau, végétation du territoire |
| Nuage d'orage : en retard | Centre du territoire et ses 5 paliers de progression |
| Lanterne : échéance sous 7 jours | Les 5 stades d'une tâche (à faire → terminé) |
| Brume : début futur | L'avancement d'une tâche en cours (0 à 100 %) |
| Emprise au sol : durée | La silhouette selon le type (tâche, réunion, planning, jalon) |
| Couleur de tenue d'un habitant : responsable | Le costume de cet habitant |
| Route de convoi : dépendance | Le mécanisme qui tourne : récurrence |
| Étiquette avec couleur réelle du statut | L'aspect de la friche (tâche oubliée) |

## Deux progressions liées au thème

**Progression du territoire.** Elle suit la part de tâches terminées du projet, en 6 paliers
(décision du 24 septembre 2026) :

| Palier | Part de tâches terminées |
|---|---|
| 0 | de 0 à 19 % |
| 1 | de 20 à 39 % |
| 2 | de 40 à 59 % |
| 3 | de 60 à 79 % |
| 4 | de 80 à 99 % |
| 5 | 100 %, projet achevé |

Chaque thème raconte cette montée à sa manière : un terrain vague devient une métropole, un
point d'eau devient une cité-oasis, un camp de base devient un sommet conquis.

**Progression d'une tâche en cours.** Elle suit `progress` avec les mêmes paliers : 0, 20, 40,
60, 80 et 100 %. L'objet se construit par étapes visibles. À 100 % sans statut « Terminé »,
l'objet est complet mais reste sous échafaudage : c'est le statut qui achève, jamais le
pourcentage seul.

## Catalogue des thèmes

> La carte n'a plus qu'un style de rendu, Classique (#404, voir [`CARTE_STYLES.md`](CARTE_STYLES.md)) :
> ce sont les thèmes par dossier ci-dessous qui habillent chaque région.

### Cyberpunk

| | |
|---|---|
| Paysage | Hexagones ardoise, voies gris bleuté, quelques bornes cyan ; relief plat pour circuler librement |
| Progression du territoire | Emplacement → relais → station → nœud → centre de données → réseau central |
| À faire | Emplacement balisé par une petite borne |
| En attente | Terminal en veille |
| En cours (avancement) | Module sous structure légère, hauteur selon `progress` |
| Terminé | Module actif, signal lumineux |
| Information | Borne d'information |
| Tâche · réunion · planning · jalon | Module · station de réunion · tour de synchronisation · balise majeure |
| Récurrence | Petite antenne rotative |
| Sous-tâches | Mini-modules gris ou ambre |
| Friche | Câbles hors service |
| Costume | Personnage actuel, sans ajout de modèle |

Cette option se choisit dans les réglages du dossier ou ceux de la Carte. Elle conserve la grille, la disposition stable, les commandes, la légende et les indices universels. Elle n'entre pas dans l'attribution automatique des thèmes aux dossiers existants.

Chaque fiche utilise les mêmes lignes, dans le même ordre, pour comparer facilement.

### Ville

| | |
|---|---|
| Paysage | Pavés, places, alignements d'arbres, canal |
| Progression du territoire | Terrain vague → maison → village → bourg → ville → **métropole** avec parc et tours |
| À faire | Parcelle jalonnée, piquets et cordeau |
| En attente | Chantier bâché, camion arrêté devant une barrière |
| En cours (avancement) | Immeuble sous grue : fondations → 1er étage → 2e étage → toiture |
| Terminé | Immeuble aux fenêtres éclairées |
| Information | Colonne d'affichage |
| Tâche · réunion · planning · jalon | Atelier · halle couverte · tour de l'horloge · statue sur socle |
| Récurrence | Tramway qui fait le tour du pâté de maisons |
| Sous-tâches | Échoppes accolées (à faire : étal vide ; faite : étal garni) |
| Friche | Herbe entre les pavés, affiches déchirées |
| Costume | Bleu de travail et casque |

### Campagne

| | |
|---|---|
| Paysage | Champs en damier, haies, chemins de terre, étang |
| Progression du territoire | Friche → ferme isolée → hameau → domaine → domaine et moulin → **grand domaine** avec marché |
| À faire | Champ labouré, sillons vides |
| En attente | Charrette dételée au bord du champ |
| En cours (avancement) | Culture qui pousse : pousses → épis verts → épis dorés → moisson en cours |
| Terminé | Meules de foin et grange pleine |
| Information | Panneau de bois au croisement |
| Tâche · réunion · planning · jalon | Grange · place de foire · cadran solaire · château d'eau |
| Récurrence | Moulin à vent |
| Sous-tâches | Bottes de foin (à faire : herbe sur pied ; faite : botte roulée) |
| Friche | Ronces et coquelicots envahissants |
| Costume | Salopette et chapeau de paille |

### Forêt

| | |
|---|---|
| Paysage | Futaie dense, clairières, ruisseau, champignons |
| Progression du territoire | Clairière → camp de bûcherons → hameau forestier → village forestier → cité des cimes sur passerelles → **arbre-monde** |
| À faire | Arbre marqué d'une croix peinte |
| En attente | Grumes empilées en attente de charroi |
| En cours (avancement) | Cabane dans l'arbre : plateforme → murs → toit → échelle |
| Terminé | Cabane éclairée par une lanterne suspendue |
| Information | Panneau gravé sur un tronc |
| Tâche · réunion · planning · jalon | Cabane · cercle de souches autour d'un feu · cadran sur souche · arbre géant |
| Récurrence | Roue à eau de la scierie |
| Sous-tâches | Stères de bois (à faire : tronc ; faite : stère rangé) |
| Friche | Mousse et lierre |
| Costume | Chemise à carreaux |

### Désert

| | |
|---|---|
| Paysage | Dunes, plateaux ocre, cactus, palmiers autour de l'eau |
| Progression du territoire | Point d'eau → campement → oasis → caravansérail → cité caravanière → **cité-jardin** irriguée par des canaux |
| À faire | Piquets plantés dans le sable, ballots posés |
| En attente | Caravane à l'arrêt, dromadaires couchés |
| En cours (avancement) | Puits en creusement : margelle → treuil → eau visible → bassin qui se remplit |
| Terminé | Maison de terre crue avec palmier et bassin |
| Information | Stèle de pierre |
| Tâche · réunion · planning · jalon | Maison de terre crue · grande tente de réception · gnomon · obélisque |
| Récurrence | Noria (roue élévatrice d'eau) |
| Sous-tâches | Jarres (vides à faire ; pleines faites) |
| Friche | Sable qui ensevelit la base |
| Costume | Chèche et tunique |

### Mer

| | |
|---|---|
| Paysage | Côte découpée, falaises, plages, récifs, large bleu profond |
| Progression du territoire | Crique → cabane de pêcheur → port de pêche → port marchand → grand port → **cité portuaire** et sa flotte |
| À faire | Bouée de mouillage libre |
| En attente | Navire au mouillage, voiles ferlées |
| En cours (avancement) | Navire en cale sèche : quille → coque → mâts → voiles |
| Terminé | Navire à quai, voiles hissées, pavillon du projet |
| Information | Balise |
| Tâche · réunion · planning · jalon | Navire · taverne du port · capitainerie et horloge des marées · phare |
| Récurrence | Cloche de bouée qui oscille avec la houle |
| Sous-tâches | Caisses sur le quai (à charger ; chargées) |
| Friche | Rouille et algues |
| Costume | Ciré jaune |

### Lac

| | |
|---|---|
| Paysage | Eau calme au centre du territoire, rives en pente douce, roseaux, îlots |
| Progression du territoire | Rive sauvage → cabane de pêcheur → ponton → village sur pilotis → station lacustre → **cité lacustre** d'îlots reliés |
| À faire | Pieux plantés dans l'eau |
| En attente | Barque amarrée, rames rentrées |
| En cours (avancement) | Ponton qui avance vers le large : pilotis → plancher → garde-corps → abri |
| Terminé | Cabane sur pilotis éclairée, barque à côté |
| Information | Panneau au bout du ponton |
| Tâche · réunion · planning · jalon | Cabane sur pilotis · kiosque sur l'eau · capitainerie · tour de guet |
| Récurrence | Roue à aubes |
| Sous-tâches | Nasses (à poser ; relevées) |
| Friche | Roseaux envahissants, nénuphars |
| Costume | Cuissardes |

### Montagne

| | |
|---|---|
| Paysage | Alpages en terrasses, sapins, torrents, rochers |
| Progression du territoire | Alpage → bergerie → hameau → village d'alpage → station avec téléphérique → **bourg de montagne** |
| À faire | Cairn |
| En attente | Chalet sous la neige, volets fermés |
| En cours (avancement) | Chalet en construction : soubassement de pierre → charpente → toit → cheminée |
| Terminé | Chalet avec fumée à la cheminée |
| Information | Panneau jaune de randonnée |
| Tâche · réunion · planning · jalon | Chalet · salle commune du refuge · clocher · croix du col |
| Récurrence | Éolienne du refuge |
| Sous-tâches | Tas de bois contre le mur (à couper ; rangé) |
| Friche | Éboulis |
| Costume | Veste en laine et bâton |

### Haute montagne

| | |
|---|---|
| Paysage | Glaciers, crêtes, parois, neige éternelle ; le relief monte vers le centre |
| Progression du territoire | Moraine → camp de base → camp 1 → camp 2 → refuge au col → **sommet conquis**, drapeau du projet |
| À faire | Voie tracée au pied de la paroi, cordes lovées |
| En attente | Tente fermée, attente d'une fenêtre météo |
| En cours (avancement) | Cordée sur la voie : l'altitude de la cordée suit le pourcentage |
| Terminé | Tente d'altitude plantée, fanion sur le rocher |
| Information | Plaque scellée au rocher |
| Tâche · réunion · planning · jalon | Tente d'altitude · tente-mess du camp de base · station météo · sommet secondaire au drapeau |
| Récurrence | Drapeaux de prière qui flottent |
| Sous-tâches | Relais de corde (à poser ; posés) |
| Friche | Congère qui recouvre l'objet |
| Costume | Doudoune et casque |

### Grand Nord

| | |
|---|---|
| Paysage | Banquise, fjords, icebergs, toundra rase |
| Progression du territoire | Banquise vierge → abri de trappeur → campement → village d'igloos → base polaire → **station sous aurores boréales** |
| À faire | Traîneau chargé |
| En attente | Traîneau à l'arrêt, chiens couchés |
| En cours (avancement) | Igloo monté en spirale : 1er rang → 2e rang → 3e rang → voûte |
| Terminé | Igloo éclairé de l'intérieur |
| Information | Petit inukshuk |
| Tâche · réunion · planning · jalon | Igloo · grande maison commune · station météo · tour radar |
| Récurrence | Éolienne de la base |
| Sous-tâches | Trous de pêche dans la glace (à forer ; forés) |
| Friche | Givre et glace |
| Costume | Parka à capuche fourrée |

### Canyon

| | |
|---|---|
| Paysage | Falaises rouges en strates, rivière au fond, arches, plateaux |
| Progression du territoire | Gorge → campement → premières grottes → village troglodyte → pont suspendu et mine → **cité troglodyte illuminée** |
| À faire | Corde fixée au bord de la falaise |
| En attente | Nacelle arrêtée à mi-hauteur |
| En cours (avancement) | Pont suspendu : câbles → planches jusqu'à la moitié → planches jusqu'à l'autre rive → rambardes |
| Terminé | Maison troglodyte aux fenêtres éclairées |
| Information | Pétroglyphe |
| Tâche · réunion · planning · jalon | Maison troglodyte · amphithéâtre de pierre · gnomon · arche naturelle |
| Récurrence | Roue de la mine |
| Sous-tâches | Wagonnets (vides ; chargés) |
| Friche | Sable rouge et toiles d'araignée |
| Costume | Casque à lampe |

### Marais

| | |
|---|---|
| Paysage | Eaux dormantes, îlots de terre, saules, roseaux, passerelles de planches |
| Progression du territoire | Vasière → hutte de chasseur → passerelles → hameau sur buttes → village de bateliers → **bourg des canaux** |
| À faire | Piquets plantés dans la vase |
| En attente | Barque plate échouée |
| En cours (avancement) | Passerelle de planches posée tronçon après tronçon |
| Terminé | Hutte sur butte, lanterne allumée |
| Information | Écriteau sur pieu |
| Tâche · réunion · planning · jalon | Hutte sur butte · cercle de barques · échelle de crue graduée · grand saule |
| Récurrence | Lucioles qui s'allument par vagues |
| Sous-tâches | Nasses (à poser ; relevées) |
| Friche | Lentilles d'eau et brume verte |
| Costume | Cuissardes et chapeau de pluie |

### Jungle

| | |
|---|---|
| Paysage | Canopée épaisse, lianes, cascades, fleurs géantes, rivière brune |
| Progression du territoire | Sous-bois → abri de feuilles → camp d'exploration → village sur pilotis → temple dégagé → **cité-temple** en terrasses |
| À faire | Sentier à ouvrir, machette plantée |
| En attente | Pirogue tirée sur la berge |
| En cours (avancement) | Temple dégagé de la végétation : ruine couverte → premières marches → étages → sommet |
| Terminé | Temple restauré, torches allumées |
| Information | Totem sculpté |
| Tâche · réunion · planning · jalon | Case sur pilotis · grande case commune · calendrier de pierre · pyramide à degrés |
| Récurrence | Cascade dont le débit pulse |
| Sous-tâches | Paniers de fruits (vides ; pleins) |
| Friche | Lianes qui recouvrent l'objet |
| Costume | Chapeau d'explorateur |

### Volcan

| | |
|---|---|
| Paysage | Roche noire, coulées refroidies, fumerolles, terre rouge fertile au pied ; le relief monte vers un cratère |
| Progression du territoire | Champ de lave → abri d'observation → sentier balisé → observatoire → village de basalte → **cité géothermique** |
| À faire | Balise plantée dans la cendre |
| En attente | Fumerolle qui gronde, accès fermé par une chaîne |
| En cours (avancement) | Forge alimentée par la lave : enclume → foyer → cheminée → forge rougeoyante |
| Terminé | Maison de basalte aux fenêtres orangées |
| Information | Panneau d'alerte triangulaire |
| Tâche · réunion · planning · jalon | Maison de basalte · amphithéâtre du cratère · sismographe · colonne de basalte |
| Récurrence | Geyser qui jaillit par intervalles |
| Sous-tâches | Blocs de basalte (bruts ; taillés) |
| Friche | Cendre qui recouvre l'objet |
| Costume | Combinaison ignifugée |

### Île tropicale

| | |
|---|---|
| Paysage | Lagon turquoise, sable blanc, cocotiers, récif corallien |
| Progression du territoire | Banc de sable → paillote → ponton → village de pêcheurs → port de plaisance → **île-resort** |
| À faire | Bouée corail au-dessus du récif |
| En attente | Pirogue à balancier amarrée |
| En cours (avancement) | Bungalow sur l'eau : pilotis → plancher → murs de bambou → toit de palmes |
| Terminé | Bungalow éclairé, hamac tendu |
| Information | Coquillage géant posé sur un poteau |
| Tâche · réunion · planning · jalon | Bungalow · paillote-bar · cadran solaire de corail · phare rayé |
| Récurrence | Vagues qui roulent sur le récif |
| Sous-tâches | Noix de coco (sur l'arbre ; récoltées) |
| Friche | Sable et algues échouées |
| Costume | Chemise à fleurs |

## Attribution d'un thème à un projet

Décision du 24 septembre 2026 : **un thème par dossier**.

1. **Par défaut, un thème par dossier.** Tous les projets d'un dossier partagent le thème de
   leur région, ce qui garde une géographie cohérente. Le thème est tiré de l'identifiant du
   dossier, donc stable. Deux régions voisines reçoivent si possible des thèmes différents.
2. **Choix de l'utilisateur.** Dans les réglages de la vue, chaque dossier peut recevoir le thème
   voulu. Ce choix est une **préférence de vue**, comme le zoom du Gantt. Il n'ajoute aucun champ
   aux données et ne touche pas au contrat lu par le MCP.
3. **Projets « À trier »** : îlots du thème Île tropicale, cohérents avec leur isolement au large.

Une suggestion par mots du nom du projet (« quai » → Mer, « chalet » → Montagne) est possible,
mais je ne la propose pas par défaut : un thème deviné sur le titre peut sembler arbitraire.

## Géographie entre les thèmes

- Chaque thème **façonne le relief** de son territoire :
  - Lac : de l'eau au centre, bâtiments en rive ou sur pilotis ;
  - Haute montagne : les tuiles montent en gradins vers un sommet central ;
  - Canyon : une gorge traverse le territoire ;
  - Mer : la moitié du territoire est sous l'eau, côté large.
- Les **lisières** : entre deux projets d'un même dossier, la terre du thème ; entre deux
  dossiers, un bras de mer peu profond, que l'arpenteur traverse à gué. Les régions sont
  entourées d'une mer semée d'îlots boisés.

## Performances

- Chaque thème compte une quinzaine de modèles très simples, construits à partir de formes de
  base (prismes, cônes, boîtes). Ils sont **instanciés**, donc chaque modèle ne coûte qu'un
  seul appel de dessin quel que soit le nombre de tâches.
- Les animations propres aux thèmes (tramway, moulin, téléphérique, drapeaux, aurores) sont
  plafonnées selon la qualité graphique : aucune en qualité basse.
- En vue éloignée, seul le centre de chaque territoire est dessiné en détail, avec son palier
  de progression.

## Décisions prises

1. **15 thèmes** : les 14 d'origine, plus Cyberpunk sélectionnable explicitement.
2. **Un thème par dossier**, modifiable dossier par dossier dans les réglages de la vue.
3. **Paliers du territoire** : 0, 20, 40, 60, 80 et 100 % de tâches terminées.
4. **Progression d'une tâche en cours** : mêmes paliers, appliqués à `progress`.
