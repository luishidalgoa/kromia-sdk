/**
 * KRO-171 — aliases de catálogo + normalizeComposition.
 * La lección detail_panel: composiciones guardadas con recetas retiradas
 * deben degradar CON INTENCIÓN a su sucesora, no a render mudo.
 */
import { describe, it, expect } from 'vitest';
import { normalizeComposition, RECIPE_ALIASES } from '../src/normalize';
import type { ViewComposition } from '../src/types';

describe('normalizeComposition (KRO-171)', () => {
  it('detail_panel (retirada) → editorial, en recipe/targetRecipe/target/expand', () => {
    const c = {
      recipe: 'detail_panel',
      action: 'navigate_to_detail',
      slots: { title: { fields: ['nombre'] } },
      targetRecipe: 'detail_panel',
      targetComposition: {
        recipe: 'detail_panel',
        slots: {},
        expand: { recipe: 'detail_panel', slots: {} },
      },
      expand: { recipe: 'detail_panel', slots: {} },
    } as unknown as ViewComposition;
    const n = normalizeComposition(c);
    expect(n.recipe).toBe('editorial');
    expect(n.targetRecipe).toBe('editorial');
    expect(n.targetComposition?.recipe).toBe('editorial');
    expect(n.targetComposition?.expand?.recipe).toBe('editorial');
    expect(n.expand?.recipe).toBe('editorial');
  });

  it('sin nada que normalizar devuelve la MISMA referencia (no ensucia dirty)', () => {
    const c: ViewComposition = {
      recipe: 'compact_avatar',
      action: 'none',
      slots: { title: { fields: ['nombre'] } },
    };
    expect(normalizeComposition(c)).toBe(c);
  });

  it('nestedComposition de slot también se normaliza', () => {
    const c = {
      recipe: 'compact_avatar',
      action: 'none',
      slots: { title: { fields: ['nombre'], nestedComposition: { recipe: 'detail_panel', slots: {} } } },
    } as unknown as ViewComposition;
    const n = normalizeComposition(c);
    expect((n.slots.title as { nestedComposition?: { recipe: string } }).nestedComposition?.recipe).toBe('editorial');
  });

  it('los aliases declaran sucesoras que EXISTEN', async () => {
    const { getRecipeManifest } = await import('../src/registries/recipes');
    for (const [retired, successor] of Object.entries(RECIPE_ALIASES)) {
      expect(getRecipeManifest(retired as never), `${retired} debería estar RETIRADA`).toBeUndefined();
      expect(getRecipeManifest(successor as never), `sucesora ${successor} debe existir`).toBeDefined();
    }
  });
});
