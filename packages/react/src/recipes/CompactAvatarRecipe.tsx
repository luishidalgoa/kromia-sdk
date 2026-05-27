'use client';
/**
 * Receta LISTA `compact_avatar` — avatar circular + título + subtítulo
 * composable + meta lateral. Pensado para listas de personas / entidades
 * con foto/escudo redondo: hermandades, equipos, jugadores, personajes.
 *
 * Slots (ver recipe-registry.ts):
 *   avatar    — single, image-avatar
 *   title     — single, text-short
 *   subtitle  — composable horizontal, text-short/date/number  (opcional)
 *   meta      — single, text-short/date/badge                  (opcional)
 *
 * Layout:
 *   ┌─────┐ Título
 *   │ AV  │ subtítulo · compose                            meta
 *   └─────┘
 */

import { cn } from '../lib/cn';
import {
  AvatarBox, ComposableSlot, ScalarText, StatusDot, resolveSlot,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
import type { ViewComposition } from '@kromia/core';

export interface CompactAvatarRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
  /** Si la composition asocia una acción navigate_to_detail, el caller pasa
   *  un onClick aquí — el renderer no decide el comportamiento, solo lo expone. */
  onClick?:    () => void;
}

export function CompactAvatarRecipe({
  composition, item, fieldDefs, className, onClick,
}: CompactAvatarRecipeProps) {
  const avatar   = resolveSlot(composition, 'avatar',   fieldDefs, item);
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const subtitle = resolveSlot(composition, 'subtitle', fieldDefs, item);
  const meta     = resolveSlot(composition, 'meta',     fieldDefs, item);

  // avatar y title son required en el manifest pero defendemos contra data
  // mal compuesta: si no hay datos, renderizamos placeholder en su lugar.
  const avatarUrl   = avatar?.fields[0]?.value as string | undefined;
  const titleField  = title?.fields[0];
  const metaField   = meta?.fields[0];

  const clickable = !!onClick;
  // KRO-69 follow-up — accent color. AccentFrame se encarga de aplicar el
  // estilo (flat: style inline; rounded: outer wrapper bg color).
  const accent = extractAccentSettings(composition, item, fieldDefs, 'top');

  return (
    <AccentFrame accent={accent} width={3}>
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 bg-card',
        clickable && 'cursor-pointer transition-colors rounded-lg',
        className,
      )}
    >
      {/* KRO-69: appearance per slot. paddingY del avatar va en su wrapper
          (no en el div interior del AvatarBox — no produciría espacio
          alrededor sino dentro de un overflow-hidden). */}
      <div
        className={cn('shrink-0', appearancePaddingClass(avatar?.appearance))}
        {...slotDebugAttrs('avatar', avatar)}
      >
        <AvatarBox
          url={avatarUrl}
          alt={titleField?.value as string ?? ''}
          size={48}
          appearance={avatar?.appearance}
        />
      </div>

      {/* KRO-69 fix: paddingY per-slot, no al wrapper compartido.
          Cada <p> lleva su propio appearancePaddingClass para que el
          espacio afecte solo al slot concreto que el publisher configuró. */}
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

      {/* meta slot — tres formatos según behavior:
          - enum/ordinal_enum/rating → StatusDot lateral (mockup pattern)
          - resto → texto plano muted
          KRO-69 fix: meta NO puede ser shrink-0 porque si su texto es muy
          largo (ej. una frase), empuja el title a width=0 y desaparece.
          Le damos un max-width del 40% del row + truncate para que cap. */}
      {metaField && isStatusDotBehavior(metaField.def?.behavior) ? (
        <span {...slotDebugAttrs('meta', meta)} className="inline-flex">
          <StatusDot value={metaField.value} size={10} />
        </span>
      ) : metaField ? (
        <span
          className={cn(
            'text-xs text-muted-foreground max-w-[40%]',
            !meta?.appearance?.truncate && 'truncate',
            appearancePaddingClass(meta?.appearance),
            appearanceTextClasses(meta?.appearance),
            appearanceTruncateClass(meta?.appearance),
          )}
          {...slotDebugAttrs('meta', meta)}
        >
          <ScalarText value={metaField.value} def={metaField.def} appearance={meta?.appearance} />
        </span>
      ) : null}
    </div>
    </AccentFrame>
  );
}

/** Behaviors cuyo valor representa un estado/categoría — se renderiza como
 *  dot de color lateral en lugar de badge texto. */
function isStatusDotBehavior(behavior: string | undefined): boolean {
  if (!behavior) return false;
  return behavior === 'enum'
      || behavior === 'ordinal_enum'
      || behavior === 'rating';
}
