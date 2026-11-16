(() => {
  'use strict';

  // ---------- Configuración ----------
  const SAVE_KEY = 'camisetasRetroShop_v2';
  const GOAL = 5000;          // patrimonio objetivo
  const RENT = 12;            // alquiler diario
  const AUTH_COST = 15;       // coste de autenticar
  const REFRESH_COST = 10;    // coste de buscar más ofertas
  const LEVEL_XP = [0, 8, 25, 55, 100];
  const SIZES = { S: 0.9, M: 1, L: 1, XL: 0.92, XXL: 0.75 };
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];
  const SIZE_WEIGHTS = { S: 14, M: 34, L: 30, XL: 17, XXL: 5 };   // lo que aparece en el mercado
  const SIZE_DEMAND = { S: 12, M: 34, L: 32, XL: 16, XXL: 6 };    // lo que piden los clientes
  const SIZE_MISS = 0.55;     // prob. de que un cliente se vaya si solo tienes tallas vecinas
  const FEATURED_BASE = 3;    // camisetas destacables (+1 por ampliación)
  const CONDITIONS = [
    { id: 'nueva', label: 'Nueva con etiquetas', coef: 1.6, w: 8 },
    { id: 'excelente', label: 'Excelente', coef: 1.15, w: 27 },
    { id: 'buena', label: 'Buen estado', coef: 0.85, w: 40 },
    { id: 'usada', label: 'Muy usada', coef: 0.5, w: 25 },
  ];
  const COND = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

  let S = null;       // estado del juego
  let svgCount = 0;

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
  const nice = n => (n < 50 ? Math.round(n) : Math.round(n / 5) * 5);
  const kitOf = it => KIT_BY_ID[it.kitId];
  const title = it => `${kitOf(it).team} ${kitOf(it).year}`;

  function weighted(items, wf) {
    const total = items.reduce((s, x) => s + wf(x), 0);
    let r = Math.random() * total;
    for (const x of items) {
      r -= wf(x);
      if (r <= 0) return x;
    }
    return items[items.length - 1];
  }

  // ---------- Estado ----------
  function newGame() {
    S = {
      day: 1, money: 600, rep: 5, xp: 0, shelfCap: 10, upgrades: 0,
      stock: [], market: [], trends: {}, fakeBoost: 0, traffic: 0,
      pendingReturns: [], news: [], nextUid: 1, nextOffer: 1,
      stats: { sold: 0, profit: 0, revenue: 0 },
      goalReached: false, seenIntro: false, over: false,
      featured: [], view: { filter: 'all', sort: 'manual', mode: 'cards', v3: true }, marketSort: 'ganga', sizeLost: {},
    };
    S.market = genMarket();
    S.news.unshift({ day: 1, text: 'Abres la tienda. Compra barato, vende bien y cuida tu reputación.' });
    return S;
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.stock && s.market ? s : null;
    } catch (e) { return null; }
  }

  // ---------- Valoración ----------
  function level() { return LEVEL_XP.filter(x => S.xp >= x).length; }

  function addXP(n) {
    const before = level();
    S.xp += n;
    if (level() > before) toast(`Tu ojo mejora: nivel ${level()}. Tus valoraciones son más precisas.`);
  }

  function trendMult(kit) {
    let m = (S.trends[kit.team] && S.trends[kit.team].mult) || 1;
    if (kit.nat) m *= (S.trends.__nat && S.trends.__nat.mult) || 1;
    return m;
  }

  function valueIfReal(it) {
    const kit = kitOf(it);
    return kit.base * COND[it.cond].coef * SIZES[it.size] * (it.special ? 2.2 : 1) * trendMult(kit);
  }
  const replicaValue = it => Math.max(4, valueIfReal(it) * 0.08);
  const trueValue = it => (it.real ? valueIfReal(it) : replicaValue(it));
  const perceivedValue = it => (!it.real && it.verified ? replicaValue(it) : valueIfReal(it));

  function estimate(it) {
    const err = Math.max(0.08, 0.36 - 0.07 * (level() - 1));
    const mid = perceivedValue(it) * (1 + it.bias * err * 0.6);
    return { low: mid * (1 - err), high: mid * (1 + err), mid };
  }

  function netWorth() {
    return S.money + S.stock.reduce((s, it) => s + estimate(it).mid, 0);
  }


  // ---------- Fama y colección ----------
  // Cada camiseta que tienes aporta puntos de fama; si la vendes, la tienda pierde esos puntos.
  const FAME_BASE = { 1: 0.5, 2: 1, 3: 3, 4: 8 };                          // por rareza
  const FAME_COND = { nueva: 1.25, excelente: 1.1, buena: 1, usada: 0.6 };  // por estado
  const FAME_TIERS = [
    { min: 0, name: 'Tienda de barrio', income: 0 },
    { min: 6, name: 'Conocida en el barrio', income: 0 },
    { min: 18, name: 'Referente local', income: 4 },
    { min: 40, name: 'Templo retro', income: 10 },
    { min: 75, name: 'Museo del fútbol', income: 20 },
    { min: 120, name: 'Leyenda mundial', income: 35 },
  ];
  const COLLECTIONS = [
    { id: 'legend', icon: '👑', name: 'Leyendas', desc: '3 camisetas legendarias', need: 3, bonus: 8,
      count: l => l.filter(x => kitOf(x.it).rarity === 4).length },
    { id: 'n90', icon: '📼', name: 'Años 90', desc: '5 camisetas de 1990-1999', need: 5, bonus: 4,
      count: l => l.filter(x => { const y = kitOf(x.it).year; return y >= 1990 && y <= 1999; }).length },
    { id: 'nat', icon: '🌍', name: 'Selecciones', desc: '4 selecciones distintas', need: 4, bonus: 4,
      count: l => new Set(l.filter(x => kitOf(x.it).nat).map(x => kitOf(x.it).team)).size },
    { id: 'gk', icon: '🧤', name: 'Porteros', desc: '2 camisetas de portero', need: 2, bonus: 3,
      count: l => l.filter(x => kitOf(x.it).type === 'Portero').length },
    { id: 'club', icon: '🏟️', name: 'Fondo de club', desc: '3 camisetas del mismo equipo', need: 3, bonus: 4,
      count: l => { const m = {}; l.forEach(x => { const t = kitOf(x.it).team; m[t] = (m[t] || 0) + 1; }); return Math.max(0, ...Object.values(m)); } },
    { id: 'signed', icon: '✍️', name: 'Firmadas', desc: '2 camisetas firmadas', need: 2, bonus: 5,
      count: l => l.filter(x => x.it.special).length },
  ];

  function fameOf(it) {
    const kit = kitOf(it);
    const auth = it.verified ? (it.real ? 1 : 0) : 0.5;     // sin verificar cuenta la mitad; una réplica no suma
    return FAME_BASE[kit.rarity] * FAME_COND[it.cond] * (it.special ? 2 : 1) * auth * (S.featured.includes(it.uid) ? 1.5 : 1);
  }

  function fame() {
    const items = S.stock.map(it => ({ it, pts: fameOf(it) }));
    const valid = items.filter(x => x.pts > 0);
    const sets = COLLECTIONS.map(c => { const n = c.count(valid); return { ...c, n, done: n >= c.need }; });
    const base = items.reduce((a, x) => a + x.pts, 0);
    const bonus = sets.reduce((a, c) => a + (c.done ? c.bonus : 0), 0);
    const score = Math.round(base + bonus);
    let tier = 0;
    FAME_TIERS.forEach((t, i) => { if (score >= t.min) tier = i; });
    return { score, tier, items, sets, base, bonus, next: FAME_TIERS[tier + 1] || null };
  }

  // ---------- Generación ----------
  function genItem() {
    const ft = fame().tier;   // con fama, los vendedores te traen más piezas raras
    const kit = weighted(KITS, x => ({ 1: 10, 2: 6, 3: 3, 4: 1.3 })[x.rarity] * (x.rarity >= 3 ? 1 + 0.2 * ft : 1));
    const fakeChance = 0.08 + 0.05 * (kit.rarity - 1) + (S.fakeBoost > 0 ? 0.2 : 0);
    return {
      uid: S.nextUid++,
      kitId: kit.id,
      cond: weighted(CONDITIONS, c => c.w).id,
      size: weighted(Object.keys(SIZES), s => SIZE_WEIGHTS[s]),
      real: Math.random() > fakeChance,
      special: Math.random() < 0.03,
      verified: false,
      paid: 0,
      listPrice: 0,
      bias: rand(-1, 1),
    };
  }

  function genOffer() {
    const item = genItem();
    const sid = weighted(Object.keys(SELLERS), id => SELLER_WEIGHTS[id]);
    const s = SELLERS[sid];
    const ask = Math.max(3, nice(valueIfReal(item) * rand(s.ask[0], s.ask[1])));
    return {
      id: S.nextOffer++,
      item,
      seller: sid,
      name: pick(NAMES),
      ask,
      floor: Math.max(2, Math.round(ask * rand(s.floor[0], s.floor[1]))),
      patience: s.patience + (S.rep >= 40 ? 1 : 0),
      maxPat: s.patience + (S.rep >= 40 ? 1 : 0),
      used: {},
    };
  }

  function genMarket() {
    const n = clamp(6 + Math.floor(S.rep / 30), 6, 10);
    return Array.from({ length: n }, genOffer);
  }

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

  // ---------- Plantillas ----------
  function stars(r) { return '★'.repeat(r) + '☆'.repeat(4 - r); }

  function eraLabel(kit) { return kit.year <= 2000 ? 'Retro' : kit.year <= 2010 ? 'Clásica' : 'Moderna'; }

  function authChip(it) {
    if (!it.verified) return '<span class="chip warn">? Sin verificar</span>';
    return it.real ? '<span class="chip good">✔ Auténtica</span>' : '<span class="chip bad">✖ Réplica</span>';
  }

  function trendChip(kit) {
    const m = trendMult(kit);
    if (m >= 1.1) return '<span class="chip hot">🔥 En alza</span>';
    if (m <= 0.9) return '<span class="chip cold">📉 A la baja</span>';
    return '';
  }

  function fameChip(it) {
    const p = Math.round(fameOf(it) * 10) / 10;
    return p >= 1 ? `<span class="chip fame" title="Puntos de fama que aporta a tu tienda">🏛️ +${p}</span>` : '';
  }

  function estimateText(it) {
    const e = estimate(it);
    return `${fmt(e.low)} – ${fmt(e.high)}`;
  }

  const COND_SHORT = { nueva: 'Nueva', excelente: 'Excelente', buena: 'Buena', usada: 'Usada' };

  function itemHead(it) {
    const kit = kitOf(it);
    const status = [authChip(it), trendChip(kit), S.stock.includes(it) ? fameChip(it) : ''].join('');
    return `
      <div class="thumb">${kitImage(kit)}${it.special ? '<span class="signed">Firmada</span>' : ''}</div>
      <div class="info">
        <h3>${kit.team} ${kit.year}</h3>
        <p class="sub">${kit.type} · ${kit.brand}</p>
        <div class="specs">
          <div class="spec"><small>Época</small><b>${eraLabel(kit)}</b></div>
          <div class="spec rar" title="${RARITY_LABELS[kit.rarity]}"><small>Rareza</small><b>${stars(kit.rarity)}</b></div>
          <div class="spec size"><small>Talla</small><b>${it.size}</b></div>
          <div class="spec" title="${COND[it.cond].label}"><small>Estado</small><b>${COND_SHORT[it.cond] || COND[it.cond].label}</b></div>
        </div>
        ${status.trim() ? `<div class="chips status">${status}</div>` : ''}
        <p class="est"><span>Valoración</span><b>${estimateText(it)}</b></p>
      </div>`;
  }

  const sizeCount = z => S.stock.filter(i => i.size === z).length;

  // Tarjeta del mercado: menos datos y más visual (rareza y precio sobre la camiseta, vendedor como pie)
  function marketCard(o) {
    const it = o.item;
    const kit = kitOf(it);
    const s = SELLERS[o.seller];
    const est = estimate(it);
    const ganga = o.ask <= est.mid * 0.6;
    const flags = [
      it.special ? '<span class="signed">Firmada</span>' : '',
      ganga ? '<span class="deal">🔥 Posible ganga</span>' : '',
      sizeCount(it.size) === 0 ? `<span class="deal need">🧩 Te falta la ${it.size}</span>` : '',
    ].join('');
    return `
      <article class="card mcard r${kit.rarity}" data-offer="${o.id}">
        <div class="thumb mc-thumb">
          ${kitImage(kit)}
          <span class="mc-stars" title="${RARITY_LABELS[kit.rarity]}">${stars(kit.rarity)}</span>
          <div class="price-tag" aria-label="Precio pedido"><small>Pide</small>${fmt(o.ask)}</div>
          ${flags ? `<div class="mc-flags">${flags}</div>` : ''}
        </div>
        <div class="mc-body">
          <h3>${kit.team} ${kit.year}</h3>
          <p class="mc-sub">${kit.type} · ${kit.brand}</p>
          <div class="mc-pills"><span class="chip size">${it.size}</span><span class="chip">${COND_SHORT[it.cond] || COND[it.cond].label}</span>${authChip(it)}${trendChip(kit)}</div>
          <p class="mc-est">Valoración <b>${estimateText(it)}</b></p>
        </div>
        <div class="mc-seller"><span class="mc-avatar">${s.emoji}</span><span class="mc-who"><b>${o.name}</b><small>${s.label}</small></span></div>
        <div class="actions">
          <button class="btn" data-action="negotiate" data-id="${o.id}">Negociar</button>
          <button class="btn primary" data-action="buy" data-id="${o.id}">Comprar</button>
        </div>
      </article>`;
  }

  // ---------- Tienda: piezas reutilizables ----------
  const suggestedPrice = it => nice(estimate(it).mid * 1.2);
  const maxFeatured = () => FEATURED_BASE + S.upgrades;
  const itemAge = it => S.day - (it.since || S.day);

  function marginHTML(it) {
    const m = it.listPrice - it.paid;
    return `<b class="${m >= 0 ? 'pos' : 'loss'}">${m >= 0 ? '+' : ''}${fmt(m)}</b>`;
  }

  function starBtn(it, on) {
    const label = on ? 'Quitar del escaparate' : 'Poner en el escaparate';
    return `<button class="star${on ? ' on' : ''}" data-action="feature" data-uid="${it.uid}" aria-pressed="${on}" aria-label="${label}" title="${label}">★</button>`;
  }

  // pos = { first, last } cuando se puede reordenar; null si no
  function moveBtns(it, pos) {
    if (!pos) return '';
    return `<span class="mv">
      <button data-action="move" data-uid="${it.uid}" data-dir="-1" aria-label="Mover antes"${pos.first ? ' disabled' : ''}>◀</button>
      <button data-action="move" data-uid="${it.uid}" data-dir="1" aria-label="Mover después"${pos.last ? ' disabled' : ''}>▶</button></span>`;
  }

  const miniPrice = it => `<button class="price-btn mini" data-action="editprice" data-uid="${it.uid}" aria-label="Cambiar precio"><b>${fmt(it.listPrice)}</b><span>✎</span></button>`;
  const authBtn = (it, cls = '') => (it.verified ? '' : `<button class="btn ${cls}" data-action="auth" data-uid="${it.uid}">Autenticar (${fmt(AUTH_COST)})</button>`);

  // Tarjeta grande (vista «Tarjetas»)
  function shopCard(it, pos) {
    return `
      <article class="card shop-card r${kitOf(it).rarity}" data-uid="${it.uid}">
        ${starBtn(it, false)}
        <span class="rar-tag r${kitOf(it).rarity}">${RARITY_LABELS[kitOf(it).rarity]}</span>
        ${itemHead(it)}
        <p class="seller">Pagaste ${fmt(it.paid)} · Margen ${marginHTML(it)} · ${itemAge(it)} d</p>
        <button class="price-btn" data-action="editprice" data-uid="${it.uid}"><small>Tu precio</small><b>${fmt(it.listPrice)}</b><span>✎ Cambiar</span></button>
        <div class="actions">
          ${moveBtns(it, pos)}
          ${authBtn(it)}
          <button class="btn" data-action="suggest" data-uid="${it.uid}">Sugerido</button>
        </div>
      </article>`;
  }

  // Fila compacta (vista «Lista»)
  function shopRow(it, pos) {
    const kit = kitOf(it);
    return `
      <article class="row r${kit.rarity}" data-uid="${it.uid}">
        <div class="thumb">${kitImage(kit)}</div>
        <div class="row-main">
          <h3>${kit.team} ${kit.year} <small>${kit.type}</small></h3>
          <div class="chips"><span class="chip size">${it.size}</span><span class="chip">${COND[it.cond].label}</span>${authChip(it)}${trendChip(kit)}${fameChip(it)}</div>
          <p class="seller">Pagaste ${fmt(it.paid)} · ${marginHTML(it)} · ${itemAge(it)} d</p>
          ${authBtn(it, 'sm')}
        </div>
        <div class="row-side">
          ${miniPrice(it)}
          <div class="row-tools">${starBtn(it, false)}${moveBtns(it, pos)}</div>
        </div>
      </article>`;
  }

  // Pieza del escaparate (hero = pieza estrella, más grande)
  function shopTile(it, pos, hero) {
    const kit = kitOf(it);
    return `
      <article class="tile r${kit.rarity}${hero ? ' hero' : ''}" data-uid="${it.uid}">
        ${starBtn(it, true)}
        <span class="rar-tag r${kit.rarity}">${hero ? '⭐ ' : ''}${hero ? 'Pieza estrella' : RARITY_LABELS[kit.rarity]}</span>
        <div class="thumb">${kitImage(kit)}${it.special ? '<span class="signed">Firmada</span>' : ''}</div>
        <div class="plate">
          <h3>${kit.team} ${kit.year}</h3>
          <p class="sub">${kit.type} · Talla ${it.size} · ${COND[it.cond].label}${hero ? ` · ${RARITY_LABELS[kit.rarity]}` : ''}</p>
        </div>
        <div class="tile-price">${miniPrice(it)}</div>
        <div class="tile-foot">${moveBtns(it, pos)}<span class="seller">${marginHTML(it)}</span></div>
      </article>`;
  }

  // ---------- Tienda: organización ----------
  const FILTERS = [['all', 'Todo'], ['nat', 'Selecciones'], ['club', 'Clubes'], ['gk', 'Porteros'], ['rare', 'Raras'], ['unver', 'Sin verificar']];
  const SORTS = [['manual', 'Mi orden'], ['recent', 'Más recientes'], ['margin', 'Mayor margen'], ['price', 'Mayor precio'], ['year', 'Más antiguas'], ['team', 'Equipo A-Z']];

  const FILTER_TESTS = {
    nat: it => kitOf(it).nat && kitOf(it).type !== 'Portero',
    club: it => !kitOf(it).nat && kitOf(it).type !== 'Portero',
    gk: it => kitOf(it).type === 'Portero',
    rare: it => kitOf(it).rarity >= 3 || it.special,
    unver: it => !it.verified,
  };
  const SORT_FNS = {
    manual: () => 0,                                  // respeta el orden del array (el que tú pones)
    recent: (a, b) => b.uid - a.uid,
    margin: (a, b) => (b.listPrice - b.paid) - (a.listPrice - a.paid),
    price: (a, b) => b.listPrice - a.listPrice,
    year: (a, b) => kitOf(a).year - kitOf(b).year,
    team: (a, b) => title(a).localeCompare(title(b), 'es'),
  };

  const featuredItems = () => S.featured.map(uid => S.stock.find(i => i.uid === uid)).filter(Boolean);
  const shelfItems = () => S.stock
    .filter(it => !S.featured.includes(it.uid))
    .filter(FILTER_TESTS[S.view.filter] || (() => true))
    .sort(SORT_FNS[S.view.sort] || SORT_FNS.manual);

  function shopToolsHTML() {
    const chips = FILTERS.map(([f, l]) => `<button class="fchip${S.view.filter === f ? ' on' : ''}" data-action="filter" data-f="${f}">${l}</button>`).join('');
    const opts = SORTS.map(([v, l]) => `<option value="${v}"${S.view.sort === v ? ' selected' : ''}>${l}</option>`).join('');
    const compact = S.view.mode === 'compact';
    return `<div class="fchips">${chips}</div>
      <div class="tool-row">
        <label>Ordenar <select data-sort>${opts}</select></label>
        <div class="seg" role="group" aria-label="Vista">
          <button class="${compact ? '' : 'on'}" data-action="mode" data-mode="cards" aria-label="Vista de tarjetas">▦</button>
          <button class="${compact ? 'on' : ''}" data-action="mode" data-mode="compact" aria-label="Vista de lista">☰</button>
        </div>
        <button class="btn sm" data-action="suggestall">Precio sugerido a todo</button>
      </div>`;
  }

  function showcaseHTML() {
    const items = featuredItems();
    const slots = maxFeatured();
    const tiles = items.map((it, i) => shopTile(it, { first: i === 0, last: i === items.length - 1 }, false)).join('');
    const free = Math.max(0, slots - items.length);
    const empty = '<div class="slot"><span>👕</span><b>Hueco libre</b><small>Pulsa la ★ de una camiseta del almacén para exponerla aquí</small></div>'.repeat(free);
    const value = items.reduce((s, it) => s + it.listPrice, 0);
    const margin = items.reduce((s, it) => s + it.listPrice - it.paid, 0);
    const pts = Math.round(items.reduce((s, it) => s + fameOf(it), 0) * 10) / 10;
    const tierName = FAME_TIERS[fame().tier].name;
    return `<div class="sc-awning" aria-hidden="true"></div>
      <div class="sc-window">
        <div class="showcase-head">
          <div><h3>🪟 Escaparate</h3><small class="sc-tier">${tierName}</small></div>
          <div class="sc-meta"><span class="sc-boost" title="Las piezas del escaparate puntúan más fama">×1,5 fama</span><small>${items.length}/${slots} expuestas</small></div>
        </div>
        <div class="showcase-grid">${tiles}${empty}</div>
        <div class="sc-floor" aria-hidden="true"></div>
        <div class="sc-stats">
          <div><small>Valor expuesto</small><b>${fmt(value)}</b></div>
          <div><small>Margen potencial</small><b class="${margin >= 0 ? 'pos' : 'loss'}">${margin >= 0 ? '+' : ''}${fmt(margin)}</b></div>
          <div><small>Fama que aportan</small><b>🏛️ ${pts}</b></div>
        </div>
      </div>`;
  }

  // ---------- Acciones del escaparate y el orden ----------
  function toggleFeature(uid) {
    uid = Number(uid);
    if (S.featured.includes(uid)) {
      S.featured = S.featured.filter(x => x !== uid);
    } else {
      if (featuredItems().length >= maxFeatured()) { toast(`El escaparate está lleno (${maxFeatured()}). Amplía la tienda para destacar más.`); return; }
      S.featured.push(uid);
    }
    save(); renderAll();
  }

  function moveItem(uid, dir) {
    uid = Number(uid);
    dir = Number(dir);
    if (S.featured.includes(uid)) {
      const i = S.featured.indexOf(uid);
      const j = i + dir;
      if (j < 0 || j >= S.featured.length) return;
      [S.featured[i], S.featured[j]] = [S.featured[j], S.featured[i]];
    } else {
      // se mueve entre las camisetas que no están en el escaparate
      const shelf = S.stock.filter(x => !S.featured.includes(x.uid));
      const i = shelf.findIndex(x => x.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= shelf.length) return;
      const a = S.stock.indexOf(shelf[i]);
      const b = S.stock.indexOf(shelf[j]);
      [S.stock[a], S.stock[b]] = [S.stock[b], S.stock[a]];
    }
    save(); renderAll();
  }

  // ---------- Render ----------
  // Actualiza un número de la cabecera y lo "marca" con una animación solo si cambia
  function setStat(sel, value) {
    const el = $(sel);
    const v = String(value);
    if (el.textContent === v) return;
    el.textContent = v;
    if (el.dataset.ready) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    el.dataset.ready = '1';
  }

  function renderHeader(f = fame()) {
    setStat('#st-day', S.day);
    setStat('#st-money', fmt(S.money));
    setStat('#st-rep', S.rep);
    setStat('#st-level', level());
    setStat('#st-fame', f.score);
    $('#st-fame').parentElement.title = FAME_TIERS[f.tier].name;
    const nw = netWorth();
    $('#goal-fill').style.width = clamp(nw / GOAL * 100, 0, 100) + '%';
    $('#goal-text').textContent = `Patrimonio ${fmt(nw)} / ${fmt(GOAL)}`;
    $('#goal-pct').textContent = Math.round(clamp(nw / GOAL * 100, 0, 100)) + ' %';
  }

  const MSORTS = [['ganga', 'Mejores gangas'], ['price', 'Más baratas'], ['rare', 'Más raras'], ['need', 'Talla que me falta']];

  function renderMarket() {
    const opts = MSORTS.map(([v, l]) => `<option value="${v}"${S.marketSort === v ? ' selected' : ''}>${l}</option>`).join('');
    $('#market-tools').innerHTML = `<div class="tool-row"><label>Ordenar <select data-msort>${opts}</select></label></div>`;
    const deal = o => o.ask / Math.max(1, estimate(o.item).mid);
    const fns = {
      ganga: (a, b) => deal(a) - deal(b),
      price: (a, b) => a.ask - b.ask,
      rare: (a, b) => kitOf(b.item).rarity - kitOf(a.item).rarity,
      need: (a, b) => sizeCount(a.item.size) - sizeCount(b.item.size),
    };
    const offers = [...S.market].sort(fns[S.marketSort] || fns.ganga);
    $('#market-grid').innerHTML = offers.length
      ? offers.map(marketCard).join('')
      : '<p class="empty">No quedan ofertas hoy. Pulsa «Buscar más».</p>';
    $('#btn-refresh').textContent = `Buscar más (${fmt(REFRESH_COST)})`;
    $('#market-sub').textContent = `${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} disponibles hoy`;
  }

  function fameBarHTML(f) {
    const t = FAME_TIERS[f.tier];
    const nxt = f.next;
    const pct = nxt ? clamp((f.score - t.min) / (nxt.min - t.min) * 100, 0, 100) : 100;
    const perks = [`+${f.tier} clientes al día`, `pagan un ${f.tier * 3} % más`, 'más piezas raras en el mercado'];
    if (t.income) perks.push(`+${fmt(t.income)} diarios por visitas`);
    return `<div class="fame-head"><b>🏛️ ${t.name}</b><span>${f.score} pts${nxt ? ` · siguiente categoría: ${nxt.min}` : ' · categoría máxima'}</span></div>
      <div class="fame-track"><div style="width:${pct}%"></div></div>
      <small>Ventajas: ${perks.join(' · ')}. Las del escaparate puntúan ×1,5. Vender tus mejores piezas resta fama.</small>`;
  }

  function renderShop(f = fame()) {
    $('#fame-bar').innerHTML = fameBarHTML(f);
    $('#shop-cap').textContent = `${S.stock.length}/${S.shelfCap} perchas ocupadas`;
    $('#btn-upgrade').textContent = `Ampliar (${fmt(upgradeCost())})`;
    $('#shop-showcase').innerHTML = showcaseHTML();
    $('#shop-tools').innerHTML = shopToolsHTML();

    const items = shelfItems();
    const compact = S.view.mode === 'compact';
    const manual = S.view.sort === 'manual' && S.view.filter === 'all';
    const pos = i => (manual ? { first: i === 0, last: i === items.length - 1 } : null);
    $('#shelf-title').textContent = `📦 Almacén (${items.length})`;

    const grid = $('#shop-grid');
    grid.className = compact ? 'rows' : 'grid';
    if (!S.stock.length) {
      grid.innerHTML = '<p class="empty">No tienes camisetas. Compra alguna en el Mercado.</p>';
    } else if (!items.length) {
      grid.innerHTML = '<p class="empty">No hay camisetas con este filtro.</p>';
    } else {
      grid.innerHTML = items.map((it, i) => (compact ? shopRow(it, pos(i)) : shopCard(it, pos(i)))).join('');
    }
  }

  function renderCollection(f) {
    const sets = f.sets.map(c => `<li class="${c.done ? 'up' : ''}"><span>${c.icon}</span><b>${c.name}</b><small>${c.desc}</small><em>${Math.min(c.n, c.need)}/${c.need} · ${c.done ? '+' : ''}${c.bonus} pts</em></li>`).join('');
    const top = f.items.filter(x => x.pts >= 1).sort((a, b) => b.pts - a.pts).slice(0, 5)
      .map(x => `<li><b>${title(x.it)}</b><small>Talla ${x.it.size}${S.featured.includes(x.it.uid) ? ' · en escaparate' : ''}</small><em>+${Math.round(x.pts * 10) / 10}</em></li>`).join('');
    $('#fame-box').innerHTML = `
      <p class="sub">Fama total: <b>${f.score}</b> (piezas ${Math.round(f.base)} + colecciones ${f.bonus}). Completa colecciones para sumar puntos extra.</p>
      <ul class="trend-list fame-sets">${sets}</ul>
      <h4 class="fame-sub">Tus piezas estrella</h4>
      <ul class="trend-list">${top || '<li>Aún no tienes piezas que aporten fama: busca raras y legendarias.</li>'}</ul>`;
  }

  function renderPanel(f = fame()) {
    renderCollection(f);
    const nextLevel = LEVEL_XP[level()];
    $('#panel-stats').innerHTML = `
      <div><i>👕</i><small>Camisetas vendidas</small><b>${S.stats.sold}</b></div>
      <div><i>💶</i><small>Ingresos</small><b>${fmt(S.stats.revenue)}</b></div>
      <div><i>📈</i><small>Beneficio en ventas</small><b>${fmt(S.stats.profit)}</b></div>
      <div><i>🧩</i><small>Ventas perdidas por talla</small><b>${Object.values(S.sizeLost).reduce((a, b) => a + b, 0)}</b></div>
      <div><i>🏠</i><small>Alquiler diario</small><b>${fmt(RENT)}</b></div>
      <div><i>👁️</i><small>Ojo de experto</small><b>Nivel ${level()}${nextLevel ? ` · ${S.xp}/${nextLevel}` : ' · máximo'}</b></div>`;
    $('#news-list').innerHTML = S.news.slice(0, 40).map(n => `<li><span>Día ${n.day}</span>${n.text}</li>`).join('');
    renderTrends();
  }

  function renderTrends() {
    const rows = Object.entries(S.trends).map(([key, t]) => {
      const name = key === '__nat' ? 'Selecciones' : key;
      const up = t.mult >= 1;
      return `<li class="${up ? 'up' : 'down'}"><span class="arrow">${up ? '▲' : '▼'}</span><b>${name}</b><em>${up ? '+' : ''}${Math.round((t.mult - 1) * 100)} %</em><small>${t.left} d</small></li>`;
    });
    $('#trend-list').innerHTML = rows.length ? rows.join('') : '<li>Sin tendencias activas.</li>';
  }

  function renderAll() {
    // limpia del escaparate lo que ya no está en stock o no cabe
    S.featured = S.featured.filter(uid => S.stock.some(i => i.uid === uid)).slice(0, maxFeatured());
    const f = fame();
    if (S.fameTier != null && f.tier !== S.fameTier) {
      const msg = f.tier > S.fameTier
        ? `Tu tienda sube a «${FAME_TIERS[f.tier].name}»: llega más gente y pagan mejor.`
        : `Tu tienda baja a «${FAME_TIERS[f.tier].name}»: menos visitas y clientes menos generosos.`;
      log(msg); toast(msg);
    }
    S.fameTier = f.tier;
    renderHeader(f);
    renderMarket();
    renderShop(f);
    renderPanel(f);
  }

  // ---------- Avisos y diálogos ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function dialog(html) {
    const modal = $('#modal');
    const sheet = $('#sheet');
    return new Promise(resolve => {
      sheet.innerHTML = html;
      modal.classList.remove('hidden');
      sheet.onclick = e => {
        const f = e.target.closest('[data-fill]');
        if (f) { editField(sheet, () => Math.round(Number(f.dataset.fill) * Number(f.dataset.base))); return; }
        const ty = e.target.closest('[data-typing]');
        if (ty) {
          const n = ty.closest('.neg');
          if (n) {
            const on = ty.dataset.typing === 'on';
            n.classList.toggle('typing', on);
            if (on) n.dataset.fresh = '1'; else delete n.dataset.fresh;
          }
          return;
        }
        const kp = e.target.closest('[data-key]');
        if (kp) {
          const k = kp.dataset.key;
          const neg = kp.closest('.neg');
          const fresh = !!neg && neg.dataset.fresh === '1';   // el primer dígito sustituye el precio
          if (neg) delete neg.dataset.fresh;
          editField(sheet, v => {
            if (fresh && k !== 'del' && k !== 'clr') v = '';
            return k === 'del' ? v.slice(0, -1) : k === 'clr' ? '' : v.length < 5 ? (v + k).replace(/^0+(?=[0-9])/, '') : v;
          });
          return;
        }
        const st = e.target.closest('[data-step]');
        if (st) { editField(sheet, v => Math.max(0, (Number(v) || 0) + Number(st.dataset.step))); return; }
        const b = e.target.closest('[data-choice]');
        if (!b) return;
        const inp = $('#sheet-input', sheet);
        sheet.onclick = null;
        resolve({ choice: b.dataset.choice, value: inp ? Number(inp.value) : null });
      };
      syncTrack(sheet);
    });
  }

  function closeDialog() {
    $('#modal').classList.add('hidden');
    $('#sheet').innerHTML = '';
    $('#sheet').onclick = null;
  }

  function log(text) { S.news.unshift({ day: S.day, text }); }

  // ---------- Compra y negociación ----------
  function buyItem(offer, price) {
    if (S.stock.length >= S.shelfCap) { toast('No te quedan perchas libres. Vende o amplía la tienda.'); return false; }
    if (S.money < price) { toast('No tienes suficiente caja.'); return false; }
    S.money -= price;
    const it = offer.item;
    it.paid = price;
    it.listPrice = nice(estimate(it).mid * 1.25);
    it.since = S.day;
    S.stock.push(it);
    S.market = S.market.filter(o => o.id !== offer.id);
    log(`Compras ${title(it)} por ${fmt(price)}.`);
    toast(`Comprada: ${title(it)} por ${fmt(price)}`);
    save(); renderAll();
    return true;
  }

  function authOffer(offer) {
    const it = offer.item;
    if (it.verified) return '';
    S.money -= AUTH_COST;
    it.verified = true;
    addXP(2);
    if (it.real) return 'El experto confirma que es auténtica.';
    offer.ask = Math.max(3, nice(replicaValue(it) * 1.1));
    offer.floor = Math.max(2, Math.round(replicaValue(it) * 0.8));
    return 'Es una réplica. El vendedor la rebaja a precio de réplica.';
  }

  // ---------- Componentes visuales de negociación ----------
  const faceFor = r => (r >= 0.67 ? '😊' : r >= 0.34 ? '😐' : '😠');
  const patDots = (n, max) => Array.from({ length: Math.max(max, n, 0) }, (_, i) => `<i class="pdot${i < n ? ' on' : ''}"></i>`).join('');

  function editField(sheet, fn) {
    const i = $('#sheet-input', sheet);
    if (!i) return;
    i.value = String(fn(String(i.value || '')));
    syncTrack(sheet);
  }

  function syncTrack(sheet) {
    const tr = $('.track', sheet), inp = $('#sheet-input', sheet);
    if (!tr || !inp) return;
    const max = Number(tr.dataset.max), v = Number(inp.value) || 0;
    const pin = $('#pin-you', sheet), lg = $('#lg-you', sheet);
    if (pin) pin.style.left = clamp(v / max * 100, 0, 100) + '%';
    if (lg) lg.textContent = fmt(v);
  }

  function keypadHTML() {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-key="${n}">${n}</button>`).join('');
    return `<div class="keypad" role="group" aria-label="Teclado numérico">${keys}
      <button class="key alt" data-key="clr" aria-label="Borrar todo">C</button>
      <button class="key" data-key="0">0</button>
      <button class="key alt" data-key="del" aria-label="Borrar un dígito">⌫</button>
      <button class="key done" data-typing="off">Listo</button></div>`;
  }

  function fieldHTML(label, value) {
    return `<div class="price-field"><small>${label} · toca el precio para escribir</small>
      <div class="pf-row">
        <button class="step" data-step="-5" aria-label="Restar 5 euros">−5</button>
        <div class="pf-box" data-typing="on" role="button" tabindex="0" aria-label="Escribir ${label}"><b class="pf-pen">✎</b><input id="sheet-input" readonly inputmode="none" tabindex="-1" aria-label="${label}" value="${value}"><span>€</span></div>
        <button class="step" data-step="5" aria-label="Sumar 5 euros">+5</button>
      </div></div>`;
  }

  // Barra de precios: banda verde = valoración; chinchetas = precios en juego
  function trackHTML(max, est, pins) {
    const pct = v => clamp(v / max * 100, 0, 100);
    const lo = pct(est.low), hi = pct(est.high);
    return `<div class="track" data-max="${max}"><div class="band" style="left:${lo}%;width:${Math.max(2, hi - lo)}%"></div>
      ${pins.map(p => `<i class="pin ${p.cls}"${p.id ? ` id="${p.id}"` : ''} style="left:${pct(p.v)}%"></i>`).join('')}</div>
      <div class="legend"><span class="lg band-lg">Valoración ${fmt(est.low)}–${fmt(est.high)}</span>
      ${pins.map(p => `<span class="lg ${p.cls}">${p.label} <b${p.id ? ` id="lg-${p.id.slice(4)}"` : ''}>${fmt(p.v)}</b></span>`).join('')}</div>`;
  }

  function stamp(txt, emoji, cls, sub) {
    return new Promise(res => {
      $('#sheet').onclick = null;
      $('#sheet').innerHTML = `<div class="stamp ${cls || 'ok'}"><span>${emoji}</span><b>${txt}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
      $('#modal').classList.remove('hidden');
      setTimeout(() => { closeDialog(); res(); }, 900);
    });
  }

  async function editPrice(uid) {
    const it = S.stock.find(x => x.uid === Number(uid));
    if (!it || S.busy) return;
    const est = estimate(it), sug = suggestedPrice(it);
    const max = Math.max(it.listPrice, est.high, it.paid, sug) * 1.3;
    const r = await dialog(`<div class="neg negx">
      <div class="neg-head"><div class="thumb sm">${kitImage(kitOf(it))}</div>
        <div><h3>${title(it)} · ${kitOf(it).type}</h3><p class="sub">Talla ${it.size} · ${COND[it.cond].label}</p><p class="est">Valoración: <b>${estimateText(it)}</b></p></div></div>
      ${trackHTML(max, est, [{ cls: 'cost', label: 'Pagaste', v: it.paid }, { id: 'pin-you', cls: 'you', label: 'Tu precio', v: it.listPrice }])}
      ${fieldHTML('Tu precio', it.listPrice)}
      <div class="fchips"><button class="fchip" data-fill="1" data-base="${sug}">Sugerido ${fmt(sug)}</button><button class="fchip" data-fill="1.15" data-base="${it.paid}">Coste +15 %</button><button class="fchip" data-fill="1.3" data-base="${it.paid}">Coste +30 %</button></div>
      ${keypadHTML()}
      <div class="actions wrap main"><button class="btn primary" data-choice="save">Guardar precio</button><button class="btn ghost" data-choice="cancel">Cancelar</button></div></div>`);
    closeDialog();
    if (r.choice === 'save' && r.value > 0) { it.listPrice = Math.round(r.value); save(); renderAll(); }
  }

  function sellerDialogHTML(offer, msg) {
    const it = offer.item;
    const s = SELLERS[offer.seller];
    const maxPat = offer.maxPat || s.patience;
    const face = faceFor(offer.patience / maxPat);
    const est = estimate(it);
    const start = Math.min(offer.ask, offer.last || Math.round(offer.ask * 0.8));
    const used = offer.used || {};
    const quick = [0.5, 0.65, 0.8].map(p => `<button class="fchip" data-fill="${p}" data-base="${offer.ask}">${Math.round(p * 100)} %</button>`).join('');
    const heat = offer.heat === undefined ? '' : `<div class="thermo" title="Lo cerca que estás del trato"><span>❄️</span><div><i style="left:${Math.round(offer.heat * 100)}%"></i></div><span>🔥</span></div>`;
    return `
      <div class="neg negx">
        <div class="neg-head">
          <div class="thumb sm">${kitImage(kitOf(it))}</div>
          <div>
            <h3>${title(it)} · ${kitOf(it).type}</h3>
            <p class="sub">${COND[it.cond].label} · Talla ${it.size}${sizeCount(it.size) === 0 ? ' · 🧩 te falta' : ''}</p>
            <div class="chips">${authChip(it)}</div>
          </div>
        </div>
        <div class="stage">
          <div class="avatar ${offer.react || ''}"><span class="av">${s.emoji}</span><span class="face">${face}</span><small>${offer.name}</small></div>
          <p class="bubble ${offer.react || ''}"><span>${s.label}</span>${msg}</p>
        </div>
        <div class="meters"><div class="pat" title="Paciencia del vendedor"><small>Paciencia</small>${patDots(offer.patience, maxPat)}</div>${heat}</div>
        ${trackHTML(Math.max(offer.ask, est.high) * 1.2, est, [{ cls: 'ask', label: 'Pide', v: offer.ask }, { id: 'pin-you', cls: 'you', label: 'Tu oferta', v: start }])}
        ${fieldHTML('Tu oferta', start)}
        <div class="fchips">Atajos: ${quick}</div>
        ${keypadHTML()}
        <div class="actions wrap main">
          <button class="btn primary" data-choice="offer">Ofrecer</button>
          <button class="btn" data-choice="accept">Pagar ${fmt(offer.ask)}</button>
        </div>
        <div class="actions wrap tactics">
          <button class="btn sm" data-choice="defects"${used.defects ? ' disabled' : ''}>🔎 Señalar defectos</button>
          <button class="btn sm" data-choice="cash"${used.cash ? ' disabled' : ''}>💶 Efectivo ya</button>
          ${it.verified ? '' : `<button class="btn sm" data-choice="auth">Autenticar (${fmt(AUTH_COST)})</button>`}
          <button class="btn sm ghost" data-choice="leave">Irme</button>
        </div>
        <p class="hint">Caja: ${fmt(S.money)} · Cada táctica solo se usa una vez</p>
      </div>`;
  }

  async function negotiateBuy(offerId) {
    const offer = S.market.find(o => o.id === offerId);
    if (!offer) return;
    if (S.stock.length >= S.shelfCap) { toast('No te quedan perchas libres. Vende o amplía la tienda.'); return; }
    offer.used = offer.used || {};
    const s = SELLERS[offer.seller];
    let msg = pick(s.lines.greet);
    const pay = async price => { await stamp('¡Trato!', '🤝', 'ok', '−' + fmt(price)); buyItem(offer, price); };
    while (true) {
      const html = sellerDialogHTML(offer, msg);
      offer.react = null;
      const r = await dialog(html);
      if (r.choice === 'leave') { closeDialog(); return; }
      if (r.choice === 'accept') { await pay(offer.ask); return; }
      if (r.choice === 'auth') {
        if (S.money < AUTH_COST) { msg = 'No tienes caja para pagar al experto.'; continue; }
        msg = authOffer(offer);
        save(); renderAll();
        continue;
      }
      if (r.choice === 'defects' || r.choice === 'cash') {
        const defects = r.choice === 'defects';
        offer.used[r.choice] = true;
        const ok = defects
          ? Math.random() < ({ usada: 0.8, buena: 0.55, excelente: 0.3, nueva: 0.1 })[offer.item.cond]
          : Math.random() < (['apurado', 'liquidacion'].includes(offer.seller) ? 0.85 : 0.25);
        if (ok) {
          const cut = Math.max(1, Math.round(offer.ask * (defects ? 0.06 : 0.08)));
          offer.ask = Math.max(offer.floor, offer.ask - cut);
          offer.floor = Math.max(2, offer.floor - Math.round(cut / 2));
          offer.react = 'good';
          msg = defects ? 'Vale, tiene sus marcas. Te rebajo algo.' : 'Si es efectivo ahora… te hago un precio.';
        } else {
          offer.patience -= 1;
          offer.react = 'bad';
          msg = defects ? 'Para mí está perfecta, no me vengas con eso.' : 'No tengo prisa. Prefiero esperar.';
        }
      } else if (r.choice === 'offer') {
        const amount = Math.round(r.value);
        if (!(amount > 0)) { msg = 'Dime una cifra, anda.'; continue; }
        if (amount > S.money) { msg = 'No tienes tanta caja para esa oferta.'; continue; }
        if (amount >= offer.floor) { await pay(Math.min(amount, offer.ask)); return; }
        const near = amount / offer.floor;
        offer.last = amount;
        offer.heat = clamp((near - 0.4) / 0.6, 0, 1);
        if (near < 0.6) {
          offer.patience -= 2;
          offer.react = 'bad';
          msg = pick(s.lines.insult) + ' (Vas muy lejos.)';
        } else {
          offer.patience -= 1;
          offer.react = 'meh';
          const counter = Math.round(Math.max(offer.floor, offer.ask - (offer.ask - offer.floor) * rand(0.3, 0.5)));
          offer.ask = Math.min(offer.ask, counter);
          msg = pick(s.lines.counter) + (near >= 0.9 ? ' (Estás muy cerca.)' : ' (Aún falta.)');
        }
      }
      if (offer.patience <= 0) {
        const lastLine = pick(s.lines.leave);
        S.market = S.market.filter(o => o.id !== offer.id);
        save(); renderAll();
        await dialog(`<div class="neg"><div class="stage"><div class="avatar bad"><span class="av">${s.emoji}</span><span class="face">😠</span><small>${offer.name}</small></div><p class="bubble bad"><span>${s.label}</span>${lastLine}</p></div><p class="hint">El vendedor se ha ido con la camiseta.</p><div class="actions"><button class="btn primary" data-choice="ok">Vale</button></div></div>`);
        closeDialog();
        return;
      }
    }
  }

  // ---------- Tienda: acciones ----------
  function upgradeCost() { return 150 + 100 * S.upgrades; }

  function upgradeShop() {
    const c = upgradeCost();
    if (S.money < c) { toast('No tienes caja para ampliar.'); return; }
    S.money -= c;
    S.shelfCap += 6;
    S.upgrades++;
    log(`Amplías la tienda: ahora tienes ${S.shelfCap} perchas.`);
    save(); renderAll();
  }

  function authStock(uid) {
    const it = S.stock.find(x => x.uid === Number(uid));
    if (!it || it.verified) return;
    if (S.money < AUTH_COST) { toast('No tienes caja para autenticar.'); return; }
    S.money -= AUTH_COST;
    it.verified = true;
    addXP(2);
    if (!it.real) {
      it.listPrice = nice(replicaValue(it) * 1.3);
      toast('Es una réplica. Se venderá como réplica y valdrá mucho menos.');
    } else {
      toast('Autenticada: es original.');
    }
    save(); renderAll();
  }

  function refreshMarket() {
    if (S.money < REFRESH_COST) { toast('No tienes caja para buscar más.'); return; }
    S.money -= REFRESH_COST;
    S.market = genMarket();
    save(); renderAll();
    toast('Nuevas ofertas en el mercado.');
  }

  // ---------- Clientes ----------
  function genCustomer() {
    const type = weighted(Object.keys(CUSTOMER_TYPES), t => CUSTOMER_TYPES[t].weight);
    const c = { type, name: pick(NAMES), ...CUSTOMER_TYPES[type] };
    c.size = weighted(SIZE_ORDER, z => SIZE_DEMAND[z]);
    c.sizeFree = type === 'bargain';       // el cazador de gangas no mira la talla
    let candidates = [];
    if (type === 'fan') {
      const teams = [...new Set(S.stock.map(it => kitOf(it).team))];
      const allTeams = [...new Set(KITS.map(x => x.team))];
      c.team = Math.random() < 0.75 ? pick(teams) : pick(allTeams);
      candidates = S.stock.filter(it => kitOf(it).team === c.team);
    } else if (type === 'collector') {
      candidates = S.stock.filter(it => kitOf(it).rarity >= 3 || it.special);
    } else if (type === 'nostalgic') {
      candidates = S.stock.filter(it => kitOf(it).year <= 2000);
    } else if (type === 'bargain') {
      candidates = [S.stock.slice().sort((a, b) => a.listPrice / perceivedValue(a) - b.listPrice / perceivedValue(b))[0]];
    } else {
      candidates = S.stock.slice();
    }
    const star = i => (S.featured.includes(i.uid) ? 3 : 1);   // lo destacado se ve antes
    let item = null;
    if (candidates.length) {
      if (c.sizeFree) item = candidates[0];
      else {
        const exact = candidates.filter(i => i.size === c.size);
        const near = candidates.filter(i => Math.abs(SIZE_ORDER.indexOf(i.size) - SIZE_ORDER.indexOf(c.size)) === 1);
        if (exact.length) item = weighted(exact, star);
        else if (near.length && Math.random() > SIZE_MISS) { item = weighted(near, star); c.offSize = true; }
        else { c.sizeMiss = true; S.sizeLost[c.size] = (S.sizeLost[c.size] || 0) + 1; }
      }
    }
    c.item = item;
    if (!item) return c;
    const kit = kitOf(item);
    let f = 1;
    if (type === 'fan') f = 1.2;
    else if (type === 'collector') f = kit.rarity >= 3 ? 1.25 : 1.1;
    else if (type === 'bargain') f = 0.72;
    else if (type === 'nostalgic') f = 1.25;
    else if (type === 'tourist') f = 0.9;
    if (c.offSize) f *= 0.85;
    else if (!c.sizeFree && (c.size === 'XL' || c.size === 'XXL')) f *= 1.08;   // agradece encontrar su talla
    c.maxPay = Math.max(2, perceivedValue(item) * f * rand(0.88, 1.12) * (1 + S.rep / 400) * (1 + fame().tier * 0.03));
    return c;
  }

  function missText(c) {
    if (c.sizeMiss) return `${c.name} buscaba${c.team ? ' algo de ' + c.team : ' una camiseta'} en talla ${c.size} y no la tenías.`;
    if (c.type === 'fan') return `${c.name} buscaba algo de ${c.team} y no lo tienes.`;
    if (c.type === 'collector') return `${c.name} buscaba piezas raras y no tienes ninguna.`;
    if (c.type === 'nostalgic') return `${c.name} quería una camiseta de los 90 o anterior.`;
    return `${c.name} se fue sin encontrar nada.`;
  }

  function recordSale(it, price, report) {
    const profit = price - it.paid;
    const fameBefore = fame().score;
    S.money += price;
    S.stock = S.stock.filter(x => x.uid !== it.uid);
    S.featured = S.featured.filter(u => u !== it.uid);
    const fameLost = fameBefore - fame().score;
    report.fameLost = (report.fameLost || 0) + fameLost;
    S.stats.sold++;
    S.stats.revenue += price;
    S.stats.profit += profit;
    S.rep = clamp(S.rep + 1, 0, 100);
    addXP(profit > it.paid * 0.5 ? 3 : 1);
    report.income += price;
    report.sales.push(`${title(it)}: ${fmt(price)} (${profit >= 0 ? '+' : ''}${fmt(profit)})${fameLost >= 1 ? ` · 🏛️ −${fameLost} fama` : ''}`);
    if (!it.real && !it.verified && price > replicaValue(it) * 2.5 && Math.random() < 0.5) {
      S.pendingReturns.push({ name: title(it), refund: price });
    }
  }

  function haggleHTML(c, it, offer, listPrice, msg, final, round) {
    const est = estimate(it);
    const start = Math.round((listPrice + offer) / 2);
    const max = Math.max(listPrice, offer, est.high, it.paid) * 1.2;
    const pins = [{ cls: 'cost', label: 'Pagaste', v: it.paid }, { cls: 'ask', label: 'Tu precio', v: listPrice }, { cls: 'their', label: 'Ofrece', v: offer }];
    if (!final) pins.push({ id: 'pin-you', cls: 'you', label: 'Contraoferta', v: start });
    const profit = offer - it.paid;
    return `
      <div class="neg negx">
        <div class="neg-head">
          <div class="thumb sm">${kitImage(kitOf(it))}</div>
          <div>
            <h3>${title(it)} · ${kitOf(it).type}</h3>
            <p class="sub">${COND[it.cond].label} · Talla ${it.size}</p>
            <p class="est">Valoración: <b>${estimateText(it)}</b></p>
          </div>
        </div>
        <div class="stage">
          <div class="avatar ${round === 2 ? 'bad' : ''}"><span class="av">${c.emoji}</span><span class="face">${faceFor(1 - round / 3)}</span><small>${c.name}</small></div>
          <p class="bubble ${round === 2 ? 'bad' : ''}"><span>${c.label}${c.sizeFree ? '' : ' · talla ' + c.size}</span>${msg}</p>
        </div>
        <div class="meters"><div class="pat"><small>Paciencia</small>${patDots(3 - round, 3)}</div>
          <span class="gain ${profit >= 0 ? 'pos' : 'neg'}">Si aceptas: ${profit >= 0 ? '+' : ''}${fmt(profit)}</span></div>
        ${trackHTML(max, est, pins)}
        ${final ? '' : `${fieldHTML('Tu contraoferta', start)}
        <div class="fchips">Atajos: <button class="fchip" data-fill="1" data-base="${listPrice}">Mi precio</button><button class="fchip" data-fill="1" data-base="${start}">Mitad</button><button class="fchip" data-fill="1" data-base="${offer + 5}">Su oferta +5</button></div>
        ${keypadHTML()}`}
        <div class="actions wrap main">
          <button class="btn primary" data-choice="accept">Aceptar ${fmt(offer)}</button>
          ${final ? '' : '<button class="btn" data-choice="counter">Contraofertar</button>'}
          <button class="btn ghost" data-choice="reject">Rechazar</button>
        </div>
      </div>`;
  }

  const CLIENT_LINES = {
    ask: ['Me gusta, pero ese precio es alto. ¿Qué tal esto?', 'Está bien, pero te pasas un poco. Te ofrezco esto.'],
    more: ['Algo más sí, pero no tanto.', 'Casi. Me acerco un poco.'],
    last: ['Eso se me va de presupuesto. Es mi última oferta.', 'No puedo más. Última oferta.'],
    size: ' Me quedaría justa de talla, así que ajustemos el precio.',
  };

  async function serveCustomer(c, report) {
    const it = c.item;
    if (!it) { report.lost.push(missText(c)); return; }
    let cur = it.listPrice;
    const ratio = cur / c.maxPay;
    const tourist = c.type === 'tourist';
    if (ratio <= (tourist ? 1.15 : 1)) { recordSale(it, cur, report); return; }
    if (ratio > 1.6) { report.lost.push(`${c.name} vio ${title(it)} a ${fmt(cur)} y le pareció carísima.`); return; }
    if (tourist) { report.lost.push(`${c.name} no quiso pagar ${fmt(cur)} por ${title(it)}.`); return; }

    let offer = Math.max(1, Math.round(c.maxPay * rand(0.72, 0.88)));
    let msg = pick(CLIENT_LINES.ask) + (c.offSize ? CLIENT_LINES.size : '');
    for (let round = 0; round < 3; round++) {
      const last = round === 2;
      const r = await dialog(haggleHTML(c, it, offer, cur, msg, last, round));
      if (r.choice === 'accept') { await stamp('¡Vendida!', '🤝', 'ok', '+' + fmt(offer)); recordSale(it, offer, report); return; }
      if (r.choice === 'reject' || last) {
        closeDialog();
        report.lost.push(r.choice === 'reject' ? `Rechazaste la oferta de ${c.name} por ${title(it)}.` : `${c.name} no llegó a un acuerdo por ${title(it)}.`);
        return;
      }
      const counter = Math.round(r.value);
      if (counter > 0 && counter <= c.maxPay) { const p = Math.max(counter, offer); await stamp('¡Vendida!', '🤝', 'ok', '+' + fmt(p)); recordSale(it, p, report); return; }
      if (counter > c.maxPay * 1.3) {
        await stamp('Se ha ido', '😠', 'bad');
        report.lost.push(`${c.name} se ofendió con tu contraoferta por ${title(it)}.`);
        return;
      }
      if (counter > 0) cur = Math.min(cur, counter);
      offer = Math.min(Math.round(c.maxPay * 0.99), Math.max(offer, Math.round(offer + (cur - offer) * rand(0.3, 0.5))));
      msg = pick(round + 1 === 2 ? CLIENT_LINES.last : CLIENT_LINES.more);
    }
  }

  // ---------- Fin de día ----------
  async function openShop() {
    if (S.over || S.busy) return;
    S.busy = true;
    const report = { sales: [], lost: [], income: 0, customers: 0 };
    const n = 4 + Math.floor(S.rep / 25) + randInt(0, 3) + S.traffic + fame().tier;
    if (S.stock.length === 0) {
      report.lost.push('No tenías camisetas en el escaparate: nadie entró a mirar.');
    } else {
      for (let i = 0; i < n && S.stock.length > 0; i++) {
        report.customers++;
        const c = genCustomer();
        await serveCustomer(c, report);
        renderAll();
      }
    }
    closeDialog();
    await endDay(report);
    S.busy = false;
  }

  function startOfDayEvents() {
    // Caduca tendencias
    Object.keys(S.trends).forEach(key => {
      S.trends[key].left--;
      if (S.trends[key].left <= 0) delete S.trends[key];
    });
    S.traffic = 0;
    if (S.fakeBoost > 0) S.fakeBoost--;

    if (Math.random() < 0.55) {
      const ev = pick(EVENTS);
      if (ev.kind === 'team') {
        const team = pick([...new Set(KITS.map(x => x.team))]);
        S.trends[team] = { mult: +rand(ev.mult[0], ev.mult[1]).toFixed(2), left: randInt(ev.days[0], ev.days[1]) };
        log(ev.text(team));
      } else if (ev.kind === 'nat') {
        S.trends.__nat = { mult: +rand(ev.mult[0], ev.mult[1]).toFixed(2), left: randInt(ev.days[0], ev.days[1]) };
        log(ev.text());
      } else if (ev.kind === 'traffic') {
        S.traffic = randInt(ev.extra[0], ev.extra[1]);
        log(ev.text());
      } else if (ev.kind === 'fakes') {
        S.fakeBoost = randInt(ev.days[0], ev.days[1]);
        log(ev.text());
      }
    }
  }

  async function endDay(report) {
    S.money -= RENT;
    const lines = [];
    lines.push(`<li>Alquiler: <b>-${fmt(RENT)}</b></li>`);
    const fm = fame();
    const visitIncome = FAME_TIERS[fm.tier].income;
    if (visitIncome > 0) {
      S.money += visitIncome;
      lines.push(`<li>🏛️ Visitas a tu colección (${FAME_TIERS[fm.tier].name}): <b>+${fmt(visitIncome)}</b></li>`);
    }
    if (report.fameLost >= 1) {
      lines.push(`<li class="neg">Las ventas de hoy te han restado ${report.fameLost} puntos de fama.</li>`);
    }

    S.day++;
    if (S.pendingReturns.length) {
      S.pendingReturns.forEach(r => {
        S.money -= r.refund;
        S.rep = clamp(S.rep - 4, 0, 100);
        const text = `Devolución: un cliente descubrió que ${r.name} era una réplica. Reembolsas ${fmt(r.refund)} y pierdes reputación.`;
        log(text);
        lines.push(`<li class="neg">${text}</li>`);
      });
      S.pendingReturns = [];
    }
    startOfDayEvents();
    S.market = genMarket();

    const todayNews = S.news.filter(n => n.day === S.day).map(n => n.text);

    const html = `
      <div class="report">
        <div class="report-banner"><span>🌙</span><div><h3>Cierre del día ${S.day - 1}</h3><p>${report.customers} clientes</p></div><b>${fmt(report.income)}</b></div>
        ${report.sales.length ? `<h4>💰 Ventas</h4><ul class="list-ok">${report.sales.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        ${report.lost.length ? `<h4>🚪 Ventas perdidas</h4><ul class="list-bad">${report.lost.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        <h4>🧾 Movimientos</h4><ul>${lines.join('')}</ul>
        ${todayNews.length ? `<h4>📰 Noticias para mañana</h4><ul>${todayNews.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        <div class="actions"><button class="btn primary" data-choice="ok">Empezar el día ${S.day}</button></div>
      </div>`;
    save(); renderAll();
    await dialog(html);
    closeDialog();

    // Fin de partida / objetivo
    if (S.money < 0 && S.stock.length === 0 || S.money < -300) {
      S.over = true;
      save();
      await dialog(`<div class="report"><h3>Quiebra</h3><p>Te has quedado sin caja y sin camisetas para vender. Total vendido: ${S.stats.sold} camisetas.</p><div class="actions"><button class="btn primary" data-choice="restart">Empezar de nuevo</button></div></div>`);
      closeDialog();
      resetGame(true);
      return;
    }
    if (!S.goalReached && netWorth() >= GOAL) {
      S.goalReached = true;
      save();
      await dialog(`<div class="report"><h3>Objetivo cumplido</h3><p>Tu patrimonio supera ${fmt(GOAL)} en ${S.day} días. Puedes seguir jugando para ampliar la tienda y buscar piezas legendarias.</p><div class="actions"><button class="btn primary" data-choice="ok">Seguir jugando</button></div></div>`);
      closeDialog();
    }
  }

  // ---------- Inicio y reinicio ----------
  async function intro() {
    await dialog(`
      <div class="report">
        <h3>Tu tienda de camisetas</h3>
        <ul>
          <li>Compra camisetas en el <b>Mercado</b>: negocia con cada vendedor.</li>
          <li>Las valoraciones son estimaciones. Si dudas, <b>autentica</b>: hay réplicas.</li>
          <li>Fija tu precio en <b>Tienda</b> y pulsa «Abrir tienda» para atender clientes.</li>
          <li>En <b>Tienda</b> pon tus mejores piezas en el escaparate con ⭐ (los clientes las ven antes) y ordénalas con ◀ ▶. Ojo: los clientes piden una talla concreta.</li>
          <li>Cada día pagas ${fmt(RENT)} de alquiler. Objetivo: ${fmt(GOAL)} de patrimonio.</li>
        </ul>
        <div class="actions"><button class="btn primary" data-choice="ok">Empezar</button></div>
      </div>`);
    closeDialog();
    S.seenIntro = true;
    save();
  }

  async function resetGame(skipConfirm) {
    if (!skipConfirm) {
      const r = await dialog('<div class="report"><h3>Reiniciar partida</h3><p>Se borrará tu progreso actual.</p><div class="actions"><button class="btn primary" data-choice="yes">Reiniciar</button><button class="btn ghost" data-choice="no">Cancelar</button></div></div>');
      closeDialog();
      if (r.choice !== 'yes') return;
    }
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ }
    newGame();
    save(); renderAll();
    intro();
  }

  // ---------- Eventos de la interfaz ----------
  function bind() {
    $$('.tabs button').forEach(b => b.addEventListener('click', () => {
      $$('.tabs button').forEach(x => x.classList.toggle('active', x === b));
      $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
    }));

    document.addEventListener('click', e => {
      const b = e.target.closest('[data-action]');
      if (!b || b.tagName === 'INPUT') return;
      const a = b.dataset.action;
      if (a === 'negotiate') negotiateBuy(Number(b.dataset.id));
      else if (a === 'buy') {
        const o = S.market.find(x => x.id === Number(b.dataset.id));
        if (o) buyItem(o, o.ask);
      }
      else if (a === 'auth') authStock(b.dataset.uid);
      else if (a === 'filter') { S.view.filter = S.view.filter === b.dataset.f ? 'all' : b.dataset.f; save(); renderAll(); }
      else if (a === 'feature') toggleFeature(b.dataset.uid);
      else if (a === 'move') moveItem(b.dataset.uid, b.dataset.dir);
      else if (a === 'mode') { S.view.mode = b.dataset.mode; save(); renderAll(); }
      else if (a === 'editprice') editPrice(b.dataset.uid);
      else if (a === 'suggestall') { S.stock.forEach(it => { it.listPrice = suggestedPrice(it); }); save(); renderAll(); toast('Precios sugeridos aplicados a todo.'); }
      else if (a === 'suggest') {
        const it = S.stock.find(x => x.uid === Number(b.dataset.uid));
        if (it) { it.listPrice = suggestedPrice(it); save(); renderAll(); }
      }
    });

    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('select[data-sort]')) { S.view.sort = t.value; save(); renderAll(); return; }
      if (t.matches('select[data-msort]')) { S.marketSort = t.value; save(); renderAll(); return; }
    });

    $('#btn-refresh').addEventListener('click', refreshMarket);
    $('#btn-upgrade').addEventListener('click', upgradeShop);
    $('#btn-open').addEventListener('click', openShop);
    $('#btn-reset').addEventListener('click', () => resetGame(false));
  }

  function init() {
    S = load() || newGame();
    S.busy = false;
    S.featured = S.featured || []; S.sizeLost = S.sizeLost || {};
    if (!S.view || !S.view.v3) S.view = { filter: 'all', sort: 'manual', mode: 'cards', v3: true }; S.marketSort = S.marketSort || 'ganga';
    bind();
    renderAll();
    if (!S.seenIntro) intro();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
