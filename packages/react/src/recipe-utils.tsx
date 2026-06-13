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
import { cloneElement, isValidElement } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { isMockupImage,
  formatScalar             as sdkFormatScalar,
  extractAccentSettings    as sdkExtractAccentSettings,
  composeSlotValues,
  paletteClass,
  type FieldDefLike         as SdkFieldDefLike,
  type AccentSettings       as SdkAccentSettings,
  type SlotAppearance,
  type SlotComposition,
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
  /** KRO-69 V6 — Appearance override per-instance. Las recetas pasan esto
   *  a los componentes utility (AvatarBox, ScalarText, etc.) que lo
   *  traducen a clases CSS. undefined o props undefined → fallback al
   *  estilo default del componente. */
  appearance?: SlotAppearance;
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

  return {
    fields,
    orientation: sc.orientation ?? 'horizontal',
    separator:   sc.separator   ?? ' · ',
    appearance:  sc.appearance,
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
    a.font === 'serif' && 'font-serif',
    a.size   && TEXT_SIZE_CLASSES[a.size],
    // KRO-147 F3 — tipografía rica. `tracking` va DESPUÉS del tracking-wider
    // implícito de uppercase para que, si el publisher lo fija, gane (cn/merge).
    a.italic && 'italic',
    a.underline && 'underline underline-offset-2',
    a.lineHeight && LINE_HEIGHT_CLASSES[a.lineHeight],
    a.tracking   && TRACKING_CLASSES[a.tracking],
    // KRO-133 F3 — color de texto/fondo de la paleta amplia (cerrada).
    a.textColor && paletteClass(a.textColor, 'text'),
    a.bgColor   && paletteClass(a.bgColor, 'bg'),
  );
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
/** Devuelve la clase de padding-Y del wrapper del slot, o '' si no hay override. */
export function appearancePaddingClass(a: SlotAppearance | undefined): string {
  return a?.paddingY ? PADDING_Y_CLASSES[a.paddingY] : '';
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
 *  cloneElement para inyectar el style). Las dos esquinas del lado del
 *  strip se fuerzan a `border-radius: 0`. Look: "ticket con cinta" —
 *  strip recto de borde a borde dentro de la card.
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

  // box-shadow inset — strip dentro del wrapper sin añadir dimensión.
  // Para evitar gaps blancos en los corners (el inset se curva con el
  // radius del wrapper), forzamos borderRadius=0 en las dos esquinas
  // del lado del strip. Las opuestas mantienen su radius. Look: "ticket
  // con cinta" — un lado plano, otro redondeado.
  switch (accent.position) {
    case 'top':    return {
      boxShadow:              `inset 0  ${width}px 0 0 ${accent.color}`,
      borderTopLeftRadius:    0,
      borderTopRightRadius:   0,
    };
    case 'bottom': return {
      boxShadow:              `inset 0 -${width}px 0 0 ${accent.color}`,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius:0,
    };
    case 'left':   return {
      boxShadow:              `inset  ${width}px 0 0 0 ${accent.color}`,
      borderTopLeftRadius:    0,
      borderBottomLeftRadius: 0,
    };
    case 'right':  return {
      boxShadow:              `inset -${width}px 0 0 0 ${accent.color}`,
      borderTopRightRadius:   0,
      borderBottomRightRadius:0,
    };
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
        {items.map((t, i) => <span key={i}>{t}</span>)}
      </span>
    );
  }
  // Horizontal: plain inline-span para que el parent <p class="truncate"> /
  // <p class="line-clamp-N"> pueda aplicar ellipsis correctamente.
  // inline-flex crea un nuevo formatting context que impide que el overflow
  // del padre corte el contenido (el texto se expande infinitamente hacia
  // la derecha sin que se vea la elipsis del padre).
  return (
    <span className={cn(textClasses, className)}>
      {items.map((t, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted-foreground/60">{` ${separator} `}</span>}
          {t}
        </span>
      ))}
    </span>
  );
}

// ── Inline markdown (KRO-131) ─────────────────────────────────────────────────
//
// Render minimalista de markdown INLINE para slots de texto largo cuyo field
// tiene behavior `markdown` (body de editorial/momento/hero). Soporta
// **negrita**, *cursiva*, _cursiva_, `code` y [texto](url), más saltos de línea.
// NO es un parser de bloque (sin listas/headings/tablas) — cubre el grueso del
// lore de cartas sin meter una dependencia de markdown en el package (clave para
// mantenerlo ligero y espejable en Flutter). Para prosa rica de wiki, Studio usa
// su propio <Markdown> completo; esto es solo para el render de cartas.

function parseInlineMd(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Orden: negrita (**) · code (`) · link ([..](..)) · cursiva (* o _).
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${kp}-t${i}`}>{text.slice(last, m.index)}</span>);
    if (m[1] != null)      nodes.push(<strong key={`${kp}-${i}`}>{m[1]}</strong>);
    else if (m[2] != null) nodes.push(<code key={`${kp}-${i}`} className="font-mono text-[0.85em] bg-muted/60 rounded px-1 py-0.5">{m[2]}</code>);
    else if (m[3] != null) nodes.push(<span key={`${kp}-${i}`} className="underline underline-offset-2">{m[3]}</span>);
    else if (m[5] != null) nodes.push(<em key={`${kp}-${i}`}>{m[5]}</em>);
    else if (m[6] != null) nodes.push(<em key={`${kp}-${i}`}>{m[6]}</em>);
    last = re.lastIndex; i++;
  }
  if (last < text.length) nodes.push(<span key={`${kp}-end`}>{text.slice(last)}</span>);
  return nodes;
}

/** Render de markdown inline (negrita/cursiva/code/links) + saltos de línea.
 *  Úsalo en el body de las recetas detalle cuando `def.behavior === 'markdown'`;
 *  si no, renderiza el string plano. */
export function MarkdownText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split('\n').forEach((line, li) => {
    if (li > 0) out.push(<br key={`br${li}`} />);
    out.push(...parseInlineMd(line, `l${li}`));
  });
  return <>{out}</>;
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
  url, alt, size = 48, className, appearance,
}: {
  url?:        string;
  alt?:        string;
  size?:       number;
  className?:  string;
  /** KRO-69: shape (circle/square/rounded) + size scaling. Aspect no aplica
   *  (avatar es siempre 1:1) y align/weight/size text tampoco. */
  appearance?: SlotAppearance;
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
          style={imageFocusStyle(appearance)}
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
  url, alt, size = 64, className, appearance, fill = false, count,
}: {
  url?:        string;
  alt?:        string;
  size?:       number;
  className?:  string;
  appearance?: SlotAppearance;
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

  return (
    <div
      style={fillMode
        ? undefined
        : (useFixedHeight
            ? { width: effectiveSize, height: effectiveSize }
            : { width: effectiveSize })}
      className={cn(
        'relative bg-muted overflow-hidden',
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
          style={imageFocusStyle(appearance)}
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
  url, alt, className, appearance,
}: {
  url?:        string;
  alt?:        string;
  className?:  string;
  appearance?: SlotAppearance;
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
          style={imageFocusStyle(appearance)}
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
