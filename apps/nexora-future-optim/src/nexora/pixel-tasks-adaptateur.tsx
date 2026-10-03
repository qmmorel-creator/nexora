// Adaptateur du module Pixel Tasks de Nexora (retour du 03/10/2026).
// Modal : même balisage et mêmes classes que le Modal de Nexora (lp-overlay,
// lp-modal, -head, -body, -foot), sans la pile de fenêtres de Nexora.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({ title, onClose, children, footer, wide, extraWide, compact, className = "" }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; extraWide?: boolean; compact?: boolean; className?: string }) {
  const titreId = useId();
  const panneau = useRef<HTMLDivElement>(null);
  const fermer = useRef(onClose); fermer.current = onClose;
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    panneau.current?.focus({ preventScroll: true });
    const touche = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); fermer.current(); } };
    document.addEventListener("keydown", touche, true);
    return () => { document.removeEventListener("keydown", touche, true); avant?.focus?.({ preventScroll: true }); };
  }, []);
  return createPortal(
    <div className="lp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panneau} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titreId} className={"lp-modal" + (wide ? " lp-modal-wide" : "") + (extraWide ? " lp-modal-extra-wide" : "") + (compact ? " lp-modal-compact" : "") + (className ? " " + className : "")}>
        <div className="lp-modal-head"><h3 id={titreId}>{title}</h3><button type="button" className="lp-icon-btn" aria-label="Fermer" onClick={onClose}><X size={18} /></button></div>
        <div className="lp-modal-body">{children}</div>
        {footer && <div className="lp-modal-foot">{footer}</div>}
      </div>
    </div>, document.body);
}
