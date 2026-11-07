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

## Requisitos

- [Node.js](https://nodejs.org) **22.13 o superior**. No hay dependencias externas: no hace falta `npm install`.
- La base de datos es SQLite (incluida en Node.js) y se guarda en la carpeta `data/` (o en `DATA_DIR`).

## Puesta en marcha

```bash
# 1. Crear las cuentas de los administradores (la contraseña se escribe de forma oculta)
npm run admin:create -- --user samantha
npm run admin:create -- --user angel

# 2. Iniciar el servidor
npm start
```

- Página pública: http://localhost:3000
- Panel administrativo: http://localhost:3000/admin/

Las contraseñas deben tener al menos 10 caracteres, con letras y números. Ejecutar de nuevo `admin:create` con el mismo usuario restablece su contraseña (y cierra sus sesiones abiertas). Para una cuenta de solo consulta: `npm run admin:create -- --user invitado --name "Nombre" --role lector`.

## Publicar en internet

El sitio necesita un servidor con Node.js (GitHub Pages no sirve, porque solo publica páginas estáticas). Sirven, por ejemplo, Render, Railway, Fly.io o un VPS. Lo importante:

1. Comando de inicio: `npm start`.
2. **Disco persistente** montado en la carpeta de `DATA_DIR` (por ejemplo `/var/data/patita`). Sin él, las inscripciones se borran al reiniciar el servicio.
3. Variables de entorno (ver `.env.example`): `NODE_ENV=production`, `DATA_DIR`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`.
4. Si el hosting no tiene consola para ejecutar `admin:create`, define como **secretos** `ADMIN_SAMANTHA_PASSWORD` y `ADMIN_ANGEL_PASSWORD`: al arrancar se crean las cuentas `samantha` y `angel` si aún no existen (nunca sobrescriben una contraseña ya establecida). Después, cada persona puede cambiar su contraseña desde «Mi cuenta» y se pueden borrar esas variables.
5. Usa siempre HTTPS.

**Copias de seguridad:** basta con copiar la carpeta `DATA_DIR` (contiene `patita.db` y las fotografías).

## Seguridad y protección de datos

- Las contraseñas nunca se escriben en el código: se guardan cifradas con scrypt y sal aleatoria.
- Sesiones con token aleatorio en cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` en producción); en la base solo se guarda su hash.
- Bloqueo de 15 minutos tras 5 intentos fallidos de inicio de sesión.
- Permisos por rol: `admin` (gestión completa) y `lector` (solo consulta), verificados en el servidor.
- Protección contra peticiones de otros sitios (CSRF), cabeceras de seguridad (CSP, anti-iframe), límite de envíos por IP y trampa anti-spam.
- Las fotos de los productos son privadas: solo se ven desde el panel con sesión iniciada.
- Validación completa en el servidor y numeración atómica: los números `UPP` no se repiten ni se reutilizan, y un doble clic no crea dos solicitudes.
- La exportación CSV evita la inyección de fórmulas en Excel.

## Estructura

```
server/     servidor, API, base de datos, autenticación, exportación
public/     página pública (HTML, CSS, JS, ilustraciones)
admin/      panel administrativo
scripts/    creación de administradores
test/       pruebas automáticas (npm test)
```

## Pendiente de completar (desde el panel → Configuración)

- Fotografía de Luna y su historia.
- Enlace de Instagram (mientras tanto se muestra «Próximamente»).
- Dirección exacta del evento.
- Límite de puestos, si se define.
