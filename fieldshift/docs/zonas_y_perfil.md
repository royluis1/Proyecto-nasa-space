# Zonas climáticas, perfil automático del campo y humedad del suelo satelital

> FieldShift es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Qué hay y qué es cada cosa

- **Zonas climáticas derivadas de NASA POWER.** Se calculan con el índice de aridez de la UNEP. **No son zonas agroecológicas oficiales**. Hay detalle solo para San Luis; el resto de las provincias dice "zonificación disponible próximamente".
- **Aptitud de cultivos por zona.** Es una orientación por reglas (alta, media o baja, con motivos), **no una recomendación de siembra**. Siempre lleva "Requiere validación agronómica local".
- **Perfil automático del campo.** Al cargar el campo se completan el suelo **estimado**, la zona, los cultivos más aptos y el aviso de transición. **Lo que carga el productor siempre pisa lo automático**, y el análisis de laboratorio tiene prioridad.
- **Humedad del suelo satelital (contexto regional).** Viene de SMAP: L3 es la capa superficial, observada; L4 es la zona de raíces, modelada. Los píxeles son de ~9 km. Siempre se muestra la "última observación disponible": **no es tiempo real ni un sensor en el lote**.

## Datos en el repositorio y cómo cambiarlos por los reales

| Archivo | Qué es | Cómo se genera |
|---|---|---|
| `data/samples/provincias_argentina.geojson` | Provincias de **Natural Earth** (dominio público, 1:10m, simplificadas a ~1 km) | `python scripts/build_provinces.py` |
| (reemplazo) | Provincias del **IGN** | Descargar la capa "Provincia" de ign.gob.ar y correr `python scripts/build_provinces.py --source ign --input provincias.geojson` |
| `data/samples/zonas_san_luis_muestra.geojson` | **MUESTRA SIMULADA** de zonas (se ve "DATO DE MUESTRA") | `python scripts/build_zones.py --sample` |
| `data/samples/zonas_san_luis.geojson` | Zonas reales con NASA POWER. Si está, tiene prioridad sobre la muestra | `python scripts/build_zones.py --live`: unos 40 pedidos, uno cada 2 s, con caché en `data/cache/zones/` para retomar |
| `data/samples/soil_sample_san_luis.json` | Suelo **simulado** de los 3 campos de ejemplo | A mano |
| `data/samples/smap_l3_sample_san_luis.csv` | SMAP L3 **simulado** con el formato de AppEEARS | `python scripts/generate_smap_l3_sample.py` |

Los scripts necesitan `pip install -r scripts/requirements.txt` (shapely). El servidor no: usa geometría propia, sin PostGIS.

## Método de zonificación

1. Se arma la grilla de celdas de NASA POWER (meteorología MERRA-2: 0,5° x 0,625°, ~55 km), recortada a la provincia.
2. Para el centro de cada celda se toman los datos diarios 2015-2025 (comunidad AG). Por año se calculan lluvia, ET0 FAO-56 Penman-Monteith, déficit (ET0 − lluvia), días con Tmax > 35 °C y días con Tmin ≤ 2 °C.
3. Se calcula el **índice de aridez** (lluvia / ET0) y se clasifica según la UNEP:
   - árida: menos de 0,20;
   - semiárida: de 0,20 a 0,50;
   - subhúmeda seca: de 0,50 a 0,65;
   - subhúmeda húmeda o más húmeda: 0,65 o más.

   También se guarda la clase de cada año, para medir cuánto cambia.
4. Las zonas son la unión de las celdas de la misma clase. El mapa puede mostrar también las celdas, que son la resolución real del dato.

## Transición húmedo / seco

Un campo está en transición si cumple **cualquiera** de estas condiciones (supuestos en `docs/assumptions.md`):

- **a)** está a 25 km o menos del borde con otra zona;
- **b)** su índice de aridez está a 0,05 o menos de un límite de clase;
- **c)** en el 30 % o más de los años su celda cayó en otra zona.

Si está en transición:

- se avisa: "Tu campo está en una zona de transición entre … y …: según el año, se comporta como una u otra";
- se muestra la aptitud para **las dos zonas**;
- se proponen **opciones a evaluar**, cada una con su motivo y su fuente:
  - cultivos tolerantes a sequía con aptitud media o alta en las dos zonas;
  - cultivos de cobertura;
  - flexibilidad en la fecha de siembra;
  - barbecho para acumular agua.

## Reglas de aptitud (resumen)

- **Agua** (secano): el requerimiento hídrico del cultivo se cruza con la clase de la zona. La alta tolerancia a sequía sube un nivel, pero **un cultivo de alta demanda nunca sale "alta" en zona árida o semiárida**.
- **Calor**: baja la aptitud de los cultivos poco tolerantes que están en el lote en verano, según los días por año con más de 35 °C.
- **Heladas**: baja la aptitud de los cultivos poco tolerantes que están en el lote en invierno. Si no están en invierno, solo se avisa el riesgo.
- **Resultado**: la peor de las tres, con los números como motivo. La confianza es baja con la muestra y media con POWER; nunca alta.
- Siempre se lista lo que **la zona no captura**: suelo, riego, fecha de siembra y ciclo, y barbecho previo.

## Endpoints

| Método y ruta | Request | Response | Errores | Fuente |
|---|---|---|---|---|
| `GET /regions/provinces` | — | GeoJSON de provincias con `has_zones` y `zones_origin`, más fuente y licencia de los límites | — | Natural Earth (o IGN) |
| `GET /regions/{province_id}/zones` | `province_id` (por ejemplo `san-luis`) | `available`, método, umbrales, origen, fecha de cálculo, advertencia; `zones` (GeoJSON con clima y aptitud resumida) y `cells` (celdas de POWER) | 404 si la provincia no existe; `available: false` si no tiene zonas | NASA POWER (o muestra) |
| `GET /zones/at?lat=&lon=` | Coordenadas | Provincia, zona, celda con su clima, transición (motivos, mensaje, aptitud en la otra zona, opciones) y cultivos más aptos | 404 fuera de las provincias; 422 coordenadas inválidas | Ídem |
| `GET /crops/suitability?zone_id=` | `zone_id` (por ejemplo `san-luis-semiarido`) | Zona y aptitud de cada cultivo, con motivos, riesgos, de qué depende, confianza y "Requiere validación agronómica local" | 404 zona inexistente | Catálogo y zonas |
| `POST /fields` (y `PUT /fields/{id}`) | Datos del campo | El campo con `auto_profile`: suelo estimado (con fuente, 250 m, "estimado"), qué datos se completaron, zona, transición, cultivos más aptos y avisos | 422 datos inválidos | SoilGrids, zonas |
| `GET /fields/{field_id}/soil-moisture?recent_days=60` | — | L3 y L4: última observación, serie reciente, promedio del mes frente al mismo mes de otros años, anomalía y lectura en palabras, etiqueta observado/modelado y limitaciones | 404 lote inexistente; 503 si no hay ningún dato | SMAP (AppEEARS, CSV o muestra) |

## En la app (frontend)

| Dónde | Qué muestra |
|---|---|
| **Mapa de zonas** (`/zonas`, en el encabezado) | Mapa de Argentina por provincias. Al tocar una provincia (o elegirla en el selector), el mapa hace zoom y muestra sus zonas. Si no tiene, dice "zonificación disponible próximamente" |
| | Cada zona tiene **color, patrón y rótulo**: puntos para árida, rayas diagonales para semiárida, cuadriculado para subhúmeda seca y rayas horizontales para húmeda. La leyenda está en texto |
| | **Selector de cultivo**: las zonas se pintan y se rotulan por su aptitud ("Semiárida: Maíz baja"): liso = alta, rayado = media, cuadriculado = baja |
| | Opción para ver las **celdas de NASA POWER**, que son la resolución real del dato |
| | Una tabla con los mismos datos, como alternativa accesible al mapa |
| | Al elegir una zona: su clima, la aptitud de cada cultivo con motivos y riesgos, lo que la zona no captura, fuente, origen y fecha de cálculo |
| **Perfil del campo** (`/campo/[id]/perfil`) | Tarjeta **"Perfil automático de tu campo"**: el suelo que se usa (y si es estimado, cargado o de laboratorio), la estimación con su fuente, la zona, el aviso de **transición** con motivos, opciones a evaluar y aptitud en la otra zona, los cultivos más aptos y los avisos (por ejemplo, "No se estimó el suelo") |
| **Diagnóstico** (`/campo/[id]/diagnostico`) | **"Humedad del suelo satelital (contexto regional)"**: SMAP L3 (observado) y L4 (modelado) con la última observación disponible, la lectura frente a lo normal del mes y la serie reciente. Aclara que no es tiempo real ni un sensor en el lote |

Sin conexión con el servidor, todo esto funciona con los datos de ejemplo de `frontend/lib/demo/data/`. Un campo guardado solo en el navegador usa la zona del campo de ejemplo más cercano, y lo avisa.

## Sensores propios (preparado, sin implementar)

`backend/app/services/soil_moisture_sources.py` define la interfaz `SoilMoistureSource` y `SensorReading` (ubicación y profundidad de cada sensor). No hay endpoint ni almacenamiento todavía. El endpoint de humedad lo aclara en `sensors`.

## Pruebas

`frontend/tests/zones.test.ts` cubre los estilos (nunca solo color), la aptitud por cultivo en el mapa y los datos de ejemplo. `backend/app/tests/test_zones_profile.py` cubre:

- clasificación con datos sintéticos;
- punto dentro y fuera de zonas y provincias;
- transición cerca del borde, cerca del umbral, por variabilidad y lejos;
- reglas de aptitud;
- prioridad de lo cargado por el productor;
- respaldo sin red de suelo, zonas y SMAP;
- los endpoints.
