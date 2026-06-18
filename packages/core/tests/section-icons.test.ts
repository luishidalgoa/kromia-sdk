/**
 * KRO-189 — catálogo de iconos de sección + heurística de sugerencia.
 */
import { describe, it, expect } from 'vitest';
import { SECTION_ICONS, suggestSectionIcon, lucideIconName } from '../src/section-icons';

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

describe('lucideIconName — nombre lucide canónico (fuente única Studio↔Flutter)', () => {
  it('default = id cuando no se declara `lucide`', () => {
    const crown = SECTION_ICONS.find(d => d.id === 'crown')!;
    expect(crown.lucide).toBeUndefined();
    expect(lucideIconName(crown)).toBe('crown');
  });

  it('usa el nombre lucide declarado donde difiere del id', () => {
    const cases: Record<string, string> = {
      cards: 'wallet-cards', dice: 'dices', book: 'book-open', wand: 'wand-2',
      flask: 'flask-conical', crystal: 'eye', paw: 'paw-print', bolt: 'zap',
      building: 'building-2', ball: 'goal',
    };
    for (const [id, lucide] of Object.entries(cases)) {
      const def = SECTION_ICONS.find(d => d.id === id)!;
      expect(def, `id ${id} existe`).toBeDefined();
      expect(lucideIconName(def)).toBe(lucide);
    }
  });

  it('todo nombre lucide resuelto es kebab-case válido', () => {
    for (const def of SECTION_ICONS) {
      expect(lucideIconName(def)).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('`lucide` solo se declara cuando DIFIERE del id (sin redundancia)', () => {
    for (const def of SECTION_ICONS) {
      if (def.lucide !== undefined) expect(def.lucide).not.toBe(def.id);
    }
  });
});
