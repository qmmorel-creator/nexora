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
// besoin. Lot 2 (#655, décision du 03/10/2026) : tâches et archive seulement.
export const CLES_ECRITURE_OUVERTES: readonly string[] = ["nexora:tasks", "nexora:taskArchive"];
