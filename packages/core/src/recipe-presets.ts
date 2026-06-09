/**
 * KRO-133 F5 — Recetas → presets de LAYOUT (árbol grid 2D).
 *
 * Reconstruye el diseño de cada receta como un árbol de bloques (contenedores
 * grid + hojas-slot + apariencias por slot), para que al "Activar diseño por
 * bloques" el publisher PARTA del diseño real de la receta (no de una columna
 * naíf) y lo siga editando con las herramientas del constructor.
 *
 * Best-effort: las recetas tienen efectos no expresables aún por el modelo
 * (solapes con margen negativo, gradientes/foil, carruseles snap, dividers,
 * tamaños fijos en px de avatar/thumb…). El preset captura la ESTRUCTURA y las
 * apariencias básicas; los huecos son la guía de qué personalización falta.
 *
 * Ground-truth cross-language: Flutter espejará estos presets.
 */
import { migrateSlotsToGrid } from './layout';
import type {
  LayoutContainerNode, LayoutNode, GridPlacement, SlotAppearance, ViewComposition, RecipeId,
} from './types';

type Ap = Partial<SlotAppearance>;

interface RecipePreset {
  /** Construye el árbol con SOLO los slots presentes (`has(id)`). */
  build: (has: (id: string) => boolean) => LayoutContainerNode;
  /** Apariencia base por slot (se fusiona; la del usuario tiene prioridad). */
  appearance?: Record<string, Ap>;
}

const leaf = (slot: string, place: GridPlacement): LayoutNode => ({ type: 'slot', slot, place });

const grid = (
  columns: number, rows: number, children: LayoutNode[],
  extra: Partial<Omit<LayoutContainerNode, 'type' | 'kind' | 'columns' | 'rows' | 'children'>> = {},
): LayoutContainerNode => ({
  type: 'container', kind: 'grid', columns: Math.max(1, columns), rows: Math.max(1, rows),
  gap: 'sm', children, ...extra,
});

/** Stack vertical (1 columna) de los slots presentes, en orden. */
const stack = (ids: string[], has: (id: string) => boolean, extra: Partial<LayoutContainerNode> = {}): LayoutContainerNode => {
  const present = ids.filter(has);
  return grid(1, present.length, present.map((id, i) => leaf(id, { colStart: 1, rowStart: i + 1 })), extra);
};

/**
 * Stack vertical donde ciertos ids se renderizan como COMPONENTE fiel en vez de
 * slot pelado (KRO-133 — fidelidad: la galería es grid/carrusel CON etiqueta; los
 * stats son valor+label por campo). `componentAs` mapea slotId → { component, role }
 * (p.ej. `{ gallery: { component: 'gallery_grid', role: 'images' } }`).
 */
const detailStack = (
  ids: string[], has: (id: string) => boolean,
  extra: Partial<LayoutContainerNode> = {},
  componentAs: Record<string, { component: string; role: string }> = {},
): LayoutContainerNode => {
  const present = ids.filter(has);
  const children: LayoutNode[] = present.map((id, i) => {
    const place: GridPlacement = { colStart: 1, rowStart: i + 1 };
    const c = componentAs[id];
    return c
      ? { type: 'component', component: c.component, slots: { [c.role]: id }, place }
      : leaf(id, place);
  });
  return grid(1, present.length, children, extra);
};

/** Fila "media": [media | (título/subtítulo apilados) | accesorio], con anchos
 *  ajustados (media y accesorio al contenido, texto flexible). */
function mediaRow(
  mediaId: string | null, stackIds: string[], asideId: string | null,
  has: (id: string) => boolean,
): LayoutContainerNode {
  const children: LayoutNode[] = [];
  const colSizes: string[] = [];
  let col = 1;
  if (mediaId && has(mediaId)) { children.push(leaf(mediaId, { colStart: col, rowStart: 1 })); colSizes.push('content'); col++; }
  const present = stackIds.filter(has);
  if (present.length) {
    children.push({
      ...grid(1, present.length, present.map((id, i) => leaf(id, { colStart: 1, rowStart: i + 1 })), { gap: 'xs', align: 'start' }),
      place: { colStart: col, rowStart: 1 },
    });
    colSizes.push('1fr'); col++;
  }
  if (asideId && has(asideId)) { children.push(leaf(asideId, { colStart: col, rowStart: 1 })); colSizes.push('content'); col++; }
  // gap 'md' = gap-3 (mismo espaciado que el flex-row de las recetas de lista).
  return grid(Math.max(1, col - 1), 1, children, { align: 'center', columnSizes: colSizes, gap: 'md' });
}

const RECIPE_PRESETS: Partial<Record<RecipeId, RecipePreset>> = {
  // ── Listas ──────────────────────────────────────────────────────────
  compact_card: {
    build: (has) => mediaRow('thumb', ['title', 'subtitle'], 'badge', has),
    appearance: { thumb: { shape: 'rounded' }, title: { weight: 'semibold' }, subtitle: { size: 'md', textColor: 'muted' }, badge: { display: 'badge' } },
  },
  compact_avatar: {
    build: (has) => mediaRow('avatar', ['title', 'subtitle'], 'meta', has),
    appearance: { avatar: { shape: 'circle' }, title: { weight: 'semibold' }, subtitle: { size: 'md', textColor: 'muted' }, meta: { size: 'sm', textColor: 'muted' } },
  },
  row_text: {
    build: (has) => {
      const children: LayoutNode[] = []; const colSizes: string[] = []; let col = 1;
      if (has('title'))    { children.push(leaf('title', { colStart: col, rowStart: 1 }));    colSizes.push('1fr');     col++; }
      if (has('subtitle')) { children.push(leaf('subtitle', { colStart: col, rowStart: 1 })); colSizes.push('content'); col++; }
      return grid(Math.max(1, col - 1), 1, children, { align: 'center', columnSizes: colSizes });
    },
    appearance: { title: { weight: 'semibold' }, subtitle: { size: 'md', textColor: 'muted', align: 'right' } },
  },

  // ── V5 (KRO-133) — recetas modernas "block-native" ──────────────────────
  feature_card: {
    // Tarjeta vertical: imagen 16:9 → título → (subtítulo | badge).
    build: (has) => {
      const children: LayoutNode[] = []; let row = 1;
      if (has('image')) children.push(leaf('image', { colStart: 1, rowStart: row++ }));
      if (has('title')) children.push(leaf('title', { colStart: 1, rowStart: row++ }));
      const bottom: LayoutNode[] = []; const bCols: string[] = []; let bc = 1;
      if (has('subtitle')) { bottom.push(leaf('subtitle', { colStart: bc, rowStart: 1 })); bCols.push('1fr');     bc++; }
      if (has('badge'))    { bottom.push(leaf('badge',    { colStart: bc, rowStart: 1 })); bCols.push('content'); bc++; }
      if (bottom.length) {
        children.push({
          ...grid(Math.max(1, bc - 1), 1, bottom, { align: 'center', columnSizes: bCols, gap: 'sm' }),
          place: { colStart: 1, rowStart: row++ },
        });
      }
      return grid(1, Math.max(1, row - 1), children, { gap: 'sm' });
    },
    appearance: {
      image:    { aspect: '16:9', shape: 'rounded' },
      title:    { weight: 'semibold', size: 'lg' },
      subtitle: { size: 'md', textColor: 'muted' },
      badge:    { display: 'badge' },
    },
  },
  split_panel: {
    // Fila horizontal: imagen grande a la izquierda + (título/subtítulo/badge) + meta.
    build: (has) => mediaRow('image', ['title', 'subtitle', 'badge'], 'meta', has),
    appearance: {
      image:    { shape: 'rounded', aspect: '1:1', size: 'lg' },
      title:    { weight: 'bold' },
      subtitle: { size: 'md', textColor: 'muted' },
      badge:    { display: 'badge' },
      meta:     { size: 'sm', textColor: 'muted' },
    },
  },
  stat_tile: {
    // Mosaico centrado: badge → valor grande → etiqueta, sobre fondo de tile.
    build: (has) => stack(['badge', 'value', 'label'], has, {
      align: 'center', gap: 'xs',
      surface: { background: 'muted', radius: 'lg', shadow: 'none', padding: 'md' },
    }),
    appearance: {
      value: { weight: 'bold', size: 'xl', align: 'center' },
      label: { size: 'sm', textColor: 'muted', align: 'center' },
      badge: { display: 'badge' },
    },
  },
  cover_band: {
    // Portada arriba + banda de color (acento) con título + badge.
    build: (has) => {
      const children: LayoutNode[] = []; let row = 1;
      if (has('image')) children.push(leaf('image', { colStart: 1, rowStart: row++ }));
      const band: LayoutNode[] = []; const bCols: string[] = []; let bc = 1;
      if (has('title')) { band.push(leaf('title', { colStart: bc, rowStart: 1 })); bCols.push('1fr');     bc++; }
      if (has('badge')) { band.push(leaf('badge', { colStart: bc, rowStart: 1 })); bCols.push('content'); bc++; }
      if (band.length) {
        children.push({
          ...grid(Math.max(1, bc - 1), 1, band, {
            align: 'center', columnSizes: bCols, gap: 'sm',
            // Banda de acento: bg-accent + texto text-accent-foreground (contraste).
            surface: { background: 'none', bgColor: 'accent', radius: 'md', padding: 'sm' },
          }),
          place: { colStart: 1, rowStart: row++ },
        });
      }
      return grid(1, Math.max(1, row - 1), children, { gap: 'none' });
    },
    appearance: {
      image: { aspect: '3:4', shape: 'rounded' },
      title: { weight: 'bold', textColor: 'accent' },
      badge: { display: 'badge' },
    },
  },

  // ── Detalle ──────────────────────────────────────────────────────────
  hero_protagonico: {
    // KRO-133 (híbrido) — la cabecera (banner + avatar superpuesto + título +
    // subtítulo, con placeholders + inicial del título: lógica cruzada NO
    // expresable con slots sueltos) va como el componente FIEL `hero_header`;
    // el cuerpo (stats/body/gallery) queda como bloques editables; y las
    // relacionadas como el componente `ref_gallery` (galería de mini-cartas).
    build: (has) => {
      const children: LayoutNode[] = []; let row = 1;
      // Cabecera FIEL — SIEMPRE presente (renderiza placeholders si vacía).
      const headerSlots: Record<string, string> = {};
      for (const r of ['banner', 'avatar', 'title', 'subtitle']) if (has(r)) headerSlots[r] = r;
      children.push({ type: 'component', component: 'hero_header', slots: headerSlots, place: { colStart: 1, rowStart: row++ } });
      // Cuerpo (stats como FILA fiel, body como slot, galería como CARRUSEL fiel).
      if (has('stats')) children.push({ type: 'component', component: 'stats_row', slots: { stats: 'stats' }, place: { colStart: 1, rowStart: row++ } });
      if (has('body'))  children.push(leaf('body', { colStart: 1, rowStart: row++ }));
      if (has('gallery')) children.push({ type: 'component', component: 'carousel_peek', slots: { images: 'gallery' }, place: { colStart: 1, rowStart: row++ } });
      // Relacionadas → galería de cartas (componente).
      if (has('related')) children.push({ type: 'component', component: 'ref_gallery', slots: { refs: 'related' }, place: { colStart: 1, rowStart: row++ } });
      return grid(1, Math.max(1, row - 1), children, { gap: 'md' });
    },
    appearance: {
      banner: { aspect: '16:9' }, avatar: { shape: 'circle' },
      title: { weight: 'bold', size: 'xl', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' },
      body: { size: 'md' },
    },
  },
  editorial: {
    // KRO-133 fidelidad — TARJETA (rounded-xl bg-card) con el cover FULL-BLEED
    // arriba (rounded-none, pegado) + el contenido en un contenedor con padding,
    // igual que `EditorialRecipe` (`<article>` + cover + `px-5 py-5`). El título
    // va en SERIF, el meta en MAYÚSCULAS, la galería como grid.
    build: (has) => {
      const content: LayoutNode[] = []; let cr = 1;
      for (const id of ['title', 'meta', 'body']) if (has(id)) content.push(leaf(id, { colStart: 1, rowStart: cr++ }));
      if (has('gallery')) content.push({ type: 'component', component: 'gallery_grid', slots: { images: 'gallery' }, place: { colStart: 1, rowStart: cr++ } });
      const padded = grid(1, Math.max(1, cr - 1), content, { gap: 'sm', surface: { padding: 'lg' } });
      const outer: LayoutNode[] = []; let or = 1;
      if (has('cover')) outer.push(leaf('cover', { colStart: 1, rowStart: or++ }));
      outer.push({ ...padded, place: { colStart: 1, rowStart: or++ } });
      return grid(1, Math.max(1, or - 1), outer, { gap: 'none', surface: { background: 'card', radius: 'xl' } });
    },
    appearance: {
      cover: { aspect: '16:9', shape: 'square' },   // rounded-none → flush en la tarjeta
      title: { weight: 'bold', size: 'xl', font: 'serif' },
      meta:  { size: 'sm', textColor: 'muted', textTransform: 'uppercase' },
      body:  { size: 'md' },
    },
  },
  momento: {
    // KRO-133 fidelidad — TARJETA centrada con padding (como `MomentoRecipe`:
    // `rounded-xl bg-card` + `px-5 py-6 text-center`). Fecha prominente (NO
    // uppercase — la receta no la pone), slideshow como carrusel centrado.
    build: (has) => {
      const content: LayoutNode[] = []; let r = 1;
      for (const id of ['date', 'title', 'subtitle', 'body']) if (has(id)) content.push(leaf(id, { colStart: 1, rowStart: r++ }));
      if (has('slideshow')) content.push({ type: 'component', component: 'carousel_centered', slots: { images: 'slideshow' }, place: { colStart: 1, rowStart: r++ } });
      return grid(1, Math.max(1, r - 1), content, { align: 'center', gap: 'sm', surface: { background: 'card', radius: 'xl', padding: 'lg' } });
    },
    appearance: {
      date: { weight: 'bold', size: 'xl', align: 'center', textColor: 'primary' },
      title: { weight: 'bold', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' }, body: { size: 'md' },
    },
  },
  // V5 (KRO-133) — plantillas de detalle block-native.
  detail_panel: {
    // Portada ancha → título → subtítulo → stats (componente) → cuerpo → galería (grid).
    build: (has) => detailStack(['cover', 'title', 'subtitle', 'stats', 'body', 'gallery'], has, { gap: 'md' }, {
      stats:   { component: 'stats_row',   role: 'stats'  },
      gallery: { component: 'gallery_grid', role: 'images' },
    }),
    appearance: {
      cover:    { aspect: '16:9', shape: 'rounded' },   // sin size → ancho completo (fill)
      title:    { weight: 'bold', size: 'xl' },
      subtitle: { size: 'md', textColor: 'muted' },
      body:     { size: 'md' },
    },
  },
  detail_profile: {
    // Avatar circular centrado → título → subtítulo → stats (componente) → cuerpo.
    build: (has) => detailStack(['avatar', 'title', 'subtitle', 'stats', 'body'], has, { align: 'center', gap: 'md' }, { stats: { component: 'stats_row', role: 'stats' } }),
    appearance: {
      avatar:   { shape: 'circle', size: 'xl' },         // círculo grande fijo (con size → no fill)
      title:    { weight: 'bold', size: 'xl', align: 'center' },
      subtitle: { size: 'md', textColor: 'muted', align: 'center' },
      body:     { size: 'md' },
    },
  },

  // ── Expand ──────────────────────────────────────────────────────────
  accordion_simple: {
    build: (has) => stack(['body'], has),
    appearance: { body: { size: 'md' } },
  },
  accordion_with_actions: {
    build: (has) => stack(['body', 'actions'], has, { gap: 'sm' }),
    appearance: { body: { size: 'md' } },
  },
};

/**
 * Devuelve una composición con `layout` = preset de su receta + apariencias base
 * fusionadas en los slots (las del usuario mandan). Si la receta no tiene preset,
 * cae al grid naíf (`migrateSlotsToGrid`). Lo usa el editor al "Activar diseño
 * por bloques" para partir del diseño REAL de la receta.
 */
export function recipeToComposition(composition: ViewComposition): ViewComposition {
  const preset = RECIPE_PRESETS[composition.recipe];
  const slots = composition.slots ?? {};
  const has = (id: string) => id in slots;
  const layout = preset ? preset.build(has) : migrateSlotsToGrid(composition);

  const nextSlots = { ...slots };
  if (preset?.appearance) {
    for (const [id, ap] of Object.entries(preset.appearance)) {
      if (nextSlots[id]) {
        nextSlots[id] = { ...nextSlots[id], appearance: { ...ap, ...(nextSlots[id].appearance ?? {}) } };
      }
    }
  }
  return { ...composition, slots: nextSlots, layout };
}
