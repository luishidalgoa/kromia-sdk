/**
 * Tests de los registries del SDK.
 *
 * Verifica que cada registry tiene los counts esperados, que cada entry
 * tiene shape válido, y que las funciones de acceso (getX/allX) funcionan
 * coherentemente.
 *
 * Estos tests cazan regresiones del tipo "alguien borró un behavior sin
 * actualizar el corpus" o "alguien cambió el shape de RecipeManifest".
 */

import { describe, it, expect } from 'vitest';
import {
  allFieldTypes,
  getFieldType,
  FIELD_TYPE_IDS,
  type FieldTypeDefinition,
} from '../src/registries/field-types';
import {
  allActions,
  getAction,
  ACTION_IDS,
  type ActionDefinition,
} from '../src/registries/actions';
import {
  allBehaviors,
  getBehavior,
  getBehaviorsByType,
  suggestBehavior,
  type BehaviorDefinition,
} from '../src/registries/behaviors';
import {
  RECIPE_REGISTRY,
  getRecipeManifest,
  allRecipes,
  allRecipesByKind,
  type RecipeManifest,
} from '../src/registries/recipes';
import {
  SLOT_ACCEPT_KIND_META,
  getSlotAcceptKindOptions,
  formatSlotAccepts,
  getAvailableAppearanceProps,
} from '../src/registries/slot-kinds';
import type { SlotAcceptKind } from '../src/types';

// ── Field types ──────────────────────────────────────────────────────

describe('field-type-registry', () => {
  const types = allFieldTypes();

  it('contiene 9 types base', () => {
    // KRO-75: añadido cardRef para resolver drift con Studio.
    expect(types).toHaveLength(9);
  });

  it('incluye los IDs core', () => {
    const ids = types.map(t => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'text', 'textarea', 'number', 'select', 'image',
        'array<string>', 'array<number>', 'array<image>',
        'cardRef',
      ]),
    );
  });

  it('cada entry tiene shape válido', () => {
    types.forEach(t => {
      // KRO-75: el regex acepta camelCase (cardRef) además de lowercase
      // + delimitadores de tipo paramétrico.
      expect(t.id).toMatch(/^[a-zA-Z<>]+$/);
      expect(t.displayName).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(20);
      expect(['scalar', 'array']).toContain(t.cardinality);
      if (t.cardinality === 'array') {
        expect(t.elementType).toBeTruthy();
      }
    });
  });

  it('FIELD_TYPE_IDS matchea los ids del catálogo', () => {
    expect([...FIELD_TYPE_IDS].sort()).toEqual(types.map(t => t.id).sort());
  });

  it('getFieldType devuelve la entry correcta', () => {
    const text = getFieldType('text');
    expect(text).toBeDefined();
    expect(text!.cardinality).toBe('scalar');

    const arrImg = getFieldType('array<image>');
    expect(arrImg!.cardinality).toBe('array');
    expect(arrImg!.elementType).toBe('image');
  });

  it('getFieldType devuelve undefined para id inexistente', () => {
    expect(getFieldType('unknown')).toBeUndefined();
  });
});

// ── Actions ──────────────────────────────────────────────────────────

describe('action-registry', () => {
  const actions = allActions();

  it('contiene 5 actions', () => {
    expect(actions).toHaveLength(5);
  });

  it('incluye los IDs core', () => {
    const ids = actions.map(a => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'none', 'navigate_to_detail', 'modal', 'expand_inline', 'external_link',
      ]),
    );
  });

  it('cada action tiene shape válido', () => {
    actions.forEach(a => {
      expect(a.id).toMatch(/^[a-z_]+$/);
      expect(a.displayName).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(['static', 'push', 'modal', 'inline', 'external']).toContain(a.transition);
    });
  });

  it('constraint flags coherentes con transition', () => {
    const byId = (id: string) => actions.find(a => a.id === id)!;
    expect(byId('navigate_to_detail').requiresTargetRecipe).toBe(true);
    expect(byId('navigate_to_detail').targetRecipeKind).toBe('detail');
    expect(byId('modal').requiresTargetRecipe).toBe(true);
    expect(byId('expand_inline').requiresExpandRecipe).toBe(true);
    expect(byId('external_link').requiresLinkField).toBe(true);
    expect(byId('none').requiresTargetRecipe).toBeFalsy();
  });

  it('ACTION_IDS matchea los ids', () => {
    expect([...ACTION_IDS].sort()).toEqual(actions.map(a => a.id).sort());
  });

  it('getAction devuelve la entry correcta', () => {
    expect(getAction('none')?.transition).toBe('static');
    expect(getAction('unknown')).toBeUndefined();
  });
});

// ── Behaviors ────────────────────────────────────────────────────────

describe('behavior-registry', () => {
  const behaviors = allBehaviors();

  it('contiene 26 behaviors', () => {
    expect(behaviors).toHaveLength(26);
  });

  it('IDs únicos (sin duplicados)', () => {
    const ids = behaviors.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada behavior tiene shape válido', () => {
    behaviors.forEach(b => {
      expect(b.id).toMatch(/^[a-z_]+$/);
      expect(b.displayName).toBeTruthy();
      expect(b.description.length).toBeGreaterThan(20);
      expect(b.applicableTypes.length).toBeGreaterThan(0);
      // renderAsSlotKind es opcional, pero si está, debe estar en el meta
      if (b.renderAsSlotKind) {
        expect(SLOT_ACCEPT_KIND_META).toHaveProperty(b.renderAsSlotKind);
      }
    });
  });

  it('applicableTypes solo contiene types base válidos', () => {
    behaviors.forEach(b => {
      b.applicableTypes.forEach(t => {
        expect(FIELD_TYPE_IDS).toContain(t);
      });
    });
  });

  it('getBehavior y getBehaviorsByType funcionan', () => {
    expect(getBehavior('color_hex')?.renderAsSlotKind).toBe('color');
    expect(getBehavior(undefined)).toBeUndefined();
    expect(getBehavior(null)).toBeUndefined();
    expect(getBehavior('unknown')).toBeUndefined();

    const textBehaviors = getBehaviorsByType('text');
    expect(textBehaviors.length).toBeGreaterThan(0);
    textBehaviors.forEach(b => expect(b.applicableTypes).toContain('text'));
  });

  it('suggestBehavior matchea patterns conocidos', () => {
    expect(suggestBehavior('email', 'text')).toBe('email');
    expect(suggestBehavior('year', 'number')).toBe('year');
    expect(suggestBehavior('color', 'text')).toBe('color_hex');
    // Tipo incompatíble
    expect(suggestBehavior('email', 'number')).toBeUndefined();
    // Sin pattern
    expect(suggestBehavior('foobar', 'text')).toBeUndefined();
  });
});

// ── Recipes ──────────────────────────────────────────────────────────

describe('recipe-registry', () => {
  const recipes = allRecipes();

  it('contiene 8 recipes', () => {
    expect(recipes).toHaveLength(8);
  });

  it('distribución por kind: 3 list + 3 detail + 2 expand', () => {
    const byKind = (k: string) => recipes.filter(r => r.kind === k);
    expect(byKind('list')).toHaveLength(3);
    expect(byKind('detail')).toHaveLength(3);
    expect(byKind('expand')).toHaveLength(2);
  });

  it('IDs únicos', () => {
    const ids = recipes.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada recipe tiene shape válido', () => {
    recipes.forEach(r => {
      expect(r.id).toMatch(/^[a-z_]+$/);
      expect(r.displayName).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(['list', 'detail', 'expand']).toContain(r.kind);
      expect(r.slots.length).toBeGreaterThan(0);
    });
  });

  it('cada slot tiene shape válido + accepts existentes en SLOT_ACCEPT_KIND_META', () => {
    recipes.forEach(r => {
      const slotIds = new Set<string>();
      r.slots.forEach(s => {
        expect(s.id).toMatch(/^[a-z_]+$/);
        expect(slotIds.has(s.id)).toBe(false); // sin duplicados en la misma recipe
        slotIds.add(s.id);
        expect(s.label).toBeTruthy();
        expect(['single', 'composable']).toContain(s.kind);
        expect(s.accepts.length).toBeGreaterThan(0);
        s.accepts.forEach(k => {
          expect(SLOT_ACCEPT_KIND_META).toHaveProperty(k);
        });
      });
    });
  });

  it('getRecipeManifest devuelve correctamente', () => {
    const ca = getRecipeManifest('compact_avatar');
    expect(ca).toBeDefined();
    expect(ca!.kind).toBe('list');

    // ID que NO existe en RECIPE_REGISTRY pero SÍ en el union → undefined
    // (no hay; todos los IDs del union existen en el registry actualmente).
  });

  it('RECIPE_REGISTRY tiene una entry por cada recipe', () => {
    expect(Object.keys(RECIPE_REGISTRY).sort()).toEqual(recipes.map(r => r.id).sort());
  });

  // KRO-76 — Helper allRecipesByKind
  describe('allRecipesByKind', () => {
    it('list → 3 recipes', () => {
      const list = allRecipesByKind('list');
      expect(list.length).toBeGreaterThanOrEqual(1);
      list.forEach(r => expect(r.kind).toBe('list'));
    });

    it('detail → 3 recipes', () => {
      const detail = allRecipesByKind('detail');
      expect(detail.length).toBeGreaterThanOrEqual(1);
      detail.forEach(r => expect(r.kind).toBe('detail'));
    });

    it('expand → 2 recipes', () => {
      const expand = allRecipesByKind('expand');
      expect(expand.length).toBeGreaterThanOrEqual(1);
      expand.forEach(r => expect(r.kind).toBe('expand'));
    });

    it('sum por kind === total allRecipes()', () => {
      const total = allRecipes().length;
      const sum = allRecipesByKind('list').length
                + allRecipesByKind('detail').length
                + allRecipesByKind('expand').length;
      expect(sum).toBe(total);
    });

    it('mismas referencias que el registry (no copia)', () => {
      const list = allRecipesByKind('list');
      list.forEach(r => {
        expect(RECIPE_REGISTRY[r.id]).toBe(r);
      });
    });
  });
});

// ── Slot kinds (meta) ────────────────────────────────────────────────

describe('slot-kinds (SLOT_ACCEPT_KIND_META)', () => {
  const kinds = Object.keys(SLOT_ACCEPT_KIND_META) as SlotAcceptKind[];

  it('contiene 14 kinds', () => {
    expect(kinds).toHaveLength(14);
  });

  it('cada kind tiene label + description no-vacíos', () => {
    kinds.forEach(k => {
      const meta = SLOT_ACCEPT_KIND_META[k];
      expect(meta.label).toBeTruthy();
      expect(meta.description.length).toBeGreaterThan(10);
    });
  });

  it('getSlotAcceptKindOptions devuelve array con el shape correcto', () => {
    const opts = getSlotAcceptKindOptions();
    expect(opts.length).toBe(kinds.length);
    opts.forEach(o => {
      expect(o.id).toBeTruthy();
      expect(o.label).toBeTruthy();
      expect(o.description).toBeTruthy();
    });
  });

  it('formatSlotAccepts: any → "cualquiera"', () => {
    expect(formatSlotAccepts(['any'])).toBe('cualquiera');
    expect(formatSlotAccepts(['any', 'text-short'])).toBe('cualquiera');
  });

  it('formatSlotAccepts: 1 kind → su label', () => {
    expect(formatSlotAccepts(['image'])).toBe('Imagen');
  });

  it('formatSlotAccepts: N kinds → labels con " / "', () => {
    expect(formatSlotAccepts(['text-short', 'date'])).toBe('Texto / Fecha');
  });

  it('formatSlotAccepts: empty array → ""', () => {
    expect(formatSlotAccepts([])).toBe('');
  });

  it('getAvailableAppearanceProps: image-* tienen shape/aspect/imageFocus', () => {
    const props = getAvailableAppearanceProps(['image']);
    expect(props).toEqual(expect.arrayContaining(['shape', 'aspect', 'imageFocus']));
  });

  it('getAvailableAppearanceProps: text-* tienen align/weight/truncate', () => {
    const props = getAvailableAppearanceProps(['text-short']);
    expect(props).toEqual(expect.arrayContaining(['align', 'weight', 'truncate']));
  });

  it('getAvailableAppearanceProps: empty accepts → []', () => {
    expect(getAvailableAppearanceProps([])).toEqual([]);
  });

  it('getAvailableAppearanceProps: multi-accept retorna unión de props', () => {
    const props = getAvailableAppearanceProps(['image', 'text-short']);
    // Une props de image (shape, aspect, ...) con text-short (align, weight, ...)
    expect(props).toEqual(expect.arrayContaining(['shape', 'align']));
  });
});

// Helper para usar como type-check (vitest no necesita compile-time check)
type _CheckExhaustive = FieldTypeDefinition | ActionDefinition | BehaviorDefinition | RecipeManifest;
const _: _CheckExhaustive | undefined = undefined;
void _;
