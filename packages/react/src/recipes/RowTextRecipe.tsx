'use client';
/**
 * Receta LISTA `row_text` — una sola línea: título + subtítulo composable a la
 * derecha. Sin imagen. Para listas densas tipo FAQ, días, partidos, horarios.
 *
 * Slots:
 *   title     — single, text-short
 *   subtitle  — composable horizontal, text-short/date/number (opcional)
 *
 * Layout:
 *   Título principal del item               subtítulo · compose
 */

import { cn } from '../lib/cn';
import {
  ComposableSlot, ScalarText, resolveSlot,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
import type { ViewComposition } from '@kromia/core';

export interface RowTextRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
  onClick?:    () => void;
}

export function RowTextRecipe({
  composition, item, fieldDefs, className, onClick,
}: RowTextRecipeProps) {
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const subtitle = resolveSlot(composition, 'subtitle', fieldDefs, item);

  const titleField = title?.fields[0];
  const clickable  = !!onClick;
  // KRO-69 follow-up — accent color via AccentFrame (default 'left').
  const accent = extractAccentSettings(composition, item, fieldDefs, 'left');

  return (
    <AccentFrame accent={accent} width={3}>
    <div
      onClick={onClick}
      className={cn(
        'flex items-baseline gap-3 px-3 py-2 border-b border-border/60 last:border-b-0',
        clickable && 'cursor-pointer transition-colors',
        className,
      )}
    >
      {/* KRO-69 fix: text-align en el <p> padre; paddingY del slot al wrapper. */}
      {titleField && (
        <p
          className={cn(
            'flex-1 min-w-0 font-medium text-foreground leading-tight',
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
      {/* KRO-69 fix: subtitle no debe ser shrink-0 si su texto es largo
          (empujaría título a width=0). Le damos max-w-[50%] + truncate. */}
      {subtitle && (
        <p
          className={cn(
            'text-sm text-muted-foreground leading-tight max-w-[50%]',
            !subtitle.appearance?.truncate && 'truncate',
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
    </AccentFrame>
  );
}
