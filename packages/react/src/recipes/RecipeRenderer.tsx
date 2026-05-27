'use client';
/**
 * RecipeRenderer — punto de entrada único para renderizar una receta.
 *
 * Acepta una `ViewComposition` + datos del item + definiciones de field, y
 * despacha al componente concreto según `composition.recipe`. Si la receta
 * no existe en el catálogo (typing escapa por algún path raro o V2-V4 sin
 * implementar todavía), renderiza un fallback informativo en lugar de
 * crashear.
 *
 * Este wrapper es lo que consume `CardSandbox`, el editor de Studio, y
 * (a futuro) el preview por QR de la app Flutter — todos los call sites
 * pasan por aquí.
 */

import { CompactAvatarRecipe }         from './CompactAvatarRecipe';
import { CompactCardRecipe }           from './CompactCardRecipe';
import { HeroProtagonicoRecipe }       from './HeroProtagonicoRecipe';
import { RowTextRecipe }               from './RowTextRecipe';
import { EditorialRecipe }             from './EditorialRecipe';
import { MomentoRecipe }               from './MomentoRecipe';
import { AccordionSimpleRecipe }       from './AccordionSimpleRecipe';
import { AccordionWithActionsRecipe }  from './AccordionWithActionsRecipe';
import type { FieldDefLike } from '../recipe-utils';
import type { RecipeId, SlotComposition, ViewComposition } from '@kromia/core';
import type { CardFormat } from '@kromia/core';

export interface RecipeRendererProps {
  /**
   * Composición a renderizar. Puede ser:
   *  - Una ViewComposition completa (con recipe + action + slots + opcionales)
   *  - Un sub-objeto { recipe, slots } para las recetas EXPAND (V3) o cuando
   *    el caller solo quiere renderizar el render visual sin acción.
   */
  composition: ViewComposition | { recipe: RecipeId; slots: Record<string, SlotComposition>; action?: undefined };
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  /** Callback al click del item. Disparado para acciones que requieren
   *  abrir algo (navigate_to_detail, modal). El caller decide la diferencia:
   *  navega a otra ruta o abre un overlay. external_link y expand_inline
   *  (V3) las gestionará el wrapper interactivo. */
  onItemClick?: () => void;
  className?:  string;
  /** Formato físico/visual de las cartas del álbum (`2:3` vertical, `3:2`
   *  horizontal, `1:1` cuadrada, `16:9` panorámica). Lo necesitan recetas
   *  que renderizan miniaturas o referencias a OTRAS cartas (ej. los related
   *  cards del hero_protagonico). Sin esto las miniaturas asumen 2:3 default
   *  y se ven incoherentes con un álbum de cartas horizontales. */
  cardFormat?: CardFormat;
}

export function RecipeRenderer({
  composition, item, fieldDefs, onItemClick, className, cardFormat,
}: RecipeRendererProps) {
  // navigate_to_detail, modal y expand_inline disparan onItemClick — la
  // receta no distingue. El wrapper interactivo (RecipeInteractive) decide
  // si abre nueva ruta, overlay o accordion según composition.action.
  // external_link lo gestiona también el wrapper (window.open).
  const isClickAction = 'action' in composition && (
    composition.action === 'navigate_to_detail' ||
    composition.action === 'modal' ||
    composition.action === 'expand_inline' ||
    composition.action === 'external_link'
  );
  const onClick = isClickAction ? onItemClick : undefined;

  // Construimos un objeto compatible con las props específicas de cada receta.
  // Las recetas que reciben ViewComposition completa toleran que falten
  // action/expand/linkField — solo leen `slots`.
  const safeComposition = ('action' in composition && composition.action)
    ? composition as ViewComposition
    : { ...composition, action: 'none' as const } as ViewComposition;

  switch (composition.recipe) {
    case 'compact_avatar':
      return (
        <CompactAvatarRecipe
          composition={safeComposition}
          item={item}
          fieldDefs={fieldDefs}
          onClick={onClick}
          className={className}
        />
      );

    case 'compact_card':
      return (
        <CompactCardRecipe
          composition={safeComposition}
          item={item}
          fieldDefs={fieldDefs}
          onClick={onClick}
          className={className}
        />
      );

    case 'row_text':
      return (
        <RowTextRecipe
          composition={safeComposition}
          item={item}
          fieldDefs={fieldDefs}
          onClick={onClick}
          className={className}
        />
      );

    case 'hero_protagonico':
      return (
        <HeroProtagonicoRecipe
          composition={safeComposition}
          item={item}
          fieldDefs={fieldDefs}
          className={className}
          cardFormat={cardFormat}
        />
      );

    case 'editorial':
      return (
        <EditorialRecipe
          composition={safeComposition}
          item={item}
          fieldDefs={fieldDefs}
          className={className}
        />
      );

    case 'momento':
      return (
        <MomentoRecipe
          composition={safeComposition}
          item={item}
          fieldDefs={fieldDefs}
          className={className}
        />
      );

    case 'accordion_simple':
      return (
        <AccordionSimpleRecipe
          composition={{ recipe: 'accordion_simple', slots: composition.slots }}
          item={item}
          fieldDefs={fieldDefs}
          className={className}
        />
      );

    case 'accordion_with_actions':
      return (
        <AccordionWithActionsRecipe
          composition={{ recipe: 'accordion_with_actions', slots: composition.slots }}
          item={item}
          fieldDefs={fieldDefs}
          className={className}
        />
      );

    // V4: recetas declaradas en el enum pero sin componente todavía.
    default:
      return (
        <div className={className}>
          <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Receta "{composition.recipe}" todavía no implementada en este cliente.
            El cliente caerá a render genérico cuando esté disponible.
          </div>
        </div>
      );
  }
}
