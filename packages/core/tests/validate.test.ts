/**
 * Tests del validador `validateComposition` — KRO-79.
 *
 * Cubre las reglas principales con casos happy + fail. La estructura es:
 *
 *   - "happy path" — composition canónica → valid=true, sin issues
 *   - Por cada regla, un caso fail aislado → issue específica
 *   - Tests semánticos: warnings no invalidan, sin fieldDefs no falla
 *     por referencias
 */

import { describe, it, expect } from 'vitest';
import { validateComposition } from '../src/validate';
import type { ViewComposition, FieldDefLike } from '../src/index';

// ── Helpers ────────────────────────────────────────────────────────

/** Composition canónica simple: hero_protagonico con title=nombre. */
function makeValidComposition(): ViewComposition {
  return {
    recipe: 'hero_protagonico',
    action: 'none',
    slots: {
      title: { fields: ['nombre'] },
    },
  };
}

function fieldsBase(): FieldDefLike[] {
  return [
    { key: 'nombre',  type: 'text' },
    { key: 'edad',    type: 'number' },
    { key: 'avatar',  type: 'image' },
    { key: 'galeria', type: 'array<image>', behavior: 'gallery' },
  ];
}

// ── Happy path ─────────────────────────────────────────────────────

describe('validateComposition — happy paths', () => {
  it('composition canónica sin fieldDefs → valid', () => {
    const r = validateComposition(makeValidComposition());
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('composition canónica con fieldDefs → valid', () => {
    const r = validateComposition(makeValidComposition(), { fieldDefs: fieldsBase() });
    expect(r.valid).toBe(true);
    expect(r.issues.filter(i => i.level === 'error')).toEqual([]);
  });

  it('composition con accentPosition válido → valid', () => {
    const c = makeValidComposition();
    c.accentPosition = 'top';
    const r = validateComposition(c);
    expect(r.valid).toBe(true);
  });
});

// ── recipe ─────────────────────────────────────────────────────────

describe('validateComposition — recipe', () => {
  it('recipe inexistente → error', () => {
    const c = makeValidComposition();
    (c as any).recipe = 'fake_recipe';
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues).toContainEqual(expect.objectContaining({
      path: 'recipe',
      level: 'error',
    }));
  });
});

// ── action ─────────────────────────────────────────────────────────

describe('validateComposition — action', () => {
  it('action inválida → error', () => {
    const c = makeValidComposition();
    (c as any).action = 'fake_action';
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues).toContainEqual(expect.objectContaining({
      path: 'action',
      level: 'error',
    }));
  });

  it('cada action válida pasa', () => {
    const actions = ['none', 'navigate_to_detail', 'modal', 'expand_inline', 'external_link'] as const;
    actions.forEach(a => {
      const c = makeValidComposition();
      c.action = a;
      const r = validateComposition(c);
      const errs = r.issues.filter(i => i.path === 'action' && i.level === 'error');
      expect(errs).toEqual([]);
    });
  });
});

// ── slot fields ────────────────────────────────────────────────────

describe('validateComposition — slot fields', () => {
  it('field inexistente con fieldDefs → error', () => {
    const c = makeValidComposition();
    c.slots.title.fields = ['fantasma'];
    const r = validateComposition(c, { fieldDefs: fieldsBase() });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.message.includes('fantasma'))).toBe(true);
  });

  it('field inexistente SIN fieldDefs → no falla (no se valida)', () => {
    const c = makeValidComposition();
    c.slots.title.fields = ['fantasma'];
    const r = validateComposition(c);
    expect(r.issues.filter(i => i.path.startsWith('slots.title.fields'))).toEqual([]);
  });

  it('field incompatible con accept kind → error', () => {
    // title acepta text-short. Pasamos un field type=image → incompatible.
    const c = makeValidComposition();
    c.slots.title.fields = ['avatar'];
    const r = validateComposition(c, { fieldDefs: fieldsBase() });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.message.includes('no es compatible'))).toBe(true);
  });

  it('single slot con múltiples fields → warn (no error)', () => {
    const c = makeValidComposition();
    c.slots.title.fields = ['nombre', 'edad']; // title es single
    const r = validateComposition(c, { fieldDefs: fieldsBase() });
    const warns = r.issues.filter(i => i.level === 'warn');
    expect(warns.some(w => w.message.includes('single'))).toBe(true);
  });
});

// ── appearance ─────────────────────────────────────────────────────

describe('validateComposition — appearance', () => {
  it('shape inválido → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { shape: 'fake' as any };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues).toContainEqual(expect.objectContaining({
      path: 'slots.title.appearance.shape',
      level: 'error',
    }));
  });

  it('aspect inválido → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { aspect: 'fake' as any };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('align inválido → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { align: 'fake' as any };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('weight inválido → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { weight: 'fake' as any };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('size inválido → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { size: 'fake' as any };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('truncateChars fuera de rango → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { truncateChars: 1000 };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);

    const c2 = makeValidComposition();
    c2.slots.title.appearance = { truncateChars: 0 };
    const r2 = validateComposition(c2);
    expect(r2.valid).toBe(false);
  });

  it('truncateChars válido (1-500) → ok', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { truncateChars: 80 };
    const r = validateComposition(c);
    expect(r.valid).toBe(true);
  });

  it('accentPosition inválido → error', () => {
    const c = makeValidComposition();
    c.slots.title.appearance = { accentPosition: 'fake' as any };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('accentPosition top-level inválido → error', () => {
    const c = makeValidComposition();
    (c as any).accentPosition = 'fake';
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues).toContainEqual(expect.objectContaining({
      path: 'accentPosition',
      level: 'error',
    }));
  });
});

// ── orientation ────────────────────────────────────────────────────

describe('validateComposition — orientation', () => {
  it('orientation inválida → error', () => {
    const c = makeValidComposition();
    (c.slots.title as any).orientation = 'diagonal';
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('orientation horizontal/vertical → ok', () => {
    const c = makeValidComposition();
    c.slots.title.orientation = 'vertical';
    const r = validateComposition(c);
    expect(r.valid).toBe(true);
  });
});

// ── expand ─────────────────────────────────────────────────────────

describe('validateComposition — expand', () => {
  it('expand.recipe inexistente → error', () => {
    const c = makeValidComposition();
    c.expand = { recipe: 'fake' as any, slots: {} };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('expand.recipe de kind=detail → error', () => {
    const c = makeValidComposition();
    c.expand = { recipe: 'hero_protagonico', slots: {} }; // hero es detail, no expand
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.message.includes('no es de kind=expand'))).toBe(true);
  });

  it('expand.recipe de kind=expand → ok', () => {
    const c = makeValidComposition();
    c.expand = { recipe: 'accordion_simple', slots: {} };
    const r = validateComposition(c);
    expect(r.issues.filter(i => i.path.startsWith('expand.recipe') && i.level === 'error')).toEqual([]);
  });
});

// ── targetRecipe ───────────────────────────────────────────────────

describe('validateComposition — targetRecipe', () => {
  it('targetRecipe inexistente → error', () => {
    const c = makeValidComposition();
    (c as any).targetRecipe = 'fake';
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('targetRecipe de kind=list → warn (no error)', () => {
    const c = makeValidComposition();
    c.targetRecipe = 'compact_avatar'; // list, no detail
    const r = validateComposition(c);
    const warns = r.issues.filter(i => i.path === 'targetRecipe' && i.level === 'warn');
    expect(warns.length).toBeGreaterThan(0);
    expect(r.valid).toBe(true);
  });

  it('targetRecipe de kind=detail → ok', () => {
    const c = makeValidComposition();
    c.targetRecipe = 'hero_protagonico';
    const r = validateComposition(c);
    expect(r.issues.filter(i => i.path === 'targetRecipe')).toEqual([]);
  });
});

// ── slotOverrides ──────────────────────────────────────────────────

describe('validateComposition — slotOverrides', () => {
  it('disabled con slot inexistente → warn', () => {
    const c = makeValidComposition();
    c.slotOverrides = { disabled: ['fantasma'] };
    const r = validateComposition(c);
    const warns = r.issues.filter(i => i.level === 'warn');
    expect(warns.some(w => w.path.startsWith('slotOverrides.disabled'))).toBe(true);
    expect(r.valid).toBe(true); // warns no invalidan
  });

  it('custom slot shape válido → ok', () => {
    const c = makeValidComposition();
    c.slotOverrides = {
      custom: [{
        id:      'extra',
        label:   'Extra',
        kind:    'single',
        accepts: ['text-short'],
      }],
    };
    const r = validateComposition(c);
    expect(r.issues.filter(i => i.path.startsWith('slotOverrides.custom'))).toEqual([]);
  });

  it('custom slot sin label → error', () => {
    const c = makeValidComposition();
    c.slotOverrides = {
      custom: [{ id: 'x', label: '', kind: 'single', accepts: ['text-short'] }],
    };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('custom slot con kind inválido → error', () => {
    const c = makeValidComposition();
    c.slotOverrides = {
      custom: [{ id: 'x', label: 'X', kind: 'fake' as any, accepts: ['text-short'] }],
    };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });
});

// ── linkField (KRO-80) ─────────────────────────────────────────────

describe('validateComposition — linkField', () => {
  it('linkField ausente → ok', () => {
    const r = validateComposition(makeValidComposition(), { fieldDefs: fieldsBase() });
    expect(r.issues.filter(i => i.path === 'linkField')).toEqual([]);
  });

  it('linkField string vacío → error', () => {
    const c = makeValidComposition();
    c.linkField = '   ';
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.path === 'linkField')).toBe(true);
  });

  it('linkField referencia field existente → ok', () => {
    const c = makeValidComposition();
    c.linkField = 'nombre';
    const r = validateComposition(c, { fieldDefs: fieldsBase() });
    expect(r.issues.filter(i => i.path === 'linkField')).toEqual([]);
  });

  it('linkField referencia field inexistente → error', () => {
    const c = makeValidComposition();
    c.linkField = 'fantasma';
    const r = validateComposition(c, { fieldDefs: fieldsBase() });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i =>
      i.path === 'linkField' && i.message.includes('fantasma'),
    )).toBe(true);
  });

  it('linkField inexistente SIN fieldDefs → no falla (no se valida)', () => {
    const c = makeValidComposition();
    c.linkField = 'fantasma';
    const r = validateComposition(c);
    expect(r.issues.filter(i => i.path === 'linkField')).toEqual([]);
  });
});

// ── nestedComposition (KRO-80) ─────────────────────────────────────

describe('validateComposition — nestedComposition (depth max=2)', () => {
  it('nested válido (depth 2) → ok', () => {
    const c = makeValidComposition();
    c.slots.title.nestedComposition = {
      recipe: 'compact_avatar',
      slots: {
        title: { fields: ['otro'] },
      },
    };
    const r = validateComposition(c);
    expect(r.issues.filter(i => i.path.includes('nestedComposition') && i.level === 'error')).toEqual([]);
  });

  it('nested con recipe vacío → error', () => {
    const c = makeValidComposition();
    c.slots.title.nestedComposition = {
      recipe: '' as any,
      slots: {},
    };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.path.endsWith('nestedComposition.recipe'))).toBe(true);
  });

  it('nested DENTRO de nested → error (depth > 2)', () => {
    const c = makeValidComposition();
    c.slots.title.nestedComposition = {
      recipe: 'compact_avatar',
      slots: {
        title: {
          fields: ['x'],
          nestedComposition: {
            recipe: 'compact_card',
            slots: {},
          },
        },
      },
    };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.message.includes('profundidad máxima'))).toBe(true);
  });

  it('nested.slots con field key vacío → error', () => {
    const c = makeValidComposition();
    c.slots.title.nestedComposition = {
      recipe: 'compact_avatar',
      slots: {
        title: { fields: ['  '] },
      },
    };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('nested.slots NO es objeto → error', () => {
    const c = makeValidComposition();
    c.slots.title.nestedComposition = {
      recipe: 'compact_avatar',
      slots: null as any,
    };
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });
});

// ── Semánticos ─────────────────────────────────────────────────────

describe('validateComposition — semánticos', () => {
  it('valid=true cuando solo hay warnings', () => {
    const c = makeValidComposition();
    c.slotOverrides = { disabled: ['fantasma'] }; // warn
    c.targetRecipe = 'compact_avatar'; // warn (kind wrong)
    const r = validateComposition(c);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues.every(i => i.level === 'warn')).toBe(true);
    expect(r.valid).toBe(true);
  });

  it('valid=false si hay AL MENOS un error', () => {
    const c = makeValidComposition();
    (c as any).recipe = 'fake'; // 1 error
    c.slotOverrides = { disabled: ['fantasma'] }; // 1 warn
    const r = validateComposition(c);
    expect(r.valid).toBe(false);
  });

  it('cada issue incluye path + message + level', () => {
    const c = makeValidComposition();
    (c as any).recipe = 'fake';
    const r = validateComposition(c);
    r.issues.forEach(i => {
      expect(i.path).toBeTruthy();
      expect(i.message).toBeTruthy();
      expect(['error', 'warn']).toContain(i.level);
    });
  });
});
