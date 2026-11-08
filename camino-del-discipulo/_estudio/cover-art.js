// Ilustración de portada reutilizable (SVG string). viewBox 600x870
window.coverArt = function (opts) {
  opts = opts || {};
  return `
<svg viewBox="0 0 600 870" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
  <defs>
    <linearGradient id="cv-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1429"/><stop offset=".45" stop-color="#1d3260"/>
      <stop offset=".62" stop-color="#6b5a6e"/><stop offset=".72" stop-color="#d9a35a"/><stop offset="1" stop-color="#0b1429"/>
    </linearGradient>
    <radialGradient id="cv-sun" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff6dc"/><stop offset=".35" stop-color="#f6d58e"/><stop offset="1" stop-color="#f6d58e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cv-path" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#f6e3b4"/><stop offset="1" stop-color="#f6e3b4" stop-opacity=".15"/>
    </linearGradient>
    <linearGradient id="cv-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6e3b4"/><stop offset=".5" stop-color="#d4a94f"/><stop offset="1" stop-color="#a87b2c"/>
    </linearGradient>
    <filter id="cv-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter>
  </defs>
  <rect width="600" height="870" fill="url(#cv-sky)"/>
  <g opacity=".7" fill="#fff">
    <circle cx="80" cy="250" r="1.4"/><circle cx="510" cy="210" r="1.2"/><circle cx="430" cy="300" r="1"/><circle cx="150" cy="330" r="1"/>
    <circle cx="540" cy="350" r="1.3"/><circle cx="60" cy="400" r="1"/><circle cx="260" cy="230" r=".9"/><circle cx="350" cy="260" r="1.1"/>
  </g>
  <circle cx="300" cy="560" r="190" fill="url(#cv-sun)" opacity=".85"/>
  <g stroke="#f6e3b4" stroke-width="1.4" opacity=".35">
    ${Array.from({length:11},(_,i)=>{const a=Math.PI*(1+(i+1)/12);return `<line x1="${300+Math.cos(a)*120}" y1="${560+Math.sin(a)*120}" x2="${300+Math.cos(a)*300}" y2="${560+Math.sin(a)*300}"/>`}).join('')}
  </g>
  <!-- Montañas -->
  <path d="M0 600 L110 520 L180 565 L300 455 L420 560 L490 515 L600 590 V870 H0Z" fill="#22355f"/>
  <path d="M300 455 L330 482 L318 480 L300 470 L284 486 L270 484Z" fill="#f6e3b4" opacity=".55"/>
  <path d="M0 655 Q120 610 220 640 T420 630 T600 650 V870 H0Z" fill="#182848"/>
  <path d="M0 720 Q150 690 300 712 T600 706 V870 H0Z" fill="#111d38"/>
  <!-- Cruz en la cima -->
  <g fill="#fff6dc">
    <rect x="296.5" y="398" width="7" height="60" rx="1.5"/><rect x="281" y="413" width="38" height="6.5" rx="1.5"/>
  </g>
  <!-- Camino -->
  <path d="M232 870 C250 800 345 790 330 742 C318 700 262 700 282 655 C296 622 330 610 312 568 C303 540 298 500 300 470
           L304 470 C304 500 316 540 326 566 C346 612 312 626 298 656 C282 696 340 700 352 742 C370 800 300 810 330 870Z"
        fill="url(#cv-path)"/>
  <rect width="600" height="870" filter="url(#cv-grain)"/>
  ${opts.text === false ? '' : `
  <!-- Marco -->
  <rect x="22" y="22" width="556" height="826" fill="none" stroke="url(#cv-gold)" stroke-width="1.6" opacity=".8"/>
  <rect x="30" y="30" width="540" height="810" fill="none" stroke="url(#cv-gold)" stroke-width=".6" opacity=".5"/>
  <text x="300" y="118" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="600" font-size="34" letter-spacing="14" fill="#f6e3b4">EL CAMINO</text>
  <line x1="190" y1="140" x2="410" y2="140" stroke="url(#cv-gold)" stroke-width="1"/>
  <text x="300" y="196" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="58" letter-spacing="3" fill="url(#cv-gold)">DEL DISCÍPULO</text>
  <g transform="translate(300 792)" fill="url(#cv-gold)"><path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2Z"/></g>
  <line x1="200" y1="792" x2="280" y2="792" stroke="url(#cv-gold)" stroke-width=".8"/><line x1="320" y1="792" x2="400" y2="792" stroke="url(#cv-gold)" stroke-width=".8"/>`}
</svg>`;
};
