# Scripts de datos (pendiente)

Se corren offline, no forman parte de la API. Dependencias extra de los scripts: `pip install -r scripts/requirements.txt`. Acá sí se usan librerías pesadas (geopandas, xarray, rasterio) para no complicar la instalación del backend.

| Script previsto | Qué hace | Salida |
|---|---|---|
| `fetch_appeears` | Pide a AppEEARS (requiere cuenta Earthdata) la extracción por punto de MOD13A1 y SMAP | archivos crudos |
| `preprocess_ndvi` | Aplica factor de escala, QA y faltantes al NDVI | `data/samples/ndvi_<campo>.csv` |
| `preprocess_smap` | Filtra por calidad la humedad SMAP L3 y L4 | `data/samples/smap_<campo>.csv` |
| `srtm_slope` | Ya no hace falta: el backend descarga SRTM con Earthdata Login (`POST /terrain`, ver docs/earthdata.md) | `data/samples/srtm_sample_san_luis.json` (muestra simulada) |
| `warm_cache` | Precarga NASA POWER de los 3 campos antes del demo | `data/cache/` |

Scripts ya disponibles:

| Script | Qué hace | Salida |
|---|---|---|
| `generate_power_sample.py` | Genera el clima diario **simulado** de los 3 campos | `data/samples/power_sample_san_luis.csv` |
| `generate_satellite_samples.py` | Genera SMAP y NDVI **simulados** con el formato de AppEEARS | `data/samples/smap_sample_san_luis.csv`, `ndvi_sample_san_luis.csv` |
| `geotiff_to_csv.py` | Convierte GeoTIFF de AppEEARS (pedido de área) en `date,value,qa` para la API. Requiere `rasterio` | CSV para `csv_content` |
| `build_provinces.py` | Límites provinciales simplificados: Natural Earth (por defecto) o el archivo del IGN (`--source ign --input`). Requiere `shapely` | `data/samples/provincias_argentina.geojson` |
| `build_zones.py` | Zonas climáticas de San Luis: `--live` consulta NASA POWER celda por celda (con pausa y caché); `--sample` genera la MUESTRA SIMULADA. Requiere `shapely` | `data/samples/zonas_san_luis.geojson` o `zonas_san_luis_muestra.geojson` |
| `generate_hls_eco_samples.py` | Muestras **simuladas** de Landsat HLS por sector y de ECOSTRESS con el formato de AppEEARS | `data/samples/hls_sectors_sample_san_luis.csv`, `ecostress_sample_san_luis.csv` |
| `generate_smap_l3_sample.py` | Muestra **simulada** de SMAP L3 con el formato de AppEEARS | `data/samples/smap_l3_sample_san_luis.csv` |
| `export_demo_data.py` | Genera los datos de ejemplo del modo demostración del frontend (con el motor real y clima, SMAP y NDVI simulados) | `frontend/lib/demo/data/` |
| `run_rotation_examples.py` | Corre el motor de rotaciones con 4 casos de ejemplo (`--live` para usar NASA POWER) | `docs/examples/` |

Importante: las solicitudes de AppEEARS quedan horas en cola. Pedirlas el primer día.

## build_localities.py

Descarga las ciudades y pueblos de Argentina del IGN (capa Localidad BAHRA) y genera
`data/samples/localidades_ar.json`. Sirve para buscar la localidad por nombre y para decir dónde está un campo.

```bash
python scripts/build_localities.py                  # todo el país (~3.500 localidades)
python scripts/build_localities.py --provincia "San Luis"
```
