'use client';
/**
 * Receta LISTA `compact_card` — thumb cuadrada + título + subtítulo +
 * badge de rareza/categoría. Pensado para coleccionables y listas con
 * jerarquía visual (ítems con rareza, tipos de cromo).
 *
 * Slots:
 *   thumb     — single, image-cover (cover o thumbnail behavior)
 *   title     — single, text-short
 *   subtitle  — composable horizontal                  (opcional)
 *   badge     — single, badge (rating/enum/ordinal_enum)(opcional)
 *
 * Layout:
 *   ┌─────┐ Título                         [BADGE]
 *   │THUMB│ subtítulo compose
 *   └─────┘
 */

import { cn } from '../lib/cn';
import {
  ThumbBox, ComposableSlot, ScalarText, BadgeSlot, resolveSlot, isSlotDisabled,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  slotDebugAttrs, extractAccentSettings, AccentFrame, slotImageTransform,
  type FieldDefLike,
} from '../recipe-utils';
import { firstImageUrl } from '@kromia/core';
import type { ViewComposition } from '@kromia/core';

export interface CompactCardRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
  onClick?:    () => void;
}

export function CompactCardRecipe({
  composition, item, fieldDefs, className, onClick,
}: CompactCardRecipeProps) {
  const thumb    = resolveSlot(composition, 'thumb',    fieldDefs, item);
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const subtitle = resolveSlot(composition, 'subtitle', fieldDefs, item);
  const badge    = resolveSlot(composition, 'badge',    fieldDefs, item);

  const thumbUrl   = firstImageUrl(thumb?.fields[0]?.value);
  const titleField = title?.fields[0];
  const badgeField = badge?.fields[0];

  // KRO-58 V5 — thumb desactivado → fila solo-texto (honra slotOverrides.disabled).
  const thumbDisabled = isSlotDisabled(composition, 'thumb');

  const clickable = !!onClick;
  // KRO-69 follow-up — accent color via AccentFrame (flat o rounded).
  const accent = extractAccentSettings(composition, item, fieldDefs, 'top');

  return (
    <AccentFrame accent={accent} width={3}>
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 bg-card',
        clickable && 'cursor-pointer transition-colors rounded-lg',
        className,
      )}
    >
      {/* KRO-69: paddingY del thumb al wrapper.
          KRO-58 V5: omitido entero si el slot está desactivado. */}
      {!thumbDisabled && (
        <div
          className={cn('shrink-0', appearancePaddingClass(thumb?.appearance))}
          {...slotDebugAttrs('thumb', thumb)}
        >
          <ThumbBox
            url={thumbUrl}
            alt={titleField?.value as string ?? ''}
            size={64}
            appearance={thumb?.appearance}
            imageTransform={slotImageTransform(thumb, item)}
          />
        </div>
      )}

      {/* KRO-69 fix: paddingY per-slot, no al wrapper compartido. */}
      <div className="flex-1 min-w-0">
        {titleField && (
          <p
            className={cn(
              'font-semibold text-foreground leading-tight',
              !title?.appearance?.truncate && 'truncate',
              appearancePaddingClass(title?.appearance),
              appearanceTextClasses(title?.appearance),
              appearanceTruncateClass(title?.appearance),
            )}
            {...slotDebugAttrs('title', title)}
          >
            <ScalarText value={titleField.value} def={titleField.def} appearance={title?.appearance} />
          </p>
        )}
        {subtitle && (
          <p
            className={cn(
              'text-sm text-muted-foreground leading-tight mt-0.5',
              !subtitle.appearance?.truncate && 'truncate',
              appearancePaddingClass(subtitle?.appearance),
              appearanceTextClasses(subtitle.appearance),
              appearanceTruncateClass(subtitle.appearance),
            )}
            {...slotDebugAttrs('subtitle', subtitle)}
          >
            <ComposableSlot slot={subtitle} />
          </p>
        )}
      </div>

      {/* KRO-69: badge no debe ser shrink-0 forzado; max-w cap + truncate.
          KRO-217 — el badge DELEGA en el componente compartido BadgeSlot (mismo
          que usa el motor de bloques en SlotContent): honra opacity/shadow + color
          DINÁMICO (color_hex) + peso/font/color/size, y AHORA también el `align`
          en el bloque (antes quedaba inerte en la pastilla → bugfix de consistencia).
          El `max-w-[35%]` + truncate de la lista compacta van por `wrapperClassName`. */}
      {badgeField && (
        <BadgeSlot
          appearance={badge?.appearance}
          item={item}
          debugSlot="badge"
          debugValue={badge}
          wrapperClassName={cn('max-w-[35%]', !badge?.appearance?.truncate && 'truncate', appearanceTruncateClass(badge?.appearance))}
        >
          <ScalarText value={badgeField.value} def={badgeField.def} appearance={badge?.appearance} />
        </BadgeSlot>
      )}
    </div>
    </AccentFrame>
  );
}
