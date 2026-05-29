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

import type { EncyclopediaDoc } from './encyclopedia-doc';

export interface FieldTypeDefinition extends EncyclopediaDoc {
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
    whenToUse:
      'Cuando el dato es texto plano (nombre, descripción, URL, fecha en string). Si necesitas validación o renderizado específico, asígnale un behavior (year, iso_date, url, etc.).',
    related: ['behavior:markdown', 'behavior:url', 'behavior:iso_date'],
    aliases: ['texto', 'string', 'cadena'],
  },
  {
    id:          'textarea',
    displayName: 'Texto largo',
    description: 'Texto con varios párrafos. Para descripciones, biografías, notas extensas.',
    cardinality: 'scalar',
    whenToUse:
      'Cuando el contenido tiene saltos de línea o varios párrafos. Si solo es una línea, usa `text`. Si quieres formato (negritas, listas, links), añade el behavior `markdown`.',
    related: ['type:text', 'behavior:markdown', 'recipe:editorial'],
    aliases: ['texto largo', 'párrafo', 'parrafo'],
  },
  {
    id:          'number',
    displayName: 'Número',
    description: 'Valor numérico (entero o decimal). Para puntajes, precios, años, contadores.',
    cardinality: 'scalar',
    whenToUse:
      'Para cantidades, ratings, porcentajes, años. Combínalo con behaviors específicos (`year`, `rating`, `percentage`, `currency`, `measurement`) para que el render aplique el formato adecuado.',
    related: ['behavior:year', 'behavior:rating', 'behavior:percentage', 'behavior:currency'],
    aliases: ['número', 'numero', 'numérico'],
  },
  {
    id:          'select',
    displayName: 'Selección',
    description: 'Una opción de una lista cerrada que tú defines. Para categorías fijas, tipos de carta, equipos.',
    cardinality: 'scalar',
    whenToUse:
      'Cuando el valor debe ser uno de un conjunto fijo. Se suele combinar con behaviors `enum` (sin orden) o `ordinal_enum` (con orden, color escalado).',
    related: ['behavior:enum', 'behavior:ordinal_enum', 'kind:badge'],
    aliases: ['selección', 'seleccion', 'enum', 'opción'],
  },
  {
    id:          'image',
    displayName: 'Imagen',
    description: 'Una imagen única (subida o URL). Para avatares, portadas, banners, fotos protagónicas.',
    cardinality: 'scalar',
    whenToUse:
      'Para fotos, escudos, ilustraciones del cromo. Suele conectarse a slots `image-avatar` que aplican shape/aspect/imageFocus en el render.',
    related: ['kind:image-avatar', 'concept:appearance', 'type:array<image>'],
    aliases: ['imagen', 'foto', 'avatar'],
  },

  // ── Arrays ─────────────────────────────────────────────────────────
  {
    id:          'array<string>',
    displayName: 'Lista de texto',
    description: 'Colección de textos cortos. Para etiquetas, enlaces, opciones múltiples, emails.',
    cardinality: 'array',
    elementType: 'text',
    whenToUse:
      'Cuando el field es una lista variable de strings cortos. Combinable con behavior `url_list` si son enlaces.',
    related: ['behavior:url_list', 'type:text'],
    aliases: ['lista de texto', 'array de texto', 'tags'],
  },
  {
    id:          'array<number>',
    displayName: 'Lista de números',
    description: 'Colección de números. Para ediciones (años), referencias a cartas por índice, listas estadísticas.',
    cardinality: 'array',
    elementType: 'number',
    whenToUse:
      'Cuando el field es una lista variable de números. Para referencias a cartas por su índice (card-ref) usa behavior `card_index_list`.',
    related: ['behavior:card_index_list', 'type:number'],
    aliases: ['lista de números', 'array de números'],
  },
  {
    id:          'array<image>',
    displayName: 'Lista de imágenes',
    description: 'Colección de imágenes. Para galerías, vistas alternativas de una carta, pases de diapositivas.',
    cardinality: 'array',
    elementType: 'image',
    whenToUse:
      'Cuando el cromo tiene varias imágenes (anverso/reverso, galería de fotos). El renderer puede pintarlas en grid o carrusel según la receta.',
    related: ['type:image', 'kind:image-avatar'],
    aliases: ['galería', 'galeria', 'lista de imágenes'],
  },

  // ── Referencias ───────────────────────────────────────────────────
  // KRO-75 — añadido al SDK para resolver drift con Studio. Es un tipo
  // escalar que apunta al primary key de otra carta del mismo álbum.
  {
    id:          'cardRef',
    displayName: 'Referencia a carta',
    description: 'Referencia a OTRA carta del mismo álbum por su primary key. Requiere PK declarada.',
    cardinality: 'scalar',
    whenToUse:
      'Cuando un cromo tiene un "padre" o "asociado" único: un jugador → su equipo, un capítulo → su libro. Si es una lista de cartas (plantilla del equipo), usa el field con behavior `card_index_list`.',
    long: `Tipo escalar — un solo destino. El field guarda el valor de la primary key de la carta apuntada (string). Al renderizar, el sistema resuelve la PK contra la sección destino y obtiene la carta entera.

**Diferencia con sectionRef**: \`cardRef\` apunta a UN cromo concreto; \`sectionRef\` apunta a una sección entera (todas las cartas de esa sección).`,
    related: ['kind:card-ref', 'behavior:card_index_list', 'concept:nested-recipe'],
    aliases: ['referencia a carta', 'card ref', 'cardref'],
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
