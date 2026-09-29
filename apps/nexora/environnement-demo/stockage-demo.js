// Stockage de démonstration — local et préproduction uniquement (Ref #544).
//
// Même contrat que nexoraServerStorage (get, set, delete, list, révisions),
// mais conservé dans le localStorage de l'origine de test : aucune requête
// réseau, aucune donnée réelle. L'origine locale ou de préproduction étant
// distincte de https://nexora-project.org, le navigateur sépare déjà
// stockage, cookies et caches ; le préfixe ajoute une seconde barrière.
// Rien ici ne lit ni n'efface une clé de production.
(function () {
  "use strict";
  var PREFIXE = "nexora-demo:v1:";
  var memoire = new Map();
  var connues = new Map();
  var valeurs = new Map();

  function lire(cle) {
    try {
      var brut = window.localStorage.getItem(PREFIXE + cle);
      return brut === null ? null : JSON.parse(brut);
    } catch (_) {
      return memoire.has(cle) ? memoire.get(cle) : null;
    }
  }
  function ecrire(cle, entree) {
    memoire.set(cle, entree);
    try { window.localStorage.setItem(PREFIXE + cle, JSON.stringify(entree)); } catch (_) { /* mémoire seule */ }
  }
  function effacer(cle) {
    memoire.delete(cle);
    try { window.localStorage.removeItem(PREFIXE + cle); } catch (_) { /* rien */ }
  }
  function cles() {
    var sortie = new Set(memoire.keys());
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(PREFIXE) === 0) sortie.add(k.slice(PREFIXE.length));
      }
    } catch (_) { /* mémoire seule */ }
    return Array.from(sortie);
  }
  function revision() {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now()) + Math.random();
  }

  var stockage = {
    async get(cle, options) {
      var entree = lire(cle);
      if (!entree) throw new Error("Key not found: " + cle);
      if (!options || options.trackRevision !== false) {
        connues.set(cle, entree.revision || null);
        valeurs.set(cle, entree.value);
      }
      return entree;
    },
    async set(cle, valeur) {
      var entree = {
        key: cle, value: String(valeur == null ? "" : valeur), updatedAt: new Date().toISOString(),
        revision: revision(), source: "demo", storageMode: "inline", chunkCount: 0,
      };
      ecrire(cle, entree);
      connues.set(cle, entree.revision);
      valeurs.set(cle, entree.value);
      return entree;
    },
    async delete(cle) {
      var existait = !!lire(cle);
      effacer(cle);
      connues.set(cle, null);
      valeurs.delete(cle);
      return { key: cle, deleted: existait };
    },
    async refreshRevision(cle) {
      try { return await this.get(cle); } catch (_) { connues.set(cle, null); valeurs.delete(cle); return null; }
    },
    async list(prefixe) {
      prefixe = prefixe || "";
      return { keys: cles().filter(function (k) { return k.indexOf(prefixe) === 0; }).sort() };
    },
    watch() { return function () {}; },
    async checkRevision(cle) {
      var entree = lire(cle);
      return entree && entree.revision ? { revision: entree.revision, source: "demo" } : null;
    },
    getKnownRevision(cle) { return connues.has(cle) ? connues.get(cle) : undefined; },
    getKnownValue(cle) { return valeurs.get(cle); },
    acceptRemote(cle, resultat) {
      if (!resultat) return;
      connues.set(cle, resultat.revision || resultat.updatedAt || null);
      valeurs.set(cle, resultat.value);
    },
    syncDiagnostics() {
      return { transport: "demo-localstorage", knownRevisionKeys: Array.from(connues.keys()), readErrors: {}, chunking: { enabled: false } };
    },
    // Réinitialisation des seules données fictives de cette origine.
    reinitialiserDemo() { cles().forEach(effacer); connues.clear(); valeurs.clear(); },
  };

  Object.defineProperty(window, "__nexoraStockageDemo", { value: stockage, writable: false, configurable: false });
})();
