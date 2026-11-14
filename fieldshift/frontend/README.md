# FieldShift · Frontend

Interfaz web para productores: marcar el campo en un mapa, contar cómo es y qué importa, y comparar rotaciones de cultivos con datos de la NASA. Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS + componentes al estilo shadcn/ui + Leaflet + Recharts.

> FieldShift es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Cómo correrlo

Necesitás **Node 20 o superior** y, para tener datos reales del motor, el backend corriendo (Python 3.11+).

**1. Backend** (en una terminal)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

En Windows (PowerShell): `py -m venv .venv`, `.venv\Scripts\Activate.ps1` y el resto igual.

**2. Frontend** (en otra terminal)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Abrí **http://localhost:3000**. El backend tiene que estar en `http://127.0.0.1:8000` (o ajustá `NEXT_PUBLIC_API_URL`). Para probar la versión de producción: `npm run build && npm start`.

> Si abrís el frontend en otra dirección (por ejemplo una IP de tu red), agregala a `FIELDSHIFT_CORS_ORIGINS` en el `.env` del backend.

**¿Sin backend?** La app igual funciona: si el servidor no responde, muestra **datos de ejemplo** con un aviso permanente (ver "Modo demostración").

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Dirección del backend, sin barra final |
| `NEXT_PUBLIC_DEMO_FALLBACK` | `true` | Usar datos de ejemplo si el servidor no responde. `false` para mostrar el error |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `npm test` | Tests (Vitest) |
| `npm run gen:api` | Exporta el OpenAPI del backend y regenera `types/openapi.d.ts` (hace falta el entorno Python del backend) |

Si cambia la API, corré `npm run gen:api`: los tipos de `types/api.ts` salen del esquema real, así el compilador avisa si algo dejó de coincidir.

## Pantallas

| Ruta | Pantalla |
|---|---|
| `/` | Inicio y onboarding |
| `/ingresar` | Elegir perfil: Huerta o Agricultor (sin contraseña) |
| `/campos` | Selección de campo (lista + mapa con los campos) |
| `/campos/nuevo` | Cargar un campo: mapa + formulario |
| `/campo/[id]/perfil` | Perfil del campo (editable) y las 11 prioridades |
| `/campo/[id]/huerta` | Panel de huerta: riego, heladas, lluvia, calor, alertas |
| `/campo/[id]/alertas` | Diagnóstico y alerta temprana (los dos perfiles) |
| `/campo/[id]/diagnostico` | Diagnóstico climático e hídrico: clima, humedad del suelo y vegetación |
| `/campo/[id]/dashboard` | Dashboard comparativo: ranking, gráficos, desglose, explicaciones, escenarios y exportación |
| `/campo/[id]/comparador` | Ranking de rotaciones, que se recalcula al mover las prioridades |
| `/campo/[id]/rotacion/[rid]` | Detalle: por qué, desglose del puntaje, riesgos, evidencia y supuestos |
| `/campo/[id]/calendario` | Calendario de 2 a 4 campañas: etapas, cobertura, suelo desnudo, riesgo de calor y de agua, recomendaciones |
| `/campo/[id]/escenarios` | 12 escenarios con impacto inmediato y qué rotación resiste mejor |
| `/campo/[id]/reporte` | Plan para el técnico: PDF, CSV, JSON e impresión |
| `/metodologia` | Metodología, fuentes y glosario |

## Estructura

```
frontend/
├── app/            rutas (App Router)
├── components/
│   ├── ui/         botón, tarjeta, slider, tabla, alerta... (estilo shadcn/ui)
│   ├── map/        mapa Leaflet (búsqueda, punto, polígono, GeoJSON, satélite)
│   ├── charts/     gráficos accesibles (cada uno con su tabla de datos)
│   ├── dashboard/  piezas del dashboard comparativo (aportes, mapa de calor, indicadores...)
│   ├── glossary/   términos técnicos con explicación al tocarlos
│   ├── score/      tarjetas del ranking, barras de puntaje, calendario
│   ├── provenance/ etiquetas de origen del dato, riesgo y confianza
│   ├── field/      formulario del campo y controles de prioridades
│   ├── campo/      estado compartido del campo (prioridades, ranking)
│   └── layout/     encabezado, avisos, pie, modo oscuro
├── hooks/          useAsync, useDebounced, useBackendStatus, useMediaQuery, useDashboardCompare
├── lib/            cliente de la API, prioridades, ranking, geometría, calendario, exportación
│   └── demo/       datos de ejemplo para el modo demostración
├── types/          tipos de la API (openapi.d.ts es generado)
└── tests/          tests de la lógica (Vitest)
```

## Cómo funciona por dentro

**Cliente de API** (`lib/api.ts`). Tipado con el esquema del backend. Tiempo máximo de 25 s, hasta 2 reintentos con espera creciente (solo ante fallas de red o del servidor, nunca ante errores del pedido ni falta de datos) y errores normalizados con mensajes en español claro. Cada bloque de pantalla tiene su estado de carga, de error con botón "Reintentar" y vacío.

**Prioridades y ranking en vivo.** El productor ve 11 controles de 0 a 10. El backend puntúa con 5 componentes (agua, suelo, riesgo, ingreso y sostenibilidad), así que cada control pertenece a uno o dos grupos y el peso del grupo es el promedio de sus controles (`lib/priorities.ts`; "Reducir el riesgo de sequía" cuenta para Agua y para Riesgo). Los cinco puntajes de cada rotación no dependen de las prioridades, así que al mover un control el total se recalcula **al instante en el navegador** (`lib/ranking.ts`: Σ peso × valor) y, medio segundo después de que se quieta, se pide al servidor para reconciliar la variante "mixta", que sí depende de las prioridades. Las prioridades se guardan por campo en el navegador.

**Modo demostración.** Si el servidor no responde (o da error 5xx), el cliente usa los datos de `lib/demo/data/`, generados con el propio motor (`scripts/export_demo_data.py`) a partir de clima, SMAP y NDVI **simulados**. Se avisa en toda la app, cada dato lleva la etiqueta `DATOS DE EJEMPLO (SIN CONEXIÓN)` y, cuando el servidor vuelve, el aviso desaparece. Un campo creado sin conexión se guarda solo en el navegador y usa el ejemplo más cercano. Se regenera con `python scripts/export_demo_data.py` (desde `fieldshift/`).

**Mapa.** Leaflet, cargado solo en el navegador. Búsqueda de lugares por nombre (Nominatim de OpenStreetMap, solo en Argentina), clic para marcar el punto (el marcador se arrastra), dibujo de polígono vértice por vértice, carga de GeoJSON (Polygon, MultiPolygon, Feature o FeatureCollection; hasta 2 MB), ingreso manual de coordenadas, y vista de mapa o satélite (Esri World Imagery). La superficie del polígono se calcula sola.

- Los mosaicos del mapa y la búsqueda necesitan internet. Sin conexión el mapa se ve gris, pero se puede marcar el campo con las coordenadas.
- La búsqueda envía solo el texto escrito a Nominatim, un servicio público: para uso intensivo conviene un proveedor propio.
- Las imágenes satelitales de fondo son de Esri, solo para ubicarse. No son los datos de la NASA que usa el motor.

**Diseño y accesibilidad.** Paleta de verde (cultivo), tierra (suelo) y azul (agua) sobre fondo claro; modo oscuro opcional (sigue al sistema o se cambia con el botón). Tipografía del sistema de 17 px y botones de al menos 44 px. Español rioplatense. Ningún riesgo, nivel ni estado se comunica solo con color: siempre hay ícono y texto. Los gráficos llevan descripción y una tabla de datos alternativa, y no se animan. Se puede navegar con teclado y hay un enlace para saltar al contenido. Se revisó con axe-core (sin observaciones en las pantallas principales) y sin desborde horizontal entre 390 y 1280 px. La advertencia profesional está en una barra permanente, en el pie, en cada recomendación y en el reporte.

**Dashboard comparativo** (`/campo/[id]/dashboard`). Junta en una pantalla:

- **Ranking**: la rotación actual y todas las alternativas, con puesto, puntaje total, ventajas y desventajas, y una recomendación final que dice cuánto mejora (o no) frente a lo que el productor hace hoy.
- **Visualizaciones** en pestañas: aporte de cada componente al puntaje (barras apiladas), barras por componente, gráfico de araña, mapa de calor y línea de tiempo de cada rotación. Cada serie tiene una trama propia (liso, rayas, puntos, cuadrícula) además del color, y cada gráfico tiene su tabla.
- **Indicadores** de agua, suelo, riesgo, ingreso y sostenibilidad para comparar dos rotaciones a elección, con veredicto en texto ("mejor", "peor", "parecido").
- **Desglose y explicación** por rotación: los cinco componentes con el peso que eligió el usuario y el aporte de cada uno (valor × peso), qué datos la favorecen y cuáles la penalizan frente a la rotación actual, por qué se recomienda, supuestos, riesgos y qué tiene que validar un agrónomo local.
- **Controles**: prioridades, escenario climático (los mismos de la pantalla de escenarios), agua de riego (como está el campo, sin riego, limitado o disponible) y selección de hasta 4 rotaciones para comparar. Todo se recalcula en vivo.
- **Exportar**: CSV, JSON, impresión y enlace al reporte completo.
- **Lenguaje claro**: ET0, NDVI, SMAP, estrés hídrico, Kc y otros términos se explican al tocarlos (`lib/glossary.ts`), y los avisos técnicos del servidor se traducen a español llano (`lib/plain.ts`).

La lógica de comparación está en `lib/dashboard.ts` (aportes, favorece/penaliza, indicadores y descripción del escenario).

**Calendario, escenarios y reporte.** Guía de uso en [`docs/calendario_escenarios_reporte.md`](../docs/calendario_escenarios_reporte.md). La lógica está en:

- `lib/scenarios.ts`: los 12 escenarios, que salen del backend vía `lib/demo/data/scenario-presets.json`, la matriz de puntajes y la resistencia.
- `lib/timeline.ts`: tramos, textos y resúmenes del calendario.
- `lib/report.ts`: el modelo del reporte, el CSV y el PDF con jsPDF, cargado bajo demanda.

## Tests

`npm test` corre 120 tests de la lógica: prioridades, ranking en vivo, geometría del mapa, GeoJSON, calendario por campañas, escenarios y resistencia, reporte (CSV y PDF), exportación, comparación del dashboard, traducción de términos, datos de ejemplo y el cliente de API (reintentos, errores, paso a modo demostración, recuperación). Las pruebas de pantalla se hicieron con un navegador real (Playwright) contra el backend y sin él.

## Limitaciones conocidas

- Los campos y los cambios guardados en el servidor viven en memoria: se pierden al reiniciarlo.
- En modo demostración los escenarios son solo los predefinidos, y el calendario está calculado solo para el año normal.
- Todavía no hay descarga automática de SMAP y NDVI: con credenciales de AppEEARS el backend las pide; sin ellas usa datos de muestra simulados y lo avisa.
- Dibujar un polígono con el teclado no es posible: la alternativa accesible son las coordenadas y la carga de GeoJSON.
