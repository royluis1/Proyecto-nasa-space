# Fuentes de datos

> Pendiente de completar: endpoints exactos, licencias y citas formales. Lo marcado con ⚠️ no está verificado.

| Fuente | Producto | Resolución | Uso en FieldShift | Etiqueta | Estado |
|---|---|---|---|---|---|
| NASA POWER | API diaria, comunidad AG: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN | ~0.5° x 0.625° | Clima regional, ET₀, escenarios, monitor | observado / modelado (reanálisis) | En vivo, pendiente |
| MODIS | MOD13A1 (NDVI, compuesto 16 días) | 500 m | Vigor, barbechos, suelo desnudo, tendencia | observado | CSV offline, pendiente |
| SMAP | L3 (capa superficial ~5 cm) | ~9 km ⚠️ | Humedad superficial, contexto regional | observado | CSV offline, pendiente |
| SMAP | L4 (zona de raíces) | ~9 km | Humedad en raíces, contexto regional | **modelado** | CSV offline, pendiente |
| SRTM | Elevación | ~30 m | Pendiente y riesgo relativo de erosión hídrica | observado | Precalculado, pendiente |

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
