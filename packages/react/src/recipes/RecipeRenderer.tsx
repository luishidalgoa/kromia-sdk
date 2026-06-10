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
import { LayoutRenderer }              from './LayoutRenderer';
import type { CardRefResolver }        from './RefGallery';
import { recipeToComposition }         from '@kromia/core';
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
  /** KRO-133 — resuelve refs a cartas REALES (foto) en las mini-cartas de
   *  los slots card-ref. Lo inyecta el host (Studio/Flutter); sin él, las
   *  mini-cartas pintan el placeholder degradado de siempre. */
  resolveCardRef?: CardRefResolver;
  /** KRO-133 — tap en una mini-carta de refs (gated por appearance.refTap). */
  onCardRefTap?: (ref: string | number) => void;
}

export function RecipeRenderer({
  composition, item, fieldDefs, onItemClick, className, cardFormat, resolveCardRef, onCardRefTap,
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

  // KRO-133 F2 — si la composición trae un árbol de LAYOUT explícito (lo compuso
  // el publisher en el canvas DnD, o es un preset de F5), lo renderiza el MOTOR
  // GENÉRICO. Si no, caemos a los componentes de receta hardcodeados de siempre
  // (backward-compat 100%: las composiciones existentes no traen `layout`).
  if ('layout' in safeComposition && safeComposition.layout) {
    return (
      <LayoutRenderer
        composition={safeComposition}
        item={item}
        fieldDefs={fieldDefs}
        onClick={onClick}
        className={className}
        cardFormat={cardFormat}
        resolveCardRef={resolveCardRef}
        onCardRefTap={onCardRefTap}
      />
    );
  }

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
          resolveCardRef={resolveCardRef}
          onCardRefTap={onCardRefTap}
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

    // KRO-133 V5 — recetas "block-native": sin componente React, su layout es un
    // preset del sistema de bloques (recipe-presets). Lo derivamos y lo pinta el
    // MOTOR GENÉRICO (LayoutRenderer). Cubre las recetas nuevas (feature_card,
    // split_panel, stat_tile, cover_band) y cualquier receta futura con preset:
    // `recipeToComposition` cae a un grid naíf si no hay preset, así que siempre
    // renderiza algo razonable en vez del antiguo placeholder ámbar.
    default: {
      const withLayout = recipeToComposition(safeComposition);
      return (
        <LayoutRenderer
          composition={withLayout}
          item={item}
          fieldDefs={fieldDefs}
          onClick={onClick}
          className={className}
          cardFormat={cardFormat}
          resolveCardRef={resolveCardRef}
          onCardRefTap={onCardRefTap}
        />
      );
    }
  }
}
