'use client';
/**
 * KRO-133 F2 — Motor de render GENÉRICO del árbol de layout.
 *
 * Interpreta `ViewComposition.layout` (árbol de contenedores flex/grid/stack +
 * hojas = slots) y lo renderiza, en vez de depender del JSX cableado de cada
 * receta. Las hojas reutilizan los building blocks de `recipe-utils` (resolveSlot
 * + primitivas + appearance), así que appearance/accent/foil siguen funcionando.
 *
 * Backward-compat: si la composición NO trae `layout`, el caller (RecipeRenderer)
 * sigue usando los componentes de receta. Cuando llegue `layout` (canvas DnD de
 * F3, o los presets de F5), este motor toma el control. Si por algún path llega
 * sin layout, derivamos uno con `migrateSlotsToLayout` (F1) — nunca crashea.
 *
 * Mobile-first (sin breakpoints). Paridad Flutter (F4) espeja este mapeo.
 */
import { cn } from '../lib/cn';
import {
  resolveSlot, isSlotDisabled, AccentFrame, extractAccentSettings,
  ScalarText, ComposableSlot, ThumbBox, slotDebugAttrs, appearancePaddingClass,
  appearanceTextClasses, appearanceTruncateClass,
  type FieldDefLike,
} from '../recipe-utils';
import {
  migrateSlotsToLayout,
  type LayoutNode, type LayoutContainerNode, type LayoutGap, type LayoutAlign,
  type LayoutJustify, type ViewComposition,
} from '@kromia/core';

// ── Catálogo → clases Tailwind (estáticas: Tailwind no resuelve `gap-${x}`) ──

const GAP_CLASSES: Record<LayoutGap, string> = {
  none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-5',
};
const ALIGN_CLASSES: Record<LayoutAlign, string> = {
  start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch',
};
const JUSTIFY_CLASSES: Record<LayoutJustify, string> = {
  start: 'justify-start', center: 'justify-center', end: 'justify-end',
  between: 'justify-between', around: 'justify-around',
};
// Estáticas para que Tailwind las recoja (1..6).
const GRID_COLS_CLASSES: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
  4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
};

/** Clases del contenedor según su `kind` + props. */
function containerClasses(node: LayoutContainerNode): string {
  const gap = GAP_CLASSES[node.gap ?? 'sm'];
  if (node.kind === 'grid') {
    const cols = GRID_COLS_CLASSES[node.columns ?? 2] ?? GRID_COLS_CLASSES[2];
    return cn('grid', cols, gap, node.align && ALIGN_CLASSES[node.align]);
  }
  if (node.kind === 'stack') {
    // Cascada: todos los hijos en la MISMA celda de un grid 1×1 → se superponen
    // en Z (orden del array = orden de apilado). Sin gap (overlay).
    return 'grid';
  }
  // flex (default).
  const dir = node.direction === 'row' ? 'flex-row' : 'flex-col';
  return cn(
    'flex', dir, gap,
    ALIGN_CLASSES[node.align ?? 'stretch'],
    node.justify && JUSTIFY_CLASSES[node.justify],
  );
}

interface NodeCtx {
  composition: { slots: ViewComposition['slots']; slotOverrides?: ViewComposition['slotOverrides'] };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
}

/** ¿El field del slot es una imagen? (decide caja-imagen vs texto). */
function isImageField(def: FieldDefLike | undefined): boolean {
  return def?.type === 'image' || def?.type === 'array<image>';
}

/** Render de una hoja (slot). Elige primitiva por el TIPO del field. */
function SlotLeaf({ slot, ctx }: { slot: string; ctx: NodeCtx }) {
  if (isSlotDisabled(ctx.composition, slot)) return null;
  const resolved = resolveSlot(ctx.composition, slot, ctx.fieldDefs, ctx.item);
  if (!resolved) return null; // slot opcional sin datos → no se pinta

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
      {isComposable
        ? <ComposableSlot slot={resolved} />
        : <ScalarText value={first?.value} def={first?.def} appearance={resolved.appearance} />}
    </div>
  );
}

/** Render recursivo de un nodo del árbol. */
function LayoutNodeView({ node, ctx }: { node: LayoutNode; ctx: NodeCtx }) {
  if (node.type === 'slot') return <SlotLeaf slot={node.slot} ctx={ctx} />;

  const isStack = node.kind === 'stack';
  return (
    <div className={containerClasses(node)}>
      {node.children.map((child, i) => {
        const grow = child.type === 'slot' && typeof child.grow === 'number' && child.grow > 0
          ? { flexGrow: child.grow }
          : undefined;
        return (
          <div
            key={i}
            // Stack: cada hijo en la misma celda (1/1) → superposición en Z.
            className={cn(isStack && 'col-start-1 row-start-1', grow && 'min-w-0')}
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
          'bg-card p-3',
          clickable && 'cursor-pointer transition-colors rounded-lg',
          className,
        )}
      >
        <LayoutNodeView node={root} ctx={ctx} />
      </div>
    </AccentFrame>
  );
}
