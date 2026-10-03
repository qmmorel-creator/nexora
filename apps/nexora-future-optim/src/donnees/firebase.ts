// Accès Firebase de Nexora Futur (Ref #653). Lecture seule : ce module
// n'importe AUCUNE fonction d'écriture Firestore (vérifié par
// tests/lecture-seule.test.ts).
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut,
  GoogleAuthProvider, type User,
} from "firebase/auth";
import { FIREBASE_CONFIG } from "./config";
import { idsSegments, reconstituer, type Manifeste, type Segment } from "./segments";

const app = initializeApp(FIREBASE_CONFIG);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const suivreSession = (rappel: (u: User | null) => void) => onAuthStateChanged(auth, rappel);
export const connexionEmail = (email: string, motDePasse: string) => signInWithEmailAndPassword(auth, email.trim(), motDePasse);
export const connexionGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const deconnexion = () => signOut(auth);

function uidCourant(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Non authentifié");
  return uid;
}

const refCle = (uid: string, cle: string) => doc(db, "users", uid, "kv_store", cle);

async function lireSegments(uid: string, m: Manifeste): Promise<(Segment | null)[]> {
  const ids = idsSegments(m);
  const snaps = await Promise.all(ids.map((id) => getDoc(refCle(uid, id))));
  return snaps.map((s) => (s.exists() ? (s.data() as Segment) : null));
}

export interface LectureCle { cle: string; texte: string; revision: string | null; misAJour: string | null; }

export async function lireCle(cle: string): Promise<LectureCle | null> {
  const uid = uidCourant();
  const snap = await getDoc(refCle(uid, cle));
  if (!snap.exists()) return null;
  const m = snap.data() as Manifeste;
  const texte = reconstituer(cle, m, await lireSegments(uid, m));
  return { cle, texte, revision: m.revision ?? null, misAJour: m.updatedAt ?? null };
}

// Écoute temps réel d'une clé ; chaque nouvelle révision du manifeste relit
// ses segments.
export function ecouterCle(cle: string, rappel: (l: LectureCle | null) => void, erreur: (e: Error) => void): Unsubscribe {
  const uid = uidCourant();
  return onSnapshot(refCle(uid, cle), async (snap) => {
    try {
      if (!snap.exists()) { rappel(null); return; }
      const m = snap.data() as Manifeste;
      rappel({ cle, texte: reconstituer(cle, m, await lireSegments(uid, m)), revision: m.revision ?? null, misAJour: m.updatedAt ?? null });
    } catch (e) { erreur(e as Error); }
  }, (e) => erreur(e));
}
