(() => {
  'use strict';

  // ---------- Configuración ----------
  const SAVE_KEY = 'camisetasRetroShop_v1';
  const GOAL = 5000;          // patrimonio objetivo
  const RENT = 12;            // alquiler diario
  const AUTH_COST = 15;       // coste de autenticar
  const REFRESH_COST = 10;    // coste de buscar más ofertas
  const LEVEL_XP = [0, 8, 25, 55, 100];
  const SIZES = { S: 0.9, M: 1, L: 1, XL: 0.92, XXL: 0.75 };
  const SIZE_WEIGHTS = { S: 15, M: 35, L: 30, XL: 18, XXL: 2 };
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
      patience: s.patience,
    };
  }

  function genMarket() {
    const n = clamp(6 + Math.floor(S.rep / 30), 6, 10);
    return Array.from({ length: n }, genOffer);
  }

  // ---------- Dibujo de camisetas ----------
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
      <path d="M70 20 Q100 44 130 20" fill="none" stroke="${c2}" stroke-width="6" stroke-linecap="round"/>
      <path d="M8 70 L34 92 M192 70 L166 92" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="125" cy="62" r="6.5" fill="${c2}" stroke="rgba(0,0,0,.3)"/>
      <rect x="73" y="58" width="10" height="3" rx="1.5" fill="${c2}"/>
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
          <span class="chip">Talla ${it.size}</span>
          <span class="chip">${COND[it.cond].label}</span>
          ${authChip(it)}
          ${trendChip(kit)}
        </div>
        <p class="est">Valoración: <b>${estimateText(it)}</b></p>
      </div>`;
  }

  function marketCard(o) {
    const it = o.item;
    const s = SELLERS[o.seller];
    const est = estimate(it);
    const ganga = o.ask <= est.mid * 0.6;
    return `
      <article class="card" data-offer="${o.id}">
        ${itemHead(it)}
        <p class="seller">${s.emoji} ${o.name} · ${s.label}</p>
        <div class="price-tag" aria-label="Precio pedido"><small>Pide</small>${fmt(o.ask)}</div>
        ${ganga ? '<span class="deal">Posible ganga</span>' : ''}
        <div class="actions">
          <button class="btn" data-action="negotiate" data-id="${o.id}">Negociar</button>
          <button class="btn primary" data-action="buy" data-id="${o.id}">Comprar</button>
        </div>
      </article>`;
  }

  function shopCard(it) {
    const margin = it.listPrice - it.paid;
    return `
      <article class="card" data-uid="${it.uid}">
        ${itemHead(it)}
        <p class="seller">Pagaste ${fmt(it.paid)} · Margen <b class="${margin >= 0 ? 'pos' : 'neg'}">${margin >= 0 ? '+' : ''}${fmt(margin)}</b></p>
        <label class="price-input">Tu precio
          <input type="number" inputmode="numeric" min="1" step="1" value="${it.listPrice}" data-action="setprice" data-uid="${it.uid}">
        </label>
        <div class="actions">
          ${it.verified ? '' : `<button class="btn" data-action="auth" data-uid="${it.uid}">Autenticar (${fmt(AUTH_COST)})</button>`}
          <button class="btn" data-action="suggest" data-uid="${it.uid}">Precio sugerido</button>
        </div>
      </article>`;
  }

  // ---------- Render ----------
  function renderAll() {
    $('#st-day').textContent = S.day;
    $('#st-money').textContent = fmt(S.money);
    $('#st-rep').textContent = Math.round(S.rep);
    $('#st-level').textContent = level();
    const nw = netWorth();
    $('#goal-fill').style.width = clamp((nw / GOAL) * 100, 0, 100) + '%';
    $('#goal-text').textContent = `Patrimonio ${fmt(nw)} de ${fmt(GOAL)}`;

    $('#market-grid').innerHTML = S.market.length
      ? S.market.map(marketCard).join('')
      : '<p class="empty">No quedan ofertas hoy. Busca más o cierra el día.</p>';

    $('#shop-cap').textContent = `${S.stock.length} de ${S.shelfCap} perchas ocupadas`;
    $('#btn-upgrade').textContent = `Ampliar +6 perchas (${fmt(upgradeCost())})`;
    $('#shop-grid').innerHTML = S.stock.length
      ? S.stock.map(shopCard).join('')
      : '<p class="empty">El escaparate está vacío. Compra camisetas en el Mercado.</p>';

    $('#btn-refresh').textContent = `Buscar más (${fmt(REFRESH_COST)})`;

    const nextLevel = LEVEL_XP[level()];
    $('#panel-stats').innerHTML = `
      <div><small>Camisetas vendidas</small><b>${S.stats.sold}</b></div>
      <div><small>Ingresos</small><b>${fmt(S.stats.revenue)}</b></div>
      <div><small>Beneficio en ventas</small><b>${fmt(S.stats.profit)}</b></div>
      <div><small>Alquiler diario</small><b>${fmt(RENT)}</b></div>
      <div><small>Ojo de experto</small><b>Nivel ${level()}${nextLevel ? ` · ${S.xp}/${nextLevel}` : ' · máximo'}</b></div>`;
    $('#news-list').innerHTML = S.news.slice(0, 40).map(n => `<li><span>Día ${n.day}</span>${n.text}</li>`).join('');
    renderTrends();
  }

  function renderTrends() {
    const rows = Object.entries(S.trends).map(([key, t]) => {
      const name = key === '__nat' ? 'Selecciones' : key;
      return `<li><b>${name}</b> ${t.mult >= 1 ? '+' : ''}${Math.round((t.mult - 1) * 100)} % · ${t.left} d</li>`;
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
        const b = e.target.closest('[data-choice]');
        if (!b) return;
        const inp = $('#sheet-input', sheet);
        sheet.onclick = null;
        resolve({ choice: b.dataset.choice, value: inp ? Number(inp.value) : null });
      };
      const inp = $('#sheet-input', sheet);
      if (inp) { inp.focus(); inp.select(); }
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

  function sellerDialogHTML(offer, msg) {
    const it = offer.item;
    const s = SELLERS[offer.seller];
    const dots = '●'.repeat(Math.max(0, offer.patience)) + '○'.repeat(Math.max(0, s.patience - offer.patience));
    return `
      <div class="neg">
        <div class="neg-head">
          <div class="thumb sm">${kitImage(kitOf(it))}</div>
          <div>
            <h3>${title(it)} · ${kitOf(it).type}</h3>
            <p class="sub">${COND[it.cond].label} · Talla ${it.size}</p>
            <p class="est">Valoración: <b>${estimateText(it)}</b></p>
            <div class="chips">${authChip(it)}</div>
          </div>
        </div>
        <p class="bubble"><span>${s.emoji} ${offer.name}</span>${msg}</p>
        <div class="neg-row">
          <div class="price-tag static"><small>Pide</small>${fmt(offer.ask)}</div>
          <p class="patience" title="Paciencia del vendedor">Paciencia ${dots}</p>
        </div>
        <label class="price-input">Tu oferta
          <input id="sheet-input" type="number" inputmode="numeric" min="1" step="1" value="${Math.min(offer.ask, Math.round(offer.ask * 0.8))}">
        </label>
        <div class="actions wrap">
          <button class="btn primary" data-choice="offer">Ofrecer</button>
          <button class="btn" data-choice="accept">Pagar ${fmt(offer.ask)}</button>
          ${it.verified ? '' : `<button class="btn" data-choice="auth">Autenticar (${fmt(AUTH_COST)})</button>`}
          <button class="btn ghost" data-choice="leave">Irme</button>
        </div>
        <p class="hint">Caja: ${fmt(S.money)}</p>
      </div>`;
  }

  async function negotiateBuy(offerId) {
    let offer = S.market.find(o => o.id === offerId);
    if (!offer) return;
    if (S.stock.length >= S.shelfCap) { toast('No te quedan perchas libres. Vende o amplía la tienda.'); return; }
    const s = SELLERS[offer.seller];
    let msg = pick(s.lines.greet);
    while (true) {
      const r = await dialog(sellerDialogHTML(offer, msg));
      if (r.choice === 'leave') { closeDialog(); return; }
      if (r.choice === 'accept') {
        closeDialog();
        buyItem(offer, offer.ask);
        return;
      }
      if (r.choice === 'auth') {
        if (S.money < AUTH_COST) { msg = 'No tienes caja para pagar al experto.'; continue; }
        msg = authOffer(offer);
        save(); renderAll();
        continue;
      }
      if (r.choice === 'offer') {
        const amount = Math.round(r.value);
        if (!(amount > 0)) { msg = 'Dime una cifra, anda.'; continue; }
        if (amount > S.money) { msg = 'No tienes tanta caja para esa oferta.'; continue; }
        if (amount >= offer.floor) {
          const price = Math.min(amount, offer.ask);
          closeDialog();
          toast(pick(s.lines.accept));
          buyItem(offer, price);
          return;
        }
        const ratio = amount / offer.floor;
        if (ratio < 0.6) {
          offer.patience -= 2;
          msg = pick(s.lines.insult);
        } else {
          offer.patience -= 1;
          const counter = Math.round(Math.max(offer.floor, offer.ask - (offer.ask - offer.floor) * rand(0.3, 0.5)));
          offer.ask = Math.min(offer.ask, counter);
          msg = pick(s.lines.counter);
        }
        if (offer.patience <= 0) {
          const lastLine = pick(s.lines.leave);
          S.market = S.market.filter(o => o.id !== offer.id);
          save(); renderAll();
          await dialog(`<div class="neg"><p class="bubble"><span>${s.emoji} ${offer.name}</span>${lastLine}</p><p class="hint">El vendedor se ha ido con la camiseta.</p><div class="actions"><button class="btn primary" data-choice="ok">Vale</button></div></div>`);
          closeDialog();
          return;
        }
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
    let candidates = [];
    let item = null;
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
    item = candidates.length ? pick(candidates) : null;
    c.item = item;
    if (!item) return c;
    const kit = kitOf(item);
    let f = 1;
    if (type === 'fan') f = 1.2;
    else if (type === 'collector') f = kit.rarity >= 3 ? 1.25 : 1.1;
    else if (type === 'bargain') f = 0.72;
    else if (type === 'nostalgic') f = 1.25;
    else if (type === 'tourist') f = 0.9;
    c.maxPay = Math.max(2, perceivedValue(item) * f * rand(0.88, 1.12) * (1 + S.rep / 400));
    return c;
  }

  function missText(c) {
    if (c.type === 'fan') return `${c.name} buscaba algo de ${c.team} y no lo tienes.`;
    if (c.type === 'collector') return `${c.name} buscaba piezas raras y no tienes ninguna.`;
    if (c.type === 'nostalgic') return `${c.name} quería una camiseta de los 90 o anterior.`;
    return `${c.name} se fue sin encontrar nada.`;
  }

  function recordSale(it, price, report) {
    const profit = price - it.paid;
    S.money += price;
    S.stock = S.stock.filter(x => x.uid !== it.uid);
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

  function haggleHTML(c, it, offer, listPrice, msg, final) {
    const e = estimateText(it);
    return `
      <div class="neg">
        <div class="neg-head">
          <div class="thumb sm">${kitImage(kitOf(it))}</div>
          <div>
            <h3>${title(it)} · ${kitOf(it).type}</h3>
            <p class="sub">${COND[it.cond].label} · Talla ${it.size}</p>
            <p class="est">Valoración: <b>${e}</b></p>
            <p class="sub">Tu precio: <b>${fmt(listPrice)}</b> · Pagaste ${fmt(it.paid)}</p>
          </div>
        </div>
        <p class="bubble"><span>${c.emoji} ${c.name} · ${c.label}</span>${msg}</p>
        <div class="price-tag static"><small>${final ? 'Última oferta' : 'Ofrece'}</small>${fmt(offer)}</div>
        ${final ? '' : `<label class="price-input">Tu contraoferta
          <input id="sheet-input" type="number" inputmode="numeric" min="1" step="1" value="${Math.round((listPrice + offer) / 2)}">
        </label>`}
        <div class="actions wrap">
          <button class="btn primary" data-choice="accept">Aceptar ${fmt(offer)}</button>
          ${final ? '' : '<button class="btn" data-choice="counter">Contraofertar</button>'}
          <button class="btn ghost" data-choice="reject">Rechazar</button>
        </div>
      </div>`;
  }

  async function serveCustomer(c, report) {
    const it = c.item;
    if (!it) { report.lost.push(missText(c)); return; }
    const ratio = it.listPrice / c.maxPay;
    const tourist = c.type === 'tourist';
    if (ratio <= (tourist ? 1.15 : 1)) {
      recordSale(it, it.listPrice, report);
      return;
    }
    if (ratio > 1.6) {
      report.lost.push(`${c.name} vio ${title(it)} a ${fmt(it.listPrice)} y le pareció carísima.`);
      return;
    }
    if (tourist) { report.lost.push(`${c.name} no quiso pagar ${fmt(it.listPrice)} por ${title(it)}.`); return; }

    let offer = Math.max(1, Math.round(c.maxPay * rand(0.72, 0.9)));
    const r = await dialog(haggleHTML(c, it, offer, it.listPrice, 'Me gusta, pero ese precio es alto. ¿Qué tal esto?', false));
    if (r.choice === 'accept') {
      closeDialog();
      recordSale(it, offer, report);
      return;
    }
    if (r.choice === 'counter') {
      const counter = Math.round(r.value);
      if (counter > 0 && counter <= c.maxPay) {
        closeDialog();
        recordSale(it, Math.max(counter, offer), report);
        return;
      }
      const finalOffer = Math.max(offer, Math.round(c.maxPay * rand(0.92, 0.99)));
      const r2 = await dialog(haggleHTML(c, it, finalOffer, it.listPrice, 'Eso se me va de presupuesto. Mi última oferta.', true));
      closeDialog();
      if (r2.choice === 'accept') { recordSale(it, finalOffer, report); return; }
      report.lost.push(`${c.name} no llegó a un acuerdo por ${title(it)}.`);
      return;
    }
    closeDialog();
    report.lost.push(`Rechazaste la oferta de ${c.name} por ${title(it)}.`);
  }

  // ---------- Fin de día ----------
  async function openShop() {
    if (S.over || S.busy) return;
    S.busy = true;
    const report = { sales: [], lost: [], income: 0, customers: 0 };
    const n = 3 + Math.floor(S.rep / 25) + randInt(0, 3) + S.traffic;
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
        <h3>Cierre del día ${S.day - 1}</h3>
        <p class="sub">${report.customers} clientes · Ingresos ${fmt(report.income)}</p>
        ${report.sales.length ? `<h4>Ventas</h4><ul>${report.sales.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        ${report.lost.length ? `<h4>Ventas perdidas</h4><ul>${report.lost.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        <h4>Gastos</h4><ul>${lines.join('')}</ul>
        ${todayNews.length ? `<h4>Noticias para mañana</h4><ul>${todayNews.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
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
      else if (a === 'suggest') {
        const it = S.stock.find(x => x.uid === Number(b.dataset.uid));
        if (it) { it.listPrice = nice(estimate(it).mid * 1.2); save(); renderAll(); }
      }
    });

    document.addEventListener('change', e => {
      const t = e.target;
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
    bind();
    renderAll();
    if (!S.seenIntro) intro();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
