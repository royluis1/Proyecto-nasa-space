# Plan de trabajo

Cada fase se hace en un bloque separado y se aprueba antes de pasar a la siguiente.

| # | Fase | Estado |
|---|---|---|
| 1 | Arquitectura y modelo de datos | Hecho (ver architecture.md) |
| 2 | Backend base y API | Hecho |
| 3 | Integración NASA: POWER en vivo + NDVI, SMAP y SRTM offline (Módulo 3) | POWER hecho; NDVI, SMAP y SRTM pendientes |
| 4 | Base de datos de cultivos | Provisoria |
| 5 | Motor de rotaciones y puntaje | Pendiente |
| 6 | Frontend y mapa | Pendiente |
| 7 | Dashboard comparativo | Pendiente |
| 8 | Calendario, escenarios y monitor de campaña (Módulo 2) | Pendiente |
| 9 | IA opcional y explicabilidad | Pendiente |
| 10 | Documentación, demo y presentación | Pendiente |

Ajustes respecto del plan original: la base de cultivos va antes que el motor de puntaje (el motor la necesita), el Módulo 3 entra en la integración NASA y el monitor de campaña va con los escenarios.

## Alcance

- **Imprescindible:** 3 campos, POWER en vivo con fallback, NDVI y SMAP desde CSV, 3 rotaciones con puntaje y pesos ajustables, escenarios seco y de calor, explicaciones con 4 fuentes de evidencia, advertencia visible, tests del puntaje y de la normalización de datos.
- **Si sobra tiempo:** monitor completo, calendario agrícola, reporte PDF, comparación IA vs. reglas.
- **Fuera de alcance:** PostGIS, autenticación, modo oscuro, inglés, dibujo de polígonos, ECOSTRESS, GRACE-FO, precios de mercado.

## Recortes si falta tiempo (en orden)

1. LLM (quedan solo plantillas)
2. PDF (queda CSV e impresión del navegador)
3. Rotación mixta
4. Carga de CSV propio
5. Monitor completo (quedan 3 mensajes)
6. k-means (quedan solo las reglas)
7. Mapa (queda una lista con coordenadas)

**Nunca se recorta:** etiquetas de procedencia, advertencia visible, método de agua documentado, tests del puntaje.
