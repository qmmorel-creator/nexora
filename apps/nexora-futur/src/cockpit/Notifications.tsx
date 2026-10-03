import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface Notif { id: number; message: string; ton?: "info" | "crit"; annuler?: () => void; }
const Ctx = createContext<{ notifier: (n: Omit<Notif, "id">) => void } | null>(null);
let compteur = 0;

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notif[]>([]);
  const fermer = useCallback((id: number) => setListe((l) => l.filter((x) => x.id !== id)), []);
  const notifier = useCallback((n: Omit<Notif, "id">) => {
    const id = ++compteur;
    setListe((l) => [...l.slice(-3), { ...n, id }]);
    setTimeout(() => fermer(id), n.annuler ? 8000 : 4500);
  }, [fermer]);
  const v = useMemo(() => ({ notifier }), [notifier]);
  return (
    <Ctx.Provider value={v}>
      {children}
      <div className="notifs" role="status" aria-live="polite">
        {liste.map((n) => (
          <div key={n.id} className={`notif ${n.ton === "crit" ? "notif-crit" : ""}`}>
            <span>{n.message}</span>
            {n.annuler && <button type="button" className="notif-btn" onClick={() => { n.annuler?.(); fermer(n.id); }}>Annuler</button>}
            <button type="button" className="notif-x" aria-label="Fermer la notification" onClick={() => fermer(n.id)}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useNotifier() { const c = useContext(Ctx); if (!c) throw new Error("hors FournisseurNotifications"); return c.notifier; }
