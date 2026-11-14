"""scripts/geotiff_to_csv.py con GeoTIFF sintéticos (se saltea si no está rasterio)."""

import importlib.util
from pathlib import Path

import numpy as np
import pytest

from app.services.satellite.parsers import parse_csv
from app.services.satellite.products import PRODUCTS

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "geotiff_to_csv.py"


def load_script():
    spec = importlib.util.spec_from_file_location("geotiff_to_csv", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_tif(path, data, nodata):
    import rasterio
    from rasterio.transform import from_origin

    transform = from_origin(-65.21, -33.84, 0.0025, 0.0025)  # ~250 m, esquina NO
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=data.shape[0],
        width=data.shape[1],
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
        nodata=nodata,
    ) as dst:
        dst.write(data, 1)


def test_geotiff_a_csv_y_parser(tmp_path):
    pytest.importorskip("rasterio")
    script = load_script()
    for doy, ndvi, reliability in [(1, 7000, 0), (17, 6500, 3), (33, -3000, -1)]:
        write_tif(
            tmp_path / f"MOD13Q1.061__250m_16_days_NDVI_doy2024{doy:03d}_aid0001.tif",
            np.full((8, 8), ndvi, dtype="int16"),
            nodata=-3000,
        )
        write_tif(
            tmp_path / f"MOD13Q1.061__250m_16_days_pixel_reliability_doy2024{doy:03d}_aid0001.tif",
            np.full((8, 8), reliability, dtype="int8"),
            nodata=-1,
        )
    out = tmp_path / "ndvi.csv"
    n = script.convert(
        str(tmp_path / "*_NDVI_doy*.tif"), str(tmp_path / "*_pixel_reliability_doy*.tif"), -33.85, -65.20, 300, str(out)
    )
    assert n == 3
    text = out.read_text()
    assert text.splitlines()[0] == "date,value,qa"
    parsed = parse_csv(text, PRODUCTS["MOD13Q1"])
    v = parsed.df["value"]
    assert v["2024-01-01"] == pytest.approx(0.70) and parsed.scaled
    assert v[["2024-01-17", "2024-02-02"]].isna().all()  # nube y sin dato
    assert script.date_from_name("x_doy2024366_aid.tif").isoformat() == "2024-12-31"
