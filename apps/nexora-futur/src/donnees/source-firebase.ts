import { auth, ecouterCle } from "./firebase";
import { modifierCle } from "./ecriture-firebase";
import { ErreurCorps, ErreurFinance, type AccesCorps, type AccesFinance, type RapportsJour, type Source } from "./source";

async function rapports(jour: string): Promise<RapportsJour> {
  const jeton = await auth.currentUser?.getIdToken();
  if (!jeton) throw new Error("Non authentifié");
  const r = await fetch(`/api/futur/rapports?jour=${encodeURIComponent(jour)}`, { headers: { authorization: `Bearer ${jeton}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error === "configuration_missing" ? "Rapports indisponibles : configuration serveur incomplète." : "Rapports indisponibles.");
  return { matin: d.matin ?? null, soir: d.soir ?? null };
}

async function appelFinance(chemin: string, init: RequestInit = {}): Promise<unknown> {
  const jeton = await auth.currentUser?.getIdToken();
  if (!jeton) throw new ErreurFinance("unauthorized");
  const r = await fetch(`/api/futur/finance/${chemin}`, { ...init, headers: { authorization: `Bearer ${jeton}`, ...(init.body ? { "content-type": "application/json" } : {}) } });
  const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; data?: unknown };
  if (!r.ok || d.ok === false) throw new ErreurFinance(d.error || `http_${r.status}`);
  return d.data ?? d;
}
const finance: AccesFinance = {
  lire: (ressource, params = {}) => appelFinance(`${ressource}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`),
  categoriser: async (c) => { await appelFinance("categoriser", { method: "PATCH", body: JSON.stringify(c) }); },
};

async function appelCorps(chemin: string): Promise<Response> {
  const jeton = await auth.currentUser?.getIdToken();
  if (!jeton) throw new ErreurCorps("unauthorized");
  return fetch(`/api/futur/corps/${chemin}`, { headers: { authorization: `Bearer ${jeton}` } });
}
const corps: AccesCorps = {
  async lire(ressource) {
    const r = await appelCorps(ressource);
    const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; data?: unknown };
    if (!r.ok || d.ok === false) throw new ErreurCorps(d.error || `http_${r.status}`);
    return d.data ?? d;
  },
  async image(id) {
    const r = await appelCorps(`body-photos/${encodeURIComponent(id)}/image`);
    if (!r.ok) { const d = await r.json().catch(() => ({})) as { error?: string }; throw new ErreurCorps(d.error || `http_${r.status}`); }
    return r.blob();
  },
};

export const sourceFirebase: Source = { ecouter: ecouterCle, modifier: modifierCle, rapports, finance, corps };
