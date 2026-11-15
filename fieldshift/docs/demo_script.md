# Guion de presentación

Tres piezas: el **video de 30 segundos** (lo que más mira el jurado), la **demo en vivo** de 2 a 3 minutos y la **historia del
usuario** que une todo. Los números son reales: Campo Este, con datos de NASA POWER en caché.

## La historia del usuario

> "La información debe ser práctica y que me sirva para tomar decisiones. Es importante que la plataforma pueda cargar los
> datos, porque así se lleva una historia de los lotes para después, con ese historial, tomar decisiones."
>
> — Ingeniera agrónoma consultada por el equipo

**Juan** tiene 500 ha en el este de San Luis. Siembra soja y maíz y deja el lote desnudo en invierno, como siempre.

- En su zona llueven **792 mm** por año, pero la atmósfera pide **1.261 mm**: faltan **553 mm**.
- Su campo está en una **zona de transición**: algunos años se comporta como húmedo y otros como semiárido.
- Su rotación actual saca **57 puntos de 100** y deja el suelo desnudo **6 meses por año**.
- FieldShift le muestra una alternativa: **cobertura – soja – vicia – sorgo**, con **73 puntos** y **2 meses** de suelo desnudo.
- Y también lo malo: pide **6 % más de agua**, hay que secar la cobertura en agosto o septiembre y conseguir semilla.

Juan no recibe una orden: recibe opciones con sus pros y contras para llevarle a su agrónoma.

## Video de 30 segundos

| Tiempo | Imagen | Texto o voz |
|---|---|---|
| 0–5 s | Mapa de zonas de San Luis | "En San Luis, muchos campos están en una zona de transición: un año es húmedo y el siguiente, semiárido." |
| 5–10 s | Diagnóstico: 792 mm de lluvia contra 1.261 mm de demanda | "FieldShift junta datos de 7 fuentes de la NASA para mostrar qué pasa en tu lote." |
| 10–18 s | Mover una prioridad en el Dashboard y ver cambiar el ranking | "Elegís qué te importa —agua, suelo o ingreso— y compara tu rotación con seis alternativas." |
| 18–25 s | Recomendación: 57 → 73 puntos, 6 → 2 meses de suelo desnudo | "Te dice por qué, con qué datos y qué riesgos tiene. Las dos caras." |
| 25–30 s | Logo + "No reemplaza a tu agrónomo" | "FieldShift: decisiones con datos de la NASA, a la medida de cada productor." |

Consejos para grabarlo: pantalla limpia (sin pestañas), modo claro, zoom del navegador al 110 %, sin música que tape la voz.

## Demo en vivo (2 a 3 minutos)

1. **Inicio → Ingresar como Agricultor → Campo Este.** (10 s)
2. **Perfil:** mover "Ahorrar agua" a 10 y mostrar que la mejor opción cambia en vivo. (20 s)
3. **Diagnóstico:** el déficit de agua en una frase; abrir "Ver gráficos" para mostrar la lluvia año por año. (25 s)
4. **Dashboard:** la recomendación final, con los datos que la favorecen y los que la penalizan. (30 s)
5. **Detalle de la rotación:** "Qué le hace al suelo": fija nitrógeno, cobertura, raíz profunda, tolera sequía. (20 s)
6. **Escenarios:** elegir "año seco" y ver qué rotación aguanta mejor. (20 s)
7. **Calendario:** tocar un mes y leer qué pasa en el lote. (15 s)
8. **Reporte PDF** para llevar al agrónomo. (10 s)
9. **Cierre:** metodología y honestidad de datos (cada dato con su fuente, su escala y si es de muestra). (10 s)

## Antes de presentar

- [ ] Abrir los tres campos de ejemplo una vez para que la caché tenga datos reales (POWER, SoilGrids, SRTM).
- [ ] Si el backend de Render está dormido, abrir `/health` un minuto antes.
- [ ] Verificar que los rótulos digan "EN VIVO" o "DATO CACHEADO" y no "DATO DE MUESTRA".
- [ ] Tener el video descargado por si falla internet.
