// core.js — LO BÁSICO
// Configuración, packs, utilidades, estado y guardado, valoración, fama y colecciones, generación de ofertas,
// pantalla de tienda y mercado (plantillas y render), avisos y diálogos, mejoras, fin de día, inicio/reinicio y clics.
// Depende de data.js. Se carga el primero tras data.js. (La pestaña Colección vive en coleccion.js.)
'use strict';

// ---------- Configuración ----------
const SAVE_KEY = 'camisetasRetroShop_v2';
const GOAL = 5000;          // patrimonio objetivo
const AUTH_COST = 15;       // coste de autenticar
const REFRESH_COST = 10;    // coste de buscar más ofertas
const LEVEL_XP = [0, 8, 25, 55, 100];
const SIZES = { S: 0.9, M: 1, L: 1, XL: 0.92, XXL: 0.75 };
const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZE_WEIGHTS = { S: 14, M: 34, L: 30, XL: 17, XXL: 5 };   // lo que aparece en el mercado
const SIZE_DEMAND = { S: 12, M: 34, L: 32, XL: 16, XXL: 6 };    // lo que piden los clientes
const SIZE_MISS = 0.55;     // prob. de que un cliente se vaya si solo tienes tallas vecinas
const FEATURED_BASE = 3;    // máximo de camisetas en el escaparate a partir del 3.er local (los dos primeros tienen 1 y 2: ver LOCALES)
const CONDITIONS = [
  { id: 'nueva', label: 'Nueva con etiquetas', coef: 1.6, w: 8 },
  { id: 'excelente', label: 'Excelente', coef: 1.15, w: 27 },
  { id: 'buena', label: 'Buen estado', coef: 0.85, w: 40 },
  { id: 'usada', label: 'Muy usada', coef: 0.5, w: 25 },
];
const COND = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

// ---------- Locales: progresión de la tienda ----------
// Empiezas en un localito del barrio y te vas mudando a sitios mejores.
//   cap = perchas · rent = alquiler diario · cost = lo que pagas al mudarte · minFame = fama mínima (0 = sin requisito)
//   traffic = clientes extra cada día por estar en mejor zona · showcase = huecos del escaparate (1, 2 y luego 3 fijos)
const LOCALES = [
  { id: 'cuchitril', icon: '🏚️', name: 'Cuchitril del barrio', zone: 'Barrio humilde',
    desc: 'Un bajo diminuto con humedades y una persiana que chirría. Todos empiezan por algún sitio.',
    cap: 10, rent: 12, cost: 0, minFame: 0, traffic: 0, showcase: 1 },
  { id: 'reformado', icon: '🏠', name: 'Local reformado', zone: 'Tu barrio',
    desc: 'Más grande, recién pintado y limpio. Ya parece una tienda de verdad.',
    cap: 18, rent: 22, cost: 400, minFame: 0, traffic: 0, showcase: 2 },
  { id: 'zona', icon: '🏘️', name: 'Local en zona buena', zone: 'Barrio comercial',
    desc: 'Pasa más gente y con más dinero. Escaparate a pie de calle.',
    cap: 28, rent: 40, cost: 1100, minFame: 6, traffic: 1, showcase: 3 },
  { id: 'calle', icon: '🏬', name: 'Local en calle comercial', zone: 'Calle comercial',
    desc: 'Mucho paso y un local amplio con buena luz. Aquí ya compiten contigo.',
    cap: 40, rent: 65, cost: 2500, minFame: 18, traffic: 2, showcase: 3 },
  { id: 'centro', icon: '🏙️', name: 'Gran local del centro', zone: 'Centro de la ciudad',
    desc: 'Dos plantas en pleno centro. Turistas, coleccionistas y curiosos a todas horas.',
    cap: 55, rent: 100, cost: 5000, minFame: 40, traffic: 3, showcase: 3 },
  { id: 'insignia', icon: '🏛️', name: 'Tienda insignia', zone: 'Avenida principal',
    desc: 'Tu nombre en la fachada de la avenida más cara de la ciudad.',
    cap: 75, rent: 150, cost: 9500, minFame: 75, traffic: 4, showcase: 3 },
  { id: 'templo', icon: '🏟️', name: 'Templo retro', zone: 'Junto al estadio',
    desc: 'Un edificio entero junto al estadio. Peregrinación obligada para cualquier aficionado.',
    cap: 100, rent: 220, cost: 18000, minFame: 120, traffic: 5, showcase: 3 },
];
const UPGRADE_MARKUP = 1.05;   // todas las mudanzas cuestan un 5 % más que el precio base de la tabla
LOCALES.forEach(l => { l.cost = Math.round(l.cost * UPGRADE_MARKUP / 5) * 5; });
let RENT = LOCALES[0].rent;   // alquiler diario: lo fija el local actual (ver applyLocal)

// ---------- Sistema Player / Aficionado ----------
// Hasta PLAYER_FROM-1 las camisetas son normales (sin etiqueta ni versión). Desde PLAYER_FROM, cada una sale
// Player (PLAYER_CHANCE) o Aficionado (el resto) y siempre lleva etiqueta.
const PLAYER_FROM = 1991;     // primer año con versiones
const PLAYER_CHANCE = 0.25;   // prob. de que una camiseta sea Player
const PLAYER_MULT = 1.19;     // valor de una Player respecto a una Aficionado (configurable)
const PLAYER_FAKE = 0.05;     // +5 puntos porcentuales de prob. de falsificación en las Player

// ---------- Packs y lotes ----------
// Cada fuente vende lotes con descuento por cantidad:
//   step = rebaja por cada camiseta extra · max = tope por cantidad · full = extra si te llevas el lote entero
//   ask = precio pedido respecto al valor real · real = prob. de que sean auténticas · cond = pesos de estado
const PACK_SOURCES = {
  tienda: {
    icon: '🏬', label: 'Tienda', names: ['Retro Mayorista', 'Distribuciones Gol', 'Almacén Fútbol', 'Textil Deportivo Norte', 'Camisetas al por mayor'],
    w: 22, size: [3, 5], ask: [0.95, 1.1], step: 0.05, max: 0.2, full: 0.05, real: 0.98, boost: 0,
    cond: { nueva: 30, excelente: 45, buena: 25, usada: 0 },
    desc: 'Precio fijo y género fiable. Cuantas más compres, más descuento.', tag: '✔ Género fiable', tagCls: 'good',
  },
  outlet: {
    icon: '🏷️', label: 'Outlet', names: ['Outlet Fin de Temporada', 'Outlet Gol Express', 'Liquidaciones Retro', 'Outlet La Grada'],
    w: 18, size: [4, 6], ask: [0.8, 0.95], step: 0.06, max: 0.3, full: 0.05, real: 0.8, boost: 0.1,
    cond: { nueva: 10, excelente: 20, buena: 40, usada: 30 },
    desc: 'Descuentos enormes, pero hay piezas gastadas y riesgo de réplicas.', tag: '⚠️ Riesgo de réplicas', tagCls: 'warn',
  },
  particular: {
    icon: '🧑', label: 'Particular', names: null,
    w: 20, size: [2, 3], ask: [0.85, 1], step: 0.1, max: 0.2, full: 0.05, real: null, boost: 0, cond: null,
    desc: 'Un coleccionista vende varias a la vez: si te llevas más de una, te rebaja.', tag: '🤝 Trato personal', tagCls: 'cold',
  },
  subasta: {
    icon: '🔨', label: 'Casa de subastas', names: ['Subastas Gran Premio', 'Casa Peral Subastas', 'Sala de Subastas Antiguas', 'Subastas del Estadio'],
    w: 8, size: [2, 4], ask: [1.05, 1.3], step: 0.03, max: 0.12, full: 0.03, real: 0.99, boost: 0, minRarity: 3,
    cond: { nueva: 15, excelente: 40, buena: 35, usada: 10 },
    desc: 'Solo piezas raras y certificadas. Caras y con poco descuento, pero muy valiosas.', tag: '✔ Piezas certificadas', tagCls: 'good',
  },
  herencia: {
    icon: '👴', label: 'Herencia familiar', names: ['Baúl de los abuelos', 'Armario de la tía Rosa', 'Herencia de Don Paco', 'Desván de la casa de Ramón', 'Trastero de un hincha'],
    w: 14, size: [3, 6], ask: [0.4, 0.7], step: 0.04, max: 0.16, full: 0.1, real: 0.9, boost: 0.05,
    cond: { nueva: 3, excelente: 12, buena: 40, usada: 45 },
    desc: 'Una familia vende todo junto. Muy baratas, pero con mucho desgaste y alguna sorpresa.', tag: '🎲 Sorpresa', tagCls: 'warn',
  },
  club: {
    icon: '🏟️', label: 'Tienda de club', names: null, theme: 'team',
    w: 14, size: [3, 5], ask: [0.9, 1.05], step: 0.05, max: 0.2, full: 0.05, real: 0.97, boost: 0,
    cond: { nueva: 25, excelente: 40, buena: 30, usada: 5 },
    desc: 'Fondo de armario de un solo equipo. Ideal para completar tu colección de club.', tag: '🏟️ Un solo equipo', tagCls: 'good',
  },
  importador: {
    icon: '🌍', label: 'Importador', names: ['Importaciones Mundial', 'Coleccionismo Global', 'Camisetas del Mundo', 'Selecciones Retro Import'], theme: 'nat',
    w: 10, size: [3, 5], ask: [0.8, 0.95], step: 0.06, max: 0.25, full: 0.05, real: 0.85, boost: 0.1,
    cond: { nueva: 12, excelente: 28, buena: 40, usada: 20 },
    desc: 'Lote de selecciones nacionales traídas de fuera. Buen precio, algo de riesgo de réplicas.', tag: '⚠️ Riesgo de réplicas', tagCls: 'warn',
  },
  noventas: {
    icon: '📼', label: 'Coleccionista retirado', names: ['Colección de los 90', 'Años dorados', 'Memorias del 94 al 99', 'Recuerdos de los 90'], theme: 'era90',
    w: 10, size: [3, 5], ask: [0.85, 1.0], step: 0.06, max: 0.22, full: 0.06, real: 0.94, boost: 0.03,
    cond: { nueva: 8, excelente: 30, buena: 42, usada: 20 },
    desc: 'Solo camisetas de 1990 a 1999. Muy pedidas por los nostálgicos.', tag: '📼 Solo años 90', tagCls: 'cold',
  },
};

// Temas de lote (filtran qué camisetas puede traer)
const PACK_THEMES = {
  nat: x => x.nat,
  era90: x => x.year >= 1990 && x.year <= 1999,
};
// Cuántos lotes aparecen cada día: unos días ninguno, otros hasta cuatro
const PACK_COUNT_W = [[0, 14], [1, 30], [2, 30], [3, 18], [4, 8]];

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

// Versión de la camiseta: null (sin versión, hasta 1990), 'player' o 'aficionado'
const hasTier = it => kitOf(it).year >= PLAYER_FROM;
const isPlayer = it => hasTier(it) && it.player === true;
const tierOf = it => (!hasTier(it) ? null : it.player ? 'player' : 'aficionado');
// Asigna la versión a piezas que aún no la tienen (partidas guardadas antiguas)
function ensureTier(it) {
  if (!it) return it;
  if (!hasTier(it)) { delete it.player; return it; }
  if (typeof it.player !== 'boolean') it.player = Math.random() < PLAYER_CHANCE;
  return it;
}

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
    day: 1, money: 600, rep: 5, xp: 0, local: 0, shelfCap: LOCALES[0].cap, upgrades: 0,
    stock: [], market: [], trends: {}, fakeBoost: 0, traffic: 0,
    pendingReturns: [], news: [], nextUid: 1, nextOffer: 1,
    stats: { sold: 0, profit: 0, revenue: 0 },
    goalReached: false, seenIntro: false, over: false,
    featured: [], view: { filter: 'all', sort: 'manual', mode: 'cards', v3: true }, marketSort: 'ganga', sizeLost: {},
    collection: [], cview: { sort: 'cond', filter: 'all' },   // colección: piezas apartadas de la tienda
  };
  applyLocal();
  S.market = genMarket();
  S.packs = genPacks(true);   // el primer día siempre hay al menos un lote
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
  return kit.base * COND[it.cond].coef * SIZES[it.size] * (it.special ? 2.2 : 1) * trendMult(kit) * (isPlayer(it) ? PLAYER_MULT : 1)
    * (typeof restoreMult === 'function' ? restoreMult(it) : 1);
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
  return S.money + S.stock.concat(S.collection || []).reduce((s, it) => s + estimate(it).mid, 0);
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
  return FAME_BASE[kit.rarity] * FAME_COND[it.cond] * (it.special ? 2 : 1) * auth * (S.featured.includes(it.uid) ? 1.5 : 1)
    * (typeof collectFameMult === 'function' ? collectFameMult(it) : 1);
}

function fame() {
  const items = S.stock.concat(S.collection || []).map(it => ({ it, pts: fameOf(it) }));   // almacén + colección
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
function genItem(filter) {
  const ft = fame().tier;   // con fama, los vendedores te traen más piezas raras
  const pool = filter ? KITS.filter(filter) : KITS;
  const kit = weighted(pool.length ? pool : KITS, x => ({ 1: 10, 2: 6, 3: 3, 4: 1.3 })[x.rarity] * (x.rarity >= 3 ? 1 + 0.2 * ft : 1));
  const player = kit.year >= PLAYER_FROM ? Math.random() < PLAYER_CHANCE : undefined;
  const fakeChance = 0.08 + 0.05 * (kit.rarity - 1) + (S.fakeBoost > 0 ? 0.2 : 0) + (player ? PLAYER_FAKE : 0);
  const item = {
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
  if (player !== undefined) item.player = player;
  return item;
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

function genPackItem(src, filter) {
  const minR = src.minRarity || 0;
  const f = filter || minR ? (x => (!filter || filter(x)) && x.rarity >= minR) : null;
  const it = genItem(f);
  if (src.cond) it.cond = weighted(CONDITIONS.filter(c => src.cond[c.id] > 0), c => src.cond[c.id]).id;
  if (src.real != null) it.real = Math.random() < src.real - (S.fakeBoost > 0 ? src.boost : 0) - (isPlayer(it) ? PLAYER_FAKE : 0);
  return it;
}

function genPack(srcId) {
  const src = PACK_SOURCES[srcId];
  const n = randInt(src.size[0], src.size[1]);
  let filter = PACK_THEMES[src.theme] || null, team = null;
  if (src.theme === 'team') {
    // un equipo de club con al menos 3 camisetas en el catálogo
    const counts = {};
    KITS.forEach(x => { if (!x.nat) counts[x.team] = (counts[x.team] || 0) + 1; });
    team = pick(Object.keys(counts).filter(t => counts[t] >= 3));
    filter = x => x.team === team;
  }
  const used = new Set();
  const items = Array.from({ length: n }, () => {
    let item;
    for (let t = 0; t < 6; t++) {                 // evita repetir la misma camiseta en el lote
      item = genPackItem(src, filter);
      if (!used.has(item.kitId)) break;
    }
    used.add(item.kitId);
    return { item, price: Math.max(3, nice(valueIfReal(item) * rand(src.ask[0], src.ask[1]))) };
  });
  const name = team ? `Lote ${team}` : src.names ? pick(src.names) : pick(NAMES);
  return { id: S.nextOffer++, src: srcId, name, items };
}

// Cada día hay un número distinto de lotes (0-4) y de vendedores distintos
function genPacks(guarantee) {
  let n = weighted(PACK_COUNT_W, x => x[1])[0];
  if (guarantee) n = Math.max(n, 1);
  const ids = Object.keys(PACK_SOURCES);
  const out = [];
  for (let i = 0; i < n && ids.length; i++) {
    const id = weighted(ids, s => PACK_SOURCES[s].w || 10);
    ids.splice(ids.indexOf(id), 1);
    out.push(genPack(id));
  }
  return out;
}

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
  if (!it.verified) {
    // impresión tras inspeccionarla a ojo (no es seguro)
    if (it.hint === 'real') return '<span class="chip good" title="Solo es una impresión a ojo">🔍 Parece auténtica</span>';
    if (it.hint === 'fake') return '<span class="chip bad" title="Solo es una impresión a ojo">🔍 Sospechosa</span>';
    if (it.hint === 'unsure') return '<span class="chip warn" title="No lo has visto claro">🔍 Dudosa</span>';
    return '<span class="chip warn">? Sin verificar</span>';
  }
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

// Etiqueta de versión: «🎽 Player» (dorada/grafito) o «Aficionado» (neutra). Sin etiqueta antes de 1991.
function tierChip(it) {
  const t = tierOf(it);
  if (!t) return '';
  return t === 'player'
    ? '<span class="chip player" title="Versión Player: vale más, pero es más delicada y se falsifica más">🎽 Player</span>'
    : '<span class="chip aficionado" title="Versión Aficionado">Aficionado</span>';
}

const COND_SHORT = { nueva: 'Nueva', excelente: 'Excelente', buena: 'Buena', usada: 'Usada' };

function itemHead(it) {
  const kit = kitOf(it);
  const inStock = S.stock.includes(it);
  const status = [it.special ? '<span class="chip good">✍️ Firmada · ×2,2 de valor</span>' : '', tierChip(it), authChip(it), typeof ownedChip === 'function' ? ownedChip(it) : '', trendChip(kit), inStock ? fameChip(it) : '', inStock && typeof restoreChips === 'function' ? restoreChips(it) : ''].join('');
  return `
    <div class="thumb">${kitImage(kit, it)}${it.special ? '<span class="signed">Firmada</span>' : ''}</div>
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
    typeof ownedFlag === 'function' ? ownedFlag(it) : '',
  ].join('');
  return `
    <article class="card mcard r${kit.rarity}" data-offer="${o.id}">
      <div class="thumb mc-thumb">
        ${kitImage(kit, it)}
        <span class="mc-stars" title="${RARITY_LABELS[kit.rarity]}">${stars(kit.rarity)}</span>
        <div class="price-tag" aria-label="Precio pedido"><small>Pide</small>${fmt(o.ask)}</div>
        ${flags ? `<div class="mc-flags">${flags}</div>` : ''}
      </div>
      <div class="mc-body">
        <h3>${kit.team} ${kit.year}</h3>
        <p class="mc-sub">${kit.type} · ${kit.brand}</p>
        <div class="mc-pills"><span class="chip size">${it.size}</span><span class="chip">${COND_SHORT[it.cond] || COND[it.cond].label}</span>${tierChip(it)}${authChip(it)}${trendChip(kit)}</div>
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
const maxFeatured = () => local().showcase;
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

const lockBtn = it => {
  const on = !!it.locked;
  const label = on ? 'Desbloquear: volver a ponerla a la venta' : 'Bloquear: no se vende y mantiene la fama';
  return `<button class="lock${on ? ' on' : ''}" data-action="lock" data-uid="${it.uid}" aria-pressed="${on}" aria-label="${label}" title="${label}">${on ? '🔒' : '🔓'}</button>`;
};

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
      ${typeof restoreBar === 'function' ? restoreBar(it) : ''}
      <div class="actions">
        ${moveBtns(it, pos)}
        ${authBtn(it)}${typeof collectBtn === 'function' ? collectBtn(it) : ''}
        <button class="btn" data-action="suggest" data-uid="${it.uid}">Sugerido</button>
      </div>
    </article>`;
}

// Fila compacta (vista «Lista»)
function shopRow(it, pos) {
  const kit = kitOf(it);
  return `
    <article class="row r${kit.rarity}" data-uid="${it.uid}">
      <div class="thumb">${kitImage(kit, it)}</div>
      <div class="row-main">
        <h3>${kit.team} ${kit.year} <small>${kit.type}</small></h3>
        <div class="chips"><span class="chip size">${it.size}</span><span class="chip">${COND[it.cond].label}</span>${tierChip(it)}${authChip(it)}${trendChip(kit)}${fameChip(it)}</div>
        <p class="seller">Pagaste ${fmt(it.paid)} · ${marginHTML(it)} · ${itemAge(it)} d</p>
        ${authBtn(it, 'sm')}${typeof collectBtn === 'function' ? collectBtn(it, 'sm') : ''}${typeof restoreBtn === 'function' ? restoreBtn(it, 'sm') : ''}
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
    <article class="tile r${kit.rarity}${hero ? ' hero' : ''}${it.locked ? ' locked' : ''}" data-uid="${it.uid}">
      ${starBtn(it, true)}
      <span class="rar-tag r${kit.rarity}">${hero ? '⭐ ' : ''}${hero ? 'Pieza estrella' : RARITY_LABELS[kit.rarity]}</span>
      <div class="thumb">${kitImage(kit, it)}${it.special ? '<span class="signed">Firmada</span>' : ''}${it.locked ? '<span class="lock-flag">🔒 No se vende</span>' : ''}</div>
      <div class="plate">
        <h3>${kit.team} ${kit.year}</h3>
        <p class="sub">${kit.type} · Talla ${it.size} · ${COND[it.cond].label}${tierOf(it) === 'player' ? ' · 🎽 Player' : ''}${hero ? ` · ${RARITY_LABELS[kit.rarity]}` : ''}</p>
      </div>
      <div class="tile-price">${miniPrice(it)}${lockBtn(it)}</div>
      <div class="tile-foot">${moveBtns(it, pos)}<span class="seller">${marginHTML(it)}</span></div>
    </article>`;
}

// ---------- Tienda: organización ----------
const FILTERS = [['all', 'Todo'], ['nat', 'Selecciones'], ['club', 'Clubes'], ['gk', 'Porteros'], ['rare', 'Raras'], ['player', '🎽 Player'], ['unver', 'Sin verificar']];
const SORTS = [['manual', 'Mi orden'], ['recent', 'Más recientes'], ['margin', 'Mayor margen'], ['price', 'Mayor precio'], ['year', 'Más antiguas'], ['team', 'Equipo A-Z']];

const FILTER_TESTS = {
  nat: it => kitOf(it).nat && kitOf(it).type !== 'Portero',
  club: it => !kitOf(it).nat && kitOf(it).type !== 'Portero',
  gk: it => kitOf(it).type === 'Portero',
  rare: it => kitOf(it).rarity >= 3 || it.special,
  player: it => isPlayer(it),
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
  const tierName = `${local().icon} ${local().name} · ${FAME_TIERS[fame().tier].name}`;
  return `<div class="sc-awning" aria-hidden="true"></div>
    <div class="sc-window">
      <div class="showcase-head">
        <div><h3>🪟 Escaparate</h3><small class="sc-tier">${tierName}</small></div>
        <div class="sc-meta"><span class="sc-boost" title="Las piezas del escaparate puntúan más fama">×1,5 fama</span><small>${items.length}/${slots} expuestas${items.some(i => i.locked) ? ` · 🔒 ${items.filter(i => i.locked).length}` : ''}</small></div>
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
    const it = S.stock.find(x => x.uid === uid);
    if (it) it.locked = false;   // fuera del escaparate, vuelve a estar a la venta
  } else {
    if (featuredItems().length >= maxFeatured()) { toast(`El escaparate admite ${maxFeatured()} camisetas como máximo. Quita una para poner otra.`); return; }
    S.featured.push(uid);
  }
  save(); renderAll();
}

// Bloquear una pieza del escaparate: no se vende, pero sigue sumando fama
function toggleLock(uid) {
  uid = Number(uid);
  const it = S.stock.find(x => x.uid === uid);
  if (!it || !S.featured.includes(uid)) return;
  it.locked = !it.locked;
  toast(it.locked ? 'Bloqueada: no se venderá y sigue sumando fama.' : 'Desbloqueada: vuelve a estar a la venta.');
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
  const thumbs = p.items.map(x => `<span class="pk-th">${kitImage(kitOf(x.item), x.item)}</span>`).join('');
  return `
    <article class="card pcard">
      <div class="pk-head"><span class="pk-icon">${src.icon}</span><div><h3>${p.name}</h3><p class="mc-sub">${src.label} · ${p.items.length} camisetas</p></div></div>
      <div class="pk-thumbs">${thumbs}</div>
      <div class="mc-pills"><span class="chip hot">Hasta −${Math.round(q.d * 100)} %</span><span class="chip ${src.tagCls}">${src.tag}</span>${typeof packOwnedChip === 'function' ? packOwnedChip(p) : ''}</div>
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
    : '<p class="sub">Hoy no hay lotes en el mercado. Mañana puede haber más, o prueba con «Buscar más».</p>';
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
  renderLocalBox(f);
  const nx = nextLocal();
  $('#btn-upgrade').textContent = nx ? `Mudarse (${fmt(nx.cost)})` : 'Local máximo';
  $('#btn-upgrade').disabled = !nx;
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
  // Los conjuntos (Leyendas, Años 90…) se ven en la pestaña Colección; aquí solo el resumen de fama
  const top = f.items.filter(x => x.pts >= 1).sort((a, b) => b.pts - a.pts).slice(0, 5)
    .map(x => `<li><b>${title(x.it)}</b><small>Talla ${x.it.size}${x.it.collected ? ' · en colección' : S.featured.includes(x.it.uid) ? ' · en escaparate' : ''}</small><em>+${Math.round(x.pts * 10) / 10}</em></li>`).join('');
  $('#fame-box').innerHTML = `
    <p class="sub">Fama total: <b>${f.score}</b> (piezas ${Math.round(f.base)} + conjuntos ${f.bonus}). Completa conjuntos en la pestaña <b>Colección</b> para sumar puntos extra.</p>
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
  S.stock.forEach(it => { if (it.locked && !S.featured.includes(it.uid)) it.locked = false; });
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
  if (typeof renderCollectionTab === 'function') renderCollectionTab(f);
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
// ---------- Locales: lógica ----------
const local = () => LOCALES[clamp(S.local || 0, 0, LOCALES.length - 1)];
const nextLocal = () => LOCALES[(S.local || 0) + 1] || null;
function upgradeCost() { const n = nextLocal(); return n ? n.cost : 0; }

// Aplica al estado lo que da el local actual (perchas y alquiler)
function applyLocal() {
  const l = local();
  S.shelfCap = l.cap;
  S.upgrades = S.local;   // compatibilidad con código que lo lea
  RENT = l.rent;
}

function localBoxHTML(f) {
  const l = local(), n = nextLocal();
  const steps = LOCALES.map((x, i) => `<span class="lc-dot${i < S.local ? ' done' : i === S.local ? ' now' : ''}" title="${x.name}">${x.icon}</span>`).join('');
  let next;
  if (n) {
    const okM = S.money >= n.cost, okF = f.score >= n.minFame;
    const pct = clamp(S.money / n.cost * 100, 0, 100);
    next = `<div class="lc-next">
      <p>Siguiente: <b>${n.icon} ${n.name}</b> · ${n.cap} perchas · alquiler ${fmt(n.rent)}/día</p>
      <div class="fame-track"><div style="width:${pct}%"></div></div>
      <small class="lc-req"><span class="${okM ? 'ok' : 'no'}">${okM ? '✔' : '✖'} ${fmt(n.cost)} en caja</span>${n.minFame ? ` · <span class="${okF ? 'ok' : 'no'}">${okF ? '✔' : '✖'} ${n.minFame} pts de fama (tienes ${f.score})</span>` : ''}</small>
    </div>`;
  } else {
    next = '<small class="lc-req">Has llegado al mejor local de la ciudad.</small>';
  }
  return `<div class="lc-head"><b>${l.icon} ${l.name}</b><span>${l.zone}</span></div>
    <p class="lc-desc">${l.desc}</p>
    <div class="lc-stats"><span>📦 ${l.cap} perchas</span><span>🪟 ${l.showcase} en escaparate</span><span>🏠 ${fmt(l.rent)}/día</span>${l.traffic ? `<span>🧍 +${l.traffic} clientes/día</span>` : ''}</div>
    <div class="lc-steps" aria-label="Progresión de locales">${steps}</div>
    ${next}`;
}

function renderLocalBox(f = fame()) {
  let box = $('#local-box');
  if (!box) {
    box = document.createElement('section');
    box.id = 'local-box';
    box.className = 'local-box';
    const anchor = $('#fame-bar');
    anchor.parentNode.insertBefore(box, anchor);
  }
  box.innerHTML = localBoxHTML(f);
}

// Mudarse al siguiente local: cuesta dinero (y algo de fama a partir del tercero)
async function upgradeShop() {
  if (S.busy) return;
  const n = nextLocal();
  if (!n) { toast('Ya tienes el mejor local de la ciudad.'); return; }
  if (S.money < n.cost) { toast(`Te faltan ${fmt(n.cost - S.money)} para mudarte a «${n.name}».`); return; }
  const f = fame();
  if (f.score < n.minFame) { toast(`Para mudarte a «${n.name}» necesitas ${n.minFame} pts de fama (tienes ${f.score}).`); return; }
  const cur = local();
  const left = S.money - n.cost;
  const warn = left < n.rent * 3
    ? `<p class="dr-more">⚠️ Te quedarán ${fmt(left)} en caja: ojo con el alquiler y con tener dinero para comprar género.</p>` : '';
  const r = await dialog(`
    <div class="report">
      <h3>${n.icon} ${n.name}</h3>
      <p>${n.desc}</p>
      <ul>
        <li>Perchas: <b>${cur.cap} → ${n.cap}</b></li>
        <li>Escaparate: <b>${cur.showcase} → ${n.showcase}</b> ${n.showcase === 1 ? 'hueco' : 'huecos'}</li>
        <li>Alquiler diario: <b>${fmt(cur.rent)} → ${fmt(n.rent)}</b></li>
        <li>Clientes extra al día: <b>+${cur.traffic} → +${n.traffic}</b></li>
        <li>Coste de la mudanza: <b>${fmt(n.cost)}</b></li>
      </ul>
      ${warn}
      <div class="actions"><button class="btn primary" data-choice="yes">Mudarme</button><button class="btn ghost" data-choice="no">Ahora no</button></div>
    </div>`);
  closeDialog();
  if (r.choice !== 'yes') return;
  S.money -= n.cost;
  S.local++;
  applyLocal();
  log(`Te mudas a «${n.name}» (${n.zone}): ahora tienes ${S.shelfCap} perchas y pagas ${fmt(RENT)} de alquiler al día.`);
  toast(`¡Nuevo local! ${n.name}: ${S.shelfCap} perchas.`);
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
  S.traffic = local().traffic;   // clientes extra por la zona del local
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
      S.traffic += randInt(ev.extra[0], ev.extra[1]);
      log(ev.text());
    } else if (ev.kind === 'fakes') {
      S.fakeBoost = randInt(ev.days[0], ev.days[1]);
      log(ev.text());
    }
  }
}

// Resumen del día (ventana al cerrar la tienda): resultado grande, tres datos clave, ventas y movimientos.
// Los clientes que no compraron ya no se detallan.
function dayReportHTML(d) {
  const money = n => (n < 0 ? '−' : '+') + fmt(Math.abs(n));
  const sold = d.sales.length;
  const mood = sold === 0 ? 'Hoy no se ha vendido nada' : d.net < 0 ? 'Día flojo' : sold >= 4 ? '¡Gran día de ventas!' : 'Buen día';

  // «Camiseta 1998: 120 € (+30 €)» → nombre · precio · beneficio (si no encaja, se muestra tal cual)
  const saleRow = s => {
    const m = /^(.+?): ([^(]+?)\s*\(([^)]*)\)/.exec(s);
    if (!m) return `<div class="dr-sale"><span class="dr-name">${s}</span></div>`;
    const loss = /^[-−–]/.test(m[3].trim());
    return `<div class="dr-sale"><span class="dr-name">${m[1]}</span><b>${m[2]}</b><em class="${loss ? 'neg' : 'pos'}">${m[3]}</em></div>`;
  };
  const MAX_SALES = 3;
  const salesBlock = sold ? `
    <div class="dr-block" style="--i:2">
      <h4>Ventas de hoy</h4>
      ${d.sales.slice(0, MAX_SALES).map(saleRow).join('')}
      ${sold > MAX_SALES ? `<p class="dr-more">y ${sold - MAX_SALES} más</p>` : ''}
    </div>` : '';

  const rowsHTML = d.rows.map(r => `
      <div class="dr-row"><span class="dr-ico">${r.ico}</span><span class="dr-lab">${r.label}${r.note ? `<small>${r.note}</small>` : ''}</span><b class="${r.amt < 0 ? 'neg' : 'pos'}">${money(r.amt)}</b></div>`).join('');
  const fameRow = d.fameLost >= 1
    ? `<div class="dr-row soft"><span class="dr-ico">📉</span><span class="dr-lab">Fama perdida por vender</span><b class="neg">−${d.fameLost} pts</b></div>` : '';

  return `
    <div class="report dr">
      <div class="dr-hero${d.net < 0 ? ' down' : ''}">
        <div class="dr-sky" aria-hidden="true"></div>
        <span class="dr-moon" aria-hidden="true">🌙</span>
        <small>Cierre del día ${d.day}</small>
        <div class="dr-net">${money(d.net)}</div>
        <p>${mood}</p>
      </div>
      <div class="dr-stats" style="--i:1">
        <div><i aria-hidden="true">🧍</i><b>${d.customers}</b><small>clientes</small></div>
        <div><i aria-hidden="true">👕</i><b>${sold}</b><small>vendidas</small></div>
        <div><i aria-hidden="true">💼</i><b>${fmt(d.cash)}</b><small>en caja</small></div>
      </div>
      ${salesBlock}
      <div class="dr-block" style="--i:3">
        <h4>Movimientos</h4>
        <div class="dr-ticket">${rowsHTML}${fameRow}</div>
      </div>
      ${d.news.length ? `<div class="dr-news" style="--i:4"><h4>📰 Para mañana</h4>${d.news.map(n => `<p>${n}</p>`).join('')}</div>` : ''}
      <div class="actions"><button class="btn big" data-choice="ok">Empezar el día ${d.next}</button></div>
    </div>`;
}

async function endDay(report) {
  overnightSales(report);   // ventas de un día para otro: pagan y se van sin regatear
  S.money -= RENT;
  const rows = [];   // movimientos de dinero del día, para el resumen
  if (report.income) rows.push({ ico: '💰', label: 'Ventas', amt: report.income });
  rows.push({ ico: '🏠', label: 'Alquiler', amt: -RENT });
  const fm = fame();
  const visitIncome = FAME_TIERS[fm.tier].income;
  if (visitIncome > 0) {
    S.money += visitIncome;
    rows.push({ ico: '🏛️', label: `Visitas · ${FAME_TIERS[fm.tier].name}`, amt: visitIncome });
  }
  const mu = typeof museumInfo === 'function' ? museumInfo() : null;
  if (mu && mu.income > 0) {
    S.money += mu.income;
    rows.push({ ico: '📚', label: `Entradas · ${mu.name}`, amt: mu.income });
  }

  S.day++;
  if (S.pendingReturns.length) {
    S.pendingReturns.forEach(r => {
      S.money -= r.refund;
      S.rep = clamp(S.rep - 4, 0, 100);
      log(`Devolución: un cliente descubrió que ${r.name} era una réplica. Reembolsas ${fmt(r.refund)} y pierdes reputación.`);
      rows.push({ ico: '↩️', label: `Devolución · ${r.name}`, amt: -r.refund, note: 'Era una réplica' });
    });
    S.pendingReturns = [];
  }
  startOfDayEvents();
  S.market = genMarket();
  S.packs = genPacks();

  const todayNews = S.news.filter(n => n.day === S.day && !n.text.startsWith('Devolución:')).map(n => n.text);   // las devoluciones ya salen en Movimientos

  const html = dayReportHTML({
    day: S.day - 1, next: S.day, customers: report.customers, sales: report.sales, rows,
    net: rows.reduce((a, r) => a + r.amt, 0), cash: S.money, fameLost: Math.round(report.fameLost || 0), news: todayNews,
  });
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
        <li>En <b>Colección</b> aparta tus camisetas <b>originales</b> (autenticadas) para exponerlas: no se venden y, cuanto mejor estado, más puntos, fama y entradas diarias.</li>
        <li>Empiezas en un <b>localito del barrio</b> con pocas perchas. Reúne caja (y fama) para <b>mudarte</b> a locales mejores: más perchas y más clientes, pero también más alquiler.</li>
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
    else if (a === 'restore') openRestore(b.dataset.uid);
    else if (a === 'filter') { S.view.filter = S.view.filter === b.dataset.f ? 'all' : b.dataset.f; save(); renderAll(); }
    else if (a === 'feature') toggleFeature(b.dataset.uid);
    else if (a === 'lock') toggleLock(b.dataset.uid);
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
  if (typeof S.local !== 'number') {   // partida antigua: el local que más se acerque a sus perchas sin quitarle ninguna
    const i = LOCALES.findIndex(l => l.cap >= (S.shelfCap || 0));
    S.local = i < 0 ? LOCALES.length - 1 : i;
  }
  applyLocal();
  S.featured = S.featured || []; S.sizeLost = S.sizeLost || {};
  S.collection = S.collection || []; S.cview = S.cview || { sort: 'cond', filter: 'all' };
  if (!S.packs) S.packs = genPacks();
  // partidas antiguas: reparte la versión Player/Aficionado entre las piezas que no la tenían
  [].concat(S.stock, S.collection, S.market.map(o => o.item), ...S.packs.map(p => p.items.map(x => x.item))).forEach(ensureTier);
  if (!S.view || !S.view.v3) S.view = { filter: 'all', sort: 'manual', mode: 'cards', v3: true }; S.marketSort = S.marketSort || 'ganga';
  bind();
  renderAll();
  if (!S.seenIntro) intro();
}

document.addEventListener('DOMContentLoaded', init);
