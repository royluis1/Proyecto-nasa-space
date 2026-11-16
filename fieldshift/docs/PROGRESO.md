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

## Sesión — Menú perfil agricultor (/campo/[id]/perfil) (Prompt 1)
- Agregado menú de navegación (≡ Menu) para perfil agricultor: `components/campo/profile-menu.tsx` + persistencia en `lib/profile-menu.ts` (localStorage `fieldshift:profile-menu`, evento `fieldshift:profile-menu`), con submenús colapsables (Profile/Tools), flecha animada, estado activo por URL y persistencia de submenú abierto/sección activa.
- Integrado en `components/campo/campo-shell.tsx` (solo perfil `agricultor`, sin tocar huerta): sidebar fija/sticky en desktop y drawer en móvil.
- Secciones/rutas: Priority editor (`/perfil#prioridades`), View my rotation plan/Compare (`/comparador`), Alerts, Calendar, History, Scenarios, Comparative dashboard (`/dashboard`), Information (`/metodologia`). Placeholder "Coming soon" (sin ruta): Campaigns. (Nota: "View my rotation plan" y "Compare current vs. another" apuntan a comparador; la sección activa se marca como Compare en esa ruta.)
- Tests: `tests/profile-menu.test.ts` (sección activa por ruta y persistencia de submenús en localStorage).

## Sesión — Acceso unificado (/cuenta + header) (Prompt 2)
- `/cuenta` ahora es una sola pantalla con cambio entre "Already have an account? Sign in" y "New here? Sign up" sin cambiar de URL: login pide email+contraseña; signup agrega nombre opcional. Lógica Supabase intacta; textos de esta pantalla en inglés.
- Header público: se quitó el botón separado "Sign up" (`MainAction`); queda un único acceso (`AccountChip`) que muestra "Sign in" sin sesión y la cuenta cuando ya está logueado. No se tocó el menú de `/campo/[id]/perfil` ni la landing.
- Tests: `tests/cuenta.test.ts` (cambio de modo en el mismo URL y textos), `tests/portada.test.ts` actualizado (acceso único en el header).
