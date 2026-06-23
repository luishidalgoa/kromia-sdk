import { describe, it, expect } from 'vitest';
import { matchConditionalCase, resolveConditionalAppearance, resolveConditionalStyling } from '../src/conditional-style';
import type { ConditionalStyle } from '../src/types';

describe('matchConditionalCase', () => {
  it('eq (default) case-insensitive + trim', () => {
    expect(matchConditionalCase({ value: 'Legendaria' }, 'legendaria')).toBe(true);
    expect(matchConditionalCase({ op: 'eq', value: 'rara' }, 'Rara ')).toBe(true);
    expect(matchConditionalCase({ value: 'rara' }, 'común')).toBe(false);
  });
  it('neq', () => {
    expect(matchConditionalCase({ op: 'neq', value: 'común' }, 'rara')).toBe(true);
    expect(matchConditionalCase({ op: 'neq', value: 'rara' }, 'rara')).toBe(false);
  });
  it('contains', () => {
    expect(matchConditionalCase({ op: 'contains', value: 'fue' }, 'Tipo Fuego')).toBe(true);
    expect(matchConditionalCase({ op: 'contains', value: 'agua' }, 'Tipo Fuego')).toBe(false);
  });
  it('comparaciones numéricas', () => {
    expect(matchConditionalCase({ op: 'gt', value: '10' }, 15)).toBe(true);
    expect(matchConditionalCase({ op: 'lte', value: '0' }, 0)).toBe(true);
    expect(matchConditionalCase({ op: 'lt', value: '0' }, '5')).toBe(false);
    expect(matchConditionalCase({ op: 'gte', value: '3' }, 'no-num')).toBe(false);
  });
  it('truthy / falsy ignoran value', () => {
    expect(matchConditionalCase({ op: 'truthy' }, 'algo')).toBe(true);
    expect(matchConditionalCase({ op: 'truthy' }, '')).toBe(false);
    expect(matchConditionalCase({ op: 'falsy' }, 0)).toBe(true);
    expect(matchConditionalCase({ op: 'falsy' }, 'x')).toBe(false);
  });
});

describe('resolveConditionalAppearance', () => {
  const cond: ConditionalStyle = {
    fieldKey: 'rareza',
    cases: [
      { value: 'legendaria', appearance: { textColor: 'amber-400', display: 'badge' } },
      { value: 'rara',       appearance: { textColor: 'sky-500' } },
    ],
  };

  it('primer caso que matchea gana y MERGE-a sobre la base', () => {
    const out = resolveConditionalAppearance(cond, { weight: 'bold' }, { rareza: 'legendaria' });
    expect(out).toEqual({ weight: 'bold', textColor: 'amber-400', display: 'badge' });
  });
  it('segundo caso', () => {
    const out = resolveConditionalAppearance(cond, undefined, { rareza: 'rara' });
    expect(out).toEqual({ textColor: 'sky-500' });
  });
  it('sin match → base intacta', () => {
    const base = { weight: 'bold' as const };
    expect(resolveConditionalAppearance(cond, base, { rareza: 'común' })).toEqual(base);
  });
  it('sin condicional / sin item → base', () => {
    expect(resolveConditionalAppearance(undefined, { size: 'lg' }, { rareza: 'rara' })).toEqual({ size: 'lg' });
    expect(resolveConditionalAppearance(cond, { size: 'lg' }, undefined)).toEqual({ size: 'lg' });
  });
  it('cases vacío → base', () => {
    expect(resolveConditionalAppearance({ fieldKey: 'x', cases: [] }, { size: 'sm' }, { x: 'y' })).toEqual({ size: 'sm' });
  });

  // KRO-198 — cláusula ELSE (otherwise): fallback cuando NINGÚN caso coincide.
  const condElse: ConditionalStyle = {
    ...cond,
    otherwise: { appearance: { textColor: 'zinc-400' } },
  };
  it('sin match + hay else → aplica el else sobre la base', () => {
    const out = resolveConditionalAppearance(condElse, { weight: 'bold' }, { rareza: 'común' });
    expect(out).toEqual({ weight: 'bold', textColor: 'zinc-400' });
  });
  it('hay match → el else se IGNORA (gana el caso)', () => {
    const out = resolveConditionalAppearance(condElse, { weight: 'bold' }, { rareza: 'legendaria' });
    expect(out).toEqual({ weight: 'bold', textColor: 'amber-400', display: 'badge' });
  });
});

describe('resolveConditionalStyling (caso efectivo, con else)', () => {
  const cond: ConditionalStyle = {
    fieldKey: 'rareza',
    cases: [{ value: 'legendaria', appearance: { textColor: 'amber-400' }, target: ['rareza'] }],
    otherwise: { appearance: { textColor: 'zinc-400' }, target: ['rareza'] },
  };

  it('caso coincide → devuelve ese caso (con su target)', () => {
    expect(resolveConditionalStyling(cond, { rareza: 'legendaria' })).toEqual(cond.cases[0]);
  });
  it('ningún caso coincide + hay else → devuelve el else', () => {
    expect(resolveConditionalStyling(cond, { rareza: 'común' })).toEqual(cond.otherwise);
  });
  it('ningún caso coincide + sin else → undefined', () => {
    const noElse: ConditionalStyle = { fieldKey: 'rareza', cases: cond.cases };
    expect(resolveConditionalStyling(noElse, { rareza: 'común' })).toBeUndefined();
  });
  it('sin condicional / sin item → undefined (no toca el else)', () => {
    expect(resolveConditionalStyling(undefined, { rareza: 'común' })).toBeUndefined();
    expect(resolveConditionalStyling(cond, undefined)).toBeUndefined();
  });
});
