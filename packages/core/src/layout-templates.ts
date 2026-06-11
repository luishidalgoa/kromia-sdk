/**
 * KRO-178 — Galería de variantes de plantilla de layout (LAYOUT_TEMPLATES).
 *
 * Hoy cada receta tiene UN preset (recipe-presets.ts) → blank-canvas problem:
 * al activar Bloques partes del diseño de la receta o de nada. Este catálogo
 * añade VARIANTES por receta (mismo contrato `build(has)` + `appearance` que
 * los presets) para que el publisher elija un punto de partida visual.
 *
 * - `layoutTemplatesFor(recipe)` devuelve la lista efectiva: la variante
 *   "Clásica" (= el preset de la receta, si existe) SIEMPRE primera, seguida
 *   de las variantes propias. Recetas sin preset ni variantes → [].
 * - `applyLayoutTemplate(composition, template)` fusiona la variante en la
 *   composición (mismo merge que recipeToComposition: layout nuevo +
 *   apariencias base por slot donde la del usuario manda).
 *
 * FUERA del contrato KRP a propósito (mismo criterio que SECTION_ICONS,
 * KRO-189): las plantillas se consumen en EDICIÓN para sembrar
 * `composition.layout`, que es lo que se persiste y lo que Flutter renderiza.
 * Flutter no necesita el catálogo para pintar — solo si algún día edita.
 * Ground-truth cross-language: si la app edita, espejará este archivo.
 */
import {
  RECIPE_PRESETS, composeLayoutPreset, leaf, grid, stack, detailCard, mediaRow,
} from './recipe-presets';
import type {
  LayoutContainerNode, LayoutNode, SlotAppearance, ViewComposition, RecipeId,
} from './types';

type Ap = Partial<SlotAppearance>;

export interface LayoutTemplate {
  /** Único DENTRO de su receta. `classic` está reservado para el preset. */
  id:          string;
  name:        string;
  description: string;
  build:       (has: (id: string) => boolean) => LayoutContainerNode;
  appearance?: Record<string, Ap>;
}

/** Fila genérica [izquierda flexible | derecha al contenido] (espejo de mediaRow). */
function rowEnd(
  stackIds: string[], endId: string | null,
  has: (id: string) => boolean,
): LayoutContainerNode {
  const children: LayoutNode[] = [];
  const colSizes: string[] = [];
  let col = 1;
  const present = stackIds.filter(has);
  if (present.length) {
    children.push({
      ...grid(1, present.length, present.map((id, i) => leaf(id, { colStart: 1, rowStart: i + 1 })), { gap: 'xs', align: 'start' }),
      place: { colStart: col, rowStart: 1 },
    });
    colSizes.push('1fr'); col++;
  }
  if (endId && has(endId)) { children.push(leaf(endId, { colStart: col, rowStart: 1 })); colSizes.push('content'); col++; }
  return grid(Math.max(1, col - 1), 1, children, { align: 'center', columnSizes: colSizes, gap: 'md' });
}

const VARIANTS: Partial<Record<RecipeId, LayoutTemplate[]>> = {
  // ── Listas ──────────────────────────────────────────────────────────
  compact_card: [
    {
      id: 'media-derecha', name: 'Media a la derecha',
      description: 'Texto a la izquierda, miniatura a la derecha.',
      build: (has) => rowEnd(['title', 'subtitle', 'badge'], 'thumb', has),
      appearance: { thumb: { shape: 'rounded' }, title: { weight: 'semibold' }, subtitle: { size: 'md', textColor: 'muted' }, badge: { display: 'badge' } },
    },
    {
      id: 'vertical', name: 'Vertical',
      description: 'Miniatura arriba, texto debajo — como una mini-tarjeta.',
      build: (has) => {
        const children: LayoutNode[] = []; let row = 1;
        if (has('thumb')) children.push(leaf('thumb', { colStart: 1, rowStart: row++ }));
        if (has('title')) children.push(leaf('title', { colStart: 1, rowStart: row++ }));
        const bottom = rowEnd(['subtitle'], 'badge', has);
        if (bottom.children.length) children.push({ ...bottom, place: { colStart: 1, rowStart: row++ } });
        return grid(1, Math.max(1, row - 1), children, { gap: 'sm' });
      },
      appearance: { thumb: { shape: 'rounded', aspect: '1:1' }, title: { weight: 'semibold' }, subtitle: { size: 'md', textColor: 'muted' }, badge: { display: 'badge' } },
    },
  ],
  compact_avatar: [
    {
      id: 'centrada', name: 'Centrada',
      description: 'Avatar arriba y texto centrado debajo.',
      build: (has) => stack(['avatar', 'title', 'subtitle', 'meta'], has, { align: 'center', gap: 'xs' }),
      appearance: { avatar: { shape: 'circle' }, title: { weight: 'semibold', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' }, meta: { size: 'sm', textColor: 'muted', align: 'center' } },
    },
    {
      id: 'media-derecha', name: 'Avatar a la derecha',
      description: 'Texto a la izquierda, avatar a la derecha.',
      build: (has) => rowEnd(['title', 'subtitle', 'meta'], 'avatar', has),
      appearance: { avatar: { shape: 'circle' }, title: { weight: 'semibold' }, subtitle: { size: 'md', textColor: 'muted' }, meta: { size: 'sm', textColor: 'muted' } },
    },
  ],
  row_text: [
    {
      id: 'apilada', name: 'Apilada',
      description: 'Título y texto secundario en dos líneas.',
      build: (has) => stack(['title', 'subtitle'], has, { gap: 'xs' }),
      appearance: { title: { weight: 'semibold' }, subtitle: { size: 'sm', textColor: 'muted' } },
    },
  ],

  // ── V5 block-native ──────────────────────────────────────────────────
  feature_card: [
    {
      id: 'horizontal', name: 'Horizontal',
      description: 'Imagen a la izquierda, texto y badge a la derecha.',
      build: (has) => mediaRow('image', ['title', 'subtitle'], 'badge', has),
      appearance: { image: { shape: 'rounded', aspect: '1:1', size: 'lg' }, title: { weight: 'semibold', size: 'lg' }, subtitle: { size: 'md', textColor: 'muted' }, badge: { display: 'badge' } },
    },
    {
      id: 'badge-superpuesto', name: 'Badge superpuesto',
      description: 'El badge flota sobre la imagen (bloque absoluto).',
      build: (has) => {
        const children: LayoutNode[] = []; let row = 1;
        if (has('image')) children.push(leaf('image', { colStart: 1, rowStart: row++ }));
        if (has('title')) children.push(leaf('title', { colStart: 1, rowStart: row++ }));
        if (has('subtitle')) children.push(leaf('subtitle', { colStart: 1, rowStart: row++ }));
        // último del array → pinta ENCIMA (z-order = orden, KRO-176).
        if (has('badge')) children.push(leaf('badge', { position: 'absolute', x: 62, y: 5, w: 34, h: 14 }));
        return grid(1, Math.max(1, row - 1), children, { gap: 'sm' });
      },
      appearance: { image: { aspect: '16:9', shape: 'rounded' }, title: { weight: 'semibold', size: 'lg' }, subtitle: { size: 'md', textColor: 'muted' }, badge: { display: 'badge' } },
    },
  ],
  split_panel: [
    {
      id: 'invertida', name: 'Invertida',
      description: 'Texto a la izquierda, imagen grande a la derecha.',
      build: (has) => rowEnd(['title', 'subtitle', 'badge', 'meta'], 'image', has),
      appearance: { image: { shape: 'rounded', aspect: '1:1', size: 'lg' }, title: { weight: 'bold' }, subtitle: { size: 'md', textColor: 'muted' }, badge: { display: 'badge' }, meta: { size: 'sm', textColor: 'muted' } },
    },
  ],
  stat_tile: [
    {
      id: 'horizontal', name: 'Horizontal',
      description: 'Valor grande a la izquierda, etiqueta y badge al lado.',
      build: (has) => {
        const children: LayoutNode[] = []; const colSizes: string[] = []; let col = 1;
        if (has('value')) { children.push(leaf('value', { colStart: col, rowStart: 1 })); colSizes.push('content'); col++; }
        const rest = ['label', 'badge'].filter(has);
        if (rest.length) {
          children.push({
            ...grid(1, rest.length, rest.map((id, i) => leaf(id, { colStart: 1, rowStart: i + 1 })), { gap: 'xs', align: 'start' }),
            place: { colStart: col, rowStart: 1 },
          });
          colSizes.push('1fr'); col++;
        }
        return grid(Math.max(1, col - 1), 1, children, {
          align: 'center', columnSizes: colSizes, gap: 'md',
          surface: { background: 'muted', radius: 'lg', shadow: 'none', padding: 'md' },
        });
      },
      appearance: { value: { weight: 'bold', size: 'xl' }, label: { size: 'sm', textColor: 'muted' }, badge: { display: 'badge' } },
    },
  ],
  cover_band: [
    {
      id: 'banda-superior', name: 'Banda arriba',
      description: 'La banda de título va sobre la portada.',
      build: (has) => {
        const children: LayoutNode[] = []; let row = 1;
        const band: LayoutNode[] = []; const bCols: string[] = []; let bc = 1;
        if (has('title')) { band.push(leaf('title', { colStart: bc, rowStart: 1 })); bCols.push('1fr'); bc++; }
        if (has('badge')) { band.push(leaf('badge', { colStart: bc, rowStart: 1 })); bCols.push('content'); bc++; }
        if (band.length) {
          children.push({
            ...grid(Math.max(1, bc - 1), 1, band, {
              align: 'center', columnSizes: bCols, gap: 'sm',
              surface: { background: 'none', bgColor: 'accent', radius: 'md', padding: 'sm' },
            }),
            place: { colStart: 1, rowStart: row++ },
          });
        }
        if (has('image')) children.push(leaf('image', { colStart: 1, rowStart: row++ }));
        return grid(1, Math.max(1, row - 1), children, { gap: 'none' });
      },
      appearance: { image: { aspect: '3:4', shape: 'rounded' }, title: { weight: 'bold', textColor: 'accent' }, badge: { display: 'badge' } },
    },
  ],

  // ── Detalle ──────────────────────────────────────────────────────────
  hero_protagonico: [
    {
      id: 'sin-banner', name: 'Sin banner',
      description: 'Perfil centrado sin cabecera de banner.',
      // La cabecera (avatar/título/subtítulo) va ANIDADA como sub-stack: con
      // los 8 slots de hero en filas planas se excedería el máximo de 6 filas
      // por grid (lo caza el test de integridad).
      build: (has) => {
        const children: LayoutNode[] = []; let row = 1;
        const header = stack(['avatar', 'title', 'subtitle'], has, { align: 'center', gap: 'xs' });
        if (header.children.length) children.push({ ...header, place: { colStart: 1, rowStart: row++ } });
        if (has('stats'))   children.push({ type: 'component', component: 'stats_row', slots: { stats: 'stats' }, place: { colStart: 1, rowStart: row++ } });
        if (has('body'))    children.push(leaf('body', { colStart: 1, rowStart: row++ }));
        if (has('gallery')) children.push({ type: 'component', component: 'carousel_peek', slots: { images: 'gallery' }, place: { colStart: 1, rowStart: row++ } });
        if (has('related')) children.push({ type: 'component', component: 'ref_gallery', slots: { refs: 'related' }, place: { colStart: 1, rowStart: row++ } });
        return grid(1, Math.max(1, row - 1), children, { gap: 'md', surface: { padding: 'lg' } });
      },
      appearance: {
        avatar: { shape: 'circle', size: 'xl' },
        title: { weight: 'bold', size: 'xl', align: 'center' },
        subtitle: { size: 'md', textColor: 'muted', align: 'center' },
        body: { size: 'md', truncate: 'none' },
      },
    },
  ],
  editorial: [
    {
      id: 'sin-cover', name: 'Artículo',
      description: 'Solo texto: título serif, meta y cuerpo — sin cover.',
      build: (has) => detailCard(null, ['title', 'meta', 'body', 'gallery'], has, {
        gallery: { component: 'gallery_grid', role: 'images' },
      }, { gap: 'md', borderTopOn: 'body' }),
      appearance: {
        title: { weight: 'bold', size: 'xl', font: 'serif' },
        meta:  { size: 'sm', textColor: 'muted', textTransform: 'uppercase' },
        body:  { size: 'md', truncate: 'none', paddingY: 'md' },
      },
    },
  ],
  momento: [
    {
      id: 'linea-de-tiempo', name: 'Línea de tiempo',
      description: 'Fecha en columna lateral, contenido a la derecha.',
      build: (has) => {
        const children: LayoutNode[] = []; const colSizes: string[] = []; let col = 1;
        if (has('date')) { children.push(leaf('date', { colStart: col, rowStart: 1 })); colSizes.push('content'); col++; }
        const rest = ['title', 'subtitle', 'body', 'slideshow'].filter(has);
        if (rest.length) {
          const inner: LayoutNode[] = rest.map((id, i) => id === 'slideshow'
            ? { type: 'component', component: 'carousel_centered', slots: { images: 'slideshow' }, place: { colStart: 1, rowStart: i + 1 } }
            : leaf(id, { colStart: 1, rowStart: i + 1 }));
          children.push({
            ...grid(1, rest.length, inner, { gap: 'sm', align: 'start' }),
            place: { colStart: col, rowStart: 1 },
          });
          colSizes.push('1fr'); col++;
        }
        return grid(Math.max(1, col - 1), 1, children, {
          align: 'start', columnSizes: colSizes, gap: 'md', surface: { padding: 'lg' },
        });
      },
      appearance: {
        date: { weight: 'bold', size: 'lg', textColor: 'primary' },
        title: { weight: 'bold' },
        subtitle: { size: 'md', textColor: 'muted' },
        body: { size: 'md', truncate: 'none' },
      },
    },
  ],
  detail_profile: [
    {
      id: 'cabecera-fila', name: 'Cabecera en fila',
      description: 'Avatar y nombre en fila arriba, stats y cuerpo debajo.',
      build: (has) => {
        const children: LayoutNode[] = []; let row = 1;
        const header = mediaRow('avatar', ['title', 'subtitle'], null, has);
        if (header.children.length) children.push({ ...header, place: { colStart: 1, rowStart: row++ } });
        if (has('stats')) children.push({ type: 'component', component: 'stats_row', slots: { stats: 'stats' }, place: { colStart: 1, rowStart: row++ } });
        if (has('body')) children.push(leaf('body', { colStart: 1, rowStart: row++ }));
        return grid(1, Math.max(1, row - 1), children, { gap: 'md', surface: { padding: 'lg' } });
      },
      appearance: {
        avatar: { shape: 'circle', size: 'lg' },
        title: { weight: 'bold', size: 'lg' },
        subtitle: { size: 'md', textColor: 'muted' },
        body: { size: 'md', truncate: 'none' },
      },
    },
  ],
};

/**
 * Lista efectiva de plantillas de una receta: "Clásica" (el preset) primero,
 * después las variantes. Recetas sin preset ni variantes → [] (el editor cae
 * al flujo actual de "Activar diseño por bloques" con el grid naíf).
 */
export function layoutTemplatesFor(recipe: RecipeId): LayoutTemplate[] {
  const preset = RECIPE_PRESETS[recipe];
  const classic: LayoutTemplate[] = preset
    ? [{
        id: 'classic', name: 'Clásica',
        description: 'El diseño original de la receta.',
        build: preset.build, appearance: preset.appearance,
      }]
    : [];
  return [...classic, ...(VARIANTS[recipe] ?? [])];
}

/**
 * Fusiona una plantilla en la composición: layout construido con los slots
 * PRESENTES + apariencias base por slot (las del usuario tienen prioridad).
 * Pura — no muta la composición de entrada.
 */
export function applyLayoutTemplate(
  composition: ViewComposition,
  template:    LayoutTemplate,
): ViewComposition {
  return composeLayoutPreset(composition, template);
}
