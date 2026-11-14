"""Genera data/samples/smap_l3_sample_san_luis.csv: MUESTRA SIMULADA de SMAP L3 (capa superficial, ~5 cm) con el formato
de AppEEARS, a partir de la muestra simulada de L4 superficial (smap_sample_san_luis.csv). NO son observaciones.

L3 tiene huecos (el satélite pasa cada 2 a 3 días): se dejan 2 de cada 5 días con dato.
Uso (desde fieldshift/): python scripts/generate_smap_l3_sample.py
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "samples" / "smap_sample_san_luis.csv"
OUT = ROOT / "data" / "samples" / "smap_l3_sample_san_luis.csv"
VALUE = "SPL3SMP_E_006_Soil_Moisture_Retrieval_Data_AM_soil_moisture"
QA = "SPL3SMP_E_006_Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag"


def main() -> None:
    df = pd.read_csv(SRC, comment="#", parse_dates=["Date"])
    rng = np.random.default_rng(42)
    surf = df["SPL4SMGP_008_Geophysical_Data_sm_surface"].where(df["SPL4SMGP_008_Geophysical_Data_sm_surface"] > -9000)
    value = (surf * (1 + rng.normal(0, 0.06, len(df)))).clip(0.01, 0.6).round(4)
    keep = df["Date"].dt.day_of_year % 5 < 2
    out = pd.DataFrame({
        "ID": df["ID"], "Latitude": df["Latitude"], "Longitude": df["Longitude"], "Date": df["Date"].dt.strftime("%Y-%m-%d"),
        VALUE: value.where(keep & value.notna(), -9999.0), QA: 0,
    })
    with OUT.open("w", encoding="utf-8") as fh:
        fh.write("# MUESTRA SIMULADA con formato de AppEEARS para SMAP L3 (SPL3SMP_E): no son observaciones. Ver scripts/generate_smap_l3_sample.py\n")
        out.to_csv(fh, index=False)
    print(f"{OUT.relative_to(ROOT)}: {len(out)} filas, {int((out[VALUE] > -9000).sum())} con dato")


if __name__ == "__main__":
    main()
