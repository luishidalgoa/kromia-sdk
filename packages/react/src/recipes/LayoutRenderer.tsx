'use client';
/**
 * KRO-133 F2/F3 — Motor de render GENÉRICO del árbol de layout.
 *
 * Interpreta `ViewComposition.layout` (árbol de contenedores + hojas = slots) y
 * lo renderiza. Modelo CENTRADO EN GRID 2D (F3): un contenedor `grid` con
 * columnas/filas, donde cada hijo puede ocupar una celda concreta + span
 * (`place`). Flex y stack se mantienen para compat/migración baseline.
 *
 * Las hojas reutilizan los building blocks de `recipe-utils` (resolveSlot +
 * primitivas + appearance), así que appearance/accent/foil siguen funcionando.
 * El render de una celda se exporta como `SlotContent` para que el editor visual
 * de Studio (F3) pinte el lienzo con el MISMO resultado que la app real.
 *
 * **Sin overflow** (requisito del producto): la raíz y cada celda recortan
 * (`overflow-hidden`), y el grid usa `minmax(0,1fr)` (Tailwind `grid-cols-N`)
 * para que ningún hijo desborde el contenedor principal.
 *
 * Backward-compat: si la composición NO trae `layout`, el caller (RecipeRenderer)
 * usa los componentes de receta. Si llega sin layout, se deriva con
 * `migrateSlotsToLayout`. Mobile-first (sin breakpoints). Paridad Flutter (F4).
 */
import { cn } from '../lib/cn';
import {
  resolveSlot, isSlotDisabled, AccentFrame, extractAccentSettings,
  ScalarText, ComposableSlot, ThumbBox, BadgePill, slotDebugAttrs, appearancePaddingClass,
  appearanceTextClasses, appearanceTruncateClass,
  type FieldDefLike,
} from '../recipe-utils';
import {
  migrateSlotsToLayout, paletteClass,
  type LayoutNode, type LayoutContainerNode, type LayoutGap, type LayoutAlign,
  type LayoutJustify, type GridPlacement, type ContainerSurface, type SurfaceBorder, type ViewComposition,
} from '@kromia/core';

// ── Catálogo → clases Tailwind (estáticas: Tailwind no resuelve `gap-${x}`) ──

const GAP_CLASSES: Record<LayoutGap, string> = {
  none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-5',
};
const ALIGN_ITEMS_CLASSES: Record<LayoutAlign, string> = {
  start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch',
};
// flex justify-content (eje principal).
const JUSTIFY_CONTENT_CLASSES: Record<LayoutJustify, string> = {
  start: 'justify-start', center: 'justify-center', end: 'justify-end',
  between: 'justify-between', around: 'justify-around',
};
// grid justify-items (alineación inline del contenido de cada celda).
const JUSTIFY_ITEMS_CLASSES: Partial<Record<LayoutJustify, string>> = {
  start: 'justify-items-start', center: 'justify-items-center', end: 'justify-items-end',
};
// Estáticas para que Tailwind las recoja.
const GRID_COLS_CLASSES: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
  4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
};
const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3',
  4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6',
};
const COL_START_CLASSES: Record<number, string> = {
  1: 'col-start-1', 2: 'col-start-2', 3: 'col-start-3',
  4: 'col-start-4', 5: 'col-start-5', 6: 'col-start-6', 7: 'col-start-7',
};
const ROW_SPAN_CLASSES: Record<number, string> = {
  1: 'row-span-1', 2: 'row-span-2', 3: 'row-span-3',
  4: 'row-span-4', 5: 'row-span-5', 6: 'row-span-6',
};
const ROW_START_CLASSES: Record<number, string> = {
  1: 'row-start-1', 2: 'row-start-2', 3: 'row-start-3',
  4: 'row-start-4', 5: 'row-start-5', 6: 'row-start-6', 7: 'row-start-7',
};

/** Clases del contenedor según su `kind` + props. */
function containerClasses(node: LayoutContainerNode): string {
  const gap = GAP_CLASSES[node.gap ?? 'sm'];
  if (node.kind === 'grid') {
    const cols = GRID_COLS_CLASSES[node.columns ?? 2] ?? GRID_COLS_CLASSES[2];
    // Filas AJUSTADAS AL CONTENIDO (auto), no iguales: cada fila mide lo que
    // pide su contenido (un row de texto no se infla a la altura de la imagen).
    // El rowSpan sigue funcionando (abarca varias filas implícitas). 'equal'
    // fuerza filas iguales (1fr) cuando el publisher lo pide explícitamente.
    const rowSizing = node.rowSize === 'equal' ? 'auto-rows-fr' : 'auto-rows-auto';
    return cn(
      'grid min-w-0', cols, rowSizing, gap,
      ALIGN_ITEMS_CLASSES[node.align ?? 'stretch'],
      node.justify && JUSTIFY_ITEMS_CLASSES[node.justify],
    );
  }
  if (node.kind === 'stack') {
    // Cascada: todos los hijos en la MISMA celda de un grid 1×1 → se superponen
    // en Z (orden del array = orden de apilado). Sin gap (overlay).
    return 'grid min-w-0';
  }
  // flex (default).
  const dir = node.direction === 'row' ? 'flex-row' : 'flex-col';
  return cn(
    'flex min-w-0', dir, gap,
    ALIGN_ITEMS_CLASSES[node.align ?? 'stretch'],
    node.justify && JUSTIFY_CONTENT_CLASSES[node.justify],
  );
}

/** Clases de colocación de un hijo dentro de un grid padre (celda + span). */
function placementClasses(place: GridPlacement | undefined): string | undefined {
  if (!place) return undefined;
  return cn(
    place.colStart && COL_START_CLASSES[place.colStart],
    place.colSpan && COL_SPAN_CLASSES[place.colSpan],
    place.rowStart && ROW_START_CLASSES[place.rowStart],
    place.rowSpan && ROW_SPAN_CLASSES[place.rowSpan],
  );
}

// Auto-alineación del elemento dentro de su celda (KRO-133 F3).
const JUSTIFY_SELF_CLASSES: Record<LayoutAlign, string> = {
  start: 'justify-self-start', center: 'justify-self-center', end: 'justify-self-end', stretch: 'justify-self-stretch',
};
const ALIGN_SELF_CLASSES: Record<LayoutAlign, string> = {
  start: 'self-start', center: 'self-center', end: 'self-end', stretch: 'self-stretch',
};
function selfAlignClasses(place: GridPlacement | undefined): string | undefined {
  if (!place) return undefined;
  return cn(
    place.justifySelf && JUSTIFY_SELF_CLASSES[place.justifySelf],
    place.alignSelf && ALIGN_SELF_CLASSES[place.alignSelf],
  );
}

// Decoración RICA del contenedor (KRO-133 F3) — presets cerrados → clases
// Tailwind estáticas (literales para que el scanner las recoja).
const SURFACE_BG_CLASSES:      Record<NonNullable<ContainerSurface['background']>, string> = {
  none: '', card: 'bg-card', muted: 'bg-muted', accent: 'bg-accent', primary: 'bg-primary/10',
};
const SURFACE_RADIUS_CLASSES:  Record<NonNullable<ContainerSurface['radius']>, string> = {
  none: 'rounded-none', sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', full: 'rounded-full',
};
const SURFACE_SHADOW_CLASSES:  Record<NonNullable<ContainerSurface['shadow']>, string> = {
  none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg', xl: 'shadow-xl',
};
const SURFACE_PADDING_CLASSES: Record<NonNullable<ContainerSurface['padding']>, string> = {
  none: 'p-0', xs: 'p-1', sm: 'p-2', md: 'p-3', lg: 'p-5', xl: 'p-8',
};
// Borde atómico: matriz lado × grosor (clases literales) + color + estilo.
type BSide  = NonNullable<SurfaceBorder['side']>;
type BWidth = NonNullable<SurfaceBorder['width']>;
const BORDER_WIDTH_BY_SIDE: Record<BSide, Record<BWidth, string>> = {
  all:    { thin: 'border',   medium: 'border-2',   thick: 'border-4' },
  top:    { thin: 'border-t', medium: 'border-t-2', thick: 'border-t-4' },
  bottom: { thin: 'border-b', medium: 'border-b-2', thick: 'border-b-4' },
  left:   { thin: 'border-l', medium: 'border-l-2', thick: 'border-l-4' },
  right:  { thin: 'border-r', medium: 'border-r-2', thick: 'border-r-4' },
  x:      { thin: 'border-x', medium: 'border-x-2', thick: 'border-x-4' },
  y:      { thin: 'border-y', medium: 'border-y-2', thick: 'border-y-4' },
};
const BORDER_STYLE_CLASSES: Record<NonNullable<SurfaceBorder['style']>, string> = {
  solid: 'border-solid', dashed: 'border-dashed', dotted: 'border-dotted',
};
function borderClasses(b: SurfaceBorder | undefined): string | undefined {
  if (!b || !b.width) return undefined; // sin grosor → sin borde
  return cn(
    BORDER_WIDTH_BY_SIDE[b.side ?? 'all'][b.width],
    paletteClass(b.color ?? 'border', 'border'),  // color de la paleta amplia
    b.style && BORDER_STYLE_CLASSES[b.style],
  );
}

/**
 * Clases Tailwind de la decoración de un contenedor. Exportada (como
 * `containerSurfaceClasses`) para que el editor visual de Studio pinte el lienzo
 * con EXACTAMENTE el mismo resultado que la app — una sola fuente de verdad.
 */
function surfaceClasses(s: ContainerSurface | undefined): string | undefined {
  if (!s) return undefined;
  // bgColor (paleta amplia) prevalece sobre el token semántico `background`.
  const bg = s.bgColor ? paletteClass(s.bgColor, 'bg') : (s.background && SURFACE_BG_CLASSES[s.background]);
  return cn(
    bg,
    borderClasses(s.border),
    s.radius && SURFACE_RADIUS_CLASSES[s.radius],
    s.shadow && SURFACE_SHADOW_CLASSES[s.shadow],
    s.padding && SURFACE_PADDING_CLASSES[s.padding],
  );
}
export { surfaceClasses as containerSurfaceClasses };

interface NodeCtx {
  composition: { slots: ViewComposition['slots']; slotOverrides?: ViewComposition['slotOverrides'] };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
}

/** ¿El field del slot es una imagen? (decide caja-imagen vs texto). */
function isImageField(def: FieldDefLike | undefined): boolean {
  return def?.type === 'image' || def?.type === 'array<image>';
}

export interface SlotContentProps {
  slot:        string;
  composition: { slots: ViewComposition['slots']; slotOverrides?: ViewComposition['slotOverrides'] };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
}

/**
 * Render del CONTENIDO de un slot (imagen o texto), honrando appearance.
 * Exportado para que el editor visual de Studio (F3) pinte cada celda del
 * lienzo con el mismo resultado que el motor de render. Devuelve null si el
 * slot está deshabilitado o no resuelve a datos.
 */
export function SlotContent({ slot, composition, item, fieldDefs }: SlotContentProps) {
  if (isSlotDisabled(composition, slot)) return null;
  const resolved = resolveSlot(composition, slot, fieldDefs, item);
  if (!resolved) return null;

  const first = resolved.fields[0];

  // Imagen: caja honrando appearance (shape/aspect/size). `array<image>` → 1ª url.
  if (isImageField(first?.def)) {
    const raw = first?.value;
    const url = Array.isArray(raw) ? (raw[0] as string | undefined) : (raw as string | undefined);
    return (
      <div className={appearancePaddingClass(resolved.appearance)} {...slotDebugAttrs(slot, resolved)}>
        <ThumbBox url={url} alt={String(first?.value ?? '')} appearance={resolved.appearance} />
      </div>
    );
  }

  // Texto: composable (varios fields / vertical) vs escalar simple.
  const isComposable = resolved.fields.length > 1 || resolved.orientation === 'vertical';
  const content = isComposable
    ? <ComposableSlot slot={resolved} />
    : <ScalarText value={first?.value} def={first?.def} appearance={resolved.appearance} />;

  // display:'badge' → pill/chip (rareza/tipo "Fuego"/"Agua"). Honra el tamaño
  // (appearance.size) vía appearanceTextClasses dentro del pill.
  if (resolved.appearance?.display === 'badge') {
    return (
      <div className={appearancePaddingClass(resolved.appearance)} {...slotDebugAttrs(slot, resolved)}>
        <BadgePill className={appearanceTextClasses(resolved.appearance)}>{content}</BadgePill>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-w-0',
        !resolved.appearance?.truncate && 'truncate',
        appearancePaddingClass(resolved.appearance),
        appearanceTextClasses(resolved.appearance),
        appearanceTruncateClass(resolved.appearance),
      )}
      {...slotDebugAttrs(slot, resolved)}
    >
      {content}
    </div>
  );
}

/** Render de una hoja (slot) dentro del árbol. */
function SlotLeaf({ slot, ctx }: { slot: string; ctx: NodeCtx }) {
  return <SlotContent slot={slot} composition={ctx.composition} item={ctx.item} fieldDefs={ctx.fieldDefs} />;
}

/** Render recursivo de un nodo del árbol. */
function LayoutNodeView({ node, ctx }: { node: LayoutNode; ctx: NodeCtx }) {
  if (node.type === 'slot') return <SlotLeaf slot={node.slot} ctx={ctx} />;

  const isStack = node.kind === 'stack';
  const isGrid  = node.kind === 'grid';
  return (
    <div className={cn(containerClasses(node), surfaceClasses(node.surface))}>
      {node.children.map((child, i) => {
        // grow solo aplica en flex; en grid el tamaño lo da el span.
        const grow = !isGrid && child.type === 'slot' && typeof child.grow === 'number' && child.grow > 0
          ? { flexGrow: child.grow }
          : undefined;
        const placement = isGrid ? placementClasses(child.place) : undefined;
        const selfAlign = isGrid ? selfAlignClasses(child.place) : undefined;
        return (
          <div
            key={i}
            // min-w-0 + overflow-hidden: ninguna celda desborda el contenedor.
            // Stack: cada hijo en la misma celda (1/1) → superposición en Z.
            className={cn('min-w-0 min-h-0 overflow-hidden', isStack && 'col-start-1 row-start-1', placement, selfAlign)}
            style={grow}
          >
            <LayoutNodeView node={child} ctx={ctx} />
          </div>
        );
      })}
    </div>
  );
}

export interface LayoutRendererProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  onClick?:    () => void;
  className?:  string;
}

/**
 * Punto de entrada del motor de layout. Renderiza `composition.layout` (o el
 * árbol derivado de los slots si no lo trae) dentro del AccentFrame de la receta.
 */
export function LayoutRenderer({
  composition, item, fieldDefs, onClick, className,
}: LayoutRendererProps) {
  const root: LayoutContainerNode = composition.layout ?? migrateSlotsToLayout(composition);
  const accent  = extractAccentSettings(composition, item, fieldDefs, 'top');
  const ctx: NodeCtx = { composition, item, fieldDefs };
  const clickable = !!onClick;

  return (
    <AccentFrame accent={accent} width={3}>
      <div
        onClick={onClick}
        className={cn(
          // overflow-hidden en la raíz: nada sobresale del contenedor principal.
          'bg-card p-3 overflow-hidden',
          clickable && 'cursor-pointer transition-colors rounded-lg',
          className,
        )}
      >
        <LayoutNodeView node={root} ctx={ctx} />
      </div>
    </AccentFrame>
  );
}
