---
name: NEXORA
description: "Espace de travail pour projets, tâches et tableaux de bord."
colors:
  life-blue: "#245edb"
  life-blue-hover: "#194bb6"
  life-blue-soft: "#eaf0ff"
  life-surface: "#ffffff"
  life-bg: "#f3f5f9"
  life-soft: "#f7f9fc"
  life-border: "#dce3ed"
  life-border-strong: "#b9c7d8"
  life-text: "#18263d"
  life-secondary: "#53647b"
  life-muted: "#66758b"
typography:
  body:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
  widget-title:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 650
rounded:
  life-control: "9px"
  life-card: "14px"
components:
  button-primary:
    backgroundColor: "{colors.life-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.life-control}"
  card:
    backgroundColor: "{colors.life-surface}"
    rounded: "{rounded.life-card}"
---

# Design System: NEXORA

## Overview

**Creative North Star: "Un espace de travail structuré et lisible"**

Espace de travail pour projets, tâches et tableaux de bord. Le rendu premium repose sur la hiérarchie, les surfaces claires et les commandes explicites. Les couleurs et dimensions personnalisées restent prioritaires sur les valeurs par défaut décrites ici.

Ce document décrit le code inspecté le 16 septembre 2026. Le fil directeur ci-dessus est une synthèse descriptive de cet existant, sans nouvelle identité imposée. Il ne constitue pas une certification d’accessibilité.

**Key Characteristics:**

- Inter et chiffres alignés pour la lecture des données.
- Surfaces bordées, ombres discrètes et commandes identifiables.
- Densité et dispositions adaptées aux usages existants.

Source normative : `apps/nexora/source/index.html.part-000` à `part-004`, notamment la couche finale `body[data-life-app="nexora"]` et les variables `life-*`. Les tokens historiques de `.lp-theme` sont conservés pour compatibilité ; la cascade finale prévaut.

## Colors

### Primary

Le bleu d’action (`life-blue`) identifie les commandes principales et la sélection. Les valeurs exactes du frontmatter sont celles du thème par défaut, pas une contrainte remplaçant les thèmes enregistrés.

### Neutral

La surface, le fond de page, la bordure et les encres forte et secondaire portent la hiérarchie. Réutiliser leurs rôles sémantiques ; ne pas copier une valeur claire dans une surface qui doit suivre un thème sombre.

Les couleurs de projets, groupes et séries restent attachées aux données. La palette globale ne les remplace pas.

## Typography

**Body Font:** 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif.

La couche finale `life-*` fixe le corps à 14px, les titres de widgets à 14px / 650 et les captions à 12px. Les tokens historiques de titres 17, 22 et 34px restent utilisés selon les vues. Le code et les touches utilisent `--life-mono` ; le contenu ordinaire reste en Inter. Les annotations Impact, les métadonnées d’activité et les étiquettes du nuage d’échéances sont fixées à 12px minimum. Les diagrammes denses défilent localement ; la carte de la tâche active est centrée à l’ouverture.

La hiérarchie privilégie des tailles fixes de produit, les libellés explicites et la lisibilité des nombres. Les valeurs du frontmatter décrivent les rôles réellement présents, sans prétendre supprimer toutes les exceptions locales.

## Layout

Les widgets et les vues projet possèdent leurs propres grilles, dimensions sauvegardées et règles de redimensionnement. La couche visuelle commune ne doit pas remplacer ces règles. Les principaux paliers existants sont 1279, 1023, 767 et 479px ; d’autres paliers locaux existent. Les espacements mobiles changent avec les vues, sans échelle universelle complète. La navigation mobile et les contrôles tactiles doivent être vérifiés avec un vrai viewport étroit.

## Elevation & Depth

Les bordures et les différences de surface structurent le contenu au repos. Une ombre discrète accompagne les cartes ; les menus et fenêtres superposées disposent d’une ombre plus ample. Les valeurs exactes observées sont conservées dans `.impeccable/design.json`, sans ajout d’une nouvelle échelle.

Les préférences de mouvement réduit sont prises en charge par des règles existantes. Une animation CSS et une animation graphique JavaScript doivent toutefois être vérifiées séparément.

## Shapes

Les contrôles utilisent le rayon `life-control` et les cartes le rayon `life-card` du frontmatter. Certains chips, composants historiques et thèmes utilisent leurs propres rayons. Ne pas uniformiser les composants sans vérifier leur contexte et leurs préférences.

## Components

### Buttons

La commande principale utilise le bleu d’action et un libellé clair. Les commandes secondaires restent sur la surface avec une bordure. Garder les états de survol, de focus et de désactivation ; réserver les icônes seules aux commandes avec nom accessible.

### Inputs / Fields

Les champs sont bordés et suivent les variables de surface et de texte. Un état de focus visible complète la modification de bordure. Les erreurs doivent rester proches de l’action et proposer une récupération compréhensible.

### Navigation

La sélection combine une surface distincte et un indicateur de bord. Les actions secondaires doivent rester accessibles au clavier, y compris lorsqu’elles apparaissent au survol. Conserver les variantes mobiles et les arborescences existantes.

### Cards / Containers

Le titre, les commandes et le contenu ont des zones distinctes. Les conteneurs défilants doivent laisser la lecture du titre possible. Les tableaux denses peuvent défiler horizontalement dans leur propre zone, sans élargir toute la page.

### Chips

Les chips regroupent une valeur ou un filtre dans une forme compacte. Leur couleur et leur sélection gardent le sens déjà présent dans le module ; leur petite taille ne doit pas réduire une cible tactile nécessaire.

## Do's and Don'ts

### Do:

- Do préserver les thèmes, couleurs métier et préférences enregistrées.
- Do utiliser les variables sémantiques pour les nouvelles surfaces.
- Do vérifier le focus, le zoom et les libellés longs dans le rendu réel.

### Don't:

- Don’t utiliser la seule couleur pour exprimer une erreur ou un état.
- Don’t remplacer les dimensions sauvegardées par une nouvelle grille globale.
- Don’t considérer les tokens comme une preuve de conformité de chaque composant.
