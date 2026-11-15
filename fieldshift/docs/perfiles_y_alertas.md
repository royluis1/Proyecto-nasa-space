# Perfiles (Huerta y Agricultor), fuentes y alerta temprana

> FieldShift es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Ingreso por perfil

En `/ingresar` el usuario elige **Huerta** o **Agricultor**. No hay contraseña: el perfil se guarda en el navegador (`localStorage`, clave `fieldshift:perfil`) y se cambia desde el encabezado ("Huerta · Cambiar").

| Perfil | Al abrir un campo | Pantallas |
|---|---|---|
| 🥬 Huerta | `/campo/[id]/huerta` | Mi huerta, Alertas, Clima y satélites |
| 🚜 Agricultor | `/campo/[id]/perfil` | Perfil, Diagnóstico, Alertas, Comparador, Dashboard, Calendario, Escenarios, Reporte |

## Los tres enfoques

| Enfoque | Dónde está |
|---|---|
| Simulador de riesgo | Escenarios, Comparador, Dashboard |
| Sostenibilidad y salud del suelo | Diagnóstico (NDVI, SRTM), Calendario (suelo desnudo, cobertura), puntaje de suelo |
| Diagnóstico y alerta temprana | Alertas (y el panel de huerta) |

## Fuentes por perfil

**Huerta**

| Para qué | Fuente | Estado |
|---|---|---|
| Clima y heladas | NASA POWER | Funcionando |
| Riego | NASA POWER (ET0 y lluvia normal) | Funcionando |
| Lluvia pasada | NASA POWER | Funcionando (GPM/IMERG, próximamente) |
| Lluvia futura | Open-Meteo, **no es NASA** (se aclara) | Funcionando |
| Vegetación de la zona | MODIS | Funcionando (Landsat, próximamente) |
| Calor de la zona (extra) | ECOSTRESS (temperatura de la superficie) | Funcionando |

**Agricultor**

| Para qué | Fuente | Estado |
|---|---|---|
| Clima y heladas | NASA POWER | Funcionando |
| Balance de agua (demanda del cultivo) | NASA POWER | Funcionando |
| Lluvia pasada y eventos extremos | GPM/IMERG | Próximamente (mientras tanto, POWER) |
| Lluvia futura | Open-Meteo, **no es NASA** | Funcionando |
| Vigor, barbechos y suelo desnudo por sector del lote | Landsat (HLS, 30 m), 9 sectores | Funcionando |
| Historial largo de vegetación y años secos | MODIS | Funcionando |
| Humedad del suelo | SMAP | Funcionando |
| Calor y estrés de la zona (extra) | ECOSTRESS (temperatura y estrés evaporativo) | Funcionando |
| Relieve y riesgo de erosión | SRTM | Funcionando |

## NASA POWER: en vivo, con respaldo

**Consulta en vivo** (API pública, sin cuenta):

```
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,...&community=AG&latitude={lat}&longitude={lon}&start={AAAAMMDD}&end={AAAAMMDD}&format=JSON
```

**Valores faltantes**: `-999` es "sin dato" (`NaN`), tanto en el JSON como en los CSV de POWER. No entra en promedios ni sumas.

**Orden de respaldo si POWER no responde**

1. Caché vigente.
2. Caché vencida.
3. **Archivo CSV de POWER descargado antes**: `data/samples/power_campo1.csv`. Es el `campo1.csv`, con datos reales de POWER del 2015-01-01 al 2026-10-31 en -33,9265 / -65,0721. Se usa para puntos a menos de 1° y se marca "DATO NASA CARGADO POR EL USUARIO". Como el archivo no trae presión atmosférica, se calcula con la elevación del encabezado (FAO-56, ec. 7) para la ET0.
4. Muestra simulada, marcada "DATO DE MUESTRA".

Se agregan más archivos con `FIELDSHIFT_POWER_FALLBACK_FILES` (lista JSON de nombres dentro de `data/samples`).

**En pantalla**, cada dato muestra la fuente ("NASA POWER"), la **fecha de consulta** y el **tipo** ("modelado"). Para el archivo, la fecha es la de carga.

## Pronóstico: Open-Meteo

- `POST /forecast`: temperaturas, lluvia, probabilidad, ET0 y viento de hasta 16 días. Guarda el resultado 3 horas.
- **No es un dato de la NASA**, y así se muestra.
- Es gratis sin clave para uso no comercial. Para un cliente comercial, Open-Meteo pide un plan con clave: `FIELDSHIFT_OPEN_METEO_URL=https://customer-api.open-meteo.com/v1/forecast` y `FIELDSHIFT_OPEN_METEO_API_KEY`.
- Si no responde, las alertas y el panel siguen con POWER y SMAP, y lo avisan. No se inventa un pronóstico.

### Pronóstico desde el navegador

Si la respuesta del servidor no trae pronóstico, el navegador consulta Open-Meteo directamente (`frontend/lib/open-meteo.ts`, función `getForecast(lat, lon)`). Pasa cuando el servidor no está o cuando el servidor no llega a Open-Meteo. Después recalcula las alertas con las mismas reglas que el backend (`frontend/lib/alerts.ts`). Un test compara los dos con 12 casos generados por el backend (`frontend/tests/fixtures/alerts-parity.json`). En pantalla se aclara: "Pronóstico consultado desde tu navegador (Open-Meteo, no es NASA)".

## Imagen satelital del día (NASA GIBS)

En los mapas hay un botón **"NASA del día"**. Muestra la imagen MODIS Terra en color real de NASA GIBS: es pública, no pide cuenta y tiene un píxel de unos 250 m.

```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{AAAA-MM-DD}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg
```

Por defecto muestra la imagen de ayer, porque la de hoy suele estar incompleta. Se puede elegir otra fecha, desde 2000-02-24. En Diagnóstico y en Mi huerta está la tarjeta "Tu zona hoy, vista por la NASA". Sirve para ver nubes, humo, verdor o anegamientos de la zona, no el detalle del lote.

## Alertas (`POST /alerts`, con `profile`: `huerta` o `agricultor`)

| Alerta | Cuándo | Fuente |
|---|---|---|
| Helada | Mínima ≤ 0 °C (importante); de 0 a 2 °C, posible helada | Open-Meteo |
| Calor fuerte | Máxima ≥ 35 °C; importante desde 38 °C o con 3 días seguidos | Open-Meteo |
| Lluvia intensa | ≥ 30 mm en un día; importante desde 50 mm | Open-Meteo |
| Viento | Ráfagas ≥ 60 km/h | Open-Meteo |
| Falta de agua | < 5 mm en 10 días con > 30 mm de ET0; importante si además el último mes llovió menos del 50 % de lo normal | Open-Meteo + NASA POWER |
| Suelo seco | SMAP ≥ 20 % por debajo de lo normal | NASA SMAP |

El mismo evento tiene un mensaje distinto según el perfil. A la huerta le dice, por ejemplo, que cubra las plantas con manta antihelada. Al agricultor, que se cuide la floración y que postergue siembras.

## Panel de huerta (`POST /huerta`)

- **Riego**:
  - Cálculo base: ET0 normal de la época (NASA POWER) × Kc 1,0 − 80 % de la lluvia normal, en litros por m² por semana (1 mm = 1 L/m²).
  - Si hay pronóstico, también se calcula para los próximos 7 días.
- **Heladas** (NASA POWER, 10 años):
  - días con helada por año y meses en que hiela al menos 1 de cada 5 años;
  - última helada típica de primavera: la fecha que 8 de cada 10 años ya pasó;
  - primera helada típica de otoño: la fecha que 8 de cada 10 años todavía no llegó.
  - Es la temperatura del aire a 2 m: en el suelo puede helar más seguido.
- **Calor**: días por año con más de 35 °C, meses de calor y días de calor en el pronóstico.
- **Lluvia**:
  - de los últimos 30 días, frente a lo normal (POWER publica con unos días de atraso);
  - la pronosticada.
- **Verdor de la zona**: MODIS NDVI, píxel de 250 m.
- **Alertas y consejos** según la época.

## Próximos pasos

- **GPM/IMERG**: lluvia satelital diaria de 10 km, desde GES DISC con Earthdata Login. La sesión de Earthdata ya está hecha (`docs/earthdata.md`).
- ~~Landsat y ECOSTRESS~~: hechos (`GET /fields/{id}/sectors` y `GET /fields/{id}/heat-stress`; tarjetas en Diagnóstico y Mi huerta).

## Dónde está la huerta (ciudad o pueblo)

Para que el perfil Huerta sea simple, no hace falta marcar un punto en el mapa:

- Al cargar un campo se puede **buscar la ciudad o pueblo por nombre** (buscador con lista, sin tildes ni mayúsculas).
  Al elegirla se completa la ubicación y, si está vacío, el nombre del campo.
- La pantalla **Mi huerta** muestra arriba dónde está: "En Justo Daract, San Luis". Si la localidad está a más de 3 km
  dice "Cerca de X, a N km", para no dar a entender que la huerta está dentro del pueblo.
- El clima, el pronóstico y las alertas se calculan con las **coordenadas del campo**, que son las de esa ciudad si se
  eligió del buscador.

Endpoints: `GET /localidades?q=` (buscar) y `GET /localidades/cerca?lat=&lon=` (la más cercana).
Datos: IGN / BAHRA, ver [data_sources.md](data_sources.md).
