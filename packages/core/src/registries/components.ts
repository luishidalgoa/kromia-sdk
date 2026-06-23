/**
 * KRO-133 Capa 2 — Catálogo de COMPONENTES PREFABRICADOS para el motor de
 * bloques.
 *
 * Un componente es un bloque COMPUESTO reutilizable (carta, galería de cartas,
 * avatar…) que se inserta en un layout como UNA unidad (`LayoutComponentNode`),
 * en vez de recomponer slots a mano. Resuelve el hueco de que el motor genérico
 * no reproducía lo que las recetas hardcodean (p.ej. la rejilla de mini-cartas
 * caía a "[6]").
 *
 * Cada componente declara sus ROLES (los "huecos" que consume) con los
 * `accepts` (tipos de slot que encajan en cada rol). El publisher mapea cada rol
 * a un slot de la composición (`node.slots[role] = slotId`). El renderer
 * (`@kromia/react`, espejo `@kromia/flutter`) pinta el componente leyendo esos
 * slots.
 *
 * Patrón idéntico a `recipes.ts`: catálogo cerrado, source-of-truth única, que
 * Studio (palette + canvas), el validador y los renderers consumen. Entra al
 * contrato KRP (`generate.ts`) → versionado + visible para Flutter.
 *
 * **Ground truth cross-language**: `tests/components.test.ts`.
 */
import type { SlotAcceptKind } from '../types';

/**
 * KRO-133 — categoría de un componente. Agrupa la palette del editor en un
 * acordeón ORGANIZADO y da orden estable. Catálogo cerrado (paridad Flutter).
 */
// KRO-198 — categorías SEMÁNTICAS (antes 'basic' era un cajón de sastre). El
// `id` entra al contrato KRP (serializado) → cambiarlo requiere paridad Flutter.
export type ComponentCategory = 'attributes' | 'cards' | 'media' | 'header' | 'decorative';

/** Catálogo de categorías: etiqueta legible + orden de aparición en la palette. */
export const COMPONENT_CATEGORIES: { id: ComponentCategory; label: string; order: number }[] = [
  { id: 'attributes', label: 'Atributos y etiquetas', order: 0 },
  { id: 'cards',      label: 'Cartas y referencias',  order: 1 },
  { id: 'media',      label: 'Galerías de imágenes',  order: 2 },
  { id: 'header',     label: 'Cabeceras',             order: 3 },
  { id: 'decorative', label: 'Decorativos',           order: 4 },
];

/** Un "hueco" del componente, mapeable a un slot de la composición. */
export interface ComponentRole {
  /** Id del rol — clave en `LayoutComponentNode.slots`. */
  id:        string;
  /** Etiqueta legible (UI de mapeo en el editor). */
  label:     string;
  /** Tipos de slot que encajan en este rol (mismo catálogo que los slots de receta). */
  accepts:   SlotAcceptKind[];
  /** Si true, el componente se pinta sin él. Default false (requerido). */
  optional?: boolean;
}

export interface ComponentDefinition {
  /** Id estable — referenciado por `LayoutComponentNode.component`. */
  id:          string;
  displayName: string;
  description: string;
  /** KRO-133 — categoría para agrupar la palette (acordeón) por afinidad. */
  category:    ComponentCategory;
  roles:       ComponentRole[];
}

/**
 * Catálogo cerrado, agrupado por `category` para la palette. Crecer = solo
 * nuevas entradas + su renderer espejo (@kromia/react / @kromia/flutter).
 */
export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  // Carta compuesta: media full-bleed + título + (opcional) pie + (opcional)
  // badge. La unidad visual canónica de un álbum de cromos.
  card: {
    id:          'card',
    displayName: 'Carta',
    description: 'Tarjeta compuesta: imagen + título + pie y badge opcionales. La unidad visual de un álbum, como un bloque reutilizable.',
    category:    'cards',
    roles: [
      { id: 'media',   label: 'Imagen',  accepts: ['image', 'image-array'] },
      { id: 'title',   label: 'Título',  accepts: ['text-short'] },
      { id: 'caption', label: 'Pie',     accepts: ['text-short', 'text-long'], optional: true },
      { id: 'badge',   label: 'Badge',   accepts: ['badge'],                   optional: true },
    ],
  },

  // KRO-155 — fila de BADGES: cada field del slot = su propio pill (p.ej.
  // "Fuego · Rara · Holo" como chips sueltos), en vez de UN solo pill que
  // envuelve todo (lo que hace un slot composable con display:'badge').
  badge_row: {
    id:          'badge_row',
    displayName: 'Fila de badges',
    description: 'Pinta cada campo del slot como un BADGE separado (varios atributos cortos en línea, como pills sueltas), en vez de un único pill que envuelve todo.',
    category:    'attributes',
    roles: [
      { id: 'badges', label: 'Badges', accepts: ['badge', 'text-short'] },
    ],
  },

  // KRO-198 — fila de CHIPS: cada field del slot como una pastilla SUTIL (chip,
  // estilo etiqueta tenue gris), p.ej. "Fuego · Rara · Holo" como chips en línea.
  // Es la disposición "chips" del subtítulo abstraída como bloque reutilizable —
  // más discreta que `badge_row` (que usa el estilo BADGE, más prominente).
  chips_row: {
    id:          'chips_row',
    displayName: 'Fila de chips',
    description: 'Pinta cada campo del slot como una pastilla SUTIL (chip, estilo etiqueta tenue): varios atributos cortos como chips en línea. La disposición "chips" como bloque reutilizable. Más discreto que "Fila de badges".',
    category:    'attributes',
    roles: [
      { id: 'chips', label: 'Chips', accepts: ['text-short', 'number', 'badge'] },
    ],
  },

  // KRO-155 — título de SECCIÓN: rótulo en MAYÚSCULAS colocable (el "separador
  // con texto"). Hoy esos rótulos ("GALERÍA"/"BESTIAS") solo existen
  // auto-derivados DENTRO de las galerías; este los hace ponibles en cualquier
  // sitio.
  section_title: {
    id:          'section_title',
    displayName: 'Título de sección',
    description: 'Etiqueta de sección en MAYÚSCULAS colocable sobre cualquier bloque. Muestra el valor del campo o, si no hay, su etiqueta — como un rótulo "GALERÍA"/"ESTADÍSTICAS".',
    category:    'header',
    roles: [
      { id: 'text', label: 'Texto', accepts: ['text-short'], optional: true },
    ],
  },

  // Cabecera "hero": banner + avatar circular superpuesto + título + subtítulo,
  // centrados. Reproduce FIEL la cabecera de la receta `hero_protagonico` (con
  // sus placeholders: banner degradado + inicial del título), que NO se puede
  // expresar con slots sueltos (lógica cruzada título→avatar + solape). Es la
  // pieza "prefab" que el preset de bloques del hero usa para no salir plano.
  hero_header: {
    id:          'hero_header',
    displayName: 'Cabecera con avatar',
    description: 'Banner + avatar circular superpuesto + título + subtítulo centrados, colocados como una unidad. Trae placeholder de banner degradado e inicial del título cuando faltan datos.',
    category:    'header',
    roles: [
      { id: 'banner',   label: 'Banner',    accepts: ['image', 'image-array'],        optional: true },
      { id: 'avatar',   label: 'Avatar',    accepts: ['image'],                        optional: true },
      { id: 'title',    label: 'Título',    accepts: ['text-short'] },
      { id: 'subtitle', label: 'Subtítulo', accepts: ['text-short', 'date', 'number'], optional: true },
    ],
  },

  // Galería de cartas referenciadas: rejilla de mini-cartas (reutiliza el render
  // del slot card-ref de la Capa 1). Para "relacionadas", "plantilla", etc.
  ref_gallery: {
    id:          'ref_gallery',
    displayName: 'Galería de cartas',
    description: 'Rejilla de mini-cartas a partir de un slot de referencias (card-ref). Para cartas relacionadas, plantillas, colecciones.',
    category:    'cards',
    roles: [
      { id: 'refs', label: 'Referencias', accepts: ['card-ref'] },
    ],
  },

  // ── Carruseles de imágenes (KRO-133) — recrean como COMPONENTES los estilos de
  // galería que las recetas hardcodean. Un solo rol `images` (un array de
  // imágenes). El renderer comparte `<ImageGallery variant>` en @kromia/react.

  // Estilo "Hero protagónico": swipe horizontal, cada imagen ~70% de ancho y
  // asoma la siguiente (snap-start).
  carousel_peek: {
    id:          'carousel_peek',
    displayName: 'Carrusel grande',
    description: 'Carrusel horizontal de imágenes grandes con swipe: cada imagen ocupa ~70% del ancho y asoma (peek) la siguiente. Para galerías destacadas.',
    category:    'media',
    roles: [
      { id: 'images', label: 'Imágenes', accepts: ['image-array', 'image'] },
    ],
  },

  // Estilo "Momento": tarjetas de imagen centradas que se deslizan (snap-center).
  carousel_centered: {
    id:          'carousel_centered',
    displayName: 'Carrusel centrado',
    description: 'Carrusel horizontal de tarjetas de imagen centradas con swipe (snap central). Pensado para slideshow en móvil.',
    category:    'media',
    roles: [
      { id: 'images', label: 'Imágenes', accepts: ['image-array', 'image'] },
    ],
  },

  // Estilo "Editorial": mosaico en rejilla de 3 columnas (sin swipe).
  gallery_grid: {
    id:          'gallery_grid',
    displayName: 'Galería en mosaico',
    description: 'Mosaico de imágenes en rejilla de 3 columnas. Muestra varias imágenes a la vez, sin swipe.',
    category:    'media',
    roles: [
      { id: 'images', label: 'Imágenes', accepts: ['image-array', 'image'] },
    ],
  },

  // Carrusel de cartas referenciadas: las MISMAS mini-cartas de `ref_gallery`
  // pero en fila deslizable (swipe) en vez de rejilla.
  cards_carousel: {
    id:          'cards_carousel',
    displayName: 'Carrusel de cartas',
    description: 'Carrusel horizontal de cartas referenciadas con swipe — las mini-cartas de la galería en una fila deslizable. Para cartas relacionadas o colecciones largas.',
    category:    'cards',
    roles: [
      { id: 'cards', label: 'Cartas', accepts: ['card-ref'] },
    ],
  },

  // Separador decorativo: línea fina corta y centrada (el "hr" que las recetas
  // de detalle pintan entre bloques, p.ej. bajo la fecha de "Momento"). Sin
  // roles — es puramente visual. Para separadores a TODO el ancho, usa el borde
  // superior de un contenedor (Decoración → Borde → lado top).
  divider: {
    id:          'divider',
    displayName: 'Separador',
    description: 'Línea fina corta y centrada para separar bloques (un "hr" fino). Decorativo, sin contenido.',
    category:    'decorative',
    roles: [],
  },

  // Fila de estadísticas: cada campo del slot se pinta como VALOR grande +
  // su etiqueta debajo (números tabulares, label en mayúsculas), separados por
  // un borde. Recrea FIEL el bloque "stats" de las recetas de detalle (Hero/
  // Ficha/Perfil), que es lógica multi-campo NO expresable con un slot pelado.
  stats_row: {
    id:          'stats_row',
    displayName: 'Fila de estadísticas',
    description: 'Fila de estadísticas: cada campo del slot se muestra como valor grande + su etiqueta debajo (números tabulares). Para varios datos numéricos en línea.',
    category:    'attributes',
    roles: [
      { id: 'stats', label: 'Estadísticas', accepts: ['number', 'text-short'] },
    ],
  },
};

/** Todos los componentes del catálogo (orden de declaración). */
export function allComponents(): ComponentDefinition[] {
  return Object.values(COMPONENT_REGISTRY);
}

/** Definición de un componente por id, o undefined si no existe. */
export function getComponentDef(id: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY[id];
}

/** Ids del catálogo (para validación/iteración). */
export const COMPONENT_IDS: readonly string[] = Object.keys(COMPONENT_REGISTRY);

/**
 * Componentes agrupados por categoría, en el orden de `COMPONENT_CATEGORIES`.
 * Para la palette en acordeón del editor (y el espejo Flutter). Omite las
 * categorías vacías.
 */
export function componentsByCategory(): { category: ComponentCategory; label: string; components: ComponentDefinition[] }[] {
  return COMPONENT_CATEGORIES
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(cat => ({
      category:   cat.id,
      label:      cat.label,
      components: allComponents().filter(c => c.category === cat.id),
    }))
    .filter(group => group.components.length > 0);
}

// ── KRO-155 — CONFIG genérica per-componente ─────────────────────────────────
// Mecanismo de personalización de un prefab SIN añadir un campo tipado por cada
// parámetro: una bolsa cerrada `node.config` (clave → id de opción) cuyo ESQUEMA
// (qué claves admite cada componente + sus presets) vive aquí. El editor deriva
// los controles de este esquema; el render (@kromia/react) mapea los ids a clases;
// Flutter espeja los mismos ids. Es metadata de EDITOR (presets cerrados), NO se
// serializa al contrato KRP — añadir/editar un campo aquí NO bumpea el contrato.

/** Un campo personalizable de un componente: clave + presets cerrados + default. */
export interface ComponentConfigField {
  /** Clave bajo `node.config` (p.ej. 'thickness'). */
  key:     string;
  /** Etiqueta para el control del editor. */
  label:   string;
  /** Opciones cerradas (id técnico → etiqueta). El render mapea el id a clases. */
  options: { id: string; label: string }[];
  /** Id de opción por defecto cuando `node.config[key]` no está. */
  default: string;
}

const COMPONENT_CONFIG_SCHEMAS: Record<string, ComponentConfigField[]> = {
  // Separador parametrizable: ancho, grosor, estilo de línea y tono.
  divider: [
    { key: 'width',     label: 'Ancho',  default: 'short', options: [
      { id: 'short', label: 'Corto' }, { id: 'wide', label: 'Ancho' }, { id: 'full', label: 'Completo' }] },
    { key: 'thickness', label: 'Grosor', default: 'hairline', options: [
      { id: 'hairline', label: 'Fino' }, { id: 'medium', label: 'Medio' }, { id: 'thick', label: 'Grueso' }] },
    { key: 'style',     label: 'Estilo', default: 'solid', options: [
      { id: 'solid', label: 'Sólido' }, { id: 'dashed', label: 'Discontinuo' }, { id: 'dotted', label: 'Punteado' }] },
    { key: 'tint',      label: 'Tono',   default: 'border', options: [
      { id: 'border', label: 'Borde' }, { id: 'muted', label: 'Tenue' }, { id: 'strong', label: 'Fuerte' }] },
  ],
};

/** Esquema de CONFIG de un componente (campos personalizables), o `[]` si no
 *  tiene ninguno. El editor lo recorre para pintar controles; el render lee
 *  `node.config[field.key]` (cayendo a `field.default`). */
export function getComponentConfigSchema(componentId: string): ComponentConfigField[] {
  return COMPONENT_CONFIG_SCHEMAS[componentId] ?? [];
}
