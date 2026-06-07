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

  // ── Detalle (stack vertical; sin solapes/gradientes aún) ─────────────
  hero_protagonico: {
    build: (has) => stack(['banner', 'avatar', 'title', 'subtitle', 'stats', 'body', 'gallery', 'related'], has, { align: 'center', gap: 'md' }),
    appearance: {
      banner: { aspect: '16:9' }, avatar: { shape: 'circle' },
      title: { weight: 'bold', size: 'xl', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' },
      body: { size: 'md' },
    },
  },
  editorial: {
    build: (has) => stack(['cover', 'title', 'meta', 'body', 'gallery'], has, { gap: 'md' }),
    appearance: { cover: { aspect: '16:9' }, title: { weight: 'bold', size: 'xl' }, meta: { size: 'sm', textColor: 'muted' }, body: { size: 'md' } },
  },
  momento: {
    build: (has) => stack(['date', 'title', 'subtitle', 'body', 'slideshow'], has, { align: 'center', gap: 'md' }),
    appearance: {
      date: { weight: 'bold', size: 'xl', align: 'center', textColor: 'primary' },
      title: { weight: 'bold', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' }, body: { size: 'md' },
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
