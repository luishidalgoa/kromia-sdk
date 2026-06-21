/// KRO-189 — Catálogo CURADO de iconos de sección + heurística de sugerencia.
/// Espejo Dart 1:1 de `@kromia/core` `section-icons.ts` (contrato compartido,
/// anti-drift). Los `id` son SEMÁNTICOS y agnósticos de plataforma: Studio los
/// mapea a lucide-react y Flutter a la fuente lucide / glifos SVG inline. Keywords
/// en es/en sin acentos (el matcher pliega acentos del input antes de comparar).
library;

class SectionIconDef {
  /// Id semántico estable (kebab-case). NO renombrar: persistido en BD.
  final String id;

  /// Label humano para el picker (es).
  final String label;

  /// Disparadores de la sugerencia automática (minúsculas, sin acentos).
  final List<String> keywords;

  /// Nombre lucide canónico (kebab) cuando difiere del `id`. null → usar el id.
  /// Studio mapea esto a lucide-react; Flutter a la fuente lucide.
  final String? lucide;

  /// Glifo SVG INLINE para iconos que lucide NO tiene (p.ej. balón de fútbol o de
  /// baloncesto). Markup INTERIOR de un `<svg viewBox="0 0 24 24">` con estilo
  /// lucide (`fill=none stroke=currentColor stroke-width=2`). Mutuamente excluyente
  /// con `lucide`. Contenido CURADO → render inline seguro.
  final String? svg;

  const SectionIconDef({
    required this.id,
    required this.label,
    required this.keywords,
    this.lucide,
    this.svg,
  });
}

/// Nombre lucide (kebab) de un def: `lucide` si está, si no el `id`.
String lucideIconName(SectionIconDef def) => def.lucide ?? def.id;

/// Nombre lucide (kebab) para un `id` del catálogo (o el id si no se encuentra).
String lucideForIconId(String id) {
  for (final d in sectionIcons) {
    if (d.id == id) return lucideIconName(d);
  }
  return id;
}

const List<SectionIconDef> sectionIcons = [
  // ── Colección / juego ──
  SectionIconDef(id: 'cards', label: 'Cartas', keywords: ['carta', 'cartas', 'cromo', 'cromos', 'cards', 'deck'], lucide: 'wallet-cards'),
  SectionIconDef(id: 'star', label: 'Estrella', keywords: ['estrella', 'destacado', 'favorito', 'star']),
  SectionIconDef(id: 'sparkles', label: 'Destellos', keywords: ['especial', 'brillo', 'raros', 'sparkle']),
  SectionIconDef(id: 'trophy', label: 'Trofeo', keywords: ['trofeo', 'logros', 'campeonato', 'trophy', 'torneo']),
  SectionIconDef(id: 'medal', label: 'Medalla', keywords: ['medalla', 'premio', 'medal']),
  SectionIconDef(id: 'dice', label: 'Dados', keywords: ['dado', 'dados', 'azar', 'dice', 'juego'], lucide: 'dices'),
  SectionIconDef(id: 'puzzle', label: 'Puzzle', keywords: ['puzzle', 'pieza', 'reto']),
  SectionIconDef(id: 'gift', label: 'Regalo', keywords: ['regalo', 'sobre', 'sobres', 'gift', 'pack']),
  // ── Fantasía / lore ──
  SectionIconDef(id: 'crown', label: 'Corona', keywords: ['reino', 'reinos', 'corona', 'rey', 'reyes', 'kingdom', 'imperio']),
  SectionIconDef(id: 'book', label: 'Libro', keywords: ['leyenda', 'leyendas', 'historia', 'historias', 'lore', 'relato', 'libro', 'book'], lucide: 'book-open'),
  SectionIconDef(id: 'scroll', label: 'Pergamino', keywords: ['pergamino', 'mision', 'misiones', 'quest', 'scroll']),
  SectionIconDef(id: 'swords', label: 'Espadas', keywords: ['espada', 'espadas', 'batalla', 'batallas', 'combate', 'guerra', 'duelo']),
  SectionIconDef(id: 'shield', label: 'Escudo', keywords: ['escudo', 'defensa', 'clan', 'clanes', 'hermandad', 'gremio']),
  SectionIconDef(id: 'wand', label: 'Varita', keywords: ['magia', 'hechizo', 'hechizos', 'varita', 'conjuro', 'magic'], lucide: 'wand-sparkles'),
  SectionIconDef(id: 'flask', label: 'Poción', keywords: ['pocion', 'pociones', 'alquimia', 'elixir', 'laboratorio'], lucide: 'flask-conical'),
  SectionIconDef(id: 'crystal', label: 'Bola mágica', keywords: ['profecia', 'oraculo', 'vidente', 'cristal'], lucide: 'eye'),
  SectionIconDef(id: 'skull', label: 'Calavera', keywords: ['jefe', 'jefes', 'villano', 'villanos', 'boss', 'calavera', 'muerte']),
  SectionIconDef(id: 'ghost', label: 'Fantasma', keywords: ['fantasma', 'fantasmas', 'espiritu', 'espiritus', 'ghost']),
  SectionIconDef(id: 'castle', label: 'Castillo', keywords: ['castillo', 'castillos', 'fortaleza', 'ciudadela']),
  SectionIconDef(id: 'key', label: 'Llave', keywords: ['llave', 'llaves', 'secreto', 'secretos', 'key']),
  // ── Criaturas ──
  SectionIconDef(id: 'paw', label: 'Huella', keywords: ['bestia', 'bestias', 'criatura', 'criaturas', 'animal', 'animales', 'mascota', 'mascotas'], lucide: 'paw-print'),
  SectionIconDef(id: 'bug', label: 'Insecto', keywords: ['insecto', 'insectos', 'bicho', 'bichos', 'bug']),
  SectionIconDef(id: 'fish', label: 'Pez', keywords: ['pez', 'peces', 'mar', 'oceano', 'acuatico']),
  SectionIconDef(id: 'feather', label: 'Pluma', keywords: ['ave', 'aves', 'pajaro', 'pajaros', 'pluma', 'vuelo']),
  SectionIconDef(id: 'leaf', label: 'Hoja', keywords: ['planta', 'plantas', 'flora', 'hoja', 'jardin', 'botanica']),
  // ── Naturaleza / elementos ──
  SectionIconDef(id: 'flame', label: 'Llama', keywords: ['fuego', 'llama', 'llamas', 'volcan', 'fire']),
  SectionIconDef(id: 'droplet', label: 'Gota', keywords: ['agua', 'gota', 'rio', 'rios', 'lluvia', 'water']),
  SectionIconDef(id: 'wind', label: 'Viento', keywords: ['viento', 'aire', 'tormenta', 'wind']),
  SectionIconDef(id: 'snowflake', label: 'Copo', keywords: ['hielo', 'nieve', 'invierno', 'frio', 'ice']),
  SectionIconDef(id: 'sun', label: 'Sol', keywords: ['sol', 'dia', 'verano', 'luz', 'sun']),
  SectionIconDef(id: 'moon', label: 'Luna', keywords: ['luna', 'noche', 'nocturno', 'moon']),
  SectionIconDef(id: 'bolt', label: 'Rayo', keywords: ['rayo', 'rayos', 'energia', 'electrico', 'trueno'], lucide: 'zap'),
  SectionIconDef(id: 'mountain', label: 'Montaña', keywords: ['montana', 'montanas', 'cumbre', 'cordillera', 'pico']),
  SectionIconDef(id: 'trees', label: 'Bosque', keywords: ['bosque', 'bosques', 'arbol', 'arboles', 'selva', 'naturaleza']),
  SectionIconDef(id: 'gem', label: 'Gema', keywords: ['gema', 'gemas', 'joya', 'joyas', 'diamante', 'tesoro', 'tesoros', 'cristales']),
  // ── Lugares / viaje ──
  SectionIconDef(id: 'map', label: 'Mapa', keywords: ['mapa', 'mapas', 'region', 'regiones', 'territorio', 'zonas']),
  SectionIconDef(id: 'compass', label: 'Brújula', keywords: ['brujula', 'explorar', 'exploracion', 'aventura', 'expedicion']),
  SectionIconDef(id: 'globe', label: 'Globo', keywords: ['mundo', 'planeta', 'planetas', 'paises', 'global']),
  SectionIconDef(id: 'rocket', label: 'Cohete', keywords: ['espacio', 'cohete', 'galaxia', 'nave', 'naves', 'sci-fi']),
  SectionIconDef(id: 'home', label: 'Casa', keywords: ['casa', 'casas', 'pueblo', 'pueblos', 'aldea', 'hogar'], lucide: 'house'),
  SectionIconDef(id: 'building', label: 'Edificio', keywords: ['ciudad', 'ciudades', 'edificio', 'edificios', 'urbano'], lucide: 'building-2'),
  SectionIconDef(id: 'anchor', label: 'Ancla', keywords: ['barco', 'barcos', 'puerto', 'puertos', 'nautico', 'marina']),
  SectionIconDef(id: 'flag', label: 'Bandera', keywords: ['bandera', 'banderas', 'pais', 'nacion', 'naciones', 'flag']),
  // ── Gente / cultura ──
  SectionIconDef(id: 'users', label: 'Personajes', keywords: ['personaje', 'personajes', 'heroe', 'heroes', 'protagonistas', 'gente']),
  SectionIconDef(id: 'user', label: 'Perfil', keywords: ['perfil', 'perfiles', 'jugador', 'jugadores', 'miembro', 'miembros']),
  SectionIconDef(id: 'heart', label: 'Corazón', keywords: ['amor', 'corazon', 'vida', 'vidas', 'salud']),
  SectionIconDef(id: 'music', label: 'Música', keywords: ['musica', 'cancion', 'canciones', 'banda', 'bandas', 'sonido']),
  SectionIconDef(id: 'camera', label: 'Cámara', keywords: ['foto', 'fotos', 'fotografia', 'camara', 'photo']),
  SectionIconDef(id: 'image', label: 'Galería', keywords: ['galeria', 'imagenes', 'ilustracion', 'ilustraciones', 'arte']),
  SectionIconDef(id: 'calendar', label: 'Calendario', keywords: ['momento', 'momentos', 'evento', 'eventos', 'fecha', 'fechas', 'temporada', 'temporadas']),
  SectionIconDef(id: 'clock', label: 'Reloj', keywords: ['epoca', 'epocas', 'era', 'eras', 'tiempo', 'cronologia']),
  // ── Deporte / motor ──
  SectionIconDef(id: 'ball', label: 'Portería', keywords: ['deporte', 'deportes', 'liga', 'equipos', 'meta', 'goal'], lucide: 'goal'),
  // Balones por deporte — lucide no los trae, glifo SVG inline (Studio + Flutter).
  SectionIconDef(id: 'soccer-ball', label: 'Balón de fútbol', keywords: ['futbol', 'balon', 'soccer', 'football', 'pelota'],
      svg: '<circle cx="12" cy="12" r="10"/><path d="M12 8.9 15 11 13.8 14.5 10.2 14.5 9 11Z"/><path d="M12 8.9V2.5"/><path d="M15 11 20.6 9.2"/><path d="M13.8 14.5 17.3 19.3"/><path d="M10.2 14.5 6.7 19.3"/><path d="M9 11 3.4 9.2"/>'),
  SectionIconDef(id: 'basketball', label: 'Baloncesto', keywords: ['baloncesto', 'basket', 'basketball', 'canasta', 'nba'],
      svg: '<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><path d="M12 2a14 14 0 0 0 0 20"/><path d="M12 2a14 14 0 0 1 0 20"/>'),
  SectionIconDef(id: 'car', label: 'Coche', keywords: ['coche', 'coches', 'carrera', 'carreras', 'motor', 'rally', 'automovilismo']),
  SectionIconDef(id: 'coins', label: 'Monedas', keywords: ['moneda', 'monedas', 'economia', 'mercado', 'tienda', 'coins']),
  SectionIconDef(id: 'bike', label: 'Bici', keywords: ['ciclismo', 'bici', 'bicicleta', 'bike', 'mtb']),
  SectionIconDef(id: 'dumbbell', label: 'Pesa', keywords: ['gimnasio', 'fitness', 'pesas', 'gym', 'musculacion', 'entreno', 'lucha']),
  SectionIconDef(id: 'volleyball', label: 'Voleibol', keywords: ['voleibol', 'volley', 'volleyball']),
  // ── Géneros / temas (KRO) ──
  SectionIconDef(id: 'gamepad', label: 'Mando', keywords: ['videojuego', 'videojuegos', 'gaming', 'consola', 'gamepad', 'arcade'], lucide: 'gamepad-2'),
  SectionIconDef(id: 'clapperboard', label: 'Claqueta', keywords: ['cine', 'pelicula', 'peliculas', 'film', 'claqueta', 'movie']),
  SectionIconDef(id: 'tv', label: 'Televisión', keywords: ['tv', 'television', 'serie', 'series', 'show', 'programa']),
  SectionIconDef(id: 'palette', label: 'Paleta', keywords: ['arte', 'pintura', 'paleta', 'dibujo', 'color', 'cuadro']),
  SectionIconDef(id: 'atom', label: 'Átomo', keywords: ['ciencia', 'fisica', 'atomo', 'science', 'quimica', 'tecnologia']),
  SectionIconDef(id: 'dna', label: 'ADN', keywords: ['biologia', 'adn', 'dna', 'genetica', 'celula']),
  SectionIconDef(id: 'telescope', label: 'Telescopio', keywords: ['astronomia', 'telescopio', 'estrellas', 'cosmos', 'universo']),
  SectionIconDef(id: 'guitar', label: 'Guitarra', keywords: ['guitarra', 'rock', 'instrumento', 'concierto']),
  SectionIconDef(id: 'mic', label: 'Micrófono', keywords: ['canto', 'microfono', 'rap', 'cantante', 'voz', 'podcast']),
  SectionIconDef(id: 'drama', label: 'Teatro', keywords: ['teatro', 'drama', 'comedia', 'obra']),
  SectionIconDef(id: 'mask', label: 'Máscara', keywords: ['anime', 'manga', 'cosplay', 'carnaval', 'disfraz', 'mascara'], lucide: 'venetian-mask'),
  SectionIconDef(id: 'landmark', label: 'Monumento', keywords: ['historia', 'monumento', 'historico', 'civilizacion', 'patrimonio']),
  SectionIconDef(id: 'church', label: 'Iglesia', keywords: ['religion', 'iglesia', 'fe', 'catedral', 'templo']),
  SectionIconDef(id: 'bone', label: 'Hueso', keywords: ['dinosaurio', 'dinosaurios', 'fosil', 'hueso', 'prehistoria', 'paleontologia', 'jurasico']),
  SectionIconDef(id: 'cat', label: 'Gato', keywords: ['gato', 'gatos', 'felino', 'felinos']),
  SectionIconDef(id: 'bird', label: 'Pájaro', keywords: ['pajaro', 'pajaros', 'ornitologia']),
  SectionIconDef(id: 'flower', label: 'Flor', keywords: ['flor', 'flores', 'primavera'], lucide: 'flower-2'),
  SectionIconDef(id: 'plane', label: 'Avión', keywords: ['avion', 'viaje', 'viajes', 'aviacion', 'vuelo', 'turismo']),
  SectionIconDef(id: 'utensils', label: 'Cubiertos', keywords: ['comida', 'gastronomia', 'cocina', 'restaurante', 'recetas']),
  SectionIconDef(id: 'shirt', label: 'Camiseta', keywords: ['moda', 'ropa', 'camiseta', 'fashion', 'estilo']),
];

/// Pliega acentos (es) y pasa a minúsculas — mismo criterio que las keywords.
/// (El TS usa NFD+strip; Dart no trae normalize NFD, así que mapeamos los
/// diacríticos del español, que es lo que aparece en nombres de sección.)
String _fold(String s) {
  const map = {
    'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a',
    'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
    'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
    'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
    'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
    'ñ': 'n', 'ç': 'c',
  };
  final sb = StringBuffer();
  for (final ch in s.toLowerCase().split('')) {
    sb.write(map[ch] ?? ch);
  }
  return sb.toString();
}

/// Sugiere un icono para una sección por su nombre/key. Matching por PALABRA
/// (no substring: "carta" no matchea "cartagena"), con acentos plegados.
/// Devuelve el `id` del catálogo o `null` (→ el render cae al monograma). NUNCA
/// devuelve un icono "de relleno": sin match claro, null.
String? suggestSectionIcon(String nameOrKey) {
  final words = _fold(nameOrKey).split(RegExp(r'[^a-z0-9]+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return null;
  for (final def in sectionIcons) {
    for (final kw in def.keywords) {
      if (words.contains(kw)) return def.id;
    }
  }
  return null;
}

/// Markup SVG inline de un icono del catálogo, si es un glifo no-lucide.
String? sectionIconSvg(String? id) {
  if (id == null) return null;
  for (final d in sectionIcons) {
    if (d.id == id) return d.svg;
  }
  return null;
}

/// Id EFECTIVO del icono de una sección: el elegido (si existe en el catálogo,
/// lucide o glifo SVG), si no la sugerencia por nombre, si no `null` (→ monograma).
/// Resolución unificada que usan el render lucide y el de glifos SVG inline
/// (anti-drift Studio↔Flutter).
String? resolveSectionIconId(String? icon, String nameOrKey) {
  if (icon != null && sectionIcons.any((d) => d.id == icon)) return icon;
  return suggestSectionIcon(nameOrKey);
}
