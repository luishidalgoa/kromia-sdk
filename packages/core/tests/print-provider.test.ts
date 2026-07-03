import { describe, it, expect } from 'vitest';
import { matchProviderToTirada } from '../src/print-provider';
import type { PrintProviderProfile, TiradaPrintNeeds } from '../src/print-provider';

const base: PrintProviderProfile = {
  id: 'p1', name: 'Test Print', status: 'active',
  capabilities: { foil: true, foilPerCardVariable: false, uniqueQr: true, sizes: ['poker-63x88'], minOrderQty: 50 },
  fileSpec: {},
};

describe('matchProviderToTirada', () => {
  it('acepta una tirada que el proveedor cubre', () => {
    const needs: TiradaPrintNeeds = { hasFoil: true, hasUniqueQr: true, size: 'poker-63x88', quantity: 200 };
    const m = matchProviderToTirada(base, needs);
    expect(m.ok).toBe(true);
    expect(m.gaps).toHaveLength(0);
  });

  it('marca gap si pide foil por carta y el proveedor no lo hace', () => {
    const m = matchProviderToTirada(base, { hasFoil: true, foilPerCard: true, hasUniqueQr: false });
    expect(m.ok).toBe(false);
    expect(m.gaps.some(g => /por carta/i.test(g))).toBe(true);
  });

  it('marca gap por foil, VDP, MOQ y tamaño no soportado', () => {
    const p: PrintProviderProfile = { ...base, capabilities: { foil: false, uniqueQr: false, sizes: ['tarot'], minOrderQty: 500 } };
    const m = matchProviderToTirada(p, { hasFoil: true, hasUniqueQr: true, size: 'poker-63x88', quantity: 100 });
    expect(m.ok).toBe(false);
    expect(m.gaps.length).toBeGreaterThanOrEqual(4);
  });

  it('sin restricciones de tamaño/MOQ declaradas no genera falsos gaps', () => {
    const p: PrintProviderProfile = { ...base, capabilities: { foil: true, uniqueQr: true } };
    const m = matchProviderToTirada(p, { hasFoil: true, hasUniqueQr: true, size: 'poker-63x88', quantity: 10 });
    expect(m.ok).toBe(true);
  });
});
