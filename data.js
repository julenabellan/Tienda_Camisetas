// data.js — Catálogo y datos del juego
//
// NOTA: los valores, colores y escudos son aproximados/ficticios; solo sirven para jugar.
// Las camisetas se dibujan en SVG con sus colores. Si quieres usar una foto real,
// rellena el campo `img` con una ruta propia (por ejemplo "img/brasil-1970.jpg") o una URL
// de la que tengas permiso. Si la imagen falla, el juego dibuja la camiseta en SVG.
//
// k(equipo, año, equipación, marca, valorBase, rareza 1-4, color1, color2, dibujo, esSelección)
// dibujo: checks | solid | stripes | hoops | halves | sash | sleeves | band | vband | chevron

function k(team, year, type, brand, base, rarity, c1, c2, pattern, nat) {
  const id = (team + '-' + year + '-' + type).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return { id, team, year, type, brand, base, rarity, c1, c2, pattern, nat: !!nat, img: '' };
}

const KITS = [
  // Selecciones
  k('Brasil', 1970, 'Local', 'Umbro', 320, 4, '#FFD500', '#0A8F3C', 'solid', true),
  k('Brasil', 1998, 'Local', 'Nike', 170, 3, '#FFD500', '#0A8F3C', 'solid', true),
  k('Argentina', 1986, 'Local', 'Le Coq Sportif', 280, 4, '#FFFFFF', '#75AADB', 'stripes', true),
  k('Países Bajos', 1988, 'Local', 'Adidas', 260, 4, '#FF6A13', '#FFFFFF', 'solid', true),
  k('Italia', 1990, 'Local', 'Diadora', 175, 3, '#0057B8', '#FFFFFF', 'solid', true),
  k('Alemania', 1990, 'Local', 'Adidas', 230, 3, '#FFFFFF', '#111111', 'sleeves', true),
  k('Nigeria', 1994, 'Local', 'Nike', 240, 4, '#FFFFFF', '#008751', 'chevron', true),
  k('Colombia', 1994, 'Local', 'Adidas', 200, 3, '#FCD116', '#003893', 'solid', true),
  k('Dinamarca', 1992, 'Local', 'Hummel', 280, 4, '#C60C30', '#FFFFFF', 'solid', true),
  k('Camerún', 1990, 'Local', 'Puma', 210, 3, '#007A5E', '#CE1126', 'solid', true),
  k('Francia', 1998, 'Local', 'Adidas', 260, 4, '#0B2C8A', '#D52B1E', 'solid', true),
  k('Inglaterra', 1996, 'Local', 'Umbro', 180, 3, '#FFFFFF', '#1C2D6B', 'solid', true),

  // Clubes retro
  k('Manchester United', 1999, 'Local', 'Umbro', 150, 3, '#DA291C', '#111111', 'solid'),
  k('Barcelona', 1992, 'Local', 'Meyba', 180, 3, '#A50044', '#004D98', 'stripes'),
  k('Real Madrid', 1998, 'Local', 'Kelme', 140, 2, '#FFFFFF', '#1B2A6B', 'solid'),
  k('AC Milan', 1994, 'Local', 'Lotto', 200, 3, '#D01012', '#111111', 'stripes'),
  k('Juventus', 1996, 'Local', 'Kappa', 170, 3, '#F4F4F4', '#111111', 'stripes'),
  k('Inter', 1998, 'Local', 'Nike', 160, 3, '#0068A8', '#111111', 'stripes'),
  k('Arsenal', 1991, 'Visitante', 'Adidas', 190, 3, '#F5D000', '#0B2A6B', 'sleeves'),
  k('Liverpool', 1984, 'Local', 'Umbro', 210, 3, '#C8102E', '#FFFFFF', 'solid'),
  k('Boca Juniors', 1981, 'Local', 'Adidas', 190, 3, '#0B3D91', '#F5C400', 'band'),
  k('River Plate', 1986, 'Local', 'Adidas', 150, 2, '#FFFFFF', '#D4001B', 'sash'),
  k('Ajax', 1995, 'Local', 'Umbro', 220, 4, '#FFFFFF', '#D2122E', 'vband'),
  k('Celtic', 1988, 'Local', 'Umbro', 130, 2, '#00843D', '#FFFFFF', 'hoops'),
  k('Chelsea', 1997, 'Local', 'Umbro', 120, 2, '#034694', '#FFFFFF', 'solid'),
  k('Newcastle', 1996, 'Local', 'Adidas', 140, 2, '#F4F4F4', '#111111', 'stripes'),
  k('Atlético de Madrid', 1996, 'Local', 'Puma', 120, 2, '#CB3524', '#FFFFFF', 'stripes'),
  k('Deportivo', 2000, 'Local', 'Lotto', 110, 2, '#1257A8', '#FFFFFF', 'stripes'),
  k('Bayern Múnich', 2001, 'Local', 'Adidas', 130, 2, '#DC052D', '#FFFFFF', 'solid'),
  k('Roma', 2001, 'Local', 'Kappa', 150, 3, '#8E1F2F', '#F0BC42', 'solid'),
  k('Lazio', 2000, 'Local', 'Puma', 140, 2, '#87D8F7', '#FFFFFF', 'solid'),
  k('Marsella', 1993, 'Local', 'Adidas', 160, 3, '#FFFFFF', '#00A3E0', 'solid'),
  k('París Saint-Germain', 1995, 'Local', 'Nike', 150, 3, '#004170', '#DA291C', 'vband'),
  k('Sampdoria', 1991, 'Local', 'Lotto', 170, 3, '#004B93', '#F4F4F4', 'band'),
  k('Fiorentina', 1999, 'Local', 'Fila', 140, 2, '#5B2C83', '#FFFFFF', 'solid'),
  k('Manchester City', 1999, 'Local', 'Kappa', 90, 1, '#6CABDD', '#FFFFFF', 'solid'),

  // Más recientes (más baratas, más fáciles de encontrar)
  k('Barcelona', 2011, 'Local', 'Nike', 70, 1, '#A50044', '#004D98', 'stripes'),
  k('Real Madrid', 2017, 'Local', 'Adidas', 60, 1, '#FFFFFF', '#1B2A6B', 'solid'),
  k('Liverpool', 2019, 'Local', 'Nike', 55, 1, '#C8102E', '#FFFFFF', 'solid'),
  k('Manchester City', 2012, 'Local', 'Nike', 80, 1, '#6CABDD', '#FFFFFF', 'solid'),
  k('París Saint-Germain', 2021, 'Local', 'Nike', 55, 1, '#0A1F44', '#DA291C', 'vband'),

  // Ampliación: más selecciones
  k('Croacia', 1998, 'Local', 'Lotto', 240, 4, '#FFFFFF', '#D8232A', 'checks', true),
  k('España', 1994, 'Local', 'Adidas', 150, 3, '#D40000', '#F5C400', 'solid', true),
  k('Rumanía', 1994, 'Local', 'Adidas', 190, 3, '#FCD116', '#002B7F', 'solid', true),
  k('México', 1998, 'Local', 'Umbro', 170, 3, '#006847', '#FFFFFF', 'solid', true),
  k('Senegal', 2002, 'Local', 'Puma', 160, 3, '#FFFFFF', '#00853F', 'band', true),
  k('Turquía', 2002, 'Local', 'Nike', 110, 2, '#E30A17', '#FFFFFF', 'solid', true),
  k('Uruguay', 1990, 'Local', 'Umbro', 120, 2, '#6CB4E4', '#111111', 'solid', true),
  k('Portugal', 1996, 'Local', 'Nike', 130, 2, '#C8102E', '#006600', 'solid', true),
  k('Escocia', 1996, 'Local', 'Umbro', 110, 2, '#0B2C6B', '#FFFFFF', 'solid', true),
  // Más clubes
  k('Borussia Dortmund', 1997, 'Local', 'Nike', 160, 3, '#FDE100', '#111111', 'solid'),
  k('Valencia', 1999, 'Local', 'Kappa', 110, 2, '#FFFFFF', '#111111', 'solid'),
  k('Benfica', 1990, 'Local', 'Adidas', 120, 2, '#E30613', '#FFFFFF', 'solid'),
  k('Oporto', 1987, 'Local', 'Adidas', 180, 3, '#FFFFFF', '#0A3A8C', 'stripes'),
  k('Napoli', 1988, 'Local', 'Ennerre', 260, 4, '#6CB4E4', '#FFFFFF', 'solid'),
  k('Tottenham', 1991, 'Local', 'Umbro', 120, 2, '#FFFFFF', '#132257', 'solid'),
  k('Everton', 1985, 'Local', 'Umbro', 150, 3, '#003399', '#FFFFFF', 'solid'),
  k('Flamengo', 1981, 'Local', 'Adidas', 180, 3, '#D4001B', '#111111', 'hoops'),
  k('Peñarol', 1982, 'Local', 'Adidas', 160, 3, '#F5D000', '#111111', 'stripes'),
  k('Rangers', 1990, 'Local', 'Umbro', 100, 2, '#1B458F', '#FFFFFF', 'solid'),
  // Visitantes y terceras
  k('Brasil', 1994, 'Visitante', 'Umbro', 190, 3, '#1B3E9A', '#FFD500', 'solid', true),
  k('Países Bajos', 1998, 'Visitante', 'Nike', 180, 3, '#1B4DA6', '#FF6A13', 'solid', true),
  k('Manchester United', 1996, 'Visitante', 'Umbro', 160, 3, '#9AA0A6', '#111111', 'solid'),
  k('Barcelona', 1997, 'Visitante', 'Kappa', 150, 3, '#F5D000', '#A50044', 'band'),
  k('Milan', 1999, 'Tercera', 'Adidas', 110, 2, '#111111', '#D01012', 'solid'),
  k('Real Madrid', 1996, 'Tercera', 'Kelme', 100, 2, '#2B2B6B', '#F5C400', 'solid'),
  // Porteros (siempre hay quien los busca)
  k('Alemania', 1990, 'Portero', 'Adidas', 130, 3, '#2E8B57', '#111111', 'solid', true),
  k('Inglaterra', 1996, 'Portero', 'Umbro', 120, 2, '#2A2A8C', '#E8452C', 'chevron', true),
  k('Camerún', 1990, 'Portero', 'Puma', 170, 3, '#111111', '#FFD500', 'solid', true),
  k('Manchester United', 1999, 'Portero', 'Umbro', 90, 2, '#2BB673', '#111111', 'band'),
  k('Arsenal', 1994, 'Portero', 'Adidas', 80, 2, '#E06A1B', '#111111', 'sleeves'),
];

const KIT_BY_ID = Object.fromEntries(KITS.map(x => [x.id, x]));

const RARITY_LABELS = ['', 'Común', 'Buscada', 'Rara', 'Legendaria'];

const NAMES = [
  'Marcos', 'Lucía', 'Pedro', 'Carmen', 'Joaquín', 'Irene', 'Tomás', 'Nuria', 'Hugo', 'Elena',
  'Sergio', 'Paula', 'Iván', 'Marta', 'Raúl', 'Sonia', 'Álvaro', 'Teresa', 'Dani', 'Rocío',
];

// Vendedores: ask = precio inicial respecto al valor si fuera auténtica;
// floor = mínimo que aceptan (respecto a su precio inicial); patience = rondas de regateo.
const SELLERS = {
  heredero: {
    label: 'Ha encontrado una caja en el desván', emoji: '📦',
    ask: [0.25, 0.65], floor: [0.55, 0.8], patience: 3,
    lines: {
      greet: ['No sé cuánto vale, mi padre las guardaba.', 'Estaba en un baúl. Haz una oferta.'],
      counter: ['Mmm… algo más y es tuya.', 'Me da pena, pero por eso no.'],
      insult: ['¡Eso es muy poco!', 'Aunque no sepa de esto, eso no me cuadra.'],
      accept: ['Hecho. Que te aproveche.', 'Vale, trato.'],
      leave: ['Mejor se la enseño a otro.', 'Me lo voy a pensar. Adiós.'],
    },
  },
  coleccionista: {
    label: 'Coleccionista exigente', emoji: '🧐',
    ask: [1.1, 1.5], floor: [0.8, 0.95], patience: 2,
    lines: {
      greet: ['Pieza de colección. No tengo prisa.', 'Conozco lo que vale esta camiseta.'],
      counter: ['Puedo bajar un poco, no mucho.', 'Estoy cerca, pero aún no.'],
      insult: ['Eso es una falta de respeto.', 'No regalo mi colección.'],
      accept: ['Estás en buenas manos. Trato.', 'De acuerdo. Cuídala.'],
      leave: ['Se acabó la conversación.', 'No pierdo más tiempo.'],
    },
  },
  liquidacion: {
    label: 'Tienda en liquidación', emoji: '🏷️',
    ask: [0.7, 1.0], floor: [0.82, 0.93], patience: 3,
    lines: {
      greet: ['Liquidamos stock, precios cerrados… casi.', 'Todo debe salir esta semana.'],
      counter: ['Por ser tú, un poco menos.', 'Mi jefe me mata, pero vale esto.'],
      insult: ['Con eso ni cubro el transporte.', 'No, no, no.'],
      accept: ['Vendida. Pasa por caja.', 'Hecho, una menos.'],
      leave: ['Siguiente cliente, por favor.', 'Así no podemos.'],
    },
  },
  revendedor: {
    label: 'Revendedor online', emoji: '💻',
    ask: [0.9, 1.3], floor: [0.72, 0.9], patience: 3,
    lines: {
      greet: ['Auténtica al 100 %, tengo mil valoraciones.', 'Precio de mercado, mira cualquier web.'],
      counter: ['Te hago un descuento por cantidad… de uno.', 'Último esfuerzo, de verdad.'],
      insult: ['Con eso no tengo ni para el envío.', 'Esto no es un mercadillo.'],
      accept: ['Cerrado. Te la envuelvo.', 'Trato hecho.'],
      leave: ['Se la vendo a otro comprador.', 'Que tengas buen día.'],
    },
  },
  apurado: {
    label: 'Necesita dinero rápido', emoji: '⏳',
    ask: [0.5, 0.85], floor: [0.6, 0.78], patience: 4,
    lines: {
      greet: ['Necesito venderla hoy mismo.', 'Si me das el efectivo ahora, hablamos.'],
      counter: ['Estoy apurado, pero tanto no.', 'Un poco más y cerramos.'],
      insult: ['Estoy mal de dinero, no tonto.', 'Eso no me sirve.'],
      accept: ['Gracias, me salvas el día.', 'Trato, necesito el dinero ya.'],
      leave: ['Probaré en otra tienda.', 'No puedo aceptar eso.'],
    },
  },
};

const SELLER_WEIGHTS = { heredero: 18, coleccionista: 18, liquidacion: 22, revendedor: 24, apurado: 18 };

// Clientes de la tienda
const CUSTOMER_TYPES = {
  fan: { label: 'Hincha', emoji: '🧢', weight: 30 },
  collector: { label: 'Coleccionista', emoji: '🔍', weight: 20 },
  bargain: { label: 'Cazador de gangas', emoji: '💸', weight: 25 },
  nostalgic: { label: 'Nostálgico de los 90', emoji: '📼', weight: 15 },
  tourist: { label: 'Turista', emoji: '📷', weight: 10 },
};

// Eventos de mercado
const EVENTS = [
  { id: 'doc', kind: 'team', mult: [1.25, 1.55], days: [4, 7], text: t => `Documental sobre ${t}: sus camisetas se disparan.` },
  { id: 'titulo', kind: 'team', mult: [1.2, 1.4], days: [3, 6], text: t => `${t} gana un título y los hinchas buscan camisetas.` },
  { id: 'crisis', kind: 'team', mult: [0.7, 0.85], days: [4, 7], text: t => `Crisis en ${t}: baja la demanda de sus camisetas.` },
  { id: 'torneo', kind: 'nat', mult: [1.2, 1.35], days: [5, 8], text: () => 'Arranca un torneo de selecciones: las camisetas nacionales suben.' },
  { id: 'feria', kind: 'traffic', extra: [3, 5], text: () => 'Feria de coleccionistas en la ciudad: hoy entrará más gente.' },
  { id: 'replicas', kind: 'fakes', days: [3, 4], text: () => 'Llegan réplicas al mercado: desconfía de las gangas demasiado buenas.' },
];
