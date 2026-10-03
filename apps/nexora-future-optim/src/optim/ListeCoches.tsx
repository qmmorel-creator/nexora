// Listes déroulantes d'Optim (retour du 03/10/2026) : partout, une recherche
// rapide et des boutons « Tout cocher » / « Tout décocher ».
// - ListeCoches : liste à cases (filtres, colonnes, sports, mesures…). Avec une
//   recherche active, « Tout cocher » et « Tout décocher » ne portent que sur les
//   éléments visibles. Avec un maximum (cartes limitées), « Tout cocher » coche
//   les premiers éléments visibles jusqu'à la limite.
// - ChoixRecherche : remplace un <select> à choix unique par un menu filtrable.
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface OptionCoche { id: string; libelle: string; couleur?: string; detail?: ReactNode; groupe?: string; desactive?: boolean; }
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrerOptions<T extends { libelle: string; groupe?: string }>(options: T[], q: string): T[] {
  const n = norm(q.trim());
  return n ? options.filter((o) => norm(o.libelle).includes(n) || (o.groupe ? norm(o.groupe).includes(n) : false)) : options;
}
// Sélection après « Tout cocher » : ajoute les visibles (non désactivés) dans l'ordre, sans dépasser max.
export function toutCocher(choisis: string[], visibles: { id: string; desactive?: boolean }[], max?: number): string[] {
  const r = [...choisis];
  for (const o of visibles) { if (max !== undefined && r.length >= max) break; if (!o.desactive && !r.includes(o.id)) r.push(o.id); }
  return r;
}
export const toutDecocher = (choisis: string[], visibles: { id: string }[]): string[] => { const v = new Set(visibles.map((o) => o.id)); return choisis.filter((id) => !v.has(id)); };

export function ListeCoches({ options, choisis, changer, max, recherche = true, libelleRecherche = "Rechercher" }: {
  options: OptionCoche[]; choisis: string[]; changer: (ids: string[]) => void; max?: number; recherche?: boolean; libelleRecherche?: string;
}) {
  const [q, setQ] = useState("");
  const visibles = filtrerOptions(options, q);
  const plein = max !== undefined && choisis.length >= max;
  const groupes = [...new Set(visibles.map((o) => o.groupe || ""))];
  return (
    <div className="ox-lc">
      {recherche && <input type="search" className="ox-lc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={libelleRecherche} aria-label={libelleRecherche} autoComplete="off" />}
      <p className="ox-lc-act">
        <button type="button" className="hx-more" disabled={plein || visibles.every((o) => o.desactive || choisis.includes(o.id))} onClick={() => changer(toutCocher(choisis, visibles, max))}>Tout cocher</button>
        <button type="button" className="hx-more" disabled={!visibles.some((o) => choisis.includes(o.id))} onClick={() => changer(toutDecocher(choisis, visibles))}>Tout décocher</button>
        {max !== undefined && <small className="hx-dim">{choisis.length} / {max}</small>}
      </p>
      <div className="ox-lc-l">
        {groupes.map((g) => <div key={g || "_"} role="group" aria-label={g || undefined}>
          {g && <h4>{g}</h4>}
          {visibles.filter((o) => (o.groupe || "") === g).map((o) => { const on = choisis.includes(o.id), off = !on && (plein || !!o.desactive); return (
            <label key={o.id} className={off ? "is-off" : ""}><input type="checkbox" checked={on} disabled={off} onChange={() => changer(on ? choisis.filter((x) => x !== o.id) : [...choisis, o.id])} />{o.couleur && <i style={{ background: o.couleur }} />}<span>{o.libelle}</span>{o.detail && <small className="hx-dim">{o.detail}</small>}</label>); })}
        </div>)}
        {!visibles.length && <p className="hx-dim ox-lc-vide">Aucun résultat.</p>}
      </div>
    </div>
  );
}

// Menu déroulant à cases : bouton (puce de filtre) + panneau ListeCoches.
export function MenuCoches({ libelle, classe = "hx-fchip", ...p }: { libelle: ReactNode; classe?: string } & Parameters<typeof ListeCoches>[0]) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useFermer(ref, ouvert, () => setOuvert(false));
  const n = p.choisis.length;
  return <span className="hx-fchip-w" ref={ref}>
    <button type="button" className={`${classe} ${n ? "is-on" : ""}`} aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>{libelle}{n ? <> <b>{n}</b></> : null} ▾</button>
    {ouvert && <div className="hx-pop is-f ox-lc-pop" role="dialog">{<ListeCoches {...p} />}</div>}
  </span>;
}

export function useFermer(ref: React.RefObject<HTMLElement | null>, ouvert: boolean, fermer: () => void) {
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fermer(); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    document.addEventListener("mousedown", clic); document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", clic); document.removeEventListener("keydown", echap); };
  }, [ouvert, fermer, ref]);
}

// Choix unique avec recherche (remplace <select>).
export function ChoixRecherche({ options, valeur, changer, vide, libelle, classe = "ox-cr-b" }: {
  options: { id: string; libelle: string; couleur?: string; groupe?: string }[]; valeur: string; changer: (id: string) => void; vide?: string; libelle: string; classe?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  useFermer(ref, ouvert, () => { setOuvert(false); setQ(""); });
  const tout = vide !== undefined ? [{ id: "", libelle: vide }, ...options] : options;
  const visibles = filtrerOptions(tout, q);
  const cur = tout.find((o) => o.id === valeur);
  const choisir = (id: string) => { changer(id); setOuvert(false); setQ(""); };
  return <span className="hx-fchip-w ox-cr" ref={ref}>
    <button type="button" className={classe} aria-haspopup="listbox" aria-expanded={ouvert} aria-label={libelle} onClick={() => setOuvert(!ouvert)}>{cur?.libelle || vide || "Choisir…"} ▾</button>
    {ouvert && <div className="hx-pop is-f ox-lc-pop" role="dialog" aria-label={libelle}>
      <input type="search" className="ox-lc-q" value={q} autoFocus onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label={`Rechercher : ${libelle}`} autoComplete="off"
        onKeyDown={(e) => { if (e.key === "Enter" && visibles[0]) { e.preventDefault(); choisir(visibles[0].id); } }} />
      <div className="ox-lc-l" role="listbox" aria-label={libelle}>
        {visibles.map((o, i) => { const g = "groupe" in o ? o.groupe : undefined, gp = i > 0 && "groupe" in visibles[i - 1] ? visibles[i - 1].groupe : undefined; return <span key={o.id || "_vide"} className="ox-cr-li">
          {g && g !== gp && <h4>{g}</h4>}
          <button type="button" role="option" aria-selected={o.id === valeur} className={`ox-cr-o ${o.id === valeur ? "is-sel" : ""}`} onClick={() => choisir(o.id)}>{"couleur" in o && o.couleur && <i style={{ background: o.couleur }} />}{o.libelle}</button></span>; })}
        {!visibles.length && <p className="hx-dim ox-lc-vide">Aucun résultat.</p>}
      </div>
    </div>}
  </span>;
}
