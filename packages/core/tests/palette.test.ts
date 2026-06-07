import { describe, it, expect } from 'vitest';
import { paletteClass, colorFieldKey, resolveFieldColor, FIELD_COLOR_PREFIX } from '../src/palette';

describe('paletteClass', () => {
  it('tokens de tema → clases semánticas', () => {
    expect(paletteClass('card', 'bg')).toBe('bg-card');
    expect(paletteClass('muted', 'text')).toBe('text-muted-foreground');
    expect(paletteClass('border', 'border')).toBe('border-border');
  });
  it('colores de la rejilla → `${role}-${id}`', () => {
    expect(paletteClass('red-500', 'bg')).toBe('bg-red-500');
    expect(paletteClass('sky-200', 'border')).toBe('border-sky-200');
  });
  it('sin id → cadena vacía', () => {
    expect(paletteClass(undefined, 'bg')).toBe('');
    expect(paletteClass(null, 'text')).toBe('');
  });
  it('vinculación a campo → cadena vacía (se aplica por estilo inline)', () => {
    expect(paletteClass('field:color', 'bg')).toBe('');
    expect(paletteClass(`${FIELD_COLOR_PREFIX}tint`, 'border')).toBe('');
  });
});

describe('colorFieldKey', () => {
  it('extrae la key de una vinculación a campo', () => {
    expect(colorFieldKey('field:color')).toBe('color');
    expect(colorFieldKey('field:my_tint')).toBe('my_tint');
  });
  it('no es vinculación → null', () => {
    expect(colorFieldKey('red-500')).toBeNull();
    expect(colorFieldKey('card')).toBeNull();
    expect(colorFieldKey(undefined)).toBeNull();
    expect(colorFieldKey('')).toBeNull();
  });
});

describe('resolveFieldColor', () => {
  it('lee el valor del item para una vinculación a campo', () => {
    expect(resolveFieldColor('field:color', { color: '#ff0000' })).toBe('#ff0000');
  });
  it('undefined si no es vinculación (usar paletteClass)', () => {
    expect(resolveFieldColor('red-500', { color: '#ff0000' })).toBeUndefined();
    expect(resolveFieldColor(undefined, { color: '#ff0000' })).toBeUndefined();
  });
  it('undefined si el campo no existe o no es string no vacío', () => {
    expect(resolveFieldColor('field:color', {})).toBeUndefined();
    expect(resolveFieldColor('field:color', { color: '' })).toBeUndefined();
    expect(resolveFieldColor('field:color', { color: 123 })).toBeUndefined();
  });
});
