# Progreso — Portada global + modo estricto

## Hecho
1. ✅ Estilos y recursos: tokens `icon-leaf/cycle/water(+fg)` y `hero-foreground` en `globals.css` (claro/oscuro), utilidades `hero-overlay`/`hero-text-shadow`, sombras `shadow-card`/`shadow-button` en `tailwind.config.ts`; foto `public/img/hero-campo-san-luis.jpg`.
2. ✅ Portada: `app/page.tsx` (server, `export const metadata`) + `components/home/landing.tsx` (hero a pantalla completa con la foto, título "Sembrar con datos, no con dudas", botón Empezar y "Nuestros objetivos" con 3 tarjetas).
3. ✅ Header público reducido: logo + "Cómo funciona" + botón "Registro" (/cuenta); Regiones/Mis campos/Metodología movidos al footer. Con perfil, sigue el `ProfileChip`.
4. ✅ Botón Empezar: `StartLink` con helper `startHref(profile)` (sin perfil → /ingresar, con perfil → /campos). `/ingresar` guarda el perfil (dispara `PROFILE_EVENT`) y va a /campos. Tests en `tests/portada.test.ts`.
5. ✅ Modo estricto `FIELDSHIFT_STRICT_NASA` (default true): POWER, satélite y relieve no usan muestras SIMULADAS; si la API falla y no hay caché/archivo real → `503 NO_DATA_AVAILABLE` ("Servicio de la NASA no disponible"). El frontend no cae a demo ante `NO_DATA_AVAILABLE`. Tests en `app/tests/test_strict_nasa.py`. Desactivado en los tests que usan muestras (construyen los proveedores con `strict=False`). `.env.example` y `backend/README.md` actualizados.

## Pendiente / notas
- Al terminar todo: borrar `portada-ref/` de la raíz (quedó local, sin commitear).
- Los menús por perfil (huerta/agricultor) se definen en otros prompts: acá no se tocaron.
- El suelo estimado (SoilGrids/ISRIC) no es NASA; su muestra queda como estaba (rotulada como estimación), fuera del modo estricto.
- Confirmar con el mentor si la caché de respuestas reales cuenta como "consumir la API" (acá se dejó permitida).
