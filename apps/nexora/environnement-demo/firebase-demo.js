// Firebase de démonstration — local et préproduction uniquement (Ref #544).
//
// Remplace les trois modules du SDK Firebase (app, firestore, auth) dans les
// constructions hors production. Aucune requête réseau : un compte fictif est
// connecté d'office, les lectures Firestore directes sont vides et toute
// écriture Firestore directe échoue explicitement. Les données de l'interface
// passent par window.storage (voir stockage-demo.js), jamais par ce module.
//
// Ce fichier n'est jamais copié dans une construction de production : le build
// refuse une sortie de production qui le référence.

const noop = () => {};
const indisponible = (quoi) => Promise.reject(new Error(`${quoi} : Firebase est désactivé dans l'environnement de démonstration.`));

export const COMPTE_DEMO = Object.freeze({
  uid: "demo-utilisateur",
  email: "demo@exemple.invalid",
  displayName: "Compte de démonstration",
  isAnonymous: false,
  providerData: [],
  getIdToken: async () => "jeton-de-demonstration",
});

// --- firebase-app ---
export const initializeApp = (config) => {
  if (config && config.projectId && !String(config.projectId).startsWith("demo-")) {
    throw new Error(`Projet Firebase « ${config.projectId} » refusé : seul un projet demo-… est admis hors production.`);
  }
  return { name: "demo", options: config || {} };
};

// --- firebase-firestore ---
const snapshotVide = { empty: true, size: 0, docs: [], forEach: noop };
export const getFirestore = () => ({ type: "demo" });
export const doc = (...chemin) => ({ path: chemin.slice(1).join("/") });
export const collection = (...chemin) => ({ path: chemin.slice(1).join("/") });
export const query = (ref) => ref;
export const orderBy = () => ({});
export const startAt = () => ({});
export const endAt = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => undefined });
export const getDocs = async () => snapshotVide;
export const onSnapshot = () => noop;
export const setDoc = () => indisponible("Écriture Firestore");
export const deleteDoc = () => indisponible("Suppression Firestore");
export const runTransaction = () => indisponible("Transaction Firestore");

// --- firebase-auth ---
const auth = { currentUser: COMPTE_DEMO, type: "demo" };
export const getAuth = () => auth;
export const onAuthStateChanged = (_auth, rappel) => { setTimeout(() => rappel(COMPTE_DEMO), 0); return noop; };
export const signInWithEmailAndPassword = async () => ({ user: COMPTE_DEMO });
export const createUserWithEmailAndPassword = async () => ({ user: COMPTE_DEMO });
export const signOut = async () => {};
export const sendPasswordResetEmail = () => indisponible("Réinitialisation du mot de passe");
export class GoogleAuthProvider { addScope() {} setCustomParameters() {} }
export const linkWithPopup = () => indisponible("Connexion Google");
export const signInWithPopup = () => indisponible("Connexion Google");
export const reauthenticateWithPopup = () => indisponible("Connexion Google");
