# Estudio multimedia (no se publica)

Fuentes para regenerar los recursos de `../assets/`. Requiere Node con Playwright y ffmpeg.

| Archivo | Genera |
| --- | --- |
| `cover-art.js`, `cover.html`, `render-cover.js` | `portada.png` y `portada-fondo.png` (portada ilustrativa) |
| `trailer.html`, `render-video.js` | `assets/media/trailer.mp4` y `trailer-vertical.mp4` |
| `tarjetas.html`, `render-tarjetas.js` | imágenes de `assets/kit/` y `assets/og.jpg` |
| `narracion-original.mp3` | narración (ElevenLabs, voz «Miguel – Narrador Bíblico») |
| `peaks.json` | forma de onda del reproductor (va incrustada en `app.js`) |

```bash
cd camino-del-discipulo
node _estudio/render-cover.js _estudio/portada.png _estudio/portada-fondo.png
node _estudio/render-video.js 1280 720 25 assets/media/trailer.mp4 _estudio/narracion-original.mp3
node _estudio/render-video.js 1080 1920 25 assets/media/trailer-vertical.mp4 _estudio/narracion-original.mp3
node _estudio/render-tarjetas.js assets/kit && mv assets/kit/og.jpg assets/og.jpg
```

Los tiempos de los subtítulos están en `trailer.html` (`CUES`) y en `app.js`.
