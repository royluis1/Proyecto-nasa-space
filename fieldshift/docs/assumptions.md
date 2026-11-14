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

## A verificar con la fuente

- Si NASA POWER ofrece ET₀ ya calculada en la API diaria.
- Estructura exacta del JSON de la API diaria (el parser se escribió sin una respuesta real; grabar una como fixture).
- Zona horaria de los datos diarios (la documentación habla de UTC y LST, pero no dice cuál es el valor por defecto para datos diarios) y unidad de radiación en la comunidad AG.
- Si AppEEARS soporta SPL3SMP_E y SPL4SMGP.
- Referencias de INTA EEA San Luis sobre erosión eólica y cultivos de cobertura.
