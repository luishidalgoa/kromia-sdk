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
import type { EncyclopediaDoc } from './encyclopedia-doc';

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
export interface RecipeManifest extends EncyclopediaDoc {
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
    whenToUse:
      'Para listas donde quieres ver muchas filas a la vez con su foto identificadora: jugadores de un equipo, hermanas de una hermandad, capítulos de un libro. Si necesitas más jerarquía visual, usa CompactCard o Hero.',
    long: `Slots:
- \`avatar\` (image-avatar, circular) — foto principal
- \`title\` (text-short) — nombre
- \`subtitle\` (text-short, opcional) — dato secundario
- \`badge\` (badge, opcional) — rareza/categoría

Layout: avatar a la izquierda (40-56px según size), texto a la derecha. Una fila por carta. **Densidad alta**: caben 8-12 cartas en una pantalla móvil.

El accent del card es la línea izquierda (cuando \`accentPosition: 'auto'\`).`,
    examples: [
      { title: 'Plantilla de equipo', description: 'Lista de 25 jugadores con foto + dorsal + posición.' },
      { title: 'Hermanas de la cofradía', description: 'Foto circular + nombre + año de ingreso.' },
    ],
    related: ['recipe:compact_card', 'recipe:row_text', 'kind:image-avatar', 'concept:accent'],
    aliases: ['avatar compacto', 'lista de avatares', 'compact avatar'],
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
    whenToUse:
      'Cuando la imagen importa más que el texto (logos, escudos, covers). Renderiza como **grid de N columnas** en lugar de lista vertical. Si el contenido necesita mucho texto, usa Editorial o Hero.',
    long: `Slots:
- \`image\` (image-avatar, cuadrado por defecto) — visual principal
- \`title\` (text-short) — texto bajo la imagen
- \`badge\` (badge, opcional) — etiqueta superpuesta

Layout: grid responsive (2-4 cols según ancho). Cada celda es un mini-card cuadrado con la imagen ocupando ~70% y el texto debajo.`,
    examples: [
      { title: 'Escudos de equipos', description: 'Grid 3x3 con escudos cuadrados + nombre del club.' },
      { title: 'Covers de álbumes', description: 'Grid 2x4 con portada + título + año.' },
    ],
    related: ['recipe:compact_avatar', 'recipe:hero_protagonico', 'kind:image-avatar'],
    aliases: ['mini card', 'carta compacta', 'grid card'],
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
    whenToUse:
      'Como **vista de detalle** principal de una carta importante: jugador estrella, capítulo destacado, equipo de la jornada. Render grande con imagen panorámica. **No usar en lista** — está pensado para una carta a pantalla completa.',
    long: `Slots:
- \`banner\` (image-avatar, 16:9 o 3:4) — imagen principal
- \`title\` (text-short, grande) — nombre
- \`subtitle\` (text-short) — dato breve
- \`description\` (text-short con behavior markdown) — bio o texto largo
- \`badges\` (array, opcional) — chips de stats
- \`accent\` (color, opcional) — color del equipo/hermandad
- \`miniCards\` (card-ref, opcional) — grid de cartas hijas (plantilla, capítulos, …)

Es la receta más rica visualmente. Suele acompañarse de una receta de lista para sus mini-cards (CompactAvatar para plantilla, Editorial para capítulos).`,
    examples: [
      { title: 'Detalle del jugador', description: 'Banner 16:9 + nombre + posición + dorsal + bio.' },
      { title: 'Detalle del equipo', description: 'Escudo grande + nombre + estadio + grid 4 cols de jugadores.' },
    ],
    related: ['recipe:editorial', 'recipe:compact_avatar', 'kind:card-ref', 'concept:nested-recipe'],
    aliases: ['hero protagónico', 'hero protagonico', 'detalle hero'],
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
    whenToUse:
      'Cuando la imagen no aporta y necesitas máxima densidad: estadísticas, listas de eventos, partidos jugados. Cada fila = una línea de texto con badges opcionales.',
    long: `Slots:
- \`title\` (text-short) — texto principal de la fila
- \`subtitle\` (text-short, opcional) — dato secundario alineado a la derecha
- \`badge\` (badge, opcional) — pill al final

Sin imagen ni avatar. **Densidad máxima**: 15-20 filas en pantalla móvil.`,
    examples: [
      { title: 'Goles del partido', description: 'Minuto + jugador + tipo de gol en una fila.' },
      { title: 'Capítulos del libro', description: 'Número + título + páginas.' },
    ],
    related: ['recipe:compact_avatar', 'recipe:accordion_simple'],
    aliases: ['fila de texto', 'row text', 'lista densa'],
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
    whenToUse:
      'Para contenido narrativo: artículos, biografías largas, momentos con descripción. Equilibrio entre Hero (más visual) y RowText (puro texto).',
    long: `Slots:
- \`cover\` (image-avatar, 16:9 o 4:3) — imagen del artículo
- \`title\` (text-short, grande) — titular
- \`excerpt\` (text-short, 2-3 líneas) — entradilla
- \`meta\` (text-short) — autor / fecha / categoría
- \`badge\` (badge, opcional) — categoría destacada

Layout: imagen arriba (ratio 4:3 por defecto), texto debajo. Soporta truncado largo del extracto.`,
    examples: [
      { title: 'Biografía de la hermandad', description: 'Foto del paso + historia + año fundación.' },
      { title: 'Crónica del partido', description: 'Foto + resumen + autor + fecha.' },
    ],
    related: ['recipe:momento', 'recipe:hero_protagonico'],
    aliases: ['editorial', 'artículo', 'articulo'],
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
    whenToUse:
      'Para hitos puntuales con foto: una jugada, una salida procesional, un highlight. Más visual que Editorial, más compacto que Hero.',
    long: `Slots:
- \`image\` (image-avatar, 1:1) — foto cuadrada
- \`caption\` (text-short, 2 líneas) — descripción corta
- \`meta\` (text-short) — fecha / lugar / autor

Layout: imagen cuadrada arriba (ocupa ancho completo), texto compacto debajo.`,
    examples: [
      { title: 'Gol histórico', description: 'Foto de la jugada + descripción + minuto.' },
      { title: 'Salida del paso', description: 'Foto + año + comentario corto.' },
    ],
    related: ['recipe:editorial', 'recipe:hero_protagonico'],
    aliases: ['momento', 'instante', 'highlight'],
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
    whenToUse:
      'Para FAQs, secciones expandibles, datos que el publisher quiere ocultar por defecto y revelar a demanda. Si necesitas acciones (botones) dentro del contenido expandido, usa AccordionWithActions.',
    long: `Slots:
- \`header\` (text-short) — texto siempre visible
- \`body\` (text-short con markdown, oculto hasta el click) — contenido expandible
- \`badge\` (badge, opcional) — pill en la cabecera

La acción del slot debe ser \`expand_inline\` para que el accordion abra/cierre. Otras acciones (modal, navigate) lo convierten en una lista normal.`,
    examples: [
      { title: 'Reglas del juego', description: 'Cada pregunta es una fila colapsable.' },
      { title: 'Cápitulos con resumen', description: 'Título visible, resumen al expandir.' },
    ],
    related: ['recipe:accordion_with_actions', 'action:expand_inline', 'recipe:row_text'],
    aliases: ['accordion simple', 'acordeón simple', 'acordeon simple'],
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
    whenToUse:
      'Cuando el contenido expandible necesita CTAs (compartir, abrir detalle, link externo). Para FAQs sin acción, usa AccordionSimple.',
    related: ['recipe:accordion_simple', 'action:navigate_to_detail', 'action:external_link'],
    aliases: ['accordion con acciones', 'acordeón con acciones', 'acordeon con botones'],
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
