# Scripts de datos (pendiente)

Se corren offline, no forman parte de la API. Acá sí se usan librerías pesadas (geopandas, xarray, rasterio) para no complicar la instalación del backend.

| Script previsto | Qué hace | Salida |
|---|---|---|
| `fetch_appeears` | Pide a AppEEARS (requiere cuenta Earthdata) la extracción por punto de MOD13A1 y SMAP | archivos crudos |
| `preprocess_ndvi` | Aplica factor de escala, QA y faltantes al NDVI | `data/samples/ndvi_<campo>.csv` |
| `preprocess_smap` | Filtra por calidad la humedad SMAP L3 y L4 | `data/samples/smap_<campo>.csv` |
| `srtm_slope` | Calcula elevación y pendiente por campo | `data/samples/srtm_<campo>.json` |
| `warm_cache` | Precarga NASA POWER de los 3 campos antes del demo | `data/cache/` |

Importante: las solicitudes de AppEEARS quedan horas en cola. Pedirlas el primer día.
