# AgroOrbit

Herramienta de apoyo a decisiones para adaptar la rotación de cultivos con datos NASA.
NASA Space Apps Challenge 2026 · desafío **Field Shift: Adapting Farms with NASA Data** · foco inicial: San Luis, Argentina.

> AgroOrbit es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Qué hace

1. **Diagnóstico del lote** (años): clima de 10 años, humedad del suelo, verdor por campaña y por sectores, relieve y calor de superficie.
2. **Comparador de rotaciones** (campañas): la rotación actual frente a 6 alternativas, con un puntaje explicable, prioridades del productor, escenarios climáticos, calendario y reporte.
3. **Alerta temprana** (días): heladas, calor, tormentas y falta de agua, también en modo **Huerta**.

Demo en vivo: https://proyecto-nasa-space.vercel.app/ · Presentación: [README del repositorio](../README.md)

## Estructura

```
fieldshift/
├── backend/     API FastAPI (ver backend/README.md)
├── frontend/    Next.js + TypeScript + Tailwind + Leaflet
├── scripts/     descarga y preparación de datos (zonas, provincias, muestras rotuladas)
├── data/        datos NASA preprocesados (samples/) y caché local (cache/)
└── docs/        arquitectura, plan, fuentes, supuestos, uso de IA, demo, ética
```

## Estado

| Parte | Estado |
|---|---|
| Backend (FastAPI) y API | Hecho, 341 tests |
| Frontend (Next.js) | Hecho, desplegado en Vercel; 154 tests |
| Datos NASA | POWER, SMAP, MODIS NDVI, HLS, ECOSTRESS, SRTM y GIBS ([data_sources.md](docs/data_sources.md), [earthdata.md](docs/earthdata.md)) |
| Motor de rotaciones y puntaje | Hecho: [scoring.md](docs/scoring.md) y [ejemplos](docs/examples/README.md) |
| Dashboard, calendario, escenarios y reporte | Hecho: [calendario_escenarios_reporte.md](docs/calendario_escenarios_reporte.md) |
| Zonas climáticas, perfil automático y humedad satelital | Hecho: [zonas_y_perfil.md](docs/zonas_y_perfil.md) |
| Perfiles Huerta y Agricultor, pronóstico y alertas | Hecho: [perfiles_y_alertas.md](docs/perfiles_y_alertas.md) |
| Login e historial de lotes (Supabase) | Código listo, falta configurar: [supabase.md](docs/supabase.md) |
| GPM/IMERG, GEDI | No hecho: ver [challenge.md](docs/challenge.md) |

Cumplimiento del desafío punto por punto: [docs/challenge.md](docs/challenge.md). Guion del video y de la demo: [docs/demo_script.md](docs/demo_script.md).

## Cómo correrlo

Backend (Python 3.13):

```bash
cd fieldshift/backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

Frontend (Node 20 o más), en otra terminal:

```bash
cd fieldshift/frontend && npm install && npm run dev
```

Abrí http://localhost:3000. Variables de entorno: `backend/.env.example` y `frontend/.env.example`. Sin backend, el frontend
muestra datos de ejemplo rotulados.

## Datos NASA

Este proyecto usa datos de NASA POWER, SMAP, MODIS (MOD13A1), HLS, ECOSTRESS, SRTM y GIBS. Detalle de fuentes, resoluciones y limitaciones en [docs/data_sources.md](docs/data_sources.md).
