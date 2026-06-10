/**
 * KRO-189 — catálogo de iconos de sección + heurística de sugerencia.
 */
import { describe, it, expect } from 'vitest';
import { SECTION_ICONS, suggestSectionIcon } from '../src/section-icons';

describe('SECTION_ICONS — integridad del catálogo', () => {
  it('tiene 40+ iconos curados (mandato: "25... incluso muchos más")', () => {
    expect(SECTION_ICONS.length).toBeGreaterThanOrEqual(40);
  });

  it('ids únicos, kebab-case, labels y keywords no vacíos', () => {
    const ids = new Set<string>();
    for (const def of SECTION_ICONS) {
      expect(def.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.keywords.length).toBeGreaterThan(0);
    }
  });

  it('keywords normalizadas: minúsculas y sin acentos (el matcher pliega antes)', () => {
    for (const def of SECTION_ICONS) {
      for (const kw of def.keywords) {
        expect(kw).toBe(kw.toLowerCase());
        expect(kw.normalize('NFD').replace(/[̀-ͯ]/g, '')).toBe(kw);
      }
    }
  });
});

describe('suggestSectionIcon — heurística', () => {
  it('matchea las secciones canónicas del demo', () => {
    expect(suggestSectionIcon('Cartas')).toBe('cards');
    expect(suggestSectionIcon('Reinos')).toBe('crown');
    expect(suggestSectionIcon('Leyendas')).toBe('book');
  });

  it('pliega acentos y matchea por palabra dentro de nombres largos', () => {
    expect(suggestSectionIcon('Montañas del norte')).toBe('mountain');
    expect(suggestSectionIcon('Música de los 80')).toBe('music');
  });

  it('match por PALABRA, no substring: "Cartagena" no es "carta"', () => {
    expect(suggestSectionIcon('Cartagena')).toBeNull();
  });

  it('sin match claro devuelve null (nunca icono genérico de relleno)', () => {
    expect(suggestSectionIcon('Zzyzx')).toBeNull();
    expect(suggestSectionIcon('')).toBeNull();
    expect(suggestSectionIcon('   ')).toBeNull();
  });
});
