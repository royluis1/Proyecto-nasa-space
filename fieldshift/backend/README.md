# FieldShift · Backend (FastAPI)

API de FieldShift para el NASA Space Apps Challenge 2026 (*Field Shift: Adapting Farms with NASA Data*).

> FieldShift es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.

## Estado de esta versión (backend base)

| Endpoint | Estado |
|---|---|
| `GET /health`, `GET /crops`, `POST /fields`, `GET /fields/{id}`, `POST /priorities` | Funcionan con datos de muestra |
| `POST /climate-summary` | Valida y devuelve la estructura **vacía** (integración NASA POWER pendiente) |
| `POST /rotations/compare`, `GET /rotations/{id}`, `GET /export/report` | Puntajes **simulados** (`data_status: "mock"`) |
| `POST /scenarios` | Valida y devuelve rankings **vacíos** |

Los datos de muestra (`app/data/*.json`) son **ilustrativos**: coordenadas aproximadas, suelos y rotaciones de ejemplo, catálogo de cultivos provisorio. Lo creado con `POST` se guarda en memoria y se pierde al reiniciar.

## Requisitos

Python 3.11 o superior.

## Instalación y ejecución

**macOS / Linux**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Windows (PowerShell)**
```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```
Si PowerShell bloquea el script de activación: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Abrí **http://127.0.0.1:8000/docs** (Swagger, con ejemplos de cada request).

## Tests

```bash
pytest -q
```
`test_validators.py` corre sin FastAPI. `test_api.py` necesita las dependencias instaladas.

## Configuración

Todo por variables de entorno con prefijo `FIELDSHIFT_` (ver `.env.example`). No hay claves en el código; NASA POWER no requiere clave.

## Arquitectura

```
app/
├── main.py          crea la app: CORS, request_id, logging, handlers, rutas
├── config.py        Settings (pydantic-settings)
├── api/             rutas HTTP, dependencias y ejemplos de Swagger
├── services/        repositorio de datos y puntaje simulado
├── models/          enums, procedencia (Provenance/Valued) y constantes
├── schemas/         contratos de request/response (Pydantic v2)
├── data/            JSON de muestra
├── utils/           validadores, excepciones, handlers de error, logging JSON
└── tests/
```

- **Rutas finas:** validan, llaman a servicios y envuelven la respuesta. No tienen lógica.
- **Sobre de respuesta único:** `{"data": ..., "meta": {data_status, as_of, warnings, disclaimer}}`. `data_status` es `live`, `cached`, `sample` o `mock`.
- **Errores consistentes:** `{"error": {code, message, details, request_id}}` para validación (422), dominio (400/404), HTTP y errores no controlados (500, sin filtrar detalles internos).
- **Procedencia:** los valores usan `Provenance` con etiqueta *observado / modelado / estimado / supuesto*, fuente, resolución y confianza.
- **Trazabilidad:** cada request tiene `X-Request-ID` (se respeta si lo manda el cliente) y se registra en logs JSON con método, ruta, estado y duración.
