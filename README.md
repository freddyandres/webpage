# 🐾 Unidos por una Patita

> «Unidos por amor, movidos por la esperanza».

Página web y panel administrativo de **Unidos por una Patita**, una feria solidaria de emprendimientos en el **Barrio Brisas de los Álamos** que une a personas, pequeños negocios y amantes de los animales para apoyar a los animalitos que necesitan ayuda.

## Qué incluye

**Página pública (`/`)**
- Portada con nombre, lema, presentación, espacio para la fotografía de Luna y los botones «Inscribir mi emprendimiento» y «Conocer el proyecto».
- Propósito de la feria, categorías permitidas, aclaraciones (no es obligatorio donar, se vende normalmente, $10.000 COP por puesto) y pasos para participar.
- Formulario de inscripción en 4 secciones (datos personales, emprendimiento, puesto y confirmación), con validación y mensajes claros, foto opcional de los productos.
- Confirmación con número único consecutivo (`UPP-001`, `UPP-002`…), botón para copiarlo y estado «Solicitud recibida, pendiente de revisión».
- Consulta del estado de la inscripción (con número + celular).
- 14 preguntas frecuentes en acordeón, contacto, botón de WhatsApp y organizadores.
- Diseño adaptable a celulares, tabletas y computadores.

**Panel privado (`/admin/`)**
- Inicio de sesión con usuario y contraseña (Samantha y Ángel).
- Lista de inscripciones con búsqueda (nombre, emprendimiento o número), filtro por categoría y por estado.
- Detalle completo de cada solicitud, con foto, accesos directos a WhatsApp y correo, notas internas e historial de cambios (quién cambió qué y cuándo).
- Cambio de estado: Pendiente de revisión, Aprobada o Rechazada, y registro del pago.
- Totales: inscritos, pendientes, aprobadas, rechazadas, puestos disponibles (si hay límite) y total recaudado.
- Descarga de todas las inscripciones en **Excel (.xlsx)** o **CSV**.
- Configuración de los espacios pendientes: **fotografía e historia de Luna, enlace de Instagram, dirección exacta** y límite de puestos.
- Cambio de contraseña.

## Publicación (Vercel + Supabase)

- **Sitio:** https://unidos-por-una-patita.vercel.app · **Panel:** https://unidos-por-una-patita.vercel.app/admin/
- **Hosting:** Vercel (proyecto `unidos-por-una-patita`). Los archivos de `public/` se sirven como estáticos y `api/index.js` atiende `/api/*` y `/media/*`.
- **Base de datos:** PostgreSQL en Supabase, esquema `patita` dentro del proyecto «Aula Contigo», con un usuario propio (`patita_app`) que solo tiene acceso a ese esquema. Las fotografías también se guardan en la base.
- **Variables de entorno en Vercel:** `DATABASE_URL` (secreta), `NODE_ENV=production`, `NODEJS_HELPERS=0`.

### Crear las cuentas de Samantha y Ángel

En Vercel → proyecto → *Settings* → *Environment Variables*, agrega como **Sensitive**:

- `ADMIN_SAMANTHA_PASSWORD` → usuario `samantha`
- `ADMIN_ANGEL_PASSWORD` → usuario `angel`

(mínimo 10 caracteres, con letras y números). Luego *Deployments* → *Redeploy*. Al primer uso se crean las cuentas; después cada persona puede cambiar su contraseña en «Mi cuenta» y puedes borrar esas variables (nunca sobrescriben una contraseña ya creada).

## Desarrollo local

Requiere Node.js 22. Sin `DATABASE_URL` se usa PGlite (PostgreSQL embebido) en `data/`.

```bash
npm install
npm run admin:create -- --user samantha
npm start            # http://localhost:3000  ·  panel: /admin/
npm test
```

Con `DATABASE_URL` definida, `admin:create` crea o restablece la cuenta directamente en Supabase.

## Seguridad y protección de datos

- Las contraseñas nunca se escriben en el código: se guardan cifradas con scrypt y sal aleatoria.
- Sesiones con token aleatorio en cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` en producción); en la base solo se guarda su hash.
- Bloqueo de 15 minutos tras 5 intentos fallidos de inicio de sesión.
- Permisos por rol: `admin` (gestión completa) y `lector` (solo consulta), verificados en el servidor.
- Protección contra peticiones de otros sitios (CSRF), cabeceras de seguridad (CSP, anti-iframe), límite de envíos por IP y trampa anti-spam.
- Las fotos de los productos son privadas: solo se ven desde el panel con sesión iniciada.
- La base del proyecto está aislada: su usuario no puede leer otras tablas del proyecto de Supabase.
- Validación completa en el servidor y numeración atómica: los números `UPP` no se repiten ni se reutilizan, y un doble clic no crea dos solicitudes.
- La exportación CSV evita la inyección de fórmulas en Excel.

## Estructura

```
api/        función de Vercel
server/     servidor, API, base de datos (schema.sql), autenticación, exportación
public/     página pública; public/admin/ panel administrativo
scripts/    creación de administradores
test/       pruebas automáticas (npm test)
```

## Pendiente de completar (desde el panel → Configuración)

- Fotografía de Luna y su historia.
- Enlace de Instagram (mientras tanto se muestra «Próximamente»).
- Dirección exacta del evento.
- Límite de puestos, si se define.
