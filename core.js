// core.js — LO BÁSICO
// Configuración, packs, utilidades, estado y guardado, valoración, fama y colecciones, generación de ofertas,
// pantalla de tienda y mercado (plantillas y render), avisos y diálogos, mejoras, fin de día, inicio/reinicio y clics.
// Depende de data.js. Se carga el primero tras data.js.
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

// ---------- Packs y lotes ----------
// Cada fuente vende lotes con descuento por cantidad:
//   step = rebaja por cada camiseta extra · max = tope por cantidad · full = extra si te llevas el lote entero
//   ask = precio pedido respecto al valor real · real = prob. de que sean auténticas · cond = pesos de estado
const PACK_SOURCES = {
  tienda: {
    icon: '🏬', label: 'Tienda', names: ['Retro Mayorista', 'Distribuciones Gol', 'Almacén Fútbol', 'Textil Deportivo Norte', 'Camisetas al por mayor'],
    size: [3, 5], ask: [0.95, 1.1], step: 0.05, max: 0.2, full: 0.05, real: 0.98, boost: 0,
    cond: { nueva: 30, excelente: 45, buena: 25, usada: 0 },
    desc: 'Precio fijo y género fiable. Cuantas más compres, más descuento.', tag: '✔ Género fiable', tagCls: 'good',
  },
  outlet: {
    icon: '🏷️', label: 'Outlet', names: ['Outlet Fin de Temporada', 'Outlet Gol Express', 'Liquidaciones Retro', 'Outlet La Grada'],
    size: [4, 6], ask: [0.8, 0.95], step: 0.06, max: 0.3, full: 0.05, real: 0.8, boost: 0.1,
    cond: { nueva: 10, excelente: 20, buena: 40, usada: 30 },
    desc: 'Descuentos enormes, pero hay piezas gastadas y riesgo de réplicas.', tag: '⚠️ Riesgo de réplicas', tagCls: 'warn',
  },
  particular: {
    icon: '🧑', label: 'Particular', names: null,
    size: [2, 3], ask: [0.85, 1], step: 0.1, max: 0.2, full: 0.05, real: null, boost: 0, cond: null,
    desc: 'Un coleccionista vende varias a la vez: si te llevas más de una, te rebaja.', tag: '🤝 Trato personal', tagCls: 'cold',
  },
};

let S = null;       // estado del juego

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
  S.packs = genPacks();
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

function genPackItem(src) {
  const it = genItem();
  if (src.cond) it.cond = weighted(CONDITIONS.filter(c => src.cond[c.id] > 0), c => src.cond[c.id]).id;
  if (src.real != null) it.real = Math.random() < src.real - (S.fakeBoost > 0 ? src.boost : 0);
  return it;
}

function genPack(srcId) {
  const src = PACK_SOURCES[srcId];
  const n = randInt(src.size[0], src.size[1]);
  const items = Array.from({ length: n }, () => {
    const item = genPackItem(src);
    return { item, price: Math.max(3, nice(valueIfReal(item) * rand(src.ask[0], src.ask[1]))) };
  });
  return { id: S.nextOffer++, src: srcId, name: src.names ? pick(src.names) : pick(NAMES), items };
}

function genPacks() { return Object.keys(PACK_SOURCES).map(genPack); }

// Descuento según cuántas camisetas eliges del lote (n) y cuántas tiene el lote (total)
const packDiscount = (src, n, total) => (n < 2 ? 0 : Math.min(src.max, src.step * (n - 1)) + (n === total ? src.full : 0));

function packQuote(pack, sel) {
  const src = PACK_SOURCES[pack.src];
  const chosen = pack.items.filter(x => sel.has(x.item.uid));
  const d = packDiscount(src, chosen.length, pack.items.length);
  const lines = chosen.map(x => ({ ...x, pay: Math.max(2, Math.round(x.price * (1 - d))) }));
  const full = chosen.reduce((a, x) => a + x.price, 0);
  const total = lines.reduce((a, x) => a + x.pay, 0);
  return { chosen: lines, d, full, total, saved: full - total };
}

// ---------- Plantillas ----------
function stars(r) { return `<span class="stars" aria-label="${r} de 4 estrellas"><b>${'★'.repeat(r)}</b><i>${'★'.repeat(4 - r)}</i></span>`; }

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
  renderPacks();
  $('#btn-refresh').textContent = `Buscar más (${fmt(REFRESH_COST)})`;
  $('#market-sub').textContent = `${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} disponibles hoy`;
}

function packCard(p) {
  const src = PACK_SOURCES[p.src];
  const q = packQuote(p, new Set(p.items.map(x => x.item.uid)));
  const thumbs = p.items.map(x => `<span class="pk-th">${kitImage(kitOf(x.item))}</span>`).join('');
  return `
    <article class="card pcard">
      <div class="pk-head"><span class="pk-icon">${src.icon}</span><div><h3>${p.name}</h3><p class="mc-sub">${src.label} · ${p.items.length} camisetas</p></div></div>
      <div class="pk-thumbs">${thumbs}</div>
      <div class="mc-pills"><span class="chip hot">Hasta −${Math.round(q.d * 100)} %</span><span class="chip ${src.tagCls}">${src.tag}</span></div>
      <p class="pk-line">Lote completo <b>${fmt(q.total)}</b> <s>${fmt(q.full)}</s></p>
      <div class="actions"><button class="btn primary" data-action="pack" data-id="${p.id}">Ver lote</button></div>
    </article>`;
}

function renderPacks() {
  let box = $('#pack-section');
  if (!box) {
    box = document.createElement('section');
    box.id = 'pack-section';
    box.className = 'pack-section';
    const g = $('#market-grid');
    g.parentNode.insertBefore(box, g);
  }
  const packs = S.packs || [];
  box.innerHTML = packs.length
    ? `<h3 class="block-title">📦 Lotes y packs</h3>
       <p class="sub">Compra varias camisetas de golpe y ahorra: cuantas más te lleves, mayor es el descuento.</p>
       <div class="pack-grid">${packs.map(packCard).join('')}</div>
       <h3 class="block-title">🛍️ Ofertas sueltas</h3>`
    : '';
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
  S.packs = genPacks();
  save(); renderAll();
  toast('Nuevas ofertas y lotes en el mercado.');
}


// ---------- Fin de día ----------
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
  S.packs = genPacks();

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
        <li>También hay <b>lotes</b> de tiendas, outlets y particulares: si te llevas varias camisetas a la vez, te hacen descuento.</li>
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
    else if (a === 'pack') openPack(Number(b.dataset.id));
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
  if (!S.packs) S.packs = genPacks();
  if (!S.view || !S.view.v3) S.view = { filter: 'all', sort: 'manual', mode: 'cards', v3: true }; S.marketSort = S.marketSort || 'ganga';
  bind();
  renderAll();
  if (!S.seenIntro) intro();
}

document.addEventListener('DOMContentLoaded', init);
