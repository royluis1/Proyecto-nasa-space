# Cómo AgroOrbit responde al desafío

Desafío: **Field Shift: Adapting Farms with NASA Data** (NASA Space Apps Challenge 2026).

Esta tabla sigue los bloques de la descripción oficial. Estado: **Hecho**, **Parcial** (existe pero con límites) o **No hecho**.

## Requisitos centrales

| Pide el desafío | Cómo lo cubre AgroOrbit | Estado |
|---|---|---|
| Usar observaciones de la Tierra de la NASA | POWER, SMAP (L3 y L4), MODIS NDVI, HLS (Landsat/Sentinel), ECOSTRESS, SRTM y GIBS | Hecho |
| Incorporar el suelo local | Perfil de suelo del lote (textura, materia orgánica, profundidad, análisis de laboratorio). Si falta, se estima con SoilGrids y se rotula "estimado" | Hecho |
| Incorporar las características de los cultivos | Catálogo de 16 cultivos con agua, tolerancias, raíz, aporte al suelo, plagas e ingreso relativo, con fuente y confianza | Hecho (a validar con INTA) |
| Incorporar las prioridades del productor | Prioridades de 0 a 10 que ponderan el puntaje y se recalculan al instante | Hecho |
| Comparar rotaciones, incluida la actual | La actual y 6 alternativas (conservadora, diversificada, ahorro de agua, suelo, ingreso y mixta) | Hecho |
| Explicar por qué, con qué evidencia, beneficios, riesgos y lagunas | Recomendación con "por qué", datos a favor y en contra con puntos, supuestos, incertidumbres y datos que faltan | Hecho |
| Barbechos, temporadas vulnerables y oportunidades | Calendario por campañas con suelo desnudo, riesgo de calor y de agua mes a mes; barbechos detectados con NDVI | Hecho |
| No reemplazar el criterio del agricultor | Aviso en todas las pantallas y respuestas; "requiere validación agronómica local" en cada recomendación | Hecho |

## Datos y armonización

| Pide el desafío | Cómo lo cubre AgroOrbit | Estado |
|---|---|---|
| SMAP (humedad del suelo) | L4 zona de raíces (historia y anomalía) y L3 superficie (última observación) | Hecho |
| ECOSTRESS (temperatura de superficie) | Temperatura de verano y estrés hídrico del lote | Hecho (muestra rotulada hasta tener tareas en vivo de AppEEARS) |
| GPM (precipitación) | Mapa animado de lluvia satelital (IMERG cada 30 min, vía GIBS) en Alertas y Mi huerta. El puntaje sigue usando la lluvia de NASA POWER | Hecho |
| Landsat/MODIS (índices de vegetación) | MODIS NDVI por campaña y HLS por 9 sectores del lote | Hecho |
| GEDI (biomasa) | No se usa: la biomasa se infiere del NDVI (indirecto) | No hecho |
| Datos de suelo | SoilGrids estimado + análisis del productor con prioridad | Hecho |
| Armonizar resoluciones a una grilla común | Todo se lleva al **lote** (espacio) y al **mes y la campaña** (tiempo), mostrando la escala original. Tabla en la página de Metodología | Hecho |

## Exploración de rotaciones

| Pide el desafío | Cómo lo cubre AgroOrbit | Estado |
|---|---|---|
| Nutrientes, erosión, materia orgánica, plagas, agua, forraje, mercado | Componentes de suelo (materia orgánica, cobertura, pendiente), riesgo (plagas por monocultivo, sequía, calor), agua (balance FAO-56) e ingreso relativo | Parcial: el mercado es un índice relativo, no precios |
| Alinear rotaciones con las prioridades (agua, ingreso, suelo) | Ranking ponderado por prioridades y escenarios de riego | Hecho |
| Explicar fijadoras de N, cobertura, raíz profunda y tolerantes a sequía | Cada rotación muestra qué papel cumple cada cultivo, qué le falta y por qué ayuda al suelo, con fuente y límites | Hecho |

## Mapas y visualización

| Pide el desafío | Cómo lo cubre AgroOrbit | Estado |
|---|---|---|
| Mapas interactivos de tendencias | Mapa de zonas climáticas de San Luis; mapa animado de lluvia (GPM) y nubes (MODIS); lluvia año por año y anomalía de humedad del suelo de 10 años | Hecho |
| Vulnerabilidades dentro del lote | Verdor por 9 sectores del lote (HLS) que señala el sector más débil; además pendiente del lote (SRTM), calor de superficie (ECOSTRESS) y alertas de helada | Parcial: solo el verdor se ve por sector |
| Líneas de tiempo, capas comparadas, sliders de escenario | Calendario por campañas interactivo, escenarios de lluvia, temperatura y riego, imagen del día de GIBS | Hecho |

## Diseño para el productor

| Pide el desafío | Cómo lo cubre AgroOrbit | Estado |
|---|---|---|
| Fácil de entender sin experiencia técnica | Perfil "Huerta" simplificado, lenguaje llano, detalle técnico en desplegables, glosario | Hecho |
| Cargar prioridades y restricciones (agua, equipo, mercado) | Prioridades, riego disponible, suelo y rotación actual | Parcial: no hay restricciones de maquinaria |
| Recordar que apoya y no reemplaza | Aviso fijo en el encabezado, en cada recomendación y en el reporte | Hecho |
| Validación con usuarios | Una ingeniera agrónoma revisó la idea: pidió información práctica para decidir, historial de lotes y datos climáticos a mano | Parcial: una sola entrevista |

## Pendiente, por prioridad

1. Tareas en vivo de AppEEARS (HLS y ECOSTRESS) en producción.
2. Historial de lotes por usuario (código listo en Supabase, falta configurarlo).
3. Validar el catálogo de cultivos con INTA y con más productores.
4. GEDI y restricciones de maquinaria.
