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
      featured: [], view: { filter: 'all', sort: 'recent' }, marketSort: 'ganga', sizeLost: {},
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

  // ---------- Generación ----------
  function genItem() {
    const kit = weighted(KITS, x => ({ 1: 10, 2: 6, 3: 3, 4: 1.3 })[x.rarity]);
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

  function shirtSVG(kit) {
    const id = 'cl' + (svgCount++);
    const body = 'M70 20 L40 32 L8 70 L34 92 L52 78 L52 180 L148 180 L148 78 L166 92 L192 70 L160 32 L130 20 Q100 44 70 20 Z';
    const c1 = kit.c1, c2 = kit.c2;
    let pat = '';
    switch (kit.pattern) {
      case 'stripes':
        for (let x = 4; x < 196; x += 26) pat += `<rect x="${x}" y="0" width="13" height="200" fill="${c2}"/>`;
        break;
      case 'hoops':
        for (let y = 24; y < 190; y += 26) pat += `<rect x="0" y="${y}" width="200" height="13" fill="${c2}"/>`;
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
        <rect width="200" height="200" fill="url(#${id}g)"/>
      </g>
      ${collarSVG(kit)}
      <path d="M8 70 L34 92 M192 70 L166 92" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="125" cy="62" r="6.5" fill="${c2}" stroke="rgba(0,0,0,.3)"/>
      <rect x="73" y="58" width="10" height="3" rx="1.5" fill="${c2}"/>
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

  function estimateText(it) {
    const e = estimate(it);
    return `${fmt(e.low)} – ${fmt(e.high)}`;
  }

  function itemHead(it) {
    const kit = kitOf(it);
    return `
      <div class="thumb">${kitImage(kit)}${it.special ? '<span class="signed">Firmada</span>' : ''}</div>
      <div class="info">
        <h3>${kit.team} ${kit.year}</h3>
        <p class="sub">${kit.type} · ${kit.brand}</p>
        <div class="chips">
          <span class="chip">${eraLabel(kit)}</span>
          <span class="chip" title="${RARITY_LABELS[kit.rarity]}">${stars(kit.rarity)}</span>
          <span class="chip size">Talla ${it.size}</span>
          <span class="chip">${COND[it.cond].label}</span>
          ${authChip(it)}
          ${trendChip(kit)}
        </div>
        <p class="est">Valoración: <b>${estimateText(it)}</b></p>
      </div>`;
  }

  const sizeCount = z => S.stock.filter(i => i.size === z).length;

  function marketCard(o) {
    const it = o.item;
    const s = SELLERS[o.seller];
    const est = estimate(it);
    const ganga = o.ask <= est.mid * 0.6;
    return `
      <article class="card r${kitOf(it).rarity}" data-offer="${o.id}">
        ${itemHead(it)}
        <p class="seller">${s.emoji} ${o.name} · ${s.label}</p>
        <div class="price-tag" aria-label="Precio pedido"><small>Pide</small>${fmt(o.ask)}</div>
        <div class="badges">${ganga ? '<span class="deal">Posible ganga</span>' : ''}${sizeCount(it.size) === 0 ? `<span class="deal need">🧩 Te falta la ${it.size}</span>` : ''}</div>
        <div class="actions">
          <button class="btn" data-action="negotiate" data-id="${o.id}">Negociar</button>
          <button class="btn primary" data-action="buy" data-id="${o.id}">Comprar</button>
        </div>
      </article>`;
  }

  function shopCard(it) {
    const margin = it.listPrice - it.paid;
    const star = S.featured.includes(it.uid);
    const age = S.day - (it.since || S.day);
    return `
      <article class="card r${kitOf(it).rarity}${star ? ' featured' : ''}" data-uid="${it.uid}">
        <button class="star${star ? ' on' : ''}" data-action="feature" data-uid="${it.uid}" aria-pressed="${star}" aria-label="Destacar en el escaparate" title="Destacar: los clientes la ven antes">★</button>
        ${itemHead(it)}
        <p class="seller">Pagaste ${fmt(it.paid)} · Margen <b class="${margin >= 0 ? 'pos' : 'neg'}">${margin >= 0 ? '+' : ''}${fmt(margin)}</b> · ${age} d</p>
        <button class="price-btn" data-action="editprice" data-uid="${it.uid}"><small>Tu precio</small><b>${fmt(it.listPrice)}</b><span>✎ Cambiar</span></button>
        <div class="actions">
          ${it.verified ? '' : `<button class="btn" data-action="auth" data-uid="${it.uid}">Autenticar (${fmt(AUTH_COST)})</button>`}
          <button class="btn" data-action="suggest" data-uid="${it.uid}">Precio sugerido</button>
        </div>
      </article>`;
  }

  // ---------- Organización de la tienda ----------
  const FILTERS = [['all', 'Todo'], ['star', '⭐ Destacadas'], ['nat', 'Selecciones'], ['club', 'Clubes'], ['gk', 'Porteros'], ['rare', 'Raras'], ['unver', 'Sin verificar']];
  const maxFeatured = () => FEATURED_BASE + S.upgrades;

  function filterStock() {
    const f = S.view.filter;
    const list = S.stock.filter(it => {
      const k = kitOf(it);
      if (f === 'nat') return k.nat && k.type !== 'Portero';
      if (f === 'club') return !k.nat && k.type !== 'Portero';
      if (f === 'gk') return k.type === 'Portero';
      if (f === 'rare') return k.rarity >= 3 || it.special;
      if (f === 'star') return S.featured.includes(it.uid);
      if (f === 'unver') return !it.verified;
      if (SIZE_ORDER.includes(f)) return it.size === f;
      return true;
    });
    const by = {
      recent: (a, b) => b.uid - a.uid,
      margin: (a, b) => (b.listPrice - b.paid) - (a.listPrice - a.paid),
      price: (a, b) => b.listPrice - a.listPrice,
      year: (a, b) => kitOf(a).year - kitOf(b).year,
      team: (a, b) => title(a).localeCompare(title(b), 'es'),
      size: (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
    }[S.view.sort] || (() => 0);
    return list.sort(by);
  }

  function shopToolsHTML() {
    const chips = FILTERS.map(([f, l]) => `<button class="fchip${S.view.filter === f ? ' on' : ''}" data-action="filter" data-f="${f}">${l}</button>`).join('');
    const opts = [['recent', 'Más recientes'], ['margin', 'Mayor margen'], ['price', 'Mayor precio'], ['year', 'Más antiguas'], ['team', 'Equipo A-Z'], ['size', 'Talla']]
      .map(([v, l]) => `<option value="${v}"${S.view.sort === v ? ' selected' : ''}>${l}</option>`).join('');
    return `<div class="fchips">${chips}</div>
      <div class="tool-row"><label>Ordenar <select data-sort>${opts}</select></label><button class="btn sm" data-action="suggestall">Precio sugerido a todo</button></div>`;
  }

  function sizePanelHTML() {
    const tot = SIZE_ORDER.reduce((a, z) => a + SIZE_DEMAND[z], 0);
    return SIZE_ORDER.map(z => {
      const n = sizeCount(z);
      const pct = Math.round(SIZE_DEMAND[z] / tot * 100);
      const lost = S.sizeLost[z] || 0;
      return `<button class="size-tile${n ? '' : ' empty'}${S.view.filter === z ? ' on' : ''}" data-action="filter" data-f="${z}">
        <b>${z}</b><span>${n ? n + ' en tienda' : 'Sin stock'}</span><i style="--w:${pct}%"></i><small>Demanda ${pct} %${lost ? ' · ' + lost + ' perdidas' : ''}</small></button>`;
    }).join('');
  }

  function sortedMarket() {
    const g = o => o.ask / estimate(o.item).mid;
    const f = {
      ganga: (a, b) => g(a) - g(b),
      price: (a, b) => a.ask - b.ask,
      rare: (a, b) => kitOf(b.item).rarity - kitOf(a.item).rarity,
      need: (a, b) => sizeCount(a.item.size) - sizeCount(b.item.size),
    }[S.marketSort] || (() => 0);
    return S.market.slice().sort(f);
  }

  function marketToolsHTML() {
    const opts = [['ganga', 'Mejor ganga'], ['price', 'Más baratas'], ['rare', 'Más raras'], ['need', 'Tallas que me faltan']]
      .map(([v, l]) => `<option value="${v}"${S.marketSort === v ? ' selected' : ''}>${l}</option>`).join('');
    return `<div class="tool-row"><label>Ordenar <select data-msort>${opts}</select></label></div>`;
  }

  function toggleFeature(uid) {
    uid = Number(uid);
    if (S.featured.includes(uid)) S.featured = S.featured.filter(u => u !== uid);
    else if (S.featured.length >= maxFeatured()) { toast(`Máximo ${maxFeatured()} destacadas. Amplía la tienda para más.`); return; }
    else S.featured.push(uid);
    save(); renderAll();
  }

  // ---------- Render ----------
  function renderAll() {
    $('#st-day').textContent = S.day;
    const money = $('#st-money'), mt = fmt(S.money);
    if (money.textContent !== mt) { money.textContent = mt; money.classList.remove('tick'); void money.offsetWidth; money.classList.add('tick'); }
    $('#st-rep').textContent = Math.round(S.rep);
    $('#st-level').textContent = level();
    const nw = netWorth();
    $('#goal-fill').style.width = clamp((nw / GOAL) * 100, 0, 100) + '%';
    $('#goal-text').textContent = `Patrimonio ${fmt(nw)} de ${fmt(GOAL)}`;

    $('#market-tools').innerHTML = marketToolsHTML();
    $('#market-grid').innerHTML = S.market.length
      ? sortedMarket().map(marketCard).join('')
      : '<p class="empty">No quedan ofertas hoy. Busca más o cierra el día.</p>';

    $('#shop-cap').textContent = `${S.stock.length} de ${S.shelfCap} perchas · ⭐ ${S.featured.length}/${maxFeatured()} destacadas`;
    $('#btn-upgrade').textContent = `Ampliar +6 perchas (${fmt(upgradeCost())})`;
    $('#size-panel').innerHTML = sizePanelHTML();
    const missing = SIZE_ORDER.filter(z => sizeCount(z) === 0);
    $('#size-hint').textContent = !S.stock.length ? ''
      : missing.length ? `Sin stock de ${missing.join(', ')}. Se piden menos, pero quien llega buscándola y no la encuentra se va sin comprar.`
      : 'Tienes todas las tallas cubiertas.';
    $('#shop-tools').innerHTML = shopToolsHTML();
    const shown = filterStock();
    $('#shop-grid').innerHTML = !S.stock.length
      ? '<p class="empty">El escaparate está vacío. Compra camisetas en el Mercado.</p>'
      : shown.length ? shown.map(shopCard).join('') : '<p class="empty">Ninguna camiseta con este filtro.</p>';

    $('#btn-refresh').textContent = `Buscar más (${fmt(REFRESH_COST)})`;

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
        const kp = e.target.closest('[data-key]');
        if (kp) {
          const k = kp.dataset.key;
          editField(sheet, v => (k === 'del' ? v.slice(0, -1) : k === 'clr' ? '' : v.length < 5 ? (v + k).replace(/^0+(?=[0-9])/, '') : v));
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
      <button class="key alt" data-key="del" aria-label="Borrar un dígito">⌫</button></div>`;
  }

  function fieldHTML(label, value) {
    return `<div class="price-field"><small>${label}</small>
      <div class="pf-row">
        <button class="step" data-step="-5" aria-label="Restar 5 euros">−5</button>
        <div class="pf-box"><input id="sheet-input" readonly inputmode="none" tabindex="-1" aria-label="${label}" value="${value}"><span>€</span></div>
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
    const est = estimate(it), sug = nice(est.mid * 1.2);
    const max = Math.max(it.listPrice, est.high, it.paid, sug) * 1.3;
    const r = await dialog(`<div class="neg">
      <div class="neg-head"><div class="thumb sm">${kitImage(kitOf(it))}</div>
        <div><h3>${title(it)} · ${kitOf(it).type}</h3><p class="sub">Talla ${it.size} · ${COND[it.cond].label}</p><p class="est">Valoración: <b>${estimateText(it)}</b></p></div></div>
      ${trackHTML(max, est, [{ cls: 'cost', label: 'Pagaste', v: it.paid }, { id: 'pin-you', cls: 'you', label: 'Tu precio', v: it.listPrice }])}
      ${fieldHTML('Tu precio', it.listPrice)}
      <div class="fchips"><button class="fchip" data-fill="1" data-base="${sug}">Sugerido ${fmt(sug)}</button><button class="fchip" data-fill="1.15" data-base="${it.paid}">Coste +15 %</button><button class="fchip" data-fill="1.3" data-base="${it.paid}">Coste +30 %</button></div>
      ${keypadHTML()}
      <div class="actions wrap"><button class="btn primary" data-choice="save">Guardar precio</button><button class="btn ghost" data-choice="cancel">Cancelar</button></div></div>`);
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
      <div class="neg">
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
        <div class="actions wrap">
          <button class="btn primary" data-choice="offer">Ofrecer</button>
          <button class="btn" data-choice="accept">Pagar ${fmt(offer.ask)}</button>
        </div>
        <div class="actions wrap tactics">
          <button class="btn sm" data-choice="defects"${used.defects ? ' disabled' : ''}>🔎 Señalar defectos</button>
          <button class="btn sm" data-choice="cash"${used.cash ? ' disabled' : ''}>💶 Efectivo ya</button>
          ${it.verified ? '' : `<button class="btn sm" data-choice="auth">Autenticar (${fmt(AUTH_COST)})</button>`}
          <button class="btn sm ghost" data-choice="leave">Irme</button>
        </div>
        <p class="hint">Caja: ${fmt(S.money)} · Las tácticas solo se usan una vez; si fallan, el vendedor pierde paciencia.</p>
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
    c.maxPay = Math.max(2, perceivedValue(item) * f * rand(0.88, 1.12) * (1 + S.rep / 400));
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
    S.money += price;
    S.stock = S.stock.filter(x => x.uid !== it.uid);
    S.featured = S.featured.filter(u => u !== it.uid);
    S.stats.sold++;
    S.stats.revenue += price;
    S.stats.profit += profit;
    S.rep = clamp(S.rep + 1, 0, 100);
    addXP(profit > it.paid * 0.5 ? 3 : 1);
    report.income += price;
    report.sales.push(`${title(it)}: ${fmt(price)} (${profit >= 0 ? '+' : ''}${fmt(profit)})`);
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
      <div class="neg">
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
        <div class="actions wrap">
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
    const n = 4 + Math.floor(S.rep / 25) + randInt(0, 3) + S.traffic;
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
        <h4>🧾 Gastos</h4><ul>${lines.join('')}</ul>
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
          <li>Ten <b>todas las tallas</b>: M y L se piden más, pero quien busca una XL y no la encuentra se va. Destaca con ⭐ tus mejores piezas.</li>
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
      else if (a === 'editprice') editPrice(b.dataset.uid);
      else if (a === 'suggestall') { S.stock.forEach(it => { it.listPrice = nice(estimate(it).mid * 1.2); }); save(); renderAll(); toast('Precios sugeridos aplicados a todo.'); }
      else if (a === 'suggest') {
        const it = S.stock.find(x => x.uid === Number(b.dataset.uid));
        if (it) { it.listPrice = nice(estimate(it).mid * 1.2); save(); renderAll(); }
      }
    });

    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('select[data-sort]')) { S.view.sort = t.value; save(); renderAll(); return; }
      if (t.matches('select[data-msort]')) { S.marketSort = t.value; save(); renderAll(); return; }
      if (t.matches('input[data-action="setprice"]')) {
        const it = S.stock.find(x => x.uid === Number(t.dataset.uid));
        if (!it) return;
        const v = Math.round(Number(t.value));
        it.listPrice = v > 0 ? v : it.listPrice;
        save(); renderAll();
      }
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
    S.view = S.view || { filter: 'all', sort: 'recent' }; S.marketSort = S.marketSort || 'ganga';
    bind();
    renderAll();
    if (!S.seenIntro) intro();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
