/**
 * KRO-74 — `resolveTapAction`, `resolveDetailComposition`,
 * `resolveTargetRecipe`, `resolveExpandRecipe`, `isTappable`, `opensNewScreen`.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTapAction,
  resolveDetailComposition,
  resolveTargetRecipe,
  resolveExpandRecipe,
  isTappable,
  opensNewScreen,
} from '../src/interaction';
import type { ViewComposition } from '../src/types';

const base = (over: Partial<ViewComposition> = {}): ViewComposition => ({
  recipe: 'compact_avatar', action: 'none', slots: {}, ...over,
});

const fields = [
  { key: 'foto',   label: 'Foto',   type: 'image' as const, behavior: 'avatar' }, // behavior necesario para auto-slots
  { key: 'nombre', label: 'Nombre', type: 'text'     as const },
  { key: 'desc',   label: 'Desc',   type: 'textarea' as const },
  { key: 'web',    label: 'Web',    type: 'text'     as const, behavior: 'url' },
];

// ─── resolveTapAction ───────────────────────────────────────────────────────

describe('resolveTapAction', () => {
  it('none → { kind: "none" }', () => {
    expect(resolveTapAction(base(), {})).toEqual({ kind: 'none' });
  });

  it('navigate_to_detail → { kind: "navigate", detailComposition }', () => {
    const r = resolveTapAction(
      base({ action: 'navigate_to_detail', targetRecipe: 'editorial' }),
      {},
      { fieldDefs: fields },
    );
    expect(r.kind).toBe('navigate');
    if (r.kind === 'navigate') {
      expect(r.detailComposition.recipe).toBe('editorial');
    }
  });

  it('modal → { kind: "modal", detailComposition }', () => {
    const r = resolveTapAction(base({ action: 'modal' }), {}, { fieldDefs: fields });
    expect(r.kind).toBe('modal');
  });

  it('expand_inline → { kind: "expand", expandRecipe, expandSlots }', () => {
    const r = resolveTapAction(
      base({ action: 'expand_inline', expand: { recipe: 'accordion_simple', slots: { body: { fields: ['desc'] } } } }),
      {},
    );
    if (r.kind !== 'expand') throw new Error('expected expand');
    expect(r.expandRecipe).toBe('accordion_simple');
    expect(r.expandSlots).toEqual({ body: { fields: ['desc'] } });
  });

  it('expand_inline sin composition.expand → none', () => {
    expect(resolveTapAction(base({ action: 'expand_inline' }), {}).kind).toBe('none');
  });

  it('external_link → { kind: "external", url } desde item', () => {
    const r = resolveTapAction(
      base({ action: 'external_link', linkField: 'web' }),
      { web: 'https://ejemplo.com' },
    );
    if (r.kind !== 'external') throw new Error('expected external');
    expect(r.url).toBe('https://ejemplo.com');
  });

  it('external_link con field vacío → url vacía', () => {
    const r = resolveTapAction(base({ action: 'external_link', linkField: 'web' }), { web: '' });
    if (r.kind !== 'external') throw new Error('expected external');
    expect(r.url).toBe('');
  });

  it('external_link sin linkField → url vacía', () => {
    const r = resolveTapAction(base({ action: 'external_link' }), { web: 'x' });
    if (r.kind !== 'external') throw new Error('expected external');
    expect(r.url).toBe('');
  });
});

// ─── resolveDetailComposition ───────────────────────────────────────────────

describe('resolveDetailComposition', () => {
  it('targetComposition (cadena KRO-94) tiene prioridad', () => {
    const vc = base({
      action: 'navigate_to_detail',
      targetRecipe: 'editorial',
      targetComposition: { recipe: 'momento', action: 'none' },
    });
    const detail = resolveDetailComposition(vc, fields);
    expect(detail.recipe).toBe('momento');
  });

  it('targetComposition sin slots → rellena con auto-slots', () => {
    const vc = base({
      action: 'navigate_to_detail',
      targetComposition: { recipe: 'hero_protagonico', action: 'none' },
    });
    const detail = resolveDetailComposition(vc, fields);
    expect(detail.recipe).toBe('hero_protagonico');
    // auto-slots: foto → avatar, nombre → title
    expect(detail.slots.avatar?.fields).toContain('foto');
    expect(detail.slots.title?.fields).toContain('nombre');
  });

  it('KRO-133 — targetComposition con diseño por BLOQUES propaga layout + slotOverrides + accentPosition', () => {
    const layout = { type: 'container', kind: 'grid', columns: 1, rows: 1,
      children: [{ type: 'slot', slot: 'title', place: { colStart: 1, rowStart: 1 } }] } as any;
    const vc = base({
      action: 'navigate_to_detail',
      targetComposition: {
        recipe: 'editorial', action: 'none',
        slots: { title: { fields: ['nombre'] } },
        layout,
        slotOverrides: { disabled: ['subtitle'] },
        accentPosition: 'left',
      } as any,
    });
    const detail = resolveDetailComposition(vc, fields);
    // El lienzo guardado del detalle DEBE llegar al cliente (antes se perdía → preset).
    expect((detail as any).layout).toEqual(layout);
    expect((detail as any).slotOverrides?.disabled).toEqual(['subtitle']);
    expect((detail as any).accentPosition).toBe('left');
  });

  it('targetComposition preserva el siguiente salto (action + targetComposition anidado)', () => {
    const vc = base({
      action: 'navigate_to_detail',
      targetComposition: {
        recipe: 'hero_protagonico', action: 'modal',
        targetComposition: { recipe: 'editorial', action: 'none' },
      },
    });
    const detail = resolveDetailComposition(vc);
    expect(detail.action).toBe('modal');
    expect((detail as any).targetComposition?.recipe).toBe('editorial');
  });

  it('legacy targetRecipe → usa esa receta con auto-slots', () => {
    const vc = base({ action: 'navigate_to_detail', targetRecipe: 'editorial' });
    const detail = resolveDetailComposition(vc, fields);
    expect(detail.recipe).toBe('editorial');
  });

  it('sin ningún target → fallback auto hero_protagonico', () => {
    const detail = resolveDetailComposition(base({ action: 'navigate_to_detail' }), fields);
    expect(detail.recipe).toBe('hero_protagonico');
  });

  it('targetRecipe inválida (list recipe) → fallback auto', () => {
    const vc = base({ action: 'navigate_to_detail', targetRecipe: 'compact_avatar' });
    const detail = resolveDetailComposition(vc, fields);
    expect(detail.recipe).toBe('hero_protagonico'); // auto-fallback
  });
});

// ─── resolveTargetRecipe ────────────────────────────────────────────────────

describe('resolveTargetRecipe', () => {
  it('con galería → momento', () => {
    expect(resolveTargetRecipe([{ key: 'g', label: 'G', type: 'array<image>' }])).toBe('momento');
  });

  it('con imagen → hero_protagonico', () => {
    expect(resolveTargetRecipe([{ key: 'f', label: 'F', type: 'image' }])).toBe('hero_protagonico');
  });

  it('con behavior avatar → hero_protagonico', () => {
    expect(resolveTargetRecipe([{ key: 'a', label: 'A', type: 'text', behavior: 'avatar' }])).toBe('hero_protagonico');
  });

  it('sin imagen → editorial', () => {
    expect(resolveTargetRecipe([{ key: 'n', label: 'N', type: 'text' }])).toBe('editorial');
  });
});

// ─── resolveExpandRecipe ────────────────────────────────────────────────────

describe('resolveExpandRecipe', () => {
  it('con field url → accordion_with_actions', () => {
    expect(resolveExpandRecipe([{ key: 'w', label: 'W', type: 'text', behavior: 'url' }])).toBe('accordion_with_actions');
  });

  it('sin field enlazable → accordion_simple', () => {
    expect(resolveExpandRecipe([{ key: 't', label: 'T', type: 'textarea' }])).toBe('accordion_simple');
  });
});

// ─── isTappable / opensNewScreen ────────────────────────────────────────────

describe('isTappable / opensNewScreen', () => {
  it('action=none → no tappable', () => {
    expect(isTappable(base())).toBe(false);
  });

  it('action=navigate_to_detail → tappable + opens new screen', () => {
    const vc = base({ action: 'navigate_to_detail' });
    expect(isTappable(vc)).toBe(true);
    expect(opensNewScreen(vc)).toBe(true);
  });

  it('action=modal → tappable + opens new screen', () => {
    const vc = base({ action: 'modal' });
    expect(isTappable(vc)).toBe(true);
    expect(opensNewScreen(vc)).toBe(true);
  });

  it('action=expand_inline → tappable pero NO opens new screen', () => {
    const vc = base({ action: 'expand_inline' });
    expect(isTappable(vc)).toBe(true);
    expect(opensNewScreen(vc)).toBe(false);
  });

  it('action=external_link → tappable pero NO opens new screen', () => {
    const vc = base({ action: 'external_link' });
    expect(isTappable(vc)).toBe(true);
    expect(opensNewScreen(vc)).toBe(false);
  });
});
