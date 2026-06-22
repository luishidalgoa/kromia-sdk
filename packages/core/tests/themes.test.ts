import { describe, it, expect } from 'vitest';
import { THEME_PRESETS, getThemePreset, applyThemePreset } from '../src/themes';
import { paletteContrastRatio, CONTRAST_AA } from '../src/palette';
import type { ViewComposition } from '../src/types';

function makeComposition(): ViewComposition {
  return {
    recipe: 'compact_card',
    slots: {
      title:    { fields: ['name'], appearance: { weight: 'bold', size: 'lg' } },
      subtitle: { fields: ['type'] },
      badge:    { fields: ['rarity'], appearance: { display: 'badge' } },
    },
    layout: {
      type: 'container', kind: 'grid', columns: 1, rows: 1,
      children: [{ type: 'slot', slot: 'title', place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 } }],
    },
  } as unknown as ViewComposition;
}

describe('THEME_PRESETS', () => {
  it('ids únicos', () => {
    const ids = THEME_PRESETS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // GUARD anti-ironía: ningún acabado puede disparar el aviso de contraste del
  // propio editor. Todos los pares de tonos crudos deben pasar AA.
  it('cada par paper↔text pasa contraste AA', () => {
    for (const t of THEME_PRESETS) {
      if (t.paperBg && t.textColor) {
        const r = paletteContrastRatio(t.textColor, t.paperBg);
        expect(r, `${t.id}: ${t.textColor} sobre ${t.paperBg} no verificable`).not.toBeNull();
        expect(r!, `${t.id}: texto/papel ${r?.toFixed(2)}:1 < AA`).toBeGreaterThanOrEqual(CONTRAST_AA);
      }
    }
  });

  it('cada acento (badge bg↔text) pasa contraste AA', () => {
    for (const t of THEME_PRESETS) {
      if (t.accent) {
        const r = paletteContrastRatio(t.accent.textColor, t.accent.bgColor);
        expect(r, `${t.id}: acento no verificable`).not.toBeNull();
        expect(r!, `${t.id}: acento ${r?.toFixed(2)}:1 < AA`).toBeGreaterThanOrEqual(CONTRAST_AA);
      }
    }
  });
});

describe('applyThemePreset', () => {
  it('recolorea todos los slots con el textColor del acabado', () => {
    const out = applyThemePreset(makeComposition(), 'oro');
    expect(out.slots.title.appearance?.textColor).toBe('amber-200');
    expect(out.slots.subtitle.appearance?.textColor).toBe('amber-200');
  });

  it('preserva la ESTRUCTURA (campos, peso, tamaño)', () => {
    const out = applyThemePreset(makeComposition(), 'oro');
    expect(out.slots.title.fields).toEqual(['name']);
    expect(out.slots.title.appearance?.weight).toBe('bold');
    expect(out.slots.title.appearance?.size).toBe('lg');
  });

  it('el slot badge recibe el acento (bg + text), no el text base', () => {
    const out = applyThemePreset(makeComposition(), 'oro');
    expect(out.slots.badge.appearance?.bgColor).toBe('amber-400');
    expect(out.slots.badge.appearance?.textColor).toBe('slate-800');
    expect(out.slots.badge.appearance?.display).toBe('badge'); // preservado
  });

  it('aplica el fondo papel al contenedor raíz', () => {
    const out = applyThemePreset(makeComposition(), 'editorial');
    expect((out.layout as any)?.surface?.bgColor).toBe('slate-200');
    expect((out.layout as any)?.surface?.radius).toBe('sm');
  });

  it('font del acabado se aplica (serif en editorial)', () => {
    const out = applyThemePreset(makeComposition(), 'editorial');
    expect(out.slots.title.appearance?.font).toBe('serif');
  });

  it('id desconocido → composición sin cambios', () => {
    const c = makeComposition();
    expect(applyThemePreset(c, 'no-existe')).toEqual(c);
  });

  it('es puro (no muta la entrada)', () => {
    const c = makeComposition();
    const snapshot = JSON.parse(JSON.stringify(c));
    applyThemePreset(c, 'neon');
    expect(c).toEqual(snapshot);
  });

  // KRO-198 — slots de IMAGEN toman el papel en su caja (no el color de texto)
  it('con fieldDefs: el slot de imagen recibe el papel como bgColor (no textColor)', () => {
    const c = makeComposition();
    (c.slots as any).thumb = { fields: ['art'] };
    const fieldDefs = [
      { key: 'name', type: 'text' }, { key: 'type', type: 'text' },
      { key: 'rarity', type: 'text' }, { key: 'art', type: 'image' },
    ] as any;
    const out = applyThemePreset(c, 'oro', fieldDefs);
    // imagen → bgColor = papel, sin textColor del acabado
    expect(out.slots.thumb.appearance?.bgColor).toBe('slate-800');
    expect(out.slots.thumb.appearance?.textColor).toBeUndefined();
    // texto → sigue recibiendo el textColor
    expect(out.slots.title.appearance?.textColor).toBe('amber-200');
  });

  it('sin fieldDefs: comportamiento previo (imagen no se distingue → textColor)', () => {
    const c = makeComposition();
    (c.slots as any).thumb = { fields: ['art'] };
    const out = applyThemePreset(c, 'oro');
    expect(out.slots.thumb.appearance?.textColor).toBe('amber-200');
  });

  it('getThemePreset', () => {
    expect(getThemePreset('bosque')?.label).toBe('Bosque');
    expect(getThemePreset('nope')).toBeUndefined();
  });
});
