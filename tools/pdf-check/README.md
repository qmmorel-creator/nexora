# Recette de rendu PDF

Contrôle hors ligne de la « Fiche projet PDF » (#291), séparé de `apps/nexora`
pour n'alourdir ni la CI ni le build Netlify — même principe que
`tools/visual-check`.

Le script teste le code du bundle **réellement construit**
(`apps/nexora/.build/index.html`), extrait entre ses sentinelles
`NEXORA:PROJECT-PDF-*`, avec la même version de jsPDF que l'application (2.5.2).

## Utilisation

```bash
npm run build --prefix apps/nexora   # produit apps/nexora/.build/index.html
cd tools/pdf-check
npm install                          # une seule fois
npm start                            # cas Maïa Sonnier, projet long, projet vide
```

Rejouer un instantané relu au moment de la recette (catalogues au format
`{ projects, statuses, taskTypes, teamMembers, tasks }`) :

```bash
node run.mjs --catalogs instantane.json --project <id> --today 2026-09-22
```

Poppler (`pdftoppm`, `pdftotext`, `pdfinfo`) doit être installé.

## Ce qui est contrôlé

- les données d'entrée ne sont pas modifiées par l'export (lecture seule) ;
- nom de fichier `nexora-fiche-projet-<slug>-<AAAA-MM-JJ>.pdf`, format A4 portrait ;
- aucun mot hors de la zone imprimable, aucun chevauchement entre deux mots
  (boîtes extraites par `pdftotext -bbox-layout`) ;
- présence des libellés attendus, absence de caractère illisible ;
- rendu raster de chaque page dans `.out/<cas>-<page>.png` pour contrôle visuel.
