/**
 * KRO-30 — Registry de efectos visuales (`visual-effects.ts`) + validador de
 * tag styles (`tag-styles.ts`).
 */
import { describe, it, expect } from 'vitest';
import {
  allVisualEffects,
  getVisualEffect,
  VISUAL_EFFECT_IDS,
} from '../src/registries/visual-effects';
import { isTagStyleValid, validateTagStyles } from '../src/tag-styles';
import type { TagStyle } from '../src/types';

// ─── Registry ────────────────────────────────────────────────────────────────

describe('visual-effects registry', () => {
  const effects = allVisualEffects();

  it('contiene los 6 efectos de la V1', () => {
    expect(effects).toHaveLength(6);
    expect(effects.map(e => e.id)).toEqual([
      'holographic_effect', 'crown_badge', 'vintage_filter',
      'glow_border', 'frozen', 'signed',
    ]);
  });

  it('IDs únicos', () => {
    const ids = effects.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada efecto tiene shape válido', () => {
    const validLayers = new Set(['overlay', 'badge', 'filter', 'border']);
    const validTypes  = new Set(['enum', 'number', 'string']);
    effects.forEach(e => {
      expect(e.id).toMatch(/^[a-z_]+$/);
      expect(e.displayName).toBeTruthy();
      expect(e.description.length).toBeGreaterThan(10);
      expect(validLayers.has(e.layer)).toBe(true);
      expect(Array.isArray(e.config)).toBe(true);
      e.config.forEach(p => {
        expect(p.key).toMatch(/^[a-z_]+$/);
        expect(p.label).toBeTruthy();
        expect(validTypes.has(p.type)).toBe(true);
        if (p.type === 'enum') {
          expect(p.options && p.options.length > 0).toBe(true);
          // default (si existe) debe estar entre las options
          if (p.default !== undefined) {
            expect(p.options).toContain(p.default);
          }
        }
      });
    });
  });

  it('VISUAL_EFFECT_IDS matchea los ids del catálogo', () => {
    expect([...VISUAL_EFFECT_IDS].sort()).toEqual(effects.map(e => e.id).sort());
  });

  it('getVisualEffect devuelve la entry correcta', () => {
    expect(getVisualEffect('crown_badge')?.layer).toBe('badge');
    expect(getVisualEffect('holographic_effect')?.config[0].key).toBe('intensity');
    expect(getVisualEffect('frozen')?.config).toEqual([]);
    expect(getVisualEffect('unknown')).toBeUndefined();
  });
});

// ─── isTagStyleValid ───────────────────────────────────────────────────────────

describe('isTagStyleValid', () => {
  it('efecto válido sin config → true', () => {
    expect(isTagStyleValid({ value: 'Congelada', effect: 'frozen' })).toBe(true);
  });

  it('efecto válido con config válida → true', () => {
    expect(isTagStyleValid({ value: 'Holográfica', effect: 'holographic_effect', config: { intensity: 'high' } })).toBe(true);
    expect(isTagStyleValid({ value: 'MVP', effect: 'crown_badge', config: { color: 'gold', position: 'top-left' } })).toBe(true);
  });

  it('efecto inexistente → false', () => {
    expect(isTagStyleValid({ value: 'X', effect: 'no_existe' })).toBe(false);
  });

  it('value vacío → false', () => {
    expect(isTagStyleValid({ value: '   ', effect: 'frozen' })).toBe(false);
  });

  it('config con key desconocida → false', () => {
    expect(isTagStyleValid({ value: 'X', effect: 'frozen', config: { foo: 'bar' } })).toBe(false);
  });

  it('config con valor enum fuera de options → false', () => {
    expect(isTagStyleValid({ value: 'X', effect: 'holographic_effect', config: { intensity: 'ultra' } })).toBe(false);
  });

  it('config string (signature_url) acepta cualquier string', () => {
    expect(isTagStyleValid({ value: 'Firmada', effect: 'signed', config: { signature_url: 'https://x/firma.png' } })).toBe(true);
  });

  it('config string con valor numérico → false', () => {
    expect(isTagStyleValid({ value: 'Firmada', effect: 'signed', config: { signature_url: 42 } })).toBe(false);
  });
});

// ─── validateTagStyles ─────────────────────────────────────────────────────────

describe('validateTagStyles', () => {
  it('array válido → valid:true, sin issues', () => {
    const styles: TagStyle[] = [
      { value: 'Holográfica', effect: 'holographic_effect', config: { intensity: 'medium' } },
      { value: 'MVP', effect: 'crown_badge' },
    ];
    const r = validateTagStyles(styles);
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('reporta el índice del entry inválido', () => {
    const styles: TagStyle[] = [
      { value: 'OK', effect: 'frozen' },
      { value: 'Bad', effect: 'inexistente' },
    ];
    const r = validateTagStyles(styles);
    expect(r.valid).toBe(false);
    const err = r.issues.find(i => i.level === 'error');
    expect(err?.index).toBe(1);
    expect(err?.path).toBe('tagStyles[1].effect');
  });

  it('valores de tag duplicados → warn (no invalida)', () => {
    const styles: TagStyle[] = [
      { value: 'Rara', effect: 'glow_border' },
      { value: 'Rara', effect: 'holographic_effect' },
    ];
    const r = validateTagStyles(styles);
    expect(r.valid).toBe(true); // warn no invalida
    const warn = r.issues.find(i => i.level === 'warn');
    expect(warn).toBeDefined();
    expect(warn?.index).toBe(1);
    expect(warn?.message).toContain('duplicado');
  });

  it('array vacío → valid:true', () => {
    expect(validateTagStyles([])).toEqual({ valid: true, issues: [] });
  });
});
