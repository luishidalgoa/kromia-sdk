import { describe, it, expect } from 'vitest';
import { resolveCardTitle } from '../src/card-title';
import type { FieldDefLike } from '../src/types';

const FIELDS: FieldDefLike[] = [
  { key: 'numero', type: 'number', behavior: 'incremental' },
  { key: 'nombre', type: 'text' },
  { key: 'web',    type: 'text', behavior: 'url' },
];

describe('resolveCardTitle — título visible de carta (KRO-222/223)', () => {
  it('1) cardTitleKey explícito manda', () => {
    expect(resolveCardTitle({ numero: 6, nombre: 'Ignis' }, FIELDS, 'nombre', 'numero')).toBe('Ignis');
  });

  it('2) sin cardTitleKey → primer texto legible (no la PK)', () => {
    expect(resolveCardTitle({ numero: 6, nombre: 'Ignis' }, FIELDS, undefined, 'numero')).toBe('Ignis');
  });

  it('el texto legible ignora url/email/phone', () => {
    const only = [{ key: 'web', type: 'text', behavior: 'url' }, { key: 'n', type: 'number' }];
    // sin texto legible ni PK → 'Carta'
    expect(resolveCardTitle({ web: 'x', n: 3 }, only)).toBe('Carta');
  });

  it('3) fallback a la primary key si no hay texto legible', () => {
    const nums = [{ key: 'numero', type: 'number' }];
    expect(resolveCardTitle({ numero: 6 }, nums, undefined, 'numero')).toBe('6');
  });

  it('4) fallback final "Carta" si el campo elegido no tiene valor', () => {
    expect(resolveCardTitle({ numero: 6 }, FIELDS, 'nombre', 'numero')).toBe('Carta');
  });

  it('cardTitleKey inexistente → cae a texto legible', () => {
    expect(resolveCardTitle({ numero: 6, nombre: 'Ignis' }, FIELDS, 'noexiste', 'numero')).toBe('Ignis');
  });

  it('lee claves dot-notation anidadas', () => {
    const f = [{ key: 'meta.title', type: 'text' }];
    expect(resolveCardTitle({ meta: { title: 'Anidado' } }, f, 'meta.title')).toBe('Anidado');
  });
});
