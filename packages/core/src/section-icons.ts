/**
 * KRO-189 — Catálogo CURADO de iconos de sección + heurística de sugerencia.
 *
 * Las secciones son user-defined (no podemos curar un icono por nombre), así
 * que el render resuelve en cascada: icono ELEGIDO por el publisher (campo
 * `icon` de la sección) → sugerencia por keywords (`suggestSectionIcon`) →
 * monograma con el accent de la sección (el fallback de siempre).
 *
 * Los `id` son SEMÁNTICOS y agnósticos de plataforma: Studio los mapea a
 * lucide-react y Flutter a Material icons — el catálogo y la heurística son
 * el contrato compartido (anti-drift). Keywords en español e inglés, sin
 * acentos (el matcher pliega acentos antes de comparar).
 */

export interface SectionIconDef {
  /** Id semántico estable (kebab-case). NO renombrar: está persistido en BD. */
  id: string;
  /** Label humano para el picker (es). */
  label: string;
  /** Disparadores de la sugerencia automática (minúsculas, sin acentos). */
  keywords: ReadonlyArray<string>;
  /**
   * Nombre del icono en **lucide** (kebab-case, el id canónico de lucide.dev).
   * FUENTE ÚNICA del render anti-drift: Studio lo mapea a su componente
   * lucide-react y Flutter al icono de la fuente lucide → el MISMO glifo en
   * ambos. **Omitido cuando coincide con `id`** (la mayoría); presente solo en
   * los que difieren, p.ej. `flask` → `flask-conical`, `bolt` → `zap`. Resuélvelo
   * con `lucideIconName(def)` (default = `id`).
   */
  lucide?: string;
  /**
   * Glifo SVG INLINE para iconos que lucide NO tiene (p.ej. balón de fútbol o de
   * baloncesto). Markup INTERIOR de un `<svg viewBox="0 0 24 24">` con estilo
   * lucide (`fill="none" stroke="currentColor" stroke-width="2"`, que aplica el
   * wrapper). Es el contrato compartido: Studio lo pinta inline y Flutter desde el
   * MISMO markup (`flutter_svg`). Mutuamente excluyente con `lucide`. Contenido
   * CURADO (no entra de usuario) → render inline seguro.
   */
  svg?: string;
}

/**
 * Nombre lucide canónico de un icono del catálogo (kebab-case). Default = `id`
 * (la mayoría coinciden); las excepciones lo declaran en `lucide`. Tanto Studio
 * (lucide-react) como Flutter (fuente lucide) renderizan desde ESTE nombre.
 */
export function lucideIconName(def: SectionIconDef): string {
  return def.lucide ?? def.id;
}

export const SECTION_ICONS: ReadonlyArray<SectionIconDef> = [
  // ── Colección / juego ──
  { id: 'cards',     label: 'Cartas',      keywords: ['carta', 'cartas', 'cromo', 'cromos', 'cards', 'deck'], lucide: 'wallet-cards' },
  { id: 'star',      label: 'Estrella',    keywords: ['estrella', 'destacado', 'favorito', 'star'] },
  { id: 'sparkles',  label: 'Destellos',   keywords: ['especial', 'brillo', 'raros', 'sparkle'] },
  { id: 'trophy',    label: 'Trofeo',      keywords: ['trofeo', 'logros', 'campeonato', 'trophy', 'torneo'] },
  { id: 'medal',     label: 'Medalla',     keywords: ['medalla', 'premio', 'medal'] },
  { id: 'dice',      label: 'Dados',       keywords: ['dado', 'dados', 'azar', 'dice', 'juego'], lucide: 'dices' },
  { id: 'puzzle',    label: 'Puzzle',      keywords: ['puzzle', 'pieza', 'reto'] },
  { id: 'gift',      label: 'Regalo',      keywords: ['regalo', 'sobre', 'sobres', 'gift', 'pack'] },
  // ── Fantasía / lore ──
  { id: 'crown',     label: 'Corona',      keywords: ['reino', 'reinos', 'corona', 'rey', 'reyes', 'kingdom', 'imperio'] },
  { id: 'book',      label: 'Libro',       keywords: ['leyenda', 'leyendas', 'historia', 'historias', 'lore', 'relato', 'libro', 'book'], lucide: 'book-open' },
  { id: 'scroll',    label: 'Pergamino',   keywords: ['pergamino', 'mision', 'misiones', 'quest', 'scroll'] },
  { id: 'swords',    label: 'Espadas',     keywords: ['espada', 'espadas', 'batalla', 'batallas', 'combate', 'guerra', 'duelo'] },
  { id: 'shield',    label: 'Escudo',      keywords: ['escudo', 'defensa', 'clan', 'clanes', 'hermandad', 'gremio'] },
  { id: 'wand',      label: 'Varita',      keywords: ['magia', 'hechizo', 'hechizos', 'varita', 'conjuro', 'magic'], lucide: 'wand-sparkles' },
  { id: 'flask',     label: 'Poción',      keywords: ['pocion', 'pociones', 'alquimia', 'elixir', 'laboratorio'], lucide: 'flask-conical' },
  { id: 'crystal',   label: 'Bola mágica', keywords: ['profecia', 'oraculo', 'vidente', 'cristal'], lucide: 'eye' },
  { id: 'skull',     label: 'Calavera',    keywords: ['jefe', 'jefes', 'villano', 'villanos', 'boss', 'calavera', 'muerte'] },
  { id: 'ghost',     label: 'Fantasma',    keywords: ['fantasma', 'fantasmas', 'espiritu', 'espiritus', 'ghost'] },
  { id: 'castle',    label: 'Castillo',    keywords: ['castillo', 'castillos', 'fortaleza', 'ciudadela'] },
  { id: 'key',       label: 'Llave',       keywords: ['llave', 'llaves', 'secreto', 'secretos', 'key'] },
  // ── Criaturas ──
  { id: 'paw',       label: 'Huella',      keywords: ['bestia', 'bestias', 'criatura', 'criaturas', 'animal', 'animales', 'mascota', 'mascotas'], lucide: 'paw-print' },
  { id: 'bug',       label: 'Insecto',     keywords: ['insecto', 'insectos', 'bicho', 'bichos', 'bug'] },
  { id: 'fish',      label: 'Pez',         keywords: ['pez', 'peces', 'mar', 'oceano', 'acuatico'] },
  { id: 'feather',   label: 'Pluma',       keywords: ['ave', 'aves', 'pajaro', 'pajaros', 'pluma', 'vuelo'] },
  { id: 'leaf',      label: 'Hoja',        keywords: ['planta', 'plantas', 'flora', 'hoja', 'jardin', 'botanica'] },
  // ── Naturaleza / elementos ──
  { id: 'flame',     label: 'Llama',       keywords: ['fuego', 'llama', 'llamas', 'volcan', 'fire'] },
  { id: 'droplet',   label: 'Gota',        keywords: ['agua', 'gota', 'rio', 'rios', 'lluvia', 'water'] },
  { id: 'wind',      label: 'Viento',      keywords: ['viento', 'aire', 'tormenta', 'wind'] },
  { id: 'snowflake', label: 'Copo',        keywords: ['hielo', 'nieve', 'invierno', 'frio', 'ice'] },
  { id: 'sun',       label: 'Sol',         keywords: ['sol', 'dia', 'verano', 'luz', 'sun'] },
  { id: 'moon',      label: 'Luna',        keywords: ['luna', 'noche', 'nocturno', 'moon'] },
  { id: 'bolt',      label: 'Rayo',        keywords: ['rayo', 'rayos', 'energia', 'electrico', 'trueno'], lucide: 'zap' },
  { id: 'mountain',  label: 'Montaña',     keywords: ['montana', 'montanas', 'cumbre', 'cordillera', 'pico'] },
  { id: 'trees',     label: 'Bosque',      keywords: ['bosque', 'bosques', 'arbol', 'arboles', 'selva', 'naturaleza'] },
  { id: 'gem',       label: 'Gema',        keywords: ['gema', 'gemas', 'joya', 'joyas', 'diamante', 'tesoro', 'tesoros', 'cristales'] },
  // ── Lugares / viaje ──
  { id: 'map',       label: 'Mapa',        keywords: ['mapa', 'mapas', 'region', 'regiones', 'territorio', 'zonas'] },
  { id: 'compass',   label: 'Brújula',     keywords: ['brujula', 'explorar', 'exploracion', 'aventura', 'expedicion'] },
  { id: 'globe',     label: 'Globo',       keywords: ['mundo', 'planeta', 'planetas', 'paises', 'global'] },
  { id: 'rocket',    label: 'Cohete',      keywords: ['espacio', 'cohete', 'galaxia', 'nave', 'naves', 'sci-fi'] },
  { id: 'home',      label: 'Casa',        keywords: ['casa', 'casas', 'pueblo', 'pueblos', 'aldea', 'hogar'], lucide: 'house' },
  { id: 'building',  label: 'Edificio',    keywords: ['ciudad', 'ciudades', 'edificio', 'edificios', 'urbano'], lucide: 'building-2' },
  { id: 'anchor',    label: 'Ancla',       keywords: ['barco', 'barcos', 'puerto', 'puertos', 'nautico', 'marina'] },
  { id: 'flag',      label: 'Bandera',     keywords: ['bandera', 'banderas', 'pais', 'nacion', 'naciones', 'flag'] },
  // ── Gente / cultura ──
  { id: 'users',     label: 'Personajes',  keywords: ['personaje', 'personajes', 'heroe', 'heroes', 'protagonistas', 'gente'] },
  { id: 'user',      label: 'Perfil',      keywords: ['perfil', 'perfiles', 'jugador', 'jugadores', 'miembro', 'miembros'] },
  { id: 'heart',     label: 'Corazón',     keywords: ['amor', 'corazon', 'vida', 'vidas', 'salud'] },
  { id: 'music',     label: 'Música',      keywords: ['musica', 'cancion', 'canciones', 'banda', 'bandas', 'sonido'] },
  { id: 'camera',    label: 'Cámara',      keywords: ['foto', 'fotos', 'fotografia', 'camara', 'photo'] },
  { id: 'image',     label: 'Galería',     keywords: ['galeria', 'imagenes', 'ilustracion', 'ilustraciones', 'arte'] },
  { id: 'calendar',  label: 'Calendario',  keywords: ['momento', 'momentos', 'evento', 'eventos', 'fecha', 'fechas', 'temporada', 'temporadas'] },
  { id: 'clock',     label: 'Reloj',       keywords: ['epoca', 'epocas', 'era', 'eras', 'tiempo', 'cronologia'] },
  // ── Deporte / motor ──
  { id: 'ball',      label: 'Portería',    keywords: ['deporte', 'deportes', 'liga', 'equipos', 'meta', 'goal'], lucide: 'goal' },
  // Balones por deporte — lucide no los trae, glifo SVG inline (Studio + Flutter).
  { id: 'soccer-ball', label: 'Balón de fútbol', keywords: ['futbol', 'balon', 'soccer', 'football', 'pelota'],
    svg: '<circle cx="12" cy="12" r="10"/><path d="M12 8.9 15 11 13.8 14.5 10.2 14.5 9 11Z"/><path d="M12 8.9V2.5"/><path d="M15 11 20.6 9.2"/><path d="M13.8 14.5 17.3 19.3"/><path d="M10.2 14.5 6.7 19.3"/><path d="M9 11 3.4 9.2"/>' },
  { id: 'basketball',  label: 'Baloncesto',      keywords: ['baloncesto', 'basket', 'basketball', 'canasta', 'nba'],
    svg: '<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><path d="M12 2a14 14 0 0 0 0 20"/><path d="M12 2a14 14 0 0 1 0 20"/>' },
  { id: 'car',       label: 'Coche',       keywords: ['coche', 'coches', 'carrera', 'carreras', 'motor', 'rally', 'automovilismo'] },
  { id: 'coins',     label: 'Monedas',     keywords: ['moneda', 'monedas', 'economia', 'mercado', 'tienda', 'coins'] },
  { id: 'bike',       label: 'Bici',        keywords: ['ciclismo', 'bici', 'bicicleta', 'bike', 'mtb'] },
  { id: 'dumbbell',   label: 'Pesa',        keywords: ['gimnasio', 'fitness', 'pesas', 'gym', 'musculacion', 'entreno', 'lucha'] },
  { id: 'volleyball', label: 'Voleibol',    keywords: ['voleibol', 'volley', 'volleyball'] },
  // ── Géneros / temas (KRO) ──
  { id: 'gamepad',     label: 'Mando',       keywords: ['videojuego', 'videojuegos', 'gaming', 'consola', 'gamepad', 'arcade'], lucide: 'gamepad-2' },
  { id: 'clapperboard',label: 'Claqueta',    keywords: ['cine', 'pelicula', 'peliculas', 'film', 'claqueta', 'movie'] },
  { id: 'tv',          label: 'Televisión',  keywords: ['tv', 'television', 'serie', 'series', 'show', 'programa'] },
  { id: 'palette',     label: 'Paleta',      keywords: ['arte', 'pintura', 'paleta', 'dibujo', 'color', 'cuadro'] },
  { id: 'atom',        label: 'Átomo',       keywords: ['ciencia', 'fisica', 'atomo', 'science', 'quimica', 'tecnologia'] },
  { id: 'dna',         label: 'ADN',         keywords: ['biologia', 'adn', 'dna', 'genetica', 'celula'] },
  { id: 'telescope',   label: 'Telescopio',  keywords: ['astronomia', 'telescopio', 'estrellas', 'cosmos', 'universo'] },
  { id: 'guitar',      label: 'Guitarra',    keywords: ['guitarra', 'rock', 'instrumento', 'concierto'] },
  { id: 'mic',         label: 'Micrófono',   keywords: ['canto', 'microfono', 'rap', 'cantante', 'voz', 'podcast'] },
  { id: 'drama',       label: 'Teatro',      keywords: ['teatro', 'drama', 'comedia', 'obra'] },
  { id: 'mask',        label: 'Máscara',     keywords: ['anime', 'manga', 'cosplay', 'carnaval', 'disfraz', 'mascara'], lucide: 'venetian-mask' },
  { id: 'landmark',    label: 'Monumento',   keywords: ['historia', 'monumento', 'historico', 'civilizacion', 'patrimonio'] },
  { id: 'church',      label: 'Iglesia',     keywords: ['religion', 'iglesia', 'fe', 'catedral', 'templo'] },
  { id: 'bone',        label: 'Hueso',       keywords: ['dinosaurio', 'dinosaurios', 'fosil', 'hueso', 'prehistoria', 'paleontologia', 'jurasico'] },
  { id: 'cat',         label: 'Gato',        keywords: ['gato', 'gatos', 'felino', 'felinos'] },
  { id: 'bird',        label: 'Pájaro',      keywords: ['pajaro', 'pajaros', 'ornitologia'] },
  { id: 'flower',      label: 'Flor',        keywords: ['flor', 'flores', 'primavera'], lucide: 'flower-2' },
  { id: 'plane',       label: 'Avión',       keywords: ['avion', 'viaje', 'viajes', 'aviacion', 'vuelo', 'turismo'] },
  { id: 'utensils',    label: 'Cubiertos',   keywords: ['comida', 'gastronomia', 'cocina', 'restaurante', 'recetas'] },
  { id: 'shirt',       label: 'Camiseta',    keywords: ['moda', 'ropa', 'camiseta', 'fashion', 'estilo'] },
];

/** Pliega acentos y normaliza para el matching (igual criterio que keywords). */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Sugiere un icono para una sección por su nombre/key. Matching por PALABRA
 * (no substring suelto: "carta" no matchea "cartagena") con acentos plegados.
 * Devuelve el `id` del catálogo o `null` (→ el render cae al monograma).
 * NUNCA devuelve un icono "genérico de relleno": sin match claro, null.
 */
export function suggestSectionIcon(nameOrKey: string): string | null {
  const words = fold(nameOrKey).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;
  for (const def of SECTION_ICONS) {
    for (const kw of def.keywords) {
      if (words.includes(kw)) return def.id;
    }
  }
  return null;
}

/** Markup SVG inline de un icono del catálogo, si es un glifo no-lucide. */
export function sectionIconSvg(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  return SECTION_ICONS.find(d => d.id === id)?.svg;
}

/**
 * Id EFECTIVO del icono de una sección: el elegido por el publisher si existe en
 * el catálogo (lucide o glifo SVG), si no la sugerencia por nombre, si no `null`
 * (→ el render cae al monograma). Es la resolución unificada que usan tanto el
 * render lucide como el de glifos SVG inline (anti-drift Studio↔Flutter).
 */
export function resolveSectionIconId(icon: string | undefined, nameOrKey: string): string | null {
  if (icon && SECTION_ICONS.some(d => d.id === icon)) return icon;
  return suggestSectionIcon(nameOrKey);
}
