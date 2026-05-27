/**
 * Catálogo central de recetas — manifest declarativo de slots por receta.
 *
 * Cada entry describe:
 *   - kind: list (item dentro de una sección), detail (vista al tap) o
 *     expand (mini-receta inline bajo el item).
 *   - slots: array de SlotDefinition con su tipo (single/composable),
 *     qué clases de field aceptan (image, text-short, etc.) y si son
 *     opcionales.
 *
 * El editor UI usa este registry para:
 *   1. Mostrar el dropdown de recetas (id + displayName + description).
 *   2. Iterar slots y renderizar el picker de fields para cada uno.
 *   3. Validar (con classifyField + isFieldCompatibleWithSlot) que el
 *      field elegido encaja en el slot.
 *
 * El renderer (componentes React en Studio + futuros widgets Flutter)
 * usa el manifest para saber qué slots lee de la ViewComposition.
 */

import type { RecipeId, SlotKind, SlotAcceptKind } from '../types';

/** Definición de un slot dentro de una receta. */
export interface SlotDefinition {
  /** ID interno — coincide con la key en ViewComposition.slots. */
  id:          string;
  /** Etiqueta visible en el editor UI. */
  label:       string;
  /** Single (1 field) o composable (1-N fields). */
  kind:        SlotKind;
  /** Qué clases de field acepta. El editor filtra el picker con esto. */
  accepts:     SlotAcceptKind[];
  /** Si false, la receta requiere al menos 1 field aquí para ser válida. */
  optional?:   boolean;
  /** Tooltip en el editor + hint visual. */
  description?: string;
  /**
   * KRO-43 V4 — Si true, el publisher puede asignar una receta anidada a
   * este slot. Cada item del array referenciado se renderiza con esa
   * mini-receta en lugar del fallback (chips de IDs / placeholders).
   * Tipicamente true en slots `card-ref`.
   */
  nestable?:   boolean;
}

/** Metadata completa de una receta. */
export interface RecipeManifest {
  id:          RecipeId;
  /**
   * - "list":   item dentro de la sección.
   * - "detail": vista al tap (navigate_to_detail / modal).
   * - "expand": mini-receta desplegada inline bajo la card (action=expand_inline).
   */
  kind:        'list' | 'detail' | 'expand';
  displayName: string;
  /** Descripción corta para el dropdown del editor. */
  description: string;
  slots:       SlotDefinition[];
}

// ── Catálogo V1 + V2 + V3 ───────────────────────────────────────────────────

export const RECIPE_REGISTRY: Partial<Record<RecipeId, RecipeManifest>> = {
  compact_avatar: {
    id:          'compact_avatar',
    kind:        'list',
    displayName: 'Avatar compacto',
    description: 'Imagen circular + nombre + texto secundario. Ideal para listas de personas/entidades.',
    slots: [
      { id: 'avatar',   label: 'Avatar',         kind: 'single',     accepts: ['image'] },
      { id: 'title',    label: 'Título',         kind: 'single',     accepts: ['text-short'] },
      { id: 'subtitle', label: 'Subtítulo',      kind: 'composable', accepts: ['text-short', 'date', 'number'], optional: true,
        description:    'Texto secundario. Puedes componer varios fields con un separador (ciudad · año).' },
      { id: 'meta',     label: 'Meta',           kind: 'single',     accepts: ['text-short', 'date', 'badge'], optional: true,
        description:    'Información lateral (categoría, fecha, badge).' },
    ],
  },

  compact_card: {
    id:          'compact_card',
    kind:        'list',
    displayName: 'Mini card',
    description: 'Thumb cuadrada + nombre + subtítulo + badge de rareza/categoría.',
    slots: [
      { id: 'thumb',    label: 'Imagen',         kind: 'single',     accepts: ['image'] },
      { id: 'title',    label: 'Título',         kind: 'single',     accepts: ['text-short'] },
      { id: 'subtitle', label: 'Subtítulo',      kind: 'composable', accepts: ['text-short', 'date', 'number'], optional: true },
      { id: 'badge',    label: 'Rareza/categoría', kind: 'single',   accepts: ['badge'], optional: true,
        description:    'Badge destacado (rareza, tipo). Ordinal_enum se ordena por jerarquía declarada.' },
    ],
  },

  hero_protagonico: {
    id:          'hero_protagonico',
    kind:        'detail',
    displayName: 'Hero protagónico',
    description: 'Banner + avatar central + título + stats + body + galería. Para vistas hero al abrir un item.',
    slots: [
      { id: 'banner',   label: 'Banner superior',     kind: 'single',     accepts: ['image'] },
      { id: 'avatar',   label: 'Avatar',              kind: 'single',     accepts: ['image'] },
      { id: 'title',    label: 'Título',              kind: 'single',     accepts: ['text-short'] },
      { id: 'subtitle', label: 'Subtítulo',           kind: 'composable', accepts: ['text-short', 'date'], optional: true },
      { id: 'stats',    label: 'Estadísticas',        kind: 'composable', accepts: ['number'], optional: true,
        description:    'Lista de valores numéricos. Cada uno con su label heredado del field.' },
      { id: 'body',     label: 'Cuerpo',              kind: 'single',     accepts: ['text-long'], optional: true },
      { id: 'gallery',  label: 'Galería',             kind: 'single',     accepts: ['image-array'], optional: true },
      { id: 'related',  label: 'Cartas relacionadas', kind: 'single',     accepts: ['card-ref'], optional: true, nestable: true,
        description: 'Cada carta referenciada se renderiza con una receta anidada (V4). Sin receta anidada cae a chips con IDs.' },
    ],
  },

  // ── V2 (KRO-41) ─────────────────────────────────────────────────────────

  row_text: {
    id:          'row_text',
    kind:        'list',
    displayName: 'Fila de texto',
    description: 'Una sola línea: título + subtítulo a la derecha. Sin imagen. Para listas densas (FAQs, días, partidos).',
    slots: [
      { id: 'title',    label: 'Título',     kind: 'single',     accepts: ['text-short'] },
      { id: 'subtitle', label: 'Subtítulo',  kind: 'composable', accepts: ['text-short', 'date', 'number'], optional: true,
        description:    'Información secundaria a la derecha (fecha, hora, autor).' },
    ],
  },

  editorial: {
    id:          'editorial',
    kind:        'detail',
    displayName: 'Editorial',
    description: 'Artículo con cover + título grande + meta + body markdown + galería. Para historias largas.',
    slots: [
      { id: 'cover',    label: 'Imagen de cabecera', kind: 'single',     accepts: ['image'] },
      { id: 'title',    label: 'Título',             kind: 'single',     accepts: ['text-short'] },
      { id: 'meta',     label: 'Meta',               kind: 'composable', accepts: ['date', 'text-short'], optional: true,
        description:    'Autor · fecha · etiqueta. Se renderiza en pequeño bajo el título.' },
      { id: 'body',     label: 'Cuerpo',             kind: 'single',     accepts: ['text-long'] },
      { id: 'gallery',  label: 'Galería',            kind: 'single',     accepts: ['image-array'], optional: true },
    ],
  },

  momento: {
    id:          'momento',
    kind:        'detail',
    displayName: 'Momento',
    description: 'Fecha prominente + título + subtítulo + body + slideshow. Para efemérides, días, momentos clave.',
    slots: [
      { id: 'date',      label: 'Fecha',     kind: 'single', accepts: ['date'],
        description:     'Fecha o año destacado tipográficamente en la cabecera.' },
      { id: 'title',     label: 'Título',    kind: 'single', accepts: ['text-short'] },
      { id: 'subtitle',  label: 'Subtítulo', kind: 'single', accepts: ['text-short'], optional: true },
      { id: 'body',      label: 'Cuerpo',    kind: 'single', accepts: ['text-long'],  optional: true },
      { id: 'slideshow', label: 'Slideshow', kind: 'single', accepts: ['image-array'], optional: true,
        description:     'Carrusel horizontal scrollable. Pensado para swipe en móvil.' },
    ],
  },

  // ── V3 (KRO-42) — recetas de EXPAND ─────────────────────────────────────

  accordion_simple: {
    id:          'accordion_simple',
    kind:        'expand',
    displayName: 'Accordion simple',
    description: 'Solo cuerpo de texto. Se despliega bajo la card al tap (action=expand_inline).',
    slots: [
      { id: 'body', label: 'Cuerpo', kind: 'single', accepts: ['text-long'],
        description: 'Texto largo (markdown / notes / html) que aparece desplegado.' },
    ],
  },

  accordion_with_actions: {
    id:          'accordion_with_actions',
    kind:        'expand',
    displayName: 'Accordion con acciones',
    description: 'Cuerpo de texto + botones con enlaces. Para items con CTAs (redes, descargas, recursos).',
    slots: [
      { id: 'body',    label: 'Cuerpo',  kind: 'single',     accepts: ['text-long'] },
      { id: 'actions', label: 'Botones', kind: 'composable', accepts: ['url'],
        description: 'Lista de fields con behavior url/email/phone. Cada uno se renderiza como botón pulsable.' },
    ],
  },
};

/** Acceso seguro al manifest por id. */
export function getRecipeManifest(id: RecipeId): RecipeManifest | undefined {
  return RECIPE_REGISTRY[id];
}

/** Todos los manifests definidos en orden de declaración. */
export function allRecipes(): RecipeManifest[] {
  return Object.values(RECIPE_REGISTRY).filter((r): r is RecipeManifest => r !== undefined);
}

/**
 * Recetas filtradas por `kind`. KRO-76 — consolida el patrón repetido en
 * múltiples consumers de Studio:
 *
 *   `Object.values(RECIPE_REGISTRY).filter(m => m.kind === 'list')`
 *
 * Studio y Flutter consumen ambos esta función, garantizando que ven la
 * misma lista de recetas válidas por categoría.
 *
 * Nota: "nestable" no es un `kind` — es una propiedad lógica (solo recetas
 * de kind=list pueden anidarse en otros slots). Para obtener nestables, usar
 * `allRecipesByKind('list')`.
 */
export function allRecipesByKind(kind: RecipeManifest['kind']): RecipeManifest[] {
  return allRecipes().filter(r => r.kind === kind);
}
