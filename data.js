// data.js — Catálogo y datos del juego
//
// NOTA: los valores, colores y escudos son aproximados/ficticios; solo sirven para jugar.
// Las camisetas se dibujan en SVG con sus colores. Si quieres usar una foto real,
// rellena el campo `img` con una ruta propia (por ejemplo "img/brasil-1970.jpg") o una URL
// de la que tengas permiso. Si la imagen falla, el juego dibuja la camiseta en SVG.
//
// k(equipo, año, equipación, marca, valorBase, rareza 1-4, color1, color2, dibujo, esSelección, c3, c4)
// dibujo: solid | stripes | pinstripes | hoops | halves | sash | sleeves | band | vband | chevron | zigzag | zigband | vtri | graphic | yoke | wave | cross | checks
// c3 (opcional): tercer color para 'graphic', 'cross', 'pinstripes', 'zigband' y 'vtri'
// c4 (opcional): cuarto color, solo para 'vtri'
// Los detalles de marca (las 3 rayas de Adidas, el swoosh de Nike, los rombos de Umbro...) se dibujan solos según el campo `marca`.
// Diseños y colores contrastados con la ficha de cada camiseta en Football Kit Archive (campos Design y Colors) cuando se indica «KA».
// equipación: Local | Visitante | Tercera | Portero | Centenario
//
// ORDEN DEL CATÁLOGO: primero las selecciones (A-Z) y luego los clubes por país (A-Z).
// Dentro de cada equipo: por año y por equipación. Para añadir una camiseta, ponla en su sitio.
// Cada camiseta debe ser única por (equipo + año + equipación): si repites, la última pisa a la primera.
//
// Banderas: las selecciones muestran su bandera (emoji) en el círculo del escudo.
// Si añades una selección nueva, añade también su bandera en FLAGS.

const FLAGS = {
  'Alemania': '🇩🇪', 'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Camerún': '🇨🇲',
  'Colombia': '🇨🇴', 'Croacia': '🇭🇷', 'Dinamarca': '🇩🇰', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'España': '🇪🇸', 'Francia': '🇫🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Irlanda': '🇮🇪',
  'Italia': '🇮🇹', 'Jamaica': '🇯🇲', 'Japón': '🇯🇵', 'Letonia': '🇱🇻',
  'México': '🇲🇽', 'Nigeria': '🇳🇬', 'Países Bajos': '🇳🇱', 'Portugal': '🇵🇹',
  'Rumanía': '🇷🇴', 'Senegal': '🇸🇳', 'Sudáfrica': '🇿🇦', 'Suecia': '🇸🇪',
  'Turquía': '🇹🇷', 'Uruguay': '🇺🇾',
};

function k(team, year, type, brand, base, rarity, c1, c2, pattern, nat, c3, c4) {
  const id = (team + '-' + year + '-' + type).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const h = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const collar = year <= 1999 ? ['polo', 'v', 'round'][h % 3] : ['round', 'v'][h % 2];
  return { id, team, year, type, brand, base, rarity, c1, c2, c3: c3 || c2, c4: c4 || c3 || c2, pattern, collar, nat: !!nat, flag: nat ? (FLAGS[team] || '') : '', img: '' };
}

const KITS = [
  // ===== SELECCIONES (48) =====
  k('Alemania', 1990, 'Local', 'Adidas', 230, 3, '#FFFFFF', '#111111', 'vtri', true, '#DD0000', '#FFCE00'),   // KA: Graphic
  k('Alemania', 1990, 'Portero', 'Adidas', 130, 3, '#2E8B57', '#111111', 'solid', true),
  k('Alemania', 1998, 'Visitante', 'Adidas', 170, 3, '#1E6B3A', '#FFFFFF', 'band', true),   // KA: Single stripe, Green / White
  k('Alemania', 2006, 'Local', 'Adidas', 240, 4, '#FFFFFF', '#111111', 'graphic', true),

  k('Argentina', 1986, 'Local', 'Le Coq Sportif', 280, 4, '#FFFFFF', '#75AADB', 'stripes', true),
  k('Argentina', 2010, 'Visitante', 'Adidas', 95, 1, '#1F4FA3', '#FFFFFF', 'solid', true),
  k('Argentina', 2022, 'Local', 'Adidas', 200, 3, '#FFFFFF', '#75AADB', 'stripes', true),

  k('Brasil', 1970, 'Local', 'Athleta', 320, 4, '#FFD500', '#0A8F3C', 'solid', true),
  k('Brasil', 1994, 'Visitante', 'Umbro', 190, 3, '#1B3E9A', '#FFD500', 'solid', true),
  k('Brasil', 1998, 'Local', 'Nike', 230, 4, '#FFD500', '#0A8F3C', 'solid', true),
  k('Brasil', 1998, 'Visitante', 'Nike', 160, 3, '#1B3E9A', '#FFD500', 'sleeves', true),

  k('Camerún', 1990, 'Local', 'Puma', 210, 3, '#007A5E', '#CE1126', 'solid', true),
  k('Camerún', 1990, 'Portero', 'Puma', 170, 3, '#111111', '#FFD500', 'solid', true),

  k('Colombia', 1990, 'Local', 'Adidas', 280, 4, '#FCD116', '#003893', 'solid', true),
  k('Colombia', 1994, 'Local', 'Adidas', 200, 3, '#FCD116', '#003893', 'solid', true),

  k('Croacia', 1998, 'Local', 'Lotto', 240, 4, '#FFFFFF', '#D8232A', 'checks', true),

  k('Dinamarca', 1992, 'Local', 'Hummel', 280, 4, '#C60C30', '#FFFFFF', 'sleeves', true),   // KA: Graphic
  k('Dinamarca', 1992, 'Visitante', 'Hummel', 230, 4, '#FFFFFF', '#C60C30', 'pinstripes', true, '#14235E'),   // KA: Stripes

  k('Escocia', 1996, 'Local', 'Umbro', 110, 2, '#0B2C6B', '#FFFFFF', 'solid', true),

  k('España', 1994, 'Local', 'Adidas', 150, 3, '#D40000', '#F5C400', 'solid', true),
  k('España', 2011, 'Local', 'Adidas', 100, 2, '#C8102E', '#F5C400', 'solid', true),

  k('Francia', 1998, 'Local', 'Adidas', 260, 4, '#0B2C8A', '#D52B1E', 'solid', true),
  k('Francia', 1998, 'Visitante', 'Adidas', 180, 3, '#FFFFFF', '#0B2C8A', 'hoops', true, '#D52B1E'),   // KA: Hoops, White / Red / Blue
  k('Francia', 2018, 'Visitante', 'Nike', 100, 2, '#FFFFFF', '#1E3A8A', 'graphic', true),

  k('Inglaterra', 1992, 'Local', 'Umbro', 170, 3, '#FFFFFF', '#1C2D6B', 'solid', true),
  k('Inglaterra', 1996, 'Local', 'Umbro', 180, 3, '#FFFFFF', '#1C2D6B', 'solid', true),
  k('Inglaterra', 1996, 'Portero', 'Umbro', 120, 2, '#2A2A8C', '#E8452C', 'chevron', true),

  k('Irlanda', 1994, 'Local', 'Adidas', 120, 2, '#169B62', '#FFFFFF', 'yoke', true),

  k('Italia', 1990, 'Local', 'Diadora', 175, 3, '#0057B8', '#FFFFFF', 'solid', true),
  k('Italia', 2006, 'Local', 'Puma', 220, 4, '#0057B8', '#FFFFFF', 'solid', true),

  k('Jamaica', 1998, 'Local', 'Kappa', 190, 4, '#FED100', '#009B3A', 'yoke', true),

  k('Japón', 1998, 'Local', 'Asics', 150, 3, '#1B3E9A', '#FFFFFF', 'graphic', true, '#6C8FE0'),

  k('Letonia', 1992, 'Local', 'Sin marca', 150, 3, '#7B1E3A', '#FFFFFF', 'graphic', true, '#E8A3BE'),

  k('México', 1998, 'Local', 'Umbro', 170, 3, '#006847', '#FFFFFF', 'solid', true),

  k('Nigeria', 1994, 'Local', 'Nike', 240, 4, '#FFFFFF', '#008751', 'chevron', true),
  k('Nigeria', 1998, 'Local', 'Nike', 200, 3, '#2E9B3F', '#FFFFFF', 'zigzag', true),

  k('Países Bajos', 1988, 'Local', 'Adidas', 260, 4, '#FF6A13', '#FFFFFF', 'zigband', true),   // KA: Graphic
  k('Países Bajos', 1998, 'Visitante', 'Nike', 180, 3, '#1B4DA6', '#FF6A13', 'solid', true),
  k('Países Bajos', 2004, 'Local', 'Nike', 190, 3, '#FF6A13', '#FFFFFF', 'solid', true),
  k('Países Bajos', 2013, 'Visitante', 'Nike', 95, 1, '#003DA5', '#FF6A13', 'solid', true),

  k('Portugal', 1996, 'Local', 'Nike', 130, 2, '#C8102E', '#006600', 'solid', true),
  k('Portugal', 2004, 'Local', 'Nike', 190, 3, '#C8102E', '#006600', 'solid', true),

  k('Rumanía', 1994, 'Local', 'Adidas', 190, 3, '#FCD116', '#002B7F', 'solid', true),

  k('Senegal', 2002, 'Local', 'Puma', 160, 3, '#FFFFFF', '#00853F', 'band', true),

  k('Sudáfrica', 1998, 'Local', 'Adidas', 140, 2, '#FCD116', '#007749', 'wave', true),

  k('Suecia', 1994, 'Local', 'Adidas', 130, 2, '#FCD116', '#006AA7', 'band', true),

  k('Turquía', 2002, 'Local', 'Adidas', 110, 2, '#E30A17', '#FFFFFF', 'solid', true),

  k('Uruguay', 1990, 'Local', 'Umbro', 120, 2, '#6CB4E4', '#111111', 'solid', true),

  // ===== CLUBES · ESPAÑA (89) =====
  k('Alavés', 2001, 'Local', 'Luanvi', 150, 3, '#FFFFFF', '#005BAC', 'stripes'),

  k('Athletic Club', 1994, 'Local', 'Kappa', 160, 3, '#FFFFFF', '#D2122E', 'stripes'),
  k('Athletic Club', 1996, 'Local', 'Kappa', 150, 3, '#D2122E', '#FFFFFF', 'stripes'),

  k('Atlético de Madrid', 1996, 'Local', 'Puma', 120, 2, '#CB3524', '#FFFFFF', 'stripes'),
  k('Atlético de Madrid', 1999, 'Local', 'Nike', 120, 2, '#CB3524', '#FFFFFF', 'stripes'),

  k('Barcelona', 1992, 'Local', 'Meyba', 180, 3, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 1997, 'Visitante', 'Kappa', 150, 3, '#F5D000', '#A50044', 'band'),
  k('Barcelona', 1999, 'Local', 'Nike', 245, 4, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 2000, 'Local', 'Nike', 150, 3, '#A50044', '#004D98', 'stripes'),   // KA: Stripes, Red / Blue
  k('Barcelona', 2000, 'Visitante', 'Nike', 150, 3, '#C9CCD1', '#A50044', 'solid'),   // KA: Plain, Gray / Red (00-01)
  k('Barcelona', 2001, 'Visitante', 'Nike', 145, 3, '#F5C400', '#004D98', 'band'),   // KA: Single stripe, Gold / Blue / Red (01-02)
  k('Barcelona', 2002, 'Tercera', 'Nike', 155, 3, '#001F5B', '#A50044', 'solid'),
  k('Barcelona', 2003, 'Visitante', 'Nike', 150, 3, '#F5C400', '#A50044', 'solid'),
  k('Barcelona', 2004, 'Visitante', 'Nike', 145, 3, '#6A1B9A', '#A50044', 'solid'),
  k('Barcelona', 2005, 'Visitante', 'Nike', 150, 3, '#C96A00', '#A50044', 'solid'),
  k('Barcelona', 2006, 'Local', 'Nike', 120, 2, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 2006, 'Visitante', 'Nike', 165, 3, '#F7D117', '#004D98', 'solid'),
  k('Barcelona', 2007, 'Local', 'Nike', 115, 2, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 2008, 'Local', 'Nike', 250, 4, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 2008, 'Tercera', 'Nike', 170, 3, '#7F0000', '#F5C400', 'solid'),
  k('Barcelona', 2009, 'Visitante', 'Nike', 170, 3, '#F7E017', '#004D98', 'solid'),
  k('Barcelona', 2010, 'Local', 'Nike', 280, 4, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 2010, 'Visitante', 'Nike', 160, 3, '#66CC66', '#004D98', 'band', false, '#A50044'),   // KA: Chest band, Green / Blue / Red
  k('Barcelona', 2010, 'Tercera', 'Nike', 170, 3, '#FF6A00', '#111111', 'solid'),   // KA: Plain, Orange / Black
  k('Barcelona', 2011, 'Local', 'Nike', 70, 1, '#A50044', '#004D98', 'stripes'),
  k('Barcelona', 2012, 'Visitante', 'Nike', 150, 2, '#FF6A00', '#A50044', 'graphic'),
  k('Barcelona', 2014, 'Tercera', 'Nike', 145, 2, '#7A0019', '#F5C400', 'solid'),

  k('Cádiz', 2005, 'Local', 'Luanvi', 120, 2, '#F7E017', '#0047AB', 'solid'),

  k('Celta de Vigo', 1998, 'Local', 'Umbro', 160, 3, '#9FD9F6', '#FFFFFF', 'solid'),
  k('Celta de Vigo', 2001, 'Local', 'Umbro', 140, 2, '#9FD9F6', '#FFFFFF', 'solid'),

  k('Córdoba', 2002, 'Local', 'Joma', 120, 2, '#FFFFFF', '#00843D', 'stripes'),

  k('Deportivo', 1998, 'Tercera', 'Adidas', 120, 3, '#FF7F00', '#6CB4E4', 'sleeves'),   // KA: Contrasting sleeves, Orange / Sky blue / Navy
  k('Deportivo', 2000, 'Local', 'Adidas', 110, 2, '#1257A8', '#FFFFFF', 'stripes'),   // KA: Adidas
  k('Deportivo', 2000, 'Tercera', 'Adidas', 130, 3, '#D4001B', '#14235E', 'band', false, '#6CB4E4'),   // KA: Chest band, Red / Navy / Sky blue

  k('Elche', 2000, 'Local', 'Kelme', 140, 2, '#FFFFFF', '#00843D', 'band'),

  k('Espanyol', 1995, 'Local', 'Kelme', 170, 3, '#FFFFFF', '#005BAC', 'stripes'),
  k('Espanyol', 1999, 'Local', 'Puma', 140, 2, '#FFFFFF', '#005BAC', 'stripes'),

  k('Hércules', 2006, 'Local', 'Joma', 120, 2, '#FFFFFF', '#005BAC', 'stripes'),

  k('Las Palmas', 1998, 'Local', 'Meyba', 150, 3, '#FFD100', '#005BAC', 'solid'),

  k('Málaga', 1993, 'Local', 'Rasan', 110, 2, '#FFFFFF', '#6CB4E4', 'stripes'),   // KA: Stripes, White / Sky blue
  k('Málaga', 1999, 'Local', 'Kelme', 140, 2, '#FFFFFF', '#6CB4E4', 'stripes'),   // KA: Kelme
  k('Málaga', 2004, 'Local', 'Umbro', 110, 2, '#FFFFFF', '#2F6FC2', 'stripes'),   // KA: Stripes, Blue / White
  k('Málaga', 2009, 'Local', 'Umbro', 100, 2, '#6CB4E4', '#FFFFFF', 'stripes'),   // KA: Stripes, Sky blue / White / Navy

  k('Mallorca', 1989, 'Local', 'Umbro', 120, 2, '#D2122E', '#FFFFFF', 'checks'),   // KA: Checkers, Red / White
  k('Mallorca', 1997, 'Local', 'Kelme', 140, 2, '#D2122E', '#111111', 'stripes'),   // KA: Stripes, Red / Black
  k('Mallorca', 1998, 'Local', 'Kelme', 150, 3, '#D2122E', '#111111', 'stripes'),   // KA: Stripes, Red / Black, Kelme
  k('Mallorca', 1999, 'Visitante', 'Kelme', 100, 2, '#FFFFFF', '#111111', 'band'),   // KA: Single stripe, White / Black / Red

  k('Numancia', 1988, 'Local', 'Sin marca', 100, 2, '#D4001B', '#003DA5', 'solid'),   // KA: Plain, Red / Blue, In-House
  k('Numancia', 1998, 'Local', 'Joma', 110, 2, '#D4001B', '#003DA5', 'band', false, '#FFFFFF'),   // KA: Chest band, Red / Blue / White
  k('Numancia', 2007, 'Local', 'Errea', 100, 2, '#D4001B', '#003DA5', 'solid'),   // KA: Plain, Red / Blue
  k('Numancia', 2008, 'Local', 'Errea', 110, 2, '#D4001B', '#FFFFFF', 'graphic'),   // KA: Graphic, Red / White, Errea
  k('Numancia', 2008, 'Visitante', 'Errea', 100, 2, '#FFFFFF', '#6A1B9A', 'graphic', false, '#9AA0A6'),   // KA: Graphic, White / Purple / Gray

  k('Rayo Vallecano', 1997, 'Local', 'Kelme', 170, 3, '#FFFFFF', '#D4001B', 'sash'),

  k('Real Betis', 1996, 'Local', 'Kappa', 130, 2, '#FFFFFF', '#0A9A4A', 'stripes'),

  k('Real Madrid', 1995, 'Visitante', 'Kelme', 170, 3, '#6A1B9A', '#FFFFFF', 'solid'),
  k('Real Madrid', 1996, 'Tercera', 'Kelme', 100, 2, '#2B2B6B', '#F5C400', 'solid'),
  k('Real Madrid', 1997, 'Local', 'Kelme', 140, 2, '#FFFFFF', '#1B2A6B', 'solid'),   // Kelme = temporada 97-98 (Adidas empieza en la 98-99)
  k('Real Madrid', 1997, 'Visitante', 'Kelme', 180, 3, '#2C2C54', '#FFD700', 'solid'),
  k('Real Madrid', 1998, 'Visitante', 'Adidas', 175, 3, '#1B3F94', '#FFFFFF', 'hoops'),   // KA: Hoops, Blue / White
  k('Real Madrid', 1998, 'Tercera', 'Adidas', 170, 3, '#1B2A6B', '#FFFFFF', 'solid'),   // KA: Plain, Navy / White / Orange
  k('Real Madrid', 1999, 'Local', 'Adidas', 250, 4, '#FFFFFF', '#1B2A6B', 'solid'),
  k('Real Madrid', 1999, 'Visitante', 'Adidas', 230, 4, '#1B2A6B', '#F5C400', 'solid'),
  k('Real Madrid', 1999, 'Tercera', 'Adidas', 160, 3, '#7EC8F0', '#1B2A6B', 'solid'),   // KA: Plain, Sky blue / Navy / White
  k('Real Madrid', 2000, 'Visitante', 'Adidas', 180, 3, '#111111', '#D4AF37', 'solid'),   // KA: Plain, Black / Gold
  k('Real Madrid', 2001, 'Centenario', 'Adidas', 320, 4, '#FFFFFF', '#D4AF37', 'solid'),
  k('Real Madrid', 2002, 'Visitante', 'Adidas', 180, 3, '#111111', '#FFFFFF', 'solid'),
  k('Real Madrid', 2003, 'Tercera', 'Adidas', 170, 3, '#001F5B', '#C0C0C0', 'solid'),
  k('Real Madrid', 2004, 'Visitante', 'Adidas', 160, 3, '#001F5B', '#FFD700', 'solid'),
  k('Real Madrid', 2006, 'Visitante', 'Adidas', 160, 3, '#2B2B2B', '#FFFFFF', 'solid'),
  k('Real Madrid', 2008, 'Visitante', 'Adidas', 150, 2, '#3B0066', '#FFFFFF', 'solid'),
  k('Real Madrid', 2011, 'Local', 'Adidas', 240, 4, '#FFFFFF', '#FFD700', 'solid'),
  k('Real Madrid', 2011, 'Visitante', 'Adidas', 220, 4, '#C8102E', '#FFFFFF', 'solid'),
  k('Real Madrid', 2014, 'Tercera', 'Adidas', 190, 3, '#111111', '#00E5FF', 'solid'),
  k('Real Madrid', 2017, 'Local', 'Adidas', 60, 1, '#FFFFFF', '#1B2A6B', 'solid'),
  k('Real Madrid', 2017, 'Tercera', 'Adidas', 190, 3, '#7FD321', '#111111', 'solid'),

  k('Real Oviedo', 1997, 'Local', 'Adidas', 150, 3, '#003DA5', '#FFFFFF', 'solid'),

  k('Real Sociedad', 1998, 'Local', 'Astore', 170, 3, '#FFFFFF', '#005BAC', 'stripes'),
  k('Real Sociedad', 2003, 'Local', 'Astore', 120, 2, '#FFFFFF', '#005BAC', 'stripes'),

  k('Real Zaragoza', 1995, 'Local', 'Reebok', 150, 3, '#FFFFFF', '#1B458F', 'yoke'),

  k('Recreativo de Huelva', 2005, 'Local', 'Puma', 130, 2, '#FFFFFF', '#4FA3FF', 'stripes'),

  k('Sevilla', 1996, 'Local', 'Marathon', 170, 3, '#FFFFFF', '#D4001B', 'solid'),
  k('Sevilla', 1998, 'Local', 'Adidas', 150, 3, '#FFFFFF', '#D4001B', 'solid'),
  k('Sevilla', 2015, 'Portero', 'New Balance', 75, 1, '#2E7D32', '#111111', 'solid'),

  k('Sporting de Gijón', 2002, 'Local', 'Astore', 130, 2, '#FFFFFF', '#D2122E', 'stripes'),

  k('Tenerife', 1999, 'Local', 'Puma', 140, 2, '#FFFFFF', '#005BAC', 'solid'),

  k('Valencia', 1997, 'Local', 'Luanvi', 170, 3, '#FFFFFF', '#111111', 'solid'),
  k('Valencia', 1999, 'Local', 'Luanvi', 110, 2, '#FFFFFF', '#111111', 'solid'),
  k('Valencia', 2001, 'Local', 'Nike', 130, 2, '#FFFFFF', '#111111', 'solid'),

  k('Villarreal', 1999, 'Local', 'Kelme', 160, 3, '#F7E017', '#111111', 'solid'),   // KA: Kelme

  // ===== CLUBES · INGLATERRA (33) =====
  k('Arsenal', 1991, 'Visitante', 'Adidas', 190, 3, '#F5D000', '#0B2A6B', 'graphic', false, '#6B4AA8'),
  k('Arsenal', 1994, 'Portero', 'Adidas', 80, 2, '#E06A1B', '#111111', 'sleeves'),
  k('Arsenal', 2003, 'Local', 'Nike', 240, 4, '#C8102E', '#FFFFFF', 'solid'),
  k('Arsenal', 2012, 'Local', 'Nike', 80, 1, '#C8102E', '#FFFFFF', 'solid'),

  k('Aston Villa', 1994, 'Local', 'Asics', 110, 2, '#7B1E3A', '#8FC1E3', 'sleeves'),

  k('Blackburn Rovers', 1995, 'Local', 'Asics', 170, 3, '#FFFFFF', '#0057B8', 'halves'),

  k('Chelsea', 1997, 'Local', 'Umbro', 120, 2, '#034694', '#FFFFFF', 'solid'),
  k('Chelsea', 2005, 'Local', 'Umbro', 210, 3, '#034694', '#FFFFFF', 'solid'),
  k('Chelsea', 2010, 'Local', 'Adidas', 90, 1, '#034694', '#FFFFFF', 'solid'),

  k('Coventry City', 1996, 'Visitante', 'Pony', 130, 3, '#D4001B', '#14235E', 'checks'),

  k('Everton', 1985, 'Local', 'Umbro', 150, 3, '#003399', '#FFFFFF', 'solid'),

  k('Leeds United', 2001, 'Local', 'Nike', 120, 2, '#FFFFFF', '#1B458F', 'solid'),

  k('Liverpool', 1984, 'Local', 'Umbro', 210, 3, '#C8102E', '#FFFFFF', 'solid'),
  k('Liverpool', 1991, 'Local', 'Adidas', 200, 3, '#C8102E', '#FFFFFF', 'solid'),
  k('Liverpool', 2005, 'Local', 'Reebok', 210, 3, '#C8102E', '#FFFFFF', 'solid'),
  k('Liverpool', 2019, 'Local', 'Nike', 55, 1, '#C8102E', '#FFFFFF', 'solid'),

  k('Manchester City', 1997, 'Visitante', 'Kappa', 120, 2, '#1B1B1B', '#6CABDD', 'yoke'),
  k('Manchester City', 1999, 'Local', 'Kappa', 90, 1, '#6CABDD', '#FFFFFF', 'solid'),
  k('Manchester City', 2012, 'Local', 'Nike', 80, 1, '#6CABDD', '#FFFFFF', 'solid'),

  k('Manchester United', 1994, 'Local', 'Umbro', 170, 3, '#DA291C', '#FFFFFF', 'solid'),
  k('Manchester United', 1996, 'Visitante', 'Umbro', 160, 3, '#9AA0A6', '#111111', 'solid'),
  k('Manchester United', 1997, 'Visitante', 'Umbro', 180, 3, '#FFFFFF', '#1A1A1A', 'graphic'),
  k('Manchester United', 1999, 'Local', 'Umbro', 150, 3, '#DA291C', '#FFFFFF', 'solid'),   // KA: Plain, Red / White
  k('Manchester United', 1999, 'Tercera', 'Umbro', 130, 3, '#FFFFFF', '#14235E', 'solid'),   // KA: Plain, White / Navy
  k('Manchester United', 1999, 'Portero', 'Umbro', 90, 2, '#2BB673', '#111111', 'band'),
  k('Manchester United', 2007, 'Local', 'Nike', 220, 3, '#DA291C', '#FFFFFF', 'solid'),
  k('Manchester United', 2008, 'Local', 'Nike', 230, 4, '#DA291C', '#FFFFFF', 'solid'),

  k('Newcastle United', 1996, 'Local', 'Adidas', 140, 2, '#F4F4F4', '#111111', 'stripes'),
  k('Newcastle United', 1997, 'Local', 'Adidas', 180, 3, '#FFFFFF', '#111111', 'stripes'),

  k('Tottenham', 1991, 'Local', 'Umbro', 120, 2, '#FFFFFF', '#132257', 'solid'),
  k('Tottenham', 1992, 'Local', 'Umbro', 130, 3, '#FFFFFF', '#132257', 'graphic', false, '#132257'),   // KA: Graphic, White / Navy
  k('Tottenham', 1999, 'Local', 'Adidas', 120, 2, '#FFFFFF', '#132257', 'solid'),
  k('Tottenham', 2010, 'Visitante', 'Puma', 90, 1, '#6EC6FF', '#132257', 'solid'),

  // ===== CLUBES · ESCOCIA (4) =====
  k('Celtic', 1988, 'Local', 'Umbro', 130, 2, '#00843D', '#FFFFFF', 'hoops'),
  k('Celtic', 2003, 'Local', 'Umbro', 110, 2, '#00843D', '#FFFFFF', 'hoops'),

  k('Rangers', 1990, 'Local', 'Umbro', 100, 2, '#1B458F', '#FFFFFF', 'solid'),
  k('Rangers', 1996, 'Local', 'Adidas', 130, 2, '#0038A8', '#FFFFFF', 'solid'),   // KA: Adidas en 96-97

  // ===== CLUBES · ITALIA (27) =====
  k('AC Milan', 1994, 'Local', 'Lotto', 200, 3, '#D01012', '#111111', 'stripes'),
  k('AC Milan', 1999, 'Tercera', 'Adidas', 110, 2, '#111111', '#D01012', 'solid'),
  k('AC Milan', 2006, 'Local', 'Adidas', 260, 4, '#D01012', '#111111', 'stripes'),

  k('Fiorentina', 1995, 'Local', 'Reebok', 160, 3, '#5B2C83', '#FFFFFF', 'solid'),
  k('Fiorentina', 1998, 'Local', 'Fila', 170, 3, '#5B2C83', '#FFFFFF', 'solid'),
  k('Fiorentina', 1999, 'Local', 'Fila', 140, 2, '#5B2C83', '#FFFFFF', 'solid'),

  k('Inter', 1996, 'Tercera', 'Umbro', 180, 3, '#FFD400', '#003A70', 'graphic'),
  k('Inter', 1998, 'Local', 'Nike', 160, 3, '#0068A8', '#111111', 'stripes'),
  k('Inter', 2003, 'Local', 'Nike', 110, 2, '#0057A8', '#111111', 'stripes'),
  k('Inter', 2005, 'Local', 'Nike', 100, 2, '#0057A8', '#111111', 'stripes'),
  k('Inter', 2010, 'Local', 'Nike', 220, 4, '#0057A8', '#111111', 'stripes'),

  k('Juventus', 1996, 'Local', 'Kappa', 170, 3, '#F4F4F4', '#111111', 'stripes'),
  k('Juventus', 2001, 'Visitante', 'Lotto', 135, 2, '#001F5B', '#FFD700', 'solid'),
  k('Juventus', 2009, 'Local', 'Nike', 95, 1, '#FFFFFF', '#111111', 'stripes'),

  k('Lazio', 1998, 'Local', 'Puma', 170, 3, '#87D8F7', '#FFFFFF', 'solid'),
  k('Lazio', 2000, 'Local', 'Puma', 140, 2, '#87D8F7', '#FFFFFF', 'solid'),

  k('Napoli', 1987, 'Local', 'Ennerre', 320, 4, '#6CB4E4', '#FFFFFF', 'solid'),
  k('Napoli', 1988, 'Local', 'Ennerre', 260, 4, '#6CB4E4', '#FFFFFF', 'solid'),
  k('Napoli', 1996, 'Local', 'Lotto', 190, 3, '#6CB4E4', '#FFFFFF', 'solid'),

  k('Palermo', 1996, 'Local', 'Kappa', 110, 2, '#F2A3B8', '#111111', 'solid'),

  k('Parma', 1998, 'Local', 'Lotto', 180, 3, '#FFFFFF', '#111111', 'cross'),
  k('Parma', 1999, 'Local', 'Champion', 150, 3, '#FFFFFF', '#FDE100', 'cross', false, '#003DA5'),
  k('Parma', 2002, 'Local', 'Champion', 120, 2, '#FFFFFF', '#111111', 'cross'),

  k('Roma', 1994, 'Local', 'Asics', 150, 3, '#8E1F2F', '#F0BC42', 'solid'),
  k('Roma', 2001, 'Local', 'Kappa', 220, 4, '#8E1F2F', '#F0BC42', 'solid'),

  k('Sampdoria', 1991, 'Local', 'Lotto', 170, 3, '#004B93', '#F4F4F4', 'band'),
  k('Sampdoria', 1998, 'Local', 'Asics', 160, 3, '#004B93', '#FFFFFF', 'band'),

  // ===== CLUBES · ALEMANIA (12) =====
  k('Bayern Múnich', 1997, 'Local', 'Adidas', 190, 3, '#0B2A6B', '#DC052D', 'band'),
  k('Bayern Múnich', 1999, 'Local', 'Adidas', 170, 3, '#DC052D', '#0B2A6B', 'sleeves'),
  k('Bayern Múnich', 2001, 'Local', 'Adidas', 130, 2, '#DC052D', '#FFFFFF', 'solid'),
  k('Bayern Múnich', 2005, 'Local', 'Adidas', 100, 2, '#DC052D', '#FFFFFF', 'solid'),
  k('Bayern Múnich', 2013, 'Local', 'Adidas', 220, 4, '#DC052D', '#FFFFFF', 'solid'),

  k('Borussia Dortmund', 1995, 'Local', 'Nike', 220, 4, '#FDE100', '#111111', 'solid'),
  k('Borussia Dortmund', 1996, 'Local', 'Nike', 230, 4, '#FDE100', '#111111', 'solid'),
  k('Borussia Dortmund', 1997, 'Local', 'Nike', 160, 3, '#FDE100', '#111111', 'solid'),
  k('Borussia Dortmund', 2001, 'Local', 'Nike', 120, 2, '#FDE100', '#111111', 'solid'),

  k('Hamburgo', 1994, 'Local', 'Adidas', 150, 3, '#FFFFFF', '#003399', 'solid'),

  k('Stuttgart', 1999, 'Tercera', 'Adidas', 100, 2, '#FDE100', '#D4001B', 'band'),   // KA: Chest band, Yellow / Red

  k('Werder Bremen', 2004, 'Local', 'Kappa', 110, 2, '#00853F', '#FFFFFF', 'solid'),

  // ===== CLUBES · FRANCIA (3) =====
  k('Marsella', 1993, 'Local', 'Adidas', 160, 3, '#FFFFFF', '#00A3E0', 'solid'),

  k('París Saint-Germain', 1995, 'Local', 'Nike', 150, 3, '#004170', '#DA291C', 'vband'),
  k('París Saint-Germain', 2021, 'Local', 'Nike', 55, 1, '#0A1F44', '#DA291C', 'vband'),

  // ===== CLUBES · PAÍSES BAJOS (5) =====
  k('Ajax', 1995, 'Local', 'Umbro', 220, 4, '#FFFFFF', '#D2122E', 'vband'),
  k('Ajax', 1998, 'Visitante', 'Umbro', 170, 3, '#1E3A8A', '#E53935', 'graphic'),

  k('Feyenoord', 1999, 'Local', 'Adidas', 150, 3, '#D2122E', '#FFFFFF', 'halves'),

  k('PSV Eindhoven', 1998, 'Local', 'Nike', 170, 3, '#FFFFFF', '#D4001B', 'stripes'),
  k('PSV Eindhoven', 2004, 'Local', 'Nike', 110, 2, '#FFFFFF', '#D4001B', 'stripes'),

  // ===== CLUBES · PORTUGAL (6) =====
  k('Benfica', 1990, 'Local', 'Adidas', 120, 2, '#E30613', '#FFFFFF', 'solid'),
  k('Benfica', 1998, 'Local', 'Adidas', 140, 2, '#D4001B', '#FFFFFF', 'solid'),

  k('Oporto', 1987, 'Local', 'Adidas', 180, 3, '#FFFFFF', '#0A3A8C', 'stripes'),
  k('Oporto', 1997, 'Local', 'Kappa', 150, 3, '#FFFFFF', '#0A3A8C', 'stripes'),
  k('Oporto', 2003, 'Local', 'Nike', 120, 2, '#FFFFFF', '#0046AD', 'stripes'),

  k('Sporting CP', 2001, 'Local', 'Reebok', 130, 2, '#00843D', '#FFFFFF', 'hoops'),

  // ===== CLUBES · RESTO DE EUROPA (2) =====
  k('Estrella Roja', 1996, 'Local', 'Kappa', 150, 3, '#D4001B', '#FFFFFF', 'stripes'),

  k('Galatasaray', 2000, 'Local', 'Adidas', 140, 2, '#F7A600', '#A00028', 'halves'),

  // ===== CLUBES · SUDAMÉRICA (6) =====
  k('Boca Juniors', 1981, 'Local', 'Adidas', 190, 3, '#0B3D91', '#F5C400', 'band'),

  k('Corinthians', 2002, 'Local', 'Topper', 110, 2, '#FFFFFF', '#111111', 'solid'),

  k('Flamengo', 1981, 'Local', 'Adidas', 180, 3, '#D4001B', '#111111', 'hoops'),

  k('Peñarol', 1982, 'Local', 'Adidas', 160, 3, '#F5D000', '#111111', 'stripes'),

  k('River Plate', 1986, 'Local', 'Adidas', 150, 2, '#FFFFFF', '#D4001B', 'sash'),
  k('River Plate', 2002, 'Local', 'Adidas', 95, 1, '#FFFFFF', '#D4001B', 'sash'),

  // ===== CLUBES · JAPÓN (3) =====
  k('Kyoto Sanga', 1996, 'Local', 'Mizuno', 120, 3, '#5B2C83', '#FFFFFF', 'graphic', false, '#C9A7E8'),

  k('Nagoya Grampus', 1995, 'Local', 'Mizuno', 130, 3, '#D4001B', '#F5C400', 'graphic', false, '#FFFFFF'),

  k('Urawa Reds', 1996, 'Local', 'Mizuno', 140, 3, '#D4001B', '#111111', 'graphic', false, '#FFFFFF'),
];

const KIT_BY_ID = Object.fromEntries(KITS.map(x => [x.id, x]));

// Ids antiguos (de partidas guardadas) que ahora apuntan a la camiseta con el nombre unificado.
const LEGACY_IDS = {
  'newcastle-1996-local': 'newcastle-united-1996-local',
  'milan-1999-tercera': 'ac-milan-1999-tercera',
};
Object.entries(LEGACY_IDS).forEach(([old, id]) => { KIT_BY_ID[old] = KIT_BY_ID[id]; });

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
    ask: [0.25, 0.65], floor: [0.55, 0.8], patience: 3, fakeMod: 0.1,   // sincero, no disimula nada
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
    ask: [1.1, 1.5], floor: [0.8, 0.95], patience: 2, fakeMod: -0.05,   // piezas muy cuidadas, pocas pistas
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
    ask: [0.7, 1.0], floor: [0.82, 0.93], patience: 3, fakeMod: -0.1,   // stock mezclado, difícil de leer
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
    ask: [0.9, 1.3], floor: [0.72, 0.9], patience: 3, fakeMod: -0.15,   // profesional: sabe cómo presentar una réplica
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
    ask: [0.5, 0.85], floor: [0.6, 0.78], patience: 4, fakeMod: 0.05,   // con prisa, no se esfuerza en disimular
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
