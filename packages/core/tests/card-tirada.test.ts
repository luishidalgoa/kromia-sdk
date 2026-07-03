/** KRO-216 — composición de tirada por sobres, ponderada por rareza. */
import { describe, it, expect } from 'vitest';
import { composeTirada } from '../src/card-tirada';
import type { RaritySource } from '../src/types';

const rarity: RaritySource = {
  fieldKey: 'rareza',
  buckets: [
    { value: 'comun',  weight: 60 },
    { value: 'rara',   weight: 25 },
    { value: 'epica',  weight: 12 },
    { value: 'legend', weight: 3 },
  ],
};

// 2 cartas por rareza.
const cards = [
  { index: 'c1', rarity: 'comun' }, { index: 'c2', rarity: 'comun' },
  { index: 'r1', rarity: 'rara' },  { index: 'r2', rarity: 'rara' },
  { index: 'e1', rarity: 'epica' }, { index: 'e2', rarity: 'epica' },
  { index: 'l1', rarity: 'legend' },{ index: 'l2', rarity: 'legend' },
];

describe('composeTirada (KRO-216)', () => {
  it('slots de rareza FIJA solo sacan cartas de esa rareza', () => {
    const res = composeTirada(rarity, cards, {
      packs: 10,
      slots: [{ rarity: 'comun' }, { rarity: 'comun' }, { rarity: 'rara' }],
      seed: 42,
    });
    expect(res.total).toBe(30);
    for (const a of res.allocations) {
      const card = cards.find(c => c.index === a.cardIndex)!;
      expect(['comun', 'rara']).toContain(card.rarity); // nunca épica/legendaria
    }
    // los 2 primeros slots de cada sobre son comunes → 20 comunes.
    const comunes = res.allocations.filter(a => cards.find(c => c.index === a.cardIndex)!.rarity === 'comun');
    expect(comunes.length).toBe(20);
  });

  it('slot WEIGHTED respeta aprox. los pesos (60/25/12/3) en volumen', () => {
    const res = composeTirada(rarity, cards, { packs: 2000, slots: [{ weighted: true }], seed: 7 });
    expect(res.total).toBe(2000);
    const by = Object.fromEntries(res.perRarity.map(r => [r.rarity, r.count]));
    // Común domina; legendaria es rara. Márgenes amplios (es aleatorio con seed).
    expect(by['comun']).toBeGreaterThan(1000);      // ~1200
    expect(by['legend']).toBeLessThan(150);          // ~60
    expect(by['comun']).toBeGreaterThan(by['rara']); // 60 > 25
    expect(by['rara']).toBeGreaterThan(by['legend']);
  });

  it('es DETERMINISTA: misma seed → misma tirada', () => {
    const spec = { packs: 5, slots: [{ weighted: true }, { rarity: 'rara' }], seed: 123 };
    const a = composeTirada(rarity, cards, spec);
    const b = composeTirada(rarity, cards, spec);
    expect(a.allocations).toEqual(b.allocations);
    // seed distinta → (casi seguro) distinta.
    const c = composeTirada(rarity, cards, { ...spec, seed: 999 });
    expect(c.allocations).not.toEqual(a.allocations);
  });

  it('perCard suma = total y agrupa por carta', () => {
    const res = composeTirada(rarity, cards, { packs: 50, slots: [{ weighted: true }], seed: 1 });
    expect(res.perCard.reduce((s, p) => s + p.count, 0)).toBe(res.total);
  });

  it('rareza sin cartas → rellena con cualquiera + avisa', () => {
    const soloComunes = [{ index: 'c1', rarity: 'comun' }];
    const res = composeTirada(rarity, soloComunes, { packs: 3, slots: [{ rarity: 'legend' }], seed: 5 });
    expect(res.total).toBe(3);
    expect(res.warnings.some(w => /legend/.test(w))).toBe(true);
    expect(res.allocations.every(a => a.cardIndex === 'c1')).toBe(true);
  });
});
