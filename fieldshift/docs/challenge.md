# Cumplimiento del desafío

Desafío: **Field Shift: Adapting Farms with NASA Data** (NASA Space Apps Challenge 2026).

| Requisito | Cómo lo cubre FieldShift | Estado |
|---|---|---|
| Usar observaciones de la Tierra de la NASA | POWER, MODIS NDVI, SMAP, SRTM | Pendiente |
| Incorporar información local de suelo | Perfil de suelo del lote (textura, profundidad, MO, análisis de laboratorio) | Schema hecho |
| Incorporar características de cultivos | Catálogo editable con fuente y confianza | Provisorio |
| Incorporar prioridades del productor | 5 prioridades de 0 a 10 que ponderan el puntaje | Schema y endpoint hechos |
| Comparar al menos 3 rotaciones, incluida la actual | Actual + agua + suelo (opcional mixta); la API exige la actual | Hecho (puntaje simulado) |
| Por qué se sugiere cada una | Recomendación con resumen y justificación | Pendiente |
| Qué evidencia la respalda | Separación en 4 fuentes: datos NASA / suelo local / productor / validación agronómica | Schema hecho |
| Beneficios, lagunas de información y riesgos | Campos de la recomendación y advertencias | Schema hecho |
| Barbechos, temporadas de vulnerabilidad y oportunidades | Calendario agrícola y diagnóstico NDVI | Pendiente |
| No reemplazar el criterio del agricultor | Advertencia en todas las respuestas; marca de "requiere agrónomo" | Hecho |
| Declarar el uso de IA y comparar con reglas | ai_usage.md; reglas vs. k-means | Pendiente |
