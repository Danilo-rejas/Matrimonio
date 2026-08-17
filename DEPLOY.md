# Cómo publicar la invitación (paso a paso)

Esta invitación usa **Supabase** para guardar las confirmaciones (base de datos + login del panel `/admin`), y un hosting gratuito aparte para publicar los archivos del sitio (Supabase no incluye hosting de páginas web).

## 1. Tu proyecto de Supabase

Ya creaste el proyecto (base de datos `MATRIMONIO`). Ahora necesitas dos datos **públicos** (no la contraseña) para conectar el sitio:

1. Entra a https://supabase.com/dashboard y abre el proyecto `MATRIMONIO`.
2. Ve a **Configuración del proyecto (Settings) → API**.
3. Copia:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public** key (una clave larga, empieza con `eyJ...`)
4. Pégalos en [public/js/supabase-config.js](public/js/supabase-config.js), reemplazando `TU_SUPABASE_URL` y `TU_SUPABASE_ANON_KEY`.

⚠️ La contraseña de la base de datos (la que definiste al crear el proyecto en Supabase) **no va en ningún archivo del sitio** — esa es solo para conexiones directas a Postgres (por ejemplo desde una herramienta como `psql` o Table Editor), no la usa el sitio web.

## 2. Crear la tabla de confirmaciones

1. En el panel de Supabase: **SQL Editor → New query**.
2. Pega el contenido de [supabase/schema.sql](supabase/schema.sql) y dale **Run**.
3. Esto crea la tabla `rsvps` con las reglas de seguridad: cualquiera puede confirmar, pero solo ustedes (con sesión iniciada) pueden ver y editar la lista.

## 3. Crear el usuario único del panel /admin

1. Panel de Supabase → **Authentication → Users → Add user**.
2. Crea el único usuario que usarán ambos para entrar a `/admin` (ej. `novios@sucorreo.com` + una contraseña que ambos recuerden — puede ser distinta a la de la base de datos).

## 4. Publicar el sitio (hosting)

Supabase solo da la base de datos; el sitio (`public/`) se sube a un hosting gratuito de archivos estáticos. La forma más simple sin instalar nada:

1. Entra a https://app.netlify.com/drop
2. Arrastra la carpeta `public` completa a esa página.
3. En segundos te da un link público, algo como `https://nombre-al-azar.netlify.app`.
4. (Opcional) Desde ahí puedes crear una cuenta gratuita de Netlify para poder actualizar el sitio después y ponerle un nombre fijo o un dominio propio.

## 5. Links finales

- **Invitación (para enviar a los invitados):** el link que te dio Netlify, ej. `https://tu-sitio.netlify.app`
- **Panel privado (solo para ustedes):** el mismo link + `/admin`, ej. `https://tu-sitio.netlify.app/admin`

## Notas

- Los datos de las confirmaciones también se pueden ver directamente en Supabase → **Table Editor → rsvps**, útil como respaldo o para exportar a Excel/Sheets.
- Si actualizan algún archivo (por ejemplo, ponen la foto de la pareja o cambian un texto), vuelven a arrastrar la carpeta `public` actualizada a Netlify Drop, o conectan el proyecto a Netlify con una cuenta para que quede con un solo link fijo que se actualiza solo.
