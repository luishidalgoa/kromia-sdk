/**
 * KRO-133 F5 / KRO-145 — no-regresión de los presets de layout.
 *
 * Cada receta con preset (las 8 clásicas + las block-native) debe migrar a un
 * árbol que:
 *   1. es estructuralmente válido (sin errores del validador),
 *   2. coloca TODOS los slots del manifest (ningún drop → todo el dato se pinta),
 *   3. solo referencia slots presentes (sin fantasmas),
 *   4. preserva slots CUSTOM no contemplados por el preset (backward-compat 100%),
 *   5. respeta la apariencia del usuario sobre la base del preset,
 *   6. es PURA: no muta la composición de entrada.
 *
 * Las recetas block-native NO tienen componente React: las pinta el motor de
 * bloques desde el preset. Un preset mal formado solo se vería en runtime — esta
 * red de seguridad lo caza antes.
 */
import { describe, it, expect } from 'vitest';
import { recipeToComposition, RECIPE_PRESETS } from '../src/recipe-presets';
import { getRecipeManifest } from '../src/registries/recipes';
import { validateLayout, collectLayoutSlots } from '../src/layout';
import type { RecipeId, SlotAppearance, SlotComposition, ViewComposition } from '../src/types';

/** Toda receta que declara un preset de layout. */
const PRESET_RECIPES = Object.keys(RECIPE_PRESETS) as RecipeId[];

/** Composición con TODOS los slots del manifest rellenos (1 field cada uno). */
function fullComposition(recipe: RecipeId): ViewComposition {
  const manifest = getRecipeManifest(recipe)!;
  const slots: Record<string, SlotComposition> = {};
  for (const s of manifest.slots) slots[s.id] = { fields: [s.id] };
  return { recipe, action: 'none', slots };
}

const errorsOf = (comp: ViewComposition) =>
  validateLayout(comp.layout!, { slots: comp.slots }).issues.filter(i => i.level === 'error');

describe('recipe-presets — no-regresión de TODOS los presets (KRO-145)', () => {
  it('el catálogo cubre las recetas clásicas + block-native', () => {
    // 8 clásicas + 5 block-native = 13 (guarda contra borrar un preset por error).
    expect(PRESET_RECIPES.length).toBeGreaterThanOrEqual(12);
    for (const r of ['compact_card', 'compact_avatar', 'row_text', 'hero_protagonico',
      'editorial', 'momento', 'accordion_simple', 'accordion_with_actions'] as RecipeId[]) {
      expect(PRESET_RECIPES, `falta preset de ${r}`).toContain(r);
    }
  });

  for (const recipe of PRESET_RECIPES) {
    describe(recipe, () => {
      it('el manifest existe con slots', () => {
        const m = getRecipeManifest(recipe);
        expect(m, `${recipe} sin manifest`).toBeDefined();
        expect(m!.slots.length).toBeGreaterThan(0);
      });

      it('migra a un layout estructuralmente válido', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        expect(comp.layout).toBeDefined();
        expect(errorsOf(comp)).toEqual([]);
        expect(validateLayout(comp.layout!, { slots: comp.slots }).ok).toBe(true);
      });

      it('coloca TODOS los slots del manifest — sin drops', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        const placed = new Set(collectLayoutSlots(comp.layout!));
        const missing = getRecipeManifest(recipe)!.slots.map(s => s.id).filter(id => !placed.has(id));
        expect(missing, `${recipe}: el preset no coloca estos slots`).toEqual([]);
      });

      it('el layout solo referencia slots presentes (sin fantasmas)', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        for (const slot of collectLayoutSlots(comp.layout!)) {
          expect(comp.slots[slot], `${recipe} referencia slot ausente "${slot}"`).toBeDefined();
        }
      });

      it('preserva un slot CUSTOM no contemplado por el preset (backward-compat)', () => {
        const base = fullComposition(recipe);
        base.slots.__custom__ = { fields: ['__custom__'] };
        const comp = recipeToComposition(base);
        const placed = new Set(collectLayoutSlots(comp.layout!));
        expect(placed.has('__custom__'), `${recipe}: slot custom perdido al migrar`).toBe(true);
        expect(errorsOf(comp), `${recipe}: árbol inválido con slot custom`).toEqual([]);
      });

      it('fusiona la apariencia base del preset en al menos un slot', () => {
        const comp = recipeToComposition(fullComposition(recipe));
        const any = Object.values(comp.slots).some(s => s.appearance && Object.keys(s.appearance).length > 0);
        expect(any).toBe(true);
      });

      it('la apariencia del usuario GANA sobre la base del preset', () => {
        const preset = RECIPE_PRESETS[recipe]!;
        const styledSlot = Object.keys(preset.appearance ?? {})[0];
        if (!styledSlot) return; // preset sin appearance → nada que comprobar
        const prop = Object.keys(preset.appearance![styledSlot])[0] as keyof SlotAppearance;
        const base = fullComposition(recipe);
        // valor centinela del usuario distinto al del preset
        base.slots[styledSlot] = { fields: [styledSlot], appearance: { [prop]: '__user__' } as SlotAppearance };
        const next = recipeToComposition(base);
        expect((next.slots[styledSlot].appearance as Record<string, unknown>)[prop]).toBe('__user__');
      });

      it('es PURA: no muta la composición de entrada', () => {
        const base = fullComposition(recipe);
        const snapshot = JSON.stringify(base);
        recipeToComposition(base);
        expect(JSON.stringify(base)).toBe(snapshot);
      });

      it('es robusto con slots OPCIONALES ausentes (solo los requeridos)', () => {
        const manifest = getRecipeManifest(recipe)!;
        const slots: Record<string, SlotComposition> = {};
        for (const s of manifest.slots) if (!s.optional) slots[s.id] = { fields: [s.id] };
        const comp = recipeToComposition({ recipe, action: 'none', slots });
        expect(errorsOf(comp)).toEqual([]);
      });

      it('es robusto con UN solo slot presente (cada slot del manifest) y con ninguno', () => {
        const manifest = getRecipeManifest(recipe)!;
        for (const s of manifest.slots) {
          const comp = recipeToComposition({ recipe, action: 'none', slots: { [s.id]: { fields: [s.id] } } });
          expect(errorsOf(comp), `${recipe} con solo "${s.id}"`).toEqual([]);
        }
        const empty = recipeToComposition({ recipe, action: 'none', slots: {} });
        expect(errorsOf(empty), `${recipe} sin slots`).toEqual([]);
      });
    });
  }
});
