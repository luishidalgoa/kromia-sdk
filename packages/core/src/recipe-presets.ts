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

// Exportados a NIVEL DE MÓDULO (no del barrel público) para que
// layout-templates.ts (KRO-178) construya sus variantes con los mismos
// ladrillos. La API pública del paquete no cambia.
export interface RecipePreset {
  /** Construye el árbol con SOLO los slots presentes (`has(id)`). */
  build: (has: (id: string) => boolean) => LayoutContainerNode;
  /** Apariencia base por slot (se fusiona; la del usuario tiene prioridad). */
  appearance?: Record<string, Ap>;
}

export const leaf = (slot: string, place: GridPlacement): LayoutNode => ({ type: 'slot', slot, place });

export const grid = (
  columns: number, rows: number, children: LayoutNode[],
  extra: Partial<Omit<LayoutContainerNode, 'type' | 'kind' | 'columns' | 'rows' | 'children'>> = {},
): LayoutContainerNode => ({
  type: 'container', kind: 'grid', columns: Math.max(1, columns), rows: Math.max(1, rows),
  gap: 'sm', children, ...extra,
});

/** Stack vertical (1 columna) de los slots presentes, en orden. */
export const stack = (ids: string[], has: (id: string) => boolean, extra: Partial<LayoutContainerNode> = {}): LayoutContainerNode => {
  const present = ids.filter(has);
  return grid(1, present.length, present.map((id, i) => leaf(id, { colStart: 1, rowStart: i + 1 })), extra);
};

/**
 * TARJETA de detalle (KRO-133 fidelidad). Reproduce la estructura de las recetas
 * de detalle tipo "card" (Editorial/Momento/Ficha/Perfil): un contenedor con
 * fondo card + un cover FULL-BLEED opcional arriba + el contenido en un
 * contenedor anidado con PADDING (`p-5` = el `px-5 py-5` de las recetas).
 * Algunos slots se pintan como COMPONENTE fiel (`componentAs` mapea
 * slotId → { component, role }: galería, stats, carrusel).
 *
 * SIN radius: el detalle es pantalla completa — las esquinas redondeadas tapaban
 * la raya de acento del AccentFrame y añadían un redondeo que la pantalla real
 * no muestra (el rounded-xl de la receta queda fuera del viewport del frame).
 *
 * Fidelidad extra:
 *  · `dividerAfter`  → inserta el componente `divider` (rayita corta centrada)
 *    tras ese slot — el "hr" bajo la fecha de Momento.
 *  · `borderTopOn`   → envuelve ese slot en un contenedor con borde superior —
 *    el divisor a todo el ancho sobre el cuerpo de Editorial (`border-t`).
 */
export const detailCard = (
  coverId: string | null,
  contentIds: string[],
  has: (id: string) => boolean,
  componentAs: Record<string, { component: string; role: string }> = {},
  opts: { centered?: boolean; gap?: LayoutContainerNode['gap']; dividerAfter?: string; borderTopOn?: string } = {},
): LayoutContainerNode => {
  // 1ª pasada: nodos SIN place (el divider puede insertarse al principio);
  // 2ª pasada: asigna rowStart secuencial.
  const nodes: LayoutNode[] = [];
  for (const id of contentIds) {
    if (!has(id)) continue;
    const c = componentAs[id];
    let node: LayoutNode = c
      ? { type: 'component', component: c.component, slots: { [c.role]: id } }
      : { type: 'slot', slot: id };
    if (opts.borderTopOn === id) {
      // Divisor a todo el ancho sobre el slot (el `border-t` del body de Editorial).
      node = grid(1, 1, [{ ...node, place: { colStart: 1, rowStart: 1 } }],
        { gap: 'none', surface: { border: { width: 'thin', sides: ['top'] } } });
    }
    nodes.push(node);
    if (opts.dividerAfter === id) {
      nodes.push({ type: 'component', component: 'divider', slots: {} });
    }
  }
  // El divisor de la receta es INCONDICIONAL (Momento lo pinta aunque no haya
  // fecha): si el slot ancla no existe, el divider va al principio.
  if (opts.dividerAfter && !nodes.some(n => n.type === 'component' && n.component === 'divider')) {
    nodes.unshift({ type: 'component', component: 'divider', slots: {} });
  }
  const content: LayoutNode[] = nodes.map((n, i) => ({ ...n, place: { colStart: 1, rowStart: i + 1 } }));
  const padded = grid(1, Math.max(1, content.length), content, {
    gap: opts.gap ?? 'sm', ...(opts.centered ? { align: 'center' as const } : {}), surface: { padding: 'lg' },
  });
  // Sin `background` propio en el raíz: el wrapper del motor ya es bg-card y un
  // fondo opaco aquí taparía la raya de acento (box-shadow inset del wrapper).
  if (coverId && has(coverId)) {
    // Tarjeta: cover full-bleed (rounded-none) + contenido con padding.
    const outer: LayoutNode[] = [
      leaf(coverId, { colStart: 1, rowStart: 1 }),
      { ...padded, place: { colStart: 1, rowStart: 2 } },
    ];
    return grid(1, 2, outer, { gap: 'none', surface: { padding: 'none' } });
  }
  // Sin cover → la propia tarjeta lleva el padding.
  return padded;
};

/** Fila "media": [media | (título/subtítulo apilados) | accesorio], con anchos
 *  ajustados (media y accesorio al contenido, texto flexible). */
export function mediaRow(
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

export const RECIPE_PRESETS: Partial<Record<RecipeId, RecipePreset>> = {
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
      // Cabecera FIEL FULL-BLEED (la receta pinta el banner edge-to-edge) +
      // CUERPO en contenedor con padding (la receta usa px-5 en el contenido).
      const headerSlots: Record<string, string> = {};
      for (const r of ['banner', 'avatar', 'title', 'subtitle']) if (has(r)) headerSlots[r] = r;
      const body: LayoutNode[] = []; let br = 1;
      if (has('stats')) body.push({ type: 'component', component: 'stats_row', slots: { stats: 'stats' }, place: { colStart: 1, rowStart: br++ } });
      if (has('body'))  body.push(leaf('body', { colStart: 1, rowStart: br++ }));
      if (has('gallery')) body.push({ type: 'component', component: 'carousel_peek', slots: { images: 'gallery' }, place: { colStart: 1, rowStart: br++ } });
      if (has('related')) body.push({ type: 'component', component: 'ref_gallery', slots: { refs: 'related' }, place: { colStart: 1, rowStart: br++ } });
      const children: LayoutNode[] = [
        { type: 'component', component: 'hero_header', slots: headerSlots, place: { colStart: 1, rowStart: 1 } },
      ];
      if (body.length) {
        children.push({
          ...grid(1, Math.max(1, br - 1), body, { gap: 'md', surface: { padding: 'lg' } }),
          place: { colStart: 1, rowStart: 2 },
        });
      }
      // `surface` en la raíz (aunque sin padding) → el motor NO añade su p-3
      // default: el banner toca los bordes como en la receta.
      return grid(1, children.length, children, { gap: 'none', surface: { padding: 'none' } });
    },
    appearance: {
      banner: { aspect: '16:9' }, avatar: { shape: 'circle' },
      title: { weight: 'bold', size: 'xl', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' },
      body: { size: 'md', truncate: 'none' },
    },
  },
  editorial: {
    // KRO-133 fidelidad — TARJETA con cover full-bleed + contenido p-5 gap-3
    // (= `px-5 py-5 space-y-3` de la receta). Título SERIF, meta MAYÚSCULAS,
    // body con DIVISOR superior (`border-t`) y SIN truncar, galería grid.
    build: (has) => detailCard('cover', ['title', 'meta', 'body', 'gallery'], has, {
      gallery: { component: 'gallery_grid', role: 'images' },
    }, { gap: 'md', borderTopOn: 'body' }),
    appearance: {
      cover: { aspect: '16:9', shape: 'square' },   // rounded-none → flush en la tarjeta
      title: { weight: 'bold', size: 'xl', font: 'serif' },
      meta:  { size: 'sm', textColor: 'muted', textTransform: 'uppercase' },
      // paddingY md = py-2 → los 8px entre el divisor y el texto (pt-2 de la receta).
      body:  { size: 'md', truncate: 'none', paddingY: 'md' },
    },
  },
  momento: {
    // KRO-133 fidelidad — TARJETA centrada con padding (como `MomentoRecipe`).
    // Fecha prominente (NO uppercase) + SEPARADOR corto bajo la fecha (el "hr"
    // de la receta), body sin truncar, slideshow como carrusel centrado.
    build: (has) => detailCard(null, ['date', 'title', 'subtitle', 'body', 'slideshow'], has, {
      slideshow: { component: 'carousel_centered', role: 'images' },
    }, { centered: true, dividerAfter: 'date' }),
    appearance: {
      date: { weight: 'bold', size: 'xl', align: 'center', textColor: 'primary' },
      title: { weight: 'bold', align: 'center' }, subtitle: { size: 'md', textColor: 'muted', align: 'center' },
      body: { size: 'md', truncate: 'none' },
    },
  },
  // V5 (KRO-133) — plantilla de detalle block-native. Misma TARJETA que el resto
  // de detalles. (`detail_panel` "Ficha" eliminada: idéntica a `editorial`.)
  detail_profile: {
    // TARJETA centrada: avatar circular → título → subtítulo → stats (fila) → cuerpo.
    build: (has) => detailCard(null, ['avatar', 'title', 'subtitle', 'stats', 'body'], has, {
      stats: { component: 'stats_row', role: 'stats' },
    }, { centered: true }),
    appearance: {
      avatar:   { shape: 'circle', size: 'xl' },         // círculo grande fijo (con size → no fill)
      title:    { weight: 'bold', size: 'xl', align: 'center' },
      subtitle: { size: 'md', textColor: 'muted', align: 'center' },
      body:     { size: 'md', truncate: 'none' },
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
 * KRO-178 — núcleo compartido: fusiona un `build`+`appearance` (de un preset o
 * de una variante de plantilla) en la composición. Export de módulo (no barrel).
 */
export function composeLayoutPreset(
  composition: ViewComposition,
  preset: Pick<RecipePreset, 'build' | 'appearance'> | undefined,
): ViewComposition {
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

/**
 * Devuelve una composición con `layout` = preset de su receta + apariencias base
 * fusionadas en los slots (las del usuario mandan). Si la receta no tiene preset,
 * cae al grid naíf (`migrateSlotsToGrid`). Lo usa el editor al "Activar diseño
 * por bloques" para partir del diseño REAL de la receta.
 */
export function recipeToComposition(composition: ViewComposition): ViewComposition {
  return composeLayoutPreset(composition, RECIPE_PRESETS[composition.recipe]);
}
