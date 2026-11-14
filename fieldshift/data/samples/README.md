# Muestras

| Archivo | Tipo | Contenido |
|---|---|---|
| `power_sample_san_luis.csv` | **SIMULADO** | Clima diario 2015–2025 para los 3 campos de ejemplo, con las columnas y unidades de NASA POWER. No son observaciones. Se generó con `scripts/generate_power_sample.py` (semilla fija). |

| `smap_sample_san_luis.csv` | **SIMULADO** | Humedad de suelo diaria 2015-2025 (zona de raíces y superficie) con el formato de AppEEARS para SPL4SMGP v8. Balance de agua alimentado por la lluvia de la muestra de POWER. `scripts/generate_satellite_samples.py`. |
| `ndvi_sample_san_luis.csv` | **SIMULADO** | NDVI MOD13Q1 cada 16 días 2015-2025, enteros sin escalar y capa de confiabilidad, con nubes y faltantes. Sigue la rotación declarada de cada campo. |

La API usa estos archivos solo como último respaldo, con la etiqueta **DATO DE MUESTRA** y una advertencia visible.
