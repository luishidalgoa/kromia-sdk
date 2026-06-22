/**
 * Tests de `extractAccentSettings` — KRO-73 (B+).
 *
 * Cubre cascada de resolución (composition > slot > recipeDefault) +
 * detección de color hex válido.
 */

import { describe, it, expect } from 'vitest';
import { extractAccentSettings } from '../src/extract-accent';
import type { FieldDefLike, SlotComposition } from '../src/types';

const colorField: FieldDefLike = { key: 'color', type: 'text', behavior: 'color_hex' };

describe('extractAccentSettings — color hex detection', () => {
  it('item con color hex válido (#ff0000) → devuelve color + position', () => {
    const r = extractAccentSettings(
      undefined,
      { color: '#ff0000' },
      [colorField],
      'top',
    );
    expect(r).toEqual({ color: '#ff0000', position: 'top', colorFieldKey: 'color' });
  });

  it('expone colorFieldKey del campo que alimenta el acento (KRO-198)', () => {
    const r = extractAccentSettings(
      undefined,
      { c1: '#ff0000', c2: '#00ff00' },
      [
        { key: 'c1', type: 'text', behavior: 'color_hex' },
        { key: 'c2', type: 'text', behavior: 'color_hex' },
      ],
      'top',
    );
    // El primero gana → su key es la que el host suprime como celda.
    expect(r?.colorFieldKey).toBe('c1');
  });

  it('color hex sin "#" (ff0000) → añade el prefix', () => {
    const r = extractAccentSettings(
      undefined,
      { color: 'ff0000' },
      [colorField],
      'top',
    );
    expect(r?.color).toBe('#ff0000');
  });

  it('color hex con alpha (#ff000080) → válido', () => {
    const r = extractAccentSettings(
      undefined,
      { color: '#ff000080' },
      [colorField],
      'top',
    );
    expect(r?.color).toBe('#ff000080');
  });

  it('color hex inválido (xyz) → undefined', () => {
    const r = extractAccentSettings(
      undefined,
      { color: 'xyz' },
      [colorField],
      'top',
    );
    expect(r).toBeUndefined();
  });

  it('sin fields color_hex → undefined', () => {
    const r = extractAccentSettings(
      undefined,
      { nombre: '#ff0000' },
      [{ key: 'nombre', type: 'text' }],
      'top',
    );
    expect(r).toBeUndefined();
  });

  it('item sin valor en el field color → undefined', () => {
    const r = extractAccentSettings(
      undefined,
      {},
      [colorField],
      'top',
    );
    expect(r).toBeUndefined();
  });

  it('múltiples color_hex → coge el primero', () => {
    const r = extractAccentSettings(
      undefined,
      { c1: '#ff0000', c2: '#00ff00' },
      [
        { key: 'c1', type: 'text', behavior: 'color_hex' },
        { key: 'c2', type: 'text', behavior: 'color_hex' },
      ],
      'top',
    );
    expect(r?.color).toBe('#ff0000');
  });
});

describe('extractAccentSettings — resolución de posición', () => {
  it('sin overrides → recipeDefault', () => {
    const r = extractAccentSettings(
      undefined,
      { color: '#ff0000' },
      [colorField],
      'left',
    );
    expect(r?.position).toBe('left');
  });

  it('composition.accentPosition="top" → "top"', () => {
    const r = extractAccentSettings(
      { slots: {}, accentPosition: 'top' },
      { color: '#ff0000' },
      [colorField],
      'left',
    );
    expect(r?.position).toBe('top');
  });

  it('composition.accentPosition="none" → "none" (NO cae a default)', () => {
    const r = extractAccentSettings(
      { slots: {}, accentPosition: 'none' },
      { color: '#ff0000' },
      [colorField],
      'top',
    );
    expect(r?.position).toBe('none');
  });

  it('composition.accentPosition="auto" + slot.appearance override → slot override', () => {
    const slots: Record<string, SlotComposition> = {
      title: {
        fields: ['color'],
        appearance: { accentPosition: 'right' },
      },
    };
    const r = extractAccentSettings(
      { slots, accentPosition: 'auto' },
      { color: '#ff0000' },
      [colorField],
      'top',
    );
    expect(r?.position).toBe('right');
  });

  it('composition.accentPosition="auto" + slot sin override → recipeDefault', () => {
    const slots: Record<string, SlotComposition> = {
      title: { fields: ['color'] },
    };
    const r = extractAccentSettings(
      { slots, accentPosition: 'auto' },
      { color: '#ff0000' },
      [colorField],
      'left',
    );
    expect(r?.position).toBe('left');
  });

  it('composition explícito > slot override (composition gana)', () => {
    const slots: Record<string, SlotComposition> = {
      title: {
        fields: ['color'],
        appearance: { accentPosition: 'right' },
      },
    };
    const r = extractAccentSettings(
      { slots, accentPosition: 'bottom' },
      { color: '#ff0000' },
      [colorField],
      'top',
    );
    expect(r?.position).toBe('bottom');
  });
});
