# FieldShift

Herramienta de apoyo a decisiones para adaptar la rotación de cultivos con datos NASA.
NASA Space Apps Challenge 2026 · desafío **Field Shift: Adapting Farms with NASA Data** · foco inicial: San Luis, Argentina.

> FieldShift es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Qué hace

Cierra un ciclo de tres módulos:

1. **Diagnóstico de salud del suelo** (años): NDVI multianual, barbechos, suelo desnudo y pendiente.
2. **Simulador de riesgo** (campaña): compara la rotación actual con alternativas orientadas a ahorro de agua y a salud del suelo, con un puntaje explicable y escenarios climáticos.
3. **Monitor de campaña** (días a semanas): anomalías recientes contra la climatología del lugar.

## Estructura

```
fieldshift/
├── backend/     API FastAPI (ver backend/README.md)
├── frontend/    Next.js + TypeScript + Tailwind + Leaflet
├── scripts/     generación de muestras y ejemplos; descarga de NDVI/SMAP/SRTM pendiente
├── data/        datos NASA preprocesados (samples/) y caché local (cache/)
└── docs/        arquitectura, plan, fuentes, supuestos, uso de IA, demo, ética
```

## Estado

| Parte | Estado |
|---|---|
| Backend base y API | Hecho |
| Integración NASA | POWER, SMAP y MODIS NDVI hechos ([satellite.md](docs/satellite.md)); SRTM pendiente |
| Base de cultivos | Hecho: 16 cultivos editables, a validar con INTA |
| Motor de rotaciones y puntaje | Hecho: ver [docs/scoring.md](docs/scoring.md) y [ejemplos](docs/examples/README.md) |
| Frontend y mapa | Hecho: [frontend/README.md](frontend/README.md) |
| Dashboard comparativo | Hecho: `/campo/[id]/dashboard` |

El plan completo está en [docs/plan.md](docs/plan.md).

## Cómo correrlo

Por ahora solo el backend: ver [backend/README.md](backend/README.md).

## Datos NASA

Este proyecto usa datos de NASA POWER, MODIS (MOD13A1), SMAP y SRTM. Detalle de fuentes, resoluciones y limitaciones en [docs/data_sources.md](docs/data_sources.md).
