'use client';
/**
 * Helpers compartidos por los componentes de receta — resolución de slots,
 * formatting por behavior, fallbacks.
 *
 * Las recetas usan estos helpers en lugar de duplicar lógica de cómo
 * renderizar un field específico (e.g. una image con behavior avatar vs
 * con behavior cover). Centralizar aquí evita inconsistencias entre
 * recetas y prepara terreno para la paridad con Flutter (mismo mapping
 * behavior → estilo visual).
 */

// KRO-82 — recipe-utils.tsx migrado al package SDK @kromia/react.
// `cn()` ahora viene del helper local del package (clsx + tailwind-merge).
// Tipos `SlotAppearance` / `SlotComposition` vienen de `@kromia/core`
// (eran duplicación con Studio's `./types`, ahora source-of-truth única).
import { cn } from './lib/cn';
import { cloneElement, isValidElement, Fragment } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { isMockupImage,
  formatScalar             as sdkFormatScalar,
  extractAccentSettings    as sdkExtractAccentSettings,
  composeSlotValues,
  paletteClass,
  resolveConditionalStyling,
  parseInlineMarkdown,
  parseInlineHtml,
  type MarkdownToken,
  getCardImageTransform,
  type FieldDefLike         as SdkFieldDefLike,
  type AccentSettings       as SdkAccentSettings,
  type SlotAppearance,
  type SlotComposition,
  type GridPlacement,
  type LayoutGap,
  type ImageTransform,
} from '@kromia/core';

// KRO-73 — Re-export desde el SDK: FieldDefLike + AccentSettings + helpers
// puros viven en `@kromia/core`. Estos re-exports mantienen los imports
// existentes (`from './recipe-utils'`) sin romper consumers.
export type FieldDefLike    = SdkFieldDefLike;
export type AccentSettings  = SdkAccentSettings;
export const formatScalar          = sdkFormatScalar;
export const extractAccentSettings = sdkExtractAccentSettings;

/**
 * Resuelve los fields de un slot a su valor + meta. Devuelve undefined si
 * el slot no existe en la composition o no tiene fields asignados — para
 * que el caller pueda saltar el slot opcional con `if (!resolved) return`.
 */
export interface ResolvedSlot {
  fields: Array<{
    key:   string;
    def:   FieldDefLike | undefined;
    value: any;
  }>;
  orientation: 'horizontal' | 'vertical';
  separator:   string;
  /** KRO-198 — variante de render del composable (auto/inline/list/chips/table).
   *  'auto' (default) preserva el comportamiento histórico (behavior-driven). */
  composableDisplay: NonNullable<SlotComposition['composableDisplay']>;
  /** KRO-69 V6 — Appearance override per-instance. Las recetas pasan esto
   *  a los componentes utility (AvatarBox, ScalarText, etc.) que lo
   *  traducen a clases CSS. undefined o props undefined → fallback al
   *  estilo default del componente. */
  appearance?: SlotAppearance;
  /** KRO-198 — apariencia POR-FIELD (key → SlotAppearance) para slots composable.
   *  Se merge-a sobre `appearance` por cada field. Solo la consume ComposableSlot. */
  fieldAppearances?: Record<string, SlotAppearance>;
  /** KRO-198 — rejilla 2D opcional de los chips (columns + gap). Presente = el render
   *  de chips pasa de flex-wrap a CSS grid; cada chip se coloca con chipPlacements. */
  chipGrid?: SlotComposition['chipGrid'];
  /** KRO-198 — posición (GridPlacement) de cada chip dentro de chipGrid, key = field. */
  chipPlacements?: Record<string, GridPlacement>;
}

export function resolveSlot(
  composition: { slots: Record<string, SlotComposition> } | undefined,
  slotId:      string,
  fieldDefs:   FieldDefLike[],
  item:        Record<string, any>,
): ResolvedSlot | undefined {
  const sc = composition?.slots?.[slotId];
  if (!sc || sc.fields.length === 0) return undefined;

  const defMap     = new Map(fieldDefs.map(d => [d.key, d]));
  // KRO-54 follow-up: el orden en el que aparecen los fields en cada slot
  // composable se deriva del orden de `fieldDefs` (= `section.fields` del
  // wizard / álbum), NO del orden en el que el publisher los añadió al slot.
  // Source of truth única: la estructura de la sección. Si el publisher
  // dragea fields en "Campos de la sección" para reordenarlos, todos los
  // renders (list + detail + nested) reflejan el nuevo orden automáticamente
  // — sin necesidad de re-editar cada slot composition.
  //
  // Fields del slot que NO están en fieldDefs (caso edge: schema legacy o
  // field renombrado) van al final con Number.MAX_SAFE_INTEGER.
  const orderMap = new Map(fieldDefs.map((d, idx) => [d.key, idx]));
  const fields   = sc.fields.map(key => ({
    key,
    def:   defMap.get(key),
    value: item[key],
  }));
  fields.sort((a, b) => {
    const ai = orderMap.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderMap.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  // Si todos los valores están vacíos (null/undefined/'') tratamos el slot
  // como inexistente — un slot opcional debe ocultarse cuando no hay datos
  // que mostrar, no quedar como un hueco visual.
  const hasAnyValue = fields.some(f => !isEmpty(f.value));
  if (!hasAnyValue) return undefined;

  // KRO-198 v2 — estilo condicional por valor con TARGET por chip (punto único):
  //  - caso CON `target` (chips) → su apariencia se mergea en fieldAppearances[targetKeys]
  //    GANANDO sobre la apariencia por-chip (el "caso que coincide manda"); la base queda.
  //  - caso SIN `target` (o slot single-scalar) → se mergea sobre la BASE de toda la fila
  //    (retro-compat; ScalarText solo lee la base, no fieldAppearances).
  // KRO-198 — `resolveConditionalStyling` (no `matchedConditionalCase`) → contempla el
  // `otherwise` (else): si ningún caso coincide pero hay cláusula else, manda su
  // apariencia/target con el MISMO scoping por-chip que un caso.
  const condCase = resolveConditionalStyling(sc.conditionalStyle, item);
  const condAp   = condCase?.appearance;
  const targets  = (condCase?.target ?? []).filter(Boolean);
  const appearance = (condAp && targets.length === 0)
    ? { ...(sc.appearance ?? {}), ...condAp }
    : sc.appearance;
  let fieldAppearances = sc.fieldAppearances;
  if (condAp && targets.length > 0) {
    fieldAppearances = { ...(fieldAppearances ?? {}) };
    for (const k of targets) fieldAppearances[k] = { ...(fieldAppearances[k] ?? {}), ...condAp };
  }

  return {
    fields,
    orientation:       sc.orientation ?? 'horizontal',
    separator:         sc.separator   ?? ' · ',
    composableDisplay: sc.composableDisplay ?? 'auto',
    appearance,
    // apariencia por-field (la consume ComposableSlot/chips_row para colorear cada chip).
    fieldAppearances,
    // KRO-198 — rejilla 2D de chips (columns+gap) + posición por chip (GridPlacement).
    chipGrid:       sc.chipGrid,
    chipPlacements: sc.chipPlacements,
  };
}

/**
 * True si el slot está DESACTIVADO per-instance vía `slotOverrides.disabled`
 * (KRO-58 V5). Las recetas lo usan para NO renderizar un slot que el publisher
 * ocultó conscientemente — incluso si es un slot "obligatorio" del manifest
 * (avatar/thumb/cover, que de otro modo pintan un placeholder/iniciales aunque
 * no haya datos). Cierra el bucle editor → validador → renderer:
 *   - el editor permite desactivar incluso un slot required,
 *   - `validateComposition` lo excluye (no avisa),
 *   - y el renderer no lo pinta.
 */
export function isSlotDisabled(
  composition: { slotOverrides?: { disabled?: string[] } } | undefined,
  slotId:      string,
): boolean {
  return composition?.slotOverrides?.disabled?.includes(slotId) ?? false;
}

// ── KRO-198 — colocación 2D en CSS Grid (compartida motor de bloques ↔ chips) ──
//
// Las MISMAS clases col/row que usa el contenedor (LayoutRenderer las importa de
// aquí) para colocar cada CHIP dentro de la rejilla del slot (`chipGrid`). Literales
// para que el scanner de Tailwind las recoja. 1-based (CSS Grid nativo, portable a
// Flutter). Sin colStart/rowStart = auto-flow a la siguiente celda libre.
const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6',
};
const COL_START_CLASSES: Record<number, string> = {
  1: 'col-start-1', 2: 'col-start-2', 3: 'col-start-3', 4: 'col-start-4', 5: 'col-start-5', 6: 'col-start-6', 7: 'col-start-7',
};
const ROW_SPAN_CLASSES: Record<number, string> = {
  1: 'row-span-1', 2: 'row-span-2', 3: 'row-span-3', 4: 'row-span-4', 5: 'row-span-5', 6: 'row-span-6',
};
const ROW_START_CLASSES: Record<number, string> = {
  1: 'row-start-1', 2: 'row-start-2', 3: 'row-start-3', 4: 'row-start-4', 5: 'row-start-5', 6: 'row-start-6', 7: 'row-start-7',
};
const CHIP_GRID_GAP_CLASSES: Record<LayoutGap, string> = {
  none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-5',
};

/** KRO-198 — `justify-self` del CHIP dentro de su celda de la rejilla. Controla el
 *  ANCHO + posición: por defecto (sin align) el chip es grid-item con justify-self
 *  stretch → LLENA la celda (como la app). Con `align`, pasa a content-fit (se ajusta
 *  al contenido) y se posiciona izq/centro/der. Literales para el scanner de Tailwind. */
const CHIP_JUSTIFY_SELF: Record<NonNullable<SlotAppearance['align']>, string> = {
  left:   'justify-self-start',
  center: 'justify-self-center',
  right:  'justify-self-end',
};
/** Clase justify-self del chip según su align (solo tiene efecto en rejilla). '' si
 *  no hay align → el chip estira (llena la celda). */
export function chipJustifySelf(align: SlotAppearance['align'] | undefined): string | undefined {
  return align ? CHIP_JUSTIFY_SELF[align] : undefined;
}

/** Clases de colocación de un elemento dentro de un grid padre (celda + span).
 *  Compartida por el contenedor (hijos) y por los CHIPS de un slot con `chipGrid`. */
export function placementClasses(place: GridPlacement | undefined): string | undefined {
  if (!place) return undefined;
  return cn(
    place.colStart && COL_START_CLASSES[place.colStart],
    place.colSpan && COL_SPAN_CLASSES[place.colSpan],
    place.rowStart && ROW_START_CLASSES[place.rowStart],
    place.rowSpan && ROW_SPAN_CLASSES[place.rowSpan],
  );
}

/** KRO-198 — wrapper de la rejilla de chips: clase (`inline-grid w-full` + gap) y
 *  estilo inline (`grid-template-columns: repeat(N, minmax(0,1fr))`). El template va
 *  inline porque el nº de columnas es dinámico (Tailwind no resuelve `grid-cols-${n}`).
 *  `inline-grid` (no `grid`) = phrasing-safe dentro de `<p>` (el Subtítulo composable);
 *  `w-full` hace que las columnas `1fr` repartan el ancho disponible. */
export function chipGridWrapperClass(grid: { gap?: LayoutGap }): string {
  return cn('inline-grid w-full', CHIP_GRID_GAP_CLASSES[grid.gap ?? 'sm']);
}
export function chipGridTemplateStyle(grid: { columns: number }): CSSProperties {
  return { gridTemplateColumns: `repeat(${Math.max(1, grid.columns)}, minmax(0, 1fr))` };
}

// ── KRO-69 V6 — Appearance → Tailwind classes ─────────────────────────────
//
// Helpers que traducen `SlotAppearance` (presets) a clases CSS Tailwind.
// Cada componente utility recibe la appearance y aplica las clases
// relevantes a su wrapper / contenido. Si una prop está undefined, el
// componente sigue su comportamiento default.

const SHAPE_CLASSES: Record<NonNullable<SlotAppearance['shape']>, string> = {
  circle:  'rounded-full',
  square:  'rounded-none',
  rounded: 'rounded-lg',
};

const ASPECT_CLASSES: Record<NonNullable<SlotAppearance['aspect']>, string> = {
  '1:1':  'aspect-square',
  '16:9': 'aspect-video',
  '4:3':  'aspect-[4/3]',
  '3:4':  'aspect-[3/4]',
  '9:16': 'aspect-[9/16]',
  'free': '',
};

const ALIGN_CLASSES: Record<NonNullable<SlotAppearance['align']>, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
};

const WEIGHT_CLASSES: Record<NonNullable<SlotAppearance['weight']>, string> = {
  regular:  'font-normal',
  semibold: 'font-semibold',
  bold:     'font-bold',
};

const TEXT_SIZE_CLASSES: Record<NonNullable<SlotAppearance['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

/** Multiplicador del size base del componente (avatar/thumb). El recipe
 *  pasa su size default (ej. 48 para avatar) y el helper lo escala. */
const SIZE_MULTIPLIER: Record<NonNullable<SlotAppearance['size']>, number> = {
  sm: 0.7,
  md: 1.0,
  lg: 1.4,
  xl: 1.8,
};

const PADDING_Y_CLASSES: Record<NonNullable<SlotAppearance['paddingY']>, string> = {
  none: 'py-0',
  sm:   'py-1',
  md:   'py-2',
  lg:   'py-4',
};
// KRO-198 — relleno POR LADO del slot: matriz lado × tamaño (escala de 4 del slot,
// mismas magnitudes que PADDING_Y_CLASSES por eje). Literales para el scanner de Tailwind.
type SlotPSide = 'top' | 'right' | 'bottom' | 'left';
type SlotPSize = NonNullable<SlotAppearance['paddingSides']>[SlotPSide];
const SLOT_PADDING_BY_SIDE: Record<SlotPSide, Record<NonNullable<SlotPSize>, string>> = {
  top:    { none: 'pt-0', sm: 'pt-1', md: 'pt-2', lg: 'pt-4' },
  right:  { none: 'pr-0', sm: 'pr-1', md: 'pr-2', lg: 'pr-4' },
  bottom: { none: 'pb-0', sm: 'pb-1', md: 'pb-2', lg: 'pb-4' },
  left:   { none: 'pl-0', sm: 'pl-1', md: 'pl-2', lg: 'pl-4' },
};

// KRO-147 F3 — tipografía rica + efectos. Todas LITERALES → safelist
// automático por @source (no construidas dinámicamente).
const LINE_HEIGHT_CLASSES: Record<NonNullable<SlotAppearance['lineHeight']>, string> = {
  tight:   'leading-tight',
  normal:  'leading-normal',
  relaxed: 'leading-relaxed',
};
const TRACKING_CLASSES: Record<NonNullable<SlotAppearance['tracking']>, string> = {
  tight:  'tracking-tight',
  normal: 'tracking-normal',
  wide:   'tracking-wide',
};
// KRO-155 — sombra del TEXTO (legibilidad sobre imágenes). Valores arbitrarios
// literales → el scanner de Tailwind (@source cubre @kromia/react) los recoge.
const TEXT_SHADOW_CLASSES: Record<NonNullable<SlotAppearance['textShadow']>, string> = {
  none: '',
  sm:   '[text-shadow:0_1px_2px_rgb(0_0_0_/_0.5)]',
  md:   '[text-shadow:0_2px_4px_rgb(0_0_0_/_0.7)]',
};
const OPACITY_CLASSES: Record<NonNullable<SlotAppearance['opacity']>, string> = {
  '100': 'opacity-100',
  '90':  'opacity-90',
  '75':  'opacity-75',
  '50':  'opacity-50',
};
const SLOT_SHADOW_CLASSES: Record<NonNullable<SlotAppearance['shadow']>, string> = {
  none: 'shadow-none',
  sm:   'shadow-sm',
  md:   'shadow-md',
  lg:   'shadow-lg',
};

/** Devuelve la clase de forma o '' si no hay override. */
export function appearanceShapeClass(a: SlotAppearance | undefined): string {
  return a?.shape ? SHAPE_CLASSES[a.shape] : '';
}
/** Devuelve la clase de aspect ratio o '' si no hay override. */
export function appearanceAspectClass(a: SlotAppearance | undefined): string {
  return a?.aspect ? ASPECT_CLASSES[a.aspect] : '';
}
/** Devuelve clases de texto (align + weight + size) o '' si no hay overrides.
 *  Aplicar en el ELEMENTO BLOQUE padre del contenido inline (ej. <p>, <h2>,
 *  <div>) — text-align en un span inline no produce alineación visible. */
export function appearanceTextClasses(a: SlotAppearance | undefined): string {
  if (!a) return '';
  return cn(
    a.align  && ALIGN_CLASSES[a.align],
    a.weight && WEIGHT_CLASSES[a.weight],
    // KRO-133 — MAYÚSCULAS estilo etiqueta/meta (Editorial, Momento).
    a.textTransform === 'uppercase' && 'uppercase tracking-wider',
    // KRO-133 — familia tipográfica (serif para títulos editoriales).
    // KRO-198 — `sans` DEBE mapear a `font-sans` explícito (la tipografía de la app,
    // Inter): si no, elegir "Sans" no quitaba el `font-serif` HEREDADO del padre → la
    // opción no tenía efecto. Además, Inter sí tiene peso 600 → Semi≠Bold (el serif no).
    a.font === 'serif' && 'font-serif',
    a.font === 'sans' && 'font-sans',
    a.size   && TEXT_SIZE_CLASSES[a.size],
    // KRO-147 F3 — tipografía rica. `tracking` va DESPUÉS del tracking-wider
    // implícito de uppercase para que, si el publisher lo fija, gane (cn/merge).
    a.italic && 'italic',
    a.underline && 'underline underline-offset-2',
    a.lineHeight && LINE_HEIGHT_CLASSES[a.lineHeight],
    a.tracking   && TRACKING_CLASSES[a.tracking],
    // KRO-155 — sombra del texto (legibilidad sobre imágenes).
    a.textShadow && TEXT_SHADOW_CLASSES[a.textShadow],
    // KRO-133 F3 — color de texto/fondo de la paleta amplia (cerrada).
    a.textColor && paletteClass(a.textColor, 'text'),
    a.bgColor   && paletteClass(a.bgColor, 'bg'),
  );
}

/**
 * KRO-198 — apariencia EFECTIVA de un field dentro de un slot composable: la base
 * del slot (`appearance`) MERGE-ada con la apariencia del field concreto
 * (`fieldAppearances[key]`). Sin entrada por-field (o sin key) → la base tal cual.
 * Punto único del merge → ComposableSlot y el componente StatsRow aplican la MISMA
 * apariencia por chip/estadística (color, tipografía, recorte, caja…), sin drift.
 */
export function mergeFieldAppearance(
  appearance:       SlotAppearance | undefined,
  fieldAppearances: Record<string, SlotAppearance> | undefined,
  key:              string | undefined,
): SlotAppearance | undefined {
  return (key && fieldAppearances?.[key]) ? { ...appearance, ...fieldAppearances[key] } : appearance;
}

/** KRO-198 — clases de SOLO color (bg/text) de la apariencia efectiva de un field.
 *  Atajo sobre `mergeFieldAppearance` para los callers que solo necesitan el tono. */
export function fieldColorClasses(
  appearance:       SlotAppearance | undefined,
  fieldAppearances: Record<string, SlotAppearance> | undefined,
  key:              string | undefined,
): { bg: string; text: string } {
  const ap = mergeFieldAppearance(appearance, fieldAppearances, key);
  return { bg: paletteClass(ap?.bgColor, 'bg'), text: paletteClass(ap?.textColor, 'text') };
}

/** KRO-147 F3 — clases de EFECTO del slot (opacity + shadow), aplicables al
 *  wrapper de cualquier slot (imagen, badge, texto). '' si no hay overrides. */
export function appearanceEffectClasses(a: SlotAppearance | undefined): string {
  if (!a) return '';
  return cn(
    a.opacity && OPACITY_CLASSES[a.opacity],
    a.shadow  && SLOT_SHADOW_CLASSES[a.shadow],
  );
}

/** KRO-147 F3 — clase de object-fit de una imagen. Default 'cover' (recorta
 *  con punto focal); 'contain' encaja entera. */
export function appearanceObjectFitClass(a: SlotAppearance | undefined): string {
  return a?.objectFit === 'contain' ? 'object-contain' : 'object-cover';
}
/** KRO-198 — clases de relleno del wrapper del slot. Si `paddingSides` existe
 *  PREVALECE (cada lado su tamaño, ausente = none); si no, el `paddingY` vertical.
 *  '' si no hay override. */
export function appearancePaddingClass(a: SlotAppearance | undefined): string {
  if (a?.paddingSides) {
    return (['top', 'right', 'bottom', 'left'] as const)
      .map(sd => SLOT_PADDING_BY_SIDE[sd][a.paddingSides![sd] ?? 'none'])
      .join(' ');
  }
  return a?.paddingY ? PADDING_Y_CLASSES[a.paddingY] : '';
}

/** KRO-198 — clase de text-align del slot, para aplicar al ELEMENTO BLOQUE padre.
 *  appearanceTextClasses ya incluye el align, pero un `badge` es `inline-flex`:
 *  text-align en la propia pastilla NO la mueve; en su `<div>` block SÍ alinea la
 *  pastilla inline. '' si no hay align. */
export function appearanceAlignClass(a: SlotAppearance | undefined): string {
  return a?.align ? ALIGN_CLASSES[a.align] : '';
}

/** Devuelve la clase de truncado de líneas, o '' si no hay override.
 *
 *  - '1'    → `line-clamp-1`   (una sola línea con ellipsis)
 *  - '2'    → `line-clamp-2`   (dos líneas con wrap + ellipsis)
 *  - '3'    → `line-clamp-3`
 *  - 'none' → `line-clamp-none` (texto completo, sin truncar)
 *
 *  Cuando NO hay override (return ''), el caller debe aplicar su clase
 *  default (típicamente `truncate` = 1 línea). El recipe combina:
 *    `cn(!appearance?.truncate && 'truncate', appearanceTruncateClass(appearance))`
 *  para usar el default cuando no hay override y el line-clamp cuando sí.
 */
export function appearanceTruncateClass(a: SlotAppearance | undefined): string {
  if (!a?.truncate) return '';
  switch (a.truncate) {
    case '1':    return 'line-clamp-1';
    case '2':    return 'line-clamp-2';
    case '3':    return 'line-clamp-3';
    case 'none': return 'line-clamp-none';
  }
}
/** Escala el size base (en px) según `appearance.size`. Multiplicador
 *  conservador para no romper layouts: sm=0.7, md=1.0, lg=1.4, xl=1.8. */
export function appearanceSizePx(a: SlotAppearance | undefined, basePx: number): number {
  if (!a?.size) return basePx;
  return Math.round(basePx * SIZE_MULTIPLIER[a.size]);
}

// KRO-73 — `AccentSettings` y `extractAccentSettings` viven en el SDK
// (@kromia/core). Se re-exportan desde el header de este archivo
// (líneas 23-30). Doc original: cascada de resolución composition >
// slot > recipeDefault. Pipeline detallado en `src/extract-accent.ts`
// del SDK.

/** Devuelve el inline style del border accent para el wrapper outer de
 *  una receta, o `undefined` si no se debe pintar (sin color o position
 *  = none). El caller pasa el resultado de `extractAccentSettings` y
 *  recibe directamente `style={...}` listo para React.
 *
 *  Usa `box-shadow: inset` en lugar de `border` por dos razones:
 *   1. Respeta el `border-radius` del wrapper (los corners se redondean
 *      con el strip de color → sin gaps blancos en las esquinas).
 *   2. NO añade dimensión al box (border SÍ ocuparía espacio adicional
 *      y desplazaría el contenido).
 *
 *  Width: 3px para compact/accordion, 4px para detail (configurable). */
/** Envuelve una card de receta con el tinte (accent border) aplicado como
 *  `box-shadow inset` al wrapper de la card. NO añade div extra (usa
 *  cloneElement para inyectar el style). El inset se CURVA con el radius del
 *  wrapper, así que las 4 esquinas conservan su redondeo (uniforme) — la raya
 *  sigue la esquina en vez de aplanarla.
 *
 *  El parámetro `children` debe ser UN SOLO elemento (el wrapper outer de
 *  la receta, ej. el `<div>` outer de compact_avatar). */
export function AccentFrame({
  accent, width = 3, children,
}: {
  accent:   AccentSettings | undefined;
  width?:   number;
  children: ReactNode;
}) {
  if (!accent || accent.position === 'none') {
    return <>{children}</>;
  }
  const inlineStyle = buildAccentBorderStyle(accent, width);
  if (!inlineStyle || !isValidElement<{ style?: CSSProperties }>(children)) {
    return <>{children}</>;
  }
  return cloneElement(children as ReactElement<{ style?: CSSProperties }>, {
    style: { ...(children.props.style ?? {}), ...inlineStyle },
  });
}

/** Devuelve el style inline del accent para el modo 'flat' (box-shadow
 *  inset + corners planos). Para 'rounded' devuelve undefined porque ese
 *  modo lo maneja `AccentFrame` con un wrapper outer.
 *
 *  Helper interno usado por `AccentFrame`. Las recetas normalmente NO
 *  llaman a este helper — usan `<AccentFrame>` directamente. */
export function buildAccentBorderStyle(
  accent: AccentSettings | undefined,
  width:  number = 3,
): CSSProperties | undefined {
  if (!accent || accent.position === 'none') return undefined;

  // KRO-198 — raya de acento como box-shadow inset (strip dentro del wrapper, sin
  // añadir dimensión). El inset se CURVA con el radius del wrapper, así que las 4
  // esquinas mantienen su redondeo (uniforme). Antes se forzaba borderRadius=0 en
  // el lado del acento ("ticket con cinta") → top recto, bottom redondo, lo cual
  // se veía como esquinas inconsistentes. Ahora todas siguen el radius.
  switch (accent.position) {
    case 'top':    return { boxShadow: `inset 0  ${width}px 0 0 ${accent.color}` };
    case 'bottom': return { boxShadow: `inset 0 -${width}px 0 0 ${accent.color}` };
    case 'left':   return { boxShadow: `inset  ${width}px 0 0 0 ${accent.color}` };
    case 'right':  return { boxShadow: `inset -${width}px 0 0 0 ${accent.color}` };
  }
}

/** Legacy thin wrapper — algunas recetas siguen llamando a la API vieja
 *  hasta que se migren al pipeline accent settings. Devuelve solo el
 *  color (sin position). Marcado como deprecated. */
export function extractAccentColor(
  composition: { slots: Record<string, SlotComposition> } | undefined,
  item:        Record<string, any>,
  fieldDefs:   FieldDefLike[],
): string | undefined {
  return extractAccentSettings(composition, item, fieldDefs, 'top')?.color;
}

/** Devuelve los attributes de inspección para un wrapper de slot. Permite
 *  identificar visualmente (con tooltip nativo + outline opt-in) qué slot
 *  de la receta corresponde a cada elemento renderizado del AppPreview.
 *
 *  Uso:
 *  ```tsx
 *  <div {...slotDebugAttrs('title', title)}>...</div>
 *  ```
 *
 *  Produce:
 *  - `data-slot-id="title"` — útil para CSS hover (outline visual) y
 *    selección programática desde un inspector global.
 *  - `data-slot-fields="name,year"` — lista de keys de los fields que el
 *    publisher asignó al slot (separadas por coma, raw para tooling).
 *  - `title="Slot: title — campos: Nombre, Año"` — tooltip browser-native
 *    que aparece al hover prolongado. Usa labels humanos cuando los
 *    fieldDefs los tienen, fallback al key.
 *
 *  Si `slot` es undefined (slot opcional vacío), solo el data-slot-id se
 *  añade — el wrapper igual se identifica aunque no haya fields. Devuelve
 *  un objeto plano para spread directo en cualquier intrinsic React element.
 */
export function slotDebugAttrs(
  slotId: string,
  slot?:  ResolvedSlot | undefined,
): Record<string, string> {
  const attrs: Record<string, string> = {
    'data-slot-id': slotId,
  };
  if (!slot || slot.fields.length === 0) {
    attrs.title = `Slot: ${slotId} (vacío)`;
    return attrs;
  }
  const labels = slot.fields.map(f => f.def?.label ?? f.key);
  const keysRaw = slot.fields.map(f => f.key).join(',');
  attrs['data-slot-fields'] = keysRaw;
  attrs.title = `Slot: ${slotId} — campos: ${labels.join(', ')}`;
  return attrs;
}

/** Estilos inline para aplicar el `imageFocus` al elemento `<img>` con
 *  `object-cover`. Combina:
 *   - `objectPosition`: qué porción de la imagen queda visible dentro del
 *     crop (la parte que el publisher quiere mostrar centrada).
 *   - `transform: scale()`: zoom in. `transformOrigin` matchea el punto
 *     focal para que el zoom rote alrededor del punto de interés, no
 *     del centro geométrico — así zoom + posición se comportan coherente.
 *
 *  Si no hay override, devuelve `{}` (no aplica nada → CSS default centrado).
 */
export function imageFocusStyle(a: SlotAppearance | undefined): CSSProperties {
  const f = a?.imageFocus;
  if (!f) return {};
  const x = clamp(f.x, 0, 100);
  const y = clamp(f.y, 0, 100);
  const z = clamp(f.zoom, 1, 3);
  const style: CSSProperties = {
    objectPosition: `${x}% ${y}%`,
  };
  // KRO-147 F3 — con object-contain el zoom>1 desbordaría la caja y el
  // overflow-hidden del wrapper recortaría, contradiciendo "encaja la imagen
  // entera". El scale solo tiene sentido con object-cover (el default).
  if (z !== 1 && a?.objectFit !== 'contain') {
    style.transform       = `scale(${z})`;
    style.transformOrigin = `${x}% ${y}%`;
  }
  return style;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** KRO-33 — estilos inline para aplicar un `ImageTransform` (calibración POR
 *  CARTA) a un `<img>` con object-cover. Espejo de `imageFocusStyle`, pero la
 *  fuente es el transform del DATO de la carta (offsetX/Y ∈ [0,1] + scale +
 *  rotation), no la `appearance` del slot del template. Sin transform → `{}`. */
export function imageTransformStyle(t: ImageTransform | undefined): CSSProperties {
  if (!t) return {};
  const x = clamp(t.offsetX, 0, 1) * 100;
  const y = clamp(t.offsetY, 0, 1) * 100;
  const z = Number.isFinite(t.scale) ? Math.max(1, t.scale) : 1;
  const rot = Number.isFinite(t.rotation) ? (t.rotation as number) : 0;
  const style: CSSProperties = { objectPosition: `${x}% ${y}%` };
  const transforms: string[] = [];
  if (z !== 1) transforms.push(`scale(${z})`);
  if (rot) transforms.push(`rotate(${rot}deg)`);
  if (transforms.length) {
    style.transform = transforms.join(' ');
    style.transformOrigin = `${x}% ${y}%`;
  }
  return style;
}

/** KRO-33 — resuelve el `ImageTransform` (calibración por carta) del slot de
 *  imagen: usa el PRIMER field del slot (el de la imagen) como clave. Las cajas
 *  de imagen (AvatarBox/ThumbBox/BannerBox) lo prefieren sobre `imageFocus` del
 *  template → el preview de Studio muestra la carta calibrada igual que el
 *  coleccionista. undefined si no hay slot, field o transform. */
export function slotImageTransform(
  resolved: ResolvedSlot | undefined,
  item:     Record<string, any>,
): ImageTransform | undefined {
  const key = resolved?.fields?.[0]?.key;
  return key ? getCardImageTransform(item, key) : undefined;
}

/** Trunca el texto por número de caracteres (`appearance.truncateChars`)
 *  añadiendo "…" si se aplicó corte. Si `truncateChars` no está set o el
 *  texto ya es más corto, devuelve el original sin tocar.
 *
 *  Diferencia con `appearanceTruncateClass`:
 *  - `appearanceTruncateClass` → `line-clamp-N` CSS (depende del ancho).
 *  - `applyAppearanceTruncate`  → slice JS (predecible por N chars).
 *
 *  Pueden coexistir: primero se hace slice por chars, luego CSS line-clamp
 *  envuelve el resultado si aún sobrepasa N líneas. Trim al final para no
 *  dejar espacios huérfanos antes del "…". */
export function applyAppearanceTruncate(text: string, a: SlotAppearance | undefined): string {
  const n = a?.truncateChars;
  if (!n || n <= 0)        return text;
  if (text.length <= n)    return text;
  return text.slice(0, n).trimEnd() + '…';
}

/** True si el valor es null/undefined/'' o array vacío. */
export function isEmpty(v: any): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v))      return v.length === 0;
  return false;
}

// KRO-73 — `formatScalar` vive en el SDK (@kromia/core). El re-export
// está en el header (línea 30). Cubre: year, iso_date, currency, percentage,
// rating, measurement, fallback string/number/boolean. Implementación en
// `src/format-scalar.ts` del SDK.

/** Helper visual: un texto con formateo coherente con la receta.
 *  KRO-69: acepta `appearance` para honrar align/weight/size.
 *  KRO-69 follow-up: aplica slice por `truncateChars` si está set.
 *  KRO-69 follow-up²: behavior `color_hex` se renderiza como swatch
 *  visual + código hex en mono, no como texto plano — el coleccionista
 *  ve el COLOR, no el string "#FF5722". */
export function ScalarText({
  value, def, className, appearance,
}: {
  value:       any;
  def?:        FieldDefLike;
  className?:  string;
  appearance?: SlotAppearance;
}) {
  // Color hex: render visual con swatch. Solo si el valor parece un hex
  // válido — caemos al render texto si está malformed (defensivo).
  if (
    def?.behavior === 'color_hex' &&
    typeof value === 'string' &&
    /^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value.trim())
  ) {
    const raw = value.trim();
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    return (
      <span className={cn('inline-flex items-center gap-1.5 align-middle', className)}>
        <span
          aria-hidden="true"
          className="inline-block w-3.5 h-3.5 rounded border border-border/40 shadow-sm shrink-0"
          style={{ backgroundColor: hex }}
        />
        <span className={cn('font-mono text-[11px]', appearanceTextClasses(appearance))}>
          {hex.toUpperCase()}
        </span>
      </span>
    );
  }

  const text = formatScalar(value, def);
  if (!text) return null;
  const finalText = applyAppearanceTruncate(text, appearance);
  // KRO-133 — campos `markdown` (text-long): el motor de bloques (SlotContent →
  // ScalarText) renderizaba el string crudo → se veía `**negrita**` literal. Las
  // recetas detalle/expand block-native (Ficha, Perfil) y el modo Bloques honran
  // ahora el markdown inline, igual que editorial/momento/hero.
  if (def?.behavior === 'markdown') {
    return (
      <span className={cn(appearanceTextClasses(appearance), className)}>
        <MarkdownText text={finalText} />
      </span>
    );
  }
  // KRO-198 — HTML inline seguro (allowlist del SDK). Usa el valor CRUDO (no el
  // truncado: cortar a media etiqueta rompería el parseo).
  if (def?.behavior === 'html') {
    return (
      <span className={cn(appearanceTextClasses(appearance), className)}>
        <HtmlText html={String(value)} />
      </span>
    );
  }
  // KRO-198 — code: monoespaciado con fondo sutil.
  if (def?.behavior === 'code') {
    return (
      <code className={cn('font-mono text-[0.9em] bg-muted/60 rounded px-1.5 py-0.5 break-words', className)}>
        {finalText}
      </code>
    );
  }
  // KRO-198 — url/email/phone: enlace navegable con href saneado.
  const href = linkHrefFor(def?.behavior, value);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('underline underline-offset-2 text-primary break-words', appearanceTextClasses(appearance), className)}
      >
        {finalText}
      </a>
    );
  }
  return (
    <span className={cn(appearanceTextClasses(appearance), className)}>
      {finalText}
    </span>
  );
}

/**
 * Render de un slot composable: une los fields con el separador, respetando
 * la orientación. Solo escalares — las recetas que necesiten composable
 * con imágenes/chips deben renderizar a mano (caso de uso real raro).
 *
 * KRO-73 — la lógica de filtering/formatting/truncate vive en `composeSlotValues`
 * del SDK (`@kromia/core`). Este componente sólo se ocupa del JSX final.
 */
export function ComposableSlot({
  slot, className,
}: {
  slot:       ResolvedSlot;
  className?: string;
}) {
  const { items, orientation, separator, truncated } = composeSlotValues(slot);
  if (items.length === 0) return null;

  // KRO-69: appearance text classes (align/weight/size) viajan en el wrapper.
  const textClasses = appearanceTextClasses(slot.appearance);
  // KRO-198 — no-wrap opt-in (meta render-only `appearance.noWrap`): fuerza
  // `white-space: nowrap` en el wrapper de la fila componible para que los valores +
  // separadores no salten de línea. white-space NO crea formatting context (≠
  // inline-flex), así que la elipsis del `<p class="truncate">` padre de las recetas
  // se mantiene. Default vacío = se permite envolver (recetas con line-clamp-N intactas).
  const nowrapClass = slot.appearance?.noWrap ? 'whitespace-nowrap' : '';

  // KRO-198 — fields array con behavior tags/url_list/email_list: render por
  // ELEMENTO (chips / enlaces navegables), no el JSON crudo que daría
  // `composeSlotValues` al pasar el array entero por `formatScalar`.
  const f0   = slot.fields[0];
  const beh0 = f0?.def?.behavior;
  const arr0 = Array.isArray(f0?.value)
    ? (f0!.value as unknown[]).map(v => (v == null ? '' : String(v))).filter(v => v.trim() !== '')
    : null;

  // KRO-198 — apariencia POR-FIELD: entradas con KEY (caso B = multi-field) o sin
  // ella (caso A = un field array). HOISTEADO fuera del `if` para que el branch
  // 'auto' multi-campo de abajo TAMBIÉN coloree por-chip (antes el color por-field
  // solo lo aplicaban los displays explícitos). caso A sin key → hereda la base.
  const fa = slot.fieldAppearances;
  const entries: Array<{ key?: string; label?: string; value: string }> = (arr0 && arr0.length > 0)
    ? arr0.map(v => ({ key: f0?.key, value: v }))   // KRO-198 — key del field array → fieldAppearances[key] casa también en cada chip
    : slot.fields
        .map(f => ({ key: f.key, label: f.def?.label ?? f.key, value: formatScalar(f.value, f.def) }))
        .filter(e => e.value !== '');
  // KRO-198 — apariencia EFECTIVA por ENTRADA: un único molde para TODOS los
  // branches (antes solo el color, y solo `stats` aplicaba todo). `text` =
  // tipografía + color (base del slot ← fieldAppearances[key]); `bg` = fondo;
  // `box` = recorte CSS + relleno + efecto SOLO del override del field (no de la
  // base, para no alterar recetas ya shipeadas); `val(v)` = el string ya cortado
  // por `truncateChars` del field. Sin entrada por-field → solo la base (heredada).
  const styleFor = (key?: string) => {
    const ap  = mergeFieldAppearance(slot.appearance, fa, key);
    const own = key ? fa?.[key] : undefined;
    return {
      color: paletteClass(ap?.textColor, 'text'),
      bg:    paletteClass(ap?.bgColor, 'bg'),
      text:  appearanceTextClasses(ap ? { ...ap, bgColor: undefined } : undefined),
      box:   cn(appearanceTruncateClass(own), appearancePaddingClass(own), appearanceEffectClasses(own)),
      val:   (v: string) => applyAppearanceTruncate(v, own),
      // KRO-198 — "Mostrar como" por-chip (text/badge), para que la rama chips lo
      // respete IGUAL que el componente chips_row (display:'text' = sin pastilla).
      display: ap?.display,
      // KRO-198 — align del chip → justify-self en la rejilla (content-fit + posición).
      align: ap?.align,
    };
  };

  // KRO-198 — variante de render EXPLÍCITA (chips / en línea / lista / tabla).
  // Cuando el publisher la fija, manda sobre el render por behavior. 'auto'
  // (default, y cualquier composición histórica sin el campo) cae al
  // comportamiento de abajo → backward-compatible, sin drift visual.
  const display = slot.composableDisplay;
  if (display !== 'auto') {
    if (entries.length === 0) return null;
    // Base para decisiones a nivel WRAPPER (cancelar su bg en chips).
    const elBg = paletteClass(slot.appearance?.bgColor, 'bg');

    if (display === 'chips') {
      // Cada valor es una pastilla. El fondo del slot va EN las pastillas (no
      // en el wrapper, que se cancela con bg-transparent vía twMerge) para que
      // floten sobre el lienzo en vez de quedar sobre una banda sólida.
      // KRO-198 — REJILLA 2D opcional: con `chipGrid` el wrapper pasa a inline-grid
      // (columnas fijas) y cada chip se coloca con `placementClasses(chipPlacements[key])`;
      // sin él, flex-wrap de siempre (retro-compat).
      const grid = slot.chipGrid;
      return (
        // KRO-198 — `data-chip-grid`/`data-chip-key` marcan la rejilla y cada chip para
        // el EDITOR (el lienzo de Studio engancha el arrastre). Inertes en la app.
        <span
          data-chip-grid={grid ? true : undefined}
          className={cn(
            grid ? chipGridWrapperClass(grid) : 'inline-flex flex-wrap gap-1 align-middle',
            textClasses, elBg && 'bg-transparent', className)}
          style={grid ? chipGridTemplateStyle(grid) : undefined}
        >
          {entries.map((e, i) => {
            const s = styleFor(e.key);
            const place = grid ? placementClasses(slot.chipPlacements?.[e.key ?? '']) : undefined;
            // KRO-198 — align del chip → justify-self en la rejilla: con align el chip se
            // AJUSTA AL CONTENIDO y se posiciona; sin align estira (llena la celda). Solo
            // aplica en rejilla (en flex-wrap los chips ya son content-width).
            const self = grid ? chipJustifySelf(s.align) : undefined;
            // KRO-198 — respeta "Mostrar como" por-chip, IGUAL que el componente chips_row:
            // display:'text' → TEXTO PLANO (sin pastilla); default/'badge' → pastilla. (Antes
            // esta rama SIEMPRE pintaba pastilla → el chip de 1 campo del editor mostraba
            // badge aunque el publisher lo hubiera puesto como texto → drift con la app.)
            if (s.display === 'text') {
              return (
                <span key={i} data-chip-key={grid ? (e.key ?? undefined) : undefined} className={cn('text-[0.8em]', s.text, s.box, place, self)}>{s.val(e.value)}</span>
              );
            }
            return (
              <span key={i} data-chip-key={grid ? (e.key ?? undefined) : undefined} className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.8em]', s.bg || 'bg-muted', s.text || 'text-muted-foreground', s.box, place, self)}>{s.val(e.value)}</span>
            );
          })}
        </span>
      );
    }
    if (display === 'list') {
      return (
        <span className={cn('inline-flex flex-col items-start gap-0.5 align-top', textClasses, className)}>
          {entries.map((e, i) => { const s = styleFor(e.key); return <span key={i} className={cn(s.text, s.bg, s.box) || undefined}>{s.val(e.value)}</span>; })}
        </span>
      );
    }
    if (display === 'table') {
      // Filas etiqueta–valor. Sin etiquetas (caso array) → cae a lista apilada.
      const hasLabels = entries.some(e => e.label);
      if (!hasLabels) {
        return (
          <span className={cn('inline-flex flex-col items-start gap-0.5 align-top', textClasses, className)}>
            {entries.map((e, i) => { const s = styleFor(e.key); return <span key={i} className={cn(s.text, s.bg, s.box) || undefined}>{s.val(e.value)}</span>; })}
          </span>
        );
      }
      return (
        <span className={cn('inline-grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 align-top text-left', textClasses, className)}>
          {entries.map((e, i) => {
            const s = styleFor(e.key);
            return (
              <Fragment key={i}>
                <span className={cn('text-[0.85em]', s.color || 'text-muted-foreground/80')}>{e.label}</span>
                <span className={cn(s.text, s.bg, s.box) || undefined}>{s.val(e.value)}</span>
              </Fragment>
            );
          })}
        </span>
      );
    }
    if (display === 'stats') {
      // KRO-198 — fila de estadísticas: réplica de <StatsRow> con un slot pelado.
      // Cada field = VALOR grande (números tabulares) + ETIQUETA debajo en
      // mayúsculas, en columnas iguales con borde superior/inferior. `inline-grid
      // w-full` = full-width pero phrasing-safe (válido si el slot va dentro de
      // <p>). Sin etiquetas (caso array de un field) → cae a chips.
      const hasLabels = entries.some(e => e.label);
      if (!hasLabels) {
        return (
          <span className={cn('inline-flex flex-wrap gap-1 align-middle', textClasses, className)}>
            {entries.map((e, i) => {
              const s = styleFor(e.key);
              return (
                <span key={i} className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.8em]', s.bg || 'bg-muted', s.text || 'text-muted-foreground', s.box)}>{s.val(e.value)}</span>
              );
            })}
          </span>
        );
      }
      return (
        <span className={cn('inline-grid w-full grid-flow-col auto-cols-fr gap-2 border-y border-border py-3 align-top', textClasses, className)}>
          {entries.map((e, i) => {
            // KRO-198 — apariencia COMPLETA por estadística (color, fondo,
            // tipografía, recorte, caja), igual que el componente StatsRow. El
            // VALOR aplica todo; la ETIQUETA solo el color (mantiene su identidad).
            const ap = mergeFieldAppearance(slot.appearance, fa, e.key);
            const bg = paletteClass(ap?.bgColor, 'bg');
            const isBadge = ap?.display === 'badge';
            return (
              <span key={i} className="inline-flex flex-col items-center text-center min-w-0">
                {isBadge ? (
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums max-w-full',
                    bg || 'bg-muted', appearancePaddingClass(ap), appearanceEffectClasses(ap),
                    appearanceTextClasses(ap ? { ...ap, bgColor: undefined } : undefined) || 'text-foreground')}>{applyAppearanceTruncate(e.value, ap)}</span>
                ) : (
                  <span className={cn('text-lg font-bold tabular-nums max-w-full text-foreground',
                    !ap?.truncate && 'truncate', appearanceTruncateClass(ap),
                    bg && 'rounded px-1', appearancePaddingClass(ap), appearanceEffectClasses(ap), bg,
                    appearanceTextClasses(ap ? { ...ap, bgColor: undefined } : undefined))}>{applyAppearanceTruncate(e.value, ap)}</span>
                )}
                {e.label && <span className={cn('text-[10px] uppercase tracking-wider truncate max-w-full text-muted-foreground',
                  ap?.textColor && paletteClass(ap.textColor, 'text'))}>{e.label}</span>}
              </span>
            );
          })}
        </span>
      );
    }
    // display === 'inline' — todos los valores en una línea unidos por separador.
    return (
      <span className={cn(nowrapClass, textClasses, className)}>
        {entries.map((e, i) => {
          const s = styleFor(e.key);
          return (
            <span key={i} className={cn(s.text, s.bg, s.box) || undefined}>
              {i > 0 && <span className="text-muted-foreground/60">{` ${separator} `}</span>}
              {s.val(e.value)}
            </span>
          );
        })}
      </span>
    );
  }

  if (arr0 && arr0.length > 0) {
    // KRO-198 — TODOS los elementos del array comparten la apariencia POR-FIELD de
    // su field (f0): color/tipografía/recorte/caja + corte por chars en cada chip.
    const s = styleFor(f0?.key);
    if (beh0 === 'tags') {
      return (
        <span className={cn('inline-flex flex-wrap gap-1 align-middle', textClasses, s.bg && 'bg-transparent', className)}>
          {arr0.map((t, i) => (
            <span key={i} className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.8em]', s.bg || 'bg-muted', s.text || 'text-muted-foreground', s.box)}>{s.val(t)}</span>
          ))}
        </span>
      );
    }
    if (beh0 === 'url_list' || beh0 === 'email_list') {
      return (
        <span className={cn('inline-flex flex-col items-start gap-0.5 align-top', textClasses, className)}>
          {arr0.map((t, i) => {
            const href = beh0 === 'email_list' ? `mailto:${t}` : linkHrefFor('url', t);
            return href
              ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={cn('underline underline-offset-2 text-primary break-all', s.box)}>{s.val(t)}</a>
              : <span key={i} className={cn(s.text, s.box) || undefined}>{s.val(t)}</span>;
          })}
        </span>
      );
    }
    // KRO-198 — array GENÉRICO (array<string>/<number>/year_list…): une los
    // elementos con el separador, NO el JSON crudo que daría formatScalar.
    return (
      <span className={cn(nowrapClass, textClasses, className)}>
        {arr0.map((t, i) => (
          <span key={i} className={cn(s.text, s.bg, s.box) || undefined}>
            {i > 0 && <span className="text-muted-foreground/60">{` ${separator} `}</span>}
            {s.val(t)}
          </span>
        ))}
      </span>
    );
  }

  // KRO-73: si el SDK aplicó truncate, renderizamos el string plano cortado.
  // El estilo del separador se pierde (trade-off aceptado del KRO-69 follow-up).
  if (truncated !== null) {
    return <span className={cn(textClasses, className)}>{truncated}</span>;
  }

  if (orientation === 'vertical') {
    // IMPORTANTE: usamos <span inline-flex> en lugar de <div flex> porque
    // las recetas suelen envolver ComposableSlot en <p> (subtitle slot de
    // compact_card/avatar/etc). Un <div> dentro de <p> es HTML inválido →
    // Next.js lanza "In HTML, <div> cannot be a descendant of <p>" en hydration.
    // <span inline-flex> mantiene el layout column pero respeta el contexto
    // inline. Los items hijos también son <span> (inline), así que todo el
    // árbol es legalmente phrasing content.
    return (
      <span className={cn('inline-flex flex-col items-start gap-0.5 align-top', textClasses, className)}>
        {/* KRO-198 — apariencia EFECTIVA por entrada (color+tipografía+recorte+caja) también en 'auto'. */}
        {entries.map((e, i) => { const s = styleFor(e.key); return <span key={i} className={cn(s.text, s.bg, s.box) || undefined}>{s.val(e.value)}</span>; })}
      </span>
    );
  }
  // Horizontal: plain inline-span para que el parent <p class="truncate"> /
  // <p class="line-clamp-N"> pueda aplicar ellipsis correctamente.
  // inline-flex crea un nuevo formatting context que impide que el overflow
  // del padre corte el contenido (el texto se expande infinitamente hacia
  // la derecha sin que se vea la elipsis del padre).
  return (
    <span className={cn(nowrapClass, textClasses, className)}>
      {/* KRO-198 — apariencia EFECTIVA por entrada (color/fondo/tipografía/recorte/
          caja + corte por chars) también en 'auto' multi-campo. */}
      {entries.map((e, i) => {
        const s = styleFor(e.key);
        return (
          <span key={i} className={cn(s.text, s.bg, s.box) || undefined}>
            {i > 0 && <span className="text-muted-foreground/60">{` ${separator} `}</span>}
            {s.val(e.value)}
          </span>
        );
      })}
    </span>
  );
}

// ── Inline markdown (KRO-131) ─────────────────────────────────────────────────
//
// Render de markdown INLINE para fields con behavior `markdown` (body de
// editorial/momento/hero, lore de cartas). El TOKENIZADO vive en `@kromia/core`
// (`parseInlineMarkdown`) → una sola fuente que Flutter espeja con su piel
// (`TextSpan`); aquí solo mapeamos los tokens a JSX. Soporta **negrita**,
// *cursiva*/_cursiva_, `code`, [texto](url) y saltos de línea. NO es parser de
// bloque (sin listas/headings/tablas); para prosa rica de wiki Studio usa su
// `<Markdown>` completo — esto es solo para el render de cartas/secciones.

/** Render de markdown inline desde los tokens del SDK. Úsalo cuando
 *  `def.behavior === 'markdown'`; si no, renderiza el string plano. */
/** KRO-198 — esquemas de URL seguros para `href` (defensa en el render, además
 *  del sanitizado del tokenizador). Bloquea javascript:/data:/vbscript:. */
function safeHref(href: string | undefined | null): string | null {
  if (!href) return null;
  const h = href.trim();
  if (h === '') return null;
  const low = h.toLowerCase();
  if (low.startsWith('javascript:') || low.startsWith('data:') || low.startsWith('vbscript:')) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(low);
  if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme[1])) return null;
  return h;
}

/** KRO-198 — href para un field escalar url/email/phone. `url` sin esquema → https://. */
function linkHrefFor(behavior: string | undefined, value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const v = value.trim();
  if (behavior === 'email') return `mailto:${v}`;
  if (behavior === 'phone') return `tel:${v.replace(/[^\d+]/g, '')}`;
  if (behavior === 'url') {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('/') || v.startsWith('#') ? v : `https://${v}`;
    return safeHref(withScheme);
  }
  return null;
}

/** Mapea un `MarkdownToken` a JSX. `clickable` → los links son `<a>` reales
 *  (href ya saneado) en vez de texto subrayado (markdown los deja inertes en el
 *  preview; el HTML inline sí los hace navegables). KRO-198. */
function renderInlineToken(tk: MarkdownToken, key: number, clickable: boolean) {
  switch (tk.type) {
    case 'break':  return <br key={key} />;
    case 'bold':   return <strong key={key}>{tk.value}</strong>;
    case 'italic': return <em key={key}>{tk.value}</em>;
    case 'code':   return <code key={key} className="font-mono text-[0.85em] bg-muted/60 rounded px-1 py-0.5">{tk.value}</code>;
    case 'link': {
      const href = clickable ? safeHref(tk.href) : null;
      return href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-primary break-words">{tk.value}</a>
        : <span key={key} className="underline underline-offset-2">{tk.value}</span>;
    }
    default:       return <span key={key}>{tk.value}</span>;
  }
}

/** Render markdown inline (behavior 'markdown'). Links NO clicables (preview). */
export function MarkdownText({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text).map((tk, i) => renderInlineToken(tk, i, false))}</>;
}

/** Render HTML inline SEGURO (behavior 'html'): allowlist del SDK → tokens → JSX.
 *  Links clicables con href saneado. NUNCA innerHTML (cero XSS). KRO-198. */
export function HtmlText({ html }: { html: string }) {
  return <>{parseInlineHtml(html).map((tk, i) => renderInlineToken(tk, i, true))}</>;
}

// ── Renderers especializados por tipo de slot ────────────────────────────────

/** Avatar circular. value es URL o vacío.
 *
 *  Fallback en cascada cuando no hay URL:
 *   1. Si `alt` tiene texto → `InitialsAvatar` con iniciales + color
 *      derminista del hash del nombre (igual color cada render → estable).
 *   2. Si tampoco hay alt → círculo gris bg-muted (último recurso).
 *
 *  Coincide con la convención del mockup: España/Brasil/Argentina aparecen
 *  como círculos con ES/BR/AR cuando no hay foto.
 */
export function AvatarBox({
  url, alt, size = 48, className, appearance, imageTransform,
}: {
  url?:        string;
  alt?:        string;
  size?:       number;
  className?:  string;
  /** KRO-69: shape (circle/square/rounded) + size scaling. Aspect no aplica
   *  (avatar es siempre 1:1) y align/weight/size text tampoco. */
  appearance?: SlotAppearance;
  /** KRO-33 — calibración por carta; prevalece sobre `appearance.imageFocus`. */
  imageTransform?: ImageTransform;
}) {
  // El tamaño base lo da el recipe; appearance.size lo escala.
  const effectiveSize = appearanceSizePx(appearance, size);
  // Default avatar = circle. Solo aplicamos override si el publisher cambió.
  const shapeClass = appearance?.shape ? appearanceShapeClass(appearance) : 'rounded-full';

  // Sin URL pero con alt → iniciales coloreadas (mockup pattern).
  if (!url && alt && alt.trim()) {
    return (
      <InitialsAvatar
        text={alt}
        size={effectiveSize}
        className={cn(shapeClass !== 'rounded-full' && shapeClass, className)}
      />
    );
  }
  return (
    <div
      style={{ width: effectiveSize, height: effectiveSize }}
      className={cn(
        'bg-muted shrink-0 overflow-hidden ring-2 ring-card',
        shapeClass,
        // KRO-147 F3 — opacity + shadow del slot.
        appearanceEffectClasses(appearance),
        className,
      )}
    >
      {url && (isMockupImage(url) ? <MockupImageSkeleton /> :
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ''}
          style={imageTransform ? imageTransformStyle(imageTransform) : imageFocusStyle(appearance)}
          className={cn('w-full h-full', appearanceObjectFitClass(appearance))}
        />
      )}
    </div>
  );
}

/** Skeleton para el sentinel `mockup:image` del synth (2026-06-10): caja
 *  neutra PULSANTE que comunica "aquí va una imagen" sin intentar cargar
 *  nada (sin red, sin proxy, sin icono de imagen rota). Llena el wrapper. */
export function MockupImageSkeleton({ className }: { className?: string }) {
  return <div className={cn('w-full h-full animate-pulse bg-foreground/[0.06]', className)} aria-hidden />;
}

/**
 * Avatar con iniciales (1-2 letras) y color de fondo determinista a partir
 * del hash del texto. Mismo input → mismo color en cada render. Útil cuando
 * no hay foto: España (rojo), Brasil (amarillo), Argentina (azul) etc.,
 * con colores que ayudan a distinguir sin necesidad de la foto real.
 */
export function InitialsAvatar({
  text, size = 48, className,
}: {
  text:       string;
  size?:      number;
  className?: string;
}) {
  const initials = text.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const hue = simpleStringHash(text) % 360;
  // Tinta clara para fondo + tinta oscura para letras, mismo hue.
  // Saturación moderada para que no sature visualmente en una lista larga.
  const bg = `hsl(${hue}, 32%, 85%)`;
  const fg = `hsl(${hue}, 55%, 28%)`;
  // KRO-69: default = rounded-full; el caller puede sobreescribir via
  // className (ej. AvatarBox pasa shapeClass cuando appearance.shape ≠ circle).
  const hasShapeOverride = className?.includes('rounded-');
  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg, color: fg }}
      className={cn(
        'shrink-0 ring-2 ring-card flex items-center justify-center font-bold select-none',
        !hasShapeOverride && 'rounded-full',
        className,
      )}
    >
      <span style={{ fontSize: Math.round(size * 0.38) }} className="leading-none">
        {initials}
      </span>
    </div>
  );
}

/** Hash determinista barato de un string a un entero positivo. NO criptográfico —
 *  solo lo usamos para escoger una tinta de la rueda de colores HSL. */
function simpleStringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Dot circular pequeño coloreado por valor. Usado para slot `meta` en
 * `compact_avatar` cuando el behavior es enum/ordinal_enum/rating — en
 * lugar de un badge text largo (que rompe el flow del row), mostramos un
 * punto de color al margen derecho (mockup pattern: España red dot,
 * Brasil yellow, Argentina blue).
 *
 * Color derivado del hash del valor → mismo valor enum siempre el mismo
 * color (consistencia visual entre items con la misma "categoría").
 */
export function StatusDot({
  value, size = 8, className,
}: {
  value:      any;
  size?:      number;
  className?: string;
}) {
  const text = isEmpty(value) ? '' : String(value);
  if (!text) return null;
  const hue   = simpleStringHash(text) % 360;
  const color = `hsl(${hue}, 65%, 50%)`;
  return (
    <span
      title={text}
      aria-label={text}
      style={{ width: size, height: size, backgroundColor: color }}
      className={cn('shrink-0 rounded-full inline-block', className)}
    />
  );
}

/** Thumb cuadrada (rectangular si aspect ≠ 1). value es URL.
 *  KRO-69: appearance honra shape (rounded default) + aspect + size. */
export function ThumbBox({
  url, alt, size = 64, className, appearance, fill = false, count, imageTransform,
}: {
  url?:        string;
  alt?:        string;
  size?:       number;
  className?:  string;
  appearance?: SlotAppearance;
  /** KRO-33 — calibración por carta; prevalece sobre `appearance.imageFocus`. */
  imageTransform?: ImageTransform;
  /**
   * KRO-133 — `fill`: la imagen ocupa el ANCHO del contenedor (banner/cover)
   * en vez de un tamaño fijo en px. La altura la da el `aspect` (por eso solo
   * tiene efecto si hay aspect lock). Lo usa el motor de bloques para recetas
   * tipo "tarjeta destacada" / "cartel", donde la imagen es protagonista.
   */
  fill?:       boolean;
  /**
   * KRO-155 — nº TOTAL de imágenes cuando este thumb representa un `array<image>`
   * colapsado a su 1ª url (slot image-array como hoja). Si es >1, pinta un chip
   * "+N" en la esquina para que se vea que hay más (coherente con el "+N" de las
   * galerías y de las mini-cartas de referencias). Sin valor / ≤1 → sin chip.
   */
  count?:      number;
}) {
  const effectiveSize = appearanceSizePx(appearance, size);
  // Default thumb = rounded-lg. Override → shape class.
  const shapeClass = appearance?.shape ? appearanceShapeClass(appearance) : 'rounded-lg';
  // Aspect default: 1:1 (cuadrada). 'free' → sin lock; otros → aplica.
  const aspectClass = appearance?.aspect && appearance.aspect !== 'free'
    ? appearanceAspectClass(appearance)
    : '';
  // Si hay aspect lock, no fijamos height — el aspect lo determina.
  const useFixedHeight = !aspectClass;
  // Modo banner/cover: ancho completo. Requiere aspect (la altura sale del ratio).
  const fillMode = fill && !!aspectClass;
  // KRO-198 — el fondo de la CAJA de imagen (placeholder + tras imágenes con
  // transparencia) sigue el bgColor de la appearance si está fijado. Así un
  // acabado oscuro tiñe también el slot de imagen y no deja un cuadro claro
  // chocando. Sin override → bg-muted (placeholder neutro de siempre).
  const boxBg = (appearance?.bgColor && paletteClass(appearance.bgColor, 'bg')) || 'bg-muted';

  return (
    <div
      style={fillMode
        ? undefined
        : (useFixedHeight
            ? { width: effectiveSize, height: effectiveSize }
            : { width: effectiveSize })}
      className={cn(
        'relative overflow-hidden',
        boxBg,
        fillMode ? 'w-full' : 'shrink-0',
        shapeClass,
        aspectClass,
        // KRO-147 F3 — opacity + shadow del slot.
        appearanceEffectClasses(appearance),
        className,
      )}
    >
      {url && (isMockupImage(url) ? <MockupImageSkeleton /> :
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ''}
          style={imageTransform ? imageTransformStyle(imageTransform) : imageFocusStyle(appearance)}
          className={cn('w-full h-full', appearanceObjectFitClass(appearance))}
        />
      )}
      {count != null && count > 1 && (
        <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          +{count - 1}
        </span>
      )}
    </div>
  );
}

/** Banner ancho (aspect 16:9 por defecto).
 *  KRO-69: appearance honra shape (rounded-lg default) + aspect. */
export function BannerBox({
  url, alt, className, appearance, imageTransform,
}: {
  url?:        string;
  alt?:        string;
  className?:  string;
  appearance?: SlotAppearance;
  /** KRO-33 — calibración por carta; prevalece sobre `appearance.imageFocus`. */
  imageTransform?: ImageTransform;
}) {
  // Default banner = rounded-lg + 16:9. Overrides cambian.
  const shapeClass = appearance?.shape ? appearanceShapeClass(appearance) : 'rounded-lg';
  const aspectClass = appearance?.aspect && appearance.aspect !== 'free'
    ? appearanceAspectClass(appearance)
    : 'aspect-[16/9]';
  return (
    <div className={cn('w-full bg-muted overflow-hidden', shapeClass, aspectClass, appearanceEffectClasses(appearance), className)}>
      {url && (isMockupImage(url) ? <MockupImageSkeleton /> :
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ''}
          style={imageTransform ? imageTransformStyle(imageTransform) : imageFocusStyle(appearance)}
          className={cn('w-full h-full', appearanceObjectFitClass(appearance))}
        />
      )}
    </div>
  );
}

/** Badge — pill con color discreto. Útil para rareza/categoría. `style` permite
 *  el color dinámico vinculado a un campo color_hex (KRO-147). */
export function BadgePill({
  children, className, style,
}: {
  children:  ReactNode;
  className?: string;
  style?:    CSSProperties;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-muted text-foreground/80',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
