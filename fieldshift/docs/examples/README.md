# Ejemplos de salida del motor de rotaciones

Generados con `python scripts/run_rotation_examples.py`. **Clima: MUESTRA SIMULADA** (sin red); los números son ilustrativos.

## Campo Este, prioridades equilibradas

Archivo completo: [`campo-este_base.json`](campo-este_base.json)

- Clima (DATO DE MUESTRA, 2016-2025): lluvia 711 mm/año, ET0 1377 mm/año, índice de aridez 0,516 (subhumedo seco).
- Pesos: agua 20 %, suelo 20 %, riesgo 20 %, ingreso 20 %, sostenibilidad 20 %.
- Confianza general: **baja**.

| # | Estrategia | Rotación | Total (rango) | A | S | R | I | E | Demanda mm/año |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Mixta recomendada | Mixta recomendada: Cobertura – soja – vicia – sorgo | **68** (54–82) | 46 | 70 | 92 | 42 | 90 | 876 |
| 2 | Salud del suelo | Cobertura – soja – vicia – maíz | **65** (50–79) | 31 | 73 | 88 | 41 | 90 | 1016 |
| 3 | Conservadora | Conservadora: Cobertura de gramíneas – Soja – Maíz | **62** (47–76) | 45 | 56 | 90 | 47 | 73 | 875 |
| 4 | Diversificada | Soja – trigo – vicia – girasol – maíz | **62** (48–76) | 49 | 45 | 89 | 38 | 90 | 792 |
| 5 | Ahorro de agua | Sorgo – girasol – soja | **62** (48–75) | 71 | 26 | 92 | 48 | 70 | 664 |
| 6 | Rentabilidad | Soja – trigo/soja de segunda – maíz | **60** (45–74) | 45 | 44 | 84 | 60 | 65 | 862 |
| 7 | Actual | Soja – maíz con barbecho invernal | **58** (43–72) | 55 | 38 | 89 | 52 | 55 | 765 |

**Explicación de la recomendada:**

> Esta rotación se recomienda porque agrega cobertura vegetal en invierno, diversifica el sistema (4 cultivos distintos frente a 2), incorpora leguminosas que aportan nitrógeno y reduce los meses de suelo desnudo (de 6,0 a 2,0 por año). Es la de mayor puntaje con prioridades equilibradas. Sin embargo, aumenta la demanda hídrica estimada (14 % más que la actual), baja el ingreso relativo estimado, requiere secar la cobertura a tiempo (agosto-septiembre) para que el perfil se recargue antes del cultivo de verano y requiere conseguir semilla de cobertura y prever el costo de implantación y secado.

**Riesgos:** Riesgo de déficit hídrico: la lluvia y el agua almacenada cubren solo el 59 % de la demanda. El clima usado es una muestra SIMULADA: los puntajes son ilustrativos hasta consultar NASA POWER.

**Validación:** Antes de implementarla, validala con un ingeniero agrónomo local: fechas de siembra y variedades para tu zona, manejo y secado de coberturas, fertilización según análisis de suelo, y mercado y logística de cada cultivo.

**Advertencias:**

- NASA POWER no respondió (modo sin red).
- Se usan DATOS DE MUESTRA SIMULADOS del sitio 'campo-este' (-33.85, -65.2); no son observaciones de tus coordenadas.
- Prioridades por defecto (estimado): el productor no las cargó.

## Campo Centro (semiárido), prioriza agua, escenario lluvia -20 % y +1 °C

Archivo completo: [`campo-centro_agua_seco.json`](campo-centro_agua_seco.json)

- Clima (DATO DE MUESTRA, 2016-2025): lluvia 580 mm/año, ET0 1414 mm/año, índice de aridez 0,41 (semiarido); escenario: Lluvia -20 % y +1 °C → lluvia 464 mm/año.
- Pesos: agua 29 %, suelo 19 %, riesgo 23 %, ingreso 13 %, sostenibilidad 16 %.
- Confianza general: **baja**.

| # | Estrategia | Rotación | Total (rango) | A | S | R | I | E | Demanda mm/año |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Mixta recomendada | Mixta recomendada: Cobertura – girasol – vicia – sorgo – mijo | **53** (38–68) | 21 | 51 | 88 | 19 | 90 | 721 |
| 2 | Diversificada | Sorgo – avena – girasol – vicia – mijo | **48** (35–63) | 13 | 46 | 79 | 25 | 86 | 776 |
| 3 | Ahorro de agua | Sorgo – girasol – mijo con barbechos largos | **46** (30–60) | 42 | 13 | 87 | 25 | 50 | 565 |
| 4 | Conservadora | Conservadora: Cobertura de gramíneas – Sorgo – Avena – Girasol | **44** (32–57) | 5 | 52 | 78 | 28 | 68 | 919 |
| 5 | Salud del suelo | Pastura perenne (3 años) – cobertura – sorgo | **40** (31–51) | 0 | 46 | 82 | 18 | 65 | 1202 |
| 6 | Rentabilidad | Maní – maíz tardío – girasol | **40** (27–56) | 13 | 21 | 74 | 35 | 70 | 755 |
| 7 | Actual | Sorgo – verdeo de avena – girasol | **37** (24–52) | 10 | 27 | 72 | 33 | 50 | 802 |

**Explicación de la recomendada:**

> Esta rotación se recomienda porque reduce la demanda hídrica estimada (10 % menos que la actual), diversifica el sistema (5 cultivos distintos frente a 3), incorpora leguminosas que aportan nitrógeno, reduce los meses de suelo desnudo (de 4,0 a 3,7 por año) y baja la exposición de los cultivos a sequía, calor y problemas sanitarios. Es la de mayor puntaje con más peso en agua. Sin embargo, baja el ingreso relativo estimado, requiere secar la cobertura a tiempo (agosto-septiembre) para que el perfil se recargue antes del cultivo de verano, requiere conseguir semilla de cobertura y prever el costo de implantación y secado y hay que validar la disponibilidad de mercado local para Mijo.

**Riesgos:** Riesgo de déficit hídrico: la lluvia y el agua almacenada cubren solo el 46 % de la demanda. Mijo: mercado local limitado; validar comprador antes de sembrar. El clima usado es una muestra SIMULADA: los puntajes son ilustrativos hasta consultar NASA POWER.

**Validación:** Antes de implementarla, validala con un ingeniero agrónomo local: fechas de siembra y variedades para tu zona, manejo y secado de coberturas, fertilización según análisis de suelo, y mercado y logística de cada cultivo.

**Advertencias:**

- NASA POWER no respondió (modo sin red).
- Se usan DATOS DE MUESTRA SIMULADOS del sitio 'campo-centro' (-33.55, -66.2); no son observaciones de tus coordenadas.

## Campo Conlara (riego), prioriza ingreso

Archivo completo: [`campo-conlara_riego_ingreso.json`](campo-conlara_riego_ingreso.json)

- Clima (DATO DE MUESTRA, 2016-2025): lluvia 616 mm/año, ET0 1395 mm/año, índice de aridez 0,442 (semiarido).
- Pesos: agua 16 %, suelo 16 %, riesgo 20 %, ingreso 36 %, sostenibilidad 12 %.
- Confianza general: **baja**.

| # | Estrategia | Rotación | Total (rango) | A | S | R | I | E | Demanda mm/año |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Conservadora | Conservadora: Cobertura de gramíneas – Maíz – Trigo – Soja | **83** (72–94) | 47 | 84 | 98 | 90 | 83 | 1027 |
| 2 | Mixta recomendada | Mixta recomendada: Trigo/soja de segunda – vicia – maíz | **82** (72–93) | 42 | 80 | 99 | 90 | 84 | 1077 |
| 3 | Actual | Maíz – trigo – soja de segunda | **79** (68–90) | 54 | 62 | 93 | 94 | 65 | 934 |
| 4 | Rentabilidad | Maíz – maní – trigo/soja de segunda | **77** (66–88) | 54 | 55 | 95 | 89 | 75 | 943 |
| 5 | Salud del suelo | Cobertura – soja – vicia – maíz | **76** (66–88) | 47 | 86 | 100 | 68 | 90 | 1025 |
| 6 | Diversificada | Soja – trigo – vicia – girasol – maíz | **70** (59–81) | 66 | 52 | 99 | 58 | 90 | 799 |
| 7 | Ahorro de agua | Sorgo – trigo con riego complementario | **55** (44–65) | 76 | 34 | 90 | 43 | 30 | 696 |

**Explicación de la recomendada:**

> Esta rotación se recomienda porque agrega cobertura vegetal en invierno, diversifica el sistema (4 cultivos distintos frente a 3) y reduce los meses de suelo desnudo (de 3,5 a 1,5 por año). Es la de mayor puntaje con más peso en ingreso. Sin embargo, aumenta la demanda hídrica estimada (10 % más que la actual) y requiere secar la cobertura en agosto para no consumir el agua del barbecho.

**Riesgos:** Riesgo de déficit hídrico: la lluvia y el agua almacenada cubren solo el 47 % de la demanda. El clima usado es una muestra SIMULADA: los puntajes son ilustrativos hasta consultar NASA POWER.

**Validación:** Antes de implementarla, validala con un ingeniero agrónomo local: fechas de siembra y variedades para tu zona, manejo y secado de coberturas, fertilización según análisis de suelo, y mercado y logística de cada cultivo.

**Advertencias:**

- NASA POWER no respondió (modo sin red).
- Se usan DATOS DE MUESTRA SIMULADOS del sitio 'campo-conlara' (-32.45, -65.25); no son observaciones de tus coordenadas.

## Campo Este con historial de monocultivo, SMAP y NDVI (valores de ejemplo)

Archivo completo: [`campo-este_sensores.json`](campo-este_sensores.json)

- Clima (DATO DE MUESTRA, 2016-2025): lluvia 711 mm/año, ET0 1377 mm/año, índice de aridez 0,516 (subhumedo seco).
- Pesos: agua 20 %, suelo 20 %, riesgo 20 %, ingreso 20 %, sostenibilidad 20 %.
- Confianza general: **baja**.

| # | Estrategia | Rotación | Total (rango) | A | S | R | I | E | Demanda mm/año |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Mixta recomendada | Mixta recomendada: Cobertura – soja – vicia – sorgo | **67** (52–81) | 40 | 70 | 92 | 42 | 90 | 876 |
| 2 | Salud del suelo | Cobertura – soja – vicia – maíz | **64** (48–78) | 25 | 73 | 88 | 41 | 90 | 1016 |
| 3 | Ahorro de agua | Sorgo – girasol – soja | **62** (47–75) | 66 | 26 | 97 | 48 | 70 | 664 |
| 4 | Conservadora | Conservadora: Cobertura de gramíneas – Soja – Maíz | **61** (46–75) | 39 | 56 | 90 | 47 | 73 | 875 |
| 5 | Diversificada | Soja – trigo – vicia – girasol – maíz | **59** (45–73) | 43 | 45 | 81 | 38 | 90 | 792 |
| 6 | Rentabilidad | Soja – trigo/soja de segunda – maíz | **57** (42–72) | 39 | 44 | 76 | 60 | 65 | 862 |
| 7 | Actual | Soja – maíz con barbecho invernal | **54** (39–69) | 50 | 32 | 81 | 52 | 55 | 765 |

**Explicación de la recomendada:**

> Esta rotación se recomienda porque agrega cobertura vegetal en invierno, diversifica el sistema (4 cultivos distintos frente a 2), incorpora leguminosas que aportan nitrógeno, reduce los meses de suelo desnudo (de 6,0 a 2,0 por año) y baja la exposición de los cultivos a sequía, calor y problemas sanitarios. Es la de mayor puntaje con prioridades equilibradas. Sin embargo, aumenta la demanda hídrica estimada (14 % más que la actual), baja el ingreso relativo estimado, requiere secar la cobertura a tiempo (agosto-septiembre) para que el perfil se recargue antes del cultivo de verano y requiere conseguir semilla de cobertura y prever el costo de implantación y secado.

**Riesgos:** Riesgo de déficit hídrico: la lluvia y el agua almacenada cubren solo el 59 % de la demanda. El clima usado es una muestra SIMULADA: los puntajes son ilustrativos hasta consultar NASA POWER.

**Validación:** Antes de implementarla, validala con un ingeniero agrónomo local: fechas de siembra y variedades para tu zona, manejo y secado de coberturas, fertilización según análisis de suelo, y mercado y logística de cada cultivo.

**Advertencias:**

- NASA POWER no respondió (modo sin red).
- Se usan DATOS DE MUESTRA SIMULADOS del sitio 'campo-este' (-33.85, -65.2); no son observaciones de tus coordenadas.
- El historial muestra Soja en las últimas campañas seguidas (monocultivo reciente).
- El NDVI muestra suelo desnudo el 75 % del tiempo, más que lo declarado (50 %): se aumentó la exposición a erosión de la rotación actual.
- Prioridades por defecto (estimado): el productor no las cargó.
