// Accès Git de l'outil de publication — Ref #544.
// Lecture seule, sauf ajout/retrait de worktrees temporaires et écriture du
// registre (registre.mjs). Ne déplace jamais la branche courante et ne touche
// jamais aux modifications en cours de Quentin (pas de stash, pas de checkout).
import { execFileSync } from "node:child_process";

export function creerGit(racine) {
  const git = (args, options = {}) => execFileSync("git", args, { cwd: racine, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
  const essayer = (args) => { try { return git(args); } catch { return null; } };
  return {
    racine,
    brut: git,
    rafraichir(branche = "main") { git(["fetch", "--quiet", "origin", `+refs/heads/${branche}:refs/remotes/origin/${branche}`]); },
    sha(ref) {
      const s = essayer(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      if (!s) throw new Error(`Référence introuvable : « ${ref} ».`);
      return s;
    },
    contient(ancetre, descendant) { return essayer(["merge-base", "--is-ancestor", ancetre, descendant]) !== null; },
    fichier(sha, chemin) { return essayer(["show", `${sha}:${chemin}`]); },
    arbre(sha, chemins) {
      const sortie = git(["ls-tree", "-r", "--full-tree", sha, "--", ...chemins]);
      return sortie ? sortie.split("\n") : [];
    },
    arbreRacine(sha) { return git(["rev-parse", `${sha}^{tree}`]); },
    tag(nom) { return essayer(["rev-parse", "--verify", "--quiet", `refs/tags/${nom}^{commit}`]); },
    dateCommit(sha) { return git(["show", "-s", "--format=%cI", sha]); },
    ajouterWorktree(dossier, sha) { git(["worktree", "add", "--detach", "--force", dossier, sha]); },
    retirerWorktree(dossier) { essayer(["worktree", "remove", "--force", dossier]); essayer(["worktree", "prune"]); },
  };
}
