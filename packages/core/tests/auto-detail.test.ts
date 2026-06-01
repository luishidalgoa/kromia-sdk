/**
 * Tests de `buildAutoDetailComposition` — KRO-73 (B+).
 *
 * Sección canónica → composition esperada. Cubre todas las heurísticas
 * + edge cases (sección vacía, fields que no encajan en ningún slot).
 */

import { describe, it, expect } from 'vitest';
import { buildAutoDetailComposition, buildAutoListComposition } from '../src/auto-detail';
import type { FieldDefLike } from '../src/types';

describe('buildAutoDetailComposition — defaults base', () => {
  it('sección vacía → composition con hero_protagonico + slots vacíos', () => {
    const result = buildAutoDetailComposition([]);
    expect(result.recipe).toBe('hero_protagonico');
    expect(result.action).toBe('none');
    expect(result.slots).toEqual({});
  });
});

describe('buildAutoDetailComposition — avatar / banner', () => {
  it('field con behavior=avatar → slot avatar', () => {
    const fields: FieldDefLike[] = [
      { key: 'pic', type: 'image', behavior: 'avatar' },
    ];
    const r = buildAutoDetailComposition(fields);
    expect(r.slots.avatar).toEqual({ fields: ['pic'] });
  });

  it('field con behavior=banner → slot banner', () => {
    const r = buildAutoDetailComposition([
      { key: 'header', type: 'image', behavior: 'banner' },
    ]);
    expect(r.slots.banner).toEqual({ fields: ['header'] });
  });

  it('field con behavior=cover (sin banner) → slot banner (fallback)', () => {
    const r = buildAutoDetailComposition([
      { key: 'cover', type: 'image', behavior: 'cover' },
    ]);
    expect(r.slots.banner).toEqual({ fields: ['cover'] });
  });

  it('field con behavior=thumbnail → slot banner (fallback)', () => {
    const r = buildAutoDetailComposition([
      { key: 'thumb', type: 'image', behavior: 'thumbnail' },
    ]);
    expect(r.slots.banner).toEqual({ fields: ['thumb'] });
  });

  it('banner explícito gana sobre cover', () => {
    const r = buildAutoDetailComposition([
      { key: 'cover',  type: 'image', behavior: 'cover' },
      { key: 'header', type: 'image', behavior: 'banner' },
    ]);
    expect(r.slots.banner).toEqual({ fields: ['header'] });
  });
});

describe('buildAutoDetailComposition — title', () => {
  it('primer text-short → slot title', () => {
    const r = buildAutoDetailComposition([
      { key: 'nombre', type: 'text' },
    ]);
    expect(r.slots.title).toEqual({ fields: ['nombre'] });
  });

  it('select también es text-short válido', () => {
    const r = buildAutoDetailComposition([
      { key: 'rareza', type: 'select', options: ['raro', 'común'] },
    ]);
    expect(r.slots.title).toEqual({ fields: ['rareza'] });
  });

  it('text con behavior=url NO va a title', () => {
    const r = buildAutoDetailComposition([
      { key: 'web', type: 'text', behavior: 'url' },
    ]);
    expect(r.slots.title).toBeUndefined();
  });

  it('text con behavior=email NO va a title', () => {
    const r = buildAutoDetailComposition([
      { key: 'mail', type: 'text', behavior: 'email' },
    ]);
    expect(r.slots.title).toBeUndefined();
  });
});

describe('buildAutoDetailComposition — subtitle', () => {
  it('primer year → subtitle', () => {
    const r = buildAutoDetailComposition([
      { key: 'temporada', type: 'number', behavior: 'year' },
    ]);
    expect(r.slots.subtitle).toEqual({ fields: ['temporada'] });
  });

  it('primer iso_date → subtitle', () => {
    const r = buildAutoDetailComposition([
      { key: 'fecha', type: 'text', behavior: 'iso_date' },
    ]);
    expect(r.slots.subtitle).toEqual({ fields: ['fecha'] });
  });
});

describe('buildAutoDetailComposition — stats', () => {
  it('un number → stats con 1 field', () => {
    const r = buildAutoDetailComposition([
      { key: 'edad', type: 'number' },
    ]);
    expect(r.slots.stats).toEqual({
      fields:      ['edad'],
      orientation: 'horizontal',
      separator:   ' | ',
    });
  });

  it('5 numbers → stats con primeros 4 (max)', () => {
    const r = buildAutoDetailComposition([
      { key: 'a', type: 'number' },
      { key: 'b', type: 'number' },
      { key: 'c', type: 'number' },
      { key: 'd', type: 'number' },
      { key: 'e', type: 'number' },
    ]);
    expect(r.slots.stats?.fields).toEqual(['a', 'b', 'c', 'd']);
  });

  it('cero numbers → sin slot stats', () => {
    const r = buildAutoDetailComposition([
      { key: 'nombre', type: 'text' },
    ]);
    expect(r.slots.stats).toBeUndefined();
  });
});

describe('buildAutoDetailComposition — body', () => {
  it('textarea → body', () => {
    const r = buildAutoDetailComposition([
      { key: 'desc', type: 'textarea' },
    ]);
    expect(r.slots.body).toEqual({ fields: ['desc'] });
  });

  it('behavior=markdown → body', () => {
    const r = buildAutoDetailComposition([
      { key: 'doc', type: 'text', behavior: 'markdown' },
    ]);
    expect(r.slots.body).toEqual({ fields: ['doc'] });
  });
});

describe('buildAutoDetailComposition — gallery', () => {
  it('array<image> → gallery', () => {
    const r = buildAutoDetailComposition([
      { key: 'fotos', type: 'array<image>' },
    ]);
    expect(r.slots.gallery).toEqual({ fields: ['fotos'] });
  });

  it('behavior=gallery → gallery', () => {
    const r = buildAutoDetailComposition([
      { key: 'g', type: 'array<image>', behavior: 'gallery' },
    ]);
    expect(r.slots.gallery).toEqual({ fields: ['g'] });
  });
});

describe('buildAutoDetailComposition — related', () => {
  it('behavior=card_index_list → related', () => {
    const r = buildAutoDetailComposition([
      { key: 'refs', type: 'array<number>', behavior: 'card_index_list' },
    ]);
    expect(r.slots.related).toEqual({ fields: ['refs'] });
  });
});

describe('buildAutoDetailComposition — composition completa', () => {
  it('sección rica → todos los slots se llenan correctamente', () => {
    const r = buildAutoDetailComposition([
      { key: 'avatar',  type: 'image',         behavior: 'avatar' },
      { key: 'nombre',  type: 'text' },
      { key: 'year',    type: 'number',        behavior: 'year' },
      { key: 'edad',    type: 'number' },
      { key: 'rating',  type: 'number' },
      { key: 'desc',    type: 'textarea' },
      { key: 'fotos',   type: 'array<image>',  behavior: 'gallery' },
    ]);
    expect(r.recipe).toBe('hero_protagonico');
    expect(r.slots.avatar?.fields).toEqual(['avatar']);
    expect(r.slots.title?.fields).toEqual(['nombre']);
    expect(r.slots.subtitle?.fields).toEqual(['year']);
    // year es type=number con behavior=year — pero buildAutoDetail filtra
    // stats por type=number sin importar behavior. ¿Year cuenta?
    // Re-leyendo: stats hace filter(f => f.type === 'number' && f.key !== titleKey).
    // year cuenta (es number, no es title). edad, rating también.
    expect(r.slots.stats?.fields).toEqual(['year', 'edad', 'rating']);
    expect(r.slots.body?.fields).toEqual(['desc']);
    expect(r.slots.gallery?.fields).toEqual(['fotos']);
  });
});

describe('buildAutoListComposition — recipe de LISTA (kind:list, nunca hero)', () => {
  it('sección vacía → row_text + slots vacíos + action none', () => {
    const r = buildAutoListComposition([]);
    expect(r.recipe).toBe('row_text');
    expect(r.action).toBe('none');
    expect(r.slots).toEqual({});
  });

  it('con imagen (avatar) → compact_avatar (NO hero_protagonico)', () => {
    const r = buildAutoListComposition([
      { key: 'pic',    type: 'image', behavior: 'avatar' },
      { key: 'nombre', type: 'text' },
    ]);
    expect(r.recipe).toBe('compact_avatar');
    expect(r.slots.avatar).toEqual({ fields: ['pic'] });
    expect(r.slots.title).toEqual({ fields: ['nombre'] });
  });

  it('image plano (sin behavior) también dispara compact_avatar', () => {
    const r = buildAutoListComposition([
      { key: 'foto',   type: 'image' },
      { key: 'nombre', type: 'text' },
    ]);
    expect(r.recipe).toBe('compact_avatar');
    expect(r.slots.avatar).toEqual({ fields: ['foto'] });
  });

  it('sin imagen → row_text con title + subtitle', () => {
    const r = buildAutoListComposition([
      { key: 'nombre', type: 'text' },
      { key: 'anio',   type: 'number', behavior: 'year' },
    ]);
    expect(r.recipe).toBe('row_text');
    expect(r.slots.title).toEqual({ fields: ['nombre'] });
    expect(r.slots.subtitle).toEqual({ fields: ['anio'] });
  });

  it('NUNCA devuelve una recipe kind:detail (hero/editorial/momento)', () => {
    const r = buildAutoListComposition([
      { key: 'banner', type: 'image', behavior: 'banner' },
      { key: 'titulo', type: 'text' },
      { key: 'cuerpo', type: 'textarea' },
    ]);
    expect(['compact_avatar', 'compact_card', 'row_text']).toContain(r.recipe);
    expect(r.recipe).not.toBe('hero_protagonico');
  });

  it('title y subtitle no colisionan (subtitle != title)', () => {
    const r = buildAutoListComposition([
      { key: 'nombre', type: 'text' },  // title
    ]);
    expect(r.slots.title).toEqual({ fields: ['nombre'] });
    expect(r.slots.subtitle).toBeUndefined();
  });
});
