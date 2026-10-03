// Comparaison des photos corporelles (retour du 03/10/2026) : le module de
// Nexora (src/nexora/photos-nexora.jsx, repris tel quel) en LECTURE : photo de
// référence et repères tels qu'enregistrés dans Nexora ; ici on choisit la
// photo de droite, on glisse le volet, on affiche les repères et on rogne
// (réglages d'affichage seulement, synchronisés dans nexora:optimPrefs).
// Import, repères, référence et dates se modifient dans Nexora.
import { useEffect, useRef, useState } from "react";
import { BODY_PHOTO_CSS, BodyPhotoCompare, BodyPhotoCrop, bodyPhotoAlignment, bodyPhotoFormatDate, bodyPhotoRightPhoto, bodyPhotoSorted, bodyPhotoSpec, type PhotoNexora } from "../nexora/photos-nexora";
import { useBodyPhotoUrl } from "../nexora/photos-adaptateur";
import type { PrefsCorps } from "../donnees/prefs";
import { useOptim } from "./contexte";

let cache: Promise<{ photos: PhotoNexora[]; referenceId: string | null }> | null = null;
function usePhotos() {
  const { source } = useOptim();
  const [etat, setEtat] = useState<{ photos: PhotoNexora[] | null; referenceId: string | null; erreur: string }>({ photos: null, referenceId: null, erreur: "" });
  const charger = (force = false) => {
    if (!source.corps) { setEtat({ photos: [], referenceId: null, erreur: "Photos non relayées." }); return; }
    if (force || !cache) { cache = source.corps.lire("body-photos").then((d) => { const x = d as { photos?: unknown; referenceId?: unknown }; return { photos: Array.isArray(x.photos) ? (x.photos as PhotoNexora[]) : [], referenceId: typeof x.referenceId === "string" ? x.referenceId : null }; }); cache.catch(() => { cache = null; }); }
    cache.then((r) => setEtat({ ...r, erreur: "" }), (e: Error) => setEtat({ photos: null, referenceId: null, erreur: e.message }));
  };
  useEffect(() => { charger(); }, [source]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...etat, recharger: () => charger(true) };
}

function Vignette({ photo, isReference, isRight, choisir }: { photo: PhotoNexora; isReference: boolean; isRight: boolean; choisir: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visible || !ref.current) return undefined;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    io.observe(ref.current); return () => io.disconnect();
  }, [visible]);
  const pret = photo.status === "ready", img = useBodyPhotoUrl(photo.id, visible && pret);
  const reperes = photo.landmarks?.leftEye && photo.landmarks?.rightEye;
  return <div ref={ref} className={`nx-bp-thumb${isReference ? " is-ref" : ""}${isRight ? " is-right" : ""}`}>
    <button type="button" className="nx-bp-thumb-img" disabled={!pret || isReference} style={img.url ? { backgroundImage: `url(${img.url})` } : undefined} onClick={choisir} aria-label={`Comparer la photo du ${bodyPhotoFormatDate(photo.date)}`} title={pret ? "Afficher à droite" : "Import inachevé"} />
    {isReference && <span className="nx-bp-badge">Référence</span>}
    {!pret && <span className="nx-bp-badge warn">Import inachevé</span>}
    {pret && !reperes && !isReference && <span className="nx-bp-badge warn" style={{ left: "auto", right: 4 }}>Sans repères</span>}
    <div className="nx-bp-thumb-date"><span>{bodyPhotoFormatDate(photo.date)}</span></div>
  </div>;
}

export function PhotosCorps({ c, maj }: { c: PrefsCorps; maj: (p: Partial<PrefsCorps>) => void }) {
  const { photos, referenceId, erreur, recharger } = usePhotos();
  const spec = bodyPhotoSpec({ bodyPhotos: c.photos });
  const update = (patch: Partial<typeof spec>) => maj({ photos: { ...spec, ...patch } });
  const [split, setSplit] = useState(spec.split);
  const [rogner, setRogner] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  useEffect(() => { setSplit(spec.split); }, [spec.split]);
  useEffect(() => { const f = () => setPleinEcran(document.fullscreenElement === racine.current); document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);
  const tries = bodyPhotoSorted(photos || []), pretes = tries.filter((p) => p.status === "ready");
  const reference = pretes.find((p) => p.id === referenceId) || null;
  const droite = bodyPhotoRightPhoto(tries, referenceId, spec.rightId);
  const candidates = pretes.filter((p) => p.id !== referenceId), idx = droite ? candidates.findIndex((p) => p.id === droite.id) : -1;
  const alignement = reference && droite ? bodyPhotoAlignment(droite, reference) : null;
  const crop = reference ? spec.crops[reference.id] || null : null;
  const pas = (s: number) => { const n = candidates[idx + s]; if (n) update({ rightId: n.id }); };
  let principal;
  if (erreur) principal = <div className="nx-bp-empty" role="alert"><div>{erreur}</div><button type="button" className="hx-btn" onClick={recharger}>Réessayer</button></div>;
  else if (!photos) principal = <div className="nx-bp-empty">Chargement des photos…</div>;
  else if (rogner && reference && droite && alignement) principal = <BodyPhotoCrop reference={reference} photo={droite} alignment={alignement} crop={crop} onClose={() => setRogner(false)} onSave={(v) => { const crops = { ...spec.crops }; if (v) crops[reference.id] = v; else delete crops[reference.id]; update({ crops }); setRogner(false); }} />;
  else if (!tries.length) principal = <div className="nx-bp-empty"><strong>Aucune photo</strong><span>Les photos s'importent dans Nexora (widget Photos corporelles).</span></div>;
  else if (!reference) principal = <div className="nx-bp-empty"><strong>Aucune photo de référence</strong><span>Choisis-la dans Nexora (étoile d'une vignette) : elle sert de cadre et d'« avant » à toutes les comparaisons.</span></div>;
  else if (!droite) principal = <div className="nx-bp-empty"><strong>Une seule photo</strong><span>La comparaison montre la référence à gauche et une autre photo à droite.</span></div>;
  else if (!alignement?.ok) principal = <div className="nx-bp-empty"><strong>{alignement?.reason === "reference" ? "La référence n'a pas de repères" : `La photo du ${bodyPhotoFormatDate(droite.date)} n'a pas de repères`}</strong><span>Sans repères (au moins les deux yeux), la photo ne peut pas être alignée. Les repères se placent dans Nexora.</span></div>;
  else principal = <BodyPhotoCompare reference={reference} photo={droite} alignment={alignement} split={split} showLandmarks={spec.showLandmarks} crop={crop} onSplit={setSplit} onSplitCommit={(v) => update({ split: Math.round((v ?? split) * 10) / 10 })} />;
  return <div className="nx-bp ox-photos" ref={racine}>
    <style>{BODY_PHOTO_CSS}</style>
    <div className="nx-bp-bar"><div className="nx-bp-tools">
      <select aria-label="Photo de droite" title="Photo de droite" value={droite?.id || ""} disabled={!candidates.length} onChange={(e) => update({ rightId: e.target.value })}>
        {!candidates.length && <option value="">Aucune photo</option>}{candidates.map((p) => <option key={p.id} value={p.id}>{bodyPhotoFormatDate(p.date)}</option>)}</select>
      <button type="button" onClick={() => pas(-1)} disabled={idx <= 0} aria-label="Photo précédente">‹</button>
      <button type="button" onClick={() => pas(1)} disabled={idx < 0 || idx >= candidates.length - 1} aria-label="Photo suivante">›</button>
      <button type="button" className={spec.showLandmarks ? "active" : ""} aria-pressed={spec.showLandmarks} onClick={() => update({ showLandmarks: !spec.showLandmarks })}>Repères visibles</button>
      {reference && droite && alignement?.ok && <button type="button" className={crop ? "active" : ""} aria-pressed={!!crop} onClick={() => setRogner(true)}>Rogner</button>}
      <button type="button" aria-pressed={pleinEcran} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen?.(); else void racine.current?.requestFullscreen?.().catch(() => {}); }}>{pleinEcran ? "Quitter" : "Plein écran"}</button>
      <span className="count">{pretes.length} photo{pretes.length > 1 ? "s" : ""}</span>
    </div></div>
    {principal}
    {photos && tries.length > 0 && !rogner && <div className="nx-bp-gallery" aria-label="Galerie des photos, de la plus ancienne à la plus récente">
      {tries.map((p) => <Vignette key={p.id} photo={p} isReference={p.id === referenceId} isRight={p.id === droite?.id} choisir={() => update({ rightId: p.id })} />)}</div>}
  </div>;
}
