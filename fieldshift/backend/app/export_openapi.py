"""Exporta el esquema OpenAPI a backend/openapi.json (lo usa el frontend para generar sus tipos).

Uso (desde backend/):  python -m app.export_openapi
"""

import json
from pathlib import Path

from app.main import create_app

OUT = Path(__file__).resolve().parents[1] / "openapi.json"

if __name__ == "__main__":
    OUT.write_text(json.dumps(create_app().openapi(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Esquema escrito en {OUT}")
