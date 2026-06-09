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
  AvatarBox, BannerBox, ComposableSlot, ScalarText,
  resolveSlot, formatScalar, MarkdownText,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, imageFocusStyle, slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
import { NestedRecipeRenderer } from './NestedRecipeRenderer';
import { MiniCardRefs } from './RefGallery';
import { simpleHash } from '../lib/hash';
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
}

export function HeroProtagonicoRecipe({
  composition, item, fieldDefs, className, cardFormat,
}: HeroProtagonicoRecipeProps) {
  const banner   = resolveSlot(composition, 'banner',   fieldDefs, item);
  const avatar   = resolveSlot(composition, 'avatar',   fieldDefs, item);
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const subtitle = resolveSlot(composition, 'subtitle', fieldDefs, item);
  const stats    = resolveSlot(composition, 'stats',    fieldDefs, item);
  const body     = resolveSlot(composition, 'body',     fieldDefs, item);
  const gallery  = resolveSlot(composition, 'gallery',  fieldDefs, item);
  const related  = resolveSlot(composition, 'related',  fieldDefs, item);

  const bannerUrl    = banner?.fields[0]?.value as string | undefined;
  const avatarUrl    = avatar?.fields[0]?.value as string | undefined;
  const titleField   = title?.fields[0];
  const titleText    = String(titleField?.value ?? '');
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
          className={cn(
            'grid grid-flow-col auto-cols-fr gap-2 border-y border-border py-3',
            appearancePaddingClass(stats.appearance),
            appearanceTextClasses(stats.appearance),
          )}
          {...slotDebugAttrs('stats', stats)}
        >
          {stats.fields.map((f, idx) => (
            <div key={idx} className="text-center min-w-0">
              <p className="text-lg font-bold text-foreground tabular-nums truncate">
                {formatScalar(f.value, f.def)}
              </p>
              {f.def?.label && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {f.def.label}
                </p>
              )}
            </div>
          ))}
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {gallery.fields[0]?.def?.label ?? 'Galería'}
          </p>
          {/* Carrusel horizontal con snap — fotos más grandes que el grid 3-col
              anterior. Cada foto ~70% del ancho del frame, aspect 4:3 (formato
              foto natural), scroll horizontal con snap-x para una foto a la
              vez. -mx-5 + px-5 para que el carrusel respire hasta los bordes
              del PhoneFrame sin perder el padding del contenido del hero. */}
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scroll-px-5">
            {galleryUrls
              .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
              .map((url, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-lg bg-muted overflow-hidden shrink-0 snap-start"
                  style={{ width: '70%' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    style={imageFocusStyle(gallery.appearance)}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
          </div>
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
      // completa, no una card. Cuando se renderiza dentro del PhoneFrame
      // del App Preview, el frame ya provee los rounded corners + ring;
      // duplicar aquí creaba un "card dentro de card" visualmente raro.
      // Solo bg-card para fondo, no chrome.
      'bg-card',
      className,
    )}>
      {/* Banner — full-width, aspect 16:9. Si no hay URL, mostramos un
          gradient brand con un patrón abstracto de círculos como en el
          mockup del diseñador (red gradient en España). El hue del
          gradient se deriva del título → cada item tiene un color
          consistente sin necesidad de plumbing de sectionColor. */}
      {bannerUrl
        ? <span {...slotDebugAttrs('banner', banner)} className="block">
            <BannerBox url={bannerUrl} alt="" className="rounded-none" appearance={banner?.appearance} />
          </span>
        : <GradientBanner seed={titleText} />}

      <div className="px-5 pb-5 -mt-12 relative">
        {/* Avatar + Title + Subtitle (HEADER) — siempre en este orden y
            arriba del cuerpo. Define la identidad de la pantalla del item;
            no se reordena con section.fields.
            KRO-69: cada slot pasa su appearance al utility component. */}
        <div className="flex flex-col items-center">
          {/* KRO-69: paddingY del avatar al wrapper. */}
          <div
            className={appearancePaddingClass(avatar?.appearance)}
            {...slotDebugAttrs('avatar', avatar)}
          >
            <AvatarBox
              url={avatarUrl}
              alt={titleText}
              size={96}
              className="ring-4 ring-card shadow-md"
              appearance={avatar?.appearance}
            />
          </div>
          {titleField && (
            <h2
              className={cn(
                'text-2xl font-bold text-foreground mt-3 leading-tight',
                !title?.appearance?.align && 'text-center',
                appearancePaddingClass(title?.appearance),
                appearanceTextClasses(title?.appearance),
                appearanceTruncateClass(title?.appearance),
              )}
              {...slotDebugAttrs('title', title)}
            >
              <ScalarText value={titleField.value} def={titleField.def} appearance={title?.appearance} />
            </h2>
          )}
          {subtitle && (
            <p
              className={cn(
                'text-sm text-muted-foreground mt-1',
                !subtitle.appearance?.align && 'text-center',
                appearancePaddingClass(subtitle.appearance),
                appearanceTextClasses(subtitle.appearance),
                appearanceTruncateClass(subtitle.appearance),
              )}
              {...slotDebugAttrs('subtitle', subtitle)}
            >
              <ComposableSlot slot={subtitle} />
            </p>
          )}
        </div>

        {/* BODY BLOCKS — renderizados en orden de section.fields del primer
            field de cada slot. Si el publisher dragueó cartas_estrella en
            posición 1 y altura_escudo en posición 5, related aparece
            ANTES que stats. */}
        {bodyBlocks.map(b => (
          <div key={b.key} className="mt-5">
            {b.render()}
          </div>
        ))}
      </div>
    </div>
    </AccentFrame>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Banner gradient fallback cuando no hay imagen real. Color principal
 * derivado del hash del título → cada item con un color estable. Patrón
 * abstracto de círculos overlay sutil (5-7% opacity) para textura.
 *
 * Inspirado en el mockup del diseñador: España aparece con un banner rojo
 * con círculos abstractos. Sin imagen real ni configuración de color de
 * sección, derivamos el hue del nombre para tener variedad.
 */
function GradientBanner({ seed }: { seed: string }) {
  const hue = simpleHash(seed) % 360;
  const start = `hsl(${hue}, 65%, 42%)`;
  const end   = `hsl(${(hue + 20) % 360}, 70%, 32%)`;
  return (
    <div
      className="w-full aspect-[16/9] relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)` }}
      aria-hidden
    >
      {/* Patrón abstracto: 3 círculos translúcidos en posiciones distintas */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="170" cy="20" r="35" fill="rgba(255,255,255,0.10)" />
        <circle cx="40"  cy="80" r="50" fill="rgba(255,255,255,0.06)" />
        <circle cx="140" cy="70" r="20" fill="rgba(255,255,255,0.08)" />
      </svg>
    </div>
  );
}

// MiniCardRefs + simpleHash extraídos a `./RefGallery` + `../lib/hash` (KRO-133
// Capa 1) para que el motor de bloques pinte los slots de refs igual que aquí.

