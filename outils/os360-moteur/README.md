# Moteur de graphiques OS360 (#573)

Le widget Nexora « Graphique financier (OS360) » affiche les widgets Budget
d'OS360 **par le code d'OS360 lui-même**. Le bundle d'OS360 redéfinit ses
fonctions de rendu de nombreuses fois au démarrage (`Nf` 10 fois, `lCe` 18
fois), si bien qu'une traduction à la main ne pourrait pas être fidèle.
Nexora sert donc une copie de ce bundle, `apps/nexora/public/os360-moteur/`,
générée par `generer.mjs`.

Cette copie est **générée, jamais modifiée à la main**. Le générateur y apporte
trois changements :

1. un stockage en mémoire à la place de `localStorage` et `sessionStorage` ;
2. le montage de l'application OS360 remplacé par `nxMoteur` (`moteur.js`) ;
3. `moteur.js` ajouté à la fin du module.

Toute la séquence de démarrage d'OS360 s'exécute ; seul l'affichage change.

Le widget charge cette page dans un iframe `sandbox="allow-scripts"`. Comme la
page n'a pas d'origine, elle n'a aucun accès au stockage ni aux cookies de
Nexora. Le widget lui envoie par `postMessage` les tables Budget brutes
(`/api/nexora/finance-budget-data`, session du propriétaire) et la configuration
du widget. Les réglages modifiés dans OS360 (barre de période, panneau de
réglages) repartent vers Nexora, qui les enregistre dans `widget.os360`.

## Mettre à jour après un changement d'OS360

```
node outils/os360-moteur/generer.mjs ../OS360/index.html $(git -C ../OS360 rev-parse HEAD)
npm run verify
```

`source.json` garde le commit OS360 et les empreintes. Le test
`apps/nexora/tests/finance-os360.test.mjs` refuse un moteur modifié à la main,
ainsi qu'un `moteur.js` qui aurait changé sans régénération.

La génération échoue au lieu de produire un moteur cassé dans deux cas :

- un nom minifié utilisé par `moteur.js` n'existe plus dans le bundle ;
- le montage d'OS360 n'est pas trouvé exactement une fois.

Il faut alors adapter `moteur.js` au nouveau bundle.
