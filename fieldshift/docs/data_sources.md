# Fuentes de datos

> Pendiente de completar: endpoints exactos, licencias y citas formales. Lo marcado con ⚠️ no está verificado.

| Fuente | Producto | Resolución | Uso en FieldShift | Etiqueta | Estado |
|---|---|---|---|---|---|
| NASA POWER | API diaria por punto (`https://power.larc.nasa.gov/api/temporal/daily/point`), comunidad AG: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PS. Disponible desde 1981 hasta casi tiempo real; máximo 20 parámetros por pedido | Meteorología ~0.5° x 0.625° (MERRA-2 / GEOS FP-IT); solar ~1° (CERES) | Clima regional, ET₀, déficit, escenarios, monitor | modelado (reanálisis) | **Integrado**, con caché y fallback |
| MODIS | **MOD13Q1 v6.1** (NDVI, compuesto 16 días); MYD13Q1 y MOD13A1 como alternativas | 250 m (500 m en A1) | Vigor, cobertura, barbechos, tendencia de biomasa, campañas | observado | **Integrado** (AppEEARS, CSV/GeoTIFF, muestra) |
| SMAP | **SPL4SMGP v8** (zona de raíces 0-100 cm, por defecto) | 9 km, cada 3 h | Humedad en raíces, sequías, estrés hídrico | **modelado** | **Integrado** (AppEEARS, CSV, muestra) |
| SMAP | SPL3SMP_E v6 (superficial ~5 cm) | 9 km, diaria con huecos | Humedad superficial | observado | Admitido (CSV o AppEEARS) |
| SRTM | **SRTMGL1 v3** (elevación, LP DAAC, con Earthdata Login); SRTMGL3 (90 m) opcional | ~30 m | Pendiente del lote (método de Horn) para el riesgo de erosión hídrica del puntaje de suelo | observado (año 2000) | **Integrado** (Earthdata Login + CMR, caché, muestra) |

### Zonas, suelo y humedad satelital

| Fuente | Producto | Resolución | Licencia | Uso en FieldShift | Etiqueta | Estado |
|---|---|---|---|---|---|---|
| **IGN** (Instituto Geográfico Nacional) | Capa `ign:provincia` del servicio WFS wms.ign.gob.ar | Oficial (simplificada a ~1 km para el mapa) | Reutilización y redistribución libres según el Art. 2 de la Ley 27.275 (lo declara el propio servicio) | Límites provinciales del mapa | observado | **En uso** (`data/samples/provincias_argentina.geojson`, descargada el 14/11/2026; al sur de 60° S se recorta solo para la vista) |
| **Natural Earth** | Admin 1 – States, Provinces, 1:10m | 1:10.000.000 (bordes aproximados) | Dominio público | Respaldo si no se puede bajar el IGN (`build_provinces.py` sin `--source`) | observado | Respaldo |
| **NASA POWER** | Diario, comunidad AG, 2015-2025, un punto por celda | 0,5° x 0,625° (~55 km) | Uso libre con cita | Zonas climáticas de San Luis (índice de aridez UNEP), clima de cada zona | modelado | **Calculadas** el 14/11/2026 con `build_zones.py --live` (`zonas_san_luis.geojson`, 39 celdas, 4 zonas). La muestra simulada queda como respaldo |
| **SoilGrids v2.0** (ISRIC) | Arcilla, arena, limo y carbono orgánico, 0-30 cm (media) | 250 m | CC BY 4.0 | Suelo ESTIMADO del campo (textura USDA y materia orgánica en categorías) | estimado | Integrado y **verificado con respuestas reales** el 14/11/2026 (API REST "beta / fair use" de ISRIC), con caché, muestra simulada rotulada y vacío con aviso |
| **INTA** | Carta de Suelos de la República Argentina | Según la hoja | ⚠️ No verificada | Tendría prioridad sobre SoilGrids si el equipo consigue el archivo | observado | No integrada |
| **SMAP L3** (SPL3SMP_E v6) | Humedad superficial (~5 cm), pasada de la mañana | 9 km, cada 2-3 días | NASA, uso libre con cita | Humedad del suelo satelital del lote (contexto regional) | **observado** | Integrado (AppEEARS, CSV, caché); en el repositorio, muestra simulada `smap_l3_sample_san_luis.csv` |
| **SMAP L4** (SPL4SMGP v8) | Humedad en zona de raíces (0-100 cm) | 9 km, cada 3 h | NASA, uso libre con cita | Ídem | **modelado** | Integrado (ídem) |

Las zonas **no son zonas agroecológicas oficiales**: son "zonas climáticas derivadas de NASA POWER". El suelo **no se mide desde satélite**: se estima con un mapa y lo cargado por el productor o el análisis de laboratorio tiene prioridad.

## Referencias del motor de rotaciones

| Referencia | Uso |
|---|---|
| FAO-56 (Allen et al., 1998): Tabla 12 (Kc) y Tabla 19 (agua útil por textura) | Demanda hídrica de cada cultivo y tope de almacenaje del perfil |
| FAO-33 (Doorenbos y Kassam, 1979): Ky | Caída del rendimiento por déficit hídrico en el ingreso relativo |
| USDA-SCS, fórmula simplificada de FAO CROPWAT | Lluvia efectiva mensual |
| UNEP (1992), World Atlas of Desertification | Clases de aridez P/ET0 |
| INTA EEA San Luis y guías de cultivos de cobertura ⚠️ | Atributos cualitativos del catálogo: **pendiente verificar documento por documento** |

## Limitaciones

- POWER describe el **entorno regional**, no el lote.
- SMAP L3 mide solo los primeros ~5 cm. L4 es un producto modelado. Ninguno es una medición del lote (píxel de 9 km).
- MODIS a 250 m sirve para lotes de más de ~25 ha; para lotes chicos la extensión es Landsat/HLS (30 m).
- Detalle de productos, obtención, métricas y limitaciones: [satellite.md](satellite.md).
- El carbono orgánico y la materia orgánica **no se miden desde satélite**.
- SRTM solo informa sobre erosión hídrica; en San Luis la erosión eólica es central y no se observa con estos datos.
- −999 en POWER = dato faltante.

## Trabajo futuro (no implementado)

GPM/IMERG (lluvia de mayor resolución), ECOSTRESS (evapotranspiración y estrés hídrico), GRACE-FO (agua subterránea), Landsat/HLS (30 m).

## Atribución

Pendiente: texto de atribución oficial de cada fuente NASA ⚠️.
