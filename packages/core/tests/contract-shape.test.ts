/**
 * Tests del shape del `.json` generado en `contracts/`.
 *
 * Carga el `.json` real (output del último `pnpm gen`) y verifica:
 *  - Shape global: tiene todas las secciones esperadas.
 *  - Counts coherentes con los registries.
 *  - `connections.edges` no contiene from/to inexistentes en nodes.
 *  - `compatibilityMatrix` cubre todos los recipes.
 *  - `behaviors[*].renderAs` correspondiente con `slotAcceptKinds[*].behaviorIds`.
 *
 * Si alguien edita el modelo y NO regenera, el .json queda stale y estos
 * tests lo cazan al comparar counts vs registries.
 */

import { describe, it, expect } from 'vitest';
import contract from '../../../contracts/kromia-recipe-protocol-v1.json';
import { allBehaviors } from '../src/registries/behaviors';
import { allActions } from '../src/registries/actions';
import { allFieldTypes } from '../src/registries/field-types';
import { allRecipes } from '../src/registries/recipes';
import { SLOT_ACCEPT_KIND_META } from '../src/registries/slot-kinds';

type ContractType = {
  $schema:         string;
  protocolVersion: string;
  generatedAt:     string;
  generatedFrom:   { packagePath: string; note: string };
  recipes:             Array<{ id: string; kind: string; slots: Array<{ id: string; accepts: string[] }> }>;
  actions:             Array<{ id: string; transition: string }>;
  behaviors:           Array<{ id: string; renderAs: string | null; applicableTypes: string[] }>;
  slotAcceptKinds:     Array<{ id: string; behaviorIds: string[] }>;
  fieldTypes:          Array<{ id: string; cardinality: string }>;
  compatibilityMatrix: Record<string, { kindRole: string; allowedActions: string[]; allowedTargetRecipes: string[]; allowedExpandRecipes: string[] }>;
  connections: {
    nodes: Array<{ id: string; category: string; label: string }>;
    edges: Array<{ from: string; to: string; kind: string }>;
  };
};
const c = contract as unknown as ContractType;

describe('Contract shape: top-level', () => {
  it('tiene todas las secciones requeridas', () => {
    expect(c.$schema).toBeTruthy();
    expect(c.protocolVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(c.generatedAt).toBeTruthy();
    expect(c.generatedFrom?.packagePath).toBeTruthy();
    expect(Array.isArray(c.recipes)).toBe(true);
    expect(Array.isArray(c.actions)).toBe(true);
    expect(Array.isArray(c.behaviors)).toBe(true);
    expect(Array.isArray(c.slotAcceptKinds)).toBe(true);
    expect(Array.isArray(c.fieldTypes)).toBe(true);
    expect(typeof c.compatibilityMatrix).toBe('object');
    expect(typeof c.connections).toBe('object');
    expect(Array.isArray(c.connections.nodes)).toBe(true);
    expect(Array.isArray(c.connections.edges)).toBe(true);
  });

  it('protocolVersion >= 1.1.0 (incluye fieldTypes + connections)', () => {
    const [major, minor] = c.protocolVersion.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(1);
    if (major === 1) expect(minor).toBeGreaterThanOrEqual(1);
  });
});

describe('Contract counts: matchean los registries en memoria', () => {
  it('recipes.length === allRecipes().length', () => {
    expect(c.recipes.length).toBe(allRecipes().length);
  });

  it('actions.length === allActions().length', () => {
    expect(c.actions.length).toBe(allActions().length);
  });

  it('behaviors.length === allBehaviors().length', () => {
    expect(c.behaviors.length).toBe(allBehaviors().length);
  });

  it('fieldTypes.length === allFieldTypes().length', () => {
    expect(c.fieldTypes.length).toBe(allFieldTypes().length);
  });

  it('slotAcceptKinds.length === keys(SLOT_ACCEPT_KIND_META).length', () => {
    expect(c.slotAcceptKinds.length).toBe(Object.keys(SLOT_ACCEPT_KIND_META).length);
  });
});

describe('Contract: compatibilityMatrix', () => {
  it('cada recipe tiene un entry en compatibilityMatrix', () => {
    c.recipes.forEach(r => {
      expect(c.compatibilityMatrix).toHaveProperty(r.id);
    });
  });

  it('no hay entries fantasma en compatibilityMatrix (sin recipe correspondiente)', () => {
    const recipeIds = new Set(c.recipes.map(r => r.id));
    Object.keys(c.compatibilityMatrix).forEach(id => {
      expect(recipeIds.has(id)).toBe(true);
    });
  });

  it('list-source acepta todas las actions del catálogo', () => {
    const allActionIds = c.actions.map(a => a.id);
    Object.values(c.compatibilityMatrix).forEach(entry => {
      if (entry.kindRole === 'list-source') {
        expect([...entry.allowedActions].sort()).toEqual([...allActionIds].sort());
      }
    });
  });

  it('detail/expand recipes no tienen allowedTargetRecipes ni allowedExpandRecipes', () => {
    Object.entries(c.compatibilityMatrix).forEach(([id, entry]) => {
      if (entry.kindRole === 'detail-target' || entry.kindRole === 'expand-target') {
        expect(entry.allowedTargetRecipes, `${id} allowedTargetRecipes`).toEqual([]);
        expect(entry.allowedExpandRecipes, `${id} allowedExpandRecipes`).toEqual([]);
      }
    });
  });
});

describe('Contract: connections graph integrity', () => {
  const nodeIds = new Set(c.connections.nodes.map(n => n.id));

  it('cada edge.from y edge.to existen como nodos', () => {
    const orphans: string[] = [];
    c.connections.edges.forEach(e => {
      if (!nodeIds.has(e.from)) orphans.push(`edge.from=${e.from}`);
      if (!nodeIds.has(e.to))   orphans.push(`edge.to=${e.to}`);
    });
    expect(orphans).toEqual([]);
  });

  it('cada edge.kind es uno de los 5 conocidos', () => {
    const validKinds = new Set([
      'type-behavior', 'behavior-slotKind',
      'recipe-action', 'recipe-target', 'recipe-expand',
    ]);
    c.connections.edges.forEach(e => {
      expect(validKinds.has(e.kind), `edge kind=${e.kind} no es válido`).toBe(true);
    });
  });

  it('no edges duplicadas (mismo from + to + kind)', () => {
    const seen = new Set<string>();
    c.connections.edges.forEach(e => {
      const sig = `${e.from}|${e.to}|${e.kind}`;
      expect(seen.has(sig), `edge duplicada: ${sig}`).toBe(false);
      seen.add(sig);
    });
  });

  it('cada categoría de nodo está bien tipada', () => {
    const validCategories = new Set(['fieldType', 'behavior', 'slotKind', 'recipe', 'action']);
    c.connections.nodes.forEach(n => {
      expect(validCategories.has(n.category), `category=${n.category}`).toBe(true);
    });
  });

  it('counts de nodos por categoría coherentes con registries', () => {
    const byCat: Record<string, number> = {};
    c.connections.nodes.forEach(n => { byCat[n.category] = (byCat[n.category] ?? 0) + 1; });

    expect(byCat.fieldType).toBe(allFieldTypes().length);
    expect(byCat.behavior).toBe(allBehaviors().length);
    expect(byCat.slotKind).toBe(Object.keys(SLOT_ACCEPT_KIND_META).length);
    expect(byCat.recipe).toBe(allRecipes().length);
    expect(byCat.action).toBe(allActions().length);
  });
});

describe('Contract: behaviors[*].renderAs ↔ slotAcceptKinds[*].behaviorIds', () => {
  it('si behaviors[X].renderAs = K, entonces slotAcceptKinds[K].behaviorIds incluye X', () => {
    const violations: string[] = [];
    const kindMap = new Map(c.slotAcceptKinds.map(k => [k.id, k.behaviorIds]));

    c.behaviors.forEach(b => {
      if (b.renderAs) {
        const ids = kindMap.get(b.renderAs);
        if (!ids || !ids.includes(b.id)) {
          violations.push(`behavior=${b.id} renderAs=${b.renderAs} pero no en slotAcceptKinds[${b.renderAs}].behaviorIds`);
        }
      }
    });
    expect(violations).toEqual([]);
  });

  it('si slotAcceptKinds[K].behaviorIds incluye X, behaviors[X].renderAs = K', () => {
    const violations: string[] = [];
    const behaviorRenderAs = new Map(c.behaviors.map(b => [b.id, b.renderAs]));

    c.slotAcceptKinds.forEach(k => {
      k.behaviorIds.forEach(bId => {
        if (behaviorRenderAs.get(bId) !== k.id) {
          violations.push(`slotAcceptKinds[${k.id}].behaviorIds incluye ${bId} pero behavior.renderAs=${behaviorRenderAs.get(bId)}`);
        }
      });
    });
    expect(violations).toEqual([]);
  });
});
