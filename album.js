// album.js — ÁLBUM DE CAMISETAS
// Álbum tipo cromos con TODAS las camisetas del juego (KITS) ordenadas y numeradas, repartidas en páginas.
// Se rellena con las camisetas de tu colección personal, pero solo cuentan las ORIGINALES AUTENTICADAS
// en BUEN ESTADO (Buena, Excelente o Mint). Una pieza «Gastada» se queda en la vitrina pero no pega en el álbum.
// Al coleccionar una camiseta nueva, el álbum pasa a su página y se anima el cromo pegándose.
// Depende de core.js (S, KITS, KIT_BY_ID, dialog…), camisetas.js (kitImage) y coleccion.js (avisa con «album:collected»).
// Se carga DESPUÉS de coleccion.js.
'use strict';
(() => {

  // ---------- Configuración ----------
  const PAGE_SIZE = 6;     // cromos por página
  const PLAY_MS = 1800;    // duración de la animación de pegar
  // Estados que valen para el álbum (n = nota, igual que en coleccion.js)
  const GOOD = {
    nueva:     { n: 4, icon: '💎', tag: 'Mint' },
    excelente: { n: 3, icon: '🥇', tag: 'Excelente' },
    buena:     { n: 2, icon: '🥈', tag: 'Buen estado' },
  };
  const rank = it => GOOD[it.cond].n + (it.special ? 0.5 : 0);   // mejor estado y, a igualdad, firmada
  const pad = n => String(n).padStart(3, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SPARKS = '<i class="al-spark"></i>'.repeat(8);

  // ---------- Modelo del álbum (se calcula una vez) ----------
  let model = null;

  // Reparte las camisetas en páginas: un equipo no se parte si cabe entero en una página nueva
  function paginate(kits) {
    const pages = [];
    let cur = [];
    const flush = () => { if (cur.length) { pages.push(cur); cur = []; } };
    const groups = [];
    kits.forEach(k => {
      const g = groups[groups.length - 1];
      if (g && g.team === k.team) g.kits.push(k); else groups.push({ team: k.team, kits: [k] });
    });
    groups.forEach(g => {
      let rest = g.kits;
      while (rest.length) {
        if (cur.length && cur.length + rest.length > PAGE_SIZE && rest.length <= PAGE_SIZE) flush();
        const room = PAGE_SIZE - cur.length;
        cur.push(...rest.slice(0, room));
        rest = rest.slice(room);
        if (cur.length >= PAGE_SIZE) flush();
      }
    });
    flush();
    return pages;
  }

  function getModel() {
    if (model && model.size === KITS.length) return model;
    const sorted = KITS.slice().sort((a, b) =>
      (a.nat ? 1 : 0) - (b.nat ? 1 : 0)
      || a.team.localeCompare(b.team, 'es')
      || a.year - b.year
      || String(a.type).localeCompare(String(b.type), 'es'));
    model = {
      size: KITS.length,
      no: new Map(sorted.map((k, i) => [k.id, i + 1])),     // número de cromo, estable
      chapters: {
        club: { label: 'Clubes', icon: '🏟️', pages: paginate(sorted.filter(k => !k.nat)) },
        nat:  { label: 'Selecciones', icon: '🌍', pages: paginate(sorted.filter(k => k.nat)) },
      },
    };
    return model;
  }

  function locate(m, kitId) {
    for (const [c, ch] of Object.entries(m.chapters)) {
      const p = ch.pages.findIndex(pg => pg.some(k => k.id === kitId));
      if (p >= 0) return { chapter: c, page: p };
    }
    return null;
  }

  const pageTitle = pg => {
    const teams = [...new Set(pg.map(k => k.team))];
    return teams.length <= 2 ? teams.join(' · ') : `${teams[0]} … ${teams[teams.length - 1]}`;
  };

  // ---------- Estado ----------
  const view = () => (S.album = S.album || { chapter: 'club', page: 0 });

  // Mejor pieza válida por camiseta (own) y camisetas que solo tienes gastadas (weak)
  function collectionState() {
    const own = new Map();
    const weak = new Set();
    (S.collection || []).forEach(it => {
      if (!GOOD[it.cond]) { weak.add(it.kitId); return; }
      const cur = own.get(it.kitId);
      if (!cur || rank(it) > rank(cur)) own.set(it.kitId, it);
    });
    return { own, weak };
  }

  // Qué pasa con un hueco vacío: lista para pegar / sin autenticar / estado bajo / no la tienes
  function slotStatus(kit, st) {
    const mine = S.stock.filter(it => it.kitId === kit.id && !(it.verified && !it.real));   // sin réplicas
    const ready = mine.filter(it => it.verified && it.real && GOOD[it.cond]).sort((a, b) => rank(b) - rank(a))[0];
    if (ready) return { k: 'ready', it: ready };
    if (mine.some(it => !it.verified)) return { k: 'pending' };
    if (mine.some(it => it.verified && it.real) || st.weak.has(kit.id)) return { k: 'worn' };
    return { k: 'none' };
  }

  // ---------- Plantillas ----------
  function slotHTML(kit, st, m, playKit) {
    const no = m.no.get(kit.id);
    const rot = (((no * 37) % 7) - 3) * 0.7;            // cada cromo queda pegado un pelín torcido
    const it = st.own.get(kit.id);
    const rar = `r${kit.rarity}`;
    const head = `<span class="al-no">Nº ${pad(no)}</span>`;
    const name = `<b>${esc(kit.team)}</b><small>${kit.year} · ${esc(kit.type)}</small>`;

    if (it) {
      const g = GOOD[it.cond];
      const play = playKit === kit.id;
      return `<button class="al-slot got g${g.n} ${rar}${play ? ' pasting' : ''}" style="--rot:${rot}deg" data-alb="open" data-uid="${it.uid}" aria-label="${esc(kit.team)} ${kit.year}, pegada: ver en detalle">
        ${head}
        <span class="al-sticker">
          <span class="al-img">${kitImage(kit, it)}</span>
          <span class="al-grade" title="${g.tag}">${g.icon}</span>
          ${it.special ? '<span class="al-sig" title="Firmada">✍️</span>' : ''}
          <span class="al-foil"></span>
        </span>
        ${name}
        ${play ? SPARKS : ''}
      </button>`;
    }

    const s = slotStatus(kit, st);
    const hint = { ready: '✨ Lista para pegar', pending: '🔍 Sin autenticar', worn: '⚠️ Estado bajo', none: '' }[s.k];
    return `<button class="al-slot empty ${rar} ${s.k}" style="--rot:${rot}deg" data-alb="empty" data-kit="${kit.id}" aria-label="${esc(kit.team)} ${kit.year}, hueco vacío">
      ${head}
      <span class="al-sticker"><span class="al-img al-ghost">${kitImage(kit)}</span><span class="al-q" aria-hidden="true">?</span></span>
      ${name}
      ${hint ? `<em class="al-hint">${hint}</em>` : `<span class="al-stars" title="${typeof RARITY_LABELS !== 'undefined' ? RARITY_LABELS[kit.rarity] : ''}">${'★'.repeat(kit.rarity)}</span>`}
    </button>`;
  }

  function albumHTML(playKit, turn) {
    const m = getModel();
    const st = collectionState();
    const v = view();

    // Capítulo y página válidos
    if (!m.chapters[v.chapter] || !m.chapters[v.chapter].pages.length) v.chapter = m.chapters.club.pages.length ? 'club' : 'nat';
    const ch = m.chapters[v.chapter];
    if (!ch.pages.length) return '<div class="al"><p class="al-rule">Todavía no hay camisetas en el catálogo.</p></div>';
    v.page = clamp(Number(v.page) || 0, 0, ch.pages.length - 1);
    const pg = ch.pages[v.page];

    const count = list => list.filter(k => st.own.has(k.id)).length;
    const total = m.no.size;
    const got = count(KITS);
    const pct = total ? Math.round(got / total * 100) : 0;
    const pageGot = count(pg);
    const done = pageGot === pg.length;

    const chaps = Object.entries(m.chapters).filter(([, c]) => c.pages.length).map(([key, c]) => {
      const all = c.pages.flat();
      return `<button class="al-chap${key === v.chapter ? ' on' : ''}" data-alb="chap" data-v="${key}" aria-pressed="${key === v.chapter}">${c.icon} ${c.label} <b>${count(all)}/${all.length}</b></button>`;
    }).join('');

    const opts = ch.pages.map((p, i) => `<option value="${i}"${i === v.page ? ' selected' : ''}>${i + 1}. ${esc(pageTitle(p))} (${count(p)}/${p.length})${count(p) === p.length ? ' ✔' : ''}</option>`).join('');

    return `
      <div class="al">
        <div class="al-head">
          <div><small>Álbum de camisetas</small><h3>Colección completa</h3></div>
          <div class="al-total"><b>${got}</b><em>/${total}</em><small>${pct}% completado</small></div>
        </div>
        <div class="al-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        <p class="al-rule">Solo se pegan <b>originales autenticadas en buen estado</b> (Buena, Excelente o Mint). Las gastadas se quedan en la vitrina.</p>
        <div class="al-chaps">${chaps}</div>
        <div class="al-nav">
          <button class="al-arrow" data-alb="prev" aria-label="Página anterior"${v.page === 0 ? ' disabled' : ''}>‹</button>
          <select data-alpage aria-label="Ir a la página">${opts}</select>
          <button class="al-arrow" data-alb="next" aria-label="Página siguiente"${v.page >= ch.pages.length - 1 ? ' disabled' : ''}>›</button>
        </div>
        <section class="al-page${done ? ' complete' : ''}${turn ? ` turn-${turn}` : ''}">
          <header class="al-page-h">
            <h4>${esc(pageTitle(pg))}</h4>
            <span>${pageGot}/${pg.length}</span>
          </header>
          <div class="al-grid">${pg.map(k => slotHTML(k, st, m, playKit)).join('')}</div>
          <footer class="al-page-f"><span>Página ${v.page + 1} de ${ch.pages.length}</span>${done ? '<span class="al-ribbon">✔ Página completa</span>' : ''}</footer>
        </section>
      </div>`;
  }

  // ---------- Render y animación ----------
  let pending = null;     // cromo que se acaba de coleccionar y aún no se ha animado
  let playing = false;    // animación en curso: no se vuelve a pintar hasta que acabe
  let dirty = false;
  let turn = '';          // dirección del pase de página («next» / «prev»), de un solo uso
  let observed = false;

  function ensureHost() {
    let h = $('#coll-album');
    if (!h) {
      const hero = $('#coll-hero');
      if (!hero) return null;
      h = document.createElement('section');
      h.id = 'coll-album';
      hero.after(h);        // justo debajo de la cabecera de la colección
    }
    if (!observed && 'IntersectionObserver' in window) {
      observed = true;
      // Si el cromo se pegó con la pestaña oculta, se anima en cuanto la abres
      new IntersectionObserver(es => { if (pending && es.some(e => e.isIntersecting)) renderAlbum(); }).observe(h);
    }
    return h;
  }

  function renderAlbum() {
    const host = ensureHost();
    if (!host) return;
    if (playing) { dirty = true; return; }
    const visible = host.offsetParent !== null;
    let playKit = null;
    if (pending && visible) {
      const p = pending;
      pending = null;
      playKit = p.kitId;
      playing = true;
      setTimeout(() => {
        playing = false;
        if (dirty) { dirty = false; renderAlbum(); }
        celebrate(p);
      }, PLAY_MS);
    }
    const t = turn; turn = '';
    host.innerHTML = albumHTML(playKit, t);
    if (playKit) {
      const el = host.querySelector('.al-slot.pasting');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Al terminar de pegar: avisa si la página (o el álbum entero) ha quedado completa
  function celebrate(p) {
    const m = getModel();
    const st = collectionState();
    const loc = locate(m, p.kitId);
    if (!loc) return;
    const pg = m.chapters[loc.chapter].pages[loc.page];
    if (st.own.size >= m.no.size) toast('🏆 ¡Álbum completo! No te falta ni una camiseta.');
    else if (pg.every(k => st.own.has(k.id))) toast(`🎉 ¡Página completa: ${pageTitle(pg)}!`);
  }

  // coleccion.js avisa cuando entra una pieza nueva en la colección
  document.addEventListener('album:collected', ev => {
    const { uid, kitId } = ev.detail || {};
    const it = (S.collection || []).find(x => x.uid === uid);
    if (!it || !GOOD[it.cond]) return;                          // gastadas: no se pegan
    const st = collectionState();
    if (!st.own.has(kitId) || st.own.get(kitId).uid !== uid) return;   // no mejora el cromo que ya había pegado
    const loc = locate(getModel(), kitId);
    if (!loc) return;
    const v = view();
    v.chapter = loc.chapter; v.page = loc.page;               // el álbum salta a su página
    pending = { kitId, uid };
  });

  // ---------- Hueco vacío: qué te falta ----------
  async function emptyDialog(kitId) {
    const kit = KIT_BY_ID[kitId];
    if (!kit) return;
    const m = getModel();
    const s = slotStatus(kit, collectionState());
    const msg = {
      ready: `Tienes una original autenticada (${GOOD[s.it && s.it.cond] ? GOOD[s.it.cond].icon + ' ' + GOOD[s.it.cond].tag : ''}${s.it && s.it.special ? ' · firmada' : ''}) lista para pegar.`,
      pending: 'Tienes esta camiseta en el almacén, pero aún no está autenticada. Autentícala abajo, en «Pendientes de autenticar».',
      worn: 'Tu camiseta está demasiado gastada: el álbum pide originales autenticadas en buen estado (Buena o mejor).',
      none: 'Todavía no la tienes. Búscala en el Mercado, autentícala y pégala aquí.',
    }[s.k];
    const html = `
      <div class="ald">
        <small>Cromo Nº ${pad(m.no.get(kit.id))}</small>
        <div class="ald-img ghost">${kitImage(kit)}</div>
        <h3>${esc(kit.team)} ${kit.year}</h3>
        <p class="sub">${esc(kit.type)} · ${esc(kit.brand)} · ${'★'.repeat(kit.rarity)}</p>
        <p class="ald-msg">${msg}</p>
        <div class="ald-actions">
          ${s.k === 'ready' ? '<button class="btn primary" data-choice="paste">📖 Pegar en el álbum</button>' : ''}
          <button class="btn" data-choice="close">Cerrar</button>
        </div>
      </div>`;
    const r = await dialog(html);
    closeDialog();
    if (r && r.choice === 'paste' && s.it) window.collectItem(s.it.uid);
  }

  // ---------- Etiqueta para las candidatas de coleccion.js ----------
  function albumTag(it) {
    if (!it || !it.verified || !it.real || !GOOD[it.cond]) return '';
    if (!getModel().no.has(it.kitId)) return '';
    const cur = collectionState().own.get(it.kitId);
    if (!cur) return '<span class="al-tag" title="Esta camiseta rellena un hueco de tu álbum">📖 Hueco del álbum</span>';
    return rank(it) > rank(cur) ? '<span class="al-tag up" title="Mejora el cromo que ya tienes pegado">📖 Mejora tu cromo</span>' : '';
  }

  // ---------- Eventos ----------
  const pagesOf = () => getModel().chapters[view().chapter].pages;
  function goTo(page) {
    const v = view();
    const n = clamp(page, 0, pagesOf().length - 1);
    if (n === v.page) return;
    turn = n > v.page ? 'next' : 'prev';
    v.page = n;
    save(); renderAlbum();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('#coll-album [data-alb]');
    if (!b) return;
    const a = b.dataset.alb;
    if (a === 'open') window.openCollectionDetail(b.dataset.uid);
    else if (a === 'empty') emptyDialog(b.dataset.kit);
    else if (a === 'prev') goTo(view().page - 1);
    else if (a === 'next') goTo(view().page + 1);
    else if (a === 'chap') {
      const v = view();
      if (v.chapter !== b.dataset.v) { v.chapter = b.dataset.v; v.page = 0; turn = 'next'; save(); renderAlbum(); }
    }
  });
  document.addEventListener('change', e => {
    if (e.target.matches && e.target.matches('select[data-alpage]')) goTo(Number(e.target.value));
  });

  Object.assign(window, { renderAlbum, albumTag });
})();
