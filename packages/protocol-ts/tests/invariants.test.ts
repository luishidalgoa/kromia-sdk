/**
 * Tests de invariantes cross-registry.
 *
 * Estos tests son la RED DE SEGURIDAD principal contra regresiones de
 * la próxima migración (quitar implementación a-fuego de Studio + delegar
 * al SDK). Verifican que las distintas piezas del modelo están
 * sincronizadas entre sí:
 *
 *  - `behavior.renderAsSlotKind` ↔ `classifyField` (no drift entre lo
 *    declarativo del registry y la lógica imperativa).
 *  - `slot.accepts` ↔ `SLOT_ACCEPT_KIND_META` (todos los kinds usados
 *    están declarados).
 *  - `behavior.applicableTypes` ↔ `FIELD_TYPE_IDS` (no se referencian
 *    types fantasma).
 *  - `RECIPE_REGISTRY` ↔ `RecipeId` union (la union no tiene IDs sin
 *    manifest).
 */

import { describe, it, expect } from 'vitest';
import { allBehaviors } from '../src/registries/behaviors';
import { allRecipes, RECIPE_REGISTRY } from '../src/registries/recipes';
import { allFieldTypes, FIELD_TYPE_IDS } from '../src/registries/field-types';
import { allActions } from '../src/registries/actions';
import { SLOT_ACCEPT_KIND_META } from '../src/registries/slot-kinds';
import { classifyField, isFieldCompatibleWithSlot } from '../src/classify';
import type { SlotAcceptKind } from '../src/types';

describe('Invariant: behavior.renderAsSlotKind ↔ classifyField', () => {
  // Para cada behavior con renderAsSlotKind declarado, existe AL MENOS
  // un (type, behavior) combo que produce ese kind en classifyField.
  // Si renderAsSlotKind declara 'badge' pero classifyField nunca produce
  // 'badge' para ningún applicableType+behavior, hay drift.

  const behaviorsWithKind = allBehaviors().filter(b => b.renderAsSlotKind !== undefined);

  it('todos los behaviors con renderAsSlotKind son consistentes con classifyField', () => {
    const violations: string[] = [];

    behaviorsWithKind.forEach(b => {
      // Prueba con cada applicableType
      const matches = b.applicableTypes.some(type => {
        const kinds = classifyField({ type, behavior: b.id });
        return kinds.includes(b.renderAsSlotKind!);
      });
      if (!matches) {
        violations.push(
          `behavior=${b.id} declara renderAsSlotKind=${b.renderAsSlotKind} pero ` +
          `classifyField nunca lo produce para applicableTypes=[${b.applicableTypes.join(',')}]`,
        );
      }
    });

    expect(violations).toEqual([]);
  });

  it('si classifyField produce un kind X para un behavior B, ese kind está declarado en SLOT_ACCEPT_KIND_META', () => {
    // Combinaciones type+behavior útiles para muestrear classifyField.
    // Cualquier kind producido debe existir en el meta.
    const kindsProduced = new Set<SlotAcceptKind>();
    allBehaviors().forEach(b => {
      b.applicableTypes.forEach(type => {
        const kinds = classifyField({ type, behavior: b.id });
        kinds.forEach(k => kindsProduced.add(k));
      });
    });
    // También combinations sin behavior (solo type base).
    FIELD_TYPE_IDS.forEach(type => {
      const kinds = classifyField({ type });
      kinds.forEach(k => kindsProduced.add(k));
    });

    const declared = new Set(Object.keys(SLOT_ACCEPT_KIND_META) as SlotAcceptKind[]);
    const undeclared = [...kindsProduced].filter(k => !declared.has(k));
    expect(undeclared).toEqual([]);
  });
});

describe('Invariant: slot.accepts ↔ SLOT_ACCEPT_KIND_META', () => {
  it('cada accept declarado en cualquier slot existe en SLOT_ACCEPT_KIND_META', () => {
    const violations: string[] = [];
    const declaredKinds = new Set(Object.keys(SLOT_ACCEPT_KIND_META));

    allRecipes().forEach(r => {
      r.slots.forEach(s => {
        s.accepts.forEach(k => {
          if (!declaredKinds.has(k)) {
            violations.push(`recipe=${r.id} slot=${s.id} accepts kind "${k}" que NO está en SLOT_ACCEPT_KIND_META`);
          }
        });
      });
    });
    expect(violations).toEqual([]);
  });
});

describe('Invariant: behavior.applicableTypes ↔ FIELD_TYPE_IDS', () => {
  it('cada applicableType de cualquier behavior existe en FIELD_TYPE_IDS', () => {
    const violations: string[] = [];

    allBehaviors().forEach(b => {
      b.applicableTypes.forEach(t => {
        if (!FIELD_TYPE_IDS.includes(t)) {
          violations.push(`behavior=${b.id} declara applicableType "${t}" que NO existe en FIELD_TYPE_IDS`);
        }
      });
    });
    expect(violations).toEqual([]);
  });
});

describe('Invariant: RECIPE_REGISTRY cubre todos los recipes esperados', () => {
  it('cada entry de RECIPE_REGISTRY tiene un manifest definido (no undefined)', () => {
    Object.entries(RECIPE_REGISTRY).forEach(([id, manifest]) => {
      expect(manifest, `RECIPE_REGISTRY[${id}] es undefined`).toBeDefined();
      expect(manifest!.id).toBe(id);
    });
  });

  it('cada manifest.id matchea su key en RECIPE_REGISTRY', () => {
    allRecipes().forEach(r => {
      expect(RECIPE_REGISTRY[r.id]?.id).toBe(r.id);
    });
  });
});

describe('Invariant: classifyField + isFieldCompatibleWithSlot consistencia', () => {
  it('si classifyField produce un kind K, un slot que acepta K es compatible con ese field', () => {
    // Toma un sample: campo number + behavior=year.
    const field = { type: 'number', behavior: 'year' };
    const kinds = classifyField(field);
    // classifyField debe producir 'date' (por behavior=year).
    expect(kinds).toContain('date');
    // Un slot date debe aceptarlo.
    const dateSlot = { id: 'd', label: 'D', kind: 'single' as const, accepts: ['date' as SlotAcceptKind] };
    expect(isFieldCompatibleWithSlot(field, dateSlot)).toBe(true);
  });

  it('slot any-accept admite cualquier field, incluso uno cuyo type no existe', () => {
    const anySlot = { id: 'a', label: 'A', kind: 'single' as const, accepts: ['any' as SlotAcceptKind] };
    expect(isFieldCompatibleWithSlot({ type: 'unknown_type' }, anySlot)).toBe(true);
  });

  it('classifyField siempre incluye "any"', () => {
    allBehaviors().forEach(b => {
      b.applicableTypes.forEach(type => {
        const kinds = classifyField({ type, behavior: b.id });
        expect(kinds).toContain('any');
      });
    });
  });

  it('classifyField no devuelve duplicados', () => {
    allBehaviors().forEach(b => {
      b.applicableTypes.forEach(type => {
        const kinds = classifyField({ type, behavior: b.id });
        expect(new Set(kinds).size).toBe(kinds.length);
      });
    });
  });
});

describe('Invariant: action transitions y constraints', () => {
  const actions = allActions();

  it('si requiresTargetRecipe, hay targetRecipeKind', () => {
    actions.forEach(a => {
      if (a.requiresTargetRecipe) {
        expect(a.targetRecipeKind, `action ${a.id}`).toBeDefined();
      }
    });
  });

  it('transition matchea la semántica de cada action conocida', () => {
    const map: Record<string, string> = {
      'none':               'static',
      'navigate_to_detail': 'push',
      'modal':              'modal',
      'expand_inline':      'inline',
      'external_link':      'external',
    };
    actions.forEach(a => {
      if (map[a.id]) {
        expect(a.transition, `action ${a.id}`).toBe(map[a.id]);
      }
    });
  });
});
