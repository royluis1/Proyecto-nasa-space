# Login e historial de lotes con Supabase

FieldShift puede guardar los lotes del usuario y su historial (siembra, cosecha, riego,
observaciones) en una cuenta, para llevar la historia del lote y después decidir con ese
registro. Eso usa **Supabase** (base de datos + login con correo y contraseña).

**Importante:** FieldShift funciona **sin** esto. Si no se configura Supabase, no aparece el
login y los campos se guardan en el navegador, como hasta ahora. El código ya está hecho:
solo faltan los pasos de abajo.

## Pasos (una sola vez, ~10 minutos)

### 1. Crear el proyecto (o reusar el de Lovable)
- Si ya tenés el proyecto de Lovable, usá ese.
- Si no: entrá a https://supabase.com, **New project**, ponele nombre y una contraseña de
  base de datos (guardala, es secreta). Elegí la región más cercana (South America si está).

### 2. Crear las tablas
- En el proyecto: **SQL Editor** → **New query**.
- Pegá **todo** el contenido de `fieldshift/supabase/schema.sql` y tocá **Run**.
- Crea las tablas `perfiles`, `lotes` y `lote_historial`, con seguridad por fila (cada
  usuario ve solo lo suyo). Se puede correr más de una vez sin romper nada.

### 3. Copiar las dos claves públicas
- **Settings → API** (o **Project Settings → API keys**).
- Copiá:
  - **Project URL** → `https://xxxxxxxx.supabase.co`
  - **anon** / **publishable key** (la **pública**, NO la `service_role`).

### 4. Cargar las variables
**En Vercel** (Settings → Environment Variables, en Production y Preview):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | la Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave anon/publishable |

Después, **Redeploy** (las `NEXT_PUBLIC_` se graban al compilar).

**Para probar en tu compu**, en `fieldshift/frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-clave-anon
```

### 5. (Opcional) Confirmación de correo
Por defecto Supabase manda un correo para confirmar la cuenta al registrarse. Para una
demo es más cómodo desactivarlo: **Authentication → Providers → Email → Confirm email = off**.
Así el registro entra directo, sin esperar el correo.

## Qué queda andando
- En el encabezado aparece **Entrar**. Lleva a `/cuenta`, con **iniciar sesión** y **crear cuenta**.
- Con sesión iniciada, los lotes y su historial se guardan en la cuenta del usuario (tablas con RLS).
- Sin Supabase configurado, no se muestra el login y todo sigue como antes.

## Seguridad
- La URL y la clave **anon** son públicas: están pensadas para el navegador. Lo que protege
  los datos es el **RLS** del paso 2 (cada usuario accede solo a sus filas).
- La **contraseña de la base** y la **service_role key** son secretas: no van en el frontend
  ni en el repositorio. No hacen falta para esto.

## Archivos del código
- `frontend/lib/supabase/client.ts` — cliente del navegador (lee las dos variables).
- `frontend/components/auth/auth-provider.tsx` — estado de sesión, login, registro, salir.
- `frontend/components/auth/account-chip.tsx` — acceso a la cuenta en el encabezado.
- `frontend/app/cuenta/page.tsx` — pantalla de login y registro.
- `frontend/lib/supabase/lotes.ts` — guardar/listar lotes e historial.
- `supabase/schema.sql` — las tablas y las reglas RLS.
