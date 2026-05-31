/// Field Type Registry — espejo 1:1 de `registries/field-types.ts`.
///
/// Catalogo de los tipos base de un field (lo mas primitivo del modelo: el
/// publisher elige primero el type y luego refina con un behavior). Los IDs
/// son ESTABLES — es lo que se serializa como `field.type`; renombrar = major.
///
/// Mirror de los campos semanticos/estructurales (id, displayName, description,
/// cardinality, elementType). La doc rica (EncyclopediaDoc) NO se espeja a mano:
/// llega via el `.json` del KRP (KRO-83).
library;

class FieldTypeDefinition {
  /// ID tecnico (se almacena como `field.type`).
  final String id;

  /// Nombre castellano para el dropdown del editor.
  final String displayName;

  /// Frase corta (tooltip / onboarding).
  final String description;

  /// 'scalar' (un valor) o 'array' (coleccion).
  final String cardinality;

  /// Para arrays, el tipo del elemento contenido. null en scalars.
  final String? elementType;

  const FieldTypeDefinition({
    required this.id,
    required this.displayName,
    required this.description,
    required this.cardinality,
    this.elementType,
  });
}

const List<FieldTypeDefinition> _fieldTypes = <FieldTypeDefinition>[
  // ── Escalares ──────────────────────────────────────────────────────
  FieldTypeDefinition(
    id: 'text',
    displayName: 'Texto',
    description:
        'Texto corto en una sola línea. Para nombres, títulos, etiquetas, identificadores.',
    cardinality: 'scalar',
  ),
  FieldTypeDefinition(
    id: 'textarea',
    displayName: 'Texto largo',
    description:
        'Texto con varios párrafos. Para descripciones, biografías, notas extensas.',
    cardinality: 'scalar',
  ),
  FieldTypeDefinition(
    id: 'number',
    displayName: 'Número',
    description:
        'Valor numérico (entero o decimal). Para puntajes, precios, años, contadores.',
    cardinality: 'scalar',
  ),
  FieldTypeDefinition(
    id: 'select',
    displayName: 'Selección',
    description:
        'Una opción de una lista cerrada que tú defines. Para categorías fijas, tipos de carta, equipos.',
    cardinality: 'scalar',
  ),
  FieldTypeDefinition(
    id: 'image',
    displayName: 'Imagen',
    description:
        'Una imagen única (subida o URL). Para avatares, portadas, banners, fotos protagónicas.',
    cardinality: 'scalar',
  ),

  // ── Arrays ─────────────────────────────────────────────────────────
  FieldTypeDefinition(
    id: 'array<string>',
    displayName: 'Lista de texto',
    description:
        'Colección de textos cortos. Para etiquetas, enlaces, opciones múltiples, emails.',
    cardinality: 'array',
    elementType: 'text',
  ),
  FieldTypeDefinition(
    id: 'array<number>',
    displayName: 'Lista de números',
    description:
        'Colección de números. Para ediciones (años), referencias a cartas por índice, listas estadísticas.',
    cardinality: 'array',
    elementType: 'number',
  ),
  FieldTypeDefinition(
    id: 'array<image>',
    displayName: 'Lista de imágenes',
    description:
        'Colección de imágenes. Para galerías, vistas alternativas de una carta, pases de diapositivas.',
    cardinality: 'array',
    elementType: 'image',
  ),

  // ── Referencias (KRO-75) ───────────────────────────────────────────
  FieldTypeDefinition(
    id: 'cardRef',
    displayName: 'Referencia a carta',
    description:
        'Referencia a OTRA carta del mismo álbum por su primary key. Requiere PK declarada.',
    cardinality: 'scalar',
  ),
];

/// Acceso por ID. `null` si el type no está en el catálogo.
FieldTypeDefinition? getFieldType(String id) {
  for (final t in _fieldTypes) {
    if (t.id == id) return t;
  }
  return null;
}

/// Catálogo completo en orden de declaración.
List<FieldTypeDefinition> allFieldTypes() => _fieldTypes;

/// Lista de IDs (derivada del catálogo — garantiza que matchea).
final List<String> fieldTypeIds =
    _fieldTypes.map((t) => t.id).toList(growable: false);
