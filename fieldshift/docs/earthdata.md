# NASA Earthdata Login y relieve SRTM

FieldShift descarga archivos protegidos de la NASA con **Earthdata Login** (URS). El primer uso es **SRTM** (Shuttle Radar Topography Mission, v3, de LP DAAC): la elevación y la pendiente del lote.

## Cómo se configura

1. Creá una cuenta gratis en https://urs.earthdata.nasa.gov. Si ya tenés la de AppEEARS, es la misma.
2. En el perfil de Earthdata, en **Applications > Authorized Apps**, aprobá **LP DAAC Data Pool**. Si falta, el servidor devuelve una página web en vez del archivo y FieldShift avisa con ese mensaje.
3. Cargá las credenciales en el entorno del servidor (archivo `backend/.env`, o "Environment" en Render), **nunca en el código ni en el repositorio**:

```
FIELDSHIFT_EARTHDATA_USERNAME=tu_usuario
FIELDSHIFT_EARTHDATA_PASSWORD=tu_contraseña
# o, en lugar de usuario y contraseña, un token generado en urs.earthdata.nasa.gov ("Generate Token"):
FIELDSHIFT_EARTHDATA_TOKEN=
```

Si quedan vacías, se usan `FIELDSHIFT_APPEEARS_USERNAME` y `_PASSWORD`, que son la misma cuenta. `GET /earthdata/status` dice si hay credenciales y de qué tipo, sin mostrarlas.

## Cómo funciona la descarga

Sigue los ejemplos oficiales de Earthdata (`urllib` con `HTTPBasicAuthHandler` y `CookieJar`, o `requests.Session` con `rebuild_auth`). Está en `backend/app/services/earthdata/session.py`, con `httpx`.

1. Se pide el archivo al servidor de datos (`data.lpdaac.earthdatacloud.nasa.gov`).
2. El servidor redirige a `urs.earthdata.nasa.gov`. Ahí, y **solo ahí**, se manda el usuario y la contraseña. Con token, se manda también al servidor de datos original.
3. URS devuelve al servidor de datos, que deja una cookie de sesión. El cliente la guarda.
4. El servidor redirige al archivo en el almacenamiento en la nube. Ahí no se manda ninguna credencial.

Además:

- La descarga se escribe en un archivo temporal y se renombra al terminar.
- Si llega una página HTML (falta aprobar la aplicación) o un 401/403, se corta con un mensaje claro.
- Las credenciales no aparecen en los registros ni en los errores.

## SRTM en FieldShift

1. **Baldosa**: la de 1° × 1° que contiene el lote (por ejemplo `S34W066` para -33,85, -65,2). La URL se busca en CMR, el catálogo público de NASA. Si CMR no responde, se usa la ruta conocida de LP DAAC.
2. **Lectura**: el `.hgt` es una matriz de enteros de 16 bits big-endian, de 3601 × 3601 (SRTMGL1, 30 m) o 1201 × 1201 (SRTMGL3, 90 m). Los vacíos valen -32768.
3. **Zona**: el polígono del lote si se dibujó en el mapa. Si no, un círculo con la superficie del lote (entre 90 y 2000 m de radio).
4. **Pendiente**: método de Horn (ventana de 3 × 3). Se informan media, percentil 90 y máxima, la elevación (media, mínima y máxima) y una clase: plano < 1 %, suave 1-3 %, moderada 3-8 %, fuerte ≥ 8 %.
5. **Motor**: si el lote no tiene pendiente cargada, `/rotations/compare` usa la pendiente media de SRTM en el riesgo de erosión del puntaje de suelo. Se avisa con el prefijo "SRTM:".

**Orden de respaldo**

1. Resultado guardado en caché.
2. Baldosa ya descargada (`data/cache/srtm/`).
3. Descarga en vivo.
4. Muestra simulada (`data/samples/srtm_sample_san_luis.json`), siempre marcada como `DATO DE MUESTRA`.

Si Earthdata falla, no se vuelve a probar en vivo durante `FIELDSHIFT_POWER_COOLDOWN_S` segundos (5 minutos por defecto).

`FIELDSHIFT_SRTM_PRODUCT=SRTMGL3` baja baldosas de ~3 MB en lugar de ~25 MB, con menos detalle.

## Limitaciones

- SRTM es del año 2000: no ve terrazas, canales ni caminos posteriores.
- 30 m de resolución: no detecta microrrelieve ni bajos chicos.
- Mide la superficie que ve el radar: en montes puede medir la copa de los árboles.
- La pendiente explica la erosión por agua. La erosión por viento, central en San Luis, depende sobre todo de la cobertura.

## Probarlo

```bash
curl -s localhost:8000/earthdata/status
curl -s -X POST localhost:8000/terrain -H 'Content-Type: application/json' -d '{"field_id": "campo-conlara"}'
```

En la app: **Diagnóstico** del campo, tarjeta **Relieve (NASA SRTM)**.

Tests sin red, con el servidor simulado: `backend/app/tests/test_earthdata_terrain.py`. Verifican que la clave solo viaja a URS y que nunca llega al almacenamiento en la nube.
