// Genera assets/js/world.js: trazado SVG del mapa mundial (proyección Natural Earth)
// y los parámetros de proyección que usa app.js para ubicar ciudades.
// Uso:  cd tools && npm install && npm run build:map
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { geoNaturalEarth1, geoPath, geoGraticule } from 'd3-geo';
import { feature, mesh, merge } from 'topojson-client';

const here = dirname(fileURLToPath(import.meta.url));
const topo = JSON.parse(readFileSync(join(here, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));

// Sin la Antártida: el mapa gana espacio para las naciones habitadas.
const geoms = topo.objects.countries.geometries.filter((g) => g.id !== '010');
const countries = feature(topo, { type: 'GeometryCollection', geometries: geoms });
const land = merge(topo, geoms);
const borders = mesh(topo, { type: 'GeometryCollection', geometries: geoms }, (a, b) => a !== b);

const W = 1000;
const H = 500;
const projection = geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], countries);
const path = geoPath(projection).digits(1);

const out = {
  w: W,
  h: H,
  scale: +projection.scale().toFixed(4),
  tx: +projection.translate()[0].toFixed(4),
  ty: +projection.translate()[1].toFixed(4),
  land: path(land),
  borders: path(borders),
  grat: path(geoGraticule().step([30, 30])()),
};

const js = `/* Generado por tools/build-map.mjs — Natural Earth 1:110m (dominio público) vía world-atlas. No editar a mano. */\nwindow.GD_WORLD=${JSON.stringify(out)};\n`;
writeFileSync(join(here, '../assets/js/world.js'), js);
console.log('world.js', (js.length / 1024).toFixed(1) + ' KB', 'scale', out.scale, 'translate', out.tx, out.ty);
