/**
 * KRO-171 — ALIASES de catálogo + `normalizeComposition`.
 *
 * Lección `detail_panel` (eliminada en el major 3.0.0): las composiciones
 * persistidas que referencian recetas/componentes ELIMINADOS caían a render
 * genérico o `null` mudo. Los aliases convierten la evolución del catálogo en
 * **degradación con intención**: al retirar una entrada, se declara aquí su
 * sucesora y `normalizeComposition` reescribe las referencias al cargar.
 *
 * Pura y barata: devuelve la MISMA referencia si no hay nada que normalizar
 * (no ensucia dirty-checks del editor).
 */
import type { ViewComposition, TargetComposition, LayoutContainerNode, LayoutNode } from './types';

/** Recetas retiradas → su sucesora actual. */
export const RECIPE_ALIASES: Readonly<Record<string, string>> = {
  // KRO-133: "Ficha" era idéntica a Editorial; se unificaron.
  detail_panel: 'editorial',
};

/** Componentes de bloque retirados → su sucesor actual. */
export const COMPONENT_ALIASES: Readonly<Record<string, string>> = {};

const aliasRecipe = (id: string | undefined): string | undefined =>
  id !== undefined && RECIPE_ALIASES[id] !== undefined ? RECIPE_ALIASES[id] : id;

/** ¿El layout contiene algún componente con alias pendiente? */
function layoutNeedsAlias(node: LayoutNode): boolean {
  if (node.type === 'component') return COMPONENT_ALIASES[node.component] !== undefined;
  if (node.type === 'container') return node.children.some(layoutNeedsAlias);
  return false;
}

function aliasLayout(node: LayoutContainerNode): LayoutContainerNode {
  const walk = (n: LayoutNode): LayoutNode => {
    if (n.type === 'component' && COMPONENT_ALIASES[n.component] !== undefined) {
      return { ...n, component: COMPONENT_ALIASES[n.component] };
    }
    if (n.type === 'container') return { ...n, children: n.children.map(walk) };
    return n;
  };
  return walk(node) as LayoutContainerNode;
}

function targetNeedsAlias(t: TargetComposition): boolean {
  return aliasRecipe(t.recipe) !== t.recipe
    || (t.layout !== undefined && layoutNeedsAlias(t.layout))
    || (t.expand !== undefined && aliasRecipe(t.expand.recipe) !== t.expand.recipe)
    || (t.targetComposition !== undefined && targetNeedsAlias(t.targetComposition));
}

function aliasTarget(t: TargetComposition): TargetComposition {
  return {
    ...t,
    recipe: aliasRecipe(t.recipe) as TargetComposition['recipe'],
    ...(t.layout !== undefined && layoutNeedsAlias(t.layout) ? { layout: aliasLayout(t.layout) } : {}),
    ...(t.expand !== undefined && aliasRecipe(t.expand.recipe) !== t.expand.recipe
      ? { expand: { ...t.expand, recipe: aliasRecipe(t.expand.recipe) as NonNullable<TargetComposition['expand']>['recipe'] } }
      : {}),
    ...(t.targetComposition !== undefined && targetNeedsAlias(t.targetComposition)
      ? { targetComposition: aliasTarget(t.targetComposition) }
      : {}),
  };
}

/**
 * Reescribe las referencias a recetas/componentes RETIRADOS por su sucesora
 * (recipe, targetRecipe, targetComposition.* recursivo, expand.recipe,
 * nestedComposition de slots y componentes del layout). Si no hay nada que
 * normalizar devuelve la MISMA referencia.
 */
export function normalizeComposition(c: ViewComposition): ViewComposition {
  const slotNestedNeeds = Object.values(c.slots ?? {}).some(
    s => s.nestedComposition !== undefined && aliasRecipe(s.nestedComposition.recipe) !== s.nestedComposition.recipe,
  );
  const needs =
    aliasRecipe(c.recipe) !== c.recipe
    || aliasRecipe(c.targetRecipe) !== c.targetRecipe
    || (c.expand !== undefined && aliasRecipe(c.expand.recipe) !== c.expand.recipe)
    || (c.targetComposition !== undefined && targetNeedsAlias(c.targetComposition))
    || (c.layout !== undefined && layoutNeedsAlias(c.layout))
    || slotNestedNeeds;
  if (!needs) return c;

  const next: ViewComposition = {
    ...c,
    recipe: aliasRecipe(c.recipe) as ViewComposition['recipe'],
    ...(c.targetRecipe !== undefined ? { targetRecipe: aliasRecipe(c.targetRecipe) as ViewComposition['targetRecipe'] } : {}),
    ...(c.expand !== undefined && aliasRecipe(c.expand.recipe) !== c.expand.recipe
      ? { expand: { ...c.expand, recipe: aliasRecipe(c.expand.recipe) as NonNullable<ViewComposition['expand']>['recipe'] } }
      : {}),
    ...(c.targetComposition !== undefined && targetNeedsAlias(c.targetComposition)
      ? { targetComposition: aliasTarget(c.targetComposition) }
      : {}),
    ...(c.layout !== undefined && layoutNeedsAlias(c.layout) ? { layout: aliasLayout(c.layout) } : {}),
  };
  if (slotNestedNeeds) {
    next.slots = Object.fromEntries(Object.entries(c.slots ?? {}).map(([id, s]) => {
      if (s.nestedComposition !== undefined && aliasRecipe(s.nestedComposition.recipe) !== s.nestedComposition.recipe) {
        return [id, { ...s, nestedComposition: { ...s.nestedComposition, recipe: aliasRecipe(s.nestedComposition.recipe) as NonNullable<typeof s.nestedComposition>['recipe'] } }];
      }
      return [id, s];
    }));
  }
  return next;
}
