// Configuration NON SECRÈTE de Nexora Futur (Ref #652, #653).
// La configuration web Firebase est publique par nature (déjà servie par
// nexora-project.org) ; la sécurité repose sur les règles Firestore et Auth.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDj8o9xo5Ui9H4NSGkJ1L4y3HNS4Gu0pjY",
  authDomain: "nexora-cb20d.firebaseapp.com",
  projectId: "nexora-cb20d",
  storageBucket: "nexora-cb20d.firebasestorage.app",
  messagingSenderId: "40640649266",
  appId: "1:40640649266:web:0b84bac80cd290806b842b",
} as const;

// Clés Firestore que Nexora Futur a le droit d'écrire. Décision de Quentin
// (#652) : lecture seule par défaut, ouverture clé par clé dans le lot qui en a
// besoin. Lot 2 (#655, décision du 03/10/2026) : tâches et archive.
// #669 (décision du 03/10/2026) : journal d'activité, journal des habitudes,
// « non applicable », et la clé propre à Futur nexora:futurPrefs.
// Lot 10 (#663) : réglages de projet (projets, dossiers, statuts, types,
// défauts, modèles), favoris et thèmes d'habitudes, écrits élément par élément
// avec la même protection que nexora-project (révision, rejeu, copie de secours).
export const CLES_ECRITURE_OUVERTES: readonly string[] = [
  "nexora:tasks", "nexora:taskArchive",
  "nexora:activityLog", "nexora:habitLog", "nexora:habitSkips", "nexora:futurPrefs",
  "nexora:projects", "nexora:projectFolders", "nexora:statuses", "nexora:taskTypes",
  "nexora:taskDefaults", "nexora:taskTemplates", "nexora:favorites", "nexora:habitThemes",
];
