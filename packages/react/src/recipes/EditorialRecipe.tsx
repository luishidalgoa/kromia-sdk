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
  applyAppearanceTruncate, imageFocusStyle, slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
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
        'rounded-xl border border-border bg-card overflow-hidden',
        className,
      )}
    >
      {/* Cover full-width 16:9. KRO-69: cover honra appearance shape/aspect.
          KRO-58 V5: omitido si el slot cover está desactivado → el detalle
          arranca directo por el título (artículo sin cabecera). */}
      {!isSlotDisabled(composition, 'cover') && (
        <span {...slotDebugAttrs('cover', cover)} className="block">
          <BannerBox url={coverUrl} alt="" className="rounded-none" appearance={cover?.appearance} />
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
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              {gallery.fields[0]?.def?.label ?? 'Galería'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {galleryUrls
                .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
                .slice(0, 6)
                .map((url, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-muted overflow-hidden">
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
        )}
      </div>
    </article>
    </AccentFrame>
  );
}
