/**
 * KRO-178 — galería de variantes de plantilla. Red de seguridad equivalente a
 * recipe-presets.test.ts: cada variante de cada receta debe producir un layout
 * ESTRUCTURALMENTE VÁLIDO con cualquier combinación de slots (todos / solo
 * requeridos / uno suelto), porque una variante mal formada solo se vería al
 * aplicarla desde la galería.
 */
import { describe, it, expect } from 'vitest';
import { layoutTemplatesFor, applyLayoutTemplate } from '../src/layout-templates';
import { RECIPE_REGISTRY, getRecipeManifest } from '../src/registries/recipes';
import { validateLayout, collectLayoutSlots } from '../src/layout';
import type { RecipeId, SlotComposition, ViewComposition } from '../src/types';

const ALL_RECIPES = Object.keys(RECIPE_REGISTRY) as RecipeId[];

/** Composición con TODOS los slots del manifest rellenos (1 field cada uno). */
function fullComposition(recipe: RecipeId): ViewComposition {
  const manifest = getRecipeManifest(recipe)!;
  const slots: Record<string, SlotComposition> = {};
  for (const s of manifest.slots) slots[s.id] = { fields: [s.id] };
  return { recipe, action: 'none', slots };
}

describe('layout-templates — integridad del catálogo', () => {
  it('toda receta con preset tiene "Clásica" PRIMERA, ids únicos y metadatos', () => {
    for (const recipe of ALL_RECIPES) {
      const templates = layoutTemplatesFor(recipe);
      const ids = templates.map(t => t.id);
      expect(new Set(ids).size, `${recipe}: ids duplicados`).toBe(ids.length);
      for (const t of templates) {
        expect(t.name.length, `${recipe}/${t.id}: sin nombre`).toBeGreaterThan(0);
        expect(t.description.length, `${recipe}/${t.id}: sin descripción`).toBeGreaterThan(0);
      }
      if (templates.length > 0) expect(templates[0].id).toBe('classic');
    }
  });

  it('las recetas principales ofrecen al menos 2 plantillas (galería con sentido)', () => {
    for (const recipe of ['compact_card', 'compact_avatar', 'feature_card', 'stat_tile', 'editorial', 'momento', 'detail_profile'] as RecipeId[]) {
      expect(layoutTemplatesFor(recipe).length, recipe).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('layout-templates — toda variante valida con cualquier combinación de slots', () => {
  for (const recipe of ALL_RECIPES) {
    const templates = layoutTemplatesFor(recipe);
    if (templates.length === 0) continue;
    describe(recipe, () => {
      for (const t of templates) {
        it(`${t.id}: layout válido con todos los slots + solo referencia presentes`, () => {
          const comp = applyLayoutTemplate(fullComposition(recipe), t);
          expect(comp.layout).toBeDefined();
          const res = validateLayout(comp.layout!, { slots: comp.slots });
          expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
          for (const slot of collectLayoutSlots(comp.layout!)) {
            expect(comp.slots[slot], `${t.id} referencia slot ausente "${slot}"`).toBeDefined();
          }
        });

        it(`${t.id}: robusto con solo los slots REQUERIDOS`, () => {
          const manifest = getRecipeManifest(recipe)!;
          const slots: Record<string, SlotComposition> = {};
          for (const s of manifest.slots) if (!s.optional) slots[s.id] = { fields: [s.id] };
          const comp = applyLayoutTemplate({ recipe, action: 'none', slots }, t);
          const res = validateLayout(comp.layout!, { slots: comp.slots });
          expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
        });

        it(`${t.id}: robusto con UN solo slot presente`, () => {
          const manifest = getRecipeManifest(recipe)!;
          const first = manifest.slots[0]?.id;
          if (!first) return;
          const comp = applyLayoutTemplate(
            { recipe, action: 'none', slots: { [first]: { fields: [first] } } }, t,
          );
          const res = validateLayout(comp.layout!, { slots: comp.slots });
          expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
        });
      }
    });
  }
});

describe('applyLayoutTemplate — semántica de fusión', () => {
  it('es PURA y la apariencia del usuario gana sobre la base de la plantilla', () => {
    const base = fullComposition('compact_avatar');
    base.slots.title = { fields: ['title'], appearance: { weight: 'regular' } };
    const before = JSON.stringify(base);
    const t = layoutTemplatesFor('compact_avatar').find(x => x.id === 'centrada')!;
    const next = applyLayoutTemplate(base, t);
    expect(JSON.stringify(base)).toBe(before);
    // la plantilla pide weight semibold + align center; el user ya tenía weight → gana el user
    expect(next.slots.title.appearance?.weight).toBe('regular');
    expect(next.slots.title.appearance?.align).toBe('center');
  });

  it('aplicar otra plantilla REEMPLAZA el layout anterior', () => {
    const comp = fullComposition('compact_avatar');
    const [classic, centrada] = layoutTemplatesFor('compact_avatar');
    const a = applyLayoutTemplate(comp, classic);
    const b = applyLayoutTemplate(a, centrada);
    expect(JSON.stringify(b.layout)).not.toBe(JSON.stringify(a.layout));
  });
});
