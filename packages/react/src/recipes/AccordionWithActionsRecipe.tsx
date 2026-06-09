'use client';
/**
 * Receta EXPAND `accordion_with_actions` (KRO-42 V3) — cuerpo + botones URL.
 *
 * Para items con CTAs (redes sociales, descargas, recursos, links a web).
 * Cada field del slot `actions` debe tener behavior `url`/`email`/`phone`.
 *
 * Slots:
 *   body    — single, text-long
 *   actions — composable, url (1-N fields, cada uno un botón)
 *
 * Layout:
 *   ┌─ (card LIST de arriba) ──────────────┐
 *   │  ▼ Body markdown                     │
 *   │     [↗ Twitter] [↗ Web] [✉ Email]    │
 *   └──────────────────────────────────────┘
 */

import { cn } from '../lib/cn';
import { ExternalLink, Mail, Phone } from 'lucide-react';
import {
  resolveSlot,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, slotDebugAttrs, extractAccentSettings, AccentFrame, MarkdownText,
  type FieldDefLike,
} from '../recipe-utils';
import type { ViewComposition } from '@kromia/core';

export interface AccordionWithActionsRecipeProps {
  composition: { recipe: 'accordion_with_actions' } & Pick<ViewComposition, 'slots'>;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
}

function actionIcon(behavior?: string) {
  if (behavior === 'email') return Mail;
  if (behavior === 'phone') return Phone;
  return ExternalLink;
}

function actionHref(value: string, behavior?: string) {
  if (behavior === 'email') return `mailto:${value}`;
  if (behavior === 'phone') return `tel:${value}`;
  return value;
}

export function AccordionWithActionsRecipe({
  composition, item, fieldDefs, className,
}: AccordionWithActionsRecipeProps) {
  const body    = resolveSlot(composition, 'body',    fieldDefs, item);
  const actions = resolveSlot(composition, 'actions', fieldDefs, item);
  const bodyField = body?.fields[0];

  const validActions = (actions?.fields ?? []).filter(f =>
    typeof f.value === 'string' && f.value.trim() !== ''
  );
  // KRO-69 follow-up — accent color con position override (default 'left'
  // porque accordion va anidado).
  const accent = extractAccentSettings(composition, item, fieldDefs, 'left');

  if (!bodyField && validActions.length === 0) {
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
        'px-4 py-3 space-y-3 bg-muted/30 border-t border-border',
        className,
      )}
    >
      {bodyField && (
        <div
          className={cn(
            'text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap',
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

      {validActions.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap gap-1.5',
            appearancePaddingClass(actions?.appearance),
          )}
          {...slotDebugAttrs('actions', actions)}
        >
          {validActions.map((f, i) => {
            const Icon = actionIcon(f.def?.behavior);
            const href = actionHref(String(f.value), f.def?.behavior);
            return (
              <a
                key={i}
                href={href}
                target={f.def?.behavior === 'url' ? '_blank' : undefined}
                rel={f.def?.behavior === 'url' ? 'noopener noreferrer' : undefined}
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-card border border-border hover:bg-accent hover:border-primary/40 transition-colors"
              >
                <Icon className="h-3 w-3" />
                {f.def?.label ?? f.key}
              </a>
            );
          })}
        </div>
      )}
    </div>
    </AccentFrame>
  );
}
