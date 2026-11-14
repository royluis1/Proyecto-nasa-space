# FieldShift · Backend (FastAPI)

API de FieldShift para el NASA Space Apps Challenge 2026 (*Field Shift: Adapting Farms with NASA Data*).

> FieldShift es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Estado de esta versión

| Endpoint | Estado |
|---|---|
| `GET /health`, `POST /fields`, `GET /fields/{id}`, `POST /priorities` | Funcionan con datos de muestra |
| `GET /crops` | Catálogo editable de 16 cultivos y coberturas |
| `POST /climate-summary` | **NASA POWER integrado**, con caché; si no responde, usa el CSV real de POWER `data/samples/power_campo1.csv` y, por último, la muestra simulada. -999 = sin dato |
| `POST /soil-moisture`, `POST /vegetation-index` | **SMAP y MODIS NDVI**: AppEEARS (asincrónico), CSV o GeoTIFF cargado, caché y muestra |
| `POST /rotations/compare`, `GET /rotations/{id}` | **Motor de rotaciones**: 7 estrategias, puntaje explicable A/S/R/I/E |
| `GET /scenarios/presets`, `POST /scenarios` | **12 escenarios** (año normal, seco, lluvias intensas, olas de calor, lluvia -10/-20/-30 %, +1/+2 °C, sin riego, riego limitado, riego disponible): recalcula puntajes, ranking, riesgos, recomendación y explicaciones |
| `GET /fields/{id}/sectors`, `GET /fields/{id}/heat-stress` | **Landsat (HLS, 30 m) por sectores** del lote y **ECOSTRESS** (temperatura de la superficie y estrés evaporativo, 70 m), vía AppEEARS |
| `POST /terrain`, `GET /earthdata/status` | **Relieve SRTM con Earthdata Login**: elevación y pendiente del lote; el motor usa la pendiente si el lote no la tiene cargada |
| `POST /alerts`, `POST /huerta`, `POST /forecast` | **Alerta temprana y panel de huerta**: heladas, calor, lluvia intensa, viento, falta de agua y suelo seco por perfil; riego en L/m²; pronóstico de Open-Meteo (no es NASA). Ver [`docs/perfiles_y_alertas.md`](../docs/perfiles_y_alertas.md) |
| `POST /calendar` | **Calendario de 2 a 4 campañas** (julio a junio): siembra, desarrollo, cosecha, barbecho, cobertura, suelo desnudo, riesgo de calor y de déficit hídrico, y recomendaciones. Usa POWER, SMAP y NDVI |
| `GET /export/report`, `POST /export/report` | JSON y CSV con campo, prioridades, resumen climático, rotaciones, puntajes, recomendación, resistencia a escenarios, supuestos, fuentes, advertencias y fecha. El PDF lo arma el frontend |

Los datos de muestra (`app/data/fields.json` y `rotations.json`) son **ilustrativos**: coordenadas aproximadas, suelos y rotaciones de ejemplo. Lo creado con `POST` se guarda en memoria y se pierde al reiniciar.

## Requisitos

Python 3.11 o superior.

## Instalación y ejecución

**macOS / Linux**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Windows (PowerShell)**
```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```
Si PowerShell bloquea el script de activación: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Abrí **http://127.0.0.1:8000/docs** (Swagger, con ejemplos de cada request).

## Tests

```bash
pytest -q
```
`test_api.py` necesita FastAPI y httpx instalados (si faltan, se saltean). Los tests del motor (`test_catalog.py`, `test_engine_units.py`, `test_engine.py`) no usan red.

## Resumen climático con NASA POWER

```bash
curl -X POST http://127.0.0.1:8000/climate-summary \
  -H "Content-Type: application/json" \
  -d '{"latitude": -33.85, "longitude": -65.2, "start_date": "2015-01-01", "end_date": "2025-12-31", "include_daily": false}'
```

- También acepta `field_id` (por ejemplo `"campo-este"`) en lugar de coordenadas.
- `parameters` es opcional: por defecto pide T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN y PS. Los 4 primeros se agregan siempre.
- `include_daily: false` omite la serie diaria (11 años ≈ 0,8 MB de JSON).

**Origen del dato** (`meta.origin_label`), en este orden de búsqueda:

1. **DATO CACHEADO**: caché vigente en `data/cache/` (los pedidos históricos no vencen; los recientes, a las 24 h).
2. **DATO NASA EN VIVO**: consulta a POWER (timeout 30 s, 3 reintentos con backoff ante 429, 5xx o timeout).
3. **DATO CACHEADO** vencido, con advertencia, si POWER no responde.
4. **DATO DE MUESTRA**: datos **simulados** de `data/samples/power_sample_san_luis.csv`, solo si el punto está a menos de 1° de un campo de ejemplo.
5. Si no hay nada: error 503 `NO_DATA_AVAILABLE`.

**Qué devuelve:** serie diaria (con ET₀), resumen mensual, climatología mensual, resumen estacional, resumen anual (con clasificación seco/normal/húmedo y estrés térmico), extremos con fecha, tendencias (Sen + Mann-Kendall), días calurosos, lluvia acumulada, variabilidad (CV), déficit hídrico climático, reporte de faltantes, fuente, fecha de consulta y limitaciones.

### Limitaciones de resolución y datos

- **Resolución:** la meteorología de POWER es de ~0,5° x 0,625° (~50 km) y la radiación de ~1°. Describe el entorno regional, no el lote.
- **Tipo de dato:** es un reanálisis (MERRA-2 / GEOS), o sea, datos **modelados** con asimilación de observaciones. No reemplaza un pluviómetro propio.
- **Datos recientes:** los últimos días o meses vienen de productos preliminares y pueden corregirse.
- **−999:** se trata como faltante. Un mes con más de 20 % de días sin lluvia registrada no se usa; un año con algún mes inválido se excluye de tendencias y clasificación.
- **ET₀ y déficit:** estimaciones FAO-56 con datos regionales. El déficit es climático (ET₀ − lluvia), no el de un cultivo.
- **Años secos/húmedos:** relativos al período pedido (|z| ≥ 1), no a una normal oficial. Con pocos años la clasificación es inestable.
- **Tendencias:** con 10–11 años son orientativas; casi nunca resultan significativas.
- **Uso responsable:** POWER advierte que puede bloquear aplicaciones que consultan repetidamente el mismo punto. Por eso la caché.

## SMAP y MODIS NDVI

```bash
curl -X POST http://127.0.0.1:8000/soil-moisture -H "Content-Type: application/json" -d '{"field_id": "campo-centro"}'
curl -X POST http://127.0.0.1:8000/vegetation-index -H "Content-Type: application/json" -d '{"field_id": "campo-este"}'
```

- Humedad de suelo (SMAP L4, zona de raíces, por defecto): promedio, frecuencia de sequías, meses con baja humedad, tendencia y estrés hídrico relativo.
- NDVI (MOD13Q1, 250 m, por defecto): promedio, cobertura vegetal estimada, barbechos, tendencia de biomasa y comparación entre campañas.
- `csv_content`: CSV de AppEEARS o `date,value[,qa]`. Para GeoTIFF: `scripts/geotiff_to_csv.py`.
- Cada respuesta trae `trace` (fuente, producto, fechas, resolución, estado y limitaciones) y `quality`.
- En vivo: configurar `FIELDSHIFT_APPEEARS_*`. AppEEARS procesa en cola: la primera consulta crea la tarea y responde con la muestra.

Productos, métricas, integración con el motor y limitaciones: [`docs/satellite.md`](../docs/satellite.md).

## Motor de rotaciones

```bash
curl -X POST http://127.0.0.1:8000/rotations/compare \
  -H "Content-Type: application/json" \
  -d '{"field_id": "campo-centro", "priorities": {"water": 9, "soil": 6, "risk": 7, "income": 4, "sustainability": 5},
       "scenario": {"id": "seco", "name": "Lluvia -20 %", "rain_delta_pct": -20}}'
```

Genera y compara la rotación actual, la conservadora, la diversificada, la de ahorro de agua, la de salud del suelo, la de rentabilidad y la mixta recomendada. Cada una trae:

- puntaje total de 0 a 100 con rango de incertidumbre, y desglose en A (agua), S (suelo), R (riesgo climático), I (ingreso) y E (sostenibilidad), con cada bonificación y penalización;
- perfil: secuencia, demanda de agua, meses cubiertos, impacto en suelo, erosión y biodiversidad, ingreso relativo y complejidad;
- explicación en lenguaje simple, riesgos, supuestos, incertidumbres, evidencia separada en datos NASA / suelo / productor / a validar, nivel de confianza y advertencia profesional.

Cómo se calcula cada puntaje: [`docs/scoring.md`](../docs/scoring.md). Ejemplos de salida: [`docs/examples/`](../docs/examples/README.md).

Archivos editables: `app/data/crops.json` (catálogo) y `app/data/rotation_templates.json` (reglas de rotación). El servidor no arranca si nombran cultivos inexistentes.

## Configuración

Todo por variables de entorno con prefijo `FIELDSHIFT_` (ver `.env.example`). No hay claves en el código; NASA POWER no requiere clave.

Si NASA POWER no responde, el servidor no lo vuelve a intentar en vivo durante `FIELDSHIFT_POWER_COOLDOWN_S` segundos (5 minutos por defecto) y usa la caché o la muestra. Así cada pedido no espera todos los reintentos.

Earthdata Login y SRTM: ver [`docs/earthdata.md`](../docs/earthdata.md).

Calendario, escenarios y reporte: ver [`docs/calendario_escenarios_reporte.md`](../docs/calendario_escenarios_reporte.md).

## Arquitectura

```
app/
├── main.py          crea la app: CORS, request_id, logging, handlers, rutas
├── config.py        Settings (pydantic-settings)
├── api/             rutas HTTP, dependencias y ejemplos de Swagger
├── services/        repositorio de datos, NASA POWER, clima y motor de rotaciones (services/engine/)
├── models/          enums, procedencia (Provenance/Valued) y constantes
├── schemas/         contratos de request/response (Pydantic v2)
├── data/            JSON de muestra
├── utils/           validadores, excepciones, handlers de error, logging JSON
└── tests/
```

- **Rutas finas:** validan, llaman a servicios y envuelven la respuesta. No tienen lógica.
- **Sobre de respuesta único:** `{"data": ..., "meta": {data_status, as_of, warnings, disclaimer}}`. `data_status` es `live`, `cached`, `sample` o `mock`.
- **Errores consistentes:** `{"error": {code, message, details, request_id}}` para validación (422), dominio (400/404), HTTP y errores no controlados (500, sin filtrar detalles internos).
- **Procedencia:** los valores usan `Provenance` con etiqueta *observado / modelado / estimado / supuesto*, fuente, resolución y confianza.
- **Trazabilidad:** cada request tiene `X-Request-ID` (se respeta si lo manda el cliente) y se registra en logs JSON con método, ruta, estado y duración.
