#!/usr/bin/env node
// Point d'entrée unique de publication Nexora — Ref #544.
// Usage : outils/publier <commande> [options] — voir docs/PUBLICATION.md.
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { creerClientNetlify } from "./lib/netlify.mjs";
import { creerGit } from "./lib/git.mjs";
import { construire } from "./lib/construction.mjs";
import { creerLecteurHttp } from "./lib/verification.mjs";
import { lireVerdict } from "./lib/verdict.mjs";
import { CHEMIN_REGISTRE } from "./lib/registre.mjs";
import * as commandes from "./commandes.mjs";

const AIDE = `outils/publier <commande>

  etat                                   productions servies, préproduction, registre, garde-fous, divergences
  garde [--arreter]                      lit (ou arrête) les builds Git Netlify des deux projets
  preproduction [--ref develop] [--essai] construit et dépose un brouillon « preprod » (application, données fictives)
  preparer --version X.Y.Z               déclare la version et date la section « À venir » du changelog
  production --version X.Y.Z --commit <sha> [--composants application,mcp]
             --essai                     prérequis et plan, aucune modification distante
             --brouillon                 construit en configuration de production et vérifie les brouillons, sans promouvoir
             --accord "<citation>"       promotion officielle après feu vert explicite de Quentin
             --sans-recette "<raison>"   exception motivée et tracée, jamais automatique
  retour --version Y [--sites application,mcp] [--essai]   republie les Deploy IDs connus, sans reconstruction
`;

function options(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const [cle, valeur] = a.slice(2).split("=", 2);
    const nom = cle.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (valeur !== undefined) o[nom] = valeur;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) o[nom] = argv[++i];
    else o[nom] = true;
  }
  return o;
}

function dependances(racine, { essai = false } = {}) {
  const git = creerGit(racine);
  const executer = (args, cwd) => git.brut(args, { cwd });
  return {
    racine, git, essai, env: process.env,
    api: creerClientNetlify(),
    lire: creerLecteurHttp(),
    verdict: (sha) => lireVerdict({ sha }),
    construire,
    attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
    maintenant: () => new Date().toISOString(),
    journal: (m) => console.error(`  · ${m}`),
    // Écriture ciblée du registre sur main : worktree temporaire sur
    // origin/main, commit, push sans force ; relu et rejoué si main a avancé.
    async committerRegistre(contenu, message) {
      for (let essai = 1; essai <= 3; essai++) {
        git.rafraichir("main");
        const dossier = await mkdtemp(path.join(tmpdir(), "nexora-registre-"));
        const arbre = path.join(dossier, "main");
        try {
          git.ajouterWorktree(arbre, git.sha("origin/main"));
          await writeFile(path.join(arbre, CHEMIN_REGISTRE), contenu);
          executer(["add", CHEMIN_REGISTRE], arbre);
          executer(["commit", "-m", message], arbre);
          try { executer(["push", "origin", "HEAD:refs/heads/main"], arbre); return { ok: true, commit: executer(["rev-parse", "HEAD"], arbre) }; }
          catch (e) { if (essai === 3) return { ok: false, erreur: `push du registre refusé (${e.message.split("\n")[0]}) : état distant à réconcilier ; le journal publication/.journal/reprise.jsonl fait foi` }; }
        } finally { git.retirerWorktree(arbre); await rm(dossier, { recursive: true, force: true }); }
      }
    },
    async creerTagEtRelease({ version, sha, plan }) {
      const tag = `v${version}`;
      const existant = git.tag(tag);
      if (existant && existant !== sha) return `refusé : ${tag} existe sur ${existant}`;
      if (!existant) { git.brut(["tag", "-a", tag, sha, "-m", `Nexora ${version}`]); git.brut(["push", "origin", `refs/tags/${tag}`]); }
      const jeton = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      const changelog = await readFile(path.join(racine, "CHANGELOG.md"), "utf8");
      const section = (new RegExp(`## \\[${version.replace(/\./g, "\\.")}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(changelog) || [])[1] || "";
      const corps = `${section.trim()}\n\n## Publication\n\n| Composant | Décision | Deploy ID | Recette |\n|---|---|---|---|\n${plan.composants.map((c) => `| ${c.composant} | ${c.decision} | ${c.deployId || "inchangé"} | ${c.recette?.permalien || c.recette?.exception || "—"} |`).join("\n")}\n\nCI : ${plan.verdict.url || "—"}\n`;
      if (!jeton) return `${tag} créé ; release à créer (aucun jeton GitHub)`;
      const r = await fetch("https://api.github.com/repos/qmmorel-creator/nexora/releases", {
        method: "POST", headers: { Authorization: `Bearer ${jeton}`, Accept: "application/vnd.github+json" },
        body: JSON.stringify({ tag_name: tag, name: `Nexora ${version}`, body: corps }),
      }).catch((e) => ({ ok: false, status: e.message }));
      return r.ok ? `${tag} et release créés` : `${tag} créé ; release à reprendre (HTTP ${r.status}) sans republier`;
    },
  };
}

const principal = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (principal) {
  const o = options(process.argv.slice(2));
  const racine = path.resolve(import.meta.dirname, "..", "..");
  const [commande] = o._;
  try {
    let r;
    if (!commande || o.aide || o.help) { console.log(AIDE); process.exit(commande ? 0 : 1); }
    const d = dependances(racine, { essai: !!o.essai });
    if (commande === "etat") r = await commandes.etat(d);
    else if (commande === "garde") r = await commandes.garde(d, { arreter: !!o.arreter, retablir: !!o.retablir });
    else if (commande === "preproduction") r = await commandes.preproduction(d, { ref: o.ref || "develop", composants: o.composants });
    else if (commande === "preparer") r = await commandes.preparer(d, { version: o.version });
    else if (commande === "production") r = await commandes.production(d, { version: o.version, commit: o.commit, composants: o.composants, essai: !!o.essai, brouillon: !!o.brouillon, sansRecette: o.sansRecette || null, accord: o.accord || null });
    else if (commande === "retour") r = await commandes.retour(d, { version: o.version, sites: o.sites, essai: !!o.essai });
    else { console.error(`Commande inconnue : ${commande}\n\n${AIDE}`); process.exit(2); }
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e instanceof commandes.Refus ? `REFUS — ${e.message}` : `ERREUR — ${e.message}`);
    process.exit(e instanceof commandes.Refus ? 3 : 1);
  }
}
