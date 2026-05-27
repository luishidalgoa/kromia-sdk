/**
 * Field Type Registry — catálogo de los tipos base que puede tener un field.
 *
 * Los types son lo MÁS PRIMITIVO del sistema — el publisher los elige
 * primero y luego refina con un behavior.
 *
 * Source-of-truth para:
 *  - El selector de "tipo" en el editor (Studio).
 *  - El renderer Flutter (KRO-65) que decide cómo dibujar un field
 *    cuando no hay behavior específico.
 *  - El generator del KRP (`src/generate.ts`) serializa este catálogo en
 *    el `.json` (sección `fieldTypes`).
 *
 * Reglas:
 *  - Los IDs son **estables**: lo que se serializa en BD como `field.type`.
 *  - Renombrar un id = breaking change (major bump del KRP).
 *
 * Ver también `behaviors.ts` (campo `applicableTypes`).
 */

export interface FieldTypeDefinition {
  /** ID técnico, lo que se almacena en BD como `field.type`. */
  id: string;
  /** Nombre castellano que ve el editor en el dropdown del Studio. */
  displayName: string;
  /** Frase corta para tooltip + onboarding. */
  description: string;
  /**
   * ¿Es un tipo escalar (un solo valor) o colección (array)?
   *  - scalar: text, number, image, etc.
   *  - array:  array<X>
   */
  cardinality: 'scalar' | 'array';
  /**
   * Para arrays, el tipo del elemento contenido. `undefined` para scalars.
   * Ej: `array<image>` → elementType=`image`.
   */
  elementType?: string;
}

const FIELD_TYPES: FieldTypeDefinition[] = [
  // ── Escalares ──────────────────────────────────────────────────────
  {
    id:          'text',
    displayName: 'Texto',
    description: 'Texto corto en una sola línea. Para nombres, títulos, etiquetas, identificadores.',
    cardinality: 'scalar',
  },
  {
    id:          'textarea',
    displayName: 'Texto largo',
    description: 'Texto con varios párrafos. Para descripciones, biografías, notas extensas.',
    cardinality: 'scalar',
  },
  {
    id:          'number',
    displayName: 'Número',
    description: 'Valor numérico (entero o decimal). Para puntajes, precios, años, contadores.',
    cardinality: 'scalar',
  },
  {
    id:          'select',
    displayName: 'Selección',
    description: 'Una opción de una lista cerrada que tú defines. Para categorías fijas, tipos de carta, equipos.',
    cardinality: 'scalar',
  },
  {
    id:          'image',
    displayName: 'Imagen',
    description: 'Una imagen única (subida o URL). Para avatares, portadas, banners, fotos protagónicas.',
    cardinality: 'scalar',
  },

  // ── Arrays ─────────────────────────────────────────────────────────
  {
    id:          'array<string>',
    displayName: 'Lista de texto',
    description: 'Colección de textos cortos. Para etiquetas, enlaces, opciones múltiples, emails.',
    cardinality: 'array',
    elementType: 'text',
  },
  {
    id:          'array<number>',
    displayName: 'Lista de números',
    description: 'Colección de números. Para ediciones (años), referencias a cartas por índice, listas estadísticas.',
    cardinality: 'array',
    elementType: 'number',
  },
  {
    id:          'array<image>',
    displayName: 'Lista de imágenes',
    description: 'Colección de imágenes. Para galerías, vistas alternativas de una carta, pases de diapositivas.',
    cardinality: 'array',
    elementType: 'image',
  },

  // ── Referencias ───────────────────────────────────────────────────
  // KRO-75 — añadido al SDK para resolver drift con Studio. Es un tipo
  // escalar que apunta al primary key de otra carta del mismo álbum.
  {
    id:          'cardRef',
    displayName: 'Referencia a carta',
    description: 'Referencia a OTRA carta del mismo álbum por su primary key. Requiere PK declarada.',
    cardinality: 'scalar',
  },
];

const FIELD_TYPES_BY_ID = Object.fromEntries(
  FIELD_TYPES.map(t => [t.id, t]),
) as Record<string, FieldTypeDefinition>;

/** Acceso por ID. `undefined` si el type no está en el catálogo. */
export function getFieldType(id: string): FieldTypeDefinition | undefined {
  return FIELD_TYPES_BY_ID[id];
}

/** Catálogo completo en orden de declaración. */
export function allFieldTypes(): ReadonlyArray<FieldTypeDefinition> {
  return FIELD_TYPES;
}

/** Lista de IDs (útil para construir uniones tipadas / validación). */
export const FIELD_TYPE_IDS = FIELD_TYPES.map(t => t.id) as ReadonlyArray<string>;
