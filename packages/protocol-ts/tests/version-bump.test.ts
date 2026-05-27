/**
 * Tests del detector SemVer — KRO-63.
 *
 * Corpus de transiciones (estado A → estado B → bump esperado) que cubre
 * las reglas del playbook `bump-protocol.md`. Si añades una regla nueva,
 * añade un test aquí PRIMERO (TDD ligero — la regla se vuelve concreta
 * al escribir su caso de prueba).
 */

import { describe, it, expect } from 'vitest';
import { detectBumpKind, applyBump } from '../src/version-bump';

// ── Helpers de construcción ─────────────────────────────────────────

function baseJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema:        './schema.json',
    protocolVersion: '1.0.0',
    generatedAt:    '2026-05-27T00:00:00.000Z',
    generatedFrom:  { packagePath: 'packages/protocol-ts/', note: 'derived' },
    recipes:        [],
    actions:        [],
    behaviors:      [],
    slotAcceptKinds: [],
    fieldTypes:     [],
    compatibilityMatrix: {},
    connections:    { nodes: [], edges: [] },
    ...overrides,
  };
}

function recipe(id: string, slots: unknown[] = [], extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    kind:        'list',
    displayName: id,
    description: `Recipe ${id}`,
    slots,
    ...extras,
  };
}

function slot(id: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    label:       id,
    kind:        'single',
    accepts:     ['text-short'],
    optional:    false,
    nestable:    false,
    description: null,
    ...extras,
  };
}

function behavior(id: string, applicableTypes: string[] = ['text'], extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    displayName: id,
    description: `Behavior ${id}`,
    applicableTypes,
    ...extras,
  };
}

function action(id: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    displayName: id,
    description: `Action ${id}`,
    transition:  'static',
    ...extras,
  };
}

function fieldType(id: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    displayName: id,
    description: `Field type ${id}`,
    cardinality: 'scalar',
    ...extras,
  };
}

function slotAcceptKind(id: string, behaviorIds: string[] = [], extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    description: `Slot accept kind ${id}`,
    behaviorIds,
    ...extras,
  };
}

// ── Caso base ───────────────────────────────────────────────────────

describe('detectBumpKind — none', () => {
  it('outputs idénticos → none', () => {
    const a = baseJson({ recipes: [recipe('hero')] });
    const b = baseJson({ recipes: [recipe('hero')] });
    expect(detectBumpKind(a, b).kind).toBe('none');
  });

  it('protocolVersion + generatedAt cambian, todo lo demás igual → none', () => {
    const a = baseJson({
      protocolVersion: '1.0.0',
      generatedAt:    '2026-05-27T00:00:00.000Z',
      recipes:        [recipe('hero')],
    });
    const b = baseJson({
      protocolVersion: '2.0.0',  // ignorado por el detector
      generatedAt:    '2026-05-28T12:34:56.789Z',
      recipes:        [recipe('hero')],
    });
    expect(detectBumpKind(a, b).kind).toBe('none');
  });

  it('compatibilityMatrix y connections cambian pero registries no → none', () => {
    const a = baseJson({ compatibilityMatrix: { foo: 1 }, connections: { nodes: ['a'], edges: [] } });
    const b = baseJson({ compatibilityMatrix: { foo: 2 }, connections: { nodes: ['b'], edges: ['x'] } });
    expect(detectBumpKind(a, b).kind).toBe('none');
  });
});

// ── PATCH ───────────────────────────────────────────────────────────

describe('detectBumpKind — patch (solo cambios cosméticos)', () => {
  it('recipe displayName cambia → patch', () => {
    const a = baseJson({ recipes: [recipe('hero', [], { displayName: 'Hero Antiguo' })] });
    const b = baseJson({ recipes: [recipe('hero', [], { displayName: 'Hero Nuevo' })] });
    const r = detectBumpKind(a, b);
    expect(r.kind).toBe('patch');
    expect(r.reasons[0].description).toMatch(/displayName/);
  });

  it('behavior description cambia → patch', () => {
    const a = baseJson({ behaviors: [behavior('url', ['text'], { description: 'old' })] });
    const b = baseJson({ behaviors: [behavior('url', ['text'], { description: 'new' })] });
    expect(detectBumpKind(a, b).kind).toBe('patch');
  });

  it('action displayName + description cambian → patch', () => {
    const a = baseJson({ actions: [action('open', { displayName: 'A', description: 'B' })] });
    const b = baseJson({ actions: [action('open', { displayName: 'A2', description: 'B2' })] });
    expect(detectBumpKind(a, b).kind).toBe('patch');
  });

  it('slot dentro de recipe cambia solo description (cosmetic) → patch', () => {
    const a = baseJson({ recipes: [recipe('hero', [slot('title', { description: 'old desc' })])] });
    const b = baseJson({ recipes: [recipe('hero', [slot('title', { description: 'new desc' })])] });
    expect(detectBumpKind(a, b).kind).toBe('patch');
  });
});

// ── MINOR ───────────────────────────────────────────────────────────

describe('detectBumpKind — minor (entidad nueva backward-compat)', () => {
  it('recipe nueva → minor', () => {
    const a = baseJson({ recipes: [recipe('hero')] });
    const b = baseJson({ recipes: [recipe('hero'), recipe('grid')] });
    const r = detectBumpKind(a, b);
    expect(r.kind).toBe('minor');
    expect(r.reasons[0].description).toMatch(/grid.*añadid/);
  });

  it('behavior nuevo → minor', () => {
    const a = baseJson({ behaviors: [behavior('url')] });
    const b = baseJson({ behaviors: [behavior('url'), behavior('email')] });
    expect(detectBumpKind(a, b).kind).toBe('minor');
  });

  it('action nueva → minor', () => {
    const a = baseJson({ actions: [action('open')] });
    const b = baseJson({ actions: [action('open'), action('close')] });
    expect(detectBumpKind(a, b).kind).toBe('minor');
  });

  it('slotAcceptKind nuevo → minor', () => {
    const a = baseJson({ slotAcceptKinds: [slotAcceptKind('text-short')] });
    const b = baseJson({ slotAcceptKinds: [slotAcceptKind('text-short'), slotAcceptKind('date')] });
    expect(detectBumpKind(a, b).kind).toBe('minor');
  });

  it('fieldType nuevo → minor', () => {
    const a = baseJson({ fieldTypes: [fieldType('text')] });
    const b = baseJson({ fieldTypes: [fieldType('text'), fieldType('number')] });
    expect(detectBumpKind(a, b).kind).toBe('minor');
  });

  it('slot opcional nuevo en recipe existente → minor', () => {
    const a = baseJson({ recipes: [recipe('hero', [slot('title')])] });
    const b = baseJson({ recipes: [recipe('hero', [slot('title'), slot('subtitle', { optional: true })])] });
    const r = detectBumpKind(a, b);
    expect(r.kind).toBe('minor');
    expect(r.reasons[0].description).toMatch(/subtitle.*optional/);
  });

  it('cosmetic + nueva entidad → minor wins sobre patch', () => {
    const a = baseJson({ recipes: [recipe('hero', [], { description: 'A' })] });
    const b = baseJson({
      recipes: [
        recipe('hero', [], { description: 'B' }),  // patch
        recipe('grid'),                             // minor
      ],
    });
    expect(detectBumpKind(a, b).kind).toBe('minor');
  });
});

// ── MAJOR ───────────────────────────────────────────────────────────

describe('detectBumpKind — major (breaking)', () => {
  it('recipe eliminada → major', () => {
    const a = baseJson({ recipes: [recipe('hero'), recipe('grid')] });
    const b = baseJson({ recipes: [recipe('hero')] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('behavior eliminado → major', () => {
    const a = baseJson({ behaviors: [behavior('url'), behavior('email')] });
    const b = baseJson({ behaviors: [behavior('url')] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('action eliminada → major', () => {
    const a = baseJson({ actions: [action('open'), action('close')] });
    const b = baseJson({ actions: [action('open')] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('fieldType eliminado → major', () => {
    const a = baseJson({ fieldTypes: [fieldType('text'), fieldType('number')] });
    const b = baseJson({ fieldTypes: [fieldType('text')] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('recipe.kind cambia (shape) → major', () => {
    const a = baseJson({ recipes: [recipe('hero', [], { kind: 'list' })] });
    const b = baseJson({ recipes: [recipe('hero', [], { kind: 'detail' })] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('slot eliminado de recipe → major', () => {
    const a = baseJson({ recipes: [recipe('hero', [slot('title'), slot('subtitle')])] });
    const b = baseJson({ recipes: [recipe('hero', [slot('title')])] });
    const r = detectBumpKind(a, b);
    expect(r.kind).toBe('major');
    expect(r.reasons[0].description).toMatch(/subtitle.*eliminado/);
  });

  it('slot.accepts cambia (shape) → major', () => {
    const a = baseJson({ recipes: [recipe('hero', [slot('title', { accepts: ['text-short'] })])] });
    const b = baseJson({ recipes: [recipe('hero', [slot('title', { accepts: ['text-short', 'date'] })])] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('slot.optional false→true en recipe existente → major (shape change)', () => {
    const a = baseJson({ recipes: [recipe('hero', [slot('subtitle', { optional: false })])] });
    const b = baseJson({ recipes: [recipe('hero', [slot('subtitle', { optional: true })])] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('slot REQUIRED nuevo en recipe existente → major', () => {
    const a = baseJson({ recipes: [recipe('hero', [slot('title')])] });
    const b = baseJson({ recipes: [recipe('hero', [slot('title'), slot('subtitle', { optional: false })])] });
    const r = detectBumpKind(a, b);
    expect(r.kind).toBe('major');
    expect(r.reasons[0].description).toMatch(/REQUIRED/);
  });

  it('behavior.applicableTypes cambia (shape) → major', () => {
    const a = baseJson({ behaviors: [behavior('url', ['text'])] });
    const b = baseJson({ behaviors: [behavior('url', ['text', 'textarea'])] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('action.transition cambia (shape) → major', () => {
    const a = baseJson({ actions: [action('open', { transition: 'static' })] });
    const b = baseJson({ actions: [action('open', { transition: 'modal' })] });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });

  it('major + minor + patch combinados → major wins', () => {
    const a = baseJson({
      recipes: [recipe('hero'), recipe('grid')],
    });
    const b = baseJson({
      recipes: [
        recipe('hero', [], { displayName: 'changed' }),   // patch
        // 'grid' eliminada                                // major
        recipe('list-new'),                                // minor
      ],
    });
    expect(detectBumpKind(a, b).kind).toBe('major');
  });
});

// ── Razones ─────────────────────────────────────────────────────────

describe('detectBumpKind — reasons', () => {
  it('lista todas las razones, ordenadas major → minor → patch', () => {
    const a = baseJson({
      recipes: [recipe('hero'), recipe('grid')],
      behaviors: [behavior('url')],
    });
    const b = baseJson({
      recipes: [
        recipe('hero', [], { displayName: 'changed' }),   // patch
        // 'grid' eliminada                                // major
        recipe('list-new'),                                // minor
      ],
      behaviors: [behavior('url')],
    });
    const r = detectBumpKind(a, b);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
    // Verificar que primero viene major, luego minor, luego patch.
    const levels = r.reasons.map(x => x.level);
    expect(levels[0]).toBe('major');
    const minorIdx = levels.indexOf('minor');
    const patchIdx = levels.indexOf('patch');
    expect(minorIdx).toBeGreaterThan(0);
    expect(patchIdx).toBeGreaterThan(minorIdx);
  });

  it('cada razón apunta a la colección + entidad afectada', () => {
    const a = baseJson({ recipes: [recipe('hero')] });
    const b = baseJson({ recipes: [recipe('hero'), recipe('new-one')] });
    const r = detectBumpKind(a, b);
    expect(r.reasons[0].collection).toBe('recipes');
    expect(r.reasons[0].entityId).toBe('new-one');
  });
});

// ── applyBump ───────────────────────────────────────────────────────

describe('applyBump', () => {
  it('major: 1.2.3 → 2.0.0', () => {
    expect(applyBump('1.2.3', 'major')).toBe('2.0.0');
  });

  it('minor: 1.2.3 → 1.3.0', () => {
    expect(applyBump('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('patch: 1.2.3 → 1.2.4', () => {
    expect(applyBump('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('none: 1.2.3 sin cambios', () => {
    expect(applyBump('1.2.3', 'none')).toBe('1.2.3');
  });

  it('0.0.0 (composiciones legacy): minor → 0.1.0', () => {
    expect(applyBump('0.0.0', 'minor')).toBe('0.1.0');
  });

  it('SemVer inválido lanza error', () => {
    expect(() => applyBump('1.2', 'patch')).toThrow(/SemVer/);
    expect(() => applyBump('hello', 'patch')).toThrow(/SemVer/);
  });
});

// ── Test del KRP real (smoke) ───────────────────────────────────────

describe('detectBumpKind — smoke check con KRP real', () => {
  it('un KRP comparado consigo mismo → none', async () => {
    // Importar el .json real generado del SDK.
    const krp = (await import('../../../contracts/kromia-recipe-protocol-v1.json', {
      with: { type: 'json' },
    })).default as Record<string, unknown>;
    const r = detectBumpKind(krp, krp);
    expect(r.kind).toBe('none');
    expect(r.reasons).toHaveLength(0);
  });
});
