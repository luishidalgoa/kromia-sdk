/// Field Behaviors — espejo 1:1 de `registries/behaviors.ts`.
///
/// Define cómo se INTERPRETA un field más allá de su `type` base (un number
/// puede ser `year`, `currency`, `rating`…). Cada behavior declara
/// `applicableTypes` (qué types lo admiten) y `renderAsSlotKind` (slot kind
/// primario al renderizar). `renderAsSlotKind` DEBE estar sincronizado con
/// `classifyField` (classify.dart) — si divergen, el `.json` del KRP miente.
///
/// `suggestBehavior` espeja la heurística de auto-sugerencia por key (Fase E):
/// los regex son idénticos al TS → el corpus cruza paridad de comportamiento.
library;

class BehaviorDefinition {
  /// ID técnico snake_case (se almacena en `field.behavior`).
  final String id;

  /// Nombre castellano para el dropdown del editor.
  final String displayName;

  /// Frase corta (tooltip).
  final String description;

  /// Tipos de field compatibles.
  final List<String> applicableTypes;

  /// Slot kind primario al renderizar. null = encaja solo por `type` base.
  final String? renderAsSlotKind;

  const BehaviorDefinition({
    required this.id,
    required this.displayName,
    required this.description,
    required this.applicableTypes,
    this.renderAsSlotKind,
  });
}

const List<BehaviorDefinition> _behaviors = <BehaviorDefinition>[
  // Fase A
  BehaviorDefinition(
    id: 'card_index_list',
    displayName: 'Lista de cartas',
    description:
        'Lista de cartas del álbum referenciadas por su número. Útil para "cartas relacionadas", "cartas del mismo set", etc.',
    applicableTypes: ['array<number>'],
    renderAsSlotKind: 'card-ref',
  ),
  BehaviorDefinition(
    id: 'url',
    displayName: 'Enlace web',
    description:
        'Dirección web (https://…). Se muestra como enlace clicable que abre en una pestaña nueva.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'url',
  ),
  BehaviorDefinition(
    id: 'tags',
    displayName: 'Etiquetas',
    description:
        'Etiquetas libres tipo Twitter/Instagram. Útiles para categorizar de forma flexible (#novedad, #legendaria, #2025…).',
    applicableTypes: ['array<string>'],
  ),
  // Fase D — quick wins
  BehaviorDefinition(
    id: 'email',
    displayName: 'Email',
    description:
        'Dirección de correo electrónico. Se muestra con icono y al pulsarla abre el cliente de correo del usuario.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'url',
  ),
  BehaviorDefinition(
    id: 'phone',
    displayName: 'Teléfono',
    description:
        'Número de teléfono. Se muestra con icono y al pulsarlo el móvil ofrece llamar directamente.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'url',
  ),
  BehaviorDefinition(
    id: 'year',
    displayName: 'Año',
    description:
        'Año concreto (4 dígitos). Útil para ediciones, temporadas, año de fundación de un equipo, etc.',
    applicableTypes: ['number'],
    renderAsSlotKind: 'date',
  ),
  BehaviorDefinition(
    id: 'currency',
    displayName: 'Precio',
    description:
        'Cantidad de dinero. El editor pone el símbolo de moneda delante (€, \$, £). Útil para valor de mercado, precio de venta, etc.',
    applicableTypes: ['number'],
  ),
  // Fase D.2
  BehaviorDefinition(
    id: 'markdown',
    displayName: 'Texto con formato',
    description:
        'Texto largo donde puedes usar **negrita**, listas, enlaces, etc. La app pública lo muestra con el formato aplicado.',
    applicableTypes: ['textarea'],
    renderAsSlotKind: 'text-long',
  ),
  BehaviorDefinition(
    id: 'enum',
    displayName: 'Opciones predefinidas',
    description:
        'Una o varias opciones de una lista que tú decides previamente. Útil para "rareza" (común / rara / épica / legendaria), "tipo", etc.',
    applicableTypes: ['array<string>'],
    renderAsSlotKind: 'badge',
  ),
  BehaviorDefinition(
    id: 'iso_date',
    displayName: 'Fecha',
    description:
        'Fecha concreta (día / mes / año). El editor abre un calendario para elegir. Útil para fecha de nacimiento, debut, lanzamiento, etc.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'date',
  ),
  // Fase D.3
  BehaviorDefinition(
    id: 'slug',
    displayName: 'URL amigable',
    description:
        'Texto pensado para aparecer en una URL. Solo minúsculas, números y guiones — sin espacios ni acentos. Útil cuando una carta o sección tiene una página propia con dirección legible (p.ej. /cartas/lionel-messi-2025).',
    applicableTypes: ['text'],
  ),
  BehaviorDefinition(
    id: 'percentage',
    displayName: 'Porcentaje',
    description:
        'Porcentaje del 0 al 100. El editor añade el símbolo % automáticamente. Útil para descuentos, completitud, probabilidad de aparición, etc.',
    applicableTypes: ['number'],
  ),
  BehaviorDefinition(
    id: 'rating',
    displayName: 'Valoración',
    description:
        'Valoración con estrellas (de 0 a 5 por defecto). El editor las muestra clicables como en cualquier reseña.',
    applicableTypes: ['number'],
    renderAsSlotKind: 'badge',
  ),
  BehaviorDefinition(
    id: 'color_hex',
    displayName: 'Color',
    description:
        'Selector de color con paleta visual. Para el color corporativo de un equipo, el tinte de una rareza (rojo = legendario), el fondo destacado de una sección…',
    applicableTypes: ['text'],
    renderAsSlotKind: 'color',
  ),
  // Fase D.4
  BehaviorDefinition(
    id: 'url_list',
    displayName: 'Lista de enlaces',
    description:
        'Lista de enlaces web. Útil para "enlaces relacionados", "redes sociales del jugador", etc. Cada uno se muestra clicable.',
    applicableTypes: ['array<string>'],
  ),
  BehaviorDefinition(
    id: 'email_list',
    displayName: 'Lista de emails',
    description:
        'Lista de direcciones de correo. Cada una se muestra clicable y abre el correo del usuario.',
    applicableTypes: ['array<string>'],
  ),
  BehaviorDefinition(
    id: 'measurement',
    displayName: 'Medida con unidad',
    description:
        'Medida con unidad: peso, altura, volumen, duración… El editor añade la unidad que elijas (cm, kg, ml, min…).',
    applicableTypes: ['number'],
  ),
  BehaviorDefinition(
    id: 'notes',
    displayName: 'Notas internas',
    description:
        'Texto largo libre para anotaciones que NO se muestran en la app pública. Útil para notas del equipo, recordatorios o información interna.',
    applicableTypes: ['textarea'],
    renderAsSlotKind: 'text-long',
  ),
  // Fase D.5.1
  BehaviorDefinition(
    id: 'code',
    displayName: 'Código fuente',
    description:
        'Texto en fuente monoespaciada para mostrar código de programación. Solo úsalo si tu álbum tiene cartas relacionadas con software o tutoriales técnicos.',
    applicableTypes: ['textarea'],
  ),
  BehaviorDefinition(
    id: 'html',
    displayName: 'HTML avanzado',
    description:
        'Para usuarios técnicos. Permite insertar HTML directamente que la app pública renderizará (con limpieza de seguridad). Si no sabes lo que es HTML, usa "Texto con formato".',
    applicableTypes: ['textarea'],
    renderAsSlotKind: 'text-long',
  ),
  BehaviorDefinition(
    id: 'year_list',
    displayName: 'Lista de años',
    description:
        'Lista de años. Útil para indicar ediciones múltiples, temporadas históricas en las que un jugador jugó, etc. Se añaden uno a uno.',
    applicableTypes: ['array<number>'],
    renderAsSlotKind: 'date',
  ),
  // Fase D.5.2 — Image-heavy (array<image>)
  BehaviorDefinition(
    id: 'gallery',
    displayName: 'Galería de imágenes',
    description:
        'Grid de imágenes sin orden semántico. Para fotos de un evento, varias instantáneas del mismo objeto, momentos sueltos.',
    applicableTypes: ['array<image>'],
    renderAsSlotKind: 'image-array',
  ),
  BehaviorDefinition(
    id: 'card_multiview',
    displayName: 'Vistas de la carta',
    description:
        'Vistas alternativas de la misma carta (frontal, dorso, holo, foil…). Cada slot tiene una etiqueta fija definida en config.labels.',
    applicableTypes: ['array<image>'],
    renderAsSlotKind: 'image-array',
  ),
  BehaviorDefinition(
    id: 'slideshow',
    displayName: 'Pase de diapositivas',
    description:
        'Imágenes con orden semántico (proceso, secuencia, antes/después). El cliente las muestra como carousel con flechas.',
    applicableTypes: ['array<image>'],
    renderAsSlotKind: 'image-array',
  ),
  // Fase D.5.2 — card_code_list (equivalente textual de card_index_list)
  BehaviorDefinition(
    id: 'card_code_list',
    displayName: 'Lista de cartas (por código)',
    description:
        'Lista de cartas del mismo álbum referenciadas por su código de texto (p.ej. HC-001, HC-002). Equivalente a "Lista de cartas" pero cuando tu álbum identifica cada carta por código en lugar de por número.',
    applicableTypes: ['array<string>'],
    renderAsSlotKind: 'card-ref',
  ),
  // KROM-25 — ordinal_enum
  BehaviorDefinition(
    id: 'ordinal_enum',
    displayName: 'Lista ordenada (jerarquía)',
    description:
        'Una opción de una lista cuyo orden importa. Útil para rareza (común → legendaria), niveles, categorías escalonadas. Declara las opciones en el campo "options" del field, ordenadas de menor a mayor.',
    applicableTypes: ['text', 'select'],
    renderAsSlotKind: 'badge',
  ),
  // Bug 2 (KRO-70) — counter auto-incrementable
  BehaviorDefinition(
    id: 'incremental',
    displayName: 'Contador / dorsal',
    description:
        'Número auto-incrementable o secuencial. Útil para dorsales (1, 2, 3…), ediciones numeradas, índices ordinales de cromo, números de serie. El editor lo trata como número plano; el formateo opcional (zero-padding, prefijo) se configurará en una iteración futura.',
    applicableTypes: ['number'],
  ),
];

final Map<String, BehaviorDefinition> _byId = <String, BehaviorDefinition>{
  for (final b in _behaviors) b.id: b,
};

/// Devuelve el behavior con el ID dado, o `null` si no existe / id vacío.
BehaviorDefinition? getBehavior(String? id) {
  if (id == null || id.isEmpty) return null;
  return _byId[id];
}

/// Behaviors aplicables al `type` dado.
List<BehaviorDefinition> getBehaviorsByType(String type) {
  return _behaviors.where((b) => b.applicableTypes.contains(type)).toList();
}

/// Todos los behaviors registrados (copia, como el `.slice()` del TS).
List<BehaviorDefinition> allBehaviors() => _behaviors.toList();

/// Lista de IDs.
final List<String> behaviorIds =
    _behaviors.map((b) => b.id).toList(growable: false);

// ── Fase E — sugerencias automáticas por key ───────────────────────────────

class _SuggestionPattern {
  final RegExp keyMatch;
  final String suggest;
  const _SuggestionPattern(this.keyMatch, this.suggest);
}

// Regex idénticos al TS (case-insensitive, anclados ^...$).
final List<_SuggestionPattern> _suggestionPatterns = <_SuggestionPattern>[
  // text
  _SuggestionPattern(RegExp(r'^(url|web|website|link|enlace|sitio)$', caseSensitive: false), 'url'),
  _SuggestionPattern(RegExp(r'^(email|correo|mail|contacto|e_?mail)$', caseSensitive: false), 'email'),
  _SuggestionPattern(RegExp(r'^(phone|tel(efono)?|movil|movile|celular)$', caseSensitive: false), 'phone'),
  _SuggestionPattern(RegExp(r'^(date|fecha|fundacion|nacimiento|nac(imiento)?)$', caseSensitive: false), 'iso_date'),
  _SuggestionPattern(RegExp(r'^slug$', caseSensitive: false), 'slug'),
  _SuggestionPattern(RegExp(r'^(color|colour)$', caseSensitive: false), 'color_hex'),
  // number
  _SuggestionPattern(RegExp(r'^(year|a[nñ]o|temporada|edicion|edition)$', caseSensitive: false), 'year'),
  _SuggestionPattern(RegExp(r'^(price|precio|cost(e)?|importe|valor)$', caseSensitive: false), 'currency'),
  _SuggestionPattern(RegExp(r'^(percentage|porcentaje|percent|pct|%)$', caseSensitive: false), 'percentage'),
  _SuggestionPattern(RegExp(r'^(rating|valoracion|score|puntuacion|puntos|stars)$', caseSensitive: false), 'rating'),
  _SuggestionPattern(RegExp(r'^(dorsal|numero|n[uú]m|serie|series|index|indice|orden|order|seq|sequence)$', caseSensitive: false), 'incremental'),
  // array<number>
  _SuggestionPattern(RegExp(r'^(cards|cartas|naipes)$', caseSensitive: false), 'card_index_list'),
  // array<string>
  _SuggestionPattern(RegExp(r'^(tags|etiquetas|labels|hashtags)$', caseSensitive: false), 'tags'),
  _SuggestionPattern(RegExp(r'^(urls|enlaces|websites|links)$', caseSensitive: false), 'url_list'),
  _SuggestionPattern(RegExp(r'^(emails|correos|mails)$', caseSensitive: false), 'email_list'),
  // textarea
  _SuggestionPattern(RegExp(r'^(markdown|md)$', caseSensitive: false), 'markdown'),
  _SuggestionPattern(RegExp(r'^(notes|notas|bio|biografia|comentarios|comments)$', caseSensitive: false), 'notes'),
];

/// Devuelve el id de behavior sugerido para una key + tipo dados, o `null`
/// si no hay pattern reconocido o el tipo no es compatible con el behavior.
String? suggestBehavior(String key, String type) {
  if (key.isEmpty) return null;
  for (final p in _suggestionPatterns) {
    if (!p.keyMatch.hasMatch(key)) continue;
    final def = _byId[p.suggest];
    if (def == null) continue;
    if (!def.applicableTypes.contains(type)) continue;
    return p.suggest;
  }
  return null;
}
