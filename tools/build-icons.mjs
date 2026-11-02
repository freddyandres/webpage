// Genera assets/js/icons.js: emblemas lineales (24x24) para cada general.
// Combina íconos de Lucide (licencia ISC) con íconos propios del portal.
// Uso:  cd tools && npm install && npm run build:icons
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const lucideDir = join(here, 'node_modules/lucide-static/icons');

// nombre en el portal -> ícono de Lucide
const lucide = {
  estrella: 'star', llama: 'flame', corona: 'crown', llaves: 'key-round', pergamino: 'scroll-text',
  tienda: 'tent', corazon: 'heart', libro: 'book-open', martillo: 'hammer', espada: 'sword',
  manos: 'hand-heart', pluma: 'feather', balanza: 'scale', pan: 'wheat', barco: 'sailboat',
  brujula: 'compass', globo: 'globe', escuela: 'school', flor: 'flower-2', montana: 'mountain-snow',
  paloma: 'bird', herramienta: 'wrench', radio: 'radio', matraz: 'flask-conical', lenguas: 'languages',
  reloj: 'clock', avion: 'plane', puerta: 'door-open', microfono: 'mic', iglesia: 'church',
  palmera: 'tree-palm', amanecer: 'sunrise', agua: 'waves', gota: 'droplet', cuna: 'baby',
  cadena: 'unlink', voz: 'megaphone', trebol: 'clover', muro: 'brick-wall', escudo: 'shield',
  mapa: 'map', ruta: 'route', play: 'play', pausa: 'pause', siguiente: 'chevron-right',
  anterior: 'chevron-left', cerrar: 'x', buscar: 'search', compartir: 'share-2', sonido: 'volume-2',
  silencio: 'volume-x', pin: 'map-pin', reloj2: 'hourglass', menu: 'menu', flecha: 'arrow-right',
  arriba: 'arrow-up', enlace: 'link', cita: 'quote', biblia: 'book-marked', ojo: 'eye',
  usuarios: 'users', mundo: 'earth', expandir: 'maximize-2', reiniciar: 'rotate-ccw', check: 'check',
  info: 'info', copiar: 'copy', filtro: 'sliders-horizontal', estrellas: 'sparkles', calendario: 'calendar-days',
};

// Íconos propios (mismo estilo: trazo, 24x24)
const propios = {
  tablas: '<path d="M3.5 20.5V9a4.25 4.25 0 0 1 8.5 0v11.5z"/><path d="M12 20.5V9a4.25 4.25 0 0 1 8.5 0v11.5z"/><path d="M6.2 11.5h3.1M6.2 14.5h3.1M6.2 17.5h3.1M14.7 11.5h3.1M14.7 14.5h3.1M14.7 17.5h3.1"/>',
  leon: '<path d="M12 3.2l1.6 1.6 2.2-.6.6 2.2 2.2.6-.6 2.2 1.6 1.6-1.6 1.6.6 2.2-2.2.6-.6 2.2-2.2-.6L12 20.8l-1.6-1.6-2.2.6-.6-2.2-2.2-.6.6-2.2L4.4 12 6 10.4l-.6-2.2 2.2-.6.6-2.2 2.2.6z"/><circle cx="12" cy="12.4" r="4.4"/><path d="M10.4 11.6h.01M13.6 11.6h.01"/><path d="M11 14.2l1 .8 1-.8"/>',
  arpa: '<path d="M5 21V4"/><path d="M5 4c5-.6 9.6 1.6 13 4.4L8.8 21H4"/><path d="M8.5 4.6v14.8M11.5 5.6v10.1M14.5 6.9v5.2"/>',
  trompeta: '<path d="M2.5 12h11"/><path d="M13.5 9v6l8 3.5v-13z"/><path d="M2.5 10v4"/><path d="M6.5 12v3.2h4V12"/>',
  antorcha: '<path d="M12 2.5c1.9 2.2 3.4 3.8 3.4 5.9a3.4 3.4 0 0 1-6.8 0c0-1.4.7-2.5 1.5-3.4.2 1 .8 1.7 1.5 1.9-.4-1.5-.2-2.9.4-4.4z"/><path d="M7.5 12.5h9l-2 2.5h-5z"/><path d="M10.2 15l.8 6.5h2l.8-6.5"/>',
  herradura: '<path d="M6.5 20V11a5.5 5.5 0 0 1 11 0v9"/><path d="M4.5 20h4M15.5 20h4"/><path d="M8.6 8.4h.01M15.4 8.4h.01M7.8 12.4h.01M16.2 12.4h.01M7.8 16.4h.01M16.2 16.4h.01"/>',
  pulpito: '<path d="M4.5 9.5h15l-2 4h-11z"/><path d="M7.5 13.5v7h9v-7"/><path d="M5.5 20.5h13"/><path d="M8.5 9.5L12 7.5l3.5 2"/><path d="M12 3v2.5M10.8 4.2h2.4"/>',
  farol: '<path d="M12 2v2M9 4h6"/><ellipse cx="12" cy="12" rx="6" ry="7"/><path d="M12 5v14M9.1 5.8c-1.6 3.8-1.6 8.6 0 12.4M14.9 5.8c1.6 3.8 1.6 8.6 0 12.4"/><path d="M9 20h6M12 20v2"/>',
  rejas: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 3v18M12 3v18M16 3v18M4 9h16"/>',
  piedra: '<path d="M2.5 20.5c.5-3 2.5-4.6 5-4.6s4.5 1.6 5 4.6z"/><path d="M11.5 20.5c.4-2.4 2-3.7 4-3.7s3.6 1.3 4 3.7z"/><path d="M6.8 13.2c.3-2.6 2.1-4.1 4.3-4.1s4 1.5 4.4 4.1"/><path d="M1.5 20.5h21"/>',
  faro: '<path d="M10 8h4l1.6 13h-7.2z"/><path d="M9 8l3-3 3 3"/><path d="M12 2.5V5"/><path d="M3.5 9.5l4-1M20.5 9.5l-4-1M3.5 5l4 1.4M20.5 5l-4 1.4"/><path d="M5.5 21h13"/><path d="M9.6 12.5h4.8M9.2 16.5h5.6"/>',
  lampara: '<path d="M3.5 14.6c0-1.9 3.6-3.3 8.2-3.3 2.9 0 5 .6 6.5 1.6l2.6-1.1-1.4 2.7c-1.4 1.9-4.2 3.1-7.6 3.1-4.7 0-8.3-1.1-8.3-3z"/><path d="M3.5 14.6c-1.7 0-2.1-2.1 0-2.6"/><path d="M20.8 6.5c-1 .9-1.3 1.8-.6 2.5.7.6 1.7.1 1.7-.9 0-.7-.5-1.2-1.1-1.6z"/><path d="M10.6 13h2.4"/>',
  cruz: '<path d="M10 2.5h4v5.5h5v4h-5v9.5h-4V12H5V8h5z"/>',
};

const extract = (name) => {
  const svg = readFileSync(join(lucideDir, `${name}.svg`), 'utf8');
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
  return inner.replace(/\s*\n\s*/g, '').replace(/\s*\/>/g, '/>').trim();
};

const icons = {};
for (const [k, v] of Object.entries(lucide)) icons[k] = extract(v);
Object.assign(icons, propios);

const header = `/* Emblemas del portal Generales de Dios. Generado por tools/build-icons.mjs — no editar a mano.
 * Incluye íconos de Lucide (https://lucide.dev), licencia ISC:
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 * All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee
 * is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE.
 * Íconos propios (tablas, león, arpa, trompeta, antorcha, herradura, púlpito, farol, rejas, piedras, faro,
 * lámpara, cruz): creados para este portal. */\n`;
writeFileSync(join(here, '../assets/js/icons.js'), `${header}window.GD_ICONS=${JSON.stringify(icons)};\n`);
console.log('icons.js', Object.keys(icons).length, 'íconos');
