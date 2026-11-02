# Generales de Dios · Un recorrido por la nube de testigos

Portal interactivo, en español, sobre la vida y obra de **81 hombres y mujeres de fe** que transformaron ciudades, naciones y generaciones: desde Abraham, Moisés y los apóstoles, pasando por los reformadores, los avivamientos y los misioneros, hasta Billy Graham y los evangelistas de América Latina, África y Asia.

> «Por tanto, nosotros también, teniendo en derredor nuestro tan grande nube de testigos…» (Hebreos 12:1)

Dirección en GitHub Pages (al publicar desde `main`): https://freddyandres.github.io/webpage/

## Qué incluye

- **Recorrido en 10 salas**: Patriarcas y profetas · Iglesia apostólica · Mártires y padres · Reforma · Grandes despertares · Siglo XIX · Misiones · Fuego del siglo XX · Fe bajo fuego · La cosecha de las naciones. En escritorio, cada sala es un «corredor» que se desplaza horizontalmente mientras haces scroll.
- **Ficha de vida y obra** de cada general: biografía, hitos, legado, una cita verificada, un versículo (RVR1960), conexiones con otros generales, botón para escuchar la biografía y enlace directo para compartir (`#general/lutero`).
- **Tour guiado con audioguía**: presentación a pantalla completa que avanza sola, con narración por voz del navegador (Web Speech API), controles de teclado y gestos táctiles.
- **Línea del tiempo** de 4.000 años, arrastrable, con generales y acontecimientos clave.
- **Mapa de las naciones** con pines por sala y rutas animadas (Abraham, Pablo, misioneros del siglo XIX, el fuego de Pentecostés de 1904–1911 y las cruzadas de Billy Graham).
- **Ciudades transformadas**: 14 ciudades con su «antes y después» y una cámara que vuela de una a otra.
- **Cadenas de fuego**: quién le pasó la antorcha a quién (de Wycliffe a Wesley y Wilberforce; de Moody a Billy Graham y Luis Palau; de Gales y Azusa a Brasil), con notas históricas cuando la versión popular exagera.
- **Voces que resuenan**, **explorador con filtros** (sala, región, llamado, mujeres de fe) y un **desafío** de preguntas.
- Accesible y adaptable: diseño responsivo, navegación con teclado, `prefers-reduced-motion` y contenido legible si fallan las imágenes.

## Estructura

```
index.html            Página única del recorrido
assets/css/styles.css Estilos y animaciones
assets/js/data.js     Contenido: salas, generales, ciudades, cadenas, rutas, eventos y fuentes
assets/js/app.js      Interacciones y animaciones (JavaScript sin dependencias)
assets/js/icons.js    Emblemas de cada general (generado)
assets/js/world.js    Mapa mundial en SVG (generado)
assets/img/           Favicon e imagen para redes sociales
tools/                Scripts para regenerar el mapa y los íconos
.nojekyll             Publica los archivos tal cual en GitHub Pages
```

## Verlo en tu computadora

No necesita compilación. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Agregar o editar un general

Todo el contenido vive en `assets/js/data.js`. Copia un objeto del arreglo `G`, cambia su `id` (único, sin espacios) y completa los campos:

| Campo | Uso |
| --- | --- |
| `sala` | Número de sala (1–10) |
| `nombre`, `titulo`, `fechas`, `lugar` | Encabezado de la tarjeta |
| `y` | Año aproximado para la línea del tiempo (negativo = a.C.) |
| `coord` | `[latitud, longitud]` para el mapa |
| `pais`, `region`, `roles`, `mujer` | Filtros del explorador |
| `img`, `cred` | Nombre exacto del archivo en Wikimedia Commons y su crédito |
| `icono` | Emblema (ver claves en `assets/js/icons.js`) |
| `resumen`, `bio`, `hitos`, `legado`, `cita`, `verso`, `con` | Contenido de la ficha |

Los retratos se cargan desde Wikimedia Commons (`Special:FilePath`). Si una imagen no carga, se muestra el emblema del general.

Para regenerar el mapa o los íconos: `cd tools && npm install && npm run build`.

## Fuentes y créditos

- Texto bíblico: Reina-Valera © 1960 Sociedades Bíblicas en América Latina; © renovado 1988 Sociedades Bíblicas Unidas. Utilizado con permiso.
- Biografías basadas en obras de referencia (Justo L. González, Ruth A. Tucker, Mark A. Noll, John Foxe), autobiografías y archivos como el Billy Graham Center (Wheaton College), Christian History Institute, el Dictionary of African Christian Biography, el Biographical Dictionary of Chinese Christianity y Memoria Chilena. La lista completa está al pie del sitio.
- Las cifras de asistencia y conversiones provienen muchas veces de los propios ministerios o de crónicas de la época; las fechas bíblicas son aproximadas.
- Imágenes: Wikimedia Commons (dominio público o licencias libres; créditos dentro del sitio). Mapa: Natural Earth. Íconos: [Lucide](https://lucide.dev) (ISC) y diseños propios.
- La expresión «generales de Dios» fue popularizada por la serie de libros de Roberts Liardon; este proyecto no está afiliado a ella.

Código bajo licencia GPL-3.0 (ver `LICENSE`).
