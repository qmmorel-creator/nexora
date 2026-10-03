// SEUL module autorisé à écrire dans Firestore (Ref #655 ; vérifié par
// tests/lecture-seule.test.ts). Toute écriture passe par la garde : seules les
// clés de CLES_ECRITURE_OUVERTES sont acceptées.
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "./firebase";
import { CLES_ECRITURE_OUVERTES } from "./config";
import { exigerEcriture } from "./garde";
import { idsSegments, reconstituer, type Manifeste, type Segment } from "./segments";
import { ErreurConflit, jetonRevision, planifierEcriture } from "./plan-ecriture";

const ESSAIS = 3;

const nouvelleRevision = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function lireActuel(uid: string, cle: string): Promise<{ texte: string; revision: string | null }> {
  const snap = await getDoc(doc(db, "users", uid, "kv_store", cle));
  if (!snap.exists()) return { texte: "", revision: null };
  const m = snap.data() as Manifeste;
  const segs = await Promise.all(idsSegments(m).map((id) => getDoc(doc(db, "users", uid, "kv_store", id))));
  return { texte: reconstituer(cle, m, segs.map((s) => (s.exists() ? (s.data() as Segment) : null))), revision: jetonRevision(m) };
}

// Applique `transformer` à la version la plus récente de la clé et l'écrit si
// personne n'a écrit entre la lecture et la transaction ; sinon relit et
// rejoue (l'opération porte sur un élément précis, pas sur tout le tableau).
export async function modifierCle(cle: string, transformer: (texte: string) => string): Promise<{ revision: string }> {
  exigerEcriture(cle, CLES_ECRITURE_OUVERTES);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Non authentifié");
  let derniere: unknown = null;
  for (let essai = 0; essai < ESSAIS; essai++) {
    const actuel = await lireActuel(uid, cle);
    const texte = transformer(actuel.texte);
    const revision = nouvelleRevision();
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "kv_store", cle);
        const snap = await tx.get(ref);
        const distant = snap.exists() ? (snap.data() as Manifeste) : null;
        const ops = planifierEcriture(cle, texte, actuel.revision, distant, new Date().toISOString(), revision);
        for (const op of ops) {
          const r = doc(db, "users", uid, "kv_store", op.id);
          if (op.type === "supprimer") tx.delete(r); else tx.set(r, op.donnees);
        }
      });
      return { revision };
    } catch (e) {
      if (!(e instanceof ErreurConflit)) throw e;
      derniere = e;
    }
  }
  throw derniere;
}
