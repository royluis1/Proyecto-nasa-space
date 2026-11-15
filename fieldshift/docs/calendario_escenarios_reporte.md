# Calendario, escenarios y reporte: guía de uso

> AgroOrbit es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

Tres pantallas del campo trabajan juntas. **Escenarios** muestra qué rotación aguanta mejor. **Calendario** muestra mes a mes qué implica esa rotación. **Reporte** junta todo en un plan para revisar con el técnico.

## 1. Escenarios climáticos (`/campo/[id]/escenarios`)

**Cómo se usa**

1. Al abrir la pantalla se calculan los 12 escenarios de una vez.
2. Tocá un escenario y la pantalla cambia al instante, sin esperar al servidor.
3. Si movés tus prioridades (en el perfil o en el dashboard), los puntajes se recalculan solos.
4. Para probar una combinación propia, usá **Armar mi propio escenario**:
   - lluvia de −50 a +30 %;
   - temperatura de 0 a +3 °C;
   - año seco, lluvias intensas, olas de calor;
   - nivel de riego.

| Grupo | Escenario | Qué cambia (supuesto de sensibilidad) |
|---|---|---|
| Tipo de año | Año normal | Clima promedio de los últimos 10 años (NASA POWER). Es la referencia. |
| | Año seco | Repite el año más seco observado en el período. |
| Eventos extremos | Año con lluvias intensas | +35 % de lluvia de octubre a marzo, en tormentas. Solo se aprovecha el 30 % de ese extra (el resto escurre) y la erosión en suelo desnudo sube un 40 %. |
| | Año con olas de calor | De diciembre a febrero: Tmax +3 °C (más días de más de 35 °C) y ET0 +10 %. |
| Menos lluvia | Lluvia −10, −20 y −30 % | Toda la lluvia del año baja ese porcentaje. |
| Más temperatura | +1 °C y +2 °C | ET0 +3 % por grado, más días de calor extremo y mínimas más altas. |
| Riego | Sin riego | Secano, aunque el lote tenga riego. |
| | Con riego limitado | La mitad de la lámina: cubre el 40 % del déficit. |
| | Con riego disponible | Riego pleno: cubre el 80 % del déficit y se descuenta su costo. |

**Qué se recalcula en cada escenario**

- Los cinco puntajes (agua, suelo, riesgo, ingreso y sostenibilidad), el total y el ranking.
- Los riesgos de cada rotación. Por ejemplo, con lluvias intensas aparece la erosión hídrica en las rotaciones con suelo desnudo.
- La recomendación y su explicación.

**Qué muestra la pantalla**

- **Qué cambia**:
  - la mejor opción y si es la misma que en un año normal;
  - tu rotación actual, con su puesto y cuánto sube o baja;
  - el ranking completo con la diferencia frente al año normal;
  - los riesgos y el porqué de cada rotación.
- **¿Qué rotación resiste mejor?**:
  - la más resistente es la que nunca cae al fondo del ranking (peor puesto más bajo y, si empatan, mejor puntaje en su peor escenario);
  - la mejor de cada escenario;
  - una tabla de todas las rotaciones en todos los escenarios;
  - un gráfico de la más resistente frente a tu rotación actual.

Son pruebas de sensibilidad sobre el clima de referencia, **no pronósticos**. Los parámetros están en `backend/app/services/engine/parameters.py` y los escenarios en `backend/app/services/engine/scenarios.py`.

## 2. Calendario agrícola (`/campo/[id]/calendario`)

Elegí la rotación, el escenario y cuántas campañas ver (2, 3 o 4, de julio a junio). Por defecto empieza en la próxima campaña. Cada campaña es una tabla con una columna por mes:

| Fila | Qué muestra |
|---|---|
| Cultivo | Qué ocupa el lote, o barbecho |
| Etapa | Siembra, desarrollo, cosecha (en las coberturas, "fin") |
| Suelo | Vivo (cultivo o cobertura), rastrojo o desnudo. El rastrojo protege unos meses según el cultivo anterior: hasta 6 si deja mucho residuo, 3 si deja algo y ninguno si deja poco. |
| Calor | Riesgo de golpe de calor: frecuencia de días con Tmax > 35 °C × sensibilidad del cultivo, mayor en pleno desarrollo |
| Agua | Riesgo de falta de agua: demanda no cubierta del balance mensual (Kc × ET0, lluvia efectiva y agua del perfil), después del riego |

Cada valor lleva texto e ícono, no solo color. En el celular la tabla se desplaza hacia el costado.

**Datos NASA que usa**

- **NASA POWER**: lluvia, ET0 y días de calor de cada mes, con el escenario aplicado.
- **SMAP**: si el perfil está más de 15 % más seco que lo normal, sube un nivel el riesgo hídrico de julio a diciembre de la primera campaña y recomienda medir la humedad antes de sembrar.
- **MODIS NDVI**: compara cuántos meses por año el lote tuvo poca vegetación con los meses sin cultivo vivo que tendría la rotación.

**Recomendaciones** (ordenadas por prioridad, indicando a qué campañas aplican)

- Si es o no la rotación con mejor puntaje para el escenario.
- Barbechos de 3 meses o más: cultivo de cobertura o rastrojo en pie. Son prioridad alta si caen en la época de viento.
- Meses con riesgo alto de calor: correr la fecha de siembra o usar una variedad más tolerante.
- Meses con riesgo alto de falta de agua: revisar el perfil, o priorizar el riego si lo hay.

Con **Comparar con mi rotación actual** se ve el calendario de las dos, con los totales de meses con cultivo vivo, suelo desnudo y riesgos altos.

## 3. Reporte exportable (`/campo/[id]/reporte`)

**Formatos**

- **Descargar PDF**: se arma en el navegador (jsPDF), así que funciona también sin conexión con el servidor.
- **Descargar CSV**: por secciones, con BOM para que Excel respete los acentos.
- También están **JSON** e **Imprimir**.

**Contenido**

- Fecha de generación, origen de los datos y escenario.
- Recomendación: rotación, puntaje y rango, frente a la actual, por qué, ventajas, riesgos, **qué revisar con el técnico** y nota de validación.
- Datos del campo, las 11 prioridades y el peso de cada componente.
- Resumen climático: lluvia, ET0, aridez, variabilidad, días de calor, SMAP y NDVI.
- Rotaciones comparadas con sus puntajes, y por qué cada una.
- Resistencia a los 12 escenarios.
- Calendario de la rotación recomendada (3 campañas) con sus recomendaciones.
- Supuestos, fuentes, advertencias y la advertencia profesional.

Desde la API: `GET /export/report?field_id=...&format=csv&scenarios=true`, o `POST /export/report` con `priorities`, `scenario`, `scenario_ids` y `format`.

## Sin conexión (modo demostración)

- Los 12 escenarios y el calendario del año normal (4 campañas) vienen precalculados en `frontend/lib/demo/data/`.
- Con otro escenario, el calendario muestra el año normal y lo avisa.
- Se regeneran con `python scripts/export_demo_data.py` (desde `fieldshift/`).

## Tests

- Backend: `backend/app/tests/test_calendar_scenarios.py` (escenarios, riego, recálculo, resistencia, calendario y reporte) y `test_power.py` (enfriamiento de POWER).
- Frontend: `frontend/tests/calendar-scenarios.test.ts` (escenarios, resistencia, calendario, CSV y PDF).
