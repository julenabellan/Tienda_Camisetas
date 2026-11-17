// coleccion.js — COLECCIÓN
// Las camisetas ORIGINALES (autenticadas) se pueden apartar de la tienda y exponer en tu colección.
// Una pieza coleccionada no se vende, no ocupa percha y sigue sumando fama. Cuanto mejor es su estado,
// más puntos de colección da, más fama aporta y antes sube tu categoría (que paga entradas cada día).
// Clic en una pieza de la vitrina → ficha grande con detalle (estado, valor, puntos, fama…).
// Depende de core.js (S, kitOf, estimate, fame, dialog…) y de camisetas.js (kitImage). Se carga después de ellos.
'use strict';
(() => {

  // ---------- Configuración ----------
  // n = nota de 1 a 4 · mult = multiplicador de puntos de colección · fame = multiplicador extra de fama
  const COLLECT_GRADE = {
    nueva:     { n: 4, icon: '💎', tag: 'Mint',      label: 'Nueva con etiquetas', mult: 2,   fame: 1.8 },
    excelente: { n: 3, icon: '🥇', tag: 'Excelente', label: 'Excelente',           mult: 1.5, fame: 1.5 },
    buena:     { n: 2, icon: '🥈', tag: 'Buena',     label: 'Buen estado',         mult: 1,   fame: 1.2 },
    usada:     { n: 1, icon: '🥉', tag: 'Gastada',   label: 'Muy usada',           mult: 0.5, fame: 1 },
  };
  const COLLECT_GRADES = ['nueva', 'excelente', 'buena', 'usada'];   // de mejor a peor

  // Categorías de la colección: con más puntos, más gente paga entrada para verla cada día
  const MUSEUM_TIERS = [
    { min: 0,  name: 'Aficionado',        icon: '📘', income: 0 },
    { min: 6,  name: 'Coleccionista',     icon: '🗂️', income: 2 },
    { min: 20, name: 'Conservador',       icon: '🏺', income: 5 },
    { min: 45, name: 'Archivo histórico', icon: '📜', income: 10 },
    { min: 80, name: 'Colección de museo', icon: '🏛️', income: 18 },
  ];
  const MIN_SLOTS = 6;   // huecos mínimos que se enseñan en la vitrina

  // ---------- Lógica ----------
  const collectionOf = () => (S.collection = S.collection || []);
  const cview = () => (S.cview = S.cview || { sort: 'cond', filter: 'all' });
  const isOriginal = it => !!(it.verified && it.real);                 // solo entran originales autenticadas
  const num = n => (Math.round(n * 10) / 10).toLocaleString('es-ES');

  // Puntos de colección de una pieza: rareza × estado (× 1,5 si está firmada)
  function collectPts(it) {
    return FAME_BASE[kitOf(it).rarity] * COLLECT_GRADE[it.cond].mult * (it.special ? 1.5 : 1);
  }
  // La fama (core.js) pregunta aquí cuánto más puntúa una pieza por estar en la colección
  function collectFameMult(it) { return it.collected ? COLLECT_GRADE[it.cond].fame : 1; }

  function museumInfo() {
    const list = collectionOf();
    const score = list.reduce((a, it) => a + collectPts(it), 0);
    let tier = 0;
    MUSEUM_TIERS.forEach((t, i) => { if (score >= t.min) tier = i; });
    const t = MUSEUM_TIERS[tier];
    return { list, score, tier, t, name: t.name, icon: t.icon, income: t.income, next: MUSEUM_TIERS[tier + 1] || null };
  }

  function collectItem(uid) {
    uid = Number(uid);
    const it = S.stock.find(x => x.uid === uid);
    if (!it) return;
    if (!it.verified) { toast('Autentícala primero: en la colección solo entran camisetas originales.'); return; }
    if (!it.real) { toast('Es una réplica: solo se coleccionan camisetas originales.'); return; }
    S.stock.splice(S.stock.indexOf(it), 1);
    S.featured = S.featured.filter(x => x !== uid);
    it.locked = false;
    it.collected = true;
    it.collectedDay = S.day;
    collectionOf().push(it);
    log(`📚 Colocas ${title(it)} en tu colección (${COLLECT_GRADE[it.cond].label}).`);
    toast(`📚 ${title(it)} entra en tu colección: ya no está a la venta.`);
    save(); renderAll();
  }

  function uncollectItem(uid) {
    uid = Number(uid);
    const list = collectionOf();
    const it = list.find(x => x.uid === uid);
    if (!it) return;
    if (S.stock.length >= S.shelfCap) { toast('No tienes perchas libres: amplía la tienda o vende algo antes.'); return; }
    list.splice(list.indexOf(it), 1);
    delete it.collected;
    delete it.collectedDay;
    if (!it.listPrice) it.listPrice = suggestedPrice(it);
    S.stock.push(it);
    log(`${title(it)} sale de tu colección y vuelve al almacén.`);
    toast(`${title(it)} vuelve al almacén y se puede vender.`);
    save(); renderAll();
  }

  // ---------- «Ya la tienes en tu colección» ----------
  // Una camiseta es la misma si comparte catálogo (equipo, año y tipo). Compara estado y firma para decir si mejora la tuya.
  const rankOf = it => COLLECT_GRADE[it.cond].n + (it.special ? 0.5 : 0);
  function ownedInfo(it) {
    if (!it || it.collected) return null;
    const mine = collectionOf().filter(x => x.kitId === it.kitId);
    if (!mine.length) return null;
    const best = mine.reduce((a, b) => (rankOf(b) > rankOf(a) ? b : a));
    const g = COLLECT_GRADE[best.cond];
    const up = rankOf(it) > rankOf(best);
    const mia = `${g.icon} ${g.tag}${best.special ? ' · firmada' : ''}`;
    const why = it.special && !best.special && COLLECT_GRADE[it.cond].n <= g.n ? 'esta está firmada' : 'esta está en mejor estado';
    return {
      up,
      short: up ? '⬆️ Mejora la de tu colección' : '📚 Ya en tu colección',
      long: up ? `Ya tienes esta camiseta en tu colección (${mia}), pero ${why}.` : `Ya tienes esta camiseta en tu colección (${mia}).`,
    };
  }
  const ownedFlag = it => { const o = ownedInfo(it); return o ? `<span class="deal own${o.up ? ' up' : ''}" title="${o.long}">${o.short}</span>` : ''; };
  const ownedChip = it => { const o = ownedInfo(it); return o ? `<span class="chip own${o.up ? ' up' : ''}" title="${o.long}">${o.short}</span>` : ''; };
  function packOwnedChip(pack) {
    const n = pack.items.filter(x => ownedInfo(x.item)).length;
    return n ? `<span class="chip own" title="Camisetas de este lote que ya tienes en tu colección">📚 ${n} ya ${n === 1 ? 'la tienes' : 'las tienes'}</span>` : '';
  }

  // Al comprar (directa, negociada…) avisa si ya la tenías en la colección
  if (typeof window.buyItem === 'function') {
    const buyOriginal = window.buyItem;
    window.buyItem = function (offer, price) {
      const it = offer && offer.item;
      const o = ownedInfo(it);
      const r = buyOriginal.apply(this, arguments);
      if (o) {
        Promise.resolve(r).then(() => {
          if (!S.stock.includes(it)) return;   // la compra no se hizo
          log(`📚 ${title(it)}: ${o.long}`);
          toast(`${title(it)} comprada. ${o.long}`);
          save();
        });
      }
      return r;
    };
  }

  // Botón «Coleccionar» para las tarjetas de la tienda (solo originales autenticadas)
  const collectBtn = (it, cls = '') => (isOriginal(it)
    ? `<button class="btn ${cls}" data-action="collect" data-uid="${it.uid}" title="Apartarla de la venta y guardarla en tu colección">📚 Coleccionar</button>`
    : '');

  // ---------- Plantillas ----------
  // [clave, icono, etiqueta]
  const CV_FILTERS = [['all', '', 'Todas'], ['signed', '✍️', 'Firmadas'], ['nueva', '💎', 'Mint'], ['excelente', '🥇', 'Excelente'], ['buena', '🥈', 'Buena'], ['usada', '🥉', 'Gastada']];
  const cvPass = (it, f) => f === 'all' || (f === 'signed' ? !!it.special : it.cond === f);
  const CV_SORTS = {
    cond: (a, b) => COLLECT_GRADE[b.cond].n - COLLECT_GRADE[a.cond].n || kitOf(b).rarity - kitOf(a).rarity || estimate(b).mid - estimate(a).mid,
    rarity: (a, b) => kitOf(b).rarity - kitOf(a).rarity || COLLECT_GRADE[b.cond].n - COLLECT_GRADE[a.cond].n,
    value: (a, b) => estimate(b).mid - estimate(a).mid,
    year: (a, b) => kitOf(a).year - kitOf(b).year,
    team: (a, b) => title(a).localeCompare(title(b), 'es'),
    recent: (a, b) => (b.collectedDay || 0) - (a.collectedDay || 0) || b.uid - a.uid,
  };
  const CV_SORT_LABELS = [['cond', 'Mejor estado'], ['rarity', 'Más raras'], ['value', 'Mayor valor'], ['year', 'Más antiguas'], ['team', 'Equipo A-Z'], ['recent', 'Últimas añadidas']];

  const gradeBadge = it => { const g = COLLECT_GRADE[it.cond]; return `<span class="cv-grade g${g.n}" title="${g.label}">${g.icon} ${g.tag}</span>`; };
  const gradePips = it => { const n = COLLECT_GRADE[it.cond].n; return `<span class="cv-pips g${n}" aria-label="Estado ${n} de 4">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`; };

  function heroHTML(m) {
    const n = m.list.length;
    const pct = m.next ? clamp((m.score - m.t.min) / (m.next.min - m.t.min) * 100, 0, 100) : 100;
    const value = m.list.reduce((a, it) => a + estimate(it).mid, 0);
    const counts = Object.fromEntries(COLLECT_GRADES.map(c => [c, m.list.filter(it => it.cond === c).length]));
    const avg = n ? m.list.reduce((a, it) => a + COLLECT_GRADE[it.cond].n, 0) / n : 0;
    const spread = n
      ? COLLECT_GRADES.filter(c => counts[c]).map(c => `<i class="g${COLLECT_GRADE[c].n}" style="flex:${counts[c]}" title="${COLLECT_GRADE[c].label}: ${counts[c]}"></i>`).join('')
      : '<i class="empty" style="flex:1"></i>';
    const legend = COLLECT_GRADES.map(c => `<span class="g${COLLECT_GRADE[c].n}"><i></i>${COLLECT_GRADE[c].tag} <b>${counts[c]}</b></span>`).join('');
    return `
      <div class="cv-hero-top">
        <div class="cv-crest" aria-hidden="true">${m.icon}</div>
        <div class="cv-hero-title">
          <small>Categoría de tu colección</small>
          <h3>${m.name}</h3>
          <p>${m.next ? `${num(m.score)} / ${m.next.min} pts para «${m.next.name}»` : `${num(m.score)} pts · categoría máxima`}</p>
        </div>
      </div>
      <div class="cv-progress" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
      <div class="cv-kpis">
        <div class="cv-kpi"><i aria-hidden="true">📚</i><small>Piezas</small><b>${n}</b></div>
        <div class="cv-kpi"><i aria-hidden="true">💶</i><small>Valor</small><b>${fmt(value)}</b></div>
        <div class="cv-kpi"><i aria-hidden="true">⭐</i><small>Puntos</small><b>${num(m.score)}</b></div>
        <div class="cv-kpi"><i aria-hidden="true">🎟️</i><small>Entradas</small><b>${m.income ? `+${fmt(m.income)}<em>/día</em>` : '—'}</b></div>
      </div>
      <div class="cv-cond">
        <div class="cv-cond-head"><small>Estado de la colección</small><b>${n ? `${num(avg)} / 4` : '—'}</b></div>
        <div class="cv-spread">${spread}</div>
        <div class="cv-legend">${legend}</div>
      </div>
      <p class="cv-rule">Solo entran <b>originales autenticadas</b>. Cuanto mejor estado, más puntos, más fama y mejores entradas.</p>`;
  }

  function setsHTML(f) {
    return f.sets.map(c => {
      const pct = clamp(c.n / c.need * 100, 0, 100);
      const info = `${c.desc}${c.bonus ? ` · +${c.bonus} fama al completarlo` : ''}`;
      return `<div class="cv-set${c.done ? ' done' : ''}" tabindex="0" role="button" aria-expanded="false" title="${info}">
        <span class="cv-set-ico">${c.icon}</span>
        <b class="cv-set-name">${c.name}</b>
        <em>${c.done ? '✔' : `${Math.min(c.n, c.need)}/${c.need}`}</em>
        <div class="cv-set-bar"><i style="width:${pct}%"></i></div>
        <small class="cv-set-desc">${info}</small>
      </div>`;
    }).join('');
  }

  function toolsHTML(list) {
    const v = cview();
    const chips = CV_FILTERS.map(([f, ico, l]) => {
      const n = list.filter(it => cvPass(it, f)).length;
      return `<button class="cv-chip${f === 'all' ? ' all' : ''}${v.filter === f ? ' on' : ''}" data-action="cfilter" data-f="${f}" title="${l}" aria-label="${l}: ${n}">${ico ? `<span class="ico">${ico}</span>` : ''}<span class="lbl">${l}</span><b>${n}</b></button>`;
    }).join('');
    const opts = CV_SORT_LABELS.map(([k, l]) => `<option value="${k}"${v.sort === k ? ' selected' : ''}>${l}</option>`).join('');
    return `<div class="cv-chips">${chips}</div>
      <label class="cv-sort">Ordenar <select data-csort>${opts}</select></label>`;
  }

  function vitrineCard(it) {
    const kit = kitOf(it);
    const g = COLLECT_GRADE[it.cond];
    return `
      <article class="cv-card g${g.n} r${kit.rarity}" data-uid="${it.uid}" tabindex="0" role="button" title="Ver en detalle" aria-label="Ver en detalle: ${kit.team} ${kit.year}">
        <div class="cv-top">${gradeBadge(it)}<span class="cv-pts" title="Puntos de colección">+${num(collectPts(it))} pts</span></div>
        <div class="cv-thumb">${kitImage(kit, it)}${it.special ? '<span class="cv-signed">✍️ Firmada</span>' : ''}<span class="cv-zoom" aria-hidden="true">🔍</span></div>
        <div class="cv-plate">
          <h3>${kit.team} ${kit.year}</h3>
          <p>${kit.type} · ${kit.brand} · Talla ${it.size}</p>
          <div class="cv-line">${gradePips(it)}<span class="cv-stars" title="${RARITY_LABELS[kit.rarity]}">${stars(kit.rarity)}</span></div>
          <div class="cv-value"><small>Valor</small><b>${fmt(estimate(it).mid)}</b></div>
        </div>
        <div class="cv-foot"><small>Desde el día ${it.collectedDay || 1}</small><button class="btn sm" data-action="uncollect" data-uid="${it.uid}" title="Devolverla al almacén para poder venderla">Sacar</button></div>
      </article>`;
  }

  function candHTML(it) {
    const kit = kitOf(it);
    const ok = isOriginal(it);
    return `
      <article class="cv-cand g${COLLECT_GRADE[it.cond].n}${ok ? '' : ' pending'}">
        <div class="cv-cand-th">${kitImage(kit, it)}</div>
        <div class="cv-cand-main">
          <h4>${title(it)}</h4>
          <p>${kit.type} · Talla ${it.size}</p>
          <div class="cv-cand-meta">${gradeBadge(it)}${it.special ? '<span class="cv-signed-tag">✍️ Firmada</span>' : ''}<small>${ok ? `+${num(collectPts(it))} pts` : 'Sin autenticar'}</small></div>
        </div>
        ${ok
          ? `<button class="btn primary sm" data-action="collect" data-uid="${it.uid}">Coleccionar</button>`
          : `<button class="btn sm" data-action="auth" data-uid="${it.uid}">Autenticar (${fmt(AUTH_COST)})</button>`}
      </article>`;
  }


  // ---------- Ficha de detalle ----------
  let shownUids = [];                 // piezas visibles en la vitrina (para ir a la anterior / siguiente)
  const detail = { open: false };

  function detailHTML(it, i, total) {
    const kit = kitOf(it);
    const g = COLLECT_GRADE[it.cond];
    const e = estimate(it);
    const pts = collectPts(it);
    const score = museumInfo().score;
    const share = score ? Math.round(pts / score * 100) : 0;
    const gain = it.paid > 0 ? e.mid - it.paid : null;
    const nav = total > 1
      ? '<button class="cvd-nav prev" data-choice="prev" aria-label="Anterior">‹</button><button class="cvd-nav next" data-choice="next" aria-label="Siguiente">›</button>'
      : '';
    const calc = `
      <div class="cvd-calc">
        <h4>Cómo se calculan sus puntos</h4>
        <div class="cvd-calc-row">
          <span><small>Rareza</small><b>${num(FAME_BASE[kit.rarity])}</b></span><i>×</i>
          <span><small>Estado</small><b>${num(g.mult)}</b></span>
          ${it.special ? '<i>×</i><span><small>Firma</small><b>1,5</b></span>' : ''}<i>=</i>
          <span class="tot"><small>Puntos</small><b>+${num(pts)}</b></span>
        </div>
      </div>`;
    return `
      <div class="cvd g${g.n} r${kit.rarity}">
        <div class="cvd-stage">
          <div class="cv-top">${gradeBadge(it)}<span class="cvd-ctrl">${total > 1 ? `<small>${i + 1} / ${total}</small>` : ''}<button class="cvd-x" data-choice="close" aria-label="Cerrar">✕</button></span></div>
          <div class="cvd-img">${kitImage(kit, it)}${it.special ? '<span class="cv-signed">✍️ Firmada</span>' : ''}</div>
          ${nav}
        </div>
        <div class="cvd-head">
          <small>${kit.type} · ${kit.brand}</small>
          <h3>${kit.team} ${kit.year}</h3>
          <div class="cvd-rar"><span class="cv-stars">${stars(kit.rarity)}</span><span>${RARITY_LABELS[kit.rarity]}</span><span class="cvd-ok">✔ Original autenticada</span></div>
        </div>
        <div class="cvd-facts">
          <div><small>Estado</small><b>${g.icon} ${g.label}</b>${gradePips(it)}</div>
          <div><small>Valor estimado</small><b>${fmt(e.mid)}</b><em>${fmt(e.low)} – ${fmt(e.high)}</em></div>
          <div><small>Talla</small><b>${it.size}</b><em>${it.special ? 'Edición firmada' : 'Sin firma'}</em></div>
          <div><small>En tu colección</small><b>Día ${it.collectedDay || 1}</b><em>${share}% de tus puntos</em></div>
          <div><small>Fama</small><b>×${num(g.fame)}</b><em>por estar expuesta</em></div>
          ${gain === null ? `<div><small>Puntos</small><b>+${num(pts)}</b><em>de colección</em></div>` : `<div><small>Pagaste</small><b>${fmt(it.paid)}</b><em class="${gain >= 0 ? 'pos' : 'neg'}">${gain >= 0 ? '+' : '−'}${fmt(Math.abs(gain))} de valor</em></div>`}
        </div>
        ${calc}
        <div class="cvd-actions">
          <button class="btn" data-choice="uncollect" title="Devolverla al almacén para poder venderla">Sacar de la colección</button>
          <button class="btn primary" data-choice="close">Cerrar</button>
        </div>
      </div>`;
  }

  async function openDetail(uid) {
    uid = Number(uid);
    let list = shownUids.includes(uid) ? shownUids.slice() : [uid];
    let i = list.indexOf(uid);
    detail.open = true;
    try {
      for (;;) {
        const it = collectionOf().find(x => x.uid === list[i]);
        if (!it) { closeDialog(); return; }
        const p = dialog(detailHTML(it, i, list.length));
        const sheet = $('#sheet'); if (sheet) sheet.scrollTop = 0;
        const r = await p;
        if (r.choice === 'prev') i = (i - 1 + list.length) % list.length;
        else if (r.choice === 'next') i = (i + 1) % list.length;
        else { closeDialog(); if (r.choice === 'uncollect') uncollectItem(it.uid); return; }
      }
    } finally { detail.open = false; }
  }
  const detailBtn = c => $(`#sheet [data-choice="${c}"]`);

  // ---------- Render ----------
  function renderCollectionTab(f = fame()) {
    if (!$('#tab-collection')) return;
    const m = museumInfo();
    const list = m.list;
    const v = cview();
    const shown = list.filter(it => cvPass(it, v.filter)).sort(CV_SORTS[v.sort] || CV_SORTS.cond);
    shownUids = shown.map(it => it.uid);

    $('#coll-sub').textContent = list.length
      ? `${list.length} ${list.length === 1 ? 'pieza original' : 'piezas originales'} · ${m.name}`
      : 'Aparta tus mejores originales de la venta y exhíbelas aquí';
    $('#coll-hero').innerHTML = heroHTML(m);
    $('#coll-sets').innerHTML = setsHTML(f);
    $('#coll-tools').innerHTML = toolsHTML(list);
    $('#coll-title').textContent = `🗄️ Vitrina (${shown.length}${shown.length !== list.length ? ` de ${list.length}` : ''})`;

    const free = v.filter === 'all' ? Math.max(0, MIN_SLOTS - shown.length) : 0;
    const slot = '<div class="cv-slot"><span>📚</span><b>Hueco libre</b><small>Autentica una camiseta y pulsa «Coleccionar»</small></div>';
    $('#coll-vitrine').innerHTML = (shown.length || free ? shown.map(vitrineCard).join('') + slot.repeat(free) : '<p class="cv-empty">No hay piezas con este estado en tu colección.</p>');

    const stock = S.stock.filter(it => !(it.verified && !it.real));   // las réplicas confirmadas no entran
    const replicas = S.stock.length - stock.length;
    const ready = stock.filter(isOriginal).sort(CV_SORTS.cond);
    const todo = stock.filter(it => !it.verified).sort(CV_SORTS.cond);
    const parts = [];
    if (ready.length) parts.push(`<h4 class="cv-sub">✔ Originales listas (${ready.length})</h4><div class="cv-cands">${ready.map(candHTML).join('')}</div>`);
    if (todo.length) parts.push(`<h4 class="cv-sub">🔍 Pendientes de autenticar (${todo.length})</h4><div class="cv-cands">${todo.map(candHTML).join('')}</div>`);
    if (replicas) parts.push(`<p class="cv-note">🚫 ${replicas} ${replicas === 1 ? 'réplica descartada' : 'réplicas descartadas'}: no entran en la colección.</p>`);
    $('#coll-cands').innerHTML = parts.length ? parts.join('') : '<p class="cv-empty">No tienes camisetas en el almacén. Compra alguna en el Mercado y autentícala.</p>';
  }

  // ---------- Eventos ----------
  const modalHidden = () => { const m = $('#modal'); return !m || m.classList.contains('hidden'); };
  document.addEventListener('click', e => {
    if (detail.open && modalHidden()) detail.open = false;
    if (detail.open) { if (e.target.id === 'modal' && detailBtn('close')) detailBtn('close').click(); return; }   // clic fuera = cerrar
    const b = e.target.closest('[data-action]');
    if (b) {
      const a = b.dataset.action;
      if (a === 'collect') collectItem(b.dataset.uid);
      else if (a === 'uncollect') uncollectItem(b.dataset.uid);
      else if (a === 'cfilter') { cview().filter = cview().filter === b.dataset.f ? 'all' : b.dataset.f; save(); renderAll(); }
      return;
    }
    const card = e.target.closest('#tab-collection .cv-card[data-uid]');
    if (card) { openDetail(card.dataset.uid); return; }
    const set = e.target.closest('#tab-collection .cv-set');
    if (set) { const on = set.classList.toggle('open'); set.setAttribute('aria-expanded', on); }
  });
  document.addEventListener('keydown', e => {
    if (detail.open && modalHidden()) detail.open = false;
    if (detail.open) {
      const key = { Escape: 'close', ArrowLeft: 'prev', ArrowRight: 'next' }[e.key];
      if (key && detailBtn(key)) { e.preventDefault(); detailBtn(key).click(); }
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#tab-collection .cv-card, #tab-collection .cv-set')) {
      e.preventDefault(); e.target.click();
    }
  });
  document.addEventListener('change', e => {
    if (e.target.matches && e.target.matches('select[data-csort]')) { cview().sort = e.target.value; save(); renderAll(); }
  });

  // Lo que usan core.js y otros archivos
  Object.assign(window, { collectFameMult, museumInfo, collectBtn, renderCollectionTab, collectItem, uncollectItem, openCollectionDetail: openDetail, ownedFlag, ownedChip, packOwnedChip });
})();
