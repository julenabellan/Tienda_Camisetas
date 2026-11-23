// =====================================================================
//  Restauración de camisetas
//  Va después de core.js (y de camisetas / negociación) en index.html.
//  Servicios: lavar (manchas), reparar (costuras) y enmarcar (valor extra).
//  Los defectos de cada camiseta se derivan de su uid y su estado, así que
//  no hace falta tocar la generación de piezas ni las partidas guardadas.
// =====================================================================

const RESTORE = {
  wash:   { id: 'wash',   icon: '🫧', name: 'Lavar',    cost: 6 },
  repair: { id: 'repair', icon: '🪡', name: 'Reparar',  cost: 18 },
  frame:  { id: 'frame',  icon: '🖼️', name: 'Enmarcar', cost: 35 },
};
const RESTORE_ORDER = ['wash', 'repair', 'frame'];
const FRAME_MULT = 1.3;     // una pieza enmarcada vale más
const PEEL_MULT = 0.85;     // dorsal o nombre despegado
const BOTCH_MULT = 0.92;    // arreglo que se nota
const WASH_OK = { usada: 0.55, buena: 0.70 };   // prob. de que salga la mancha
const PEEL_RISK = 0.15;     // prob. de que se despegue el estampado al lavar
const REPAIR_ODDS = { ok: 0.75, nothing: 0.15 };   // el resto: arreglo chapucero
const FRAME_OK = 0.94;

// Las Player (desde 1991) son más delicadas: se despegan más, los arreglos salen peor y recuperarlas cuesta más
const PEEL_RISK_PLAYER = 0.25;                                  // prob. de que se despegue el estampado al lavar
const REPAIR_ODDS_PLAYER = { ok: 0.70, nothing: 0.15 };         // el resto (15 %): arreglo chapucero
const PLAYER_COST_MULT = { usada: 1.6, buena: 1.3 };            // recargo de los servicios en mal estado (muy usada / buen estado)
const isPlayerKit = it => typeof isPlayer === 'function' && isPlayer(it);
const peelRisk = it => (isPlayerKit(it) ? PEEL_RISK_PLAYER : PEEL_RISK);
const repairOdds = it => (isPlayerKit(it) ? REPAIR_ODDS_PLAYER : REPAIR_ODDS);
const svcCost = (it, svc) => Math.round(RESTORE[svc].cost * (isPlayerKit(it) ? (PLAYER_COST_MULT[it.cond] || 1) : 1));

// ---------- Defectos (deterministas por uid) ----------
function restoreRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function flawsOf(it) {
  if (it.flaws) return it.flaws;
  const r = restoreRng(it.uid * 7919 + 13);
  let stain = false, tear = false;
  if (it.cond === 'usada') {
    stain = r() < 0.65; tear = r() < 0.55;
    if (!stain && !tear) { if (r() < 0.5) stain = true; else tear = true; }
  } else if (it.cond === 'buena') {
    stain = r() < 0.30; tear = r() < 0.20;
  }
  return { stain, tear, print: r() < 0.30 };   // print: lleva nombre y dorsal estampados
}

const restoreMult = it => (it.framed ? FRAME_MULT : 1) * (it.peeled ? PEEL_MULT : 1) * (it.botched ? BOTCH_MULT : 1);
const condIndex = it => CONDITIONS.findIndex(c => c.id === it.cond);
const pct = p => `${Math.round(p * 100)} %`;

// ---------- Qué se puede hacer con cada pieza ----------
function svcState(it, svc) {
  const fl = flawsOf(it);
  const kit = kitOf(it);
  if (svc === 'wash') {
    if (!fl.stain) return { ok: false, reason: 'No tiene manchas.' };
    const p = WASH_OK[it.cond] || 0.7;
    const odds = [`<span class="odd good">${pct(p)} sale la mancha</span>`, `<span class="odd bad">${pct(1 - p)} no sale</span>`];
    if (fl.print && !it.peeled) odds.push(`<span class="odd warn">${pct(peelRisk(it))} se despega el dorsal</span>`);
    return { ok: true, desc: 'Quita las manchas. Con todos los defectos resueltos, la camiseta sube de estado.', odds: odds.join('') };
  }
  if (svc === 'repair') {
    if (!fl.tear) return { ok: false, reason: 'No tiene costuras sueltas ni desgarros.' };
    const ro = repairOdds(it);
    const bad = 1 - ro.ok - ro.nothing;
    return {
      ok: true,
      desc: 'Arregla costuras y desgarros. Con todos los defectos resueltos, sube de estado.',
      odds: `<span class="odd good">${pct(ro.ok)} sale bien</span><span class="odd bad">${pct(ro.nothing)} no aguanta</span><span class="odd warn">${pct(bad)} arreglo chapucero</span>`,
    };
  }
  if (it.framed) return { ok: false, reason: 'Ya está enmarcada.' };
  if (!it.verified || !it.real) return { ok: false, reason: it.verified ? 'No se enmarcan réplicas.' : 'Autentícala antes de enmarcarla.' };
  if (condIndex(it) > 1) return { ok: false, reason: 'Solo se enmarcan piezas en muy buen estado.' };
  if (kit.rarity < 2) return { ok: false, reason: 'No compensa enmarcar una pieza común.' };
  return {
    ok: true,
    desc: `Pieza de coleccionista: +${Math.round((FRAME_MULT - 1) * 100)} % de valor.`,
    odds: `<span class="odd good">${pct(FRAME_OK)} sale bien</span><span class="odd bad">${pct(1 - FRAME_OK)} llega roto el cristal</span>`,
  };
}

const restoreOptions = it => RESTORE_ORDER.filter(s => svcState(it, s).ok);

// ---------- Piezas de interfaz que usa core.js ----------
function restoreChips(it) {
  const fl = flawsOf(it);
  const c = [];
  if (fl.stain) c.push('<span class="chip flaw">🩸 Mancha</span>');
  if (fl.tear) c.push('<span class="chip flaw">🧵 Costura suelta</span>');
  if (it.peeled) c.push('<span class="chip flaw">📛 Dorsal despegado</span>');
  if (it.botched) c.push('<span class="chip flaw">🪡 Arreglo visible</span>');
  if (it.restored) c.push('<span class="chip good">✨ Restaurada</span>');
  if (it.framed) c.push('<span class="chip good">🖼️ Enmarcada</span>');
  return c.join('');
}

function restoreBar(it) {
  const opts = restoreOptions(it);
  if (!opts.length) return '';
  const names = opts.map(s => RESTORE[s].name).join(' · ');
  return `<button class="restore-bar" data-action="restore" data-uid="${it.uid}"><span>🧼 Restaurar</span><small>${names}</small></button>`;
}

const restoreBtn = (it, cls = '') => (restoreOptions(it).length ? `<button class="btn ${cls}" data-action="restore" data-uid="${it.uid}">🧼 Restaurar</button>` : '');

// ---------- Aplicar un servicio ----------
function applyRestore(it, svc) {
  const st = svcState(it, svc);
  if (!st.ok) return { error: st.reason };
  const def = RESTORE[svc];
  const cost = svcCost(it, svc);
  if (S.money < cost) return { error: 'No tienes caja para eso.' };
  S.money -= cost;

  const wasSuggested = it.listPrice === suggestedPrice(it);
  const fl = it.flaws = { ...flawsOf(it) };
  const lines = [];
  let tone = 'ok';
  let title = '';

  if (svc === 'wash') {
    const ok = Math.random() < (WASH_OK[it.cond] || 0.7);
    if (ok) { fl.stain = false; lines.push('La mancha ha salido.'); title = 'Bien lavada'; }
    else { lines.push('Las manchas no han salido. Pierdes lo que costó el lavado.'); tone = 'bad'; title = 'Siguen las manchas'; }
    if (fl.print && !it.peeled && Math.random() < peelRisk(it)) {
      it.peeled = true;
      lines.push('Se ha despegado parte del nombre y del dorsal. Pierde valor.');
      tone = ok ? 'mixed' : 'bad';
      title = ok ? 'Limpia, pero sin dorsal' : 'Mancha y dorsal despegado';
    }
  } else if (svc === 'repair') {
    const r = Math.random();
    const ro = repairOdds(it);
    if (r < ro.ok) { fl.tear = false; lines.push('Costuras y desgarros reparados.'); title = 'Bien reparada'; }
    else if (r < ro.ok + ro.nothing) { lines.push('La tela no aguanta el arreglo. Pierdes lo que costó la reparación.'); tone = 'bad'; title = 'No se pudo arreglar'; }
    else { fl.tear = false; it.botched = true; lines.push('El arreglo se nota. La camiseta pierde algo de valor.'); tone = 'mixed'; title = 'Arreglo chapucero'; }
  } else {
    if (Math.random() < FRAME_OK) { it.framed = true; lines.push('Ya es una pieza de coleccionista.'); title = 'Enmarcada'; }
    else { lines.push('El marco llegó con el cristal roto. Pierdes lo que costó.'); tone = 'bad'; title = 'Marco roto'; }
  }

  // sin defectos pendientes, sube un escalón (como máximo uno por pieza)
  if (svc !== 'frame' && !fl.stain && !fl.tear && !it.restored && condIndex(it) >= 2) {
    const before = COND[it.cond].label;
    it.cond = CONDITIONS[condIndex(it) - 1].id;
    it.restored = true;
    lines.push(`Sube de estado: de «${before}» a «${COND[it.cond].label}».`);
    if (tone === 'ok') title = '¡Restaurada!';
  }

  if (wasSuggested) it.listPrice = suggestedPrice(it);
  addXP(1);
  log(`${def.name} ${title.toLowerCase() === def.name.toLowerCase() ? '' : '— '}${title}: ${kitOf(it).team} ${kitOf(it).year}.`);
  return { tone, title, lines, svc };
}

// ---------- Diálogos ----------
function restoreMenuHTML(it) {
  const kit = kitOf(it);
  const rows = RESTORE_ORDER.map(id => {
    const def = RESTORE[id];
    const st = svcState(it, id);
    const cost = svcCost(it, id);
    const afford = S.money >= cost;
    return `
      <div class="rs-opt${st.ok ? '' : ' off'}">
        <span class="rs-ico">${def.icon}</span>
        <div class="rs-txt">
          <b>${def.name} <em>${fmt(cost)}${cost > def.cost ? ` <s>${fmt(def.cost)}</s>` : ''}</em></b>
          <p>${st.ok ? st.desc : st.reason}</p>
          ${st.ok ? `<div class="rs-odds">${st.odds}</div>` : ''}
        </div>
        ${st.ok ? `<button class="btn primary sm" data-choice="${id}"${afford ? '' : ' disabled'}>${afford ? 'Elegir' : 'Sin caja'}</button>` : ''}
      </div>`;
  }).join('');
  return `
    <div class="report rs">
      <div class="rs-head">
        <div class="thumb">${kitImage(kit)}</div>
        <div>
          <h3>Taller de restauración</h3>
          <p>${kit.team} ${kit.year} · ${kit.type} · Talla ${it.size}</p>
          <div class="chips"><span class="chip">${COND[it.cond].label}</span>${restoreChips(it)}</div>
        </div>
      </div>
      <p class="rs-note">Cada pieza solo puede subir un escalón de estado. Si algo sale mal, el dinero no se devuelve.</p>
      ${isPlayerKit(it) ? `<p class="rs-note rs-player">🎽 Versión Player: tejido técnico más delicado. Más riesgo de que se despegue el dorsal o salga un arreglo chapucero${PLAYER_COST_MULT[it.cond] ? ', y el taller cobra más por piezas en este estado' : ''}.</p>` : ''}
      ${rows}
      <div class="actions"><button class="btn ghost" data-choice="close">Cerrar</button></div>
    </div>`;
}

function restoreResultHTML(it, res) {
  const icon = { ok: '✨', mixed: '😬', bad: '💸' }[res.tone];
  const more = restoreOptions(it).length > 0;
  return `
    <div class="report rs rs-res ${res.tone}">
      <div class="rs-banner"><span>${icon}</span><div><h3>${res.title}</h3><p>${kitOf(it).team} ${kitOf(it).year}</p></div></div>
      <ul>${res.lines.map(l => `<li>${l}</li>`).join('')}</ul>
      <div class="actions">
        ${more ? '<button class="btn" data-choice="again">Seguir restaurando</button>' : ''}
        <button class="btn primary" data-choice="done">Listo</button>
      </div>
    </div>`;
}

async function openRestore(uid) {
  for (;;) {
    const it = S.stock.find(x => x.uid === Number(uid));
    if (!it) return;
    const r = await dialog(restoreMenuHTML(it));
    closeDialog();
    if (!RESTORE[r.choice]) return;
    const res = applyRestore(it, r.choice);
    if (res.error) { toast(res.error); continue; }
    save(); renderAll();
    const r2 = await dialog(restoreResultHTML(it, res));
    closeDialog();
    if (r2.choice !== 'again') return;
  }
}

// ---------- Estilos ----------
(function injectRestoreCSS() {
  const css = `
.restore-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-top: 8px; padding: 8px 12px; border-radius: 10px; border: 1px dashed #d9bd5a; background: #fbf6e4; color: #6b5200; font: inherit; font-weight: 700; cursor: pointer; text-align: left; }
.restore-bar small { font-weight: 600; color: #8a6d12; }
.restore-bar:hover { background: #f7efcf; }
.chip.flaw { background: #fde8e5; color: #9a2a1f; border-color: #f2b9b1; }
.chip.good { background: #e3f6ec; color: #17734a; border-color: #a9dcc1; }
.rs-head { display: flex; gap: 12px; align-items: center; }
.rs-head .thumb { flex: none; width: 84px; height: 84px; display: grid; place-items: center; border-radius: 10px; background: #eef2f6; }
.rs-head .thumb .shirt, .rs-head .thumb img { max-width: 100%; max-height: 100%; }
.rs-head h3 { font-size: 1.35rem; }
.rs-head p { color: var(--muted); font-size: .88rem; }
.rs-head .chips { margin-top: 4px; }
.rs-note { margin: 10px 0 4px; font-size: .84rem; color: var(--muted); }
.rs-opt { display: flex; gap: 10px; align-items: center; padding: 10px; margin-top: 8px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
.rs-opt.off { opacity: .55; background: #f1f4f7; }
.rs-ico { flex: none; font-size: 1.6rem; width: 38px; text-align: center; }
.rs-txt { flex: 1; min-width: 0; }
.rs-txt b { display: flex; justify-content: space-between; gap: 8px; }
.rs-txt b em { font-style: normal; font-family: 'Anton', sans-serif; font-weight: 400; color: var(--ink-3); }
.rs-txt p { font-size: .84rem; color: var(--muted); }
.rs-odds { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.odd { padding: 1px 8px; border-radius: 999px; font-size: .72rem; font-weight: 700; }
.odd.good { background: #e3f6ec; color: #17734a; }
.odd.bad { background: #fde8e5; color: #9a2a1f; }
.odd.warn { background: #fff1d0; color: #8a5a00; }
.rs-banner { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; color: #fff; background: linear-gradient(135deg, #17734a, #1f9d63); }
.rs-res.mixed .rs-banner { background: linear-gradient(135deg, #8a5a00, #d08a12); }
.rs-res.bad .rs-banner { background: linear-gradient(135deg, #9a2a1f, #de4a3b); }
.rs-banner > span { font-size: 2.2rem; }
.rs-banner h3 { color: #fff; }
.rs-banner p { color: rgba(255,255,255,.85); font-size: .88rem; }
.tile-price { display: flex; gap: 6px; align-items: stretch; }
.tile-price .price-btn { flex: 1; min-width: 0; }
.lock { flex: none; width: 42px; border-radius: 10px; border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.08); color: #fff; font-size: 1.05rem; cursor: pointer; }
.lock:hover { background: rgba(255,255,255,.16); }
.lock.on { background: var(--yellow); border-color: var(--yellow); color: #1a1a1a; }
.tile.locked { border-color: var(--yellow); box-shadow: 0 0 0 1px var(--yellow), 0 0 16px rgba(244,196,48,.35); }
.lock-flag { position: absolute; left: 50%; bottom: 6px; z-index: 2; transform: translateX(-50%); padding: 2px 10px; border-radius: 999px; background: rgba(13,26,43,.88); color: var(--yellow); font-size: .66rem; font-weight: 700; letter-spacing: .04em; white-space: nowrap; }
.rs-res ul { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();
