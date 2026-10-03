// Composants de base de l'identité « Plan » (Ref #654). Sans état métier :
// ils ne connaissent ni Firebase ni les tâches.
import { useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "principal" | "secondaire" | "discret" | "danger";
export function Bouton({ variante = "secondaire", raccourci, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; raccourci?: string }) {
  return (
    <button type="button" {...p} className={cx("btn", `btn-${variante}`, className)}>
      <span>{children}</span>{raccourci && <Kbd>{raccourci}</Kbd>}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Puce({ libelle, valeur, onRetirer }: { libelle: string; valeur: ReactNode; onRetirer?: () => void }) {
  return (
    <span className="puce">
      <span className="puce-libelle">{libelle}</span> <b>{valeur}</b>
      {onRetirer && <button type="button" className="puce-x" aria-label={`Retirer le filtre ${libelle}`} onClick={onRetirer}>×</button>}
    </span>
  );
}

export type Ton = "neutre" | "accent" | "crit" | "alerte" | "ok" | "info";
export function Etat({ ton = "neutre", children, point = true }: { ton?: Ton; children: ReactNode; point?: boolean }) {
  return <span className={cx("etat", `etat-${ton}`)}>{point && <span className="etat-point" aria-hidden="true" />}{children}</span>;
}

export function Champ({ libelle, aide, erreur, id, ...p }: InputHTMLAttributes<HTMLInputElement> & { libelle: string; aide?: string; erreur?: string }) {
  const auto = useId();
  const ident = id || auto;
  return (
    <div className={cx("champ", erreur && "champ-erreur")}>
      <label htmlFor={ident}>{libelle}</label>
      <input id={ident} aria-invalid={!!erreur || undefined} aria-describedby={aide || erreur ? `${ident}-aide` : undefined} {...p} />
      {(aide || erreur) && <span id={`${ident}-aide`} className="champ-aide" role={erreur ? "alert" : undefined}>{erreur || aide}</span>}
    </div>
  );
}

// Sélecteur à options exclusives, navigable aux flèches (motif radiogroup).
export function Segment<T extends string>({ options, valeur, onChange, etiquette }: { options: { valeur: T; libelle: string; raccourci?: string }[]; valeur: T; onChange: (v: T) => void; etiquette: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const i = Math.max(0, options.findIndex((o) => o.valeur === valeur));
  const clavier = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].valeur);
    refs.current[n]?.focus();
  };
  return (
    <div className="segment" role="radiogroup" aria-label={etiquette} onKeyDown={clavier}>
      {options.map((o, k) => (
        <button key={o.valeur} ref={(el) => { refs.current[k] = el; }} type="button" role="radio" aria-checked={o.valeur === valeur} tabIndex={o.valeur === valeur ? 0 : -1} onClick={() => onChange(o.valeur)}>
          {o.libelle}{o.raccourci && <span className="segment-k">{o.raccourci}</span>}
        </button>
      ))}
    </div>
  );
}

// Cartouche : bloc-titre à la manière d'un plan (signature de l'identité Plan).
export function Cartouche({ surtitre, titre, meta, actions }: { surtitre?: ReactNode; titre: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="cartouche">
      <div className="cartouche-corps">
        {surtitre && <div className="surtitre">{surtitre}</div>}
        <h1 className="cartouche-titre">{titre}</h1>
        {meta && <div className="cartouche-meta">{meta}</div>}
      </div>
      {actions && <div className="cartouche-actions">{actions}</div>}
    </header>
  );
}

export function Surtitre({ children }: { children: ReactNode }) {
  return <div className="surtitre">{children}</div>;
}
