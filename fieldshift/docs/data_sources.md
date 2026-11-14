# Fuentes de datos

> Pendiente de completar: endpoints exactos, licencias y citas formales. Lo marcado con ⚠️ no está verificado.

| Fuente | Producto | Resolución | Uso en FieldShift | Etiqueta | Estado |
|---|---|---|---|---|---|
| NASA POWER | API diaria por punto (`https://power.larc.nasa.gov/api/temporal/daily/point`), comunidad AG: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PS. Disponible desde 1981 hasta casi tiempo real; máximo 20 parámetros por pedido | Meteorología ~0.5° x 0.625° (MERRA-2 / GEOS FP-IT); solar ~1° (CERES) | Clima regional, ET₀, déficit, escenarios, monitor | modelado (reanálisis) | **Integrado**, con caché y fallback |
| MODIS | MOD13A1 (NDVI, compuesto 16 días) | 500 m | Vigor, barbechos, suelo desnudo, tendencia | observado | CSV offline, pendiente |
| SMAP | L3 (capa superficial ~5 cm) | ~9 km ⚠️ | Humedad superficial, contexto regional | observado | CSV offline, pendiente |
| SMAP | L4 (zona de raíces) | ~9 km | Humedad en raíces, contexto regional | **modelado** | CSV offline, pendiente |
| SRTM | Elevación | ~30 m | Pendiente y riesgo relativo de erosión hídrica | observado | Precalculado, pendiente |

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
- SMAP L3 mide solo los primeros ~5 cm. L4 es un producto modelado. Ninguno es una medición del lote.
- MODIS a 500 m sirve para lotes grandes; para lotes chicos la extensión es Landsat/HLS (30 m).
- El carbono orgánico y la materia orgánica **no se miden desde satélite**.
- SRTM solo informa sobre erosión hídrica; en San Luis la erosión eólica es central y no se observa con estos datos.
- −999 en POWER = dato faltante.

## Trabajo futuro (no implementado)

GPM/IMERG (lluvia de mayor resolución), ECOSTRESS (evapotranspiración y estrés hídrico), GRACE-FO (agua subterránea), Landsat/HLS (30 m).

## Atribución

Pendiente: texto de atribución oficial de cada fuente NASA ⚠️.
