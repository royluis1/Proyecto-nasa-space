"""Cliente de la API de AppEEARS (NASA LP DAAC) para extracciones por punto.

Flujo (asincrónico: AppEEARS procesa en cola, de minutos a horas):
1. POST /login con usuario y contraseña de Earthdata -> token (vale ~48 h).
2. POST /task con un pedido de tipo "point" -> task_id.
3. GET /task/{task_id} hasta que `status` sea "done".
4. GET /bundle/{task_id} -> lista de archivos; GET /bundle/{task_id}/{file_id} -> CSV.

⚠️ Escrito según la documentación pública de la API de AppEEARS
(https://appeears.earthdatacloud.nasa.gov/api/); verificar con la primera tarea real.
"""

from datetime import date

from app.utils.exceptions import UpstreamError
from app.i18n import tr

DEFAULT_BASE_URL = "https://appeears.earthdatacloud.nasa.gov/api"


class AppEEARSClient:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        token: str | None = None,
        username: str | None = None,
        password: str | None = None,
        timeout_s: float = 30.0,
        transport=None,
    ) -> None:
        import httpx  # solo se importa si se usa el conector en vivo

        self._httpx = httpx
        self.base_url = base_url.rstrip("/")
        self._token = token
        self._username, self._password = username, password
        self._client = httpx.Client(timeout=timeout_s, transport=transport)

    # --- autenticación ---
    def token(self) -> str:
        if self._token:
            return self._token
        if not (self._username and self._password):
            raise UpstreamError(tr("AppEEARS: faltan credenciales de Earthdata (FIELDSHIFT_APPEEARS_*).", "AppEEARS: Earthdata credentials are missing (FIELDSHIFT_APPEEARS_*)."))
        resp = self._request("POST", "/login", auth=(self._username, self._password), authenticated=False)
        self._token = resp.json()["token"]
        return self._token

    def _request(self, method: str, path: str, authenticated: bool = True, **kw):
        headers = kw.pop("headers", {})
        if authenticated:
            headers["Authorization"] = f"Bearer {self.token()}"
        try:
            resp = self._client.request(method, self.base_url + path, headers=headers, **kw)
        except self._httpx.HTTPError as exc:
            raise UpstreamError(tr(f"AppEEARS no respondió: {exc.__class__.__name__}.", f"AppEEARS did not respond: {exc.__class__.__name__}.")) from None
        if resp.status_code >= 400:
            raise UpstreamError(tr(f"AppEEARS respondió {resp.status_code} en {path}.", f"AppEEARS responded {resp.status_code} at {path}."))
        return resp

    # --- tareas ---
    def submit_point_task(
        self,
        name: str,
        appeears_id: str,
        layers: list[str],
        lat: float,
        lon: float,
        start: date,
        end: date,
        point_id: str = "lote",
        points: list[tuple[str, float, float]] | None = None,
    ) -> str:
        """Tarea por punto. Con `points` se piden varios puntos (por ejemplo, sectores de un lote) en una sola tarea."""
        coords = points or [(point_id, lat, lon)]
        body = {
            "task_type": "point",
            "task_name": name,
            "params": {
                "dates": [{"startDate": start.strftime("%m-%d-%Y"), "endDate": end.strftime("%m-%d-%Y")}],
                "layers": [{"product": appeears_id, "layer": layer} for layer in layers],
                "coordinates": [{"id": pid, "latitude": la, "longitude": lo} for pid, la, lo in coords],
            },
        }
        return self._request("POST", "/task", json=body).json()["task_id"]

    def task_status(self, task_id: str) -> str:
        """queued | pending | processing | done | error"""
        return self._request("GET", f"/task/{task_id}").json().get("status", "unknown")

    def download_csv(self, task_id: str, layer_hint: str) -> str:
        files = self._request("GET", f"/bundle/{task_id}").json().get("files", [])
        csvs = [f for f in files if str(f.get("file_name", "")).endswith(".csv")]
        if not csvs:
            raise UpstreamError(tr("AppEEARS: la tarea terminó pero no trae archivos CSV.", "AppEEARS: the task finished but has no CSV files."))
        chosen = next((f for f in csvs if layer_hint.split("_")[0] in f["file_name"]), csvs[0])
        return self._request("GET", f"/bundle/{task_id}/{chosen['file_id']}").text
