/**
 * `target-chain.ts` — KRO-94 Fase B.
 *
 * Normaliza una `ViewComposition` a su CADENA de pantallas destino (los saltos
 * tras la pantalla raíz/lista), unificando el modelo legacy single-hop
 * (`targetRecipe`/`expand`/`linkField`) y el nuevo multi-salto
 * (`targetComposition` recursivo).
 *
 * Puro y determinista. Es la fuente de verdad del recorrido de la cadena → el
 * canvas de Studio y el renderer de Flutter (cuando lo espeje) deben producir
 * los MISMOS saltos a partir de la misma composición.
 */

import type { ViewComposition, TargetComposition, ActionId, RecipeId } from './types';

/**
 * Profundidad máxima de la cadena = nº de pantallas destino tras la lista.
 * 4 ⇒ lista → A → B → C → D. El validador marca error si se excede; el
 * resolver corta defensivamente para no colgarse ante datos corruptos/cíclicos.
 */
export const MAX_TARGET_DEPTH = 4;

/** Acciones que ABREN una pantalla nueva (encadenable o terminal). */
const NAVIGATING_ACTIONS: ReadonlySet<ActionId> = new Set<ActionId>([
  'navigate_to_detail',
  'modal',
  'expand_inline',
  'external_link',
]);

/** Un salto resuelto de la cadena (pantalla destino + cómo se llegó a ella). */
export interface ResolvedHop {
  /** Acción que LLEVA a esta pantalla desde la anterior. Nunca 'none'. */
  leadingAction: ActionId;
  /** Receta de esta pantalla. `undefined` si aún sin elegir o si es external. */
  recipe?: RecipeId;
  /** Solo cuando `leadingAction === 'external_link'`: field con la URL. */
  linkField?: string;
  /**
   * El nodo `TargetComposition` crudo de este salto. `undefined` para los
   * saltos legacy sintetizados desde `targetRecipe`/`expand`/`linkField`.
   */
  node?: TargetComposition;
}

/** Receta efectiva del primer salto en el modelo legacy, según la action. */
function legacyFirstHop(vc: ViewComposition): ResolvedHop | null {
  switch (vc.action) {
    case 'navigate_to_detail':
      return { leadingAction: 'navigate_to_detail', recipe: vc.targetRecipe };
    case 'modal':
      // Sin targetRecipe el modal reusa la receta de la lista (fallback cliente).
      return { leadingAction: 'modal', recipe: vc.targetRecipe ?? vc.recipe };
    case 'expand_inline':
      return { leadingAction: 'expand_inline', recipe: vc.expand?.recipe };
    case 'external_link':
      return { leadingAction: 'external_link', linkField: vc.linkField };
    default:
      return null;
  }
}

/**
 * Resuelve la cadena ordenada de pantallas destino de una `ViewComposition`.
 *
 * - `action === 'none'` (o ausente) → cadena vacía (pantalla terminal).
 * - `targetComposition` presente → recorre la cadena recursiva (multi-salto),
 *   parando en una action no-navegante, en `'none'`, o al alcanzar
 *   `MAX_TARGET_DEPTH` (corte defensivo; el validador ya lo marca como error).
 * - en su defecto → un único salto sintetizado del modelo legacy.
 *
 * El primer salto lo dispara `vc.action`; cada salto siguiente lo dispara la
 * `action` del salto anterior.
 */
export function resolveTargetChain(vc: ViewComposition | null | undefined): ResolvedHop[] {
  if (!vc || !vc.action || vc.action === 'none') return [];

  // Nuevo modelo multi-salto.
  if (vc.targetComposition) {
    const hops: ResolvedHop[] = [];
    let leading: ActionId = vc.action;
    let node: TargetComposition | undefined = vc.targetComposition;
    while (node && hops.length <= MAX_TARGET_DEPTH) {
      hops.push({
        leadingAction: leading,
        recipe: node.recipe,
        linkField: node.linkField,
        node,
      });
      // Solo se encadena si la action de este nodo abre otra pantalla navegable.
      if (!node.action || !NAVIGATING_ACTIONS.has(node.action)) break;
      leading = node.action;
      node = node.targetComposition;
    }
    return hops;
  }

  // Modelo legacy: un único salto terminal.
  const hop = legacyFirstHop(vc);
  return hop ? [hop] : [];
}

/** Nº de saltos de la cadena (0 = pantalla terminal). */
export function targetChainDepth(vc: ViewComposition | null | undefined): number {
  return resolveTargetChain(vc).length;
}
