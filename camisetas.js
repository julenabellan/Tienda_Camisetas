// camisetas.js — DISEÑO DE CAMISETAS
// Dibuja cada camiseta en SVG: cuello, escudo, marcas, logos, rayas y la imagen final (kitImage).
// Solo dibujo: no toca el estado del juego.
'use strict';

let svgCount = 0;
// ---------- Dibujo de camisetas ----------
function collarSVG(kit) {
  const c1 = kit.c1, c2 = kit.c2;
  if (kit.collar === 'v') return `<path d="M70 20 L100 56 L130 20" fill="none" stroke="${c2}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (kit.collar === 'polo') return `<path d="M70 20 Q100 40 130 20" fill="none" stroke="${c2}" stroke-width="5"/>` +
    `<path d="M70 20 L88 46 L100 36 L112 46 L130 20" fill="${c1}" stroke="${c2}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M100 36 V60" stroke="${c2}" stroke-width="2"/><circle cx="100" cy="50" r="1.8" fill="${c2}"/>`;
  return `<path d="M70 20 Q100 44 130 20" fill="none" stroke="${c2}" stroke-width="6" stroke-linecap="round"/>`;
}

// Escudo: en las selecciones, la bandera (emoji) directamente sobre la camiseta; en los clubes, el círculo de siempre
function crestSVG(kit) {
  // con rayas, el escudo queda a la misma distancia del centro que el logo, pero en el lado opuesto
  const cx = kit.pattern === 'stripes' ? 200 - logoSpot(kit).cx : 125 + SPREAD;
  // con rayas el escudo cae sobre una raya c2: se rellena con un color que contraste (nunca el de la raya)
  const fill = kit.pattern === 'stripes' ? inkOn(kit.c2, kit.c1) : kit.c2;
  if (kit.nat && kit.flag) {
    return `<text x="${cx}" y="67.5" font-size="17" text-anchor="middle" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${kit.flag}</text>`;
  }
  return `<circle cx="${cx}" cy="62" r="6.5" fill="${fill}" stroke="rgba(0,0,0,.3)"/>`;
}

// ---------- Detalles de marca ----------
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const inkOn = (bg, pref) => (Math.abs(lum(bg) - lum(pref)) > 0.3 ? pref : (lum(bg) > 0.55 ? '#111111' : '#FFFFFF'));

// Detalles en mangas y hombros (se dibujan dentro del recorte de la camiseta)
function brandTrim(kit) {
  const onSleeves = kit.pattern === 'sleeves' || kit.pattern === 'yoke';
  const ink = inkOn(onSleeves ? kit.c2 : kit.c1, onSleeves ? kit.c1 : kit.c2);
  const X = (x, m) => (m ? 200 - x : x);
  const sides = fn => fn(false) + fn(true);
  // rayas del hombro al puño (la manga va de (70,20)-(40,32) a (34,92)-(8,70))
  const stripes = (ts, w) => sides(m => ts.map(t =>
    `<line x1="${X(70 - 30 * t, m)}" y1="${20 + 12 * t}" x2="${X(34 - 26 * t, m)}" y2="${92 - 22 * t}" stroke="${ink}" stroke-width="${w}"/>`).join(''));
  // cinta de rombos junto al puño
  const tape = (dash, w) => sides(m =>
    `<line x1="${X(37.7, m)}" y1="86" x2="${X(11.7, m)}" y2="64" stroke="${ink}" stroke-width="${w}" stroke-dasharray="${dash}"/>`);
  // chevrones apuntando al hombro
  const chev = (cx, cy, m) => `<polyline points="${X(cx + 5.2, m)},${cy + 6.8} ${X(cx + 1.6, m)},${cy - 2.55} ${X(cx - 8.4, m)},${cy - 1.7}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linejoin="miter"/>`;
  switch (kit.brand) {
    case 'Adidas': return stripes([0.3, 0.5, 0.7], 2.6);
    case 'Asics': return stripes([0.42, 0.58], 2.4);
    case 'Umbro': return tape('4.5 2.5', 3.4);
    case 'Kappa': return tape('2 2', 3);
    case 'Hummel': return sides(m => chev(42.1, 46.9, m) + chev(35.3, 57.9, m));
    case 'Puma': return sides(m => `<path d="M${X(57, m)} 25 Q${X(36, m)} 46 ${X(20, m)} 82" fill="none" stroke="${ink}" stroke-width="5"/>`);
    default: return '';
  }
}

// Logos en PNG por marca (carpeta Logos/, ruta relativa a index.html).
// Algunas marcas cambian de logo según el año de la camiseta.
// El PNG se tiñe con el color de la tinta de la camiseta (alfa del PNG + color), así que debe tener fondo transparente.
function brandLogoSrc(kit) {
  const y = kit.year;
  switch (kit.brand) {
    case 'Adidas': return 'Logos/' + (y < 1990 ? 'Adidas2' : y <= 2023 ? 'Adidas3' : 'Adidas') + '.png';
    case 'Nike': return 'Logos/' + (y < 1990 ? 'Nike2' : 'Nike') + '.png';
    case 'Puma': return 'Logos/Puma.png';
    case 'Umbro': return 'Logos/Umbro.png';
    case 'Kappa': return 'Logos/' + (y <= 2006 ? 'Kappa' : 'Kappa1') + '.png';
    case 'Asics': return 'Logos/Asics.png';
    default: return '';
  }
}

// Bajada del logo en el pecho (unidades del dibujo; súbelo o bájalo a tu gusto)
const LOGO_DY = 4;
// Tamaño del logo (ancho x alto)
const LOGO_W = 28, LOGO_H = 19.5;

// Rayas verticales: ancho de la raya, separación entre el inicio de una y la siguiente, y posición de la primera
// (hueco de color base centrado en la camiseta; separación mayor = más sitio para el logo)
const STRIPE_W = 18, STRIPE_STEP = 36;
// Tamaño del logo cuando va sobre una raya: siempre más pequeño que la raya (margen a cada lado)
const STRIPE_LOGO = STRIPE_W - 3;
// Separación sutil entre logo y escudo: cada uno se aparta SPREAD unidades del centro (logo a la izquierda, escudo a la derecha)
const SPREAD = 3;
const STRIPE_X0 = 100 - STRIPE_STEP / 2 - STRIPE_W / 2 - STRIPE_STEP * 3; // → hueco de color base justo en el centro (x=100)

// Rayas [x, ancho]: las dos del centro (las del logo y el escudo) se apartan SPREAD del centro y las laterales
// contiguas se estrechan SPREAD por el lado interior, para que la separación entre rayas siga igual.
function stripeRects() {
  const out = [];
  for (let x = STRIPE_X0; x < 200; x += STRIPE_STEP) {
    const c = x + STRIPE_W / 2, d = Math.abs(c - 100), left = c < 100;
    if (d < STRIPE_STEP) out.push([left ? x - SPREAD : x + SPREAD, STRIPE_W]);                          // centrales
    else if (d < STRIPE_STEP * 2) out.push([left ? x : x + SPREAD, STRIPE_W - SPREAD]);                  // laterales
    else out.push([x, STRIPE_W]);
  }
  return out;
}

// Sitio del logo: centro y color del fondo sobre el que queda.
// Por defecto, pecho derecho; con rayas se centra dentro de una raya (la más cercana), más ancha que el logo.
function logoSpot(kit) {
  const spot = { cx: 81 - SPREAD, cy: 58 + LOGO_DY, bg: kit.c1, w: LOGO_W, h: LOGO_H, k: 1 };
  if (kit.pattern === 'stripes') {
    // el logo va siempre centrado DENTRO de una raya c2 (la más cercana al pecho) y encogido para que quepa
    let bestX = null;
    stripeRects().forEach(([x, w]) => {
      const cx = x + w / 2;
      if (bestX === null || Math.abs(cx - 81) < Math.abs(bestX - 81)) bestX = cx;
    });
    spot.cx = bestX; spot.bg = kit.c2;
    spot.w = STRIPE_LOGO; spot.h = STRIPE_LOGO; spot.k = STRIPE_LOGO / LOGO_W;
  } else if (kit.pattern === 'sash') {
    // banda diagonal c2 de (58,24) a (150,172): el logo cae encima de ella, así que se centra en su eje,
    // se encoge para que no se salga por los bordes y se tiñe contrastando con la banda (no con el fondo base)
    const SASH_K = 0.76;
    spot.cx = 58 + 92 * (spot.cy - 24) / 148;
    spot.bg = kit.c2;
    spot.k = SASH_K; spot.w = LOGO_W * SASH_K; spot.h = LOGO_H * SASH_K;
  } else if (kit.pattern === 'hoops') {
    // franjas c2: y = 24 + 26n (13 de alto); franjas c1 entre medias
    let best = null;
    for (let y = 24 - 26; y < 190; y += 13) {
      const cy = y + 6.5, isC2 = ((y - 24) / 13) % 2 === 0;
      if (!best || Math.abs(cy - spot.cy) < Math.abs(best.cy - spot.cy)) best = { cy, bg: isC2 ? kit.c2 : kit.c1 };
    }
    spot.cy = best.cy; spot.bg = best.bg;
  }
  return spot;
}

// Logo de la marca en el pecho (lado derecho del jugador)
function brandLogo(kit, id) {
  const spot = logoSpot(kit);
  const other = spot.bg === kit.c1 ? kit.c2 : kit.c1;
  const ink = inkOn(spot.bg, other);
  const drawn = brandLogoDrawn(kit, ink);
  const src = brandLogoSrc(kit);
  const move = `translate(${spot.cx} ${spot.cy}) scale(${spot.k}) translate(-81 -58)`;
  if (!src) return `<g transform="${move}">${drawn}</g>`;
  // si el PNG no carga, se muestra el dibujo de siempre (y se avisa en la consola con el nombre del archivo)
  return `<g><g style="display:none" transform="${move}">${drawn}</g>` +
    `<filter id="${id}b" color-interpolation-filters="sRGB"><feFlood flood-color="${ink}"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    `<image href="${src}" x="${spot.cx - spot.w / 2}" y="${spot.cy - spot.h / 2}" width="${spot.w}" height="${spot.h}" preserveAspectRatio="xMidYMid meet" filter="url(#${id}b)" ` +
    `onerror="console.warn('Logo no encontrado:','${src}');this.parentNode.firstElementChild.style.display='';this.remove()"/></g>`;
}

// Logo dibujado a mano (se usa si la marca no tiene PNG o si el PNG falla)
function brandLogoDrawn(kit, inkOverride) {
  const ink = inkOverride || inkOn(kit.c1, kit.c2);
  switch (kit.brand) {
    case 'Adidas': return `<path d="M72 64 L75 60 M76 64 L80 57 M80.5 64 L85.5 54" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'Nike': return `<path d="M71 59 C75 65 82 64 90 56 C83 60 77 61 71 59 Z" fill="${ink}"/>`;
    case 'Umbro': return `<path d="M71 61 l4 -4 4 4 -4 4 Z M77 61 l4 -4 4 4 -4 4 Z" fill="${ink}"/>`;
    case 'Kappa': return `<circle cx="74.5" cy="59.5" r="2.4" fill="${ink}"/><circle cx="81.5" cy="59.5" r="2.4" fill="${ink}"/><rect x="72" y="63" width="12" height="2" rx="1" fill="${ink}"/>`;
    case 'Puma': return `<path d="M71 64 C74 56 82 53 90 58 C83 57 77 59 71 64 Z" fill="${ink}"/>`;
    case 'Hummel': return `<path d="M72 64 l5 -5 5 5 M72 59 l5 -5 5 5" fill="none" stroke="${ink}" stroke-width="1.8"/>`;
    case 'Lotto': return `<path d="M73 56 h10 l-5 10 Z" fill="${ink}"/>`;
    default: return `<rect x="73" y="58" width="10" height="3" rx="1.5" fill="${kit.c2}"/>`;
  }
}

function shirtSVG(kit) {
  const id = 'cl' + (svgCount++);
  const body = 'M70 20 L40 32 L8 70 L34 92 L52 78 L52 180 L148 180 L148 78 L166 92 L192 70 L160 32 L130 20 Q100 44 70 20 Z';
  const c1 = kit.c1, c2 = kit.c2;
  let pat = '';
  switch (kit.pattern) {
    case 'stripes':
      stripeRects().forEach(([x, w]) => { pat += `<rect x="${x}" y="0" width="${w}" height="200" fill="${c2}"/>`; });
      // en las de Adidas, las mangas van lisas (color base) para que las 3 rayas de la marca, de color contrastado, se vean limpias
      if (kit.brand === 'Adidas') pat += `<rect x="0" y="0" width="52" height="100" fill="${c1}"/><rect x="148" y="0" width="52" height="100" fill="${c1}"/>`;
      break;
    case 'hoops':
      for (let y = 24; y < 190; y += 26) pat += `<rect x="0" y="${y}" width="200" height="13" fill="${c2}"/>`;
      // en las de Adidas, igual que con rayas verticales: mangas lisas (color base) y las 3 rayas de la marca en el otro color
      if (kit.brand === 'Adidas') pat += `<rect x="0" y="0" width="52" height="100" fill="${c1}"/><rect x="148" y="0" width="52" height="100" fill="${c1}"/>`;
      break;
    case 'halves':
      pat = `<rect x="0" y="0" width="100" height="200" fill="${c2}"/>`;
      break;
    case 'sash':
      pat = `<line x1="58" y1="24" x2="150" y2="172" stroke="${c2}" stroke-width="28"/>`;
      break;
    case 'sleeves':
      pat = `<rect x="0" y="0" width="52" height="120" fill="${c2}"/><rect x="148" y="0" width="52" height="120" fill="${c2}"/>`;
      break;
    case 'band':
      pat = `<rect x="0" y="78" width="200" height="28" fill="${c2}"/>`;
      break;
    case 'vband':
      pat = `<rect x="86" y="0" width="28" height="200" fill="${c2}"/>`;
      break;
    case 'chevron':
      pat = `<polyline points="52,92 100,128 148,92" fill="none" stroke="${c2}" stroke-width="14"/>` +
            `<polyline points="52,122 100,158 148,122" fill="none" stroke="${c2}" stroke-width="14"/>`;
      break;
    case 'zigzag':
      for (let y = 62; y < 190; y += 34) {
        let pts = '';
        for (let x = -10, up = 0; x <= 210; x += 22, up ^= 1) pts += `${x},${y + (up ? -11 : 11)} `;
        pat += `<polyline points="${pts}" fill="none" stroke="${c2}" stroke-width="11" stroke-linejoin="miter"/>`;
      }
      break;
    case 'graphic': {
      const c3 = kit.c3 || c2;
      pat = `<polygon points="-10,210 70,84 150,210" fill="${c2}" opacity=".92"/><polygon points="70,210 150,56 210,160 210,210" fill="${c3}" opacity=".92"/>` +
            `<polygon points="-10,-10 84,-10 -10,64" fill="${c3}"/><polygon points="116,-10 210,-10 210,40" fill="${c2}" opacity=".9"/>`;
      break;
    }
    case 'pinstripes':
      for (let x = 3, i = 0; x < 200; x += 9, i++) pat += `<rect x="${x}" y="0" width="2.4" height="200" fill="${i % 2 ? kit.c3 : c2}"/>`;
      break;
    case 'zigband': {
      let pts = '';
      for (let x = -10, up = 0; x <= 210; x += 20, up ^= 1) pts += `${x},${98 + (up ? -12 : 12)} `;
      pat = `<polyline points="${pts}" fill="none" stroke="${kit.c3}" stroke-width="20" stroke-linejoin="miter"/>` +
            `<polyline points="${pts}" fill="none" stroke="${c2}" stroke-width="13" stroke-linejoin="miter"/>`;
      break;
    }
    case 'vtri':
      pat = [c2, kit.c3, kit.c4].map((col, i) =>
        `<polyline points="-10,${64 + i * 13} 100,${132 + i * 13} 210,${64 + i * 13}" fill="none" stroke="${col}" stroke-width="12" stroke-linejoin="miter"/>`).join('');
      break;
    case 'yoke':
      pat = `<path d="M0 0 H200 V64 L100 96 L0 64 Z" fill="${c2}"/>`;
      break;
    case 'wave':
      for (let y = 56; y < 190; y += 34) pat += `<path d="M-5 ${y} Q22 ${y - 16} 50 ${y} T105 ${y} T160 ${y} T215 ${y}" fill="none" stroke="${c2}" stroke-width="11"/>`;
      break;
    case 'cross':
      pat = `<rect x="84" y="0" width="32" height="200" fill="${c2}"/><rect x="0" y="82" width="200" height="30" fill="${c2}"/>` +
            `<rect x="91" y="0" width="18" height="200" fill="${kit.c3 || c1}"/><rect x="0" y="89" width="200" height="16" fill="${kit.c3 || c1}"/>`;
      break;
    case 'checks':
      for (let y = 0; y < 200; y += 25) for (let x = (y / 25) % 2 ? 0 : 25; x < 200; x += 50) pat += `<rect x="${x}" y="${y}" width="25" height="25" fill="${c2}"/>`;
      break;
    default: break;
  }
  return `<svg class="shirt" viewBox="0 0 200 200" role="img" aria-label="Camiseta ${kit.team} ${kit.year}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="${id}"><path d="${body}"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
        <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".18"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#${id})">
      <rect width="200" height="200" fill="${c1}"/>
      ${pat}
      ${brandTrim(kit)}
      <rect width="200" height="200" fill="url(#${id}g)"/>
    </g>
    ${collarSVG(kit)}
    <path d="M8 70 L34 92 M192 70 L166 92" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
    ${crestSVG(kit)}
    ${brandLogo(kit, id)}
    <path d="M52 168 H148 M60 100 Q70 130 62 160 M140 100 Q130 130 138 160" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="3"/>
    <path d="${body}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

function kitImage(kit) {
  if (kit.img) return `<img src="${kit.img}" alt="Camiseta ${kit.team} ${kit.year}" data-kit="${kit.id}" loading="lazy">`;
  return shirtSVG(kit);
}

document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset.kit) {
    const tmp = document.createElement('div');
    tmp.innerHTML = shirtSVG(KIT_BY_ID[t.dataset.kit]);
    t.replaceWith(tmp.firstElementChild);
  }
}, true);
