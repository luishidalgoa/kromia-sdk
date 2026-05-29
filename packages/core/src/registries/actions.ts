/**
 * Action Registry — catálogo de las acciones que un publisher puede asociar
 * a una receta de lista. Define qué pasa cuando el coleccionista toca un item.
 *
 * Source-of-truth para:
 *  - El selector "Acción al tocar" en el editor (Studio).
 *  - El cliente Flutter (KRO-65) que implementa cada transición.
 *  - El generator del KRP (`src/generate.ts`).
 *
 * Reglas:
 *  - Los IDs son **estables**: lo que se serializa en BD como
 *    `composition.action`. Renombrar = breaking change.
 *  - Constraint flags (`requiresTargetRecipe`, etc.) determinan qué
 *    campos adicionales debe declarar la composition. El validador
 *    en `viewCompositionValidator.ts` (Studio) las enforza.
 *
 * Ver también:
 *  - `recipes.ts` — kind: 'detail' (puede ser target),
 *    kind: 'expand' (puede ser expand-target).
 *  - `behaviors.ts` — url/email/phone → fields elegibles para
 *    `linkField` cuando action = external_link.
 *  - `kromia-sdk/playbooks/add-action.md`.
 */

import type { EncyclopediaDoc } from './encyclopedia-doc';

export interface ActionDefinition extends EncyclopediaDoc {
  /** ID técnico, lo que se almacena en BD como `composition.action`. */
  id: string;
  /** Nombre castellano para el dropdown del Studio. */
  displayName: string;
  /** Frase corta para tooltip + onboarding + wiki. */
  description: string;
  /** Tipo de transición visual que dispara la action en el cliente. */
  transition: 'static' | 'push' | 'modal' | 'inline' | 'external';
  /** Si true, la composition DEBE declarar `targetRecipe`. */
  requiresTargetRecipe?: boolean;
  /** Si requiresTargetRecipe, qué kind de recipe se permite como target. */
  targetRecipeKind?: 'detail';
  /** Si true, la composition DEBE declarar `expand` (mini-receta). */
  requiresExpandRecipe?: boolean;
  /** Si true, la composition DEBE declarar `linkField` (key del field con URL). */
  requiresLinkField?: boolean;
}

const ACTIONS: ActionDefinition[] = [
  {
    id:          'none',
    displayName: 'Ninguna',
    description: 'El item es informativo, no responde al tap.',
    transition:  'static',
    whenToUse:
      'Para datos que no tienen "siguiente paso" (el nombre, una estadística, una bio). Si el slot necesita abrir algo, elige otra acción.',
    related: ['action:navigate_to_detail', 'action:modal'],
    aliases: ['sin acción', 'informativo', 'estático'],
  },
  {
    id:                   'navigate_to_detail',
    displayName:          'Navegar al detalle',
    description:          'Push de una nueva pantalla con la receta de detalle declarada en targetRecipe.',
    transition:           'push',
    requiresTargetRecipe: true,
    targetRecipeKind:     'detail',
    whenToUse:
      'En recetas de lista (CompactAvatar, CompactCard, RowText) cuando quieres que el publisher abra la carta completa al tocarla. La receta de detalle se elige en `targetRecipe`.',
    long: `Requiere \`targetRecipe\` definido en el slot. Sin él, la validación devuelve error en \`/albums/new\`.`,
    related: ['action:modal', 'recipe:hero_protagonico', 'concept:nested-recipe'],
    aliases: ['abrir detalle', 'push', 'navegar'],
  },
  {
    id:                   'modal',
    displayName:          'Modal overlay',
    description:          'Bottom sheet con la receta de detalle declarada en targetRecipe (no abandona la lista).',
    transition:           'modal',
    requiresTargetRecipe: true,
    targetRecipeKind:     'detail',
    whenToUse:
      'Cuando quieres que el publisher vea el detalle sin perder la lista de fondo (quick view, vista rápida). Para una experiencia "full page", usa `navigate_to_detail`.',
    related: ['action:navigate_to_detail', 'action:expand_inline'],
    aliases: ['overlay', 'bottom sheet', 'vista rápida'],
  },
  {
    id:                   'expand_inline',
    displayName:          'Expandir inline',
    description:          'Mini-receta (accordion) desplegada bajo el item — la composition debe declarar `expand`.',
    transition:           'inline',
    requiresExpandRecipe: true,
    whenToUse:
      'Para acordeones, FAQs, datos que conviven en la misma pantalla. Se usa con recetas AccordionSimple/AccordionWithActions.',
    related: ['recipe:accordion_simple', 'recipe:accordion_with_actions', 'action:modal'],
    aliases: ['accordion', 'acordeón', 'expandir'],
  },
  {
    id:                'external_link',
    displayName:       'Enlace externo',
    description:       'Abre la URL contenida en el field declarado en linkField (behavior url/email/phone).',
    transition:        'external',
    requiresLinkField: true,
    whenToUse:
      'Para enlaces a webs oficiales, perfiles de redes, fichas externas. El field referenciado debe ser una URL válida (behavior `url`).',
    long: `En el AppPreview se muestra como un **toast in-frame** ("Abriría enlace: …") para no abrir window.open durante el editing — la app cliente real (Flutter) sí abre el navegador del sistema.`,
    related: ['behavior:url', 'action:navigate_to_detail'],
    aliases: ['enlace externo', 'link externo', 'url'],
  },
];

const ACTIONS_BY_ID = Object.fromEntries(
  ACTIONS.map(a => [a.id, a]),
) as Record<string, ActionDefinition>;

/** Acceso por ID. `undefined` si la action no está en el catálogo. */
export function getAction(id: string): ActionDefinition | undefined {
  return ACTIONS_BY_ID[id];
}

/** Catálogo completo en orden de declaración. */
export function allActions(): ReadonlyArray<ActionDefinition> {
  return ACTIONS;
}

/** Lista de IDs. */
export const ACTION_IDS = ACTIONS.map(a => a.id) as ReadonlyArray<string>;
