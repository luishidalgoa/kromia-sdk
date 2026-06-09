'use client';
/**
 * Receta EXPAND `accordion_simple` (KRO-42 V3) — solo cuerpo de texto.
 *
 * Se renderiza desplegada bajo la card de LISTA cuando el coleccionista
 * toca con `action='expand_inline'`. Para descripciones largas que no
 * caben en `subtitle` pero no merecen una pantalla de detalle aparte.
 *
 * Slots:
 *   body — single, text-long (markdown / notes / html)
 *
 * Layout:
 *   ┌─ (card LIST de arriba) ──┐
 *   │  ▼ Body markdown que     │
 *   │     respira con          │
 *   │     párrafos largos      │
 *   └──────────────────────────┘
 */

import { cn } from '../lib/cn';
import {
  resolveSlot,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, slotDebugAttrs, extractAccentSettings, AccentFrame, MarkdownText,
  type FieldDefLike,
} from '../recipe-utils';
import type { ViewComposition } from '@kromia/core';

export interface AccordionSimpleRecipeProps {
  /** La composition aquí es la del expand (composition.expand), NO la lista. */
  composition: { recipe: 'accordion_simple' } & Pick<ViewComposition, 'slots'>;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
}

export function AccordionSimpleRecipe({
  composition, item, fieldDefs, className,
}: AccordionSimpleRecipeProps) {
  const body = resolveSlot(composition, 'body', fieldDefs, item);
  const bodyField = body?.fields[0];
  // KRO-69 follow-up — accent color con position override (default 'left'
  // porque accordion va anidado y left distingue mejor del padre).
  const accent = extractAccentSettings(composition, item, fieldDefs, 'left');

  if (!bodyField) {
    return (
      <div className={cn(
        'px-4 py-3 text-xs text-muted-foreground italic',
        className,
      )}>
        Sin contenido para mostrar.
      </div>
    );
  }

  return (
    <AccentFrame accent={accent} width={3}>
    <div
      className={cn(
        'px-4 py-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap',
        'bg-muted/30 border-t border-border',
        appearancePaddingClass(body.appearance),
        appearanceTextClasses(body.appearance),
        appearanceTruncateClass(body.appearance),
        className,
      )}
      {...slotDebugAttrs('body', body)}
    >
      {/* KRO-133 — honra markdown inline (antes mostraba `**negrita**` literal). */}
      {bodyField.def?.behavior === 'markdown'
        ? <MarkdownText text={applyAppearanceTruncate(String(bodyField.value), body.appearance)} />
        : applyAppearanceTruncate(String(bodyField.value), body.appearance)}
    </div>
    </AccentFrame>
  );
}
