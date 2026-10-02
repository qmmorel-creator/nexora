// Description des dix thèmes sombres (Ref #625). Les couleurs et contrastes viennent de sombres.mjs.
export const SOMBRES = {
  encre: { pour: "Lecture du soir, ambiance studieuse et chaleureuse.", signature: [
    "Halo de lampe doré en haut à droite, contre-jour bleuté en bas à gauche.",
    "Titres en Newsreader (taille optique) : page 27 px, widgets 16 px, chiffres clés de 46 px.",
    "Liseré or en tête de chaque carte et le long de la navigation ; premier indicateur en or.",
    "En-têtes de tableau en italique ; bouton de création en dégradé or.",
  ] },
  aurore: { pour: "Effet le plus spectaculaire, pour les tableaux de bord affichés en continu.", signature: [
    "Fond de fjord traversé de deux lueurs d'aurore (sarcelle à gauche, violet à droite).",
    "Cartes en verre dépoli (flou de 20 px) : l'aurore transparaît sans gêner la lecture.",
    "Chiffres clés en dégradé sarcelle → violet ; onglets en pilules lumineuses.",
    "Barre supérieure et navigation translucides ; fil « aujourd'hui » violet.",
  ] },
  ardoise: { pour: "Les longues journées : le sombre le moins fatigant, sans effet.", signature: [
    "Gris ardoise chaud (#1C1D20) plutôt que noir ; contraste du texte modéré (12:1, pas 20:1).",
    "En-têtes de widgets en bande légèrement plus claire, bordures visibles.",
    "Un seul cuivre pour l'action, l'onglet actif et le chiffre en retard.",
    "Aucun dégradé, aucune lueur : la structure seule.",
  ] },
  phosphore: { pour: "Pilotage par les chiffres : tout ce qui se mesure ressort comme sur un cockpit.", signature: [
    "Coins de cadran ambrés aux quatre angles de chaque widget, lignes de balayage très discrètes.",
    "Chiffres clés en JetBrains Mono légère, ambre lumineux ; le troisième en vert phosphore.",
    "Titres en capitales espacées comme des étiquettes d'instrument ; dates et nombres en chasse fixe.",
    "Onglet actif ambré avec un léger halo.",
  ] },
  velours: { pour: "Un usage personnel soigné, plus doux que technique.", signature: [
    "Voiles rose et or sur fond aubergine ; cartes en verre fumé à grands rayons (16 px).",
    "Boutons et bouton de création en dégradé rose → or.",
    "Onglets en pilules ; chiffres clés de 44 px, un sur deux en rose.",
    "Navigation translucide.",
  ] },
  foret: { pour: "Confort de lecture : Lexend a été conçue pour réduire la fatigue visuelle.", signature: [
    "Sous-bois vert-noir, lueur de canopée en bas à gauche, reflet ambré en haut.",
    "Filet de mousse en dégradé en tête de chaque carte.",
    "Premier indicateur en vert mousse, deuxième en ambre d'automne.",
    "Police Lexend, interlettrage plus ouvert.",
  ] },
  observatoire: { pour: "Effet le plus poétique, tout en restant sobre dans les cartes.", signature: [
    "Champ d'étoiles fixe (quatre tailles, quelques étoiles dorées) et nébuleuses bleue et violette sur le fond.",
    "Cartes légèrement translucides au halo bleuté ; police Sora.",
    "Chiffres clés fins et lumineux (bleu stellaire, or pour le retard).",
    "Fil « aujourd'hui » doré.",
  ] },
  carbone: { pour: "Écrans OLED et goût du minimalisme technique.", signature: [
    "Noir carbone, cartes à peine relevées, aucun séparateur d'en-tête.",
    "Un seul vert citron, réservé à l'action, l'onglet actif et le fil « aujourd'hui ».",
    "Barre d'outils fantôme ; actions des widgets masquées hors survol.",
    "Chiffres en Geist Mono ; puces en contour fin.",
  ] },
  lecture: { pour: "Lire beaucoup de texte le soir : descriptions, notes, comptes rendus.", signature: [
    "Sépia nocturne, aucun dégradé, aucune lueur, aucune ombre.",
    "Atkinson Hyperlegible en 15 px, interligne 1,55 à 1,6 dans les widgets et les fenêtres.",
    "Lignes de tableau plus hautes, titres de widgets 15,5 px gras.",
    "Puces à repère de couleur et texte d'encre.",
  ] },
  cobalt: { pour: "Le Bauhaus que vous aimez, version nuit.", signature: [
    "Bleu cobalt profond, filets crème de 2 px, angles droits, police Outfit.",
    "Indicateurs en tuiles jaune, rouge et crème ; en-têtes de tableau jaunes.",
    "Onglet actif souligné de jaune ; navigation active en aplat jaune.",
    "Ombres pleines décalées pour les menus et le bouton de création.",
  ] },
};
export const PRINCIPES = [
  ["Jamais de noir ni de blanc purs en grandes surfaces", "Le texte est entre 12 et 17:1, pas 20:1 : le blanc pur sur noir pur « bave » et fatigue (halation)."],
  ["La profondeur vient de la lumière", "Plus un élément est haut, plus sa surface est claire ; chaque carte s'éclaire vers le haut avec un liseré clair, au lieu d'ombres invisibles sur fond sombre."],
  ["Des accents clairs et désaturés", "Sur fond sombre, une couleur saturée vibre ; les accents sont éclaircis et adoucis pour rester lisibles sans scintiller."],
  ["Un texte un peu plus gras et plus aéré", "Le texte clair sur fond sombre paraît plus fin : graisse 430 au lieu de 400 et interlettrage légèrement ouvert."],
  ["Des données lisibles partout", "Puces teintées avec texte éclairci, aplats de données assombris sous le texte blanc, heat map inversée (vide = discret, plein = lumineux)."],
  ["Un focus et un « aujourd'hui » lumineux", "Anneau de focus avec halo, fil « aujourd'hui » légèrement rayonnant : on les retrouve d'un coup d'œil."],
];
