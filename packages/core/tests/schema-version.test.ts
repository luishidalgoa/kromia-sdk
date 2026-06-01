/**
 * KRO-115 — `isSchemaOutdated`: desactualización por MAJOR del core.
 */
import { describe, it, expect } from 'vitest';
import { isSchemaOutdated } from '../src/schema-version';

describe('isSchemaOutdated', () => {
  it('major estampado MENOR que el actual → desactualizado', () => {
    expect(isSchemaOutdated('1.9.9', '2.2.1')).toBe(true);
    expect(isSchemaOutdated('1.0.0', '3.0.0')).toBe(true);
  });

  it('mismo major → al día (minor/patch son backward-compatible)', () => {
    expect(isSchemaOutdated('2.0.0', '2.2.1')).toBe(false);
    expect(isSchemaOutdated('2.9.9', '2.2.1')).toBe(false);
    expect(isSchemaOutdated('2.2.1', '2.2.1')).toBe(false);
  });

  it('major estampado MAYOR (más nuevo) → no desactualizado', () => {
    expect(isSchemaOutdated('3.0.0', '2.2.1')).toBe(false);
  });

  it('estampado ausente/null/inválido → false (legacy/desconocido, no marcar)', () => {
    expect(isSchemaOutdated(undefined, '2.2.1')).toBe(false);
    expect(isSchemaOutdated(null, '2.2.1')).toBe(false);
    expect(isSchemaOutdated('', '2.2.1')).toBe(false);
    expect(isSchemaOutdated('garbage', '2.2.1')).toBe(false);
  });

  it('current inválido → false (sin referencia no marcamos)', () => {
    expect(isSchemaOutdated('1.0.0', 'x')).toBe(false);
  });

  it('tolera SemVer sin minor/patch ("2")', () => {
    expect(isSchemaOutdated('1', '2')).toBe(true);
    expect(isSchemaOutdated('2', '2.0.0')).toBe(false);
  });
});
