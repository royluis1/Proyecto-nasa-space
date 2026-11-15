"""Genera data/samples/localidades_ar.json: ciudades y pueblos de Argentina con sus coordenadas.

Sirve para que el usuario elija su localidad por nombre (en vez de marcarla en el mapa) y para mostrar
"tu huerta está en X" a partir de las coordenadas del campo.

Fuente: IGN (Instituto Geográfico Nacional), capa `ign:localidad_bahra` del servicio WFS wms.ign.gob.ar.
BAHRA es la Base de Asentamientos Humanos de la República Argentina (IGN, INDEC y provincias).
Licencia: reutilización y redistribución libres según el Artículo 2 de la Ley 27.275 (acceso a la
información pública), como indica el servicio del IGN.

Uso (desde fieldshift/):
    python scripts/build_localities.py                  # todo el país
    python scripts/build_localities.py --provincia "San Luis"
"""

import argparse
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "samples" / "localidades_ar.json"
WFS = "https://wms.ign.gob.ar/geoserver/ows"
LAYER = "ign:localidad_bahra"
PAGE = 1000

SOURCE = {
    "name": "IGN, capa Localidad BAHRA (servicio WFS wms.ign.gob.ar, ign:localidad_bahra)",
    "license": (
        "Reutilización y redistribución libres según el Artículo 2 de la Ley 27.275 "
        "(acceso a la información pública), como indica el servicio del IGN"
    ),
    "note": (
        "BAHRA: Base de Asentamientos Humanos de la República Argentina (IGN, INDEC y provincias). "
        "El punto es el centro del asentamiento, no su límite."
    ),
}

# Tipos de asentamiento que mostramos, del más poblado al menos.
TIPO_ORDEN = {
    "Localidad compuesta": 0,
    "Localidad simple": 1,
    "Componente de localidad compuesta": 2,
    "Entidad": 3,
    "Paraje": 4,
}


def fetch(params: dict) -> dict:
    url = f"{WFS}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=180) as r:  # noqa: S310 (URL fija del IGN)
        return json.loads(r.read().decode("utf-8"))


def download(provincia: str | None) -> list[dict]:
    base = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": LAYER,
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
        "count": PAGE,
    }
    if provincia:
        base["CQL_FILTER"] = f"nom_pcia='{provincia}'"

    out: list[dict] = []
    start = 0
    while True:
        data = fetch({**base, "startIndex": start})
        feats = data.get("features", [])
        if not feats:
            break
        out.extend(feats)
        print(f"  {len(out)} localidades…")
        if len(feats) < PAGE:
            break
        start += PAGE
    return out


def compact(features: list[dict]) -> list[dict]:
    """Deja solo lo necesario, sin duplicados, ordenado por provincia y nombre."""
    seen: set[tuple[str, str, str]] = set()
    rows = []
    for f in features:
        p = f["properties"]
        name, prov = (p.get("fna") or "").strip(), (p.get("nom_pcia") or "").strip()
        depto, tipo = (p.get("nom_depto") or "").strip(), (p.get("tipo_asent") or "").strip()
        try:
            lat, lon = float(p["lat_gd"]), float(p["long_gd"])
        except (KeyError, TypeError, ValueError):
            continue
        if not name or not prov:
            continue
        key = (name.lower(), prov.lower(), depto.lower())
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "nombre": name,
                "provincia": prov,
                "departamento": depto,
                "tipo": tipo,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                # Para ordenar los resultados de la búsqueda: primero las localidades más grandes.
                "orden": TIPO_ORDEN.get(tipo, 5),
            }
        )
    rows.sort(key=lambda r: (r["provincia"], r["nombre"]))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincia", help="Solo una provincia (por defecto, todo el país).")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    print(f"Descargando localidades del IGN{f' de {args.provincia}' if args.provincia else ''}…")
    rows = compact(download(args.provincia))
    if not rows:
        raise SystemExit("No se descargó ninguna localidad: revisá la conexión o el filtro de provincia.")

    doc = {
        "source": SOURCE,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(rows),
        "localities": rows,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    provs = len({r["provincia"] for r in rows})
    print(f"Listo: {len(rows)} localidades de {provs} provincias en {args.out} ({args.out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
