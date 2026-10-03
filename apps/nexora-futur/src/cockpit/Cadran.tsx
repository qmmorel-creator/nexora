// Cadran du jour (Ref #678) : 24 h sur un tour, midi en haut, nuit grisée,
// arcs des créneaux colorés par projet, aiguille à l'heure actuelle et anneau
// intérieur aux couleurs des habitudes tenues. Dépôt d'une tâche par glisser.
import { useState, type DragEvent, type ReactNode } from "react";
import { angleMinute, minuteDuPoint, type Evenement } from "../donnees/journee";

const C = 320;
const pt = (r: number, m: number): [number, number] => [C + r * Math.cos(angleMinute(m)), C + r * Math.sin(angleMinute(m))];
export function secteur(r0: number, r1: number, m0: number, m1: number) {
  const g = m1 - m0 > 720 ? 1 : 0;
  const [a, b] = pt(r1, m0), [c, d] = pt(r1, m1), [e, f] = pt(r0, m1), [g2, h2] = pt(r0, m0);
  const n = (x: number) => x.toFixed(2);
  return `M${n(a)} ${n(b)} A${r1} ${r1} 0 ${g} 1 ${n(c)} ${n(d)} L${n(e)} ${n(f)} A${r0} ${r0} 0 ${g} 0 ${n(g2)} ${n(h2)}Z`;
}
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const R0 = 217, R1 = 263;

export interface ArcCadran { id: string; debut: number; fin: number; colonne: number; colonnes: number; couleur: string; titre: string; passe?: boolean; terne?: boolean }
export const arcsDe = (ev: Evenement[], couleur: (e: Evenement) => string, maintenant: number | null): ArcCadran[] =>
  ev.map((e) => ({ id: e.t.id, debut: e.debut, fin: e.fin, colonne: e.colonne, colonnes: e.colonnes, couleur: couleur(e), titre: e.t.title || "", passe: maintenant !== null && e.fin <= maintenant }));

// Titre écrit le long de l'arc, à l'endroit en haut comme en bas du cadran.
function Etiquette({ a }: { a: ArcCadran }) {
  const l = (R1 - R0) / a.colonnes, r = R1 - a.colonne * l - l / 2 - 4;
  const place = Math.floor((r * ((a.fin - a.debut - 8) / 1440) * 2 * Math.PI) / 6.8);
  if (place < 4 || l < 20) return null;
  const titre = a.titre.length > place ? `${a.titre.slice(0, place - 1).trimEnd()}…` : a.titre;
  const milieu = ((a.debut + a.fin) / 2) % 1440, bas = milieu > 1080 || milieu < 360;
  const [x0, y0] = pt(r, bas ? a.fin - 4 : a.debut + 4), [x1, y1] = pt(r, bas ? a.debut + 4 : a.fin - 4);
  const g = a.fin - a.debut > 720 ? 1 : 0;
  const id = `ca-t-${a.id.replace(/[^\w-]/g, "_")}`;
  return (
    <g className="ca-etiq" aria-hidden="true" opacity={a.terne ? 0.3 : a.passe ? 0.6 : 1}>
      <path id={id} d={`M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${g} ${bas ? 0 : 1} ${x1.toFixed(2)} ${y1.toFixed(2)}`} fill="none" />
      <text dy={bas ? 0 : 8}><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{titre}</textPath></text>
    </g>
  );
}

function Arcs({ arcs, selection, onOuvrir, etiquettes }: { arcs: ArcCadran[]; selection?: string; onOuvrir?: (id: string) => void; etiquettes?: boolean }) {
  return <>{arcs.map((a) => {
    const l = (R1 - R0) / a.colonnes, r1 = R1 - a.colonne * l, r0 = r1 - l + (a.colonnes > 1 ? 1.5 : 0);
    const d = secteur(r0, r1, a.debut + 2, Math.max(a.debut + 6, a.fin - 2));
    return (
      <path key={a.id} className={`ca-arc ${selection === a.id ? "sel" : ""}`} d={d} style={{ fill: a.couleur }} opacity={a.terne ? 0.22 : a.passe ? 0.45 : 1}
        onClick={onOuvrir ? () => onOuvrir(a.id) : undefined}><title>{`${a.titre} · ${hhmm(a.debut)}–${hhmm(a.fin)}`}</title></path>
    );
  })}{etiquettes && arcs.map((a) => <Etiquette key={`t${a.id}`} a={a} />)}</>;
}

interface Props {
  arcs: ArcCadran[]; maintenant: number | null; selection?: string; focus?: [number, number] | null;
  habitudes?: { couleur: string; nom: string }[]; totalHabitudes?: number;
  onOuvrir?: (id: string) => void; onDepot?: (id: string, minute: number) => void; children?: ReactNode;
}

export function Cadran({ arcs, maintenant, selection, focus, habitudes = [], totalHabitudes = 0, onOuvrir, onDepot, children }: Props) {
  const [survol, setSurvol] = useState<number | null>(null);
  const minuteDe = (e: DragEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return minuteDuPoint(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
  };
  const depot = onDepot ? {
    onDragOver: (e: DragEvent<HTMLDivElement>) => { if (!e.dataTransfer.types.includes("text/nexora-tache")) return; e.preventDefault(); setSurvol(minuteDe(e)); },
    onDragLeave: () => setSurvol(null),
    onDrop: (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setSurvol(null); const id = e.dataTransfer.getData("text/nexora-tache"); if (id) onDepot(id, minuteDe(e)); },
  } : {};
  return (
    <div className={`ca-cadran ${survol !== null ? "survol" : ""}`} {...depot}>
      <svg className="ca-svg" viewBox="0 0 640 640" role="img" aria-label="Cadran de la journée : 24 heures, midi en haut">
        <circle cx={C} cy={C} r={240} className="ca-fond" strokeWidth={50} />
        <path d={secteur(R0 - 2, R1 + 2, 22 * 60, 30 * 60)} className="ca-nuit" />
        {focus && <path d={secteur(212, 268, focus[0] * 60, focus[1] * 60)} className="ca-focus" />}
        {maintenant !== null && maintenant > 6 * 60 && <path d={secteur(206, 210, 6 * 60, maintenant)} className="ca-ecoule" />}
        {Array.from({ length: 24 }, (_, h) => {
          const [x0, y0] = pt(270, h * 60), [x1, y1] = pt(h % 3 ? 276 : 283, h * 60);
          const [tx, ty] = pt(301, h * 60);
          return (
            <g key={h}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} className={`ca-trait ${h % 3 ? "" : "fort"}`} />
              {h % 3 === 0 && <text x={tx} y={ty + 4} textAnchor="middle" className="ca-h">{h}h</text>}
            </g>
          );
        })}
        <Arcs arcs={arcs} selection={selection} onOuvrir={onOuvrir} etiquettes />
        {survol !== null && <path d={secteur(R0 - 4, R1 + 4, survol, survol + 60)} className="ca-depot" />}
        {maintenant !== null && (() => {
          const [hx, hy] = pt(280, maintenant), [bx, by] = pt(196, maintenant);
          return <g className="ca-aiguille"><line x1={bx} y1={by} x2={hx} y2={hy} /><circle cx={hx} cy={hy} r={5} /></g>;
        })()}
        <circle cx={C} cy={C} r={186} className="ca-fond" strokeWidth={7} />
        {habitudes.map((h, k) => {
          const pas = 1440 / Math.max(1, totalHabitudes);
          return <path key={k} d={secteur(183, 189.5, 720 + k * pas + 4, 720 + (k + 1) * pas - 4)} style={{ fill: h.couleur }}><title>{h.nom}</title></path>;
        })}
      </svg>
      {survol !== null && <span className="ca-depot-l mono">{hhmm(survol)}</span>}
      <div className="ca-centre">{children}</div>
    </div>
  );
}

// Petit cadran de la semaine : arcs seuls, sans graduation.
export function MiniCadran({ arcs, taille = 120, auj }: { arcs: ArcCadran[]; taille?: number; auj?: boolean }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 640 640" aria-hidden="true" className="ca-mini">
      <circle cx={C} cy={C} r={240} className="ca-fond" strokeWidth={50} />
      <path d={secteur(R0 - 2, R1 + 2, 22 * 60, 30 * 60)} className="ca-nuit" />
      <Arcs arcs={arcs} />
      <circle cx={C} cy={C} r={auj ? 52 : 40} className={auj ? "ca-mini-auj" : "ca-mini-c"} />
    </svg>
  );
}
