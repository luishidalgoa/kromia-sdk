import { describe, it, expect } from 'vitest';
import {
  paletteClass, colorFieldKey, resolveFieldColor, FIELD_COLOR_PREFIX,
  paletteHex, paletteContrastRatio, contrastLevel, PALETTE_HEX, PALETTE,
} from '../src/palette';

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

// ── KRO-198 — contraste WCAG ───────────────────────────────────────────────

describe('paletteHex', () => {
  it('devuelve hex de los tonos de la rejilla', () => {
    expect(paletteHex('red-500')).toBe('#ef4444');
    expect(paletteHex('slate-800')).toBe('#1e293b');
  });
  it('null para tokens de tema, field: y desconocidos', () => {
    expect(paletteHex('card')).toBeNull();        // token de tema (adaptativo)
    expect(paletteHex('primary')).toBeNull();
    expect(paletteHex('field:tint')).toBeNull();
    expect(paletteHex('no-existe')).toBeNull();
    expect(paletteHex(undefined)).toBeNull();
  });
  it('cubre TODOS los tonos crudos de la rejilla (PALETTE group=color)', () => {
    for (const sw of PALETTE) {
      if (sw.group === 'color') {
        expect(PALETTE_HEX[sw.id], `falta hex de ${sw.id}`).toBeTruthy();
        expect(PALETTE_HEX[sw.id]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe('paletteContrastRatio', () => {
  it('blanco-ish vs negro-ish da ratio alto', () => {
    const r = paletteContrastRatio('slate-200', 'slate-800');
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(7); // claro sobre oscuro = legible
  });
  it('oscuro sobre oscuro da ratio bajo (el footgun que avisamos)', () => {
    const r = paletteContrastRatio('slate-800', 'blue-800');
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(4.5);
  });
  it('simétrico (orden de args no importa)', () => {
    expect(paletteContrastRatio('red-500', 'slate-200'))
      .toBeCloseTo(paletteContrastRatio('slate-200', 'red-500')!, 5);
  });
  it('null si algún color no es verificable (tema / field:)', () => {
    expect(paletteContrastRatio('card', 'red-500')).toBeNull();
    expect(paletteContrastRatio('red-500', 'field:tint')).toBeNull();
  });
  it('rango WCAG válido (1..21)', () => {
    const r = paletteContrastRatio('amber-200', 'slate-800')!;
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(21);
  });
});

describe('contrastLevel', () => {
  it('aa para combinaciones legibles', () => {
    expect(contrastLevel('slate-800', 'amber-200')).toBe('aa');
  });
  it('fail para oscuro sobre oscuro', () => {
    expect(contrastLevel('slate-800', 'blue-800')).toBe('fail');
  });
  it('unknown cuando no es verificable', () => {
    expect(contrastLevel('foreground', 'card')).toBe('unknown');
  });
});
