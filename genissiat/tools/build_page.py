#!/usr/bin/env python3
"""Construit genissiat.html : le gabarit src/genissiat.src.html avec les données embarquées.

Lit data/terrain.json, data/osm.json, data/ortho.jpg et data/report.json (produits par
prepare_data.py) et les insère dans la page, qui reste un fichier HTML unique et autoportant.
Sans données (ou avec --sans-donnees), la page garde le relief estimé de la première version.

Plafond : 16 Mo. Au-delà, l'orthophoto est recompressée (qualité, puis résolution),
avant de toucher au MNT.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "genissiat.src.html"
OUT = ROOT / "genissiat.html"
LIMIT = 16 * 1024 * 1024


def ortho_uri(path: Path, budget: int) -> str | None:
    if not path.exists():
        return None
    raw = path.read_bytes()
    if len(raw) * 4 / 3 <= budget:
        return "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")
    from PIL import Image  # recompression seulement si nécessaire
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    for side in (img.width, 1536, 1024):
        for q in (70, 60, 50):
            buf = io.BytesIO()
            img.resize((side, side), Image.LANCZOS).save(buf, "JPEG", quality=q, optimize=True, progressive=True)
            if buf.tell() * 4 / 3 <= budget:
                print(f"orthophoto recompressée : {side} px, qualité {q}")
                return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    raise SystemExit("orthophoto trop lourde même à 1024 px")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=ROOT / "data")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--sans-donnees", action="store_true", help="construire la page sans données réelles")
    args = ap.parse_args()

    html = SRC.read_text("utf8")
    geo = None
    d = args.data_dir
    if not args.sans_donnees and (d / "terrain.json").exists():
        geo = {"terrain": json.loads((d / "terrain.json").read_text("utf8"))}
        if (d / "osm.json").exists():
            geo["osm"] = json.loads((d / "osm.json").read_text("utf8"))
        if (d / "report.json").exists():
            geo["generated"] = json.loads((d / "report.json").read_text("utf8")).get("generated", "")[:10]
        rest = len(html.encode("utf8")) + len(json.dumps(geo, ensure_ascii=False).encode("utf8"))
        geo["ortho"] = ortho_uri(d / "ortho.jpg", LIMIT - rest - 4096)
    payload = json.dumps(geo, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html, n = re.subn(r"/\*GEO\*/.*?/\*/GEO\*/", lambda m: payload, html, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("marqueur /*GEO*/ absent du gabarit")
    size = len(html.encode("utf8"))
    if size > LIMIT:
        raise SystemExit(f"page trop lourde : {size / 1e6:.1f} Mo")
    args.out.write_text(html, "utf8")
    print(f"{args.out.name} : {size / 1e6:.2f} Mo, données réelles : {'oui' if geo else 'non'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
