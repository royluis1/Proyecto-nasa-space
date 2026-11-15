# Supuestos

Todo lo que no está respaldado por un dato observado o una fuente verificada se registra acá. ⚠️ = no verificado todavía.

## Datos de ejemplo

| Supuesto | Estado |
|---|---|
| Coordenadas de los 3 campos (Este −33,85/−65,20; Centro −33,55/−66,20; Conlara −32,45/−65,25) | Aproximadas ⚠️ |
| Lluvia anual aprox.: Este 650–750 mm, Centro 500–600 mm, Conlara 550–650 mm | ⚠️ verificar con POWER |
| Textura de suelo, superficie y rotación actual de cada campo | Ilustrativos |
| Recuadro de San Luis: lat −36 a −32, lon −67,5 a −64,9 | ⚠️ |

## Cultivos

| Supuesto | Fuente | Estado |
|---|---|---|
| Valores cualitativos del catálogo (requerimiento hídrico, tolerancias, aportes, ingreso, mercado) | Conocimiento agronómico general; cada cultivo lista sus fuentes | ⚠️ a validar con INTA EEA San Luis |
| Kc (inicial/medio/final): maíz 0,30/1,20/0,35; soja 0,40/1,15/0,50; trigo 0,30/1,15/0,30; girasol y colza 1,08 (punto medio de 1,00–1,15); sorgo 1,05 (de 1,00–1,10); maní 0,40/1,15/0,60; alfalfa 0,40/0,95/0,90 | FAO-56, Tabla 12 | ⚠️ citados de memoria: verificar contra la tabla |
| Kc de coberturas, vicia, centeno y pastura (sin fila propia en FAO-56) | Asimilados a cultivos similares | Supuesto |
| Ky: maíz 1,25; trigo 1,05; girasol 0,95; sorgo 0,9; soja 0,85; maní 0,7; alfalfa 1,1 | FAO-33 (Doorenbos y Kassam, 1979) | ⚠️ citados de memoria: verificar |
| Ky de cebada, avena, centeno, mijo, colza y pastura | Asimilados a cultivos similares | Supuesto |
| Rendimiento relativo en San Luis y mercado local de cada cultivo | Criterio cualitativo | ⚠️ a validar con productores y acopios locales |
| Fechas de siembra (maíz sep–oct o dic, soja nov–dic, girasol oct–nov, trigo may–jun, coberturas mar–abr) | INTA | ⚠️ a validar |
| Ventanas críticas (maíz floración, soja R3–R6, girasol floración, trigo espigazón–antesis) | INTA; Andrade et al. | ⚠️ |

## Método

| Supuesto | Estado |
|---|---|
| Estrés por calor: Tmax > 35 °C | ⚠️ a validar |
| Riesgo de helada: T2M mín ≤ 2 °C (a nivel del cultivo puede helar con 2–3 °C en el aire a 2 m) | ⚠️ a validar |
| Barbecho / suelo desnudo: NDVI < 0,25–0,30 | A calibrar con la serie del lote |
| Kc de barbecho (evaporación de suelo desnudo): 0,25 | Supuesto |
| Mes no válido si más de 20 % de días sin lluvia registrada | Supuesto |
| Año completo: todos los días, todos los meses válidos y ≤ 5 % de faltantes de lluvia | Supuesto |
| Año seco/húmedo: z-score de la lluvia anual ≤ −1 / ≥ +1, relativo al período pedido | Supuesto |
| Año con estrés térmico: z-score de días con Tmax > 35 °C ≥ +1 | Supuesto |
| ET₀ diaria: FAO-56 Penman-Monteith con humedad relativa media (ec. 19); Hargreaves si faltan datos | Método FAO-56 |
| Déficit hídrico climático: suma mensual de max(0, ET₀ − lluvia) | Método simplificado |
| Datos climáticos de muestra (`power_sample_san_luis.csv`) | **Simulados**, normales aproximadas ⚠️ |
| Fórmulas y constantes del puntaje (A, S, R, I, E) | Supuestos de diseño, todos en `services/engine/parameters.py` y explicados en scoring.md |
| Agua útil por textura (80-160 mm/m) | FAO-56 Tabla 19, punto medio del rango ⚠️ |
| Profundidad de raíces por defecto: 1 m | Supuesto |
| Eficiencia de barbecho 0,15-0,25 según textura | Supuesto (rango típico de la literatura 0,15-0,35) |
| La mitad de la lluvia efectiva que el cultivo no usa queda en el perfil | Supuesto |
| El riego cubre el 80 % del déficit | Supuesto |
| ET0 +3 % por °C en escenarios | Supuesto (rango 2-4 %/°C) |
| Frecuencia de calor bajo calentamiento: normal con desvío de 5 °C | Supuesto |
| Heladas: Tmin media mensual ≤ 3 °C frecuentes, ≤ 6 °C ocasionales | Supuesto |
| Época ventosa en San Luis: julio a noviembre | ⚠️ a validar con INTA |
| Erodabilidad eólica relativa por textura (arenosa 1,0 a arcillosa 0,4) | Supuesto (mismo orden que los grupos de erodabilidad eólica) |
| Biomasa de coberturas y aporte de materia orgánica bajan a la mitad del déficit | Supuesto |
| Costo de cada cobertura: 0,08 unidades de ingreso por año | Supuesto |
| Zona por índice de aridez P/ET0 (árido < 0,2; semiárido < 0,5; subhúmedo seco < 0,65) | UNEP (1992) |
| Con riego, las plantillas se eligen como en zona subhúmeda | Supuesto de diseño |
| Lluvia efectiva mensual USDA-SCS | Método publicado (FAO CROPWAT) |
| Rangos de escenarios: lluvia −50 a +30 %, temperatura 0 a +3 °C | Supuestos de diseño, no proyecciones |

## SMAP y NDVI

| Supuesto | Estado |
|---|---|
| Sequía de humedad de suelo: mes con z <= -1 frente al mismo mes de otros años | Criterio estadístico (supuesto) |
| Mes con baja humedad: por debajo del percentil 25 de todos los meses | Supuesto |
| Estrés hídrico: percentil <= 20 y 10 % bajo lo normal (alto); <= 40 y 5 % (medio), últimos 90 días | Supuesto |
| Lo esperable es ~16 % de meses con z <= -1; más que eso suma riesgo en R | Supuesto (distribución normal) |
| NDVI de suelo desnudo 0,15 y de cobertura completa 0,85 (cobertura por Gutman e Ignatov, 1998) | ⚠️ calibrar con la serie del lote |
| Barbecho: 2 o más compuestos seguidos con NDVI < 0,3 | Supuesto (umbral configurable) |
| El NDVI marca como suelo desnudo también la implantación: se corrige lo declarado solo si la diferencia supera 20 puntos porcentuales | Supuesto |
| Tendencia de biomasa significativa: -6 (baja) / +4 (alta) puntos en S de la rotación actual | Supuesto de diseño |
| Muestras `smap_sample_san_luis.csv` y `ndvi_sample_san_luis.csv` | **Simuladas** |

## Zonas climáticas, transición, aptitud y suelo estimado

| Supuesto | Fuente | Estado |
|---|---|---|
| Clases por índice de aridez (lluvia / ET0): árida < 0,20; semiárida 0,20-0,50; subhúmeda seca 0,50-0,65; subhúmeda húmeda o más ≥ 0,65 | UNEP (1992), Middleton y Thomas, *World Atlas of Desertification* | Publicado; ⚠️ la ET0 es FAO-56 con datos de POWER (UNEP usó Thornthwaite) |
| Celdas de 0,5° x 0,625° de POWER como unidad de zonificación (~55 km) | Resolución de MERRA-2 en POWER | Supuesto: dentro de una celda no hay variación |
| Período 2015-2025 (11 años) | Pedido del bloque | Supuesto: corto para clima; reemplazable con `--start` |
| Día de calor: Tmax > 35 °C; día con riesgo de helada: Tmin ≤ 2 °C (aire a 2 m) | Criterio agronómico general | ⚠️ a validar |
| **Transición**: (a) a 25 km o menos del borde con otra zona (media celda de POWER) | Supuesto de diseño | ⚠️ a validar |
| **Transición**: (b) índice de aridez a 0,05 o menos de un límite de clase | Supuesto de diseño | ⚠️ a validar |
| **Transición**: (c) 30 % o más de los años (3 de cada 10) clasificados en otra zona | Supuesto de diseño | ⚠️ a validar |
| Clima de "la otra zona" en una transición: misma ET0 y la lluvia que lleva el índice al centro de esa clase | Supuesto para comparar | Supuesto |
| **Aptitud por agua** (secano): matriz requerimiento hídrico x clase (alto: baja/baja/media/alta; medio: baja/media/alta/alta; bajo: media/alta/alta/alta, de árida a húmeda) | Supuesto de diseño sobre el catálogo | ⚠️ a validar con INTA |
| Alta tolerancia a sequía sube un nivel; un cultivo de alta demanda nunca queda "alta" en zona árida o semiárida | Supuesto de diseño | ⚠️ |
| Calor: cultivos poco tolerantes y en el lote en verano (dic-feb) bajan un nivel con más de 20 días/año sobre 35 °C y quedan en "baja" con más de 40; los de tolerancia media bajan un nivel con más de 40 | Supuesto de diseño | ⚠️ |
| Heladas: cultivos poco tolerantes y en el lote en invierno (jun-ago) bajan un nivel con más de 10 días/año con Tmin ≤ 2 °C; si no están en invierno, solo se avisa el riesgo | Supuesto de diseño | ⚠️ |
| Variabilidad: coeficiente de variación de la lluvia ≥ 25 % se avisa como riesgo | Supuesto de diseño | ⚠️ |
| Aptitud = la peor de agua, calor y heladas; confianza media con zonas de POWER, baja con la muestra; nunca alta | Supuesto de diseño | — |
| Suelo 0-30 cm: promedio de SoilGrids ponderado por espesor (0-5, 5-15, 15-30 cm) | Supuesto | — |
| Materia orgánica = carbono orgánico x 1,724 (factor de van Bemmelen) | Clásico; ⚠️ el factor real varía entre 1,7 y 2,0 | Supuesto |
| Materia orgánica: baja < 1 %; media 1-2,5 %; alta > 2,5 % | Criterio general | ⚠️ a validar para suelos de San Luis |
| Textura USDA -> clases de AgroOrbit (areno franco -> arenosa; franco arcillo arenoso, franco arcilloso y franco arcillo limoso -> franco arcillosa; arcillo arenoso y arcillo limoso -> arcillosa; limoso -> franco limosa) | Simplificación | Supuesto |
| Humedad SMAP en palabras: anomalía ≤ -15 % "más seco", ≥ +15 % "más húmedo" que lo normal para el mes | Supuesto | ⚠️ |
| Sectores del lote: grilla de 3 x 3 sobre el lote (o su polígono), un píxel de Landsat de 30 m por sector, últimos 2 años | Supuesto de diseño | ⚠️ |
| Suelo desnudo: NDVI < 0,3; sector "más débil" o "más vigoroso" si su NDVI medio difiere 10 % o más de la mediana del lote | Supuesto | ⚠️ a validar |
| ECOSTRESS: superficie "muy caliente" > 45 °C; estrés de la vegetación por ESI: < 0,3 alto, 0,3-0,6 medio, > 0,6 bajo | Supuesto | ⚠️ a validar |
| Muestras `hls_sectors_sample_san_luis.csv` y `ecostress_sample_san_luis.csv` | — | **Simuladas** |
| Muestras `zonas_san_luis_muestra.geojson`, `soil_sample_san_luis.json`, `smap_l3_sample_san_luis.csv` | — | **Simuladas** |

## A verificar con la fuente

- Si NASA POWER ofrece ET₀ ya calculada en la API diaria.
- ~~Estructura exacta del JSON de la API diaria~~: verificada el 14/11/2026 con una respuesta real, grabada como fixture (`backend/app/tests/fixtures/power_real_2024-01.json`).
- Zona horaria de los datos diarios (la documentación habla de UTC y LST, pero no dice cuál es el valor por defecto para datos diarios) y unidad de radiación en la comunidad AG.
- Nombres exactos de columnas del CSV de AppEEARS y si el NDVI viene escalado (el parser tolera ambos).
- Formato de `/bundle/{task_id}` de AppEEARS y decodificación de la bandera de calidad de SPL3SMP_E (el inicio de sesión y los nombres de capas ya se verificaron el 14/11/2026).
- Referencias de INTA EEA San Luis sobre erosión eólica y cultivos de cobertura.
- ~~Licencia del IGN~~: el servicio WFS declara reutilización libre según la Ley 27.275, Art. 2 (verificado el 14/11/2026).
- ~~Formato de la API de SoilGrids~~: verificado con respuestas reales el 14/11/2026 (d_factor 10, arcilla/arena/limo en g/kg -> %, carbono orgánico en dg/kg -> g/kg).
- ~~Zonas reales de San Luis~~: calculadas el 14/11/2026 con NASA POWER (2015-2025).
- Si hay una zonificación agroecológica oficial de INTA o la Carta de Suelos para San Luis (tendría prioridad).
- Open-Meteo desde el servidor: no se pudo probar (límite diario de la IP compartida del entorno de desarrollo).
