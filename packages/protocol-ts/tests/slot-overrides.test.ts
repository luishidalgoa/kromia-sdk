/**
 * Tests de KRO-58 V5 — slots customizables per-instance.
 *
 * Cubre `getEffectiveSlots` + `validateSlotOverrides`. Estos helpers son
 * críticos para que el editor permita al publisher disabled-ear / añadir
 * / reordenar slots sin tocar el manifest base.
 *
 * La próxima migración (quitar Studio's hardcoded slot logic) depende
 * de que estos helpers se comporten exactamente como el código actual
 * en Studio. Estos tests son la baseline.
 */

import { describe, it, expect } from 'vitest';
import {
  getEffectiveSlots,
  validateSlotOverrides,
  customSlotToSlotDefinition,
} from '../src/classify';
import type { RecipeManifest, SlotDefinition } from '../src/registries/recipes';
import type { SlotOverrides, CustomSlotDefinition } from '../src/types';

// Manifest sintético para no depender del catálogo real (más controlable).
const baseManifest: RecipeManifest = {
  id:          'compact_avatar',
  kind:        'list',
  displayName: 'Avatar compacto',
  description: 'test',
  slots: [
    { id: 'avatar',   label: 'Avatar',   kind: 'single',     accepts: ['image'] },
    { id: 'title',    label: 'Título',   kind: 'single',     accepts: ['text-short'] },
    { id: 'subtitle', label: 'Subtítulo', kind: 'composable', accepts: ['text-short'], optional: true },
    { id: 'meta',     label: 'Meta',     kind: 'single',     accepts: ['text-short', 'badge'], optional: true },
  ],
};

const customSlot: CustomSlotDefinition = {
  id:      'extra',
  label:   'Extra',
  kind:    'single',
  accepts: ['text-short'],
};

describe('getEffectiveSlots', () => {
  it('manifest undefined → []', () => {
    expect(getEffectiveSlots(undefined, undefined)).toEqual([]);
  });

  it('overrides undefined → manifest.slots tal cual (mismo orden)', () => {
    const result = getEffectiveSlots(baseManifest, undefined);
    expect(result).toEqual(baseManifest.slots);
  });

  it('overrides empty {} → manifest.slots tal cual', () => {
    const result = getEffectiveSlots(baseManifest, {});
    expect(result.map(s => s.id)).toEqual(['avatar', 'title', 'subtitle', 'meta']);
  });

  it('disabled excluye los slots base listados', () => {
    const ov: SlotOverrides = { disabled: ['subtitle', 'meta'] };
    const result = getEffectiveSlots(baseManifest, ov);
    expect(result.map(s => s.id)).toEqual(['avatar', 'title']);
  });

  it('custom añade slots al final por defecto', () => {
    const ov: SlotOverrides = { custom: [customSlot] };
    const result = getEffectiveSlots(baseManifest, ov);
    expect(result.map(s => s.id)).toEqual(['avatar', 'title', 'subtitle', 'meta', 'extra']);
  });

  it('disabled + custom combinados', () => {
    const ov: SlotOverrides = { disabled: ['meta'], custom: [customSlot] };
    const result = getEffectiveSlots(baseManifest, ov);
    expect(result.map(s => s.id)).toEqual(['avatar', 'title', 'subtitle', 'extra']);
  });

  it('order reordena por el array proporcionado', () => {
    const ov: SlotOverrides = { order: ['title', 'meta', 'avatar', 'subtitle'] };
    const result = getEffectiveSlots(baseManifest, ov);
    expect(result.map(s => s.id)).toEqual(['title', 'meta', 'avatar', 'subtitle']);
  });

  it('order parcial: ids listados primero, no listados al final en orden natural', () => {
    const ov: SlotOverrides = { order: ['meta', 'title'] };
    const result = getEffectiveSlots(baseManifest, ov);
    expect(result.map(s => s.id)).toEqual(['meta', 'title', 'avatar', 'subtitle']);
  });

  it('order con ids inexistentes los ignora (no crashea)', () => {
    const ov: SlotOverrides = { order: ['ghost', 'title'] };
    const result = getEffectiveSlots(baseManifest, ov);
    // 'ghost' no existe → ignorado. 'title' primero, resto al final natural.
    expect(result.map(s => s.id)).toEqual(['title', 'avatar', 'subtitle', 'meta']);
  });

  it('order con duplicados los deduplica', () => {
    const ov: SlotOverrides = { order: ['title', 'title', 'avatar'] };
    const result = getEffectiveSlots(baseManifest, ov);
    expect(result.map(s => s.id)).toEqual(['title', 'avatar', 'subtitle', 'meta']);
  });

  it('combinación completa: disabled + custom + order', () => {
    const ov: SlotOverrides = {
      disabled: ['meta'],
      custom:   [customSlot],
      order:    ['extra', 'title'],
    };
    const result = getEffectiveSlots(baseManifest, ov);
    // Habilitados: avatar, title, subtitle, extra (custom).
    // Order: extra → title primero, luego naturales no listados (avatar, subtitle).
    expect(result.map(s => s.id)).toEqual(['extra', 'title', 'avatar', 'subtitle']);
  });

  it('NO muta el manifest original', () => {
    const original = JSON.parse(JSON.stringify(baseManifest));
    getEffectiveSlots(baseManifest, { disabled: ['title'] });
    expect(baseManifest).toEqual(original);
  });
});

describe('validateSlotOverrides', () => {
  it('overrides undefined → null (OK)', () => {
    expect(validateSlotOverrides(baseManifest, undefined)).toBeNull();
  });

  it('manifest undefined → null (no se valida)', () => {
    expect(validateSlotOverrides(undefined, { disabled: ['x'] })).toBeNull();
  });

  it('disabled con id existente → null', () => {
    expect(validateSlotOverrides(baseManifest, { disabled: ['title'] })).toBeNull();
  });

  it('disabled con id inexistente → error', () => {
    const err = validateSlotOverrides(baseManifest, { disabled: ['ghost'] });
    expect(err).toMatch(/ghost.*no existe/);
  });

  it('custom slot sin id → error', () => {
    const bad: CustomSlotDefinition = { id: '', label: 'Bad', kind: 'single', accepts: ['text-short'] };
    const err = validateSlotOverrides(baseManifest, { custom: [bad] });
    expect(err).toMatch(/sin id/);
  });

  it('custom slot con id mal formado → error', () => {
    const bad: CustomSlotDefinition = { id: '1bad-id', label: 'Bad', kind: 'single', accepts: ['text-short'] };
    const err = validateSlotOverrides(baseManifest, { custom: [bad] });
    expect(err).toMatch(/id inválido/);
  });

  it('custom slot colisiona con base → error', () => {
    const bad: CustomSlotDefinition = { id: 'title', label: 'Bad', kind: 'single', accepts: ['text-short'] };
    const err = validateSlotOverrides(baseManifest, { custom: [bad] });
    expect(err).toMatch(/colisiona/);
  });

  it('dos custom con mismo id → error duplicado', () => {
    const c1: CustomSlotDefinition = { id: 'a', label: 'A', kind: 'single', accepts: ['text-short'] };
    const c2: CustomSlotDefinition = { id: 'a', label: 'A2', kind: 'single', accepts: ['text-short'] };
    const err = validateSlotOverrides(baseManifest, { custom: [c1, c2] });
    expect(err).toMatch(/duplicado/);
  });

  it('custom sin label → error', () => {
    const bad: CustomSlotDefinition = { id: 'x', label: '', kind: 'single', accepts: ['text-short'] };
    const err = validateSlotOverrides(baseManifest, { custom: [bad] });
    expect(err).toMatch(/sin label/);
  });

  it('custom kind inválido → error', () => {
    const bad = { id: 'x', label: 'X', kind: 'weird' as 'single', accepts: ['text-short' as const] };
    const err = validateSlotOverrides(baseManifest, { custom: [bad as CustomSlotDefinition] });
    expect(err).toMatch(/kind inválido/);
  });

  it('custom sin accepts → error', () => {
    const bad = { id: 'x', label: 'X', kind: 'single' as const, accepts: [] };
    const err = validateSlotOverrides(baseManifest, { custom: [bad as CustomSlotDefinition] });
    expect(err).toMatch(/sin accepts/);
  });

  it('overrides completos válidos → null', () => {
    const ov: SlotOverrides = {
      disabled: ['meta'],
      custom:   [customSlot],
      order:    ['avatar', 'extra'],
    };
    expect(validateSlotOverrides(baseManifest, ov)).toBeNull();
  });
});

describe('customSlotToSlotDefinition', () => {
  it('convierte una CustomSlotDefinition a SlotDefinition sin pérdida', () => {
    const c: CustomSlotDefinition = {
      id:          'x',
      label:       'X',
      kind:        'composable',
      accepts:     ['text-short', 'badge'],
      optional:    true,
      description: 'test',
    };
    const s: SlotDefinition = customSlotToSlotDefinition(c);
    expect(s.id).toBe('x');
    expect(s.accepts).toEqual(['text-short', 'badge']);
    expect(s.kind).toBe('composable');
    expect(s.optional).toBe(true);
  });
});
