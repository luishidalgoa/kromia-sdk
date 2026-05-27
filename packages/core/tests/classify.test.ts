/**
 * Contract tests para `classifyField`.
 *
 * Estos tests definen el **corpus canónico** de inputs (combinaciones
 * field+behavior) con sus outputs esperados. Cualquier SDK mirror
 * (futuro `protocol-dart` cuando exista Flutter) debe producir el mismo
 * output para los mismos inputs — garantía de paridad cross-language
 * por construcción.
 *
 * Si añades un behavior nuevo con `renderAsSlotKind`, también añade un
 * caso aquí cubriendo:
 *  - cómo se clasifica el field cuando tiene ese behavior
 *  - cómo se clasifica cuando tiene el `type` base pero NO el behavior
 *  - cualquier excepción semántica (ej: color_hex es type=text pero NO
 *    cae en text-short)
 *
 * El corpus también es ground truth para el visualizador del grafo
 * (KRO-71 Fase 3) y para los tooltips de la enciclopedia (KRO-70).
 */

import { describe, it, expect } from 'vitest';
import { classifyField, isFieldCompatibleWithSlot } from '../src/classify';
import type { SlotAcceptKind } from '../src/types';
import type { SlotDefinition } from '../src/registries/recipes';

/** Una entry del corpus: input + outputs esperados (orden ignorado). */
interface CorpusEntry {
  /** Descripción legible para el `it()`. */
  desc: string;
  field: { type: string; behavior?: string };
  /** Kinds que `classifyField` debe devolver. 'any' siempre incluido. */
  expectedKinds: SlotAcceptKind[];
}

const CORPUS: CorpusEntry[] = [
  // ── type=image ────────────────────────────────────────────────────
  {
    desc: 'image sin behavior → image + 3 legacy aliases',
    field: { type: 'image' },
    expectedKinds: ['any', 'image', 'image-avatar', 'image-banner', 'image-cover'],
  },

  // ── type=array<image> ─────────────────────────────────────────────
  {
    desc: 'array<image> sin behavior → image-array',
    field: { type: 'array<image>' },
    expectedKinds: ['any', 'image-array'],
  },
  {
    desc: 'array<image> con behavior=gallery → image-array',
    field: { type: 'array<image>', behavior: 'gallery' },
    expectedKinds: ['any', 'image-array'],
  },
  {
    desc: 'array<image> con behavior=slideshow → image-array',
    field: { type: 'array<image>', behavior: 'slideshow' },
    expectedKinds: ['any', 'image-array'],
  },
  {
    desc: 'array<image> con behavior=card_multiview → image-array',
    field: { type: 'array<image>', behavior: 'card_multiview' },
    expectedKinds: ['any', 'image-array'],
  },

  // ── type=number ───────────────────────────────────────────────────
  {
    desc: 'number sin behavior → number + text-short',
    field: { type: 'number' },
    expectedKinds: ['any', 'number', 'text-short'],
  },
  {
    desc: 'number con behavior=year → date + number + text-short',
    field: { type: 'number', behavior: 'year' },
    expectedKinds: ['any', 'date', 'number', 'text-short'],
  },
  {
    desc: 'number con behavior=rating → badge + number + text-short',
    field: { type: 'number', behavior: 'rating' },
    expectedKinds: ['any', 'badge', 'number', 'text-short'],
  },
  {
    desc: 'number con behavior=currency → solo number + text-short (currency no tiene renderAsSlotKind)',
    field: { type: 'number', behavior: 'currency' },
    expectedKinds: ['any', 'number', 'text-short'],
  },
  {
    desc: 'number con behavior=percentage → solo number + text-short',
    field: { type: 'number', behavior: 'percentage' },
    expectedKinds: ['any', 'number', 'text-short'],
  },

  // ── type=text ─────────────────────────────────────────────────────
  {
    desc: 'text sin behavior → text-short',
    field: { type: 'text' },
    expectedKinds: ['any', 'text-short'],
  },
  {
    desc: 'text con behavior=url → url + text-short',
    field: { type: 'text', behavior: 'url' },
    expectedKinds: ['any', 'url', 'text-short'],
  },
  {
    desc: 'text con behavior=email → url + text-short',
    field: { type: 'text', behavior: 'email' },
    expectedKinds: ['any', 'url', 'text-short'],
  },
  {
    desc: 'text con behavior=phone → url + text-short',
    field: { type: 'text', behavior: 'phone' },
    expectedKinds: ['any', 'url', 'text-short'],
  },
  {
    desc: 'text con behavior=iso_date → date + text-short',
    field: { type: 'text', behavior: 'iso_date' },
    expectedKinds: ['any', 'date', 'text-short'],
  },
  {
    desc: 'text con behavior=color_hex → color (NO text-short, excepción KRO-69)',
    field: { type: 'text', behavior: 'color_hex' },
    expectedKinds: ['any', 'color'],
  },
  {
    desc: 'text con behavior=ordinal_enum → badge + text-short',
    field: { type: 'text', behavior: 'ordinal_enum' },
    expectedKinds: ['any', 'badge', 'text-short'],
  },
  {
    desc: 'text con behavior=slug → solo text-short (slug no tiene renderAsSlotKind)',
    field: { type: 'text', behavior: 'slug' },
    expectedKinds: ['any', 'text-short'],
  },

  // ── type=textarea ─────────────────────────────────────────────────
  {
    desc: 'textarea sin behavior → text-long',
    field: { type: 'textarea' },
    expectedKinds: ['any', 'text-long'],
  },
  {
    desc: 'textarea con behavior=markdown → text-long',
    field: { type: 'textarea', behavior: 'markdown' },
    expectedKinds: ['any', 'text-long'],
  },
  {
    desc: 'textarea con behavior=notes → text-long',
    field: { type: 'textarea', behavior: 'notes' },
    expectedKinds: ['any', 'text-long'],
  },
  {
    desc: 'textarea con behavior=html → text-long',
    field: { type: 'textarea', behavior: 'html' },
    expectedKinds: ['any', 'text-long'],
  },
  {
    desc: 'textarea con behavior=code → solo text-long (code no tiene renderAsSlotKind)',
    field: { type: 'textarea', behavior: 'code' },
    expectedKinds: ['any', 'text-long'],
  },

  // ── type=select ───────────────────────────────────────────────────
  {
    desc: 'select sin behavior → text-short',
    field: { type: 'select' },
    expectedKinds: ['any', 'text-short'],
  },
  {
    desc: 'select con behavior=ordinal_enum → badge + text-short',
    field: { type: 'select', behavior: 'ordinal_enum' },
    expectedKinds: ['any', 'badge', 'text-short'],
  },

  // ── type=array<string> ─────────────────────────────────────────────
  {
    desc: 'array<string> con behavior=enum → badge',
    field: { type: 'array<string>', behavior: 'enum' },
    expectedKinds: ['any', 'badge'],
  },
  {
    desc: 'array<string> con behavior=card_code_list → card-ref',
    field: { type: 'array<string>', behavior: 'card_code_list' },
    expectedKinds: ['any', 'card-ref'],
  },
  {
    desc: 'array<string> con behavior=tags → solo any (tags no tiene renderAsSlotKind)',
    field: { type: 'array<string>', behavior: 'tags' },
    expectedKinds: ['any'],
  },

  // ── type=array<number> ─────────────────────────────────────────────
  {
    desc: 'array<number> con behavior=card_index_list → card-ref',
    field: { type: 'array<number>', behavior: 'card_index_list' },
    expectedKinds: ['any', 'card-ref'],
  },
  {
    desc: 'array<number> con behavior=year_list → date',
    field: { type: 'array<number>', behavior: 'year_list' },
    expectedKinds: ['any', 'date'],
  },

  // ── Edge cases ─────────────────────────────────────────────────────
  {
    desc: 'type desconocido → solo any',
    field: { type: 'unknown_future_type' },
    expectedKinds: ['any'],
  },
  {
    desc: 'behavior desconocido sobre text → text-short (fallback al type)',
    field: { type: 'text', behavior: 'mystery_behavior' },
    expectedKinds: ['any', 'text-short'],
  },
];

describe('classifyField — corpus canónico (cross-language ground truth)', () => {
  for (const entry of CORPUS) {
    it(entry.desc, () => {
      const result = classifyField(entry.field);
      // Ordenamos ambos lados para que el test no dependa del orden interno.
      expect([...result].sort()).toEqual([...entry.expectedKinds].sort());
    });
  }

  it('siempre incluye "any"', () => {
    for (const entry of CORPUS) {
      const kinds = classifyField(entry.field);
      expect(kinds).toContain('any');
    }
  });

  it('no devuelve duplicados', () => {
    for (const entry of CORPUS) {
      const kinds = classifyField(entry.field);
      const unique = new Set(kinds);
      expect(unique.size).toBe(kinds.length);
    }
  });
});

describe('isFieldCompatibleWithSlot', () => {
  const mkSlot = (accepts: SlotAcceptKind[]): SlotDefinition => ({
    id:      'test',
    label:   'Test',
    kind:    'single',
    accepts,
  });

  it('slot any-accepts admite cualquier field', () => {
    const slot = mkSlot(['any']);
    expect(isFieldCompatibleWithSlot({ type: 'text' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'image' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'unknown' }, slot)).toBe(true);
  });

  it('slot image admite type=image', () => {
    const slot = mkSlot(['image']);
    expect(isFieldCompatibleWithSlot({ type: 'image' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'text' }, slot)).toBe(false);
  });

  it('slot text-short NO admite color_hex (KRO-69 exception)', () => {
    const slot = mkSlot(['text-short']);
    expect(isFieldCompatibleWithSlot({ type: 'text', behavior: 'color_hex' }, slot)).toBe(false);
  });

  it('slot text-short admite number (number cae en text-short)', () => {
    const slot = mkSlot(['text-short']);
    expect(isFieldCompatibleWithSlot({ type: 'number' }, slot)).toBe(true);
  });

  it('slot color SOLO admite behavior=color_hex', () => {
    const slot = mkSlot(['color']);
    expect(isFieldCompatibleWithSlot({ type: 'text', behavior: 'color_hex' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'text' }, slot)).toBe(false);
    expect(isFieldCompatibleWithSlot({ type: 'image' }, slot)).toBe(false);
  });

  it('slot badge admite rating/enum/ordinal_enum', () => {
    const slot = mkSlot(['badge']);
    expect(isFieldCompatibleWithSlot({ type: 'number', behavior: 'rating' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'array<string>', behavior: 'enum' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'text', behavior: 'ordinal_enum' }, slot)).toBe(true);
    expect(isFieldCompatibleWithSlot({ type: 'text' }, slot)).toBe(false);
  });
});
