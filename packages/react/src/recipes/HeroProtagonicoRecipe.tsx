'use client';
/**
 * Receta DETALLE `hero_protagonico` — vista hero con banner superior,
 * avatar central destacado, título grande, stats, body markdown, galería
 * y cartas relacionadas. Para vistas hero al abrir un item (e.g. España
 * en la sección Equipos).
 *
 * Slots (ver recipe-registry.ts):
 *   banner    — single, image-banner
 *   avatar    — single, image-avatar
 *   title     — single, text-short
 *   subtitle  — composable horizontal             (opcional)
 *   stats     — composable horizontal (numbers)   (opcional)
 *   body      — single, text-long (markdown)      (opcional)
 *   gallery   — single, image-array               (opcional)
 *   related   — single, card-ref                  (opcional)
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │ [BANNER 16:9]                          │
 *   │   ╭───────╮                            │
 *   │   │ AVATAR│ ← overlap con banner       │
 *   │   ╰───────╯                            │
 *   │     Título grande                      │
 *   │     subtítulo · compose                │
 *   │   ┌──────────┬──────────┬──────────┐   │
 *   │   │  STAT 1  │  STAT 2  │  STAT 3  │   │
 *   │   └──────────┴──────────┴──────────┘   │
 *   │   Body markdown texto largo...         │
 *   │   [Gallery thumb thumb thumb]          │
 *   │   Relacionadas: #4 #5 #6               │
 *   └────────────────────────────────────────┘
 */

import { cn } from '../lib/cn';
import {
  resolveSlot, MarkdownText,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
import { NestedRecipeRenderer } from './NestedRecipeRenderer';
import { MiniCardRefs, type CardRefResolver } from './RefGallery';
import { HeroHeader } from './HeroHeader';
// KRO-217 — stats y galería DELEGAN en los componentes compartidos (apariencia-aware)
// en vez de duplicar markup: StatsRow honra fieldAppearances/caja/efecto e ImageGallery
// honra objectFit/efectos/shape + añade zoom y dots. Antes el Hero los ignoraba.
import { StatsRow } from './StatsRow';
import { ImageGallery } from './ImageGallery';
import { DEFAULT_CARD_FORMAT, type CardFormat } from '@kromia/core';
import type { ViewComposition } from '@kromia/core';

export interface HeroProtagonicoRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
  /** Formato físico de las cartas del álbum. Las mini-cards del slot
   *  `related` deben respetar este aspect (vertical 2:3, horizontal 3:2,
   *  cuadrada 1:1 o panorámica 16:9) para que el preview sea coherente
   *  con la "Estructura de cartas" que el publisher configuró en el step 1
   *  del wizard. Sin esto, las mini-cards asumen 2:3 default. */
  cardFormat?: CardFormat;
  /** KRO-133 — resuelve refs a cartas REALES (foto) en las mini-cartas. */
  resolveCardRef?: CardRefResolver;
  /** KRO-133 — tap en mini-carta (gated por appearance.refTap === 'focus'). */
  onCardRefTap?: (ref: string | number) => void;
  /** KRO-198 — slots a ocultar (banner/avatar/gallery…). Se reenvía a HeroHeader
   *  para que NO pinte ni el banner degradado de placeholder ni el avatar con
   *  inicial. Caso de uso: panel "solo datos" del detalle (la imagen ya es el
   *  hero 3D). El strip de body-slots (gallery) ya lo hizo RecipeRenderer. */
  hiddenSlots?: ReadonlyArray<string>;
}

export function HeroProtagonicoRecipe({
  composition, item, fieldDefs, className, cardFormat, resolveCardRef, onCardRefTap, hiddenSlots,
}: HeroProtagonicoRecipeProps) {
  // Cabecera (banner/avatar/title/subtitle) la resuelve + pinta HeroHeader.
  // Aquí solo el TÍTULO (seed de las mini-cartas) + los slots del CUERPO.
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const stats    = resolveSlot(composition, 'stats',    fieldDefs, item);
  const body     = resolveSlot(composition, 'body',     fieldDefs, item);
  const gallery  = resolveSlot(composition, 'gallery',  fieldDefs, item);
  const related  = resolveSlot(composition, 'related',  fieldDefs, item);

  const titleText    = String(title?.fields[0]?.value ?? '');
  const bodyField    = body?.fields[0];
  const galleryUrls  = gallery?.fields[0]?.value as string[] | undefined;
  const relatedRefs  = related?.fields[0]?.value as Array<string | number> | undefined;

  // KRO-54 follow-up²: orden de los body blocks (stats/body/gallery/related)
  // según la POSICIÓN del primer field de cada slot en section.fields.
  // Header (banner/avatar/title/subtitle) siempre arriba — define la
  // identidad de la pantalla. Pero el cuerpo se reordena dinámicamente
  // para que coincida con el orden que el publisher dragueó en "Campos
  // de la sección" (single source of truth).
  //
  // Ejemplo: si el publisher pone `cartas_estrella` (related slot) en
  // posición 3 y `gallery` (gallery slot) en posición 8 dentro de la
  // sección, el render mostrará Cartas estrella ARRIBA de la galería
  // — antes el related slot iba siempre al final por defecto del recipe.
  const orderMap = new Map(fieldDefs.map((d, i) => [d.key, i]));
  const slotOrder = (slot: typeof stats): number => {
    if (!slot) return Number.MAX_SAFE_INTEGER;
    const firstKey = slot.fields[0]?.key;
    return firstKey ? orderMap.get(firstKey) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  };

  // Lista de body blocks renderizables — cada uno con su index de sección.
  // El primer match en fieldDefs determina la posición en el render.
  const bodyBlocks: Array<{ key: string; order: number; render: () => React.ReactNode }> = [];

  if (stats) {
    bodyBlocks.push({
      key:   'stats',
      order: slotOrder(stats),
      render: () => (
        <div
          className={appearancePaddingClass(stats.appearance)}
          {...slotDebugAttrs('stats', stats)}
        >
          {/* KRO-217 — antes este bloque duplicaba el markup de StatsRow con
              colores fijos (text-foreground/text-muted-foreground) e ignoraba
              fieldAppearances + caja/efecto. Ahora delega → mismo look por
              defecto + el publisher puede teñir cada estadística. */}
          <StatsRow
            fields={stats.fields}
            appearance={stats.appearance}
            fieldAppearances={stats.fieldAppearances}
          />
        </div>
      ),
    });
  }

  if (bodyField && body) {
    bodyBlocks.push({
      key:   'body',
      order: slotOrder(body),
      render: () => (
        <div
          className={cn(
            'text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap',
            appearancePaddingClass(body.appearance),
            appearanceTextClasses(body.appearance),
            appearanceTruncateClass(body.appearance),
          )}
          {...slotDebugAttrs('body', body)}
        >
          {bodyField.def?.behavior === 'markdown'
            ? <MarkdownText text={applyAppearanceTruncate(String(bodyField.value), body.appearance)} />
            : applyAppearanceTruncate(String(bodyField.value), body.appearance)}
        </div>
      ),
    });
  }

  if (gallery && galleryUrls && Array.isArray(galleryUrls) && galleryUrls.length > 0) {
    bodyBlocks.push({
      key:   'gallery',
      order: slotOrder(gallery),
      render: () => (
        <div
          className={appearancePaddingClass(gallery.appearance)}
          {...slotDebugAttrs('gallery', gallery)}
        >
          {/* KRO-217 — antes un carrusel manual con object-cover fijo que ignoraba
              objectFit/efectos/shape del slot y carecía de zoom y dots. ImageGallery
              'peek' es el MISMO carrusel (snap-x, foto ~70%, aspect 4:3) pero honra la
              apariencia + añade zoom táctil + indicador de posición. El antiguo bleed
              -mx-5 a los bordes del frame se va: la galería queda alineada al resto del
              cuerpo del hero (igual que la ruta de layout custom → menos drift). */}
          <ImageGallery
            urls={galleryUrls}
            variant="peek"
            appearance={gallery.appearance}
            label={gallery.fields[0]?.def?.label ?? 'Galería'}
          />
        </div>
      ),
    });
  }

  if (related && relatedRefs && Array.isArray(relatedRefs) && relatedRefs.length > 0) {
    bodyBlocks.push({
      key:   'related',
      order: slotOrder(related),
      render: () => (
        <div
          className={appearancePaddingClass(related.appearance)}
          {...slotDebugAttrs('related', related)}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {related.fields[0]?.def?.label ?? 'Relacionadas'}
          </p>
          {composition.slots.related?.nestedComposition ? (
            <NestedRecipeRenderer
              refs={relatedRefs}
              nestedComposition={composition.slots.related.nestedComposition}
              fieldDefs={fieldDefs}
            />
          ) : (
            <MiniCardRefs
              refs={relatedRefs}
              seed={titleText}
              cardFormat={cardFormat ?? DEFAULT_CARD_FORMAT}
              resolveRef={resolveCardRef}
              appearance={related?.appearance}
              onRefTap={related?.appearance?.refTap === 'focus' ? onCardRefTap : undefined}
            />
          )}
        </div>
      ),
    });
  }

  // Sort por posición del primer field en section.fields. Ties resueltos
  // por orden de declaración en bodyBlocks (stats < body < gallery <
  // related), comportamiento estable.
  bodyBlocks.sort((a, b) => a.order - b.order);

  // KRO-69 follow-up — accent color via AccentFrame (default 'top').
  const accent = extractAccentSettings(composition, item, fieldDefs, 'top');

  return (
    <AccentFrame accent={accent} width={4}>
    <div
      className={cn(
      // Sin border ni rounded propio: la receta DETAIL es una pantalla
      // completa, no una card. El PhoneFrame ya provee rounded+ring. Solo bg-card.
      'bg-card',
      className,
    )}>
      {/* Cabecera (banner + avatar superpuesto + título + subtítulo) — COMPARTIDA
          con el componente de bloques `hero_header` vía HeroHeader, para que la
          versión "diseño por bloques" del detalle la reproduzca IDÉNTICA. */}
      <HeroHeader composition={composition} item={item} fieldDefs={fieldDefs} hiddenSlots={hiddenSlots} />

      {/* BODY BLOCKS — en orden de section.fields del primer field de cada slot.
          (El -mt-12 del solape vive en HeroHeader; el cuerpo fluye debajo igual
          que antes — primer bloque con mt-5 desde el subtítulo.) */}
      {bodyBlocks.length > 0 && (
        <div className="px-5 pb-5">
          {bodyBlocks.map(b => (
            <div key={b.key} className="mt-5">
              {b.render()}
            </div>
          ))}
        </div>
      )}
    </div>
    </AccentFrame>
  );
}

// Cabecera (banner+avatar+título+subtítulo) extraída a `./HeroHeader` (compartida
// con el componente de bloques `hero_header`). MiniCardRefs + simpleHash en
// `./RefGallery` + `../lib/hash` (KRO-133) → el motor de bloques pinta refs igual.

