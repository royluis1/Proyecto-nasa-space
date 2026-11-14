# Scripts de datos (pendiente)

Se corren offline, no forman parte de la API. Acá sí se usan librerías pesadas (geopandas, xarray, rasterio) para no complicar la instalación del backend.

| Script previsto | Qué hace | Salida |
|---|---|---|
| `fetch_appeears` | Pide a AppEEARS (requiere cuenta Earthdata) la extracción por punto de MOD13A1 y SMAP | archivos crudos |
| `preprocess_ndvi` | Aplica factor de escala, QA y faltantes al NDVI | `data/samples/ndvi_<campo>.csv` |
| `preprocess_smap` | Filtra por calidad la humedad SMAP L3 y L4 | `data/samples/smap_<campo>.csv` |
| `srtm_slope` | Calcula elevación y pendiente por campo | `data/samples/srtm_<campo>.json` |
| `warm_cache` | Precarga NASA POWER de los 3 campos antes del demo | `data/cache/` |

Scripts ya disponibles:

| Script | Qué hace | Salida |
|---|---|---|
| `generate_power_sample.py` | Genera el clima diario **simulado** de los 3 campos | `data/samples/power_sample_san_luis.csv` |
| `generate_satellite_samples.py` | Genera SMAP y NDVI **simulados** con el formato de AppEEARS | `data/samples/smap_sample_san_luis.csv`, `ndvi_sample_san_luis.csv` |
| `geotiff_to_csv.py` | Convierte GeoTIFF de AppEEARS (pedido de área) en `date,value,qa` para la API. Requiere `rasterio` | CSV para `csv_content` |
| `export_demo_data.py` | Genera los datos de ejemplo del modo demostración del frontend (con el motor real y clima, SMAP y NDVI simulados) | `frontend/lib/demo/data/` |
| `run_rotation_examples.py` | Corre el motor de rotaciones con 4 casos de ejemplo (`--live` para usar NASA POWER) | `docs/examples/` |

Importante: las solicitudes de AppEEARS quedan horas en cola. Pedirlas el primer día.
