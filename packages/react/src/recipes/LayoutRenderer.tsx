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
  appearanceTextClasses, appearanceTruncateClass, appearanceEffectClasses,
  type FieldDefLike,
} from '../recipe-utils';
import {
  migrateSlotsToLayout, paletteClass, resolveFieldColor, gridColumnsTemplate, gridRowsTemplate,
  classifyField, clampPlaceToGrid, getRecipeManifest,
  type LayoutNode, type LayoutContainerNode, type LayoutComponentNode, type LayoutGap, type LayoutAlign,
  type LayoutJustify, type GridPlacement, type ContainerSurface, type SurfaceBorder, type ViewComposition,
  type CardFormat,
} from '@kromia/core';
import { RefGallery, type CardRefResolver } from './RefGallery';
import { HeroHeader } from './HeroHeader';
import { ImageGallery } from './ImageGallery';
import { StatsRow } from './StatsRow';

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
// Estáticas para que Tailwind las recoja. (El template de columnas/filas va
// inline — soporta track sizing arbitrario.)
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
    // El template de columnas/filas va INLINE (gridTemplateStyle) → soporta
    // anchos de columna / altos de fila arbitrarios (track sizing). Aquí solo
    // las clases no-dimensionales.
    return cn(
      'grid min-w-0', gap,
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
type BSide  = 'all' | 'top' | 'right' | 'bottom' | 'left';
type BWidth = NonNullable<SurfaceBorder['width']>;
const BORDER_WIDTH_BY_SIDE: Record<BSide, Record<BWidth, string>> = {
  all:    { thin: 'border',   medium: 'border-2',   thick: 'border-4' },
  top:    { thin: 'border-t', medium: 'border-t-2', thick: 'border-t-4' },
  right:  { thin: 'border-r', medium: 'border-r-2', thick: 'border-r-4' },
  bottom: { thin: 'border-b', medium: 'border-b-2', thick: 'border-b-4' },
  left:   { thin: 'border-l', medium: 'border-l-2', thick: 'border-l-4' },
};
const BORDER_STYLE_CLASSES: Record<NonNullable<SurfaceBorder['style']>, string> = {
  solid: 'border-solid', dashed: 'border-dashed', dotted: 'border-dotted',
};
function borderClasses(b: SurfaceBorder | undefined): string | undefined {
  if (!b || !b.width) return undefined; // sin grosor → sin borde
  // Multi-lado: una clase de grosor por cada lado elegido (vacío = los 4).
  const sides: BSide[] = b.sides && b.sides.length ? b.sides : ['all'];
  const widthCls = sides.map(s => BORDER_WIDTH_BY_SIDE[s][b.width!]).join(' ');
  return cn(
    widthCls,
    paletteClass(b.color ?? 'border', 'border'),  // color de la paleta amplia
    b.style && BORDER_STYLE_CLASSES[b.style],
  );
}

// Radius por-esquina: matriz esquina × tamaño con clases LITERALES (escaneadas
// por Tailwind desde el source de @kromia/react — sin depender de @source inline).
type RCorner = 'tl' | 'tr' | 'bl' | 'br';
type RSize   = NonNullable<ContainerSurface['radius']>;
const CORNER_RADIUS: Record<RCorner, Record<RSize, string>> = {
  tl: { none: 'rounded-tl-none', sm: 'rounded-tl-sm', md: 'rounded-tl-md', lg: 'rounded-tl-lg', xl: 'rounded-tl-xl', full: 'rounded-tl-full' },
  tr: { none: 'rounded-tr-none', sm: 'rounded-tr-sm', md: 'rounded-tr-md', lg: 'rounded-tr-lg', xl: 'rounded-tr-xl', full: 'rounded-tr-full' },
  bl: { none: 'rounded-bl-none', sm: 'rounded-bl-sm', md: 'rounded-bl-md', lg: 'rounded-bl-lg', xl: 'rounded-bl-xl', full: 'rounded-bl-full' },
  br: { none: 'rounded-br-none', sm: 'rounded-br-sm', md: 'rounded-br-md', lg: 'rounded-br-lg', xl: 'rounded-br-xl', full: 'rounded-br-full' },
};
function radiusClasses(s: ContainerSurface): string | undefined {
  if (!s.radius) return undefined;
  if (s.radiusCorners && s.radiusCorners.length) {
    return s.radiusCorners.map(c => CORNER_RADIUS[c][s.radius!]).join(' ');
  }
  return SURFACE_RADIUS_CLASSES[s.radius];
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
    radiusClasses(s),
    s.shadow && SURFACE_SHADOW_CLASSES[s.shadow],
    s.padding && SURFACE_PADDING_CLASSES[s.padding],
  );
}
export { surfaceClasses as containerSurfaceClasses };

// ── Colores VINCULADOS A CAMPO (color_hex) → estilo inline (KRO-147) ──────────
// Las clases de paleta las ponen `surfaceClasses`/`appearanceTextClasses`; aquí
// solo el valor dinámico leído del item para los ids `field:<key>`.
type ColorStyle = { color?: string; backgroundColor?: string; borderColor?: string };

/** Estilo inline de los colores de un contenedor vinculados a un campo color_hex. */
function surfaceFieldColorStyle(s: ContainerSurface | undefined, item: Record<string, any>): ColorStyle | undefined {
  if (!s) return undefined;
  const backgroundColor = resolveFieldColor(s.bgColor, item);
  const borderColor     = resolveFieldColor(s.border?.color, item);
  if (!backgroundColor && !borderColor) return undefined;
  return { ...(backgroundColor && { backgroundColor }), ...(borderColor && { borderColor }) };
}

/** Estilo inline de los colores de un slot (texto/fondo) vinculados a color_hex. */
function slotFieldColorStyle(
  ap: { textColor?: string; bgColor?: string } | undefined, item: Record<string, any>,
): ColorStyle | undefined {
  if (!ap) return undefined;
  const color           = resolveFieldColor(ap.textColor, item);
  const backgroundColor = resolveFieldColor(ap.bgColor, item);
  if (!color && !backgroundColor) return undefined;
  return { ...(color && { color }), ...(backgroundColor && { backgroundColor }) };
}

interface NodeCtx {
  composition: { slots: ViewComposition['slots']; slotOverrides?: ViewComposition['slotOverrides'] };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  /** Formato de carta del álbum → columnas/aspect de la rejilla de refs. */
  cardFormat?: CardFormat;
  /** KRO-133 — resuelve refs a cartas REALES (foto) en las mini-cartas. */
  resolveCardRef?: CardRefResolver;
  /** KRO-133 — tap en una mini-carta (el host abre el modo focus). Solo se
   *  invoca cuando el slot tiene appearance.refTap === 'focus'. */
  onCardRefTap?: (ref: string | number) => void;
}

/** ¿El field del slot es una imagen? (decide caja-imagen vs texto). */
function isImageField(def: FieldDefLike | undefined): boolean {
  return def?.type === 'image' || def?.type === 'array<image>';
}

/** ¿El field del slot es una REFERENCIA a carta/sección? (decide rejilla de
 *  mini-cartas vs texto). CLAVE: una "lista de cartas" NO es `type: cardRef` —
 *  suele ser `type: number/text` + behavior `card_index_list`/`card_code_list`,
 *  que `classifyField` mapea al kind `card-ref`. Por eso clasificamos por
 *  type+behavior (no solo type), o caería a `ScalarText` → "[6]". */
function isRefField(def: FieldDefLike | undefined): boolean {
  if (!def) return false;
  if (def.type === 'cardRef' || def.type === 'sectionRef'
   || def.type === 'array<cardRef>' || def.type === 'array<sectionRef>') return true;
  return classifyField({ type: def.type, behavior: (def as { behavior?: string }).behavior }).includes('card-ref');
}

/** ¿El field es TEXTO LARGO (textarea / markdown / notes / html)? Decide los
 *  defaults de párrafo: sin truncate a 1 línea y respetando saltos de línea.
 *  KRO-158 — un body maquetado con párrafos se colapsaba a una sola línea en
 *  el modo bloques (truncate default + whitespace colapsado). */
function isLongTextField(def: FieldDefLike | undefined): boolean {
  if (!def) return false;
  return classifyField({ type: def.type, behavior: (def as { behavior?: string }).behavior }).includes('text-long');
}

export interface SlotContentProps {
  slot:        string;
  composition: { slots: ViewComposition['slots']; slotOverrides?: ViewComposition['slotOverrides'] };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  /** Formato de carta del álbum → columnas/aspect de la rejilla de refs. */
  cardFormat?: CardFormat;
  /** KRO-133 — resuelve refs a cartas REALES (foto) en las mini-cartas. */
  resolveCardRef?: CardRefResolver;
  /** KRO-133 — tap en mini-carta (gated por appearance.refTap === 'focus'). */
  onCardRefTap?: (ref: string | number) => void;
}

/**
 * Render del CONTENIDO de un slot (imagen o texto), honrando appearance.
 * Exportado para que el editor visual de Studio (F3) pinte cada celda del
 * lienzo con el mismo resultado que el motor de render. Devuelve null si el
 * slot está deshabilitado o no resuelve a datos.
 */
export function SlotContent({ slot, composition, item, fieldDefs, cardFormat, resolveCardRef, onCardRefTap }: SlotContentProps) {
  if (isSlotDisabled(composition, slot)) return null;
  const resolved = resolveSlot(composition, slot, fieldDefs, item);
  if (!resolved) return null;

  const first = resolved.fields[0];

  // Imagen: caja honrando appearance (shape/aspect/size). `array<image>` → 1ª url.
  if (isImageField(first?.def)) {
    const raw = first?.value;
    const url = Array.isArray(raw) ? (raw[0] as string | undefined) : (raw as string | undefined);
    // KRO-133 — banner/cover a ancho completo: si la apariencia fija un aspect
    // pero NO un `size`, la imagen ocupa todo el ancho (tarjeta destacada,
    // cartel, hero…). Con `size` explícito se respeta el tamaño fijo (thumb).
    const ap = resolved.appearance;
    const fill = !!ap?.aspect && ap.aspect !== 'free' && !ap.size;
    return (
      <div className={appearancePaddingClass(ap)} {...slotDebugAttrs(slot, resolved)}>
        <ThumbBox url={url} alt={String(first?.value ?? '')} appearance={ap} fill={fill} />
      </div>
    );
  }

  // Referencias (cardRef/sectionRef): rejilla de mini-cartas (el "componente
  // carta"), no texto crudo. Reutiliza el MISMO render que la receta hero
  // (RefGallery) → un slot de cartas en bloques pinta la galería, no "[6]".
  if (isRefField(first?.def)) {
    const refVal = first?.value as Array<string | number> | string | number | undefined;
    const seed = String(Array.isArray(refVal) ? (refVal[0] ?? slot) : (refVal ?? slot));
    return (
      <div className={appearancePaddingClass(resolved.appearance)} {...slotDebugAttrs(slot, resolved)}>
        <RefGallery
          refs={refVal}
          seed={seed}
          cardFormat={cardFormat}
          nestedComposition={composition.slots[slot]?.nestedComposition}
          fieldDefs={fieldDefs}
          resolveRef={resolveCardRef}
          appearance={resolved.appearance}
          onRefTap={resolved.appearance?.refTap === 'focus' ? onCardRefTap : undefined}
        />
      </div>
    );
  }

  // Texto: composable (varios fields / vertical) vs escalar simple.
  const isComposable = resolved.fields.length > 1 || resolved.orientation === 'vertical';
  const content = isComposable
    ? <ComposableSlot slot={resolved} />
    : <ScalarText value={first?.value} def={first?.def} appearance={resolved.appearance} />;

  // Color dinámico desde un campo color_hex (texto/fondo vinculado a un slot).
  const fieldColor = slotFieldColorStyle(resolved.appearance, item);

  // display:'badge' → pill/chip (rareza/tipo "Fuego"/"Agua"). Honra el tamaño
  // (appearance.size) vía appearanceTextClasses dentro del pill.
  if (resolved.appearance?.display === 'badge') {
    return (
      <div className={appearancePaddingClass(resolved.appearance)} {...slotDebugAttrs(slot, resolved)}>
        {/* KRO-147 F3 — el badge honra opacity/shadow del slot además de
            color/size/peso (appearanceTextClasses). */}
        <BadgePill className={cn(appearanceTextClasses(resolved.appearance), appearanceEffectClasses(resolved.appearance))} style={fieldColor}>{content}</BadgePill>
      </div>
    );
  }

  // KRO-158 — texto LARGO (textarea/markdown/notes/html): default SIN truncate
  // (el texto completo es el contrato de un body) y conservando los saltos de
  // línea del textarea plano (markdown ya gestiona párrafos via MarkdownText).
  // El publisher puede seguir truncando explícitamente con appearance.truncate.
  const longText = isLongTextField(first?.def);
  return (
    <div
      className={cn(
        'min-w-0',
        !resolved.appearance?.truncate && !longText && 'truncate',
        longText && first?.def?.behavior !== 'markdown' && 'whitespace-pre-wrap',
        appearancePaddingClass(resolved.appearance),
        appearanceTextClasses(resolved.appearance),
        appearanceTruncateClass(resolved.appearance),
      )}
      style={fieldColor}
      {...slotDebugAttrs(slot, resolved)}
    >
      {content}
    </div>
  );
}

/** Render de una hoja (slot) dentro del árbol. */
function SlotLeaf({ slot, ctx }: { slot: string; ctx: NodeCtx }) {
  return <SlotContent slot={slot} composition={ctx.composition} item={ctx.item} fieldDefs={ctx.fieldDefs} cardFormat={ctx.cardFormat} resolveCardRef={ctx.resolveCardRef} onCardRefTap={ctx.onCardRefTap} />;
}

/**
 * Render de un COMPONENTE prefabricado (KRO-133 Capa 2). Lee los slots mapeados
 * a cada rol (`node.slots[role]`) y los compone como una unidad. Reutiliza
 * `SlotContent` por rol → appearance/imagen/refs siguen funcionando. Componente
 * desconocido (versión futura del contrato) → null, no rompe. Espejo Flutter
 * pendiente (KRO-83).
 */
function ComponentNodeView({ node, ctx }: { node: LayoutComponentNode; ctx: NodeCtx }) {
  // KRO-133 — rol OCULTO por el publisher: ese módulo no se pinta (ni placeholder).
  const isHidden = (role: string) => node.hidden?.includes(role) ?? false;
  const roleSlot = (role: string) => {
    if (isHidden(role)) return null;
    const sid = node.slots?.[role];
    if (!sid) return null;
    return <SlotContent slot={sid} composition={ctx.composition} item={ctx.item} fieldDefs={ctx.fieldDefs} cardFormat={ctx.cardFormat} resolveCardRef={ctx.resolveCardRef} onCardRefTap={ctx.onCardRefTap} />;
  };
  // KRO-133 — valor CRUDO de un rol (array completo). Los carruseles necesitan
  // TODO el array (SlotContent colapsa image-array a la 1ª url), así que leen el
  // field resuelto directamente.
  const rawValue = (role: string): unknown => {
    const sid = node.slots?.[role];
    if (!sid) return undefined;
    return resolveSlot(ctx.composition, sid, ctx.fieldDefs, ctx.item)?.fields?.[0]?.value;
  };
  const imageUrls = (role: string): string[] => {
    const raw = rawValue(role);
    if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string');
    return typeof raw === 'string' && raw ? [raw] : [];
  };
  // KRO-133 fidelidad — la etiqueta del campo mapeado (las recetas pintan el
  // label de la galería, p.ej. "BESTIAS"/"GALERÍA"). Resuelve slot→field→def.label.
  const roleLabel = (role: string): string | undefined => {
    const sid = node.slots?.[role];
    const fk = sid ? ctx.composition.slots[sid]?.fields?.[0] : undefined;
    return fk ? ctx.fieldDefs.find(f => f.key === fk)?.label : undefined;
  };
  // Render compartido de un rol de REFERENCIAS (ref_gallery / cards_carousel).
  const renderRefs = (role: string, layout: 'grid' | 'carousel') => {
    const sid = node.slots?.[role];
    if (!sid) return null;
    const refVal = rawValue(role) as Array<string | number> | string | number | undefined;
    const seed = String(Array.isArray(refVal) ? (refVal[0] ?? sid) : (refVal ?? sid));
    const ap = ctx.composition.slots[sid]?.appearance;
    return (
      <RefGallery
        refs={refVal}
        seed={seed}
        cardFormat={ctx.cardFormat}
        nestedComposition={ctx.composition.slots[sid]?.nestedComposition}
        fieldDefs={ctx.fieldDefs}
        layout={layout}
        label={roleLabel(role)}
        resolveRef={ctx.resolveCardRef}
        appearance={ap}
        onRefTap={ap?.refTap === 'focus' ? ctx.onCardRefTap : undefined}
      />
    );
  };

  switch (node.component) {
    case 'card':
      // Carta compuesta: media full-bleed arriba + título/pie/badge en un cuerpo
      // con padding. La unidad visual de un cromo como bloque reutilizable.
      return (
        <div className="rounded-lg overflow-hidden border border-border bg-card shadow-sm">
          {roleSlot('media')}
          <div className="p-2 space-y-1">
            {roleSlot('title')}
            {roleSlot('caption')}
            {roleSlot('badge')}
          </div>
        </div>
      );
    case 'ref_gallery':
      // Galería de cartas referenciadas (rejilla) — con la etiqueta del campo.
      return isHidden('refs') ? null : renderRefs('refs', 'grid');
    // KRO-133 — carruseles de imágenes (mismo render que Hero/Momento/Editorial,
    // vía el componente compartido `ImageGallery`, con la etiqueta del campo).
    case 'carousel_peek':
      return isHidden('images') ? null : <ImageGallery urls={imageUrls('images')} variant="peek" label={roleLabel('images')} />;
    case 'carousel_centered':
      return isHidden('images') ? null : <ImageGallery urls={imageUrls('images')} variant="centered" label={roleLabel('images')} />;
    case 'gallery_grid':
      return isHidden('images') ? null : <ImageGallery urls={imageUrls('images')} variant="grid" label={roleLabel('images')} />;
    // KRO-133 — carrusel de cartas: las mini-cartas de la galería en fila swipe.
    case 'cards_carousel':
      return isHidden('cards') ? null : renderRefs('cards', 'carousel');
    // KRO-133 — separador decorativo: línea corta centrada (el "hr" de las
    // recetas de detalle, p.ej. bajo la fecha de Momento).
    case 'divider':
      return <div className="w-12 h-px bg-border mx-auto" />;
    // KRO-133 — fila de estadísticas: cada campo del slot = valor + etiqueta.
    case 'stats_row': {
      const sid = node.slots?.stats;
      if (!sid) return null;
      const resolved = resolveSlot(ctx.composition, sid, ctx.fieldDefs, ctx.item);
      if (!resolved) return null;
      return <StatsRow fields={resolved.fields} />;
    }
    case 'hero_header': {
      // Cabecera hero FIEL: remapea rol→slotId a los nombres de slot del hero
      // (banner/avatar/title/subtitle) y delega en HeroHeader — el MISMO render
      // que la receta `hero_protagonico` (placeholders + inicial del título).
      // Los roles OCULTOS no se mapean y se le indican a HeroHeader para que
      // tampoco pinte sus placeholders.
      const heroSlots: ViewComposition['slots'] = {};
      for (const role of ['banner', 'avatar', 'title', 'subtitle'] as const) {
        if (isHidden(role)) continue;
        const sid = node.slots?.[role];
        const sc  = sid ? ctx.composition.slots[sid] : undefined;
        if (sc) heroSlots[role] = sc;
      }
      return <HeroHeader composition={{ slots: heroSlots }} item={ctx.item} fieldDefs={ctx.fieldDefs} hiddenSlots={node.hidden} />;
    }
    default:
      return null;
  }
}

export interface ComponentContentProps {
  node:        LayoutComponentNode;
  composition: { slots: ViewComposition['slots']; slotOverrides?: ViewComposition['slotOverrides'] };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  cardFormat?: CardFormat;
  /** KRO-133 — resuelve refs a cartas REALES (foto) en las mini-cartas. */
  resolveCardRef?: CardRefResolver;
  /** KRO-133 — tap en mini-carta (gated por appearance.refTap === 'focus'). */
  onCardRefTap?: (ref: string | number) => void;
}

/**
 * Render PÚBLICO de un componente prefabricado. Exportado para que el canvas del
 * editor de Studio (KRO-133 Capa 2) pinte cada componente con EXACTAMENTE el
 * mismo resultado que el motor de render — WYSIWYG, una sola fuente de verdad
 * (mismo patrón que `SlotContent`).
 */
export function ComponentContent({ node, composition, item, fieldDefs, cardFormat, resolveCardRef, onCardRefTap }: ComponentContentProps) {
  return <ComponentNodeView node={node} ctx={{ composition, item, fieldDefs, cardFormat, resolveCardRef, onCardRefTap }} />;
}

/** Render recursivo de un nodo del árbol. */
function LayoutNodeView({ node, ctx }: { node: LayoutNode; ctx: NodeCtx }) {
  if (node.type === 'slot') return <SlotLeaf slot={node.slot} ctx={ctx} />;
  if (node.type === 'component') return <ComponentNodeView node={node} ctx={ctx} />;

  const isStack = node.kind === 'stack';
  const isGrid  = node.kind === 'grid';
  // Template inline (track sizing): anchos de columna / altos de fila.
  const gridStyle = isGrid
    ? { gridTemplateColumns: gridColumnsTemplate(node), gridTemplateRows: gridRowsTemplate(node) }
    : undefined;
  // Color dinámico (fondo/borde) vinculado a un campo color_hex → estilo inline.
  const surfaceColor = surfaceFieldColorStyle(node.surface, ctx.item);
  const containerStyle = gridStyle || surfaceColor ? { ...gridStyle, ...surfaceColor } : undefined;
  // Con radio, recortamos el contenido para que las esquinas redondeadas se vean
  // (si no, los hijos desbordan y tapan el redondeo).
  const clip = node.surface?.radius && node.surface.radius !== 'none' ? 'overflow-hidden' : undefined;
  // KRO-133 — si algún hijo es ABSOLUTO, el contenedor es el marco de referencia.
  const hasAbsolute = node.children.some(c => c.place?.position === 'absolute');
  return (
    <div className={cn(containerClasses(node), surfaceClasses(node.surface), clip, hasAbsolute && 'relative')} style={containerStyle}>
      {node.children.map((child, i) => {
        // KRO-133 — hijo ABSOLUTO: fuera del flujo, posicionado en x/y (% del
        // contenedor). Para superposiciones libres (arrastrar por el lienzo).
        if (child.place?.position === 'absolute') {
          const pl = child.place;
          return (
            <div
              key={i}
              className="min-w-0"
              style={{
                position: 'absolute',
                left:  `${pl.x ?? 0}%`,
                top:   `${pl.y ?? 0}%`,
                width:  pl.w != null ? `${pl.w}%` : undefined,
                height: pl.h != null ? `${pl.h}%` : undefined,
                zIndex: 20,
              }}
            >
              <LayoutNodeView node={child} ctx={ctx} />
            </div>
          );
        }
        // grow solo aplica en flex; en grid el tamaño lo da el span.
        const grow = !isGrid && child.type === 'slot' && typeof child.grow === 'number' && child.grow > 0
          ? { flexGrow: child.grow }
          : undefined;
        // KRO-133 — clampa la colocación a las columnas del grid → un hijo con
        // colStart fuera de rango NO flota fuera del lienzo (CSS Grid crearía una
        // columna implícita). Las filas crecen solas, no se clampan.
        const childPlace = isGrid ? clampPlaceToGrid(child.place, node.columns ?? 1) : child.place;
        const placement = isGrid ? placementClasses(childPlace) : undefined;
        const selfAlign = isGrid ? selfAlignClasses(childPlace) : undefined;
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
  /** Formato de carta del álbum → columnas/aspect de las rejillas de refs. */
  cardFormat?: CardFormat;
  /** KRO-133 — resuelve refs a cartas REALES (foto) en las mini-cartas. */
  resolveCardRef?: CardRefResolver;
  /** KRO-133 — tap en mini-carta (gated por appearance.refTap === 'focus'). */
  onCardRefTap?: (ref: string | number) => void;
}

/**
 * Punto de entrada del motor de layout. Renderiza `composition.layout` (o el
 * árbol derivado de los slots si no lo trae) dentro del AccentFrame de la receta.
 */
export function LayoutRenderer({
  composition, item, fieldDefs, onClick, className, cardFormat, resolveCardRef, onCardRefTap,
}: LayoutRendererProps) {
  const rawRoot: LayoutContainerNode = composition.layout ?? migrateSlotsToLayout(composition);
  const accent  = extractAccentSettings(composition, item, fieldDefs, 'top');
  const ctx: NodeCtx = { composition, item, fieldDefs, cardFormat, resolveCardRef, onCardRefTap };
  const clickable = !!onClick;
  const isDetail = getRecipeManifest(composition.recipe)?.kind === 'detail';
  // KRO-133 fidelidad — una pantalla de DETALLE es pantalla completa: el nodo
  // RAÍZ nunca lleva esquinas redondeadas, borde NI fondo semántico propio.
  // El radius/border taparían la raya de acento en las esquinas y enmarcarían
  // algo que la pantalla real no muestra; el `background: 'card'` opaco del
  // raíz PINTABA ENCIMA del box-shadow inset del AccentFrame (que vive en el
  // wrapper) → "desaparecía el color de la raya". El wrapper ya provee bg-card.
  // Se neutralizan AQUÍ (no solo en los presets) para cubrir también layouts ya
  // guardados. `bgColor` custom (paleta) y los contenedores INTERNOS se respetan.
  const root: LayoutContainerNode = isDetail && rawRoot.surface
    ? { ...rawRoot, surface: { ...rawRoot.surface, radius: undefined, border: undefined, background: undefined } }
    : rawRoot;
  // KRO-133 fidelidad — el padding default SOLO si el layout raíz no declara su
  // propio `surface`: los presets de detalle traen TARJETA con padding propio
  // (Editorial/Momento/Ficha/Perfil) o son full-bleed por diseño; un p-3 extra
  // alrededor era el "padding a todo" que delataba al motor vs la receta.
  // Sin surface (listas, layouts hechos a mano) se mantiene el p-3 clásico.
  const rootHasSurface = !!root.surface;
  // Las recetas de DETALLE enmarcan con accent width 4 (pantalla protagonista);
  // las de lista con 3. Igualamos según el kind de la receta.
  const accentWidth = isDetail ? 4 : 3;

  return (
    <AccentFrame accent={accent} width={accentWidth}>
      <div
        onClick={onClick}
        className={cn(
          // overflow-hidden en la raíz: nada sobresale del contenedor principal.
          'bg-card overflow-hidden',
          !rootHasSurface && 'p-3',
          // KRO-155 — feedback REAL de tappable (antes `transition-colors` no
          // transicionaba nada): atenúa al hover y hunde+atenúa al presionar.
          // `brightness` funciona sobre cualquier fondo (no reemplaza bg-card).
          clickable && 'cursor-pointer rounded-lg transition hover:brightness-95 active:scale-[0.98] active:brightness-90',
          className,
        )}
      >
        <LayoutNodeView node={root} ctx={ctx} />
      </div>
    </AccentFrame>
  );
}
