# Journal des versions — Nexora

Versions officielles de Nexora (application, API, fonctions planifiées et MCP),
au format `MAJEUR.MINEUR.CORRECTIF[-rc.N]`, majeure `0` tant que le produit est en
démonstration. La version déclarée vit dans `publication/version.json` ; la
production réellement servie, composant par composant, dans
`publication/registre.json`. Voir [`docs/PUBLICATION.md`](docs/PUBLICATION.md).

Chaque lot ajoute ses lignes sous « À venir ». `outils/publier preparer --version X.Y.Z`
transforme cette section en `[X.Y.Z] — date` au moment de préparer la version.

## À venir

### Nouveautés

- Tableau de bord : widgets « Sankey mensuel (flux) » et « Structure du patrimoine (Sankey) » repris d'OS360 à l'identique (calcul, mise en page, infobulles, données), alimentés en lecture seule par KDM360 via `/api/nexora/finance-sankey-data` (session du propriétaire vérifiée) (Ref #569).

### Corrections

### Incompatibilités

## À venir

### Incompatibilités

- Retour à la publication systématique : chaque fusion dans `main` publie la production (builds Git Netlify) ; préproduction abandonnée (Ref #553).

## [0.1.1] — 2026-09-30

### Nouveautés

- Pixel Tasks, « Rameaux » : un fil pointillé descend de chaque bourgeon le long des tâches du sous-groupe, avec un nœud par tâche, plein quand elle est terminée (Ref #546).



## [0.1.0] — 2026-09-30

### Nouveautés

- Versions officielles, environnements local et préproduction, publication volontaire et réversible par `outils/publier` (Ref #544).
- `version.json` public sur chaque site ; bandeau LOCAL / PRÉPRODUCTION et `noindex` hors production.
- Préproduction en données fictives : aucun accès à Firebase de production, aucune fonction déposée.
- Pixel Tasks : sous-groupes « Rameaux » sous les groupes principaux (projet, dossier, statut, responsable, type, jalon/durée) — tronc, rameaux, bourgeons qui éclosent, ruban spectral (Ref #546).


### Incompatibilités

- Une fusion dans `main` ne publie plus la production : la publication passe par `outils/publier production`, après feu vert explicite.
- Branche `develop` abandonnée : les PR visent `main`, la préproduction se fait depuis `main` (Ref #549).

## État initial (non versionné) — relevé du 29/09/2026

Aucune release vérifiable ne précédait ce mécanisme. Productions servies au relevé :
application `6abbe79f8b2d340008fd780f` (commit `445bc3a03f2b`), MCP
`6abb99a8d32416000815a1f7` (commit `a46b51d549e9`). Aucun tag rétroactif.
