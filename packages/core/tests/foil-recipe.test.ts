import { describe, it, expect } from 'vitest';
import { foilPatternCss, FOIL_PATTERN_IDS, holographicOpacity } from '../src/foil-recipe';

// Strings EXACTOS que vivían en Studio (VisualEffectLayers `IRID_GRAD`). El builder
// DEBE reproducirlos byte a byte para que mover el dato al SDK no cambie el foil.
const EXPECTED: Record<string, string> = {
  spectrum: 'repeating-linear-gradient(115deg,#ff5fa2 0%,#ffd166 9%,#6efea0 18%,#57d2ff 27%,#b985ff 36%,#ff5fa2 45%)',
  oilslick: 'repeating-linear-gradient(120deg,#3a6df0 0%,#9b5cff 10%,#ff5fa2 20%,#27c4b0 30%,#3a6df0 40%)',
  sunset:   'repeating-linear-gradient(110deg,#ff7e5f 0%,#ffd166 12%,#ff5fa2 24%,#b985ff 36%,#ff7e5f 48%)',
  mint:     'repeating-linear-gradient(115deg,#6efea0 0%,#57d2ff 12%,#b4ddd8 24%,#a0ffe0 36%,#6efea0 48%)',
  aurora:   'conic-gradient(from 0deg,#57d2ff,#6efea0,#ffd166,#ff5fa2,#b985ff,#57d2ff)',
  midnight: 'repeating-linear-gradient(120deg,#3a5fd0 0%,#7a4ad0 11%,#2aa088 22%,#4a6ad0 33%,#3a5fd0 45%)',
};

describe('foil-recipe — foilPatternCss reproduce los strings de Studio', () => {
  it('los 6 patterns coinciden byte a byte con IRID_GRAD', () => {
    for (const [k, v] of Object.entries(EXPECTED)) expect(foilPatternCss(k)).toBe(v);
  });
  it('pattern desconocido cae a spectrum', () => {
    expect(foilPatternCss('nope')).toBe(EXPECTED.spectrum);
  });
  it('FOIL_PATTERN_IDS = las 6 keys', () => {
    expect([...FOIL_PATTERN_IDS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });
  it('holographicOpacity mapea low/medium/high (default medium)', () => {
    expect(holographicOpacity('low')).toBe(0.18);
    expect(holographicOpacity('medium')).toBe(0.32);
    expect(holographicOpacity('high')).toBe(0.48);
    expect(holographicOpacity(undefined)).toBe(0.32);
  });
});
