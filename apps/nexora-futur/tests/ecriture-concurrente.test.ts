import { describe, expect, it } from "vitest";
import { ErreurConflit, modifierAvecRejeu, type Stockage } from "../src/donnees/plan-ecriture";
import { copiesSecours, garderSecours, marquerEchec, oublierSecours } from "../src/donnees/secours";
import { ajouterElement, majElement } from "../src/donnees/reglages";

// Une clé partagée et deux sessions, comme deux onglets (ou Futur et
// nexora-project) : l'écriture exige la révision lue, sinon conflit.
function base(texte: string) {
  const etat = { texte, revision: "r0", n: 0 };
  const session = (avantEcriture?: () => Promise<void>): Stockage => ({
    lire: async () => ({ texte: etat.texte, revision: etat.revision }),
    ecrire: async (t, lue) => {
      if (avantEcriture) { const f = avantEcriture; avantEcriture = undefined; await f(); }
      if (lue !== etat.revision) throw new ErreurConflit("conflit");
      etat.texte = t; etat.revision = `r${++etat.n}`; return etat.revision;
    },
  });
  return { etat, session };
}
const ajouter = (el: { id: string; name: string }) => (t: string) => JSON.stringify(ajouterElement(JSON.parse(t || "[]"), el));

describe("écritures concurrentes (Ref #663)", () => {
  it("deux sessions ajoutent en même temps : le rejeu garde les deux", async () => {
    const { etat, session } = base(JSON.stringify([{ id: "a", name: "A", inconnu: 1 }]));
    const b = session();
    // A lit, B écrit avant que A n'écrive : A est en conflit, relit et rejoue.
    const a = session(() => modifierAvecRejeu(b, ajouter({ id: "b", name: "B" })).then(() => undefined));
    await modifierAvecRejeu(a, ajouter({ id: "c", name: "C" }));
    expect(JSON.parse(etat.texte).map((x: { id: string }) => x.id)).toEqual(["a", "b", "c"]);
    expect(JSON.parse(etat.texte)[0].inconnu).toBe(1);
  });
  it("modifications du même élément : chaque champ modifié est gardé", async () => {
    const { etat, session } = base(JSON.stringify([{ id: "p", name: "Projet", color: "#000" }]));
    const b = session();
    const a = session(() => modifierAvecRejeu(b, (t) => JSON.stringify(majElement(JSON.parse(t), "p", { color: "#f00" }))).then(() => undefined));
    await modifierAvecRejeu(a, (t) => JSON.stringify(majElement(JSON.parse(t), "p", { name: "Renommé" })));
    expect(JSON.parse(etat.texte)).toEqual([{ id: "p", name: "Renommé", color: "#f00" }]);
  });
  it("après trois conflits, l'écriture échoue sans rien écraser", async () => {
    const { etat, session } = base("[]");
    let autre = 0;
    const toujours: Stockage = { ...session(), ecrire: async () => { autre++; etat.revision = `x${autre}`; throw new ErreurConflit("conflit"); } };
    await expect(modifierAvecRejeu(toujours, ajouter({ id: "z", name: "Z" }))).rejects.toBeInstanceOf(ErreurConflit);
    expect(autre).toBe(3);
    expect(etat.texte).toBe("[]");
  });
});

describe("copie de secours locale", () => {
  const memoire = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
  it("gardée avant l'envoi, effacée après confirmation, conservée avec l'erreur sinon", () => {
    const s = memoire();
    garderSecours("nexora:projects", "[1]", "2026-10-03T10:00:00Z", s);
    garderSecours("nexora:statuses", "[2]", "2026-10-03T09:00:00Z", s);
    expect(copiesSecours(s).map((c) => c.cle)).toEqual(["nexora:statuses", "nexora:projects"]);
    oublierSecours("nexora:projects", s);
    marquerEchec("nexora:statuses", "Conflit", s);
    expect(copiesSecours(s)).toEqual([{ cle: "nexora:statuses", texte: "[2]", le: "2026-10-03T09:00:00Z", erreur: "Conflit" }]);
  });
});
