# Uso de IA

## Dentro de la aplicación: no decide ningún modelo de IA

FieldShift **no usa modelos de IA para calcular ni recomendar**. Todo el resultado sale de reglas y estadística que se pueden
revisar paso a paso:

- **Puntaje de rotaciones:** reglas explícitas que suman y restan puntos por motivos concretos (por ejemplo, "monocultivo: −10"
  o "cobertura todo el año: +40"). Cada motivo se muestra en pantalla. Ver [scoring.md](scoring.md).
- **Balance de agua:** fórmulas publicadas de la FAO (FAO-56 para la evapotranspiración, coeficientes Kc y Ky).
- **Diagnóstico:** estadística clásica: promedios, percentiles, anomalías frente a lo normal del mismo mes y tendencias con
  prueba de significancia.
- **Zonas climáticas:** índice de aridez de la UNEP con umbrales fijos ([assumptions.md](assumptions.md)).

Elegimos reglas en lugar de un modelo porque el productor y su agrónomo tienen que poder ver **por qué** sale cada número y
discutirlo. Una regla equivocada se encuentra y se corrige; una caja negra no.

### LLM opcional (apagado)

El backend tiene un interruptor `FIELDSHIFT_LLM_ENABLED` (apagado por defecto) pensado para reescribir explicaciones en lenguaje
más simple a partir de resultados ya calculados. **No está en uso** y, si se activara, no podría cambiar números ni recomendaciones.

### Lo que no hicimos

El plan inicial incluía comparar las reglas de detección de barbecho con un agrupamiento k-means sobre las series de NDVI.
**No llegamos a hacerlo**: la detección de barbechos es por reglas (umbrales de NDVI y duración).

## En el desarrollo: asistente de programación con IA

El equipo usó un asistente de programación con IA (Claude, de Anthropic) para escribir y revisar código, tests y documentación.
Los requisitos, las prioridades del producto, los criterios de honestidad de datos y la validación con una ingeniera agrónoma
vinieron del equipo. Los datos de la NASA se descargaron de sus servicios oficiales; ningún dato fue generado por IA, y las
muestras simuladas están rotuladas como tales.

## Qué sigue necesitando juicio humano

- Validar el catálogo de cultivos (tolerancias, raíces, ingreso relativo) con INTA y agrónomos de la zona.
- Decidir la siembra: FieldShift ordena opciones, no reemplaza al ingeniero agrónomo ni al análisis de suelo.
- Interpretar los datos regionales (9 km, 50 km) a la luz de lo que el productor sabe de su lote.
