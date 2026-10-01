# Cómo publicar la invitación (paso a paso)

La invitación usa **Firebase** (de Google) para guardar los invitados, las confirmaciones y las mesas, y para el login del panel `/admin`. Firebase también puede hospedar el sitio gratis, aunque Netlify sigue funcionando si lo prefieres.

> Los archivos de la versión anterior con Supabase quedaron en `_antiguo-supabase/` solo como respaldo. El sitio ya no los usa.

## 1. Crear el proyecto en Firebase (5 minutos)

1. Entra a https://console.firebase.google.com con tu cuenta de Google y dale **Crear proyecto**. Nómbralo por ejemplo `boda-alondra-julio`. Puedes desactivar Google Analytics.
2. Dentro del proyecto, en el menú **Compilación → Firestore Database → Crear base de datos**. Elige **modo de producción** y la ubicación `southamerica-east1` (São Paulo) o `us-central1`.
3. En **Compilación → Authentication → Comenzar**. En la pestaña **Sign-in method** activa **Google** (pide un correo de soporte, pon el tuyo) y, si también quieren contraseña, **Correo electrónico/contraseña**.
4. Decide qué cuentas pueden entrar al panel y escríbelas en DOS lugares (deben ser iguales):
   - [public/js/firebase-config.js](public/js/firebase-config.js), listas `CORREOS_GOOGLE` y `CORREOS_CONTRASENA`.
   - [firestore.rules](firestore.rules), función `novios()` (las mismas dos listas).

   Los correos de `CORREOS_GOOGLE` solo entran con el botón **Entrar con Google**: Google confirma que el correo es de esa persona, así nadie puede registrarse con contraseña usando su correo. Los de `CORREOS_CONTRASENA` solo entran con contraseña y **tienen que estar creados** en **Authentication → Users → Agregar usuario** (si no existen, otra persona podría crearlos). Cualquier otra cuenta que intente entrar es rechazada.

## 2. Conectar el sitio con tu proyecto

1. En la consola, dale al engranaje (arriba a la izquierda) → **Configuración del proyecto** → pestaña **General** → baja hasta **Tus apps** → botón **`</>`** (app web).
2. Ponle un nombre (ej. `invitacion`), no marques Hosting todavía, y dale **Registrar app**.
3. Te muestra un bloque `const firebaseConfig = { apiKey: "...", ... }`. Copia esos seis valores y pégalos en [public/js/firebase-config.js](public/js/firebase-config.js), reemplazando los `TU_...`.

Esos valores son públicos por diseño; la protección de los datos la dan las reglas del paso 3.

## 3. Reglas de seguridad de la base de datos

1. Consola → **Firestore Database → pestaña Reglas**.
2. Borra lo que hay, pega el contenido completo de [firestore.rules](firestore.rules) y dale **Publicar**.

Con eso: cualquier invitado puede enviar su confirmación y ver su propio nombre con su enlace, pero solo ustedes (con sesión) pueden ver la lista, editar invitados y armar mesas.

## 4. Traer las confirmaciones antiguas de Supabase (opcional)

1. En Supabase: **Table Editor → rsvps → Export → Export to CSV**.
2. Entra al panel `/admin`, pestaña **Respuestas**, abre "Importar respuestas antiguas desde Supabase (CSV)" y elige el archivo.
3. Aparecen en la lista con la fecha original. Si vuelves a importar el mismo archivo no se duplican.

## 5. Publicar el sitio

### Opción A: Netlify (arrastrar y soltar, sin instalar nada)

1. Entra a https://app.netlify.com/drop y arrastra la carpeta `public` completa.
2. Copia el link que te da (ej. `https://nombre.netlify.app`).
3. **Importante:** en Firebase, **Authentication → Settings → Dominios autorizados → Agregar dominio** y pega `nombre.netlify.app`. Sin esto el login del panel no funciona desde internet.

### Opción B: Firebase Hosting (todo en un solo lugar)

Requiere tener Node.js instalado. En una terminal, dentro de la carpeta del proyecto:

```
npm install -g firebase-tools
firebase login
firebase use --add        (elige tu proyecto)
firebase deploy
```

Eso publica el sitio y las reglas de Firestore a la vez. El link queda como `https://tu-proyecto.web.app`, y ese dominio ya está autorizado automáticamente.

## 6. Links finales

- **Invitación general:** el link del sitio, ej. `https://tu-sitio.netlify.app`
- **Panel privado:** el mismo link + `/admin`
- **Invitación personal de cada invitado:** se genera sola en el panel, ej. `https://tu-sitio.netlify.app/?inv=k3j9x2p1qa`

---

## Cómo usar el panel /admin

### Pestaña "Invitados": enlaces únicos + WhatsApp

- Agrega cada invitado (o familia) con su nombre, su WhatsApp y sus pases de adultos y de niños.
- Cada invitado recibe un enlace propio (`?inv=CODIGO`). Cuando lo abre, la portada muestra "Invitación para <nombre>" con sus pases, y el formulario solo le deja elegir hasta los adultos y niños que le reservaron. Sin enlace personal, el formulario no se muestra.
- Botón **Copiar enlace**: copia el enlace personal.
- Botón **WhatsApp**: abre WhatsApp con el mensaje ya escrito y el enlace incluido, listo para enviar. Números de 8 dígitos se envían con el código de Bolivia (591); para otro país escribe el número completo con código (ej. `5491122334455`).
- El texto del mensaje se edita en la tarjeta **Mensaje de WhatsApp** con `{nombre}`, `{pases}` y `{enlace}`. Se guarda en el navegador donde lo editas.

### Pestaña "Asistencia"

- Resumen: invitados, cuántos confirmaron (y cuántas personas en total), cuántos no asistirán y cuántos aún no responden.
- Lista **Sin respuesta** con botón **Recordar** que abre WhatsApp con el mismo mensaje y enlace.
- El formulario de la invitación permite responder "No podré asistir".

### Pestaña "Mesas": plano del salón

- Agrega mesas con nombre, cantidad de sillas y forma (redonda o rectangular). Aparecen en el plano.
- **Arrastra cada mesa** para ubicarla como está en el salón (el plano tiene marcado el escenario arriba y la entrada abajo). La posición se guarda sola y se ve igual desde cualquier celular o computadora.
- **Arrastra un invitado** desde la lista "Sin mesa" y suéltalo sobre una mesa. También puedes arrastrarlo de una mesa a otra, o de vuelta a "Sin mesa" para quitarlo.
- **Toca una mesa** para abrir su panel: cambiar nombre, sillas o forma, ver quiénes están sentados, quitar a alguien o sentar a alguien con el desplegable (útil si arrastrar resulta incómodo en el celular).
- Las sillas ocupadas se calculan con los pases confirmados (o los reservados si aún no responde). La mesa se pone verde cuando está completa y roja si te pasaste.
- Los invitados que dijeron que no asistirán no aparecen para sentar.

### Pestaña "Respuestas"

Todas las respuestas del formulario tal como llegaron, incluidas las de personas que confirmaron sin enlace personal (aparecen como "sin enlace"). Desde aquí también se importa el CSV de Supabase.

## Si algo falla

- **"Falta pegar la configuración de Firebase"** al entrar: revisa el paso 2.
- **"La cuenta ... no está autorizada"**: ese correo no está en la lista del paso 4 (revisa mayúsculas y que sea exactamente el mismo Gmail).
- **"Falta activar Google en Firebase"**: Authentication → Sign-in method → Google → Habilitar.
- **"No se pudieron leer los datos"** dentro del panel: las reglas del paso 3 no están publicadas.
- **El login funciona en tu computadora pero no en el link de Netlify:** falta el dominio autorizado del paso 5A.
- Los datos también se pueden ver y exportar desde la consola: **Firestore Database → Datos**.
