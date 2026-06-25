'use client';
/**
 * Receta DETALLE `editorial` — artículo con cover + título grande + meta + body
 * markdown + galería opcional. Para historias largas: artículos de hermandades,
 * crónicas de partidos, reportajes editoriales del álbum.
 *
 * Slots:
 *   cover    — single, image-cover
 *   title    — single, text-short
 *   meta     — composable horizontal, date/text (opcional) — autor · fecha
 *   body     — single, text-long (markdown)
 *   gallery  — single, image-array              (opcional)
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │ [COVER ancha 16:9]                     │
 *   │ Título grande                          │
 *   │ autor · fecha                          │
 *   │                                        │
 *   │ Body markdown texto largo respirando   │
 *   │ con párrafos, énfasis tipográfico...   │
 *   │                                        │
 *   │ [Galería grid 3x]                      │
 *   └────────────────────────────────────────┘
 */

import { cn } from '../lib/cn';
import {
  BannerBox, ComposableSlot, ScalarText,
  resolveSlot, isSlotDisabled, MarkdownText,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, slotDebugAttrs, extractAccentSettings, AccentFrame,
  slotImageTransform,
  type FieldDefLike,
} from '../recipe-utils';
// KRO-217 — la galería DELEGA en ImageGallery (apariencia-aware) en vez de
// duplicar el grid manual: honra objectFit/efectos/shape, muestra «+N» si hay
// más de 6 (antes recortaba en silencio) y añade zoom.
import { ImageGallery } from './ImageGallery';
import type { ViewComposition } from '@kromia/core';

export interface EditorialRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
}

export function EditorialRecipe({
  composition, item, fieldDefs, className,
}: EditorialRecipeProps) {
  const cover    = resolveSlot(composition, 'cover',   fieldDefs, item);
  const title    = resolveSlot(composition, 'title',   fieldDefs, item);
  const meta     = resolveSlot(composition, 'meta',    fieldDefs, item);
  const body     = resolveSlot(composition, 'body',    fieldDefs, item);
  const gallery  = resolveSlot(composition, 'gallery', fieldDefs, item);

  const coverUrl    = cover?.fields[0]?.value as string | undefined;
  const titleField  = title?.fields[0];
  const bodyField   = body?.fields[0];
  const galleryUrls = gallery?.fields[0]?.value as string[] | undefined;

  // KRO-69 follow-up — accent color via AccentFrame (default 'top').
  const accent = extractAccentSettings(composition, item, fieldDefs, 'top');

  return (
    <AccentFrame accent={accent} width={4}>
    <article
      className={cn(
        // KRO-133 — sin `border` ni `rounded`: la receta DETAIL es pantalla
        // completa (el marco lo pone el PhoneFrame); el borde gris y las
        // esquinas inferiores delataban una "tarjeta" que no existe.
        'bg-card overflow-hidden',
        className,
      )}
    >
      {/* Cover full-width 16:9. KRO-69: cover honra appearance shape/aspect.
          KRO-58 V5: omitido si el slot cover está desactivado → el detalle
          arranca directo por el título (artículo sin cabecera).
          KRO-133 fix — también omitido si el slot NO tiene campos mapeados
          (`cover` null): antes pintaba una caja bg-muted VACÍA de 16:9 que el
          publisher no podía ni rellenar ni quitar desde el editor. */}
      {cover && !isSlotDisabled(composition, 'cover') && (
        <span {...slotDebugAttrs('cover', cover)} className="block">
          <BannerBox url={coverUrl} alt="" className="rounded-none" appearance={cover?.appearance} imageTransform={slotImageTransform(cover, item)} />
        </span>
      )}

      <div className="px-5 py-5 space-y-3">
        {titleField && (
          <h2
            className={cn(
              'text-2xl font-serif font-bold text-foreground leading-tight',
              appearancePaddingClass(title?.appearance),
              appearanceTextClasses(title?.appearance),
              appearanceTruncateClass(title?.appearance),
            )}
            {...slotDebugAttrs('title', title)}
          >
            <ScalarText value={titleField.value} def={titleField.def} appearance={title?.appearance} />
          </h2>
        )}

        {meta && (
          <p
            className={cn(
              'text-xs uppercase tracking-wider text-muted-foreground',
              appearancePaddingClass(meta.appearance),
              appearanceTextClasses(meta.appearance),
              appearanceTruncateClass(meta.appearance),
            )}
            {...slotDebugAttrs('meta', meta)}
          >
            <ComposableSlot slot={meta} />
          </p>
        )}

        {bodyField && (
          <div
            className={cn(
              'text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap pt-2 border-t border-border',
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

        {gallery && galleryUrls && Array.isArray(galleryUrls) && galleryUrls.length > 0 && (
          <div className="pt-3" {...slotDebugAttrs('gallery', gallery)}>
            <ImageGallery
              urls={galleryUrls}
              variant="grid"
              appearance={gallery.appearance}
              label={gallery.fields[0]?.def?.label ?? 'Galería'}
            />
          </div>
        )}
      </div>
    </article>
    </AccentFrame>
  );
}
