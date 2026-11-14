# FieldShift · Frontend (pendiente)

Stack: Next.js 14+ con TypeScript, Tailwind CSS, shadcn/ui y Leaflet (react-leaflet, con `ssr: false`).

| Carpeta | Contenido previsto |
|---|---|
| `app/` | Rutas: inicio y selección de campo, perfil y prioridades, diagnóstico, comparador, monitor, metodología |
| `components/map/` | Mapa Leaflet con los campos precargados y coordenadas manuales |
| `components/charts/` | Gráficos de clima, NDVI, radar y barras |
| `components/score/` | Ranking, desglose del puntaje y detalle de rotación |
| `components/provenance/` | Etiquetas observado / modelado / estimado / supuesto y banner de datos cacheados o de muestra |
| `components/ui/` | Componentes de shadcn/ui |
| `lib/` | Cliente tipado de la API y formateadores |
| `public/` | Recursos estáticos |
| `tests/` | Tests del frontend |

Reglas de diseño: paleta verde, tierra, azul y blanco; español rioplatense; el riesgo nunca se comunica solo con color (siempre ícono + texto); advertencia visible en toda la app.
