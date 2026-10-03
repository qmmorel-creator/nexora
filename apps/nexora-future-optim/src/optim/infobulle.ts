// Infobulle commune (Ref #688) : tout élément portant data-tip
// (« titre|ligne|ligne ») affiche une infobulle au survol, même style que
// .lp-pie-tooltip de Nexora. Nœud DOM unique, texte inséré sans HTML.
let noeud: HTMLDivElement | null = null;

export function infobulleFlottante(lignes: string[] | null, x: number, y: number) {
  if (!lignes) { if (noeud) noeud.hidden = true; return; }
  if (!noeud) { noeud = document.createElement("div"); noeud.className = "ox-tip"; noeud.setAttribute("role", "tooltip"); document.body.appendChild(noeud); }
  noeud.replaceChildren(...lignes.map((l, i) => { const e = document.createElement(i ? "div" : "strong"); e.textContent = l; return e; }));
  noeud.hidden = false;
  const w = noeud.offsetWidth, h = noeud.offsetHeight;
  const gx = x + 14 + w > window.innerWidth - 8 ? x - w - 14 : x + 14;
  const gy = y + 14 + h > window.innerHeight - 8 ? y - h - 14 : y + 14;
  noeud.style.left = `${Math.max(8, gx)}px`; noeud.style.top = `${Math.max(8, gy)}px`;
}

export function installerInfobulles(): () => void {
  let actif = false;
  const survol = (ev: MouseEvent) => {
    if ((ev.buttons & 1) === 1) return;
    const el = (ev.target as Element).closest?.("[data-tip]");
    if (!el) { if (actif) { actif = false; infobulleFlottante(null, 0, 0); } return; }
    actif = true;
    infobulleFlottante((el.getAttribute("data-tip") || "").split("|"), ev.clientX, ev.clientY);
  };
  const quitter = () => { actif = false; infobulleFlottante(null, 0, 0); };
  document.addEventListener("mousemove", survol); document.addEventListener("scroll", quitter, true);
  return () => { document.removeEventListener("mousemove", survol); document.removeEventListener("scroll", quitter, true); };
}

// Survol d'une habitude : l'éclaire partout (segment, pixel, ligne, liaison).
export function installerSurvolHabitudes(): () => void {
  let chaud: string | null = null;
  const survol = (ev: MouseEvent) => {
    const el = (ev.target as Element).closest?.("[data-hp]") as HTMLElement | SVGElement | null;
    const id = el ? el.getAttribute("data-hp") : null;
    if (id === chaud) return;
    chaud = id;
    document.querySelectorAll(".is-hot").forEach((x) => x.classList.remove("is-hot"));
    const app = document.getElementById("hx-app");
    if (id) document.querySelectorAll(`[data-hp="${CSS.escape(id)}"]`).forEach((x) => { x.classList.add("is-hot"); x.closest(".hx-hrow")?.classList.add("is-hot"); });
    app?.classList.toggle("has-hot", !!id);
  };
  document.addEventListener("mouseover", survol);
  return () => document.removeEventListener("mouseover", survol);
}
