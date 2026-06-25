'use client';
/**
 * Receta DETALLE `momento` — pieza centrada en una fecha. Fecha enorme arriba,
 * título y subtítulo, body opcional, slideshow opcional. Para días históricos,
 * partidos, momentos fundacionales, efemérides.
 *
 * Slots:
 *   date       — single, date (iso_date o year)           [prominente]
 *   title      — single, text-short
 *   subtitle   — single, text-short                       (opcional)
 *   body       — single, text-long (markdown)             (opcional)
 *   slideshow  — single, image-array (gallery/slideshow)  (opcional)
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │           14/jul/1789                  │  ← fecha hero
 *   │     ─────────────────────              │
 *   │     Toma de la Bastilla                │  ← título centrado
 *   │     París, Francia                     │  ← subtítulo
 *   │                                        │
 *   │     Body markdown respirando...        │
 *   │                                        │
 *   │     [Slideshow ancho horizontal]       │
 *   └────────────────────────────────────────┘
 */

import { cn } from '../lib/cn';
import {
  ComposableSlot, ScalarText, formatScalar,
  resolveSlot, MarkdownText,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
// KRO-217 — el slideshow DELEGA en ImageGallery (apariencia-aware) en vez de
// duplicar el carrusel: honra objectFit/efectos/shape + añade zoom y dots.
import { ImageGallery } from './ImageGallery';
import type { ViewComposition } from '@kromia/core';

export interface MomentoRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
}

export function MomentoRecipe({
  composition, item, fieldDefs, className,
}: MomentoRecipeProps) {
  const date      = resolveSlot(composition, 'date',      fieldDefs, item);
  const title     = resolveSlot(composition, 'title',     fieldDefs, item);
  const subtitle  = resolveSlot(composition, 'subtitle',  fieldDefs, item);
  const body      = resolveSlot(composition, 'body',      fieldDefs, item);
  const slideshow = resolveSlot(composition, 'slideshow', fieldDefs, item);

  const dateField     = date?.fields[0];
  const titleField    = title?.fields[0];
  const subtitleField = subtitle?.fields[0];
  const bodyField     = body?.fields[0];
  const slideshowUrls = slideshow?.fields[0]?.value as string[] | undefined;

  // Fecha formateada con el formatter por behavior — iso_date → "14/07/1789",
  // year → "1789".
  const dateLabel = dateField ? formatScalar(dateField.value, dateField.def) : '';

  // KRO-69 follow-up — accent color via AccentFrame (default 'top').
  const accent = extractAccentSettings(composition, item, fieldDefs, 'top');

  return (
    <AccentFrame accent={accent} width={4}>
    <div
      className={cn(
        // KRO-133 — sin `border` ni `rounded`: la receta DETAIL es pantalla
        // completa (el marco lo pone el PhoneFrame); el AccentFrame ya enmarca
        // con el acento y las esquinas inferiores delataban una "tarjeta".
        'bg-card overflow-hidden',
        className,
      )}
    >
      <div className="px-5 py-6 text-center space-y-2">
        {dateLabel && (
          <p
            className={cn(
              'text-3xl font-bold tracking-tight text-primary tabular-nums',
              appearancePaddingClass(date?.appearance),
              appearanceTextClasses(date?.appearance),
              appearanceTruncateClass(date?.appearance),
            )}
            {...slotDebugAttrs('date', date)}
          >
            {dateLabel}
          </p>
        )}
        <div className="w-12 h-px bg-border mx-auto" />

        {titleField && (
          <h2
            className={cn(
              'text-xl font-bold text-foreground leading-tight',
              appearancePaddingClass(title?.appearance),
              appearanceTextClasses(title?.appearance),
              appearanceTruncateClass(title?.appearance),
            )}
            {...slotDebugAttrs('title', title)}
          >
            <ScalarText value={titleField.value} def={titleField.def} appearance={title?.appearance} />
          </h2>
        )}
        {subtitleField && (
          <p
            className={cn(
              'text-sm text-muted-foreground',
              appearancePaddingClass(subtitle?.appearance),
              appearanceTextClasses(subtitle?.appearance),
              appearanceTruncateClass(subtitle?.appearance),
            )}
            {...slotDebugAttrs('subtitle', subtitle)}
          >
            <ScalarText value={subtitleField.value} def={subtitleField.def} appearance={subtitle?.appearance} />
          </p>
        )}
      </div>

      {bodyField && (
        <div
          className={cn(
            'px-5 pb-5 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap',
            appearancePaddingClass(body?.appearance),
            appearanceTextClasses(body?.appearance),
            appearanceTruncateClass(body?.appearance),
          )}
          {...slotDebugAttrs('body', body)}
        >
          {bodyField.def?.behavior === 'markdown'
            ? <MarkdownText text={applyAppearanceTruncate(String(bodyField.value), body?.appearance)} />
            : applyAppearanceTruncate(String(bodyField.value), body?.appearance)}
        </div>
      )}

      {slideshow && slideshowUrls && Array.isArray(slideshowUrls) && slideshowUrls.length > 0 && (
        <div
          className={cn('px-5 pb-5', appearancePaddingClass(slideshow.appearance))}
          {...slotDebugAttrs('slideshow', slideshow)}
        >
          {/* KRO-217 — slideshow horizontal (móvil swipe). Antes object-cover fijo
              que ignoraba objectFit/efectos/shape. ImageGallery 'centered' es el
              mismo carrusel (snap-center, w-64, aspect 4:3) honrando la apariencia. */}
          <ImageGallery
            urls={slideshowUrls}
            variant="centered"
            appearance={slideshow.appearance}
          />
        </div>
      )}
    </div>
    </AccentFrame>
  );
}
