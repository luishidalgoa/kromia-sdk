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
 *  - `kromia-protocol/playbooks/add-action.md`.
 */

export interface ActionDefinition {
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
  },
  {
    id:                   'navigate_to_detail',
    displayName:          'Navegar al detalle',
    description:          'Push de una nueva pantalla con la receta de detalle declarada en targetRecipe.',
    transition:           'push',
    requiresTargetRecipe: true,
    targetRecipeKind:     'detail',
  },
  {
    id:                   'modal',
    displayName:          'Modal overlay',
    description:          'Bottom sheet con la receta de detalle declarada en targetRecipe (no abandona la lista).',
    transition:           'modal',
    requiresTargetRecipe: true,
    targetRecipeKind:     'detail',
  },
  {
    id:                   'expand_inline',
    displayName:          'Expandir inline',
    description:          'Mini-receta (accordion) desplegada bajo el item — la composition debe declarar `expand`.',
    transition:           'inline',
    requiresExpandRecipe: true,
  },
  {
    id:                'external_link',
    displayName:       'Enlace externo',
    description:       'Abre la URL contenida en el field declarado en linkField (behavior url/email/phone).',
    transition:        'external',
    requiresLinkField: true,
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
