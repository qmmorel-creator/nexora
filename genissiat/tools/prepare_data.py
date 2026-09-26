#!/usr/bin/env python3
"""Prépare les données réelles du jumeau 3D de Génissiat.

Télécharge, reprojette et découpe :
  - le relief IGN RGE ALTI (Géoplateforme, WMS-R, repli : API altimétrie) ;
  - l'orthophotographie IGN BD ORTHO (WMS-R) ;
  - les implantations OpenStreetMap (Overpass API).

Produit, dans genissiat/data/ :
  - terrain.json : hauteurs Int16 en base64, avec échelle et décalage ;
  - ortho.jpg    : orthophoto JPEG calée sur la même emprise ;
  - osm.json     : géométries OSM en coordonnées locales ;
  - report.json  : contrôles de cohérence (cotes du lit, de la retenue, des plateaux).

Les réponses brutes sont gardées dans genissiat/data/raw/ (hors git). Le script est
rejouable : `--offline` retraite les fichiers bruts déjà téléchargés sans réseau.

Repère local : origine au milieu de la crête du barrage (calé sur la géométrie OSM
`waterway=dam`), x = est, z = sud, y = altitude en m NGF (IGN69). Les axes suivent la
grille Lambert 93 (EPSG:2154) : le nord Lambert diffère du nord géographique de
moins de 0,5° sur la zone.

Sources et licences :
  - IGN (RGE ALTI, BD ORTHO) : Licence Ouverte Etalab 2.0 ;
  - OpenStreetMap : ODbL, « © les contributeurs d'OpenStreetMap ».
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from PIL import Image
from pyproj import Transformer
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box, mapping
from shapely.ops import linemerge, polygonize, split, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"

# Centre approximatif (recalé ensuite sur la géométrie OSM du barrage).
APPROX_LAT, APPROX_LON = 46.052, 5.813
HALF = 1200.0          # demi-côté de l'emprise, en m (2,4 km × 2,4 km)
DEM_RES = 5.0          # résolution de téléchargement du RGE ALTI, en m
OUT_RES = 10.0         # résolution du MNT embarqué dans la page, en m
ORTHO_PX = 2048        # côté de l'orthophoto, en pixels
ORTHO_QUALITY = 75
MARGIN = 40.0          # marge de téléchargement autour de l'emprise, en m

WMS_R = "https://data.geopf.fr/wms-r/wms"
ALTI_API = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
LAYER_DEM = "ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES"
LAYER_ORTHO = "ORTHOIMAGERY.ORTHOPHOTOS"
# Instances de l'opérateur principal d'Overpass (FOSSGIS), pas de miroir tiers.
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://z.overpass-api.de/api/interpreter"]
UA = {"User-Agent": "genissiat-jumeau-3d/1.0 (prepare_data.py; donnees IGN et OSM)"}

TO_L93 = Transformer.from_crs("EPSG:4326", "EPSG:2154", always_xy=True)
TO_WGS = Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)

NODATA_LIMIT = -1000.0


def log(*a):
    print(*a, flush=True)


def http_get(url, params=None, tries=4, timeout=120, **kw):
    last = None
    for k in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout, **kw)
            if r.status_code in (429, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r
        except requests.RequestException as e:  # réseau ou quota : on réessaie
            last = e
            log(f"  échec {k + 1}/{tries} : {e}")
            time.sleep(2 ** (k + 1))
    raise RuntimeError(f"accès refusé ou impossible : {url} ({last})")


# ---------------------------------------------------------------- OSM
def overpass_query(bbox_wgs):
    s, w, n, e = bbox_wgs
    bb = f"{s:.6f},{w:.6f},{n:.6f},{e:.6f}"
    return f"""[out:json][timeout:120];
(
  nwr["waterway"="dam"]({bb});
  nwr["power"]({bb});
  way["building"]({bb}); relation["building"]({bb});
  way["highway"]({bb});
  nwr["natural"="water"]({bb});
  nwr["waterway"~"^(riverbank|river|canal|stream)$"]({bb});
  nwr["landuse"="reservoir"]({bb});
  nwr["amenity"~"^(parking|toilets|restaurant)$"]({bb});
  nwr["tourism"]({bb});
  nwr["man_made"]({bb});
  nwr["leisure"~"^(park|picnic_table)$"]({bb});
);
out geom;"""


def fetch_osm(bbox_wgs, offline):
    path = RAW / "osm_overpass.json"
    if offline:
        return json.loads(path.read_text("utf8"))
    q = overpass_query(bbox_wgs)
    last = None
    for url in OVERPASS:
        try:
            log(f"Overpass : {url}")
            r = requests.post(url, data={"data": q}, headers=UA, timeout=200)
            r.raise_for_status()
            path.write_bytes(r.content)
            return r.json()
        except requests.RequestException as e:
            last = e
            log(f"  échec : {e}")
            time.sleep(5)
    raise RuntimeError(f"Overpass inaccessible ({last})")


def el_geom_l93(el):
    """Géométrie shapely en Lambert 93 d'un élément Overpass `out geom`."""
    t = el.get("type")
    if t == "node":
        x, y = TO_L93.transform(el["lon"], el["lat"])
        return Point(x, y)
    if t == "way":
        pts = [TO_L93.transform(p["lon"], p["lat"]) for p in el.get("geometry", []) if p]
        if len(pts) < 2:
            return None
        closed = len(pts) > 3 and pts[0] == pts[-1]
        return Polygon(pts) if closed else LineString(pts)
    if t == "relation":
        outers, inners, lines = [], [], []
        for m in el.get("members", []):
            if m.get("type") != "way" or not m.get("geometry"):
                continue
            pts = [TO_L93.transform(p["lon"], p["lat"]) for p in m["geometry"] if p]
            if len(pts) < 2:
                continue
            ls = LineString(pts)
            (inners if m.get("role") == "inner" else outers).append(ls)
            lines.append(ls)
        tags = el.get("tags", {})
        if tags.get("type") in ("multipolygon", "boundary") or tags.get("natural") == "water" or "building" in tags:
            po = list(polygonize(linemerge(unary_union(outers)))) if outers else []
            pi = list(polygonize(linemerge(unary_union(inners)))) if inners else []
            if po:
                g = unary_union(po)
                if pi:
                    g = g.difference(unary_union(pi))
                return g
        return unary_union(lines) if lines else None
    return None


# ---------------------------------------------------------------- MNT
def wms_getmap(layer, fmt, bbox_l93, width, height, styles=""):
    xmin, ymin, xmax, ymax = bbox_l93
    params = {
        "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": layer,
        "STYLES": styles, "CRS": "EPSG:2154", "BBOX": f"{xmin},{ymin},{xmax},{ymax}",
        "WIDTH": width, "HEIGHT": height, "FORMAT": fmt,
    }
    r = http_get(WMS_R, params)
    ctype = r.headers.get("Content-Type", "")
    if "xml" in ctype or r.content[:5] in (b"<?xml", b"<Serv"):
        raise RuntimeError(f"WMS-R a renvoyé une erreur : {r.text[:400]}")
    return r.content, ctype


def parse_bil(buf, w, h):
    """BIL float32 : l'endianness n'est pas annoncée, on garde la lecture plausible."""
    best = None
    for dt in ("<f4", ">f4"):
        a = np.frombuffer(buf, dtype=dt, count=w * h).reshape(h, w).astype(np.float64)
        ok = np.isfinite(a) & (a > 100) & (a < 2000)
        score = ok.mean()
        if best is None or score > best[0]:
            best = (score, a)
    return best[1]


def fetch_dem_wms(bbox_l93, n, offline):
    tif, bil = RAW / "rgealti_5m.tif", RAW / "rgealti_5m.bil"
    if not offline:
        for fmt in ("image/geotiff", "image/x-bil;bits=32"):
            try:
                log(f"RGE ALTI WMS-R ({fmt}), {n}×{n} px à {DEM_RES:g} m")
                buf, ctype = wms_getmap(LAYER_DEM, fmt, bbox_l93, n, n)
                (tif if "tif" in fmt else bil).write_bytes(buf)
                break
            except Exception as e:  # format refusé : on essaie le suivant
                log(f"  {e}")
    if tif.exists():
        import rasterio
        with rasterio.open(tif) as ds:
            a = ds.read(1).astype(np.float64)
            if ds.nodata is not None:
                a[a == ds.nodata] = np.nan
        return a, "WMS-R GeoTIFF"
    if bil.exists():
        return parse_bil(bil.read_bytes(), n, n), "WMS-R BIL float32"
    raise RuntimeError("RGE ALTI indisponible en WMS-R")


def fetch_dem_api(xs, ys, offline):
    """Repli : API altimétrie, par lots, sur la grille de sortie (10 m)."""
    path = RAW / "alti_api_10m.npy"
    if offline or path.exists():
        return np.load(path), "API altimétrie"
    E, N = np.meshgrid(xs, ys)
    lon, lat = TO_WGS.transform(E.ravel(), N.ravel())
    out = np.empty(lon.size)
    step = 150
    for i in range(0, lon.size, step):
        params = {
            "lon": "|".join(f"{v:.7f}" for v in lon[i:i + step]),
            "lat": "|".join(f"{v:.7f}" for v in lat[i:i + step]),
            "resource": "ign_rge_alti_wld", "zonly": "true",
        }
        r = http_get(ALTI_API, params)
        out[i:i + step] = r.json()["elevations"]
        if i // step % 40 == 0:
            log(f"  API altimétrie : {i + step}/{lon.size}")
    a = out.reshape(E.shape)
    np.save(path, a)
    return a, "API altimétrie"


def fill_nodata(a):
    a = a.copy()
    bad = ~np.isfinite(a) | (a < NODATA_LIMIT)
    if bad.any():
        from scipy import ndimage
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        a[bad] = a[tuple(i[bad] for i in idx)]
    return a


# ---------------------------------------------------------------- outils géométriques
class Frame:
    """Conversion Lambert 93 ↔ repère local (x = est, z = sud)."""

    def __init__(self, e0, n0):
        self.e0, self.n0 = e0, n0

    def loc(self, e, n):
        return round(e - self.e0, 1), round(-(n - self.n0), 1)

    def coords(self, geom):
        return [list(self.loc(x, y)) for x, y in geom.coords]

    def poly(self, p):
        return {"o": self.coords(p.exterior), "h": [self.coords(r) for r in p.interiors]}


def polys_of(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    if hasattr(g, "geoms"):
        return [p for x in g.geoms for p in polys_of(x)]
    return []


def lines_of(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, Polygon):
        return [LineString(g.exterior.coords)]
    if hasattr(g, "geoms"):
        return [l for x in g.geoms for l in lines_of(x)]
    return []


def bilinear(grid, x0, y0, res, e, n):
    """Échantillonne une grille Lambert (ligne 0 = nord) en (e, n)."""
    c = (e - x0) / res
    r = (y0 - n) / res
    c0 = int(np.clip(math.floor(c), 0, grid.shape[1] - 2))
    r0 = int(np.clip(math.floor(r), 0, grid.shape[0] - 2))
    fc, fr = np.clip(c - c0, 0, 1), np.clip(r - r0, 0, 1)
    a = grid[r0, c0] * (1 - fc) + grid[r0, c0 + 1] * fc
    b = grid[r0 + 1, c0] * (1 - fc) + grid[r0 + 1, c0 + 1] * fc
    return float(a * (1 - fr) + b * fr)


# ---------------------------------------------------------------- programme principal
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="retraiter data/raw sans réseau")
    ap.add_argument("--ortho-px", type=int, default=ORTHO_PX)
    ap.add_argument("--quality", type=int, default=ORTHO_QUALITY)
    ap.add_argument("--data-dir", type=Path, default=None, help="dossier de sortie (défaut : genissiat/data)")
    args = ap.parse_args()
    global DATA, RAW
    if args.data_dir:
        DATA, RAW = args.data_dir, args.data_dir / "raw"
    RAW.mkdir(parents=True, exist_ok=True)
    report = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "warnings": []}

    # 1. OSM, sur une emprise élargie autour du centre approximatif
    e_ap, n_ap = TO_L93.transform(APPROX_LON, APPROX_LAT)
    big = HALF + 600
    lons, lats = TO_WGS.transform([e_ap - big, e_ap + big], [n_ap - big, n_ap + big])
    osm = fetch_osm((lats[0], lons[0], lats[1], lons[1]), args.offline)
    els = osm.get("elements", [])
    log(f"OSM : {len(els)} éléments")

    # 2. Barrage : recale le centre sur la géométrie OSM
    dams = [el for el in els if el.get("tags", {}).get("waterway") == "dam"]
    def dam_score(el):
        name = el.get("tags", {}).get("name", "").lower()
        g = el_geom_l93(el)
        d = g.distance(Point(e_ap, n_ap)) if g is not None else 1e9
        return (0 if "génissiat" in name or "genissiat" in name else 1, d)
    dams.sort(key=dam_score)
    if not dams:
        raise RuntimeError("aucun waterway=dam dans l'emprise OSM")
    dam_el = dams[0]
    dam_g = el_geom_l93(dam_el)
    if isinstance(dam_g, Polygon):
        rect = dam_g.minimum_rotated_rectangle
        rc = list(rect.exterior.coords)[:4]
        edges = [(rc[i], rc[(i + 1) % 4]) for i in range(4)]
        edges.sort(key=lambda ab: -math.dist(*ab))
        (a1, b1), (a2, b2) = edges[0], edges[1]
        # axe provisoire : médiane du rectangle ; la crête est recalée plus bas sur la face amont
        axis = LineString([((a1[0] + b2[0]) / 2, (a1[1] + b2[1]) / 2), ((b1[0] + a2[0]) / 2, (b1[1] + a2[1]) / 2)])
        long_edges = [LineString(edges[0]), LineString(edges[1])]
    else:
        line = linemerge(dam_g) if not isinstance(dam_g, LineString) else dam_g
        if not isinstance(line, LineString):
            line = max(lines_of(line), key=lambda l: l.length)
        axis = LineString([line.coords[0], line.coords[-1]])
        long_edges = None
    mid = axis.interpolate(0.5, normalized=True)
    (ax, ay), (bx, by) = axis.coords[0], axis.coords[-1]
    ux, uy = (bx - ax) / axis.length, (by - ay) / axis.length   # direction de l'axe
    nx, ny = -uy, ux                                            # normale (gauche)
    e0, n0 = mid.x, mid.y
    report["dam_osm"] = {"id": f"{dam_el['type']}/{dam_el['id']}", "name": dam_el.get("tags", {}).get("name"),
                         "geometry": dam_g.geom_type, "axis_length_m": round(axis.length, 1)}

    # 3. Emprise et MNT
    xmin, xmax, ymin, ymax = e0 - HALF, e0 + HALF, n0 - HALF, n0 + HALF
    n_dl = int(round((2 * HALF + 2 * MARGIN) / DEM_RES))
    bb_dl = (xmin - MARGIN, ymin - MARGIN, xmin - MARGIN + n_dl * DEM_RES, ymin - MARGIN + n_dl * DEM_RES)
    n_out = int(round(2 * HALF / OUT_RES)) + 1
    xs = xmin + np.arange(n_out) * OUT_RES
    ys = ymax - np.arange(n_out) * OUT_RES           # ligne 0 = nord
    dem_src = None
    try:
        dem5, dem_src = fetch_dem_wms(bb_dl, n_dl, args.offline)
        dem5 = fill_nodata(dem5)
        # WMS : les valeurs sont aux centres des pixels
        gx0, gy0 = bb_dl[0] + DEM_RES / 2, bb_dl[3] - DEM_RES / 2
        grid = np.array([[bilinear(dem5, gx0, gy0, DEM_RES, e, n) for e in xs] for n in ys])
        res_src = DEM_RES
    except Exception as e:
        log(f"WMS-R indisponible ({e}) → repli sur l'API altimétrie")
        report["warnings"].append(f"WMS-R RGE ALTI : {e}")
        grid, dem_src = fetch_dem_api(xs, ys, args.offline)
        grid = fill_nodata(grid)
        res_src = OUT_RES
    log(f"MNT : {dem_src}, {grid.shape[1]}×{grid.shape[0]}, {np.nanmin(grid):.1f} à {np.nanmax(grid):.1f} m")

    # 4. Amont / aval : l'amont est le côté où l'eau est la plus haute
    def side_level(sign):
        vals = []
        for d in (120, 160, 200, 240):
            for t in np.linspace(-0.3, 0.3, 7):
                e = e0 + sign * nx * d + ux * t * axis.length
                n = n0 + sign * ny * d + uy * t * axis.length
                vals.append(bilinear(grid, xs[0], ys[0], OUT_RES, e, n))
        return float(np.min(vals))
    lv_l, lv_r = side_level(+1), side_level(-1)
    up = +1 if lv_l > lv_r else -1
    unx, uny = up * nx, up * ny   # vecteur unitaire vers l'amont (Lambert)
    # Polygone OSM : la crête (face amont verticale) est l'arête longue côté amont
    if long_edges:
        crest = max(long_edges, key=lambda l: (l.centroid.x - mid.x) * unx + (l.centroid.y - mid.y) * uny)
        cm = crest.interpolate(0.5, normalized=True)
        e0, n0 = cm.x, cm.y
        axis = crest
    fr = Frame(e0, n0)
    a_loc, b_loc = fr.loc(*axis.coords[0]), fr.loc(*axis.coords[-1])
    angle = math.atan2(b_loc[1] - a_loc[1], b_loc[0] - a_loc[0])  # axe du barrage dans le plan (x, z)
    up_loc = (round(unx, 4), round(-uny, 4))
    lon0, lat0 = TO_WGS.transform(e0, n0)
    log(f"Crête : L93 {e0:.1f} / {n0:.1f} = {lat0:.6f} N, {lon0:.6f} E ; amont vers {up_loc}")

    # 5. Eau : contour OSM découpé par l'axe du barrage
    water_tags = lambda t: (t.get("natural") == "water" or t.get("waterway") == "riverbank"
                            or t.get("landuse") == "reservoir")
    zone = box(xmin, ymin, xmax, ymax)
    water = unary_union([g for el in els if water_tags(el.get("tags", {}))
                         for g in polys_of(el_geom_l93(el))]).intersection(zone)
    cut = LineString([(e0 - ux * 900, n0 - uy * 900), (e0 + ux * 900, n0 + uy * 900)])
    ups, downs, others = [], [], []
    rhone_hint = Point(e0 + unx * 300, n0 + uny * 300)
    pieces = polys_of(split(water, cut)) if not water.is_empty else []
    for p in pieces:
        c = p.representative_point()
        s = (c.x - e0) * unx + (c.y - n0) * uny
        big_river = p.area > 20000 or p.distance(Point(e0, n0)) < 400
        if not big_river:
            others.append(p)
        elif s > 0:
            ups.append(p)
        else:
            downs.append(p)
    if not ups:
        report["warnings"].append("aucun plan d'eau amont trouvé dans OSM")
    up_poly, dn_poly = unary_union(ups), unary_union(downs)
    # surfaces affichées : contour élargi de 12 m (les berges masquent l'excédent), arrêté au
    # parement amont (4,5 m en amont de la crête) côté retenue, et sous le barrage côté aval
    def half_plane(s0, sign):
        far = 5000
        ox, oy = e0 + unx * s0, n0 + uny * s0
        return Polygon([(ox - ux * far, oy - uy * far), (ox + ux * far, oy + uy * far),
                        (ox + ux * far + sign * unx * far, oy + uy * far + sign * uny * far),
                        (ox - ux * far + sign * unx * far, oy - uy * far + sign * uny * far)])
    up_mesh = up_poly.buffer(12).intersection(half_plane(4.5, +1)).intersection(zone).simplify(1.0) if ups else Polygon()
    dn_mesh = dn_poly.buffer(12).intersection(half_plane(-5, -1)).intersection(zone).simplify(1.0) if downs else Polygon()

    # 6. Cotes mesurées par le MNT sur l'eau, puis creusement d'un lit (est.)
    from rasterio import features
    from rasterio.transform import from_origin
    tr = from_origin(xs[0] - OUT_RES / 2, ys[0] + OUT_RES / 2, OUT_RES, OUT_RES)
    def mask(g):
        if g.is_empty:
            return np.zeros(grid.shape, bool)
        return features.rasterize([(mapping(g), 1)], out_shape=grid.shape, transform=tr, all_touched=False).astype(bool)
    m_up, m_dn = mask(up_poly), mask(dn_poly)
    ws_up = float(np.median(grid[m_up])) if m_up.any() else None
    ws_dn = float(np.median(grid[m_dn])) if m_dn.any() else None
    from scipy import ndimage
    bed = grid.copy()
    for m, ws, depth_max in ((m_up, ws_up, 25.0), (m_dn, ws_dn, 8.0)):
        if ws is None:
            continue
        d = ndimage.distance_transform_edt(m) * OUT_RES
        depth = np.minimum(depth_max, 2.0 + d * 0.35)
        bed[m] = np.minimum(grid[m], ws - depth[m])
    report["levels"] = {
        "water_surface_dem_upstream": ws_up and round(ws_up, 2),
        "water_surface_dem_downstream": ws_dn and round(ws_dn, 2),
        "plateau_p75": round(float(np.percentile(grid, 75)), 1),
        "plateau_p95": round(float(np.percentile(grid, 95)), 1),
        "min": round(float(grid.min()), 1), "max": round(float(grid.max()), 1),
    }
    chk = report["levels"]
    if ws_dn is not None and not 250 <= ws_dn <= 275:
        report["warnings"].append(f"cote aval inattendue : {ws_dn:.1f} m (attendu ~260)")
    if ws_up is not None and not 320 <= ws_up <= 336:
        report["warnings"].append(f"cote amont inattendue : {ws_up:.1f} m (attendu ~330)")
    if not 400 <= chk["plateau_p95"] <= 560:
        report["warnings"].append(f"plateaux inattendus : p95 = {chk['plateau_p95']} m (attendu 420-480)")

    # 7. terrain.json (Int16 base64, échelle et décalage)
    offset = round(float((bed.max() + bed.min()) / 2), 1)
    scale = 0.02
    q = np.round((bed - offset) / scale)
    if np.abs(q).max() > 32767:
        scale = 0.05
        q = np.round((bed - offset) / scale)
    q = q.astype("<i2")
    terrain = {
        "w": n_out, "h": n_out, "dx": OUT_RES, "x0": -HALF, "z0": -HALF,
        "scale": scale, "offset": offset, "order": "lignes du nord (z = -1200) au sud, colonnes d'ouest en est",
        "data": base64.b64encode(q.tobytes()).decode("ascii"),
        "source": f"IGN RGE ALTI ({dem_src}, {res_src:g} m, ré-échantillonné à {OUT_RES:g} m)",
        "license": "Licence Ouverte Etalab 2.0",
        "crs": "EPSG:2154 (Lambert 93), altitudes IGN69",
        "origin_l93": [round(e0, 2), round(n0, 2)], "origin_wgs84": [round(lat0, 6), round(lon0, 6)],
        "water_surface_dem": {"up": ws_up and round(ws_up, 2), "down": ws_dn and round(ws_dn, 2)},
        "bed": "lit creusé sous les plans d'eau OSM (profondeur estimée) pour que la cote simulée reste visible",
    }
    (DATA / "terrain.json").write_text(json.dumps(terrain, separators=(",", ":")), "utf8")

    # 8. BD ORTHO
    raw_ortho = RAW / "ortho.jpg"
    try:
        if not args.offline:
            log(f"BD ORTHO WMS-R {args.ortho_px}×{args.ortho_px} px")
            buf, _ = wms_getmap(LAYER_ORTHO, "image/jpeg", (xmin, ymin, xmax, ymax), args.ortho_px, args.ortho_px)
            raw_ortho.write_bytes(buf)
        img = Image.open(raw_ortho).convert("RGB")
        if img.size != (args.ortho_px, args.ortho_px):
            img = img.resize((args.ortho_px, args.ortho_px), Image.LANCZOS)
        img.save(DATA / "ortho.jpg", "JPEG", quality=args.quality, optimize=True, progressive=True)
        report["ortho"] = {"px": args.ortho_px, "bytes": (DATA / "ortho.jpg").stat().st_size, "m_per_px": round(2 * HALF / args.ortho_px, 3)}
    except Exception as e:
        log(f"BD ORTHO indisponible : {e}")
        report["warnings"].append(f"BD ORTHO : {e}")

    # 9. osm.json
    def clip(g):
        return g.intersection(zone) if g is not None else None
    out = {
        "source": "OpenStreetMap via Overpass API", "license": "ODbL — © les contributeurs d'OpenStreetMap",
        "extract": osm.get("osm3s", {}).get("timestamp_osm_base"),
        "dam": {"id": report["dam_osm"]["id"], "name": dam_el.get("tags", {}).get("name"),
                "axis": [list(a_loc), list(b_loc)], "angle": round(angle, 5), "upstream": list(up_loc),
                "footprint": [fr.poly(p) for p in polys_of(clip(dam_g))],
                "line": [fr.coords(l) for l in lines_of(clip(dam_g))] if not isinstance(dam_g, Polygon) else []},
        "water": {"up": [fr.poly(p) for p in polys_of(up_poly.simplify(1.0))], "down": [fr.poly(p) for p in polys_of(dn_poly.simplify(1.0))],
                  "up_mesh": [fr.poly(p) for p in polys_of(up_mesh)], "down_mesh": [fr.poly(p) for p in polys_of(dn_mesh)],
                  "other": [dict(fr.poly(p), y=round(float(np.median(grid[mask(p)])), 1) if mask(p).any() else None)
                            for p in others if p.area > 150]},
        "plant": [], "buildings": [], "roads": [], "power_lines": [], "towers": [], "substations": [],
        "parkings": [], "pois": [],
    }
    seen_tower = set()
    for el in els:
        t = el.get("tags", {})
        g = el_geom_l93(el)
        if g is None:
            continue
        gc = clip(g)
        if gc is None or gc.is_empty:
            continue
        name = t.get("name")
        pw = t.get("power")
        if pw in ("plant", "generator") and polys_of(gc):
            for p in polys_of(gc):
                out["plant"].append(dict(fr.poly(p), kind=pw, name=name, source=t.get("plant:source") or t.get("generator:source")))
        if pw == "substation":
            for p in polys_of(gc) or [gc.buffer(15)]:
                out["substations"].append(dict(fr.poly(p), name=name, voltage=t.get("voltage")))
        if pw in ("line", "minor_line", "cable"):
            for l in lines_of(gc):
                out["power_lines"].append({"l": fr.coords(l), "kind": pw, "voltage": t.get("voltage"),
                                           "name": name, "operator": t.get("operator"), "cables": t.get("cables")})
        if pw in ("tower", "pole", "portal") and isinstance(g, Point):
            k = fr.loc(g.x, g.y)
            if k not in seen_tower:
                seen_tower.add(k)
                out["towers"].append({"p": list(k), "kind": pw, "ref": t.get("ref")})
        if "building" in t and polys_of(gc):
            lv = t.get("building:levels")
            ht = t.get("height")
            for p in polys_of(gc):
                c = p.centroid
                out["buildings"].append(dict(fr.poly(p), kind=t.get("building"), name=name,
                                             levels=lv, height=ht,
                                             ground=round(bilinear(grid, xs[0], ys[0], OUT_RES, c.x, c.y), 1)))
        if "highway" in t:
            for l in lines_of(gc) if not isinstance(g, Polygon) else []:
                out["roads"].append({"l": fr.coords(l), "kind": t["highway"], "name": name, "ref": t.get("ref"),
                                     "bridge": t.get("bridge") == "yes", "tunnel": t.get("tunnel") == "yes"})
        if t.get("amenity") == "parking":
            for p in polys_of(gc) or [gc.buffer(12)]:
                out["parkings"].append(dict(fr.poly(p), name=name))
        if t.get("tourism") or t.get("man_made") or t.get("amenity") in ("toilets", "restaurant"):
            c = gc.representative_point() if not isinstance(gc, Point) else gc
            out["pois"].append({"p": list(fr.loc(c.x, c.y)), "tourism": t.get("tourism"), "man_made": t.get("man_made"),
                                "amenity": t.get("amenity"), "name": name, "kind": el["type"]})
    (DATA / "osm.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), "utf8")
    report["osm_counts"] = {k: len(v) for k, v in out.items() if isinstance(v, list)}
    report["osm_counts"]["water_up"] = len(out["water"]["up"])
    report["osm_counts"]["water_down"] = len(out["water"]["down"])
    report["frame"] = {"origin_l93": terrain["origin_l93"], "origin_wgs84": terrain["origin_wgs84"],
                       "dam_angle_rad": out["dam"]["angle"], "upstream_dir": out["dam"]["upstream"]}
    (DATA / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), "utf8")
    log(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
