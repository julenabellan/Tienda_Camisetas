// negociacion.js — NEGOCIACIÓN
// Comprar al vendedor (regateo), lotes y packs, teclado/barra de precio, y vender a los clientes en la tienda (regateo y apertura del día).
'use strict';

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

// ---------- Inspección a ojo (gratis, no es 100 % fiable) ----------
// Más nivel de «ojo» = más aciertos. El vendedor también influye: unos disimulan mejor que otros.
// Cada vendedor tiene `fakeMod` en data.js (+ más fácil de ver · − más difícil).

function inspectChance(sellerId) {
  const s = SELLERS[sellerId] || {};
  const mod = s.fakeMod || 0;
  return clamp(0.5 + 0.08 * (level() - 1) + mod, 0.35, 0.95);
}

const INSPECT_LINES = {
  real: 'Miras costuras, etiqueta y escudo: todo parece en orden. Te da buena impresión.',
  fake: 'Algo no cuadra: costuras irregulares y etiqueta rara. Te huele a réplica.',
  unsure: 'Le das vueltas, pero no sacas nada en claro. Podría ser cualquiera de las dos.',
};

function inspectItem(offer) {
  const it = offer.item;
  if (it.verified || it.inspected) return 'Ya la has examinado.';
  it.inspected = true;
  addXP(1);
  const p = inspectChance(offer.seller);
  const r = Math.random();
  let read;
  if (r < p) read = it.real ? 'real' : 'fake';                       // aciertas
  else if (r < p + (1 - p) * 0.5) read = 'unsure';                   // no lo ves claro
  else read = it.real ? 'fake' : 'real';                             // te engañan
  it.hint = read;
  return INSPECT_LINES[read];
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
    <div class="neg-head"><div class="thumb sm">${kitImage(kitOf(it), it)}</div>
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
        <div class="thumb sm">${kitImage(kitOf(it), it)}</div>
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
        ${it.verified ? '' : `<button class="btn sm" data-choice="inspect" title="Gratis, pero no es seguro"${it.inspected ? ' disabled' : ''}>🔍 Inspeccionar (~${Math.round(inspectChance(offer.seller) * 100)} %)</button>`}
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
    if (r.choice === 'inspect') {
      msg = inspectItem(offer);
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

// ---------- Compra de packs ----------
function packDialogHTML(pack, sel, msg) {
  const src = PACK_SOURCES[pack.src];
  const n = pack.items.length;
  const q = packQuote(pack, sel);
  const free = S.shelfCap - S.stock.length;
  const tiers = [];
  for (let k = 2; k <= n; k++) tiers.push(`${k === n ? 'Todas' : k} <b>−${Math.round(packDiscount(src, k, n) * 100)} %</b>`);
  const rows = pack.items.map(x => {
    const it = x.item, kit = kitOf(it), on = sel.has(it.uid);
    const line = q.chosen.find(l => l.item.uid === it.uid);
    const price = on ? `<s>${fmt(x.price)}</s><b>${fmt(line.pay)}</b>` : `<b>${fmt(x.price)}</b>`;
    const need = sizeCount(it.size) === 0 ? '<span class="chip warn">🧩 Te falta</span>' : '';
    return `<button class="pk-row${on ? ' on' : ''}" data-choice="toggle:${it.uid}" aria-pressed="${on}">
      <span class="pk-check">${on ? '✔' : ''}</span>
      <span class="thumb sm">${kitImage(kit, it)}</span>
      <span class="pk-info"><b>${kit.team} ${kit.year}</b>
        <small>${kit.type} · Talla ${it.size} · ${COND_SHORT[it.cond] || COND[it.cond].label}</small>
        <small>Valoración ${estimateText(it)}</small>
        <span class="chips">${authChip(it)}${trendChip(kit)}${need}</span></span>
      <span class="pk-price">${price}</span>
    </button>`;
  }).join('');
  return `
    <div class="neg negx packx">
      <div class="neg-head">
        <span class="pk-icon">${src.icon}</span>
        <div><h3>${pack.name}</h3><p class="sub">${src.label} · ${n} ${n === 1 ? 'camiseta' : 'camisetas'}</p></div>
      </div>
      <p class="pk-tiers">${src.desc}</p>
      <p class="pk-tiers">${tiers.length ? `<b>Descuento por cantidad:</b> ${tiers.join(' · ')}` : 'Solo queda una camiseta: sin descuento.'}</p>
      <div class="pk-list">${rows}</div>
      <div class="pk-sum"><span><b>${q.chosen.length}</b> elegidas</span><span>Descuento <b>−${Math.round(q.d * 100)} %</b></span><span>Ahorras <b>${fmt(q.saved)}</b></span></div>
      ${msg ? `<p class="pk-msg">${msg}</p>` : ''}
      <div class="actions wrap main"><button class="btn primary" data-choice="buy"${q.chosen.length ? '' : ' disabled'}>${q.chosen.length ? `Comprar · ${fmt(q.total)}` : 'Elige camisetas'}</button></div>
      <div class="actions wrap tactics">
        <button class="btn sm" data-choice="all">Todas</button>
        <button class="btn sm" data-choice="none">Ninguna</button>
        <button class="btn sm ghost" data-choice="leave">Salir</button>
      </div>
      <p class="hint">Caja: ${fmt(S.money)} · Perchas libres: ${free}</p>
    </div>`;
}

async function openPack(packId) {
  const pack = (S.packs || []).find(p => p.id === packId);
  if (!pack) return;
  const sel = new Set();
  let msg = '';
  while (true) {
    const keep = ($('#sheet .pk-list') || {}).scrollTop || 0;   // no saltar al principio de la lista al marcar
    const pending = dialog(packDialogHTML(pack, sel, msg));
    const list = $('#sheet .pk-list');
    if (list) list.scrollTop = keep;
    const r = await pending;
    msg = '';
    const c = r.choice;
    const free = S.shelfCap - S.stock.length;
    if (c === 'leave') { closeDialog(); return; }
    if (c === 'none') { sel.clear(); continue; }
    if (c === 'all') {
      sel.clear();
      pack.items.slice(0, Math.max(0, free)).forEach(x => sel.add(x.item.uid));
      if (free < pack.items.length) msg = free > 0 ? `Solo tienes ${free} perchas libres.` : 'No te quedan perchas libres. Vende o amplía la tienda.';
      continue;
    }
    if (c.startsWith('toggle:')) {
      const uid = Number(c.slice(7));
      if (sel.has(uid)) sel.delete(uid);
      else if (sel.size >= free) msg = free > 0 ? `Solo tienes ${free} perchas libres.` : 'No te quedan perchas libres. Vende o amplía la tienda.';
      else sel.add(uid);
      continue;
    }
    if (c === 'buy') {
      const q = packQuote(pack, sel);
      if (!q.chosen.length) { msg = 'Elige al menos una camiseta.'; continue; }
      if (q.total > S.money) { msg = `Te faltan ${fmt(q.total - S.money)} de caja para este pedido.`; continue; }
      await stamp('¡Lote comprado!', '📦', 'ok', '−' + fmt(q.total));
      q.chosen.forEach(x => {
        const it = x.item;
        it.paid = x.pay;
        it.listPrice = nice(estimate(it).mid * 1.25);
        it.since = S.day;
        S.stock.push(it);
      });
      S.money -= q.total;
      pack.items = pack.items.filter(x => !sel.has(x.item.uid));
      if (!pack.items.length) S.packs = S.packs.filter(p => p.id !== pack.id);
      const k = q.chosen.length;
      log(`Compras ${k} ${k === 1 ? 'camiseta' : 'camisetas'} a «${pack.name}» por ${fmt(q.total)} (ahorras ${fmt(q.saved)}).`);
      toast(`Compradas ${k} por ${fmt(q.total)} · ahorras ${fmt(q.saved)}`);
      save(); renderAll();
      return;
    }
  }
}

// ---------- Clientes ----------
function genCustomer() {
  const stock = S.stock.filter(it => !it.locked);   // las piezas bloqueadas del escaparate no se venden
  const type = weighted(Object.keys(CUSTOMER_TYPES), t => CUSTOMER_TYPES[t].weight);
  const c = { type, name: pick(NAMES), ...CUSTOMER_TYPES[type] };
  c.size = weighted(SIZE_ORDER, z => SIZE_DEMAND[z]);
  c.sizeFree = type === 'bargain';       // el cazador de gangas no mira la talla
  let candidates = [];
  if (type === 'fan') {
    const teams = [...new Set(stock.map(it => kitOf(it).team))];
    const allTeams = [...new Set(KITS.map(x => x.team))];
    c.team = Math.random() < 0.75 ? pick(teams) : pick(allTeams);
    candidates = stock.filter(it => kitOf(it).team === c.team);
  } else if (type === 'collector') {
    candidates = stock.filter(it => kitOf(it).rarity >= 3 || it.special);
  } else if (type === 'nostalgic') {
    candidates = stock.filter(it => kitOf(it).year <= 2000);
  } else if (type === 'bargain') {
    candidates = stock.length ? [stock.slice().sort((a, b) => a.listPrice / perceivedValue(a) - b.listPrice / perceivedValue(b))[0]] : [];
  } else {
    candidates = stock.slice();
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
        <div class="thumb sm">${kitImage(kitOf(it), it)}</div>
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

// Probabilidad de que el cliente pague el precio marcado sin regatear.
// ratio = precio marcado / lo máximo que pagaría. Barato → casi siempre compra directo;
// caro → casi siempre negocia, pero a veces paga igualmente.
function directBuyChance(c, ratio) {
  if (c.type === 'tourist') return ratio <= 1.15 ? 1 : 0;   // el turista nunca regatea
  let p;
  if (ratio <= 0.6) p = 0.95;
  else if (ratio <= 1) p = 0.95 - (ratio - 0.6) / 0.4 * 0.6;   // 0.95 → 0.35
  else if (ratio <= 1.15) p = 0.12;                            // caro: a veces paga igual
  else p = 0;
  if (c.type === 'bargain') p *= 0.4;                          // el cazador de gangas siempre intenta regatear
  return p;
}
const wantsDirectBuy = (c, ratio) => Math.random() < directBuyChance(c, ratio);

// Ventas "de un día para otro": clientes que entran, pagan y se van sin diálogo.
// Llamar desde endDay(report) antes de cerrar el informe: overnightSales(report);
function overnightSales(report) {
  if (!S.stock.length) return 0;
  const n = randInt(1, 2 + Math.floor(S.rep / 40) + S.traffic);
  let sold = 0;
  for (let i = 0; i < n && S.stock.length > 0; i++) {
    const c = genCustomer();
    if (!c.item) continue;
    const ratio = c.item.listPrice / c.maxPay;
    if (ratio <= 1 && wantsDirectBuy(c, ratio)) { recordSale(c.item, c.item.listPrice, report); sold++; }
  }
  if (sold) report.sales.push(`🌙 ${sold} ${sold === 1 ? 'cliente compró' : 'clientes compraron'} sin regatear de un día para otro.`);
  return sold;
}

async function serveCustomer(c, report) {
  const it = c.item;
  if (!it) { report.lost.push(missText(c)); return; }
  let cur = it.listPrice;
  const ratio = cur / c.maxPay;
  const tourist = c.type === 'tourist';
  // Compra directa: paga el precio marcado y se va, sin regatear
  if (wantsDirectBuy(c, ratio)) { recordSale(it, cur, report); return; }
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


// ---------- Abrir la tienda: atender a los clientes ----------
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
