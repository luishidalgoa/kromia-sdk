/**
 * KRO-133 V5 — los presets de las recetas "block-native" producen un layout
 * ESTRUCTURALMENTE VÁLIDO (placement correcto, sin slots fantasma, sin overlaps
 * que el validador marque como error). Red de seguridad: como estas recetas no
 * tienen componente React (las pinta el motor de bloques), un preset mal formado
 * solo se vería en runtime — este test lo caza antes.
 */
import { describe, it, expect } from 'vitest';
import { recipeToComposition } from '../src/recipe-presets';
import { getRecipeManifest } from '../src/registries/recipes';
import { validateLayout, collectLayoutSlots } from '../src/layout';
import type { RecipeId, SlotComposition, ViewComposition } from '../src/types';

const BLOCK_NATIVE: RecipeId[] = [
  // list
  'feature_card', 'split_panel', 'stat_tile', 'cover_band',
  // detail
  'detail_panel', 'detail_profile',
];

/** Composición con TODOS los slots del manifest rellenos (1 field cada uno). */
function fullComposition(recipe: RecipeId): ViewComposition {
  const manifest = getRecipeManifest(recipe)!;
  const slots: Record<string, SlotComposition> = {};
  for (const s of manifest.slots) slots[s.id] = { fields: [s.id] };
  return { recipe, action: 'none', slots };
}

describe('recipe-presets — recetas block-native (KRO-133 V5)', () => {
  for (const recipe of BLOCK_NATIVE) {
    describe(recipe, () => {
      it('el manifest existe (list o detail) con slots', () => {
        const m = getRecipeManifest(recipe);
        expect(m).toBeDefined();
        expect(['list', 'detail']).toContain(m!.kind);
        expect(m!.slots.length).toBeGreaterThan(0);
      });

      it('recipeToComposition produce un layout estructuralmente válido', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        expect(comp.layout).toBeDefined();
        const res = validateLayout(comp.layout!, { slots: comp.slots });
        expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
        expect(res.ok).toBe(true);
      });

      it('el layout solo referencia slots presentes en la composición', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        const used = collectLayoutSlots(comp.layout!);
        for (const slot of used) expect(comp.slots[slot]).toBeDefined();
      });

      it('fusiona la apariencia base del preset en los slots', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        // Al menos un slot del manifest recibe apariencia del preset.
        const someAppearance = Object.values(comp.slots).some(s => s.appearance && Object.keys(s.appearance).length > 0);
        expect(someAppearance).toBe(true);
      });

      it('es robusto con slots OPCIONALES ausentes (solo los requeridos)', () => {
        const manifest = getRecipeManifest(recipe)!;
        const slots: Record<string, SlotComposition> = {};
        for (const s of manifest.slots) if (!s.optional) slots[s.id] = { fields: [s.id] };
        const comp = recipeToComposition({ recipe, action: 'none', slots });
        const res = validateLayout(comp.layout!, { slots: comp.slots });
        expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
      });
    });
  }
});
