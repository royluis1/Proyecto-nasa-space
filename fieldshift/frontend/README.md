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
| `/campos` | Selección de campo (lista + mapa con los campos) |
| `/campos/nuevo` | Cargar un campo: mapa + formulario |
| `/campo/[id]/perfil` | Perfil del campo (editable) y las 11 prioridades |
| `/campo/[id]/diagnostico` | Diagnóstico climático e hídrico: clima, humedad del suelo y vegetación |
| `/campo/[id]/comparador` | Ranking de rotaciones, que se recalcula al mover las prioridades |
| `/campo/[id]/rotacion/[rid]` | Detalle: por qué, desglose del puntaje, riesgos, evidencia y supuestos |
| `/campo/[id]/calendario` | Calendario agrícola mensual y ventanas de siembra |
| `/campo/[id]/escenarios` | Escenarios climáticos (lluvia, temperatura, año seco, riego) |
| `/campo/[id]/reporte` | Reporte exportable: CSV, JSON e impresión o PDF |
| `/metodologia` | Metodología, fuentes y glosario |

## Estructura

```
frontend/
├── app/            rutas (App Router)
├── components/
│   ├── ui/         botón, tarjeta, slider, tabla, alerta... (estilo shadcn/ui)
│   ├── map/        mapa Leaflet (búsqueda, punto, polígono, GeoJSON, satélite)
│   ├── charts/     gráficos accesibles (cada uno con su tabla de datos)
│   ├── score/      tarjetas del ranking, barras de puntaje, calendario
│   ├── provenance/ etiquetas de origen del dato, riesgo y confianza
│   ├── field/      formulario del campo y controles de prioridades
│   ├── campo/      estado compartido del campo (prioridades, ranking)
│   └── layout/     encabezado, avisos, pie, modo oscuro
├── hooks/          useAsync, useDebounced, useBackendStatus
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

## Tests

`npm test` corre 67 tests de la lógica: prioridades, ranking en vivo, geometría del mapa, GeoJSON, calendario, exportación, datos de ejemplo y el cliente de API (reintentos, errores, paso a modo demostración, recuperación). Las pruebas de pantalla se hicieron con un navegador real (Playwright) contra el backend y sin él.

## Limitaciones conocidas

- Los campos y los cambios guardados en el servidor viven en memoria: se pierden al reiniciarlo.
- En modo demostración los escenarios son solo los predefinidos.
- Todavía no hay descarga automática de SMAP y NDVI: con credenciales de AppEEARS el backend las pide; sin ellas usa datos de muestra simulados y lo avisa.
- Dibujar un polígono con el teclado no es posible: la alternativa accesible son las coordenadas y la carga de GeoJSON.
