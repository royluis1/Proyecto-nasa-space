"""Genera data/samples/provincias_argentina.geojson: límites provinciales simplificados (para que pese poco).

Fuentes:
- IGN (Instituto Geográfico Nacional, ign.gob.ar > Capas SIG > Provincia): fuente oficial. Bajar el GeoJSON o shapefile
  y pasarlo con --source ign --input archivo.geojson. ⚠️ Verificar la licencia publicada por el IGN al descargarlo.
- Natural Earth admin-1 1:10m (dominio público): respaldo mientras no se tenga el archivo del IGN.

Uso (desde fieldshift/, necesita shapely: pip install shapely):
    python scripts/build_provinces.py                                  # Natural Earth (descarga ~40 MB)
    python scripts/build_provinces.py --source ign --input provincias_ign.geojson
"""

import argparse
import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "samples" / "provincias_argentina.geojson"
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"

SOURCES = {
    "naturalearth": {
        "name": "Natural Earth, Admin 1 – States, Provinces (1:10m)",
        "license": "Dominio público (naturalearthdata.com)",
        "note": "Respaldo hasta tener el archivo oficial del IGN. Escala 1:10.000.000: los bordes son aproximados.",
    },
    "ign": {
        "name": "Instituto Geográfico Nacional (IGN), capa Provincia",
        "license": "Ver la licencia publicada por el IGN (ign.gob.ar) al descargar el archivo",
        "note": "Fuente oficial de la República Argentina.",
    },
}


def slug(name: str) -> str:
    s = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def canonical(name: str) -> str:
    n = name.strip()
    fixes = {
        "Ciudad Autónoma de Buenos Aires": "Ciudad de Buenos Aires",
        "Ciudad Autonoma de Buenos Aires": "Ciudad de Buenos Aires",
        "Tierra del Fuego, Antártida e Islas del Atlántico Sur": "Tierra del Fuego",
    }
    return fixes.get(n, n)


def load(source: str, path: str | None) -> list[tuple[str, dict]]:
    if path:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    else:
        if source != "naturalearth":
            raise SystemExit("Para el IGN, pasá el archivo con --input.")
        print(f"Descargando {NE_URL} ...")
        with urllib.request.urlopen(NE_URL, timeout=120) as r:  # noqa: S310 (URL fija)
            data = json.loads(r.read().decode("utf-8"))
    out = []
    for f in data["features"]:
        p = f.get("properties") or {}
        if source == "naturalearth":
            if p.get("adm0_a3") != "ARG":
                continue
            name = p.get("name") or p.get("name_es")
        else:
            name = p.get("nam") or p.get("NAM") or p.get("nombre") or p.get("NOMBRE") or p.get("name")
        if not name:
            continue
        out.append((canonical(name), f["geometry"]))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=list(SOURCES), default="naturalearth")
    ap.add_argument("--input", help="GeoJSON local (obligatorio para --source ign)")
    ap.add_argument("--tolerance", type=float, default=0.01, help="Simplificación en grados (0,01 ≈ 1 km)")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()

    feats = []
    for name, geom in sorted(load(a.source, a.input)):
        g = shape(geom).simplify(a.tolerance, preserve_topology=True)
        g = shape(json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), 4)))
        feats.append({"type": "Feature", "properties": {"id": slug(name), "name": name}, "geometry": mapping(g)})
    src = SOURCES[a.source]
    fc = {
        "type": "FeatureCollection",
        "fieldshift": {
            "layer": "provincias",
            "source": src["name"],
            "license": src["license"],
            "note": src["note"],
            "simplify_tolerance_deg": a.tolerance,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "features": feats,
    }
    out = Path(a.out)
    out.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: {len(feats)} provincias, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
