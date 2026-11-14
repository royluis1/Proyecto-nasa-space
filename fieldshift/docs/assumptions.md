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
| Valores cualitativos del catálogo (requerimiento hídrico, tolerancias, aportes) | A completar con FAO e INTA | Provisorio, confianza baja |
| Kc medios: maíz 1,20; soja 1,15; trigo 1,15; girasol 1,0–1,15; sorgo 1,0–1,1; maní 1,15; avena 1,15; alfalfa ~0,95 | FAO-56, Tabla 12 | ⚠️ citados de memoria |
| Fechas de siembra (maíz sep–oct o dic, soja nov–dic, girasol oct–nov, trigo may–jun, coberturas mar–abr) | INTA | ⚠️ a validar |
| Ventanas críticas (maíz floración, soja R3–R6, girasol floración, trigo espigazón–antesis) | INTA; Andrade et al. | ⚠️ |

## Método

| Supuesto | Estado |
|---|---|
| Estrés por calor: Tmax > 35 °C | ⚠️ a validar |
| Riesgo de helada: T2M mín ≤ 2 °C (a nivel del cultivo puede helar con 2–3 °C en el aire a 2 m) | ⚠️ a validar |
| Barbecho / suelo desnudo: NDVI < 0,25–0,30 | A calibrar con la serie del lote |
| Kc de barbecho (evaporación de suelo desnudo): 0,25 | Supuesto |
| Lluvia efectiva: método USDA-SCS | A documentar con su fuente |
| Mes no válido si más de 20 % de días sin lluvia registrada | Supuesto |
| Año completo: todos los días, todos los meses válidos y ≤ 5 % de faltantes de lluvia | Supuesto |
| Año seco/húmedo: z-score de la lluvia anual ≤ −1 / ≥ +1, relativo al período pedido | Supuesto |
| Año con estrés térmico: z-score de días con Tmax > 35 °C ≥ +1 | Supuesto |
| ET₀ diaria: FAO-56 Penman-Monteith con humedad relativa media (ec. 19); Hargreaves si faltan datos | Método FAO-56 |
| Déficit hídrico climático: suma mensual de max(0, ET₀ − lluvia) | Método simplificado |
| Datos climáticos de muestra (`power_sample_san_luis.csv`) | **Simulados**, normales aproximadas ⚠️ |
| Subponderaciones de los componentes S y E del puntaje | Supuestos de diseño |
| Rangos de escenarios: lluvia −50 a +30 %, temperatura 0 a +3 °C | Supuestos de diseño, no proyecciones |

## A verificar con la fuente

- Si NASA POWER ofrece ET₀ ya calculada en la API diaria.
- Estructura exacta del JSON de la API diaria (el parser se escribió sin una respuesta real; grabar una como fixture).
- Zona horaria de los datos diarios (la documentación habla de UTC y LST, pero no dice cuál es el valor por defecto para datos diarios) y unidad de radiación en la comunidad AG.
- Si AppEEARS soporta SPL3SMP_E y SPL4SMGP.
- Referencias de INTA EEA San Luis sobre erosión eólica y cultivos de cobertura.
