# Datos

| Carpeta | Contenido | ¿Va al repo? |
|---|---|---|
| `samples/` | Datos NASA preprocesados por `scripts/` (NDVI, SMAP, SRTM) y respaldo de POWER para funcionar sin red | Sí |
| `cache/` | Caché local de respuestas de NASA POWER | No (gitignored) |

Los catálogos que usa la API (cultivos, campos, rotaciones) están en `backend/app/data/`.

Cada archivo de `samples/` debe indicar si es **real** (descargado de la fuente) o **ilustrativo**, y su fecha de última actualización.
